import { sectionsAreAliasEquivalent } from "@/lib/session-code-aliases"
import type { ScheduleAdjustmentRequestRow } from "@/lib/schedule-adjustment/types"

/** True when a schedule adjustment belongs to the instructor/student section scope. */
export function scheduleRequestMatchesSectionScope(
  request: Pick<ScheduleAdjustmentRequestRow, "section_id" | "section_code">,
  scope: { sectionId?: number | null; sectionCode?: string | null },
): boolean {
  const scopeId =
    scope.sectionId != null && Number.isFinite(scope.sectionId) && scope.sectionId > 0
      ? Math.trunc(scope.sectionId)
      : null
  const scopeCode = String(scope.sectionCode ?? "").trim()

  if (scopeId != null && request.section_id != null) {
    return Math.trunc(Number(request.section_id)) === scopeId
  }

  if (scopeCode && request.section_code) {
    return sectionsAreAliasEquivalent(scopeCode, String(request.section_code))
  }

  // No section scope — show course-wide rows only when the request is also unscoped.
  if (!scopeId && !scopeCode) {
    return request.section_id == null && !String(request.section_code ?? "").trim()
  }

  return false
}

export function instructorCanAccessScheduleRequest(
  request: Pick<ScheduleAdjustmentRequestRow, "course_id" | "section_id" | "section_code">,
  courseId: number,
  sectionId?: number | null,
): boolean {
  if (request.course_id !== courseId) return false
  if (sectionId == null) return true
  return scheduleRequestMatchesSectionScope(request, { sectionId })
}
