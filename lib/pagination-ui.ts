/** Common "per page" options for instructor project lists */
export const PROJECT_LIST_PAGE_SIZES = [10, 20, 30, 50, 100] as const
export type ProjectListPageSize = (typeof PROJECT_LIST_PAGE_SIZES)[number]

/**
 * 1-based page indices for UI (with "ellipsis" gaps). Keeps the control compact for large page counts.
 */
export function projectListPaginationItems(
  currentPage: number,
  totalPages: number
): (number | "ellipsis")[] {
  const total = Math.max(1, totalPages)
  const current = Math.min(Math.max(1, currentPage), total)
  if (total <= 9) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis", total]
  }
  if (current >= total - 3) {
    return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total]
  }
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total]
}
