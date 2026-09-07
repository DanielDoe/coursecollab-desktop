import { sql } from "@/lib/db"
import { ensureCourseStaffRow } from "@/lib/course-staff-sync"
import { ensurePortalRbacSchema } from "@/lib/ensure-portal-rbac-schema"
import {
  ensurePortalRbacSeed,
  repairPortalRbacSeedIfNeeded,
} from "@/lib/ensure-portal-rbac-seed"

/** Seed RBAC catalog and assign INSTRUCTOR course_staff for one course. */
export async function provisionFacultyInstructorCourseAccess(
  instructorId: number,
  courseId: number,
  assignedBy?: number | null,
): Promise<number | null> {
  await ensurePortalRbacSchema()
  await ensurePortalRbacSeed()
  return ensureCourseStaffRow(courseId, instructorId, "INSTRUCTOR", assignedBy ?? null)
}

/** Ensure every owned active course has an INSTRUCTOR course_staff row. */
export async function provisionFacultyOwnedCourses(instructorId: number): Promise<number> {
  await ensurePortalRbacSchema()
  await repairPortalRbacSeedIfNeeded()
  await ensurePortalRbacSeed()

  const owned = (await sql`
    SELECT id FROM courses
    WHERE instructor_id = ${instructorId} AND is_active = true
  `) as { id: number }[]

  let count = 0
  for (const row of owned) {
    await ensureCourseStaffRow(row.id, instructorId, "INSTRUCTOR", instructorId)
    count++
  }
  return count
}

/** Full faculty onboarding: RBAC catalog + INSTRUCTOR rows on owned courses. */
export async function provisionFacultyTeachingAccess(instructorId: number): Promise<void> {
  await ensurePortalRbacSchema()
  await repairPortalRbacSeedIfNeeded()
  await ensurePortalRbacSeed()
  await provisionFacultyOwnedCourses(instructorId)
}
