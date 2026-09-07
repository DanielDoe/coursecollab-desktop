import { getEffectiveCourseMeetingSchedules } from "@/lib/schedule-adjustment/schedule-source"

/** Single source of truth for the active instructional schedule. */
export async function getActiveCourseSchedule(
  courseId: number,
  sectionId?: number | null,
  asOfDate?: Date,
) {
  return getEffectiveCourseMeetingSchedules(courseId, sectionId, asOfDate)
}

export { getEffectiveCourseMeetingSchedules } from "@/lib/schedule-adjustment/schedule-source"
