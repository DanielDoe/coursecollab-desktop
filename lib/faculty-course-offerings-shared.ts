import { courseUsesLabSections } from "@/lib/course-section-model"

export type FacultyCourseOffering = {
  /** Course id (same as course_id). */
  id: number
  course_id: number
  academic_term_id: number | null
  term_label: string | null
  is_active_term: boolean
  course_code: string
  course_title: string
  university: string | null
  university_id?: number | null
  semester: string | null
  staff_role: string
  module_settings?: Record<string, unknown>
  /** When a term offering has lab sections, one row per section in the course switcher. */
  session_id?: number | null
  session_code?: string | null
  /** Umbrella catalog code (ELEG1301) when course_code is the section code for display. */
  catalog_course_code?: string | null
  /** Current course owner / variant editor (for inherited exchange copies). */
  owner_name?: string | null
  /** Set when this course was created via Course Exchange import. */
  exchange_provenance?: {
    sourceInstructorName: string
    sourceCourseCode: string
    sourceCourseTitle: string
    sourceTermLabel?: string | null
    destinationInstructorName?: string | null
    copiedAt: string
    requestId: number
  } | null
}

export function facultyOfferingKey(
  courseId: number,
  academicTermId: number | null,
  sessionId?: number | null,
): string {
  const base = `${courseId}:${academicTermId ?? 0}`
  if (sessionId != null && Number.isFinite(sessionId) && sessionId > 0) {
    return `${base}:${sessionId}`
  }
  return base
}

export function parseFacultyOfferingKey(key: string): {
  courseId: number
  academicTermId: number | null
  sessionId: number | null
} {
  const parts = key.split(":")
  const courseId = Number(parts[0])
  const termNum = Number(parts[1])
  const sessionNum = parts.length > 2 ? Number(parts[2]) : NaN
  return {
    courseId,
    academicTermId: Number.isFinite(termNum) && termNum > 0 ? termNum : null,
    sessionId: Number.isFinite(sessionNum) && sessionNum > 0 ? sessionNum : null,
  }
}

/** True when the switcher should show a lab section code instead of the umbrella course. */
export function facultyOfferingShowsAsSection(o: FacultyCourseOffering): boolean {
  const catalog = o.catalog_course_code ?? o.course_code
  if (o.session_id && o.session_code && o.course_code !== catalog) return true
  return Boolean(
    o.session_id &&
      o.session_code &&
      courseUsesLabSections(catalog) &&
      o.session_code.trim().toUpperCase() !== catalog.trim().toUpperCase(),
  )
}

export function facultyOfferingPrimaryLabel(o: FacultyCourseOffering): string {
  if (facultyOfferingShowsAsSection(o)) {
    return o.session_code ?? o.course_code
  }
  return o.course_title
}

export function facultyOfferingChipCode(o: FacultyCourseOffering): string {
  if (facultyOfferingShowsAsSection(o)) {
    return o.session_code ?? o.course_code
  }
  const catalog = o.catalog_course_code ?? o.course_code
  if (o.session_id && o.session_code && courseUsesLabSections(catalog)) {
    return o.session_code
  }
  return catalog
}

/** Group offerings for select UI: active term first, then all other terms. */
export function groupFacultyOfferings(offerings: FacultyCourseOffering[]): {
  activeTermLabel: string | null
  active: FacultyCourseOffering[]
  other: FacultyCourseOffering[]
} {
  const active = offerings.filter((o) => o.is_active_term)
  const other = offerings.filter((o) => !o.is_active_term)
  const activeTermLabel = active[0]?.term_label ?? null
  return { activeTermLabel, active, other }
}

/** Dedupe offerings into legacy flat course rows (one row per course, prefer active term). */
export function offeringsToLegacyCourses(offerings: FacultyCourseOffering[]): FacultyCourseOffering[] {
  const byCourse = new Map<number, FacultyCourseOffering>()
  for (const o of offerings) {
    const existing = byCourse.get(o.course_id)
    if (!existing || (o.is_active_term && !existing.is_active_term)) {
      byCourse.set(o.course_id, o)
    }
  }
  return [...byCourse.values()].sort((a, b) => a.course_title.localeCompare(b.course_title))
}
