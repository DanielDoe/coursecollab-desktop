import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireStudentPracticeCaller } from "@/lib/require-student-practice-auth"
import { formatQuestionBankRowForRenderer } from "@/lib/resolve-quiz-question-from-bank"
import { getEffectiveMembershipTier } from "@/lib/membership"
import { getPracticeHubPolicyForCourse } from "@/lib/practice-hub-policy-settings.server"
import {
  practiceHubDailyCapForTier,
  practiceHubWeeklyCapForTier,
  resolvePracticeSessionQuestionCount,
} from "@/lib/practice-hub-policy-settings"
import {
  applyPracticeQuestionLocks,
  practiceAccessForStudentClient,
  practiceAccessLevelForTier,
  unlockedQuestionCountForTier,
} from "@/lib/practice-tier-access"
import { buildStudentPracticeQuestionBankScopeSqlFragment } from "@/lib/student-practice-scope"
import {
  buildPracticePriorReview,
  listPracticedQuestionIds,
  loadLatestPracticeAnswersForQuestionIds,
  loadPracticedQuestionsForTopics,
  toSafePracticeQuestionPayload,
} from "@/lib/practice-prior-attempts"
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    console.log("[Practice Generate] Starting practice generation...")
    const { studentId, topics, count, difficulty, courseId: courseIdBody, fullTopic, interventionId } = await request.json()
    console.log("[Practice Generate] Request data:", { studentId, topics, count, difficulty, courseIdBody, fullTopic })

    const auth = await requireStudentPracticeCaller(
      request,
      studentId != null ? String(studentId) : null,
      null,
      courseIdBody != null ? String(courseIdBody) : null,
    )
    if (!auth.ok) return auth.response

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      console.log("[Practice Generate] Invalid request parameters:", { studentId, topics, count, difficulty })
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 })
    }

    const courseId = auth.ctx.courseId
    const practiceSession = auth.ctx.practiceSession
    const sessionVariants = auth.ctx.sessionVariants
    const studentDbId = auth.studentDbId
    const qbScope = await buildStudentPracticeQuestionBankScopeSqlFragment(
      "question_bank",
      "course_id",
      courseId,
      practiceSession,
    )
    const practicedQbScope = await buildStudentPracticeQuestionBankScopeSqlFragment(
      "qb",
      "course_id",
      courseId,
      practiceSession,
    )

    const membershipTier = await getEffectiveMembershipTier(studentDbId)
    const hubPolicy = await getPracticeHubPolicyForCourse(courseId)

    if (practiceAccessLevelForTier(membershipTier) === "none") {
      return NextResponse.json(
        {
          error: "Practice Hub requires Explorer or Trailblazer membership.",
          code: "PRACTICE_TIER_LOCKED",
          access: practiceAccessForStudentClient(membershipTier, hubPolicy),
        },
        { status: 403 },
      )
    }

    const dailyCap = practiceHubDailyCapForTier(membershipTier, hubPolicy)
    const weeklyCap = practiceHubWeeklyCapForTier(membershipTier, hubPolicy)

    let dailyUsed = 0
    if (dailyCap >= 0) {
      const usedToday = await sql`
        SELECT COALESCE(SUM(pa.total_questions), 0)::int AS used
        FROM practice_attempts pa
        WHERE pa.student_id = ${studentDbId}
          AND pa.started_at >= CURRENT_DATE
      `
      dailyUsed = Number(usedToday[0]?.used ?? 0)
      if (dailyUsed >= dailyCap) {
        return NextResponse.json(
          {
            error: `Daily practice limit reached (${dailyCap} questions). Upgrade membership or try again tomorrow.`,
            dailyCap,
            used: dailyUsed,
            membershipTier,
          },
          { status: 429 },
        )
      }
    }

    let weeklyUsed = 0
    if (weeklyCap >= 0) {
      const usedWeek = await sql`
        SELECT COALESCE(SUM(pa.total_questions), 0)::int AS used
        FROM practice_attempts pa
        WHERE pa.student_id = ${studentDbId}
          AND pa.started_at >= date_trunc('week', CURRENT_DATE)
      `
      weeklyUsed = Number(usedWeek[0]?.used ?? 0)
      if (weeklyUsed >= weeklyCap) {
        return NextResponse.json(
          {
            error: `Weekly practice limit reached (${weeklyCap} questions). Upgrade membership or try again next week.`,
            weeklyCap,
            used: weeklyUsed,
            membershipTier,
          },
          { status: 429 },
        )
      }
    }

    let questionCount = resolvePracticeSessionQuestionCount(membershipTier, hubPolicy, count)
    if (dailyCap >= 0) {
      const remaining = dailyCap - dailyUsed
      questionCount = Math.min(questionCount, remaining)
      if (questionCount <= 0) {
        return NextResponse.json(
          { error: "Daily practice limit reached.", dailyCap, used: dailyUsed, membershipTier },
          { status: 429 },
        )
      }
    }
    if (weeklyCap >= 0) {
      const remainingWeek = weeklyCap - weeklyUsed
      questionCount = Math.min(questionCount, remainingWeek)
      if (questionCount <= 0) {
        return NextResponse.json(
          { error: "Weekly practice limit reached.", weeklyCap, used: weeklyUsed, membershipTier },
          { status: 429 },
        )
      }
    }
    const studentResult = await sql`
      SELECT section FROM students WHERE id = ${studentDbId}
    `
    console.log("[Practice Generate] Student result:", studentResult)
    const session = studentResult[0]?.section ?? practiceSession
    const variants = sessionVariants.length > 0 ? sessionVariants : [session ?? practiceSession]

    // Daily limit removed - unlimited practice allowed

    // First, get all questions the student has already practiced
    console.log("[Practice Generate] Fetching practiced questions...")
    let practicedQuestionIds: number[] = []
    try {
      practicedQuestionIds = await listPracticedQuestionIds(studentDbId)
      console.log(`[Practice Generate] Student ${studentDbId} has already practiced ${practicedQuestionIds.length} questions:`, practicedQuestionIds)
    } catch (practicedError) {
      console.error("[Practice Generate] Error fetching practiced questions:", practicedError)
      return NextResponse.json({ error: "Failed to fetch practiced questions" }, { status: 500 })
    }

    const fetchQuestions = async (
      diffFilter: string | null,
      limit: number,
      excludeIds: number[] = [],
      includePracticed = false,
    ) => {
      if (limit <= 0) return []
      const exclude = Array.from(
        new Set(
          [...(includePracticed ? [] : practicedQuestionIds), ...excludeIds]
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id)),
        ),
      )
      const excludeList = exclude.length > 0 ? exclude : [-1]
      if (diffFilter) {
        return sql`
          SELECT id, question_text, question_type, hint, difficulty, topic, options, correct_answer,
            question_media, subquestions, solution_upload_config, explanation
          FROM question_bank
          WHERE topic = ANY(${topics})
            AND difficulty = ${diffFilter}
            AND (${qbScope})
            AND deleted_at IS NULL
            AND id <> ALL(${excludeList}::int[])
            AND NOT EXISTS (
              SELECT 1
              FROM practice_question_availability pqa
              WHERE pqa.question_id = question_bank.id
                AND pqa.is_available = false
                AND (
                  TRIM(pqa.session::text) = 'ALL'
                  OR TRIM(pqa.session::text) = TRIM(${session ?? practiceSession}::text)
                  OR TRIM(pqa.session::text) = ANY(${variants}::text[])
                )
            )
          ORDER BY RANDOM()
          LIMIT ${limit}
        `
      }
      return sql`
        SELECT id, question_text, question_type, hint, difficulty, topic, options, correct_answer,
          question_media, subquestions, solution_upload_config, explanation
        FROM question_bank
        WHERE topic = ANY(${topics})
          AND (${qbScope})
          AND deleted_at IS NULL
          AND id <> ALL(${excludeList}::int[])
          AND NOT EXISTS (
            SELECT 1
            FROM practice_question_availability pqa
            WHERE pqa.question_id = question_bank.id
              AND pqa.is_available = false
              AND (
                TRIM(pqa.session::text) = 'ALL'
                OR TRIM(pqa.session::text) = TRIM(${session ?? practiceSession}::text)
                OR TRIM(pqa.session::text) = ANY(${variants}::text[])
              )
          )
        ORDER BY RANDOM()
        LIMIT ${limit}
      `
    }

    const backfillQuestions = async (
      current: Array<Record<string, unknown>>,
      targetCount: number,
      diffFilter: string | null = null,
    ) => {
      let safety = 0
      while (current.length < targetCount && safety < 5) {
        safety += 1
        const before = current.length
        const excludeIds = current.map((q) => Number(q.id)).filter((id) => Number.isFinite(id))
        const needed = targetCount - current.length
        const extra = await fetchQuestions(diffFilter, needed, excludeIds)
        const seen = new Set(excludeIds)
        for (const row of extra) {
          const id = Number(row.id)
          if (!Number.isFinite(id) || seen.has(id)) continue
          current.push(row as Record<string, unknown>)
          seen.add(id)
          if (current.length >= targetCount) break
        }
        if (current.length === before) break
      }
      return current
    }

    const practicedExclude = practicedQuestionIds.length > 0 ? practicedQuestionIds : [-1]

    const countAvailableInTopics = async (
      diffFilter: string | null = null,
      includePracticed = false,
    ): Promise<number> => {
      const idExclude = includePracticed ? [-1] : practicedExclude
      if (diffFilter) {
        const rows = await sql`
          SELECT COUNT(*)::int AS total
          FROM question_bank
          WHERE topic = ANY(${topics})
            AND difficulty = ${diffFilter}
            AND (${qbScope})
            AND deleted_at IS NULL
            AND id <> ALL(${idExclude}::int[])
            AND NOT EXISTS (
              SELECT 1
              FROM practice_question_availability pqa
              WHERE pqa.question_id = question_bank.id
                AND pqa.is_available = false
                AND (
                  TRIM(pqa.session::text) = 'ALL'
                  OR TRIM(pqa.session::text) = TRIM(${session ?? practiceSession}::text)
                  OR TRIM(pqa.session::text) = ANY(${variants}::text[])
                )
            )
        `
        return Number(rows[0]?.total ?? 0)
      }
      const rows = await sql`
        SELECT COUNT(*)::int AS total
        FROM question_bank
        WHERE topic = ANY(${topics})
          AND (${qbScope})
          AND deleted_at IS NULL
          AND id <> ALL(${idExclude}::int[])
          AND NOT EXISTS (
            SELECT 1
            FROM practice_question_availability pqa
            WHERE pqa.question_id = question_bank.id
              AND pqa.is_available = false
              AND (
                TRIM(pqa.session::text) = 'ALL'
                OR TRIM(pqa.session::text) = TRIM(${session ?? practiceSession}::text)
                OR TRIM(pqa.session::text) = ANY(${variants}::text[])
              )
          )
      `
        return Number(rows[0]?.total ?? 0)
    }

    const isFullTopicTier = membershipTier === "Explorer" || membershipTier === "Trailblazer"
    const wantsFullTopic = fullTopic === true || isFullTopicTier
    const diffKey =
      difficulty && difficulty !== "mixed" ? String(difficulty).toLowerCase() : null

    let availableInTopics = await countAvailableInTopics(diffKey, wantsFullTopic)
    if (availableInTopics <= 0 && diffKey) {
      availableInTopics = await countAvailableInTopics(null, wantsFullTopic)
    }
    if (availableInTopics > 0) {
      questionCount = Math.min(questionCount, availableInTopics)
    }
    if (wantsFullTopic && availableInTopics > 0) {
      questionCount = availableInTopics
    }

    let questions
    try {
      if (wantsFullTopic) {
        questions = await fetchQuestions(diffKey, questionCount, [], true)
      } else if (!difficulty || difficulty === "mixed") {
        questions = await fetchQuestions(null, questionCount)
      } else {
        questions = await fetchQuestions(difficulty, questionCount)
        questions = await backfillQuestions(questions as Array<Record<string, unknown>>, questionCount)
      }
      console.log(`[Practice Generate] Found ${questions.length} of ${questionCount} requested for student ${studentDbId} in topics:`, topics)
      console.log(`[Practice Generate] Query result:`, questions)
    } catch (queryError) {
      console.error("[Practice Generate] Query error:", queryError)
      return NextResponse.json({ error: "Database query failed" }, { status: 500 })
    }

    if (questions.length === 0) {
      if (practicedQuestionIds.length === 0) {
        return NextResponse.json({ error: "No questions found for selected topics" }, { status: 404 })
      }
      const priorRows = await loadPracticedQuestionsForTopics({
        studentDbId,
        topics,
        qbScope: practicedQbScope,
      })
      const reviewQuestions = priorRows
        .map(({ question, studentAnswer, isCorrect }) => {
          const formatted = formatQuestionBankRowForRenderer(question)
          const answerReview = buildPracticePriorReview(question, studentAnswer, isCorrect)
          return toSafePracticeQuestionPayload(formatted as Record<string, unknown> | null, {
            locked: false,
            alreadyAttempted: true,
            priorAnswer: studentAnswer,
            priorIsCorrect: isCorrect,
            answerReview,
          })
        })
        .filter(Boolean)
      if (reviewQuestions.length === 0) {
        return NextResponse.json(
          { error: "You've already practiced all available questions in this topic." },
          { status: 404 },
        )
      }
      return NextResponse.json({
        attemptId: null,
        reviewOnly: true,
        access: practiceAccessForStudentClient(membershipTier, hubPolicy),
        unlockedCount: reviewQuestions.length,
        totalCount: reviewQuestions.length,
        questions: reviewQuestions,
      })
    }

    const questionIds = (questions as Array<{ id?: unknown }>)
      .map((q) => Number(q.id))
      .filter((id) => Number.isFinite(id) && id > 0)
    const priorRows = await loadLatestPracticeAnswersForQuestionIds(studentDbId, questionIds)
    const priorById = new Map(priorRows.map((row) => [row.questionId, row]))
    const unansweredCount = questionIds.filter((id) => !priorById.has(id)).length

    if (unansweredCount === 0 && priorRows.length > 0) {
      const reviewQuestions = priorRows
        .map(({ question, studentAnswer, isCorrect, answerReview }) => {
          const formatted = formatQuestionBankRowForRenderer(question)
          return toSafePracticeQuestionPayload(formatted as Record<string, unknown> | null, {
            locked: false,
            alreadyAttempted: true,
            priorAnswer: studentAnswer,
            priorIsCorrect: isCorrect,
            answerReview,
          })
        })
        .filter(Boolean)
      return NextResponse.json({
        attemptId: null,
        reviewOnly: true,
        access: practiceAccessForStudentClient(membershipTier, hubPolicy),
        unlockedCount: reviewQuestions.length,
        totalCount: reviewQuestions.length,
        questions: reviewQuestions,
      })
    }

    // Create practice attempt
    console.log("[Practice Generate] Creating practice attempt...")
    let attemptResult
    try {
      attemptResult = await sql`
        INSERT INTO practice_attempts (
          student_id,
          topics,
          difficulty,
          total_questions,
          correct_answers,
          started_at
        )
        VALUES (
          ${studentDbId},
          ${topics},
          ${difficulty || "mixed"},
          ${questions.length},
          0,
          NOW()
        )
        RETURNING id
      `
      console.log("[Practice Generate] Successfully created practice attempt:", attemptResult[0])
    } catch (attemptError) {
      console.error("[Practice Generate] Failed to create practice attempt:", attemptError)
      return NextResponse.json({ error: "Failed to create practice attempt" }, { status: 500 })
    }

    const attemptId = attemptResult[0].id

    void (async () => {
      try {
        const { recordPracticeAnalytics } = await import("@/lib/institutions/learning-analytics")
        await recordPracticeAnalytics({
          studentId: studentDbId,
          attemptId: Number(attemptId),
          event: "practice_started",
        })
        const ivId = Number(interventionId)
        if (Number.isFinite(ivId) && ivId > 0) {
          const { advanceStudentIntervention } = await import("@/lib/institutions/interventions")
          await advanceStudentIntervention({ studentId: studentDbId, interventionId: ivId, action: "engaged" })
        }
      } catch {
        /* non-blocking */
      }
    })()

    // No daily usage tracking - unlimited practice allowed

    return NextResponse.json({
      attemptId: attemptResult[0].id,
      access: practiceAccessForStudentClient(membershipTier, hubPolicy),
      unlockedCount: unlockedQuestionCountForTier(membershipTier, questions.length, hubPolicy),
      totalCount: questions.length,
      questions: applyPracticeQuestionLocks(
        questions as Array<Record<string, unknown> & { id: unknown }>,
        membershipTier,
        hubPolicy,
      )
        .map((q) => {
          const formatted = formatQuestionBankRowForRenderer(q)
          const prior = priorById.get(Number(q.id))
          return toSafePracticeQuestionPayload(formatted as Record<string, unknown> | null, {
            locked: q.locked,
            alreadyAttempted: Boolean(prior),
            priorAnswer: prior?.studentAnswer ?? null,
            priorIsCorrect: prior?.isCorrect ?? null,
            answerReview: prior?.answerReview ?? null,
          })
        })
        .filter(Boolean),
    })
  } catch (error) {
    console.error("[v0] Error generating practice:", error)
    return NextResponse.json({ error: "Failed to generate practice quiz" }, { status: 500 })
  }
}
