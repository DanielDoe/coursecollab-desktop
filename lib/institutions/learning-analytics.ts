import { sql } from "@/lib/db"
import { recordAnalyticsEvent } from "@/lib/institutions/analytics-events"
import { findStudentCoveredLicenses } from "@/lib/institutions/coverage"

export type StudentInstitutionContext = {
  institutionId: number
  courseId: number | null
  studentId: number
}

/** Resolve institution license context for a student action. Best-effort. */
export async function resolveStudentInstitutionContext(
  studentId: number,
  courseId?: number | null,
): Promise<StudentInstitutionContext | null> {
  if (!Number.isFinite(studentId) || studentId <= 0) return null
  let resolvedCourseId = courseId ?? null
  if (resolvedCourseId == null) {
    const row = await sql`SELECT course_id FROM students WHERE id = ${studentId} LIMIT 1`.catch(() => [])
    resolvedCourseId = row[0]?.course_id != null ? Number(row[0].course_id) : null
  }
  const licenses = await findStudentCoveredLicenses(studentId, {
    courseId: resolvedCourseId ?? undefined,
  })
  const license = licenses[0]
  if (!license) return null
  return {
    institutionId: license.institutionId,
    courseId: resolvedCourseId,
    studentId,
  }
}

export async function recordPracticeAnalytics(input: {
  studentId: number
  attemptId: number
  courseId?: number | null
  score?: number | null
  correctCount?: number
  totalQuestions?: number
  completed?: boolean
  event?: "practice_started" | "practice_attempted" | "practice_correct"
}): Promise<void> {
  const ctx = await resolveStudentInstitutionContext(input.studentId, input.courseId)
  if (!ctx) return
  const eventType =
    input.event ??
    (input.completed ? "practice_correct" : "practice_attempted")
  await recordAnalyticsEvent({
    institutionId: ctx.institutionId,
    userId: ctx.studentId,
    userType: "student",
    courseId: ctx.courseId,
    eventType,
    feature: "practice_hub",
    assessmentId: input.attemptId,
    metadata: {
      score: input.score ?? null,
      correctCount: input.correctCount ?? null,
      totalQuestions: input.totalQuestions ?? null,
    },
  })
  if (input.completed) {
    await recordAnalyticsEvent({
      institutionId: ctx.institutionId,
      userId: ctx.studentId,
      userType: "student",
      courseId: ctx.courseId,
      eventType: "concept_mastery_updated",
      feature: "practice_hub",
      assessmentId: input.attemptId,
      metadata: { score: input.score ?? null },
    })
  }
}

export async function recordAssessmentAnalytics(input: {
  studentId: number
  attemptId: number
  quizId: number
  courseId?: number | null
  score?: number | null
  event?: "assessment_started" | "assessment_submitted"
}): Promise<void> {
  const ctx = await resolveStudentInstitutionContext(input.studentId, input.courseId)
  if (!ctx) return
  await recordAnalyticsEvent({
    institutionId: ctx.institutionId,
    userId: ctx.studentId,
    userType: "student",
    courseId: ctx.courseId,
    eventType: input.event ?? "assessment_submitted",
    feature: "assessment",
    assessmentId: input.quizId,
    metadata: {
      attemptId: input.attemptId,
      score: input.score ?? null,
    },
  })
}

export async function recordFeedbackAnalytics(input: {
  studentId: number
  attemptId: number
  quizId: number
  courseId?: number | null
  aiGraded?: boolean
  event?: "feedback_generated" | "feedback_viewed"
}): Promise<void> {
  const ctx = await resolveStudentInstitutionContext(input.studentId, input.courseId)
  if (!ctx) return
  await recordAnalyticsEvent({
    institutionId: ctx.institutionId,
    userId: ctx.studentId,
    userType: "student",
    courseId: ctx.courseId,
    eventType: input.event ?? "feedback_generated",
    feature: "assessment",
    assessmentId: input.quizId,
    metadata: {
      attemptId: input.attemptId,
      aiGraded: Boolean(input.aiGraded),
    },
  })
}
