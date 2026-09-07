import { sql } from "@/lib/db"
import {
  normalizeCoraCourseRoutingPolicy,
  type CoraCourseRoutingPolicy,
} from "@/lib/cora/models/course-policy"

/** Load faculty course routing policy. Never trust a client-supplied model id. */
export async function loadCoraCourseRoutingPolicy(opts: {
  courseId?: number | null
  instructorId?: string | number | null
}): Promise<CoraCourseRoutingPolicy> {
  const courseId = opts.courseId != null && Number.isFinite(Number(opts.courseId))
    ? Number(opts.courseId)
    : null
  const instructorId = opts.instructorId != null ? String(opts.instructorId).trim() : ""
  if (courseId == null && !instructorId) return "auto"

  try {
    const rows =
      courseId != null && instructorId
        ? await sql`
            SELECT ai_model
            FROM ai_tutor_settings
            WHERE instructor_id = ${instructorId} AND course_id = ${courseId}
            LIMIT 1
          `
        : courseId != null
          ? await sql`
              SELECT ai_model
              FROM ai_tutor_settings
              WHERE course_id = ${courseId}
              ORDER BY updated_at DESC NULLS LAST
              LIMIT 1
            `
          : await sql`
              SELECT ai_model
              FROM ai_tutor_settings
              WHERE instructor_id = ${instructorId}
              ORDER BY updated_at DESC NULLS LAST
              LIMIT 1
            `
    const raw = (rows[0] as { ai_model?: string } | undefined)?.ai_model
    return normalizeCoraCourseRoutingPolicy(raw)
  } catch {
    return "auto"
  }
}
