/** Matches instructor/faculty result detail URLs (not the list page). */
export const INSTRUCTOR_RESULT_DETAIL_PATH_RE =
  /\/(?:instructor\/(?:dashboard-v2\/)?|faculty\/dashboard\/)results\/[^/]+$/

export function isInstructorResultDetailPath(pathname?: string | null): boolean {
  return !!pathname?.match(INSTRUCTOR_RESULT_DETAIL_PATH_RE)
}

export function instructorResultsListPath(embedInDashboard?: boolean): string {
  return embedInDashboard ? "/faculty/dashboard/results" : "/instructor/results"
}

export function instructorResultDetailPath(
  attemptId: number | string,
  embedInDashboard?: boolean,
): string {
  const base = instructorResultsListPath(embedInDashboard)
  return `${base}/${attemptId}`
}
