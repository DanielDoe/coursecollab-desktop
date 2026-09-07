/** Course codes that use Lecture N instead of Week N in the UI. */
const ELEG130X_COURSE_CODES = new Set(["ELEG1301", "ELEG1304", "LEGACY"])

function normalizeCourseCode(courseCode?: string | null): string {
  return (courseCode ?? "").replace(/\s/g, "").toUpperCase()
}

/** ELEG1301P01 → 1301, ELEG1304P03 → 1304 for display titles. */
export function resolveElegCatalogDigits(
  courseCode?: string | null,
): "1301" | "1304" | null {
  const c = normalizeCourseCode(courseCode)
  if (c.startsWith("ELEG1301") || c.startsWith("E1301") || c === "LEGACY") return "1301"
  if (c.startsWith("ELEG1304") || c.startsWith("E1304")) return "1304"
  return null
}

/** Replace generic ELEG 130X prefix with the scoped catalog number (1301 / 1304). */
export function formatElegLectureDisplayTitle(
  title: string,
  courseCode?: string | null,
): string {
  const digits = resolveElegCatalogDigits(courseCode)
  if (!digits) return title
  return title
    .replace(/ELEG\s*130X/gi, `ELEG ${digits}`)
    .replace(/ELEG130X/gi, `ELEG${digits}`)
}

/** Stable key for deduping shared ELEG lecture rows (same week + same syllabus deck). */
export function normalizeLectureDedupeKey(title: string): string {
  return formatElegLectureDisplayTitle(title, null)
    .replace(/^ELEG\s*130X:\s*/i, "")
    .replace(/^ELEG\s*130[14]:\s*/i, "")
    .replace(/^Lecture\s+\d+\s*[—–-]\s*/i, "")
    .trim()
    .toLowerCase()
}

export type LectureRowLike = {
  id: number
  week: number
  title: string
  course_id?: number | null
  session?: string | null
}

/**
 * ELEG1301 / ELEG1304 share one content pool — the DB may contain duplicate rows per catalog course.
 * Keep one row per (week, logical title), preferring the instructor's selected course_id.
 */
export function dedupeElegSharedLectureRows<T extends LectureRowLike>(
  rows: T[],
  scopeCourseId: number,
  scopeSessionCode?: string | null,
): T[] {
  const byKey = new Map<string, T>()
  const sessionNeedle = String(scopeSessionCode ?? "")
    .trim()
    .toUpperCase()

  for (const row of rows) {
    const week = Number(row.week)
    const key = `${week}:${normalizeLectureDedupeKey(String(row.title ?? ""))}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, row)
      continue
    }

    const score = (r: T) => {
      let s = 0
      if (Number(r.course_id) === scopeCourseId) s += 4
      if (
        sessionNeedle &&
        String(r.session ?? "")
          .trim()
          .toUpperCase() === sessionNeedle
      ) {
        s += 2
      }
      return s
    }

    const rowScore = score(row)
    const existingScore = score(existing)
    if (rowScore > existingScore) {
      byKey.set(key, row)
    } else if (rowScore === existingScore && Number(row.id) < Number(existing.id)) {
      byKey.set(key, row)
    }
  }

  return [...byKey.values()].sort(
    (a, b) => Number(a.week) - Number(b.week) || Number(a.id) - Number(b.id),
  )
}

export function isEleg130xLectureCourse(courseCode?: string | null, title?: string | null): boolean {
  const code = normalizeCourseCode(courseCode)
  if (ELEG130X_COURSE_CODES.has(code)) return true
  return /^ELEG\s*130/i.test(title ?? "")
}

/**
 * Display label for the lectures.week sort index.
 * ELEG 130X uses lecture numbers; other courses (e.g. ECE 2202) keep Week N.
 */
export function formatLectureIndexLabel(
  index: number,
  options?: { courseCode?: string | null; title?: string | null },
): string {
  if (isEleg130xLectureCourse(options?.courseCode, options?.title)) {
    return `Lecture ${index}`
  }
  return `Week ${index}`
}

/** Shorter header form (e.g. mobile nav). */
export function formatLectureIndexShort(
  index: number,
  options?: { courseCode?: string | null; title?: string | null },
): string {
  if (isEleg130xLectureCourse(options?.courseCode, options?.title)) {
    return `L${index}`
  }
  return `W${index}`
}
