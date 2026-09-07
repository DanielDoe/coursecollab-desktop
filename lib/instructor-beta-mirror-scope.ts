/**
 * When true, instructor GET /students listing for "all sections" scoped to course X includes
 * beta / BETA-tagged learners tied to ANY session belonging to courses this instructor teaches,
 * so DEMO001 stays visible while switching owned courses during QA.
 *
 * Explicit opt-in/out: INSTRUCTOR_MIRROR_BETA_CROSS_COURSE=true|false (default mirrors in development).
 */
export function instructorMirrorBetaStudentsAcrossCourses(): boolean {
  const raw = process.env.INSTRUCTOR_MIRROR_BETA_CROSS_COURSE?.trim()?.toLowerCase()
  if (raw === "true" || raw === "1") return true
  if (raw === "false" || raw === "0") return false
  return process.env.NODE_ENV === "development"
}
