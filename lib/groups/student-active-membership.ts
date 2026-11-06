import { sql } from "@/lib/db"

export type ActiveGroupMembership = {
  id: number
  name: string
  status: string
  course_id: number | null
}

/** Active (not deleted/rejected) group the student already belongs to. */
export async function findStudentActiveGroupMembership(
  studentId: number,
  opts?: { courseId?: number | null; excludeGroupId?: number | null },
): Promise<ActiveGroupMembership | null> {
  const sid = Number(studentId)
  if (!Number.isFinite(sid) || sid <= 0) return null

  const courseId =
    opts?.courseId != null && Number.isFinite(Number(opts.courseId)) && Number(opts.courseId) > 0
      ? Math.trunc(Number(opts.courseId))
      : null
  const excludeId =
    opts?.excludeGroupId != null && Number.isFinite(Number(opts.excludeGroupId))
      ? Math.trunc(Number(opts.excludeGroupId))
      : null

  const rows = (
    courseId != null
      ? excludeId != null
        ? await sql`
            SELECT g.id, g.name, g.status, g.course_id
            FROM group_members gm
            JOIN groups g ON g.id = gm.group_id
            WHERE gm.student_id = ${sid}
              AND g.deleted_at IS NULL
              AND g.status IN ('pending', 'approved', 'pending_update')
              AND g.course_id = ${courseId}
              AND g.id <> ${excludeId}
            LIMIT 1
          `
        : await sql`
            SELECT g.id, g.name, g.status, g.course_id
            FROM group_members gm
            JOIN groups g ON g.id = gm.group_id
            WHERE gm.student_id = ${sid}
              AND g.deleted_at IS NULL
              AND g.status IN ('pending', 'approved', 'pending_update')
              AND g.course_id = ${courseId}
            LIMIT 1
          `
      : excludeId != null
        ? await sql`
            SELECT g.id, g.name, g.status, g.course_id
            FROM group_members gm
            JOIN groups g ON g.id = gm.group_id
            WHERE gm.student_id = ${sid}
              AND g.deleted_at IS NULL
              AND g.status IN ('pending', 'approved', 'pending_update')
              AND g.id <> ${excludeId}
            LIMIT 1
          `
        : await sql`
            SELECT g.id, g.name, g.status, g.course_id
            FROM group_members gm
            JOIN groups g ON g.id = gm.group_id
            WHERE gm.student_id = ${sid}
              AND g.deleted_at IS NULL
              AND g.status IN ('pending', 'approved', 'pending_update')
            LIMIT 1
          `
  ) as ActiveGroupMembership[]

  return rows[0] ?? null
}

export function alreadyInGroupMessage(membership: ActiveGroupMembership): string {
  return `You're already in "${membership.name}". Leave or delete that group before joining another.`
}
