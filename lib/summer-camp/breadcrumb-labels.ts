/** Curriculum lesson index from title, e.g. "Module 0 — Welcome" → 0 */
export function campLessonNumberFromTitle(title: string): number | null {
  const match = title.trim().match(/^Module\s+(\d+)/i)
  return match ? Number(match[1]) : null
}

/** Breadcrumb label — never shows raw database ids. */
export function campModuleBreadcrumbLabel(
  title: string | null | undefined,
  sortOrder?: number | null,
): string {
  if (title) {
    const num = campLessonNumberFromTitle(title)
    if (num !== null) return `Lesson ${num}`
  }
  if (sortOrder != null && Number.isFinite(sortOrder)) {
    return `Lesson ${sortOrder}`
  }
  return "Lesson"
}

/** @deprecated Use campModuleBreadcrumbLabel */
export function shortCampModuleBreadcrumb(title: string): string {
  return campModuleBreadcrumbLabel(title)
}

export function shortCampTrainingBreadcrumb(title: string): string {
  const t = title.trim()
  if (t.length > 28) return `${t.slice(0, 27)}…`
  return t
}
