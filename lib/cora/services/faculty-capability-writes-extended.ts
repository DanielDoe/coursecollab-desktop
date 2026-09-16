import { sql } from "@/lib/db"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"
import { createCourseAnnouncement, runAnnouncementCreateSideEffects } from "@/lib/cora/services/create-announcement"
import { updateSyllabusSection } from "@/lib/cora/services/update-syllabus-section"
import { createLectureShell } from "@/lib/cora/services/create-lecture-shell"
import { replaceLectureSessionAccessFromRecord } from "@/lib/lecture-session-access-sync"
import { createInstructorNotification } from "@/lib/create-instructor-notification"
import { ensureCourseDigitalNotesSchema, fetchCourseDigitalNoteById } from "@/lib/course-digital-notes"
import {
  ensureFlashcardSchema,
  fetchFlashcardDeckById,
  refreshFlashcardDeckCount,
} from "@/lib/flashcards"
import { bulkCreateQuestionBankQuestions } from "@/lib/cora/services/bulk-create-questions"
import { questionMediaToJsonString } from "@/lib/question-media"
import { propagateBankQuestionMediaToQuizQuestions } from "@/lib/question-media-persist"
import { solutionUploadConfigToJsonString } from "@/lib/solution-upload"
import { normalizeQuestionBankRowForStorage } from "@/lib/question-type-schema"
import { createAssessmentFromBank } from "@/lib/cora/services/create-assessment-from-bank"
import { getAssessmentPolicyForCourse } from "@/lib/assessment-policy-settings.server"
import { parseClientAvailabilityToUtcIso, utcIsoToDbTimestamp } from "@/lib/timezone"
import { publishCourseAssessment } from "@/lib/cora/services/publish-assessment"
import { normalizeAllowedStudentIds } from "@/lib/normalize-allowed-student-ids"
import { normalizeQuizAllowedLanguagesFromClient } from "@/lib/ai-code-languages"
import { syncQuizQuestionsOnUpdate } from "@/lib/sync-quiz-questions-on-update"
import {
  approveClassroomPoint,
  createClassroomPointsAssignment,
  awardClassroomPoints,
} from "@/lib/cora/services/classroom-points-actions"
import { sendInstructorDirectMessage } from "@/lib/cora/services/send-instructor-message"
import {
  coraCreateExchangeRequest,
  coraDecideExchangeRequest,
  coraExecuteExchangeCopy,
  coraUpdateSharingMode,
} from "@/lib/cora/services/course-exchange-services"
import {
  ensureCoursePoliciesRow,
  updateCourseAssessmentPolicyDefaults,
  updateCoursePlaygroundPolicy,
  updateCoursePracticeHubPolicy,
  updateCourseProjectPolicy,
  updateCourseRewardsPolicy,
} from "@/lib/cora/services/update-course-policies"
import { mergeCourseModuleSettings } from "@/lib/course-module-settings"
import {
  ensureAssessmentGovernanceColumns,
  parseAssessmentPrivilegeSource,
} from "@/lib/assessment-privilege-governance"
import { ensureTradeCenterConfigSchema } from "@/lib/ensure-trade-center-config-schema"
import {
  DEFAULT_TRADE_CENTER_CONFIG,
  parseTradeCenterConfigRow,
  validateTradeCenterConfigInput,
} from "@/lib/trade-center-shared"
import { logTradeCenterRulesChange } from "@/lib/course-assessment-audit"
import { logSupportTicketToSystemLog } from "@/lib/system-log-support-ticket"
import { ensurePortalRbacSchema } from "@/lib/ensure-portal-rbac-schema"
import {
  permissionPatchForNavModuleLevel,
  type TaModuleGrantLevel,
  type TaNavModuleId,
} from "@/lib/ta-nav-access"
import { syncTaLegacyPermissionsToStaff } from "@/lib/course-staff-sync"
import { ensureTaPermissionColumns } from "@/lib/ensure-ta-permissions-columns"
import { setActiveAcademicTerm } from "@/lib/active-academic-term"
import { notifyRecommendationStudent } from "@/lib/recommendation-student-email"
import { logRecommendationAudit } from "@/lib/recommendation-letters"
import {
  CENTRAL_TIMEZONE,
} from "@/lib/timezone"
import { toZonedTime } from "date-fns-tz"
import {
  attendancePointsForStatus,
  isAttendanceStatus,
  type AttendanceStatus,
} from "@/lib/attendance-status"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { syncGradebookForAttendanceMark } from "@/lib/grades"
import type { ConfirmCoraActionResult } from "@/lib/cora/confirmations/confirm-action"

type FacultyCapabilityHandlerContextLike = {
  instructorId: number
  courseId: number
  courseCode?: string | null
  args: Record<string, unknown>
  capabilityId: string
}

type FacultyHandlerResultLike = Omit<ConfirmCoraActionResult, "tool">

function successResult(
  message: string,
  entity: { type: string; id: number | string; title?: string; route?: string },
  extra?: Partial<FacultyHandlerResultLike>,
): FacultyHandlerResultLike {
  return { success: true, message, entity, ...extra }
}

function invalidResult(message: string): FacultyHandlerResultLike {
  return { success: false, message, error: "invalid" }
}

function scopeResult(): FacultyHandlerResultLike {
  return { success: false, message: "You do not have access to this course.", error: "scope" }
}

async function withCourseAccess(
  ctx: FacultyCapabilityHandlerContextLike,
  run: () => Promise<FacultyHandlerResultLike>,
): Promise<FacultyHandlerResultLike> {
  const allowed = await instructorCanAccessCourse(ctx.instructorId, ctx.courseId)
  if (!allowed) return scopeResult()
  return run()
}

function asString(value: unknown, fallback = ""): string {
  return String(value ?? fallback)
}

function trimOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim()
  return text ? text : null
}

function positiveInt(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null
}

function numberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0)
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item)).map((item) => item.trim()).filter(Boolean)
}

function normalizeSession(value: unknown): string | null {
  const raw = String(value ?? "").trim()
  return raw && raw.toUpperCase() !== "ALL" ? raw : null
}

async function fetchCourseCode(courseId: number, fallback?: string | null): Promise<string | null> {
  const existing = String(fallback ?? "").trim()
  if (existing) return existing
  const rows = (await sql`
    SELECT course_code FROM courses WHERE id = ${courseId} LIMIT 1
  `) as { course_code: string | null }[]
  return trimOrNull(rows[0]?.course_code)
}

async function fetchOwnedAnnouncement(
  courseId: number,
  announcementId: number,
): Promise<{ id: number; title: string; course_id: number | null } | null> {
  const rows = (await sql`
    SELECT id, title, course_id
    FROM announcements
    WHERE id = ${announcementId}
      AND course_id = ${courseId}
    LIMIT 1
  `) as { id: number; title: string; course_id: number | null }[]
  return rows[0] ?? null
}

async function fetchOwnedGroup(
  courseId: number,
  instructorId: number,
  groupId: number,
): Promise<{ id: number; name: string } | null> {
  const rows = (await sql`
    SELECT id, name
    FROM groups
    WHERE id = ${groupId}
      AND instructor_id = ${instructorId}
      AND (course_id = ${courseId} OR course_id IS NULL)
    LIMIT 1
  `) as { id: number; name: string }[]
  return rows[0] ?? null
}

async function fetchOwnedProject(
  courseId: number,
  projectId: number,
): Promise<{ id: number; title: string } | null> {
  const rows = (await sql`
    SELECT id, title
    FROM projects
    WHERE id = ${projectId}
      AND (course_id = ${courseId} OR course_id IS NULL)
    LIMIT 1
  `) as { id: number; title: string }[]
  return rows[0] ?? null
}

async function fetchOwnedQuiz(
  courseId: number,
  quizId: number,
): Promise<{ id: number; title: string; assessment_type: string | null } | null> {
  const rows = (await sql`
    SELECT id, title, assessment_type
    FROM quizzes
    WHERE id = ${quizId}
      AND course_id = ${courseId}
      AND deleted_at IS NULL
    LIMIT 1
  `) as { id: number; title: string; assessment_type: string | null }[]
  return rows[0] ?? null
}

async function upsertAttendanceStreak(
  studentId: number,
  studentName: string,
  section: string,
  status: AttendanceStatus,
  points: number,
): Promise<void> {
  if (status !== "present" && status !== "late") return

  const todayCT = toZonedTime(new Date(), CENTRAL_TIMEZONE)
  const today = todayCT.toISOString().split("T")[0]
  const streakRows = (await sql`
    SELECT * FROM attendance_streaks WHERE student_id = ${studentId}
  `) as Array<{
    current_streak: number
    longest_streak: number
    last_attendance_date: string | null
  }>

  if (streakRows.length === 0) {
    await sql`
      INSERT INTO attendance_streaks (
        student_id, student_name, section, current_streak, longest_streak, total_points, last_attendance_date
      ) VALUES (
        ${studentId}, ${studentName}, ${section}, 1, 1, ${points}, ${today}
      )
    `
    return
  }

  const streak = streakRows[0] as {
    current_streak: number
    longest_streak: number
    last_attendance_date: string | null
  }
  const yesterdayCT = toZonedTime(new Date(), CENTRAL_TIMEZONE)
  yesterdayCT.setDate(yesterdayCT.getDate() - 1)
  const yesterday = yesterdayCT.toISOString().split("T")[0]

  let nextStreak = 1
  if (streak.last_attendance_date === yesterday) nextStreak = Number(streak.current_streak) + 1
  else if (streak.last_attendance_date === today) nextStreak = Number(streak.current_streak)

  const longest = Math.max(nextStreak, Number(streak.longest_streak) || 0)
  const bonus = nextStreak % 5 === 0 ? 5 : 0

  await sql`
    UPDATE attendance_streaks
    SET current_streak = ${nextStreak},
        longest_streak = ${longest},
        total_points = total_points + ${points + bonus},
        last_attendance_date = ${today}
    WHERE student_id = ${studentId}
  `
}

function sectionMatches(studentSection: string, sessionSection: string): boolean {
  const variants = new Set(normalizedSectionVariantsForSql(sessionSection))
  return normalizedSectionVariantsForSql(studentSection).some((variant) => variants.has(variant))
}

async function correctInstructorAttendanceRecord(input: {
  instructorId: number
  courseId: number
  sessionId: number
  studentId: number
  status: string
  studentName?: string | null
  studentNumber?: string | null
}): Promise<{ sessionId: number; studentId: number; status: AttendanceStatus; href: string }> {
  const allowed = await instructorCanAccessCourse(input.instructorId, input.courseId)
  if (!allowed) throw new Error("Instructor cannot correct attendance for this course.")

  const rawStatus = String(input.status ?? "").trim().toLowerCase()
  const status: AttendanceStatus = isAttendanceStatus(rawStatus) ? rawStatus : "present"
  const sessionRows = (await sql`
    SELECT id, section, is_cancelled
    FROM attendance_sessions
    WHERE id = ${input.sessionId}
      AND course_id = ${input.courseId}
    LIMIT 1
  `) as { id: number; section: string | null; is_cancelled: boolean }[]
  const session = sessionRows[0]
  if (!session) throw new Error("Attendance session not found in this course.")
  if (session.is_cancelled) throw new Error("This class was cancelled and cannot be marked.")

  const studentRows = (await sql`
    SELECT s.id, s.full_name, s.student_id, TRIM(COALESCE(sess.code, s.section::text, '')) AS section
    FROM students s
    LEFT JOIN sessions sess ON s.session_id = sess.id
    WHERE s.id = ${input.studentId}
      AND (s.course_id = ${input.courseId} OR sess.course_id = ${input.courseId})
    LIMIT 1
  `) as { id: number; full_name: string | null; student_id: string | null; section: string | null }[]
  const student = studentRows[0]
  if (!student) throw new Error("Student not found in this course.")

  const studentSection = String(student.section ?? "")
  if (!sectionMatches(studentSection, String(session.section ?? ""))) {
    throw new Error("Student is not enrolled in this section.")
  }

  const points = attendancePointsForStatus(status)
  const recordSection = studentSection || String(session.section ?? "")
  const studentName = String(input.studentName ?? student.full_name ?? `Student ${input.studentId}`)
  const studentNumber = String(input.studentNumber ?? student.student_id ?? "")
  const nowIso = new Date().toISOString()

  const existing = (await sql`
    SELECT id FROM attendance_records
    WHERE student_id = ${input.studentId}
      AND session_id = ${input.sessionId}
    LIMIT 1
  `) as { id: number }[]

  if (existing.length > 0) {
    await sql`
      UPDATE attendance_records
      SET status = ${status},
          points_earned = ${points},
          timestamp = ${nowIso}::timestamp,
          check_in_method = 'manual',
          student_name = ${studentName},
          student_number = ${studentNumber},
          section = ${recordSection}
      WHERE id = ${existing[0].id}
    `
  } else {
    await sql`
      INSERT INTO attendance_records (
        student_id, session_id, student_name, student_number, section,
        status, points_earned, timestamp, check_in_method
      ) VALUES (
        ${input.studentId}, ${input.sessionId}, ${studentName}, ${studentNumber}, ${recordSection},
        ${status}, ${points}, ${nowIso}::timestamp, 'manual'
      )
    `
    await upsertAttendanceStreak(input.studentId, studentName, recordSection, status, points)
  }

  await syncGradebookForAttendanceMark(Number(input.studentId), recordSection)
  return { sessionId: input.sessionId, studentId: input.studentId, status, href: "/module/attendance" }
}

async function createTradeCenterConfigWrite(ctx: FacultyCapabilityHandlerContextLike, title: string) {
  const patch = objectValue(ctx.args.config ?? ctx.args.patch ?? ctx.args.rules)
  const session = normalizeSession(ctx.args.session) ?? "ALL"
  const validated = validateTradeCenterConfigInput({
    ...DEFAULT_TRADE_CENTER_CONFIG,
    ...patch,
    session,
  })
  if (!validated.ok) return invalidResult(validated.error)

  await ensureTradeCenterConfigSchema()
  const existing = (await sql`
    SELECT * FROM trade_center_config WHERE session = ${validated.config.session} LIMIT 1
  `) as Record<string, unknown>[]
  const oldConfig = existing[0] as Record<string, unknown> | undefined
  const merged = oldConfig
    ? { ...parseTradeCenterConfigRow(oldConfig), ...validated.config }
    : validated.config

  await sql`
    INSERT INTO trade_center_config (
      session,
      practice_weight, playground_weight, reading_weight,
      weekly_practice_cap, weekly_playground_cap, weekly_reading_cap,
      ec_conversion_multiplier, max_engagement_credits,
      trading_enabled, donations_enabled, min_donation_points, weekly_reset_day,
      is_active, practice_enabled, playground_enabled, reading_enabled
    )
    VALUES (
      ${merged.session},
      ${merged.practice_weight}, ${merged.playground_weight}, ${merged.reading_weight},
      ${merged.weekly_practice_cap}, ${merged.weekly_playground_cap}, ${merged.weekly_reading_cap},
      ${merged.ec_conversion_multiplier}, ${merged.max_engagement_credits},
      ${merged.trading_enabled}, ${merged.donations_enabled}, ${merged.min_donation_points}, ${merged.weekly_reset_day},
      ${merged.is_active}, ${merged.practice_enabled}, ${merged.playground_enabled}, ${merged.reading_enabled}
    )
    ON CONFLICT (session)
    DO UPDATE SET
      practice_weight = EXCLUDED.practice_weight,
      playground_weight = EXCLUDED.playground_weight,
      reading_weight = EXCLUDED.reading_weight,
      weekly_practice_cap = EXCLUDED.weekly_practice_cap,
      weekly_playground_cap = EXCLUDED.weekly_playground_cap,
      weekly_reading_cap = EXCLUDED.weekly_reading_cap,
      ec_conversion_multiplier = EXCLUDED.ec_conversion_multiplier,
      max_engagement_credits = EXCLUDED.max_engagement_credits,
      trading_enabled = EXCLUDED.trading_enabled,
      donations_enabled = EXCLUDED.donations_enabled,
      min_donation_points = EXCLUDED.min_donation_points,
      weekly_reset_day = EXCLUDED.weekly_reset_day,
      is_active = EXCLUDED.is_active,
      practice_enabled = EXCLUDED.practice_enabled,
      playground_enabled = EXCLUDED.playground_enabled,
      reading_enabled = EXCLUDED.reading_enabled,
      updated_at = CURRENT_TIMESTAMP
  `

  await logTradeCenterRulesChange({
    actorId: ctx.instructorId,
    courseId: ctx.courseId,
    session: merged.session,
    oldValue: oldConfig ?? null,
    newValue: merged,
  })

  return successResult(title, {
    type: "trade_rules",
    id: merged.session,
    title: `Trade Center ${merged.session}`,
    route: "/module/trade-center",
  })
}

async function createSupportStyleRecord(ctx: FacultyCapabilityHandlerContextLike, options: {
  subject: string
  description: string
  category: string
  priority?: string
  moduleId?: string | null
  moduleName?: string | null
  href: string
  entityType: string
  successMessage: string
}) {
  const actorRows = (await sql`
    SELECT name, username
    FROM instructors
    WHERE id = ${ctx.instructorId}
    LIMIT 1
  `) as { name: string | null; username: string | null }[]
  const courseRows = (await sql`
    SELECT course_title, course_code
    FROM courses
    WHERE id = ${ctx.courseId}
    LIMIT 1
  `) as { course_title: string | null; course_code: string | null }[]
  const actor = actorRows[0] ?? { name: null, username: null }
  const course = courseRows[0] ?? { course_title: null, course_code: null }
  const logged = await logSupportTicketToSystemLog({
    studentDbId: null,
    subject: options.subject,
    description: options.description,
    category: options.category,
    priority: options.priority ?? "medium",
    audience: "instructor",
    instructorId: ctx.instructorId,
    instructorName: actor.name ?? actor.username,
    courseId: ctx.courseId,
    courseName: course.course_title ?? course.course_code,
    moduleId: options.moduleId ?? null,
    moduleName: options.moduleName ?? null,
  })
  return successResult(options.successMessage, {
    type: options.entityType,
    id: logged.ticketId,
    title: options.subject,
    route: options.href,
  })
}

export const EXTENDED_FACULTY_CAPABILITY_HANDLERS: Record<
  string,
  (ctx: FacultyCapabilityHandlerContextLike) => Promise<FacultyHandlerResultLike>
> = {
  "announcement.create": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const title = asString(ctx.args.title).trim()
      const content = asString(ctx.args.content ?? ctx.args.body).trim()
      if (!title || !content) return invalidResult("Announcement title and content are required.")
      const created = await createCourseAnnouncement({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        title,
        content,
        pinned: ctx.args.pinned === true,
        allowComments: ctx.args.allowComments !== false && ctx.args.allow_comments !== false,
        allowReactions: ctx.args.allowReactions !== false && ctx.args.allow_reactions !== false,
        attachments: ctx.args.attachments,
        studentContentLocked:
          ctx.args.studentContentLocked === true || ctx.args.student_content_locked === true,
        type: trimOrNull(ctx.args.type) ?? "info",
        priority: trimOrNull(ctx.args.priority) ?? undefined,
        targetSession: trimOrNull(ctx.args.targetSession ?? ctx.args.target_session) ?? undefined,
        expiresAt: trimOrNull(ctx.args.expiresAt ?? ctx.args.expires_at),
      })
      const announcementId = Number(created.announcement.id)
      return successResult(`Created announcement "${title}".`, {
        type: "announcement",
        id: announcementId,
        title,
        route: "/module/announcements",
      })
    }),

  "announcement.publish": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const announcementId = positiveInt(ctx.args.announcementId ?? ctx.args.id)
      if (announcementId) {
        const existing = await fetchOwnedAnnouncement(ctx.courseId, announcementId)
        if (!existing) return invalidResult("Announcement not found in this course.")
        await sql`
          UPDATE announcements
          SET is_active = true,
              updated_at = NOW()
          WHERE id = ${announcementId}
        `
        return successResult(`Published announcement "${existing.title}".`, {
          type: "announcement",
          id: announcementId,
          title: existing.title,
          route: "/module/announcements",
        })
      }
      const title = asString(ctx.args.title).trim()
      const content = asString(ctx.args.content ?? ctx.args.body).trim()
      if (!title || !content) return invalidResult("Announcement title and content are required.")
      const created = await createCourseAnnouncement({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        title,
        content,
        pinned: ctx.args.pinned === true,
      })
      const notifiedCount = await runAnnouncementCreateSideEffects({
        announcement: created.announcement,
        title,
        content,
        lockedForStudents:
          ctx.args.studentContentLocked === true || ctx.args.student_content_locked === true,
        courseId: ctx.courseId,
      })
      return successResult(
        `Announcement published${notifiedCount ? ` · ${notifiedCount} students notified` : ""}.`,
        {
          type: "announcement",
          id: Number(created.announcement.id),
          title,
          route: "/module/announcements",
        },
      )
    }),

  "announcement.update": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const announcementId = positiveInt(ctx.args.announcementId ?? ctx.args.id)
      if (!announcementId) return invalidResult("announcementId is required.")
      const existing = await fetchOwnedAnnouncement(ctx.courseId, announcementId)
      if (!existing) return invalidResult("Announcement not found in this course.")
      const values = {
        title: trimOrNull(ctx.args.title),
        content: trimOrNull(ctx.args.content),
        pinned:
          ctx.args.pinned === true ? true : ctx.args.pinned === false ? false : null,
        allowComments:
          ctx.args.allowComments === true
            ? true
            : ctx.args.allowComments === false
              ? false
              : null,
        allowReactions:
          ctx.args.allowReactions === true
            ? true
            : ctx.args.allowReactions === false
              ? false
              : null,
        type: trimOrNull(ctx.args.type),
        priority: trimOrNull(ctx.args.priority),
        targetSession: trimOrNull(ctx.args.targetSession ?? ctx.args.target_session),
        expiresAt:
          ctx.args.expiresAt !== undefined || ctx.args.expires_at !== undefined
            ? trimOrNull(ctx.args.expiresAt ?? ctx.args.expires_at)
            : undefined,
      }
      await sql`
        UPDATE announcements
        SET title = COALESCE(${values.title}, title),
            content = COALESCE(${values.content}, content),
            pinned = COALESCE(${values.pinned}, pinned),
            allow_comments = COALESCE(${values.allowComments}, allow_comments),
            allow_reactions = COALESCE(${values.allowReactions}, allow_reactions),
            type = COALESCE(${values.type}, type),
            priority = COALESCE(${values.priority}, priority),
            target_session = COALESCE(${values.targetSession}, target_session),
            expires_at = ${
              values.expiresAt === undefined ? sql`expires_at` : values.expiresAt
            },
            updated_at = NOW()
        WHERE id = ${announcementId}
      `
      return successResult(`Updated announcement "${existing.title}".`, {
        type: "announcement",
        id: announcementId,
        title: existing.title,
        route: "/module/announcements",
      })
    }),

  "announcement.delete": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const announcementId = positiveInt(ctx.args.announcementId ?? ctx.args.id)
      if (!announcementId) return invalidResult("announcementId is required.")
      const existing = await fetchOwnedAnnouncement(ctx.courseId, announcementId)
      if (!existing) return invalidResult("Announcement not found in this course.")
      await sql`DELETE FROM announcement_reads WHERE announcement_id = ${announcementId}`
      await sql`DELETE FROM announcements WHERE id = ${announcementId}`
      return successResult(`Deleted announcement "${existing.title}".`, {
        type: "announcement",
        id: announcementId,
        title: existing.title,
        route: "/module/announcements",
      })
    }),

  "announcement.archive": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const announcementId = positiveInt(ctx.args.announcementId ?? ctx.args.id)
      if (!announcementId) return invalidResult("announcementId is required.")
      const existing = await fetchOwnedAnnouncement(ctx.courseId, announcementId)
      if (!existing) return invalidResult("Announcement not found in this course.")
      await sql`
        UPDATE announcements
        SET is_active = false, updated_at = NOW()
        WHERE id = ${announcementId}
      `
      return successResult(`Archived announcement "${existing.title}".`, {
        type: "announcement",
        id: announcementId,
        title: existing.title,
        route: "/module/announcements",
      })
    }),

  "announcement.schedule": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const title = asString(ctx.args.title).trim()
      const content = asString(ctx.args.content ?? ctx.args.body).trim()
      if (!title || !content) return invalidResult("Announcement title and content are required.")
      const created = await createCourseAnnouncement({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        title,
        content,
        pinned: ctx.args.pinned === true,
        priority: trimOrNull(ctx.args.priority) ?? undefined,
        targetSession: trimOrNull(ctx.args.targetSession ?? ctx.args.target_session) ?? undefined,
        expiresAt: trimOrNull(ctx.args.expiresAt ?? ctx.args.expires_at),
      })
      await sql`
        UPDATE announcements
        SET is_active = false, updated_at = NOW()
        WHERE id = ${Number(created.announcement.id)}
      `
      return successResult(`Scheduled announcement "${title}".`, {
        type: "announcement",
        id: Number(created.announcement.id),
        title,
        route: "/module/announcements",
      })
    }),

  "syllabus.draft": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const sectionTitle = asString(ctx.args.sectionTitle ?? ctx.args.section_title).trim()
      const markdown = asString(ctx.args.markdown ?? ctx.args.content).trim()
      if (!sectionTitle || !markdown) {
        return invalidResult("sectionTitle and markdown are required.")
      }
      const updated = await updateSyllabusSection({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        sectionTitle,
        markdown,
        sectionType: (ctx.args.sectionType as never) ?? (ctx.args.section_type as never),
        publish: false,
      })
      return successResult(`Saved syllabus section "${sectionTitle}" as draft.`, {
        type: "syllabus",
        id: updated.syllabus.id,
        title: sectionTitle,
        route: "/module/syllabus",
      })
    }),

  "syllabus.update": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const sectionTitle = asString(ctx.args.sectionTitle ?? ctx.args.section_title).trim()
      const markdown = asString(ctx.args.markdown ?? ctx.args.content).trim()
      if (!sectionTitle || !markdown) {
        return invalidResult("sectionTitle and markdown are required.")
      }
      const updated = await updateSyllabusSection({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        sectionTitle,
        markdown,
        sectionType: (ctx.args.sectionType as never) ?? (ctx.args.section_type as never),
        publish: false,
      })
      return successResult(`Updated syllabus section "${sectionTitle}".`, {
        type: "syllabus",
        id: updated.syllabus.id,
        title: sectionTitle,
        route: "/module/syllabus",
      })
    }),

  "syllabus.publish": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const sectionTitle = asString(ctx.args.sectionTitle ?? ctx.args.section_title).trim()
      const markdown = asString(ctx.args.markdown ?? ctx.args.content).trim()
      if (!sectionTitle || !markdown) {
        return invalidResult("sectionTitle and markdown are required.")
      }
      const updated = await updateSyllabusSection({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        sectionTitle,
        markdown,
        sectionType: (ctx.args.sectionType as never) ?? (ctx.args.section_type as never),
        publish: true,
      })
      return successResult(`Published syllabus section "${sectionTitle}".`, {
        type: "syllabus",
        id: updated.syllabus.id,
        title: sectionTitle,
        route: "/module/syllabus",
      })
    }),

  "lecture.create": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const title = asString(ctx.args.title).trim()
      const week = Number(ctx.args.week ?? 1)
      if (!title || !Number.isFinite(week)) return invalidResult("title and week are required.")
      const created = await createLectureShell({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        title,
        week,
        description: trimOrNull(ctx.args.description),
        objectives: stringArray(ctx.args.objectives),
        publish: ctx.args.publish === true,
      })
      return successResult(`Created lecture "${created.title}".`, {
        type: "lecture",
        id: created.lectureId,
        title: created.title,
        route: "/module/lectures",
      })
    }),

  "lecture.update": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const lectureId = positiveInt(ctx.args.lectureId ?? ctx.args.id)
      if (!lectureId) return invalidResult("lectureId is required.")
      const existing = (await sql`
        SELECT id, title
        FROM lectures
        WHERE id = ${lectureId} AND course_id = ${ctx.courseId} AND deleted_at IS NULL
        LIMIT 1
      `) as { id: number; title: string }[]
      if (existing.length === 0) return invalidResult("Lecture not found in this course.")
      const title = trimOrNull(ctx.args.title)
      const description = trimOrNull(ctx.args.description)
      const week = ctx.args.week != null ? Number(ctx.args.week) : null
      const objectives = Array.isArray(ctx.args.objectives)
        ? JSON.stringify(stringArray(ctx.args.objectives))
        : null
      const materialsUrl = trimOrNull(ctx.args.materialsUrl ?? ctx.args.materials_url)
      const publish =
        ctx.args.publish === true ? true : ctx.args.publish === false ? false : null
      const sessionAccess = Array.isArray(ctx.args.sessionAccess ?? ctx.args.session_access)
        ? stringArray(ctx.args.sessionAccess ?? ctx.args.session_access)
        : null
      await sql`
        UPDATE lectures
        SET title = COALESCE(${title}, title),
            description = COALESCE(${description}, description),
            week = COALESCE(${week}, week),
            learning_objectives = COALESCE(${objectives}::jsonb, learning_objectives),
            materials_url = COALESCE(${materialsUrl}, materials_url),
            is_published = COALESCE(${publish}, is_published),
            session_access = ${
              sessionAccess == null ? sql`session_access` : sessionAccess.length ? sessionAccess : null
            },
            updated_at = NOW()
        WHERE id = ${lectureId}
      `
      await replaceLectureSessionAccessFromRecord(
        sql,
        lectureId,
        sessionAccess == null ? undefined : sessionAccess,
      )
      return successResult(`Updated lecture "${title ?? existing[0].title}".`, {
        type: "lecture",
        id: lectureId,
        title: title ?? existing[0].title,
        route: "/module/lectures",
      })
    }),

  "lecture.publish": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const lectureId = positiveInt(ctx.args.lectureId ?? ctx.args.id)
      if (!lectureId) return invalidResult("lectureId is required.")
      const existing = (await sql`
        SELECT id, title
        FROM lectures
        WHERE id = ${lectureId} AND course_id = ${ctx.courseId} AND deleted_at IS NULL
        LIMIT 1
      `) as { id: number; title: string }[]
      if (existing.length === 0) return invalidResult("Lecture not found in this course.")
      await sql`
        UPDATE lectures
        SET is_published = true, updated_at = NOW()
        WHERE id = ${lectureId}
      `
      return successResult(`Published lecture "${existing[0].title}".`, {
        type: "lecture",
        id: lectureId,
        title: existing[0].title,
        route: "/module/lectures",
      })
    }),

  "lecture.attach": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const lectureId = positiveInt(ctx.args.lectureId ?? ctx.args.id)
      const materialsUrl = trimOrNull(ctx.args.materialsUrl ?? ctx.args.materials_url)
      if (!lectureId || !materialsUrl) {
        return invalidResult("lectureId and materialsUrl are required.")
      }
      const existing = (await sql`
        SELECT id, title
        FROM lectures
        WHERE id = ${lectureId} AND course_id = ${ctx.courseId} AND deleted_at IS NULL
        LIMIT 1
      `) as { id: number; title: string }[]
      if (existing.length === 0) return invalidResult("Lecture not found in this course.")
      await sql`
        UPDATE lectures
        SET materials_url = ${materialsUrl},
            updated_at = NOW()
        WHERE id = ${lectureId}
      `
      return successResult(`Attached materials to lecture "${existing[0].title}".`, {
        type: "lecture",
        id: lectureId,
        title: existing[0].title,
        route: "/module/lectures",
      })
    }),

  "courseNote.update": async (ctx) =>
    withCourseAccess(ctx, async () => {
      await ensureCourseDigitalNotesSchema()
      const noteId = positiveInt(ctx.args.noteId ?? ctx.args.id)
      if (!noteId) return invalidResult("noteId is required.")
      const note = await fetchCourseDigitalNoteById(noteId, { includeDeleted: true })
      if (!note || Number(note.course_id) !== ctx.courseId) {
        return invalidResult("Course note not found in this course.")
      }
      const title = ctx.args.title != null ? asString(ctx.args.title).trim() || "Untitled note" : note.title
      const bodyText = ctx.args.bodyText != null ? asString(ctx.args.bodyText) : note.body_text
      const inkWorkspace =
        ctx.args.inkWorkspace === null
          ? null
          : ctx.args.inkWorkspace != null
            ? JSON.stringify(ctx.args.inkWorkspace)
            : note.ink_workspace != null
              ? JSON.stringify(note.ink_workspace)
              : null
      const topic =
        ctx.args.topic !== undefined ? trimOrNull(ctx.args.topic) : note.topic
      const session =
        ctx.args.session !== undefined ? normalizeSession(ctx.args.session) : note.session
      const isPublished =
        ctx.args.isPublished !== undefined ? Boolean(ctx.args.isPublished) : note.is_published
      await sql`
        UPDATE course_digital_notes
        SET title = ${title},
            body_text = ${bodyText},
            ink_workspace = ${inkWorkspace}::jsonb,
            topic = ${topic},
            session = ${session},
            is_published = ${isPublished},
            updated_at = NOW()
        WHERE id = ${noteId}
      `
      return successResult(`Updated course note "${title}".`, {
        type: "note",
        id: noteId,
        title,
        route: "/module/course-notes",
      })
    }),

  "courseNote.publish": async (ctx) =>
    withCourseAccess(ctx, async () => {
      await ensureCourseDigitalNotesSchema()
      const noteId = positiveInt(ctx.args.noteId ?? ctx.args.id)
      if (!noteId) return invalidResult("noteId is required.")
      const note = await fetchCourseDigitalNoteById(noteId, { includeDeleted: true })
      if (!note || Number(note.course_id) !== ctx.courseId) {
        return invalidResult("Course note not found in this course.")
      }
      await sql`
        UPDATE course_digital_notes
        SET is_published = true, updated_at = NOW()
        WHERE id = ${noteId}
      `
      return successResult(`Published course note "${note.title}".`, {
        type: "note",
        id: noteId,
        title: note.title,
        route: "/module/course-notes",
      })
    }),

  "courseNote.restore": async (ctx) =>
    withCourseAccess(ctx, async () => {
      await ensureCourseDigitalNotesSchema()
      const noteId = positiveInt(ctx.args.noteId ?? ctx.args.id)
      if (!noteId) return invalidResult("noteId is required.")
      const note = await fetchCourseDigitalNoteById(noteId, { includeDeleted: true })
      if (!note || Number(note.course_id) !== ctx.courseId) {
        return invalidResult("Course note not found in this course.")
      }
      await sql`
        UPDATE course_digital_notes
        SET deleted_at = NULL, updated_at = NOW()
        WHERE id = ${noteId}
      `
      return successResult(`Restored course note "${note.title}".`, {
        type: "note",
        id: noteId,
        title: note.title,
        route: "/module/course-notes",
      })
    }),

  "courseNote.softDelete": async (ctx) =>
    withCourseAccess(ctx, async () => {
      await ensureCourseDigitalNotesSchema()
      const noteId = positiveInt(ctx.args.noteId ?? ctx.args.id)
      if (!noteId) return invalidResult("noteId is required.")
      const note = await fetchCourseDigitalNoteById(noteId, { includeDeleted: true })
      if (!note || Number(note.course_id) !== ctx.courseId) {
        return invalidResult("Course note not found in this course.")
      }
      await sql`
        UPDATE course_digital_notes
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = ${noteId}
      `
      return successResult(`Moved course note "${note.title}" to trash.`, {
        type: "note",
        id: noteId,
        title: note.title,
        route: "/module/course-notes",
      })
    }),

  "flashcard.createDeck": async (ctx) =>
    withCourseAccess(ctx, async () => {
      await ensureFlashcardSchema()
      const title = asString(ctx.args.title ?? ctx.args.topic ?? "Untitled deck").trim()
      const description = asString(ctx.args.description ?? "")
      const topic = trimOrNull(ctx.args.topic)
      const session = normalizeSession(ctx.args.session)
      const isPublished = ctx.args.isPublished !== false && ctx.args.is_published !== false
      const showInPracticeHub =
        ctx.args.showInPracticeHub === true || ctx.args.show_in_practice_hub === true
      const requireMcqValidation =
        ctx.args.requireMcqValidation !== false && ctx.args.require_mcq_validation !== false
      const cardsBeforeQuiz =
        ctx.args.cardsBeforeQuiz != null ? Number(ctx.args.cardsBeforeQuiz) : 10
      const rows = (await sql`
        INSERT INTO flashcard_decks (
          title, description, deck_kind, course_id, session, instructor_id, topic,
          show_in_practice_hub, is_published, require_mcq_validation, cards_before_quiz,
          created_at, updated_at
        ) VALUES (
          ${title}, ${description}, 'course', ${ctx.courseId}, ${session}, ${ctx.instructorId}, ${topic},
          ${showInPracticeHub}, ${isPublished}, ${requireMcqValidation}, ${cardsBeforeQuiz}, NOW(), NOW()
        )
        RETURNING id, title
      `) as { id: number; title: string }[]
      const deckId = Number(rows[0]?.id ?? 0)
      const cards = Array.isArray(ctx.args.cards) ? ctx.args.cards : []
      for (let i = 0; i < cards.length; i++) {
        const card = objectValue(cards[i])
        const front = asString(card.front ?? card.front_text).trim()
        const back = asString(card.back ?? card.back_text).trim()
        if (!front || !back) continue
        await sql`
          INSERT INTO flashcard_cards (
            deck_id, front_text, back_text, sort_order, difficulty, custom_distractors, created_at, updated_at
          ) VALUES (
            ${deckId},
            ${front},
            ${back},
            ${Number(card.sortOrder ?? i)},
            ${asString(card.difficulty ?? "medium")},
            ${JSON.stringify(Array.isArray(card.customDistractors) ? card.customDistractors : [])}::jsonb,
            NOW(),
            NOW()
          )
        `
      }
      await refreshFlashcardDeckCount(deckId)
      return successResult(`Created flashcard deck "${rows[0]?.title ?? title}".`, {
        type: "flashcard_deck",
        id: deckId,
        title: rows[0]?.title ?? title,
        route: "/module/flashcards",
      })
    }),

  "flashcard.createCards": async (ctx) =>
    withCourseAccess(ctx, async () => {
      await ensureFlashcardSchema()
      const deckId = positiveInt(ctx.args.deckId ?? ctx.args.id)
      const cards = Array.isArray(ctx.args.cards) ? ctx.args.cards : []
      if (!deckId || cards.length === 0) {
        return invalidResult("deckId and cards are required.")
      }
      const deck = await fetchFlashcardDeckById(deckId, { includeDeleted: true })
      if (!deck || deck.deck_kind !== "course" || Number(deck.course_id) !== ctx.courseId) {
        return invalidResult("Flashcard deck not found in this course.")
      }
      const existingCards = (await sql`
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
        FROM flashcard_cards
        WHERE deck_id = ${deckId}
      `) as { max_sort_order: number | string | null }[]
      const start = Number(existingCards[0]?.max_sort_order ?? 0)
      let inserted = 0
      for (let i = 0; i < cards.length; i++) {
        const card = objectValue(cards[i])
        const front = asString(card.front ?? card.front_text).trim()
        const back = asString(card.back ?? card.back_text).trim()
        if (!front || !back) continue
        await sql`
          INSERT INTO flashcard_cards (
            deck_id, front_text, back_text, sort_order, difficulty, custom_distractors, created_at, updated_at
          ) VALUES (
            ${deckId},
            ${front},
            ${back},
            ${start + i + 1},
            ${asString(card.difficulty ?? "medium")},
            ${JSON.stringify(Array.isArray(card.customDistractors) ? card.customDistractors : [])}::jsonb,
            NOW(),
            NOW()
          )
        `
        inserted += 1
      }
      await refreshFlashcardDeckCount(deckId)
      return successResult(`Added ${inserted} flashcard card${inserted === 1 ? "" : "s"} to "${deck.title}".`, {
        type: "flashcard_deck",
        id: deckId,
        title: deck.title,
        route: "/module/flashcards",
      })
    }),

  "flashcard.update": async (ctx) =>
    withCourseAccess(ctx, async () => {
      await ensureFlashcardSchema()
      const deckId = positiveInt(ctx.args.deckId ?? ctx.args.id)
      if (!deckId) return invalidResult("deckId is required.")
      const deck = await fetchFlashcardDeckById(deckId, { includeDeleted: true })
      if (!deck || deck.deck_kind !== "course" || Number(deck.course_id) !== ctx.courseId) {
        return invalidResult("Flashcard deck not found in this course.")
      }
      const title = ctx.args.title != null ? asString(ctx.args.title).trim() || "Untitled deck" : deck.title
      const description = ctx.args.description != null ? asString(ctx.args.description) : deck.description
      const topic = ctx.args.topic !== undefined ? trimOrNull(ctx.args.topic) : deck.topic
      const session = ctx.args.session !== undefined ? normalizeSession(ctx.args.session) : deck.session
      const showInPracticeHub =
        ctx.args.showInPracticeHub !== undefined
          ? Boolean(ctx.args.showInPracticeHub)
          : deck.show_in_practice_hub
      const isPublished =
        ctx.args.isPublished !== undefined ? Boolean(ctx.args.isPublished) : deck.is_published
      const requireMcqValidation =
        ctx.args.requireMcqValidation !== undefined
          ? Boolean(ctx.args.requireMcqValidation)
          : deck.require_mcq_validation !== false
      const cardsBeforeQuiz =
        ctx.args.cardsBeforeQuiz !== undefined
          ? Number(ctx.args.cardsBeforeQuiz)
          : Number(deck.cards_before_quiz ?? 10)
      await sql`
        UPDATE flashcard_decks
        SET title = ${title},
            description = ${description},
            topic = ${topic},
            session = ${session},
            show_in_practice_hub = ${showInPracticeHub},
            is_published = ${isPublished},
            require_mcq_validation = ${requireMcqValidation},
            cards_before_quiz = ${cardsBeforeQuiz},
            updated_at = NOW()
        WHERE id = ${deckId}
      `
      return successResult(`Updated flashcard deck "${title}".`, {
        type: "flashcard_deck",
        id: deckId,
        title,
        route: "/module/flashcards",
      })
    }),

  "flashcard.delete": async (ctx) =>
    withCourseAccess(ctx, async () => {
      await ensureFlashcardSchema()
      const deckId = positiveInt(ctx.args.deckId ?? ctx.args.id)
      if (!deckId) return invalidResult("deckId is required.")
      const deck = await fetchFlashcardDeckById(deckId, { includeDeleted: true })
      if (!deck || deck.deck_kind !== "course" || Number(deck.course_id) !== ctx.courseId) {
        return invalidResult("Flashcard deck not found in this course.")
      }
      await sql`
        UPDATE flashcard_decks
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = ${deckId}
      `
      await sql`
        UPDATE flashcard_cards
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE deck_id = ${deckId} AND deleted_at IS NULL
      `
      return successResult(`Moved flashcard deck "${deck.title}" to trash.`, {
        type: "flashcard_deck",
        id: deckId,
        title: deck.title,
        route: "/module/flashcards",
      })
    }),

  "flashcard.publish": async (ctx) =>
    withCourseAccess(ctx, async () => {
      await ensureFlashcardSchema()
      const deckId = positiveInt(ctx.args.deckId ?? ctx.args.id)
      if (!deckId) return invalidResult("deckId is required.")
      const deck = await fetchFlashcardDeckById(deckId, { includeDeleted: true })
      if (!deck || deck.deck_kind !== "course" || Number(deck.course_id) !== ctx.courseId) {
        return invalidResult("Flashcard deck not found in this course.")
      }
      await sql`
        UPDATE flashcard_decks
        SET is_published = true, updated_at = NOW()
        WHERE id = ${deckId}
      `
      return successResult(`Published flashcard deck "${deck.title}".`, {
        type: "flashcard_deck",
        id: deckId,
        title: deck.title,
        route: "/module/flashcards",
      })
    }),

  "practice.configure": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const patch = objectValue(
        ctx.args.practice_hub_policy ?? ctx.args.practiceHubPolicy ?? ctx.args.patch,
      )
      if (Object.keys(patch).length === 0) {
        return invalidResult("practice_hub_policy patch is required.")
      }
      const updated = await updateCoursePracticeHubPolicy({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        patch,
      })
      return successResult("Practice Hub policy updated.", {
        type: "practice_policy",
        id: ctx.courseId,
        title: "Practice Hub policy",
        route: updated.href,
      })
    }),

  "playground.configure": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const patch = objectValue(
        ctx.args.playground_policy ?? ctx.args.playgroundPolicy ?? ctx.args.patch,
      )
      if (Object.keys(patch).length === 0) {
        return invalidResult("playground_policy patch is required.")
      }
      const updated = await updateCoursePlaygroundPolicy({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        patch,
      })
      return successResult("Playground policy updated.", {
        type: "playground_policy",
        id: ctx.courseId,
        title: "Playground policy",
        route: updated.href,
      })
    }),

  "playground.populatePool": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const topicSummary =
        stringArray(ctx.args.topics).join(", ") ||
        trimOrNull(ctx.args.topic) ||
        `${numberArray(ctx.args.questionIds ?? ctx.args.question_ids).length} question ids`
      const notification = await createInstructorNotification({
        type: "playground_pool",
        title: "Playground question pool updated",
        message: `Pool request recorded for ${topicSummary || "selected questions"}.`,
        link: "/module/playground",
        source_type: "playground",
        source_id: String(ctx.courseId),
      })
      return successResult("Playground pool update recorded.", {
        type: "playground_pool",
        id: String(notification.id ?? ctx.courseId),
        title: "Playground question pool",
        route: "/module/playground",
      })
    }),

  "group.assignStudents": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const groupId = positiveInt(ctx.args.groupId ?? ctx.args.id)
      const studentIds = numberArray(ctx.args.studentIds ?? ctx.args.student_ids)
      if (!groupId || studentIds.length === 0) {
        return invalidResult("groupId and studentIds are required.")
      }
      const group = await fetchOwnedGroup(ctx.courseId, ctx.instructorId, groupId)
      if (!group) return invalidResult("Group not found in this course.")
      await sql`
        DELETE FROM group_members
        WHERE group_id = ${groupId}
          AND student_id = ANY(${studentIds})
      `
      for (const studentId of studentIds) {
        await sql`
          INSERT INTO group_members (group_id, student_id)
          VALUES (${groupId}, ${studentId})
          ON CONFLICT DO NOTHING
        `
      }
      return successResult(`Assigned ${studentIds.length} student${studentIds.length === 1 ? "" : "s"} to "${group.name}".`, {
        type: "group",
        id: groupId,
        title: group.name,
        route: "/module/groups",
      })
    }),

  "group.updateMembership": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const groupId = positiveInt(ctx.args.groupId ?? ctx.args.id)
      const studentIds = numberArray(ctx.args.studentIds ?? ctx.args.student_ids)
      if (!groupId) return invalidResult("groupId is required.")
      const group = await fetchOwnedGroup(ctx.courseId, ctx.instructorId, groupId)
      if (!group) return invalidResult("Group not found in this course.")
      await sql`DELETE FROM group_members WHERE group_id = ${groupId}`
      for (const studentId of studentIds) {
        await sql`
          INSERT INTO group_members (group_id, student_id)
          VALUES (${groupId}, ${studentId})
          ON CONFLICT DO NOTHING
        `
      }
      return successResult(`Updated membership for "${group.name}".`, {
        type: "group",
        id: groupId,
        title: group.name,
        route: "/module/groups",
      })
    }),

  "group.autoBalance": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const groupIds = numberArray(ctx.args.groupIds ?? ctx.args.group_ids)
      if (groupIds.length === 0) return invalidResult("groupIds are required.")
      const groups = (await sql`
        SELECT id, name
        FROM groups
        WHERE id = ANY(${groupIds})
          AND instructor_id = ${ctx.instructorId}
          AND (course_id = ${ctx.courseId} OR course_id IS NULL)
        ORDER BY id ASC
      `) as { id: number; name: string }[]
      if (groups.length === 0) return invalidResult("No eligible groups were found.")
      const students = (await sql`
        SELECT s.id
        FROM students s
        LEFT JOIN sessions sess ON sess.id = s.session_id
        WHERE (s.course_id = ${ctx.courseId} OR sess.course_id = ${ctx.courseId})
          AND NOT EXISTS (
            SELECT 1 FROM group_members gm WHERE gm.student_id = s.id
          )
        ORDER BY s.id ASC
      `) as { id: number }[]
      for (let i = 0; i < students.length; i++) {
        const target = groups[i % groups.length]
        await sql`
          INSERT INTO group_members (group_id, student_id)
          VALUES (${target.id}, ${students[i].id})
          ON CONFLICT DO NOTHING
        `
      }
      return successResult(`Auto-balanced ${students.length} student${students.length === 1 ? "" : "s"} across ${groups.length} group${groups.length === 1 ? "" : "s"}.`, {
        type: "group",
        id: groups[0].id,
        title: groups[0].name,
        route: "/module/groups",
      })
    }),

  "project.update": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const projectId = positiveInt(ctx.args.projectId ?? ctx.args.id)
      if (!projectId) return invalidResult("projectId is required.")
      const project = await fetchOwnedProject(ctx.courseId, projectId)
      if (!project) return invalidResult("Project not found in this course.")
      await sql`
        UPDATE projects
        SET title = COALESCE(${trimOrNull(ctx.args.title)}, title),
            summary = COALESCE(${trimOrNull(ctx.args.summary)}, summary),
            description = COALESCE(${trimOrNull(ctx.args.description)}, description),
            deliverables = COALESCE(${trimOrNull(ctx.args.deliverables)}, deliverables),
            requirements = COALESCE(${trimOrNull(ctx.args.requirements)}, requirements),
            target_platform = COALESCE(${trimOrNull(ctx.args.targetPlatform ?? ctx.args.target_platform)}, target_platform),
            updated_at = NOW()
        WHERE id = ${projectId}
      `
      return successResult(`Updated project "${trimOrNull(ctx.args.title) ?? project.title}".`, {
        type: "project",
        id: projectId,
        title: trimOrNull(ctx.args.title) ?? project.title,
        route: "/module/projects",
      })
    }),

  "project.configureDeadlines": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const projectId = positiveInt(ctx.args.projectId ?? ctx.args.id)
      const deadline = trimOrNull(ctx.args.deadline ?? ctx.args.dueAt ?? ctx.args.due_at)
      if (!projectId || !deadline) return invalidResult("projectId and deadline are required.")
      const project = await fetchOwnedProject(ctx.courseId, projectId)
      if (!project) return invalidResult("Project not found in this course.")
      await sql`
        UPDATE projects
        SET deadline = ${deadline},
            updated_at = NOW()
        WHERE id = ${projectId}
      `
      return successResult(`Updated deadlines for "${project.title}".`, {
        type: "project",
        id: projectId,
        title: project.title,
        route: "/module/projects",
      })
    }),

  "project.configureTeams": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const projectId = positiveInt(ctx.args.projectId ?? ctx.args.id)
      if (!projectId) return invalidResult("projectId is required.")
      const project = await fetchOwnedProject(ctx.courseId, projectId)
      if (!project) return invalidResult("Project not found in this course.")
      await sql`
        UPDATE projects
        SET max_members = COALESCE(${ctx.args.maxMembers != null ? Number(ctx.args.maxMembers) : null}, max_members),
            group_id = COALESCE(${positiveInt(ctx.args.groupId ?? ctx.args.group_id)}, group_id),
            updated_at = NOW()
        WHERE id = ${projectId}
      `
      return successResult(`Updated team settings for "${project.title}".`, {
        type: "project",
        id: projectId,
        title: project.title,
        route: "/module/projects",
      })
    }),

  "project.configureDeliverables": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const projectId = positiveInt(ctx.args.projectId ?? ctx.args.id)
      const deliverables = trimOrNull(ctx.args.deliverables ?? ctx.args.requirements)
      if (!projectId || !deliverables) {
        return invalidResult("projectId and deliverables are required.")
      }
      const project = await fetchOwnedProject(ctx.courseId, projectId)
      if (!project) return invalidResult("Project not found in this course.")
      await sql`
        UPDATE projects
        SET deliverables = ${deliverables},
            requirements = COALESCE(${deliverables}, requirements),
            updated_at = NOW()
        WHERE id = ${projectId}
      `
      return successResult(`Updated deliverables for "${project.title}".`, {
        type: "project",
        id: projectId,
        title: project.title,
        route: "/module/projects",
      })
    }),

  "courseExchange.request": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const sourceCourseId = positiveInt(ctx.args.sourceCourseId ?? ctx.args.source_course_id)
      if (!sourceCourseId) return invalidResult("sourceCourseId is required.")
      const created = await coraCreateExchangeRequest({
        requesterInstructorId: ctx.instructorId,
        sourceCourseId,
        purpose: trimOrNull(ctx.args.purpose),
      })
      return successResult(`Course Exchange request #${created.id} sent.`, {
        type: "course_exchange_request",
        id: created.id,
        title: `Exchange request #${created.id}`,
        route: "/module/course-exchange",
      })
    }),

  "courseExchange.approve": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const requestId = positiveInt(ctx.args.requestId ?? ctx.args.request_id)
      if (!requestId) return invalidResult("requestId is required.")
      await coraDecideExchangeRequest({
        instructorId: ctx.instructorId,
        requestId,
        decision: "approve",
        approvedModules: stringArray(ctx.args.approvedModules ?? ctx.args.approved_modules) as never,
        reason: trimOrNull(ctx.args.reason),
      })
      return successResult(`Approved Course Exchange request #${requestId}.`, {
        type: "course_exchange_request",
        id: requestId,
        title: `Exchange request #${requestId}`,
        route: "/module/course-exchange",
      })
    }),

  "courseExchange.reject": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const requestId = positiveInt(ctx.args.requestId ?? ctx.args.request_id)
      if (!requestId) return invalidResult("requestId is required.")
      await coraDecideExchangeRequest({
        instructorId: ctx.instructorId,
        requestId,
        decision: "reject",
        reason: trimOrNull(ctx.args.reason),
      })
      return successResult(`Rejected Course Exchange request #${requestId}.`, {
        type: "course_exchange_request",
        id: requestId,
        title: `Exchange request #${requestId}`,
        route: "/module/course-exchange",
      })
    }),

  "courseExchange.importCopy": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const requestId = positiveInt(ctx.args.requestId ?? ctx.args.request_id)
      const destinationCourseId = positiveInt(
        ctx.args.destinationCourseId ?? ctx.args.destination_course_id,
      )
      if (!requestId || !destinationCourseId) {
        return invalidResult("requestId and destinationCourseId are required.")
      }
      const copied = await coraExecuteExchangeCopy({
        requesterInstructorId: ctx.instructorId,
        requestId,
        destinationCourseId,
        destinationSessionId: positiveInt(
          ctx.args.destinationSessionId ?? ctx.args.destination_session_id,
        ),
      })
      return successResult("Imported approved course copy.", {
        type: "course",
        id: destinationCourseId,
        title: "Imported course copy",
        route: "/module/course-exchange",
      }, { data: { checklist: copied.postCopyChecklist } })
    }),

  "courseExchange.configureSharing": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const sharingModeRaw = asString(
        ctx.args.sharingMode ?? ctx.args.sharing_mode ?? "request_only",
      ).trim()
      const sharingMode = sharingModeRaw === "off" ? "off" : "request_only"
      await coraUpdateSharingMode({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        sharingMode,
      })
      return successResult("Updated Course Exchange sharing settings.", {
        type: "course",
        id: ctx.courseId,
        title: "Course Exchange sharing",
        route: "/module/course-exchange",
      })
    }),

  "summerCamp.manage": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const settingsPatch = objectValue(ctx.args.patch ?? ctx.args.settings)
      if (Object.keys(settingsPatch).length > 0) {
        await sql`
          CREATE TABLE IF NOT EXISTS summer_camp_settings (
            id SERIAL PRIMARY KEY,
            auto_approve_accounts BOOLEAN NOT NULL DEFAULT false,
            platform_admin_notify_email TEXT,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `
        const autoApprove =
          settingsPatch.auto_approve_accounts === true ||
          settingsPatch.autoApproveAccounts === true
        const notifyEmail = trimOrNull(
          settingsPatch.platform_admin_notify_email ?? settingsPatch.platformAdminNotifyEmail,
        )
        await sql`
          INSERT INTO summer_camp_settings (id, auto_approve_accounts, platform_admin_notify_email, updated_at)
          VALUES (1, ${autoApprove}, ${notifyEmail}, NOW())
          ON CONFLICT (id)
          DO UPDATE SET
            auto_approve_accounts = EXCLUDED.auto_approve_accounts,
            platform_admin_notify_email = EXCLUDED.platform_admin_notify_email,
            updated_at = NOW()
        `
        return successResult("Updated Summer Camp settings.", {
          type: "summer_camp",
          id: 1,
          title: "Summer Camp settings",
          route: "/module/summer-camp",
        })
      }
      return successResult("Summer Camp request recorded.", {
        type: "summer_camp",
        id: ctx.courseId,
        title: "Summer Camp",
        route: "/module/summer-camp",
      })
    }),

  "question.create": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const question = objectValue(ctx.args.question)
      const questionText = asString(
        question.question_text ?? ctx.args.question_text ?? ctx.args.questionText,
      ).trim()
      if (!questionText) return invalidResult("question_text is required.")
      const created = await bulkCreateQuestionBankQuestions({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        questions: [
          {
            ...question,
            question_text: questionText,
            question_type: question.question_type ?? ctx.args.question_type ?? ctx.args.questionType,
            difficulty: question.difficulty ?? ctx.args.difficulty,
            topic: question.topic ?? ctx.args.topic,
            options: question.options ?? ctx.args.options,
            correct_answer: question.correct_answer ?? ctx.args.correct_answer ?? ctx.args.correctAnswer,
          },
        ],
      })
      return successResult("Question added to the Question Bank.", {
        type: "question",
        id: created.questionIds[0] ?? 0,
        title: questionText.slice(0, 72),
        route: "/module/question-bank",
      }, { data: { questionIds: created.questionIds } })
    }),

  "question.bulkCreate": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const questions = Array.isArray(ctx.args.questions) ? ctx.args.questions : Array.isArray(ctx.args.drafts) ? ctx.args.drafts : []
      if (questions.length === 0) return invalidResult("questions are required.")
      const created = await bulkCreateQuestionBankQuestions({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        questions,
      })
      return successResult(`Added ${created.createdCount} question${created.createdCount === 1 ? "" : "s"} to the Question Bank.`, {
        type: "question",
        id: created.questionIds[0] ?? 0,
        title: `${created.createdCount} questions`,
        route: "/module/question-bank",
      }, { data: { questionIds: created.questionIds } })
    }),

  "question.update": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const questionId = positiveInt(ctx.args.questionId ?? ctx.args.id)
      if (!questionId) return invalidResult("questionId is required.")
      const body = objectValue(ctx.args.question)
      const questionText = asString(body.question_text ?? ctx.args.question_text ?? ctx.args.questionText).trim()
      const questionType = asString(body.question_type ?? ctx.args.question_type ?? ctx.args.questionType ?? "mcq")
      if (!questionText) return invalidResult("question_text is required.")
      const mediaJson = questionMediaToJsonString(body.question_media ?? ctx.args.question_media)
      const solutionJson = solutionUploadConfigToJsonString(
        body.solution_upload_config ?? ctx.args.solution_upload_config,
      )
      const normalized = normalizeQuestionBankRowForStorage({
        question_type: questionType,
        options: body.options ?? ctx.args.options,
        correct_answer:
          body.correct_answer ?? ctx.args.correct_answer ?? ctx.args.correctAnswer,
      })
      const correctAnswerJson =
        normalized.correct_answer == null ? null : JSON.stringify(normalized.correct_answer)
      const subquestionsValue =
        body.subquestions ?? ctx.args.subquestions
      const subquestionsJson =
        subquestionsValue !== undefined && subquestionsValue != null
          ? JSON.stringify(subquestionsValue)
          : null
      const owned = (await sql`
        SELECT id
        FROM question_bank
        WHERE id = ${questionId}
          AND deleted_at IS NULL
          AND course_id = ${ctx.courseId}
        LIMIT 1
      `) as { id: number }[]
      if (owned.length === 0) return invalidResult("Question not found in this course.")
      await sql`
        UPDATE question_bank
        SET question_text = ${questionText},
            question_type = ${questionType},
            difficulty = ${asString(body.difficulty ?? ctx.args.difficulty ?? "medium")},
            topic = ${trimOrNull(body.topic ?? ctx.args.topic)},
            hint = ${trimOrNull(body.hint ?? ctx.args.hint)},
            options = ${JSON.stringify(normalized.options)},
            correct_answer = ${correctAnswerJson}::jsonb,
            evaluation_mode = ${asString(body.evaluation_mode ?? ctx.args.evaluation_mode ?? "auto")},
            sample_answer = ${trimOrNull(body.sample_answer ?? ctx.args.sample_answer)},
            answer_guidelines = ${JSON.stringify(
              Array.isArray(body.answer_guidelines ?? ctx.args.answer_guidelines)
                ? (body.answer_guidelines ?? ctx.args.answer_guidelines)
                : [],
            )},
            explanation = ${trimOrNull(body.explanation ?? ctx.args.explanation)},
            question_media = ${mediaJson === null ? null : mediaJson}::jsonb,
            subquestions = ${subquestionsJson}::jsonb,
            solution_upload_config = ${solutionJson === null ? null : solutionJson}::jsonb,
            expected_answer = ${body.expected_answer ?? ctx.args.expected_answer ?? null},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${questionId}
      `
      if (mediaJson) {
        await propagateBankQuestionMediaToQuizQuestions(questionId, mediaJson)
      }
      return successResult("Question updated.", {
        type: "question",
        id: questionId,
        title: questionText.slice(0, 72),
        route: "/module/question-bank",
      })
    }),

  "question.restore": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const questionId = positiveInt(ctx.args.questionId ?? ctx.args.id)
      if (!questionId) return invalidResult("questionId is required.")
      const rows = (await sql`
        UPDATE question_bank
        SET deleted_at = NULL,
            deleted_by = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${questionId}
          AND course_id = ${ctx.courseId}
        RETURNING id, question_text
      `) as { id: number; question_text: string | null }[]
      if (rows.length === 0) return invalidResult("Deleted question not found in this course.")
      return successResult("Question restored.", {
        type: "question",
        id: questionId,
        title: asString(rows[0].question_text).slice(0, 72),
        route: "/module/question-bank",
      })
    }),

  "question.softDelete": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const questionId = positiveInt(ctx.args.questionId ?? ctx.args.id)
      if (!questionId) return invalidResult("questionId is required.")
      const rows = (await sql`
        UPDATE question_bank
        SET deleted_at = NOW(),
            deleted_by = 'cora',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${questionId}
          AND course_id = ${ctx.courseId}
        RETURNING id, question_text
      `) as { id: number; question_text: string | null }[]
      if (rows.length === 0) return invalidResult("Question not found in this course.")
      return successResult("Question moved to trash.", {
        type: "question",
        id: questionId,
        title: asString(rows[0].question_text).slice(0, 72),
        route: "/module/question-bank",
      })
    }),

  "assessment.create": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const questionIds = numberArray(
        ctx.args.questionIds ?? ctx.args.question_ids ?? ctx.args.bankQuestionIds,
      )
      const title = asString(ctx.args.title).trim()
      if (!title) return invalidResult("title is required.")
      if (questionIds.length > 0) {
        const created = await createAssessmentFromBank({
          instructorId: ctx.instructorId,
          courseId: ctx.courseId,
          title,
          description: trimOrNull(ctx.args.description),
          questionIds,
          assessmentType:
            ctx.args.assessmentType === "homework" ||
            ctx.args.assessmentType === "mid_semester" ||
            ctx.args.assessmentType === "final"
              ? (ctx.args.assessmentType as "homework" | "mid_semester" | "final")
              : "quiz",
          timeLimit: ctx.args.timeLimit != null ? Number(ctx.args.timeLimit) : undefined,
          availableFrom: trimOrNull(ctx.args.availableFrom ?? ctx.args.available_from),
          availableUntil: trimOrNull(ctx.args.availableUntil ?? ctx.args.available_until),
          publish: ctx.args.publish === true,
        })
        return successResult(`Created assessment "${created.title}".`, {
          type: "assessment",
          id: created.quizId,
          title: created.title,
          route: "/module/quizzes",
        })
      }
      const policy = await getAssessmentPolicyForCourse(ctx.courseId)
      const availableFromUTC = utcIsoToDbTimestamp(
        parseClientAvailabilityToUtcIso(trimOrNull(ctx.args.availableFrom ?? ctx.args.available_from)),
      )
      const availableUntilUTC = utcIsoToDbTimestamp(
        parseClientAvailabilityToUtcIso(trimOrNull(ctx.args.availableUntil ?? ctx.args.available_until)),
      )
      const rows = (await sql`
        INSERT INTO quizzes (
          title, description, time_per_question, created_by, is_public, is_active,
          available_from, available_until, retake_enabled, retake_limit, retake_policy,
          review_before_retake, course_id, assessment_type, created_at, updated_at
        )
        VALUES (
          ${title},
          ${trimOrNull(ctx.args.description)},
          ${ctx.args.time_per_question != null ? Number(ctx.args.time_per_question) : policy.timer.time_per_question_default},
          ${ctx.instructorId},
          ${ctx.args.publish === true},
          ${ctx.args.publish === true},
          ${availableFromUTC},
          ${availableUntilUTC},
          ${policy.retakes.retake_enabled_default},
          ${policy.retakes.retake_limit_default || null},
          ${policy.retakes.retake_policy_default},
          ${policy.retakes.review_before_retake_default},
          ${ctx.courseId},
          ${asString(ctx.args.assessmentType ?? ctx.args.assessment_type ?? "quiz")},
          NOW(),
          NOW()
        )
        RETURNING id
      `) as { id: number }[]
      const quizId = Number(rows[0]?.id ?? 0)
      return successResult(`Created assessment "${title}".`, {
        type: "assessment",
        id: quizId,
        title,
        route: "/module/quizzes",
      })
    }),

  "assessment.update": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const quizId = positiveInt(ctx.args.quizId ?? ctx.args.quiz_id ?? ctx.args.assessmentId ?? ctx.args.id)
      if (!quizId) return invalidResult("quizId is required.")
      const quiz = await fetchOwnedQuiz(ctx.courseId, quizId)
      if (!quiz) return invalidResult("Assessment not found in this course.")
      const title = trimOrNull(ctx.args.title) ?? quiz.title
      const allowedLangs = normalizeQuizAllowedLanguagesFromClient(
        ctx.args.allowed_ai_code_languages ?? null,
        trimOrNull(ctx.args.code_language),
      )
      await sql`
        UPDATE quizzes
        SET title = ${title},
            description = COALESCE(${trimOrNull(ctx.args.description)}, description),
            coverage = COALESCE(${trimOrNull(ctx.args.coverage)}, coverage),
            time_per_question = COALESCE(${ctx.args.time_per_question != null ? Number(ctx.args.time_per_question) : null}, time_per_question),
            available_from = COALESCE(${utcIsoToDbTimestamp(parseClientAvailabilityToUtcIso(trimOrNull(ctx.args.available_from ?? ctx.args.availableFrom)))}, available_from),
            available_until = COALESCE(${utcIsoToDbTimestamp(parseClientAvailabilityToUtcIso(trimOrNull(ctx.args.available_until ?? ctx.args.availableUntil)))}, available_until),
            ai_evaluation_mode = COALESCE(${trimOrNull(ctx.args.ai_evaluation_mode)}, ai_evaluation_mode),
            ai_model = COALESCE(${trimOrNull(ctx.args.ai_model)}, ai_model),
            ai_model_by_task = COALESCE(${ctx.args.ai_model_by_task != null ? JSON.stringify(ctx.args.ai_model_by_task) : null}::jsonb, ai_model_by_task),
            ai_enable_opus_fallback = COALESCE(${ctx.args.ai_enable_opus_fallback != null ? Boolean(ctx.args.ai_enable_opus_fallback) : null}, ai_enable_opus_fallback),
            ai_opus_confidence_threshold = COALESCE(${ctx.args.ai_opus_confidence_threshold != null ? Number(ctx.args.ai_opus_confidence_threshold) : null}, ai_opus_confidence_threshold),
            code_language = COALESCE(${allowedLangs[0] ?? null}, code_language),
            allowed_ai_code_languages = COALESCE(${JSON.stringify(allowedLangs)}::jsonb, allowed_ai_code_languages),
            section_config = COALESCE(${ctx.args.section_config != null ? JSON.stringify(ctx.args.section_config) : null}::jsonb, section_config),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${quizId}
      `
      if (Array.isArray(ctx.args.questions)) {
        await syncQuizQuestionsOnUpdate(quizId, ctx.args.questions as never[])
      }
      return successResult(`Updated assessment "${title}".`, {
        type: "assessment",
        id: quizId,
        title,
        route: "/module/quizzes",
      })
    }),

  "assessment.unpublish": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const quizId = positiveInt(ctx.args.quizId ?? ctx.args.quiz_id ?? ctx.args.assessmentId ?? ctx.args.id)
      if (!quizId) return invalidResult("quizId is required.")
      const quiz = await fetchOwnedQuiz(ctx.courseId, quizId)
      if (!quiz) return invalidResult("Assessment not found in this course.")
      await sql`
        UPDATE quizzes
        SET is_public = false,
            is_active = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${quizId}
      `
      return successResult(`Unpublished assessment "${quiz.title}".`, {
        type: "assessment",
        id: quizId,
        title: quiz.title,
        route: "/module/quizzes",
      })
    }),

  "assessment.addQuestions": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const quizId = positiveInt(ctx.args.quizId ?? ctx.args.quiz_id ?? ctx.args.assessmentId ?? ctx.args.id)
      const questionIds = numberArray(ctx.args.questionIds ?? ctx.args.question_ids)
      if (!quizId || questionIds.length === 0) {
        return invalidResult("quizId and questionIds are required.")
      }
      const quiz = await fetchOwnedQuiz(ctx.courseId, quizId)
      if (!quiz) return invalidResult("Assessment not found in this course.")
      const lastQuestion = (await sql`
        SELECT question_order FROM quiz_questions
        WHERE quiz_id = ${quizId}
        ORDER BY question_order DESC
        LIMIT 1
      `) as { question_order: number | null }[]
      let nextOrder = Number(lastQuestion[0]?.question_order ?? 0) + 1
      const bankQuestions = (await sql`
        SELECT id, question_type
        FROM question_bank
        WHERE id = ANY(${questionIds})
          AND course_id = ${ctx.courseId}
          AND deleted_at IS NULL
      `) as { id: number; question_type: string }[]
      for (const q of bankQuestions) {
        await sql`
          INSERT INTO quiz_questions (
            quiz_id, question_text, question_order, bank_question_id, time_limit,
            question_type, points, max_points, created_at
          ) VALUES (
            ${quizId}, '', ${nextOrder}, ${q.id}, 60, ${q.question_type}, 1, 1, NOW()
          )
        `
        nextOrder += 1
      }
      return successResult(`Added ${bankQuestions.length} question${bankQuestions.length === 1 ? "" : "s"} to "${quiz.title}".`, {
        type: "assessment",
        id: quizId,
        title: quiz.title,
        route: "/module/quizzes",
      })
    }),

  "assessment.removeQuestion": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const quizId = positiveInt(ctx.args.quizId ?? ctx.args.quiz_id ?? ctx.args.assessmentId ?? ctx.args.id)
      const questionId = positiveInt(ctx.args.questionId ?? ctx.args.question_id)
      if (!quizId || !questionId) return invalidResult("quizId and questionId are required.")
      const quiz = await fetchOwnedQuiz(ctx.courseId, quizId)
      if (!quiz) return invalidResult("Assessment not found in this course.")
      await sql`
        DELETE FROM quiz_questions
        WHERE quiz_id = ${quizId}
          AND (id = ${questionId} OR bank_question_id = ${questionId})
      `
      return successResult(`Removed question from "${quiz.title}".`, {
        type: "assessment",
        id: quizId,
        title: quiz.title,
        route: "/module/quizzes",
      })
    }),

  "assessment.configureAvailability": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const quizId = positiveInt(ctx.args.quizId ?? ctx.args.quiz_id ?? ctx.args.assessmentId ?? ctx.args.id)
      if (!quizId) return invalidResult("quizId is required.")
      const quiz = await fetchOwnedQuiz(ctx.courseId, quizId)
      if (!quiz) return invalidResult("Assessment not found in this course.")
      const restrictAccess =
        ctx.args.restrict_access_to_students === true ||
        ctx.args.restrictAccessToStudents === true
      await sql`
        UPDATE quizzes
        SET available_from = COALESCE(${utcIsoToDbTimestamp(parseClientAvailabilityToUtcIso(trimOrNull(ctx.args.available_from ?? ctx.args.availableFrom)))}, available_from),
            available_until = COALESCE(${utcIsoToDbTimestamp(parseClientAvailabilityToUtcIso(trimOrNull(ctx.args.available_until ?? ctx.args.availableUntil)))}, available_until),
            restrict_access_to_students = ${restrictAccess},
            allowed_student_ids = ${
              restrictAccess
                ? JSON.stringify(
                    normalizeAllowedStudentIds(
                      ctx.args.allowed_student_ids ?? ctx.args.allowedStudentIds,
                    ),
                  )
                : null
            },
            access_restriction_session_id = ${positiveInt(
              ctx.args.access_restriction_session_id ?? ctx.args.accessRestrictionSessionId,
            )},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${quizId}
      `
      return successResult(`Updated availability for "${quiz.title}".`, {
        type: "assessment",
        id: quizId,
        title: quiz.title,
        route: "/module/quizzes",
      })
    }),

  "assessment.configureAttempts": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const quizId = positiveInt(ctx.args.quizId ?? ctx.args.quiz_id ?? ctx.args.assessmentId ?? ctx.args.id)
      if (!quizId) return invalidResult("quizId is required.")
      const quiz = await fetchOwnedQuiz(ctx.courseId, quizId)
      if (!quiz) return invalidResult("Assessment not found in this course.")
      await sql`
        UPDATE quizzes
        SET retake_enabled = COALESCE(${ctx.args.retake_enabled != null ? Boolean(ctx.args.retake_enabled) : null}, retake_enabled),
            retake_limit = COALESCE(${ctx.args.retake_limit != null ? Number(ctx.args.retake_limit) : null}, retake_limit),
            retake_policy = COALESCE(${trimOrNull(ctx.args.retake_policy)}, retake_policy),
            review_before_retake = COALESCE(${ctx.args.review_before_retake != null ? Boolean(ctx.args.review_before_retake) : null}, review_before_retake),
            forfeit_retake_on_report_view = COALESCE(${ctx.args.forfeit_retake_on_report_view != null ? Boolean(ctx.args.forfeit_retake_on_report_view) : null}, forfeit_retake_on_report_view),
            lock_student_results_review = COALESCE(${ctx.args.lock_student_results_review != null ? Boolean(ctx.args.lock_student_results_review) : null}, lock_student_results_review),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${quizId}
      `
      return successResult(`Updated attempt settings for "${quiz.title}".`, {
        type: "assessment",
        id: quizId,
        title: quiz.title,
        route: "/module/quizzes",
      })
    }),

  "points.reviewPending": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const pending = (await sql`
        SELECT cp.id
        FROM classroom_points cp
        INNER JOIN students s ON s.id = cp.student_id
        LEFT JOIN sessions sess ON sess.id = s.session_id
        WHERE cp.status = 'pending'
          AND (s.course_id = ${ctx.courseId} OR sess.course_id = ${ctx.courseId})
        ORDER BY cp.id ASC
        LIMIT 25
      `) as { id: number }[]
      const approvedIds: number[] = []
      for (const row of pending) {
        try {
          const approved = await approveClassroomPoint({
            instructorId: ctx.instructorId,
            courseId: ctx.courseId,
            pointId: row.id,
          })
          approvedIds.push(approved.pointId)
        } catch {
          /* skip individual failures */
        }
      }
      return successResult(`Reviewed ${pending.length} pending classroom point${pending.length === 1 ? "" : "s"}.`, {
        type: "classroom_points_review",
        id: approvedIds[0] ?? ctx.courseId,
        title: "Pending classroom points",
        route: "/module/classroom-points",
      }, { data: { approvedIds } })
    }),

  "evaluation.process": async (ctx) =>
    withCourseAccess(ctx, async () =>
      createSupportStyleRecord(ctx, {
        subject: asString(ctx.args.subject ?? "Course evaluation processing").trim() || "Course evaluation processing",
        description:
          asString(ctx.args.description ?? ctx.args.message ?? "Evaluation processing requested.").trim(),
        category: "general",
        moduleId: "course-evaluations",
        moduleName: "Course Evaluations",
        href: "/module/course-evaluations",
        entityType: "evaluation_run",
        successMessage: "Evaluation processing request recorded.",
      }),
    ),

  "attendance.correct": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const sessionId = positiveInt(ctx.args.sessionId ?? ctx.args.session_id)
      const studentId = positiveInt(ctx.args.studentId ?? ctx.args.student_id)
      if (!sessionId || !studentId) return invalidResult("sessionId and studentId are required.")
      const corrected = await correctInstructorAttendanceRecord({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        sessionId,
        studentId,
        status: asString(ctx.args.status ?? "present"),
        studentName: trimOrNull(ctx.args.studentName ?? ctx.args.student_name),
        studentNumber: trimOrNull(ctx.args.studentNumber ?? ctx.args.student_number),
      })
      return successResult(`Attendance corrected for student #${corrected.studentId}.`, {
        type: "attendance_session",
        id: corrected.sessionId,
        title: `Attendance correction · student ${corrected.studentId}`,
        route: corrected.href,
      }, { data: { status: corrected.status, studentId: corrected.studentId } })
    }),

  "recommendation.updateStatus": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const requestId = positiveInt(ctx.args.requestId ?? ctx.args.request_id ?? ctx.args.id)
      const action = asString(ctx.args.action ?? ctx.args.status ?? "").trim()
      if (!requestId || !action) return invalidResult("requestId and action are required.")
      const rows = (await sql`
        SELECT id, status, student_id
        FROM recommendation_requests
        WHERE id = ${requestId}
          AND instructor_id = ${ctx.instructorId}
        LIMIT 1
      `) as { id: number; status: string; student_id: number }[]
      const row = rows[0]
      if (!row) return invalidResult("Recommendation request not found for this instructor.")
      if (action === "approve") {
        await sql`
          UPDATE recommendation_requests
          SET status = 'approved', updated_at = NOW()
          WHERE id = ${requestId}
        `
        await logRecommendationAudit({
          requestId,
          actorType: "instructor",
          actorId: ctx.instructorId,
          action: "approved",
          details: {},
        })
        await notifyRecommendationStudent(requestId, "approved").catch(() => {})
      } else if (action === "reject") {
        const reason = trimOrNull(ctx.args.reason) ?? ""
        await sql`
          UPDATE recommendation_requests
          SET status = 'rejected',
              rejection_reason = ${reason},
              updated_at = NOW()
          WHERE id = ${requestId}
        `
        await logRecommendationAudit({
          requestId,
          actorType: "instructor",
          actorId: ctx.instructorId,
          action: "rejected",
          details: { reason },
        })
        await notifyRecommendationStudent(requestId, "rejected", { reason }).catch(() => {})
      } else if (action === "request_info") {
        const note = trimOrNull(ctx.args.note) ?? ""
        await sql`
          UPDATE recommendation_requests
          SET status = 'info_requested',
              info_request_note = ${note},
              updated_at = NOW()
          WHERE id = ${requestId}
        `
        await logRecommendationAudit({
          requestId,
          actorType: "instructor",
          actorId: ctx.instructorId,
          action: "info_requested",
          details: { note },
        })
        await notifyRecommendationStudent(requestId, "info_requested", { note }).catch(() => {})
      } else if (action === "finalize") {
        const finalLetterText = asString(ctx.args.finalLetterText ?? ctx.args.final_letter_text).trim()
        if (!finalLetterText) return invalidResult("finalLetterText is required to finalize.")
        await sql`
          UPDATE recommendation_requests
          SET status = 'finalized',
              final_letter_text = ${finalLetterText},
              instructor_locked = true,
              instructor_reviewed_at = NOW(),
              updated_at = NOW()
          WHERE id = ${requestId}
        `
        await logRecommendationAudit({
          requestId,
          actorType: "instructor",
          actorId: ctx.instructorId,
          action: "finalized",
          details: {},
        })
        await notifyRecommendationStudent(requestId, "finalized").catch(() => {})
      } else {
        const nextStatus = trimOrNull(ctx.args.status)
        if (!nextStatus) return invalidResult("Unsupported recommendation status action.")
        await sql`
          UPDATE recommendation_requests
          SET status = ${nextStatus},
              updated_at = NOW()
          WHERE id = ${requestId}
        `
      }
      return successResult("Recommendation request updated.", {
        type: "recommendation",
        id: requestId,
        title: `Recommendation request #${requestId}`,
        route: "/module/recommendations",
      })
    }),

  "trade.managePerks": async (ctx) => withCourseAccess(ctx, async () => createTradeCenterConfigWrite(ctx, "Trade Center perks updated.")),
  "trade.manageRules": async (ctx) => withCourseAccess(ctx, async () => createTradeCenterConfigWrite(ctx, "Trade Center rules updated.")),

  "trade.manageRedemptions": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const requestId = positiveInt(ctx.args.requestId ?? ctx.args.request_id ?? ctx.args.id)
      const decision = asString(ctx.args.decision ?? "approve").trim()
      if (!requestId) return invalidResult("requestId is required.")
      const rows = (await sql`
        UPDATE point_requests
        SET status = ${
          decision === "reject" ? "rejected_by_instructor" : "approved_by_instructor"
        },
            reviewed_by = ${ctx.instructorId},
            instructor_responded_at = NOW(),
            rejection_reason = ${
              decision === "reject" ? trimOrNull(ctx.args.reason) : null
            }
        WHERE id = ${requestId}
        RETURNING id
      `) as { id: number }[]
      if (rows.length === 0) return invalidResult("Trade redemption request not found.")
      return successResult(
        decision === "reject"
          ? `Rejected trade redemption request #${requestId}.`
          : `Approved trade redemption request #${requestId}.`,
        {
          type: "trade_redemption",
          id: requestId,
          title: `Trade redemption #${requestId}`,
          route: "/module/trade-center",
        },
      )
    }),

  "results.regrade": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const attemptId = positiveInt(ctx.args.attemptId ?? ctx.args.attempt_id ?? ctx.args.id)
      if (!attemptId) return invalidResult("attemptId is required.")
      await sql`
        UPDATE quiz_attempts
        SET updated_at = NOW()
        WHERE id = ${attemptId}
          AND EXISTS (
            SELECT 1 FROM quizzes q
            WHERE q.id = quiz_attempts.quiz_id
              AND q.course_id = ${ctx.courseId}
          )
      `
      return successResult(`Regrade recorded for attempt #${attemptId}.`, {
        type: "assessment_result",
        id: attemptId,
        title: `Attempt #${attemptId}`,
        route: "/module/results",
      })
    }),

  "results.proposeRegrade": async (ctx) =>
    withCourseAccess(ctx, async () =>
      createSupportStyleRecord(ctx, {
        subject: asString(ctx.args.subject ?? "Assessment regrade request").trim() || "Assessment regrade request",
        description:
          asString(ctx.args.reason ?? ctx.args.description ?? "Regrade proposal recorded.").trim(),
        category: "general",
        moduleId: "results",
        moduleName: "Results",
        href: "/module/results",
        entityType: "regrade_request",
        successMessage: "Regrade proposal recorded.",
      }),
    ),

  "defaults.update": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const patch = objectValue(
        ctx.args.assessment_policy ?? ctx.args.assessmentPolicy ?? ctx.args.patch,
      )
      if (Object.keys(patch).length === 0) {
        return invalidResult("assessment_policy patch is required.")
      }
      const updated = await updateCourseAssessmentPolicyDefaults({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        patch,
      })
      return successResult("Assessment defaults updated.", {
        type: "assessment_defaults",
        id: ctx.courseId,
        title: "Assessment defaults",
        route: updated.href,
      })
    }),

  "governance.update": async (ctx) =>
    withCourseAccess(ctx, async () => {
      await ensureAssessmentGovernanceColumns()
      const source = parseAssessmentPrivilegeSource(
        ctx.args.assessment_privilege_source ?? ctx.args.assessmentPrivilegeSource,
      )
      const showNotice =
        ctx.args.show_course_policy_notice != null
          ? Boolean(ctx.args.show_course_policy_notice)
          : ctx.args.showCoursePolicyNotice != null
            ? Boolean(ctx.args.showCoursePolicyNotice)
            : true
      await sql`
        UPDATE courses
        SET assessment_privilege_source = ${source},
            show_course_policy_notice = ${showNotice},
            updated_at = NOW()
        WHERE id = ${ctx.courseId}
      `
      return successResult("Assessment governance updated.", {
        type: "course_governance",
        id: ctx.courseId,
        title: "Assessment governance",
        route: "/module/assessment-governance",
      })
    }),

  "pointsRules.update": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const patch = objectValue(ctx.args.rewards_policy ?? ctx.args.rewardsPolicy ?? ctx.args.patch)
      if (Object.keys(patch).length === 0) return invalidResult("rewards_policy patch is required.")
      const updated = await updateCourseRewardsPolicy({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        patch,
      })
      return successResult("Rewards policy updated.", {
        type: "rewards_policy",
        id: ctx.courseId,
        title: "Rewards policy",
        route: updated.href,
      })
    }),

  "playgroundRules.update": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const patch = objectValue(ctx.args.playground_policy ?? ctx.args.playgroundPolicy ?? ctx.args.patch)
      if (Object.keys(patch).length === 0) {
        return invalidResult("playground_policy patch is required.")
      }
      const updated = await updateCoursePlaygroundPolicy({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        patch,
      })
      return successResult("Playground rules updated.", {
        type: "playground_policy",
        id: ctx.courseId,
        title: "Playground rules",
        route: updated.href,
      })
    }),

  "coraPolicy.update": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const patch = objectValue(ctx.args.ai_policy ?? ctx.args.aiPolicy ?? ctx.args.patch)
      if (Object.keys(patch).length === 0) return invalidResult("ai_policy patch is required.")
      await ensureCoursePoliciesRow(ctx.courseId, ctx.instructorId)
      const existing = (await sql`
        SELECT ai_policy FROM course_policies WHERE course_id = ${ctx.courseId} LIMIT 1
      `) as { ai_policy?: unknown }[]
      const merged = { ...objectValue(existing[0]?.ai_policy), ...patch }
      await sql`
        UPDATE course_policies
        SET ai_policy = ${JSON.stringify(merged)}::jsonb,
            updated_by = ${ctx.instructorId},
            updated_at = NOW()
        WHERE course_id = ${ctx.courseId}
      `
      return successResult("Cora assistant policy updated.", {
        type: "ai_policy",
        id: ctx.courseId,
        title: "Cora policy",
        route: "/module/ai-assistant-settings",
      })
    }),

  "projectPolicy.update": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const patch = objectValue(ctx.args.project_policy ?? ctx.args.projectPolicy ?? ctx.args.patch)
      if (Object.keys(patch).length === 0) return invalidResult("project_policy patch is required.")
      const updated = await updateCourseProjectPolicy({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        patch,
      })
      return successResult("Project policy updated.", {
        type: "project_policy",
        id: ctx.courseId,
        title: "Project policy",
        route: updated.href,
      })
    }),

  "message.draft": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const title = asString(ctx.args.subject ?? "Draft message").trim() || "Draft message"
      const message = asString(ctx.args.body ?? ctx.args.message).trim()
      if (!message) return invalidResult("Message body is required.")
      const notification = await createInstructorNotification({
        type: "message_draft",
        title,
        message,
        link: "/module/messages",
        source_type: "message",
        source_id: String(ctx.courseId),
      })
      return successResult("Message draft saved.", {
        type: "message",
        id: String(notification.id ?? ctx.courseId),
        title,
        route: "/module/messages",
      })
    }),

  "message.send": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const recipientStudentId = positiveInt(
        ctx.args.recipientStudentId ?? ctx.args.recipient_student_id,
      )
      const body = asString(ctx.args.body).trim()
      if (!recipientStudentId || !body) {
        return invalidResult("recipientStudentId and body are required.")
      }
      const sent = await sendInstructorDirectMessage({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        recipientStudentId,
        subject: trimOrNull(ctx.args.subject),
        body,
        existingThreadId: positiveInt(ctx.args.existingThreadId ?? ctx.args.existing_thread_id),
      })
      return successResult(`Message sent to ${sent.recipientName}.`, {
        type: "message",
        id: sent.messageId,
        title: sent.recipientName,
        route: `/module/messages?threadId=${sent.threadId}`,
      })
    }),

  "notification.manage": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const notificationId = positiveInt(ctx.args.notificationId ?? ctx.args.id)
      const action = asString(ctx.args.action ?? "create").trim()
      if (action === "mark_read") {
        if (!notificationId) return invalidResult("notificationId is required.")
        await sql`
          UPDATE instructor_notifications
          SET is_read = true, read_at = NOW()
          WHERE id = ${notificationId}
        `
        return successResult("Notification marked as read.", {
          type: "notification",
          id: notificationId,
          title: `Notification #${notificationId}`,
          route: "/module/notifications",
        })
      }
      const title = asString(ctx.args.title).trim()
      const message = asString(ctx.args.message).trim()
      const type = asString(ctx.args.type ?? "general").trim()
      if (!title || !message) return invalidResult("title and message are required.")
      const notification = await createInstructorNotification({
        type,
        title,
        message,
        link: trimOrNull(ctx.args.link),
        source_type: trimOrNull(ctx.args.source_type),
        source_id: trimOrNull(ctx.args.source_id),
      })
      return successResult("Notification created.", {
        type: "notification",
        id: String(notification.id ?? ctx.courseId),
        title,
        route: "/module/notifications",
      })
    }),

  "support.process": async (ctx) =>
    withCourseAccess(ctx, async () =>
      createSupportStyleRecord(ctx, {
        subject: asString(ctx.args.subject ?? "Instructor support request").trim() || "Instructor support request",
        description:
          asString(ctx.args.description ?? ctx.args.message).trim(),
        category: asString(ctx.args.category ?? "general").trim() || "general",
        priority: asString(ctx.args.priority ?? "medium").trim() || "medium",
        moduleId: trimOrNull(ctx.args.moduleId),
        moduleName: trimOrNull(ctx.args.moduleName),
        href: "/module/help-center",
        entityType: "support_ticket",
        successMessage: "Support request submitted.",
      }),
    ),

  "courseSettings.updateSafe": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const incoming = objectValue(ctx.args.module_settings ?? ctx.args.moduleSettings ?? ctx.args.patch)
      if (Object.keys(incoming).length === 0) {
        return invalidResult("module_settings patch is required.")
      }
      const courseRows = (await sql`
        SELECT module_settings FROM courses WHERE id = ${ctx.courseId} LIMIT 1
      `) as { module_settings?: unknown }[]
      const merged = mergeCourseModuleSettings({
        ...objectValue(courseRows[0]?.module_settings),
        ...incoming,
      })
      await sql`
        UPDATE courses
        SET module_settings = ${JSON.stringify(merged)}::jsonb,
            updated_at = NOW()
        WHERE id = ${ctx.courseId}
      `
      return successResult("Course settings updated.", {
        type: "course_settings",
        id: ctx.courseId,
        title: "Course settings",
        route: "/module/course-settings",
      })
    }),

  "terms.update": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const termId = positiveInt(ctx.args.termId ?? ctx.args.id)
      if (!termId) return invalidResult("termId is required.")
      await sql`
        UPDATE academic_terms
        SET year = COALESCE(${ctx.args.year != null ? Number(ctx.args.year) : null}, year),
            term = COALESCE(${trimOrNull(ctx.args.term)}, term),
            start_date = COALESCE(${trimOrNull(ctx.args.start_date ?? ctx.args.startDate)}, start_date),
            end_date = COALESCE(${trimOrNull(ctx.args.end_date ?? ctx.args.endDate)}, end_date),
            updated_at = NOW()
        WHERE id = ${termId}
      `
      if (ctx.args.isActive === true || ctx.args.is_active === true) {
        await setActiveAcademicTerm(termId)
      }
      return successResult("Academic term updated.", {
        type: "academic_term",
        id: termId,
        title: trimOrNull(ctx.args.term) ?? `Term #${termId}`,
        route: "/module/academic-terms",
      })
    }),

  "ta.manage": async (ctx) =>
    withCourseAccess(ctx, async () => {
      await ensureTaPermissionColumns()
      await ensurePortalRbacSchema()
      const taId = positiveInt(ctx.args.taId ?? ctx.args.id)
      if (!taId) return invalidResult("taId is required.")
      let permissions = objectValue(ctx.args.permissions)
      if (ctx.args.navModule && typeof ctx.args.enabled === "boolean") {
        const level: TaModuleGrantLevel = ctx.args.level === "publish" ? "publish" : "crud"
        permissions = {
          ...permissions,
          ...permissionPatchForNavModuleLevel(
            ctx.args.navModule as TaNavModuleId,
            level,
            ctx.args.enabled,
          ),
        }
      }
      if (Object.keys(permissions).length === 0) {
        return invalidResult("permissions or navModule update is required.")
      }
      const taRows = (await sql`
        SELECT ta_permissions
        FROM instructors
        WHERE id = ${taId}
          AND COALESCE(role, 'instructor') = 'ta'
          AND assigned_instructor_id = ${ctx.instructorId}
        LIMIT 1
      `) as { ta_permissions: Record<string, unknown> | null }[]
      if (taRows.length === 0) return invalidResult("TA not found for this instructor.")
      const existing = objectValue(taRows[0].ta_permissions)
      const byCourse = objectValue(existing.byCourse)
      const currentCourse = objectValue(byCourse[String(ctx.courseId)])
      byCourse[String(ctx.courseId)] = { ...currentCourse, ...permissions }
      await sql`
        UPDATE instructors
        SET ta_permissions = ${JSON.stringify({ byCourse })}::jsonb
        WHERE id = ${taId}
      `
      await syncTaLegacyPermissionsToStaff(
        taId,
        ctx.courseId,
        "TA",
        ctx.instructorId,
        { byCourse } as never,
        permissions as never,
      )
      return successResult("TA permissions updated.", {
        type: "teaching_assistant",
        id: taId,
        title: `TA #${taId}`,
        route: "/module/teaching-assistants",
      })
    }),

  "ticket.create": async (ctx) =>
    withCourseAccess(ctx, async () =>
      createSupportStyleRecord(ctx, {
        subject: asString(ctx.args.subject ?? ctx.args.title).trim() || "Support ticket",
        description: asString(ctx.args.description ?? ctx.args.message).trim(),
        category: "general",
        priority: asString(ctx.args.priority ?? "medium").trim() || "medium",
        moduleId: trimOrNull(ctx.args.moduleId),
        moduleName: trimOrNull(ctx.args.moduleName),
        href: "/module/help-center",
        entityType: "support_ticket",
        successMessage: "Support ticket created.",
      }),
    ),

  "bug.create": async (ctx) =>
    withCourseAccess(ctx, async () =>
      createSupportStyleRecord(ctx, {
        subject: asString(ctx.args.subject ?? ctx.args.title).trim() || "Bug report",
        description:
          [
            asString(ctx.args.description).trim(),
            trimOrNull(ctx.args.stepsToReproduce ?? ctx.args.steps_to_reproduce)
              ? `Steps: ${trimOrNull(ctx.args.stepsToReproduce ?? ctx.args.steps_to_reproduce)}`
              : "",
            trimOrNull(ctx.args.expectedBehavior ?? ctx.args.expected_behavior)
              ? `Expected: ${trimOrNull(ctx.args.expectedBehavior ?? ctx.args.expected_behavior)}`
              : "",
            trimOrNull(ctx.args.actualBehavior ?? ctx.args.actual_behavior)
              ? `Actual: ${trimOrNull(ctx.args.actualBehavior ?? ctx.args.actual_behavior)}`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        category: "bug",
        priority: asString(ctx.args.priority ?? "high").trim() || "high",
        moduleId: trimOrNull(ctx.args.moduleId),
        moduleName: trimOrNull(ctx.args.moduleName),
        href: "/module/report-bug",
        entityType: "bug_report",
        successMessage: "Bug report submitted.",
      }),
    ),

  "featureRequest.create": async (ctx) =>
    withCourseAccess(ctx, async () =>
      createSupportStyleRecord(ctx, {
        subject: asString(ctx.args.subject ?? ctx.args.title).trim() || "Feature request",
        description:
          [
            asString(ctx.args.description).trim(),
            trimOrNull(ctx.args.whyItHelps ?? ctx.args.why_it_helps)
              ? `Why it helps: ${trimOrNull(ctx.args.whyItHelps ?? ctx.args.why_it_helps)}`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        category: "feature",
        priority: asString(ctx.args.priority ?? "medium").trim() || "medium",
        moduleId: trimOrNull(ctx.args.moduleId),
        moduleName: trimOrNull(ctx.args.moduleName),
        href: "/module/feature-requests",
        entityType: "feature_request",
        successMessage: "Feature request submitted.",
      }),
    ),

  "submissionIssue.resolve": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const issueId = positiveInt(ctx.args.issueId ?? ctx.args.id)
      if (!issueId) return invalidResult("issueId is required.")
      const rows = (await sql`
        UPDATE issues
        SET status = 'closed',
            resolution = COALESCE(${trimOrNull(ctx.args.resolution ?? ctx.args.note)}, resolution),
            updated_at = NOW()
        WHERE id = ${issueId}
        RETURNING id, title
      `) as { id: number; title: string | null }[]
      if (rows.length === 0) {
        return createSupportStyleRecord(ctx, {
          subject: `Submission issue #${issueId}`,
          description: asString(ctx.args.resolution ?? ctx.args.note ?? "Resolve submission issue").trim(),
          category: "general",
          moduleId: "submission-issues",
          moduleName: "Submission Issues",
          href: "/module/submission-issues",
          entityType: "submission_issue",
          successMessage: "Submission issue resolution recorded.",
        })
      }
      return successResult("Submission issue resolved.", {
        type: "submission_issue",
        id: issueId,
        title: asString(rows[0].title ?? `Issue #${issueId}`),
        route: "/module/submission-issues",
      })
    }),

  "report.export": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const reportTitle = asString(ctx.args.title ?? "Assessment results export").trim()
      const notification = await createInstructorNotification({
        type: "report_export",
        title: reportTitle,
        message: "Report export generated for the current course scope.",
        link: "/module/reports",
        source_type: "report",
        source_id: String(ctx.courseId),
      })
      return successResult("Report export generated.", {
        type: "report_export",
        id: String(notification.id ?? ctx.courseId),
        title: reportTitle,
        route: "/module/reports",
      })
    }),
}
