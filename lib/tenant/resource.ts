import { sql } from "@/lib/db"
import { withPlatformPrivilegedDbContext } from "@/lib/db-tenant-context"
import { resolveSessionInstitution } from "@/lib/institutions/tenant-ownership"
import type { ResourceTenant, TenantResourceType } from "@/lib/tenant/types"

function asId(value: number): number | null {
  const id = Math.trunc(Number(value))
  return Number.isFinite(id) && id >= 1 ? id : null
}

function privilegedMeta<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  return withPlatformPrivilegedDbContext(operation, fn)
}

export async function resolveCourseTenant(courseId: number): Promise<ResourceTenant | null> {
  const id = asId(courseId)
  if (id == null) return null
  const rows = (await privilegedMeta("resolve_course_tenant", () => sql`
    SELECT university_id, organization_unit_id FROM courses WHERE id = ${id} LIMIT 1
  `)) as { university_id: number | null; organization_unit_id: number | null }[]
  const row = rows[0]
  if (!row) return null
  return {
    institutionId: row.university_id != null ? Number(row.university_id) : null,
    courseId: id,
    organizationUnitId: row.organization_unit_id != null ? Number(row.organization_unit_id) : null,
    resourceType: "course",
    resourceId: id,
  }
}

export async function resolveSessionTenant(sessionId: number): Promise<ResourceTenant | null> {
  const id = asId(sessionId)
  if (id == null) return null
  const owned = await resolveSessionInstitution(id)
  if (!owned) return null
  return {
    institutionId: owned.institutionId,
    courseId: owned.courseId,
    sessionId: owned.sessionId,
    resourceType: "session",
    resourceId: id,
  }
}

export async function resolveQuizTenant(quizId: number): Promise<ResourceTenant | null> {
  const id = asId(quizId)
  if (id == null) return null
  const rows = (await privilegedMeta("resolve_quiz_tenant", () => sql`
    SELECT q.id, q.course_id, c.university_id, c.organization_unit_id
    FROM quizzes q
    INNER JOIN courses c ON c.id = q.course_id
    WHERE q.id = ${id}
    LIMIT 1
  `)) as {
    id: number
    course_id: number | null
    university_id: number | null
    organization_unit_id: number | null
  }[]
  const row = rows[0]
  if (!row || row.course_id == null) return null
  return {
    institutionId: row.university_id != null ? Number(row.university_id) : null,
    courseId: Number(row.course_id),
    organizationUnitId: row.organization_unit_id != null ? Number(row.organization_unit_id) : null,
    resourceType: "quiz",
    resourceId: Number(row.id),
  }
}

export const resolveAssessmentTenant = resolveQuizTenant

export async function resolveAttemptTenant(attemptId: number): Promise<ResourceTenant | null> {
  const id = asId(attemptId)
  if (id == null) return null
  const rows = (await privilegedMeta("resolve_attempt_tenant", () => sql`
    SELECT
      qa.id,
      q.id AS quiz_id,
      q.course_id,
      c.university_id,
      c.organization_unit_id
    FROM quiz_attempts qa
    INNER JOIN quizzes q ON q.id = qa.quiz_id
    INNER JOIN courses c ON c.id = q.course_id
    WHERE qa.id = ${id}
    LIMIT 1
  `)) as {
    id: number
    quiz_id: number
    course_id: number | null
    university_id: number | null
    organization_unit_id: number | null
  }[]
  const row = rows[0]
  if (!row || row.course_id == null) return null
  return {
    institutionId: row.university_id != null ? Number(row.university_id) : null,
    courseId: Number(row.course_id),
    organizationUnitId: row.organization_unit_id != null ? Number(row.organization_unit_id) : null,
    resourceType: "attempt",
    resourceId: Number(row.id),
  }
}

export async function resolveStudentEnrollmentTenant(studentDbId: number): Promise<ResourceTenant | null> {
  const id = asId(studentDbId)
  if (id == null) return null
  const rows = (await privilegedMeta("resolve_student_enrollment_tenant", () => sql`
    SELECT
      s.id,
      COALESCE(s.course_id, sess.course_id) AS course_id,
      c.university_id,
      c.organization_unit_id,
      s.session_id
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    LEFT JOIN courses c ON c.id = COALESCE(s.course_id, sess.course_id)
    WHERE s.id = ${id}
    LIMIT 1
  `)) as {
    id: number
    course_id: number | null
    university_id: number | null
    organization_unit_id: number | null
    session_id: number | null
  }[]
  const row = rows[0]
  if (!row) return null
  return {
    institutionId: row.university_id != null ? Number(row.university_id) : null,
    courseId: row.course_id != null ? Number(row.course_id) : null,
    sessionId: row.session_id != null ? Number(row.session_id) : null,
    organizationUnitId: row.organization_unit_id != null ? Number(row.organization_unit_id) : null,
    resourceType: "student",
    resourceId: Number(row.id),
  }
}

export async function resolveRequestedResourceTenant(input: {
  courseId?: number | null
  sessionId?: number | null
  quizId?: number | null
  attemptId?: number | null
}): Promise<ResourceTenant | null> {
  if (input.attemptId != null) return resolveAttemptTenant(input.attemptId)
  if (input.quizId != null) return resolveQuizTenant(input.quizId)
  if (input.sessionId != null) return resolveSessionTenant(input.sessionId)
  if (input.courseId != null) return resolveCourseTenant(input.courseId)
  return null
}

async function resolveCourseOwnedRow(
  table: "lectures" | "announcements" | "question_bank",
  resourceType: TenantResourceType,
  resourceId: number,
): Promise<ResourceTenant | null> {
  const id = asId(resourceId)
  if (id == null) return null
  const rows = (await privilegedMeta(`resolve_${table}_tenant`, () => sql`
    SELECT t.course_id, c.university_id, c.organization_unit_id
    FROM ${sql.unsafe(table)} t
    INNER JOIN courses c ON c.id = t.course_id
    WHERE t.id = ${id}
    LIMIT 1
  `)) as {
    course_id: number | null
    university_id: number | null
    organization_unit_id: number | null
  }[]
  const row = rows[0]
  if (!row || row.course_id == null) return null
  return {
    institutionId: row.university_id != null ? Number(row.university_id) : null,
    courseId: Number(row.course_id),
    organizationUnitId: row.organization_unit_id != null ? Number(row.organization_unit_id) : null,
    resourceType,
    resourceId: id,
  }
}

/** Privileged bootstrap: lecture id → course/institution metadata only. */
export function resolveLectureTenant(lectureId: number) {
  return resolveCourseOwnedRow("lectures", "course", lectureId)
}

/** Privileged bootstrap: announcement id → course/institution metadata only. */
export function resolveAnnouncementTenant(announcementId: number) {
  return resolveCourseOwnedRow("announcements", "course", announcementId)
}

/** Privileged bootstrap: question-bank id → course/institution metadata only. */
export function resolveQuestionBankTenant(questionId: number) {
  return resolveCourseOwnedRow("question_bank", "course", questionId)
}

export function describeResourceType(type: TenantResourceType): string {
  return type
}

export type QuizAnswerMeta = {
  answerId: number
  attemptId: number
  questionId: number
  quizId: number
  courseId: number
  institutionId: number | null
}

/** Privileged bootstrap: answer id → ids only. No points, answers, or bodies. */
export async function resolveQuizAnswerMeta(answerId: number): Promise<QuizAnswerMeta | null> {
  const id = asId(answerId)
  if (id == null) return null
  const rows = (await privilegedMeta("resolve_quiz_answer_meta", () => sql`
    SELECT
      qa.id,
      qa.attempt_id,
      qa.question_id,
      q.id AS quiz_id,
      q.course_id,
      c.university_id
    FROM quiz_answers qa
    INNER JOIN quiz_attempts att ON att.id = qa.attempt_id
    INNER JOIN quizzes q ON q.id = att.quiz_id
    INNER JOIN courses c ON c.id = q.course_id
    WHERE qa.id = ${id}
    LIMIT 1
  `)) as {
    id: number
    attempt_id: number
    question_id: number
    quiz_id: number
    course_id: number | null
    university_id: number | null
  }[]
  const row = rows[0]
  if (!row || row.course_id == null) return null
  return {
    answerId: Number(row.id),
    attemptId: Number(row.attempt_id),
    questionId: Number(row.question_id),
    quizId: Number(row.quiz_id),
    courseId: Number(row.course_id),
    institutionId: row.university_id != null ? Number(row.university_id) : null,
  }
}
