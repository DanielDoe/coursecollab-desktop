import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { isBetaUser, getAssessmentRolloverConfigForStudent } from "@/lib/membership"
import { NOW_UTC } from "@/lib/central-time"

import { canRetakeAssessment, getCompletedAttemptCount } from "@/lib/retake-utils"
import { hasRetakeAccess, isRegularAssessmentSemesterHardCloseBlockingStudent } from "@/lib/retake-access"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import { buildActiveTermRolloverPolicy } from "@/lib/active-academic-term"
import { isFinalAssessmentDbType, isSingleSittingExamAssessmentDbType } from "@/lib/final-exam-policy"
import { isRegularAssessmentTypeForSemesterCutoff } from "@/lib/regular-assessments-cutoff"
import { isPastRegularAssessmentsHardCloseAsync } from "@/lib/regular-assessments-cutoff-server"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { normalizeAllowedStudentIds } from "@/lib/normalize-allowed-student-ids"
import {
  resolveStudentCourseContextByDbId,
  sqlQuizInStudentCourse,
} from "@/lib/student-course-scope"
import { membershipAssessmentBenefitsAllowedForStudent } from "@/lib/assessment-privilege-governance"
import {
  assessmentPerksExpiryIso,
  isPastAssessmentPerksExpiry,
} from "@/lib/assessment-perks-expiry"
import { getAssessmentPerksGraceDaysForCourse } from "@/lib/assessment-perks-grace-resolve"
import { getAttemptDisplayGradesBatch } from "@/lib/attempt-grade-display"
import { resolveAssessmentTimerDisplayLabel } from "@/lib/assessment-timer-display"
import {
  isStudentAssessmentGradeReleased,
  studentAssessmentGradeStatus,
} from "@/lib/student-grade-visibility"
import { isPreCourseStudent } from "@/lib/student-course-access-gate"

export const runtime = "nodejs"
export const revalidate = 10 // Cache for 10 seconds (read-heavy endpoint)


export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const studentDatabaseIdParam = searchParams.get("studentDatabaseId") // Support database ID as fallback
    // `type` is canonical; `assessmentType` is accepted for legacy routes (e.g. /student/homework page)
    const assessmentType =
      searchParams.get("type") ||
      searchParams.get("assessmentType") ||
      "quiz"

    if (!studentId && !studentDatabaseIdParam) {
      return NextResponse.json({ error: "Student ID or Database ID is required" }, { status: 400 })
    }

    const rawStudent = (studentDatabaseIdParam ?? studentId ?? "").trim()
    if (!rawStudent) {
      return NextResponse.json({ error: "Invalid student identifier" }, { status: 400 })
    }

    const auth = await requireBoundStudentCaller(request, rawStudent)
    if (!auth.ok) return auth.response
    const resolvedStudentId = auth.studentDbId

    let studentResult
    try {
      studentResult = await sql`
        SELECT 
          s.id, 
          s.section, 
          s.session_id,
          sess.code as session_code,
          s.beta_user
        FROM students s
        LEFT JOIN sessions sess ON s.session_id = sess.id
        WHERE s.id = ${resolvedStudentId}
        LIMIT 1
      `
    } catch (dbError: any) {
      console.error("[Student Quizzes API] ❌ Database query error:", dbError)
      // Check if it's a connection timeout
      if (dbError.message?.includes("timeout") || dbError.message?.includes("Connection terminated")) {
        return NextResponse.json({ 
          error: "Database connection timeout. Please try again in a moment.",
          quizzes: [] 
        }, { status: 503 }) // 503 Service Unavailable for timeout
      }
      throw dbError // Re-throw other database errors
    }

    if (studentResult.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const student = studentResult[0]
    const studentDatabaseId = student.id

    if (await isPreCourseStudent(studentDatabaseId)) {
      const rolloverPolicy = await buildActiveTermRolloverPolicy()
      return NextResponse.json({
        quizzes: [],
        rollover_policy: rolloverPolicy,
        pre_course: true,
      })
    }

    const courseCtx = await resolveStudentCourseContextByDbId(studentDatabaseId)
    if (courseCtx) {
      if (courseCtx.sessionId != null) {
        student.session_id = courseCtx.sessionId
      }
      if (courseCtx.sessionCode) {
        student.session_code = courseCtx.sessionCode
      }
    }
    const studentCourseClause =
      courseCtx?.courseId != null
        ? sqlQuizInStudentCourse("q", courseCtx.courseId)
        : sql.unsafe("(TRUE)")
    
    // Resolve catalog session when FK join failed (orphan session_id) or session_id null (section text only)
    if ((!student.session_id || !student.session_code) && student.section && !courseCtx?.sessionId) {
      const sectionCode = String(student.section || "").trim()
      if (sectionCode) {
        try {
          const variants = normalizedSectionVariantsForSql(sectionCode)
          const courseIdForLookup = courseCtx?.courseId ?? null
          const sessionByCode =
            variants.length > 0
              ? courseIdForLookup != null
                ? await sql`
                    SELECT id, code FROM sessions
                    WHERE course_id = ${courseIdForLookup}
                      AND TRIM(code) = ANY(${variants}::text[])
                    ORDER BY code
                    LIMIT 1
                  `
                : await sql`
                    SELECT id, code FROM sessions
                    WHERE TRIM(code) = ANY(${variants}::text[])
                    ORDER BY code
                    LIMIT 1
                  `
              : []
          if (sessionByCode.length > 0) {
            student.session_id = sessionByCode[0].id
            student.session_code = sessionByCode[0].code
          }
        } catch (sessionError) {
          console.error("[Student Quizzes API] Error finding session by code:", sessionError)
        }
      }
    }

    const now = new Date()
    const rolloverPolicy = await buildActiveTermRolloverPolicy(now)
    const rolloverSelfServiceOpen = rolloverPolicy.self_service_open

    // Check if student is a beta user (for bypassing date restrictions)
    const isBeta = await isBetaUser(student.id)

    // Get beta session ID if it exists (for beta users to access beta-restricted quizzes)
    let betaSessionId: number | null = null
    if (isBeta) {
      const courseR = await sql`
        SELECT sess.course_id
        FROM students st
        INNER JOIN sessions sess ON sess.id = st.session_id
        WHERE st.id = ${student.id}
        LIMIT 1
      `
      const cid = courseR[0]?.course_id != null ? Number(courseR[0].course_id) : null
      const betaSession =
        cid != null && Number.isFinite(cid)
          ? await sql`
              SELECT id FROM sessions
              WHERE TRIM(UPPER(code)) = 'BETA' AND course_id = ${cid}
              LIMIT 1
            `
          : await sql`
              SELECT id FROM sessions WHERE TRIM(UPPER(code)) = 'BETA' LIMIT 1
            `
      if (betaSession.length > 0) {
        betaSessionId = Number(betaSession[0].id)
      }
    }

    // Ensure session_id is a number for type safety
    // Use -1 as sentinel value for null to avoid PostgreSQL parameter type inference issues
    // -1 is unlikely to be a real session ID, so it's safe to use as a sentinel
    const studentSessionId = student.session_id ? Number(student.session_id) : -1

    // Build the query conditionally based on whether betaSessionId exists
    // This avoids PostgreSQL type inference issues with NULL parameters
    let adminQuizzes
    const isBetaBool = Boolean(isBeta)
    const betaSessionIdNum = betaSessionId !== null ? Number(betaSessionId) : null
    const semesterHardClosePast = await isPastRegularAssessmentsHardCloseAsync(now)
    const betaBypassesQuizDates =
      isBetaBool &&
      (!semesterHardClosePast || isFinalAssessmentDbType(assessmentType))

    if (betaSessionIdNum !== null) {
      // Beta session ID exists - include beta check in query
      adminQuizzes = await sql`
      SELECT 
        q.id,
        q.title,
        q.description,
        q.time_per_question,
        q.created_by,
        q.created_at,
        q.available_from,
        q.available_until,
        q.retake_enabled,
        q.retake_limit,
        q.assessment_type,
        q.section_config,
        q.description,
        COALESCE(q.restrict_access_to_students, false) as restrict_access_to_students,
        q.allowed_student_ids,
        COALESCE(q.rollover_enabled, false) as rollover_enabled,
        COALESCE(q.rollover_hours, 24)::int as rollover_hours,
        COUNT(DISTINCT qq.id) as question_count,
        'admin' as quiz_type,
        (
          COALESCE(BOOL_OR(qsa.is_active), false) = true
          OR (
            q.assessment_type = 'final'
            AND NOT COALESCE(q.restrict_access_to_students, false)
            AND q.parent_quiz_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM quiz_session_access qsa_parent_sa
              WHERE qsa_parent_sa.quiz_id = q.parent_quiz_id
                AND qsa_parent_sa.session_id = ${studentSessionId}
                AND qsa_parent_sa.is_active = true
            )
          )
          OR (
            q.assessment_type = 'final'
            AND COALESCE(q.restrict_access_to_students, false)
            AND q.parent_quiz_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM quiz_session_access qsa_parent_sa_rc
              WHERE qsa_parent_sa_rc.quiz_id = q.parent_quiz_id
                AND qsa_parent_sa_rc.session_id = ${studentSessionId}
                AND qsa_parent_sa_rc.is_active = true
            )
          )
        ) as session_active,
        -- Instructor/session toggle only (quiz_session_access). Calendar window is applied in JS so
        -- students see "Closed" when past due while section access stays "on" in the API.
        CASE 
          WHEN (
            (COALESCE(BOOL_OR(qsa.is_active), false) = true)
            OR (${isBetaBool} AND EXISTS (
              SELECT 1 FROM quiz_session_access qsa_beta 
              WHERE qsa_beta.quiz_id = q.id 
              AND qsa_beta.session_id = ${betaSessionIdNum}
              AND qsa_beta.is_active = true
            ))
            OR (
              q.assessment_type = 'final'
              AND NOT COALESCE(q.restrict_access_to_students, false)
              AND q.parent_quiz_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM quiz_session_access qsa_parent_active
                WHERE qsa_parent_active.quiz_id = q.parent_quiz_id
                  AND qsa_parent_active.session_id = ${studentSessionId}
                  AND qsa_parent_active.is_active = true
              )
            )
            OR (
              q.assessment_type = 'final'
              AND COALESCE(q.restrict_access_to_students, false)
              AND q.parent_quiz_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM quiz_session_access qsa_parent_active_rc
                WHERE qsa_parent_active_rc.quiz_id = q.parent_quiz_id
                  AND qsa_parent_active_rc.session_id = ${studentSessionId}
                  AND qsa_parent_active_rc.is_active = true
              )
            )
          )
          THEN true
          ELSE false
        END as session_access_active,
        COALESCE(
          AVG(COALESCE(qq.time_limit, q.time_per_question)),
          q.time_per_question
        ) as actual_time_per_question
      FROM quizzes q
      LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
      LEFT JOIN quiz_session_access qsa ON q.id = qsa.quiz_id AND (${studentSessionId} = -1 OR qsa.session_id = ${studentSessionId})
      WHERE q.assessment_type = ${assessmentType}
        AND q.deleted_at IS NULL
        AND (${studentCourseClause})
        AND (
          (q.assessment_type = 'final')
          OR (NOT COALESCE(q.restrict_access_to_students, false))
          OR (COALESCE(q.allowed_student_ids, '[]'::jsonb) @> to_jsonb(${studentDatabaseId}::integer))
          OR EXISTS (
            SELECT 1 FROM quiz_attempts qa_allow_vis
            WHERE qa_allow_vis.quiz_id = q.id
              AND qa_allow_vis.student_id = ${studentDatabaseId}
              AND qa_allow_vis.deleted_at IS NULL
              AND qa_allow_vis.completed_at IS NOT NULL
          )
        )
        AND (
          -- Student's session has access (using EXISTS subquery)
          (${studentSessionId} = -1 OR EXISTS (
            SELECT 1 FROM quiz_session_access qsa_check 
            WHERE qsa_check.quiz_id = q.id 
            AND qsa_check.session_id = ${studentSessionId}
            AND qsa_check.is_active = true
          ))
          -- Unrestricted child final (e.g. practice mock): inherit section access from parent quiz
          OR (
            q.assessment_type = 'final'
            AND NOT COALESCE(q.restrict_access_to_students, false)
            AND q.parent_quiz_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM quiz_session_access qsa_parent
              WHERE qsa_parent.quiz_id = q.parent_quiz_id
                AND qsa_parent.session_id = ${studentSessionId}
                AND qsa_parent.is_active = true
            )
          )
          -- Restricted child final: parent's session access (allowlist enforced in API response, not SQL)
          OR (
            q.assessment_type = 'final'
            AND COALESCE(q.restrict_access_to_students, false)
            AND q.parent_quiz_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM quiz_session_access qsa_parent_where_rc
              WHERE qsa_parent_where_rc.quiz_id = q.parent_quiz_id
                AND qsa_parent_where_rc.session_id = ${studentSessionId}
                AND qsa_parent_where_rc.is_active = true
            )
          )
          -- OR beta user and quiz has beta session access
          OR (${isBetaBool} AND EXISTS (
            SELECT 1 FROM quiz_session_access qsa_beta 
            WHERE qsa_beta.quiz_id = q.id 
            AND qsa_beta.session_id = ${betaSessionIdNum}
            AND qsa_beta.is_active = true
          ))
        )
        GROUP BY q.id, q.title, q.description, q.time_per_question, q.created_by, q.created_at, q.available_from, q.available_until, q.retake_enabled, q.retake_limit, q.assessment_type, q.rollover_enabled, q.rollover_hours, q.parent_quiz_id, q.restrict_access_to_students, q.allowed_student_ids
      ORDER BY q.created_at DESC
      `
    } else {
      // No beta session ID - simpler query without beta check
      adminQuizzes = await sql`
        SELECT 
          q.id,
          q.title,
          q.description,
          q.time_per_question,
          q.created_by,
          q.available_from,
          q.available_until,
          q.retake_enabled,
          q.retake_limit,
          q.assessment_type,
          COALESCE(q.restrict_access_to_students, false) as restrict_access_to_students,
          q.allowed_student_ids,
          COALESCE(q.rollover_enabled, false) as rollover_enabled,
          COALESCE(q.rollover_hours, 24)::int as rollover_hours,
          COUNT(DISTINCT qq.id) as question_count,
          'admin' as quiz_type,
          (
            COALESCE(BOOL_OR(qsa.is_active), false) = true
            OR (
              q.assessment_type = 'final'
              AND NOT COALESCE(q.restrict_access_to_students, false)
              AND q.parent_quiz_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM quiz_session_access qsa_parent_sa2
                WHERE qsa_parent_sa2.quiz_id = q.parent_quiz_id
                  AND qsa_parent_sa2.session_id = ${studentSessionId}
                  AND qsa_parent_sa2.is_active = true
              )
            )
            OR (
              q.assessment_type = 'final'
              AND COALESCE(q.restrict_access_to_students, false)
              AND q.parent_quiz_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM quiz_session_access qsa_parent_sa2_rc
                WHERE qsa_parent_sa2_rc.quiz_id = q.parent_quiz_id
                  AND qsa_parent_sa2_rc.session_id = ${studentSessionId}
                  AND qsa_parent_sa2_rc.is_active = true
              )
            )
          ) as session_active,
          CASE 
            WHEN (
              COALESCE(BOOL_OR(qsa.is_active), false) = true
              OR (
                q.assessment_type = 'final'
                AND NOT COALESCE(q.restrict_access_to_students, false)
                AND q.parent_quiz_id IS NOT NULL
                AND EXISTS (
                  SELECT 1 FROM quiz_session_access qsa_parent_active2
                  WHERE qsa_parent_active2.quiz_id = q.parent_quiz_id
                    AND qsa_parent_active2.session_id = ${studentSessionId}
                    AND qsa_parent_active2.is_active = true
                )
              )
              OR (
                q.assessment_type = 'final'
                AND COALESCE(q.restrict_access_to_students, false)
                AND q.parent_quiz_id IS NOT NULL
                AND EXISTS (
                  SELECT 1 FROM quiz_session_access qsa_parent_active2_rc
                  WHERE qsa_parent_active2_rc.quiz_id = q.parent_quiz_id
                    AND qsa_parent_active2_rc.session_id = ${studentSessionId}
                    AND qsa_parent_active2_rc.is_active = true
                )
              )
            )
            THEN true
            ELSE false
          END as session_access_active,
          COALESCE(
            AVG(COALESCE(qq.time_limit, q.time_per_question)),
            q.time_per_question
          ) as actual_time_per_question
        FROM quizzes q
        LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
        LEFT JOIN quiz_session_access qsa ON q.id = qsa.quiz_id AND (${studentSessionId} = -1 OR qsa.session_id = ${studentSessionId})
        WHERE q.assessment_type = ${assessmentType}
          AND q.deleted_at IS NULL
          AND (${studentCourseClause})
          AND (
            (q.assessment_type = 'final')
            OR (NOT COALESCE(q.restrict_access_to_students, false))
            OR (COALESCE(q.allowed_student_ids, '[]'::jsonb) @> to_jsonb(${studentDatabaseId}::integer))
            OR EXISTS (
              SELECT 1 FROM quiz_attempts qa_allow_vis
              WHERE qa_allow_vis.quiz_id = q.id
                AND qa_allow_vis.student_id = ${studentDatabaseId}
                AND qa_allow_vis.deleted_at IS NULL
                AND qa_allow_vis.completed_at IS NOT NULL
            )
          )
          AND (
            -- Student's session has access (using EXISTS subquery)
            (${studentSessionId} = -1 OR EXISTS (
              SELECT 1 FROM quiz_session_access qsa_check 
              WHERE qsa_check.quiz_id = q.id 
              AND qsa_check.session_id = ${studentSessionId}
              AND qsa_check.is_active = true
            ))
            OR (
              q.assessment_type = 'final'
              AND NOT COALESCE(q.restrict_access_to_students, false)
              AND q.parent_quiz_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM quiz_session_access qsa_parent
                WHERE qsa_parent.quiz_id = q.parent_quiz_id
                  AND qsa_parent.session_id = ${studentSessionId}
                  AND qsa_parent.is_active = true
              )
            )
            OR (
              q.assessment_type = 'final'
              AND COALESCE(q.restrict_access_to_students, false)
              AND q.parent_quiz_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM quiz_session_access qsa_parent_where_rc2
                WHERE qsa_parent_where_rc2.quiz_id = q.parent_quiz_id
                  AND qsa_parent_where_rc2.session_id = ${studentSessionId}
                  AND qsa_parent_where_rc2.is_active = true
              )
            )
          )
        GROUP BY q.id, q.title, q.description, q.time_per_question, q.created_by, q.created_at, q.available_from, q.available_until, q.retake_enabled, q.retake_limit, q.assessment_type, q.rollover_enabled, q.rollover_hours, q.parent_quiz_id, q.restrict_access_to_students, q.allowed_student_ids
      ORDER BY q.created_at DESC
      `
    }

    // Retake access: only Explorer, Trailblazer, donation, or beta can retake
    const hasRetakeAccessCheck = await hasRetakeAccess(studentDatabaseId)

    // Rollover rows (membership apply counts drive Explorer 1× / Trailblazer 3× per assessment)
    const rolloverRows = await sql`
      SELECT quiz_id, expires_at, COALESCE(membership_rollover_applies_used, 0) AS membership_rollover_applies_used
      FROM student_assessment_rollovers
      WHERE student_id = ${studentDatabaseId}
    `
    const rolloverByQuiz = new Map<
      number,
      { expires_at: Date | null; membership_rollover_applies_used: number }
    >()
    for (const r of rolloverRows) {
      const exp = r.expires_at
      rolloverByQuiz.set(r.quiz_id, {
        expires_at: exp == null ? null : new Date(exp as string),
        membership_rollover_applies_used: Number(r.membership_rollover_applies_used) || 0,
      })
    }
    const activeRollovers: Map<number, { expires_at: Date | null }> = new Map()
    for (const r of rolloverRows) {
      const exp = r.expires_at
      if (exp == null || new Date(exp as string).getTime() > now.getTime()) {
        activeRollovers.set(r.quiz_id, {
          expires_at: exp == null ? null : new Date(exp as string),
        })
      }
    }
    const rolloverCfg = await getAssessmentRolloverConfigForStudent(studentDatabaseId)
    const membershipAssessmentPerksAllowed = await membershipAssessmentBenefitsAllowedForStudent(
      studentDatabaseId,
      courseCtx?.courseId ?? null,
    )
    const semesterHardCloseBlocksStudent = await isRegularAssessmentSemesterHardCloseBlockingStudent(
      studentDatabaseId,
      courseCtx?.courseId ?? null,
      now,
    )
    const perksGraceDays = await getAssessmentPerksGraceDaysForCourse(courseCtx?.courseId ?? null)

    let attemptOverrideGrantsRetakeByQuiz = new Map<number, boolean>()
    try {
      const overrideRows = await sql`
        SELECT quiz_id, additional_attempts
        FROM attempt_overrides
        WHERE student_id = ${studentDatabaseId}
          AND is_active = TRUE
          AND (expires_at IS NULL OR expires_at > NOW())
      `
      for (const row of overrideRows as { quiz_id: number; additional_attempts: unknown }[]) {
        const n = Number(row.additional_attempts) || 0
        attemptOverrideGrantsRetakeByQuiz.set(row.quiz_id, n > 0)
      }
    } catch {
      // attempt_overrides may not exist in some environments
    }

    const attempts = await sql`
      SELECT 
        id as attempt_id, 
        quiz_id, 
        score, 
        total_questions,
        completed_at,
        attempt_number,
        saved_for_later_at,
        results_finalized_at,
        violation_log
      FROM quiz_attempts
      WHERE student_id = ${studentDatabaseId}
        AND deleted_at IS NULL
      ORDER BY attempt_number DESC
    `

    let quizzesWithAttempts: any[] = []
    try {
      quizzesWithAttempts = await Promise.all(
        adminQuizzes.map(async (quiz) => {
          try {
            const quizAttempts = attempts.filter((a) => a.quiz_id === quiz.id)
            // Sort completed attempts by attempt_number DESC to get the latest completed one
            const completedAttempts = quizAttempts
              .filter((a) => a.completed_at)
              .sort((a, b) => (b.attempt_number || 0) - (a.attempt_number || 0))
            // Get the latest completed attempt for score, or latest attempt if none completed
            const latestCompletedAttempt = completedAttempts.length > 0 
              ? completedAttempts[0] // Latest completed attempt
              : null
            const latestAttempt = quizAttempts[0]
            const inProgressAttempt = quizAttempts.find((a) => !a.completed_at && a.saved_for_later_at)

            const completedCount = await getCompletedAttemptCount(studentDatabaseId, quiz.id)
            const isCompleted = completedCount > 0
            const savedForLater = Boolean(inProgressAttempt?.saved_for_later_at)

            // Trailblazer rollover: past-due assessments with rollover_enabled can be accessed if student applied rollover
            const availableUntil = quiz.available_until ? new Date(quiz.available_until) : null
            const isPastDue = availableUntil && availableUntil.getTime() < now.getTime()
            const rolloverData = activeRollovers.get(quiz.id)
            const rolloverActive = Boolean(rolloverData)
            const rolloverRow = rolloverByQuiz.get(quiz.id)
            const membershipAppliesUsed = rolloverRow?.membership_rollover_applies_used ?? 0

            // Overrides extend the calendar window the same as rollover rows (lib/deadline-extension.ts)
            const hasAttemptOverride =
              attemptOverrideGrantsRetakeByQuiz.get(quiz.id) === true
            const assessmentDbType = quiz.assessment_type as string | undefined
            const isSingleSittingExam = isSingleSittingExamAssessmentDbType(assessmentDbType)
            const semesterHardClosed =
              isRegularAssessmentTypeForSemesterCutoff(assessmentDbType) &&
              semesterHardCloseBlocksStudent
            const deadlineExtensionActiveRaw =
              isSingleSittingExam ? hasAttemptOverride : rolloverActive || hasAttemptOverride
            const deadlineExtensionActive = semesterHardClosed ? false : deadlineExtensionActiveRaw

            // Retakes after calendar due require active rollover/extension; before due, normal tier limits
            const retakeCheck = await canRetakeAssessment(
              studentDatabaseId,
              quiz.id,
              quiz.retake_limit,
              quiz.retake_enabled,
              completedCount,
              undefined,
              {
                availableUntil: quiz.available_until,
                hasDeadlineExtension: deadlineExtensionActiveRaw,
                bypassCalendarRetakeExpiry: isBeta,
              },
            )
            const restrictAccess = quiz.restrict_access_to_students === true
            const allowedIds = normalizeAllowedStudentIds(quiz.allowed_student_ids)
            const finalAccessPendingAllowlist =
              assessmentDbType === "final" && restrictAccess && !allowedIds.includes(studentDatabaseId)

            const canRetake = isSingleSittingExam
              ? hasAttemptOverride && retakeCheck.canRetake && !finalAccessPendingAllowlist
              : retakeCheck.canRetake &&
                (hasRetakeAccessCheck || hasAttemptOverride) &&
                !finalAccessPendingAllowlist

            const sessionActive = Boolean(quiz.session_access_active)
            const calendarOpen =
              (!quiz.available_from || new Date(quiz.available_from as string).getTime() <= now.getTime()) &&
              (!quiz.available_until || new Date(quiz.available_until as string).getTime() >= now.getTime())

            /** For UI: true when the posted/until window is open, or beta may bypass quiz dates. */
            const calendarOpenForClient = semesterHardClosed
              ? false
              : calendarOpen || betaBypassesQuizDates

            const effectiveActive = semesterHardClosed
              ? false
              : (sessionActive && (betaBypassesQuizDates || calendarOpen)) ||
                deadlineExtensionActiveRaw ||
                (Boolean(isPastDue) && isCompleted && canRetake)

            // Quiz must be active (or rollover-active) AND either not completed OR retakeable;
            // restricted finals: visible when session allows, but start only if student is on allowlist.
            const canTakeQuiz =
              effectiveActive &&
              !finalAccessPendingAllowlist &&
              (!isCompleted || canRetake)

            const rolloverAllowedOnAssessment =
              !isSingleSittingExam &&
              (Boolean(quiz.rollover_enabled) || membershipAssessmentPerksAllowed)
            const canApplyRollover =
              !isSingleSittingExam &&
              !semesterHardClosed &&
              rolloverSelfServiceOpen &&
              Boolean(isPastDue) &&
              !isPastAssessmentPerksExpiry(quiz.available_until, now, perksGraceDays) &&
              rolloverAllowedOnAssessment &&
              rolloverCfg.enabled &&
              !rolloverActive &&
              membershipAppliesUsed < rolloverCfg.maxAttemptsPerAssessment
            const rollover_requires_upgrade =
              !isSingleSittingExam &&
              !semesterHardClosed &&
              Boolean(isPastDue) &&
              rolloverAllowedOnAssessment &&
              !rolloverCfg.enabled

            // Use latest completed attempt for score, or latest attempt if no completed attempts
            const scoreAttempt = latestCompletedAttempt || latestAttempt

            const scoreAttemptRow = scoreAttempt as {
              attempt_id?: number
              score?: number
              total_questions?: number
              completed_at?: string | null
              results_finalized_at?: string | null
              violation_log?: unknown
            } | null
            const violationLog = scoreAttemptRow?.violation_log
            const shouldShowPnd =
              Array.isArray(violationLog) &&
              violationLog.some(
                (e: { type?: string }) =>
                  e?.type === "score_pending" || e?.type === "evaluation_failed",
              )
            const gradeReleased =
              scoreAttemptRow?.completed_at &&
              isStudentAssessmentGradeReleased({
                completed_at: scoreAttemptRow.completed_at,
                results_finalized_at: scoreAttemptRow.results_finalized_at,
                should_show_pnd: shouldShowPnd,
              })
            const gradeStatus = scoreAttemptRow?.completed_at
              ? studentAssessmentGradeStatus({
                  completed_at: scoreAttemptRow.completed_at,
                  results_finalized_at: scoreAttemptRow.results_finalized_at,
                  should_show_pnd: shouldShowPnd,
                })
              : null
            const visibleScore = gradeReleased ? scoreAttemptRow?.score : undefined
            const visibleTotalQuestions = gradeReleased
              ? scoreAttemptRow?.total_questions
              : undefined

            const { allowed_student_ids: _omitAllowed, restrict_access_to_students: _omitRestrict, ...quizOut } =
              quiz as typeof quiz & { allowed_student_ids?: unknown; restrict_access_to_students?: unknown }

            const timerDisplayLabel = resolveAssessmentTimerDisplayLabel(
              assessmentDbType,
              (quiz as { section_config?: unknown }).section_config,
              Number(quiz.actual_time_per_question),
            )

            return {
              ...quizOut,
              timer_display_label: timerDisplayLabel,
              time_per_question: Math.round(Number(quiz.actual_time_per_question)),
              attempted: quizAttempts.length > 0,
              completed: isCompleted,
              /** Semester concluded (secondary); per-assessment available_until is the primary due gate. */
              semester_assessments_closed: semesterHardClosed,
              session_access_active: sessionActive,
              calendar_open: calendarOpenForClient,
              can_retake: canRetake && effectiveActive,
              can_take: canTakeQuiz,
              is_active: effectiveActive,
              final_access_pending_allowlist: finalAccessPendingAllowlist,
              can_apply_rollover: canApplyRollover,
              rollover_requires_upgrade: rollover_requires_upgrade,
              rollover_active: deadlineExtensionActive,
              rollover_expires_at: rolloverData?.expires_at?.toISOString() ?? null,
              rollover_hours: rolloverCfg.enabled ? rolloverCfg.windowHours : (quiz.rollover_hours ?? 24),
              rollover_membership_applies_used: membershipAppliesUsed,
              rollover_membership_applies_max: rolloverCfg.maxAttemptsPerAssessment,
              attempt_id: scoreAttempt?.attempt_id || latestAttempt?.attempt_id,
              score: visibleScore,
              total_questions: visibleTotalQuestions,
              grade_status: gradeStatus,
              grade_released: gradeReleased === true,
              attempts_used: completedCount,
              attempts_remaining: isSingleSittingExam ? 0 : retakeCheck.attemptsRemaining,
              calendar_retake_perks_expired: retakeCheck.calendarRetakePerksExpired ?? false,
              expired_retake_slots: retakeCheck.expiredRetakeSlots ?? null,
              assessment_perks_expires_at: assessmentPerksExpiryIso(quiz.available_until, perksGraceDays),
              saved_for_later: savedForLater,
              in_progress_attempt_id: savedForLater && inProgressAttempt ? inProgressAttempt.attempt_id : null,
            }
          } catch (quizError) {
            console.error(`[Student Quizzes API] ❌ Error processing quiz ${quiz.id}:`, quizError)
            // Return a minimal quiz object so we don't lose all quizzes if one fails
            return {
              ...quiz,
              time_per_question: Math.round(Number(quiz.actual_time_per_question || 0)),
              attempted: false,
              completed: false,
              semester_assessments_closed: false,
              session_access_active: Boolean(quiz.session_access_active),
              calendar_open: false,
              can_retake: false,
              can_take: false,
              can_apply_rollover: false,
              rollover_requires_upgrade: false,
              rollover_active: false,
              rollover_expires_at: null,
              rollover_membership_applies_used: 0,
              rollover_membership_applies_max: 0,
              attempts_used: 0,
              attempts_remaining: 0,
              calendar_retake_perks_expired: false,
              expired_retake_slots: null,
              final_access_pending_allowlist: false,
            }
          }
        })
      )
    } catch (error) {
      console.error(`[Student Quizzes API] ❌ Error in Promise.all:`, error)
      quizzesWithAttempts = []
    }

    // Ensure quizzesWithAttempts is always an array
    let quizzesArray = Array.isArray(quizzesWithAttempts) ? quizzesWithAttempts : []

    const attemptIdsForDisplay = quizzesArray
      .map((q) => q.attempt_id as number | undefined)
      .filter((id): id is number => typeof id === "number" && id > 0)
    if (attemptIdsForDisplay.length > 0) {
      const displayGrades = await getAttemptDisplayGradesBatch(attemptIdsForDisplay)
      quizzesArray = quizzesArray.map((quiz) => {
        const aid = quiz.attempt_id as number | undefined
        if (!aid) return quiz
        const grade = displayGrades.get(aid)
        if (!grade) return quiz
        return {
          ...quiz,
          score: grade.score,
          total_questions: grade.totalPoints,
          display_percentage: grade.percentage,
        }
      })
    }

    return NextResponse.json({
      quizzes: quizzesArray,
      rollover_policy: {
        ...rolloverPolicy,
        assessment_perks_grace_days_after_deadline: perksGraceDays,
      },
    })
  } catch (error) {
    console.error("[Student Quizzes API] ❌ Failed to fetch quizzes:", error)
    return NextResponse.json({ error: "Failed to fetch quizzes", quizzes: [] }, { status: 500 })
  }
}
