/** Fallback when no course policy is loaded (legacy default). */
export const CLASSROOM_POINTS_FOR_FULL_GRADE = 200

/** Raw points per 0.1 of the classroom grade display (10 tenths), for a given full-grade cap. */
export function classroomRawPointsPerGradeTenth(
  pointsForFullGrade: number = CLASSROOM_POINTS_FOR_FULL_GRADE,
): number {
  const cap = Math.max(1, Number(pointsForFullGrade) || CLASSROOM_POINTS_FOR_FULL_GRADE)
  return cap / 10
}

/** @deprecated Prefer {@link classroomRawPointsPerGradeTenth} with course policy. */
export const CLASSROOM_RAW_POINTS_PER_GRADE_TENTH =
  CLASSROOM_POINTS_FOR_FULL_GRADE / 10

/** 0–10 course-grade points for the classroom category (10 = full slice). */
export function classroomRawPointsToGradePoints10(
  raw: number,
  pointsForFullGrade: number = CLASSROOM_POINTS_FOR_FULL_GRADE,
): number {
  const r = Number(raw) || 0
  const perTenth = classroomRawPointsPerGradeTenth(pointsForFullGrade)
  return Math.min(r / perTenth, 10)
}

/**
 * Maps the classroom **10-point course slice** to Canvas’s assignment column (0–100).
 * Full 10 pts → 100%; 5 pts → 50%. Same scale as other Canvas extra columns (100 = max).
 */
export function classroomTenPointSliceToCanvasPercent(gradePointsOutOf10: number): number {
  const g = Math.max(0, Number(gradePointsOutOf10) || 0)
  return Math.min((g / 10) * 100, 100)
}

/**
 * 0–100 LMS / Canvas column % from **raw** classroom points.
 * Equivalent to: raw → {@link classroomRawPointsToGradePoints10} → {@link classroomTenPointSliceToCanvasPercent}.
 */
export function classroomRawPointsToCanvasPercent(
  raw: number,
  pointsForFullGrade: number = CLASSROOM_POINTS_FOR_FULL_GRADE,
): number {
  return classroomTenPointSliceToCanvasPercent(
    classroomRawPointsToGradePoints10(raw, pointsForFullGrade),
  )
}
