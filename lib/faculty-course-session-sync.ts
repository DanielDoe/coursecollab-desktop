import type { PortalKind } from "@/lib/portal-config"

import { getPortalConfig } from "@/lib/portal-config"

import {

  facultyOfferingKey,

  parseFacultyOfferingKey,

  type FacultyCourseOffering,

} from "@/lib/faculty-course-offerings-shared"



export type FacultyCourseOption = FacultyCourseOffering



type SessionRecord = Record<string, unknown>



export function isFacultyCourseScopeSkipped(session: SessionRecord): boolean {

  return session.courseScopeSkipped === true

}



/** Enter dashboard without a scoped course (create courses later from My Courses). */

export function applyFacultySkipCourseScope(session: SessionRecord): SessionRecord {

  const next = { ...session }

  delete next.selectedCourseId

  delete next.selectedCourseCode

  delete next.selectedCourseTitle

  delete next.selectedCatalogCourseCode

  delete next.selectedSessionId

  delete next.selectedSessionCode

  delete next.selectedAcademicTermId

  delete next.selectedTermLabel

  delete next.coursePermissions

  next.courseScopeSkipped = true

  return next

}



function clearFacultySkipCourseScope(session: SessionRecord): void {

  delete session.courseScopeSkipped

}



function sessionTermId(session: SessionRecord): number | null {

  const raw = session.selectedAcademicTermId

  if (raw == null || String(raw).trim() === "") return null

  const n = Number(raw)

  return Number.isFinite(n) && n > 0 ? n : null

}



function sessionScopeId(session: SessionRecord): number | null {

  const raw = session.selectedSessionId

  if (raw == null || String(raw).trim() === "") return null

  const n = Number(raw)

  return Number.isFinite(n) && n > 0 ? n : null

}



function applyOfferingToSession(next: SessionRecord, offering: FacultyCourseOption): void {

  clearFacultySkipCourseScope(next)

  next.selectedCourseId = offering.course_id

  next.selectedCourseCode = offering.catalog_course_code ?? offering.course_code

  next.selectedCourseTitle = offering.course_title

  next.selectedCatalogCourseCode = offering.catalog_course_code ?? offering.course_code

  next.staffRoleForCourse = offering.staff_role ?? "INSTRUCTOR"

  if (offering.session_id != null) {

    next.selectedSessionId = offering.session_id

    next.selectedSessionCode = offering.session_code ?? offering.course_code

  } else {

    delete next.selectedSessionId

    delete next.selectedSessionCode

  }

  if (offering.academic_term_id != null) {

    next.selectedAcademicTermId = offering.academic_term_id

    next.selectedTermLabel = offering.term_label

  } else {

    delete next.selectedAcademicTermId

    delete next.selectedTermLabel

  }

}



function offeringKeyFor(o: FacultyCourseOption): string {

  return facultyOfferingKey(o.course_id, o.academic_term_id, o.session_id ?? null)

}



function findOfferingMatch(

  courses: FacultyCourseOption[],

  courseId: number,

  termId: number | null,

  sessionId: number | null,

): FacultyCourseOption | undefined {

  if (sessionId != null) {

    const exactSession = courses.find(

      (c) =>

        c.course_id === courseId &&

        (c.academic_term_id ?? null) === termId &&

        c.session_id === sessionId,

    )

    if (exactSession) return exactSession

    const bySessionSameCourse = courses.find(
      (c) =>
        c.course_id === courseId &&
        c.session_id === sessionId &&
        (c.academic_term_id ?? null) === termId,
    )
    if (bySessionSameCourse) return bySessionSameCourse

  }

  if (termId != null) {

    const exact = courses.find((c) => c.course_id === courseId && c.academic_term_id === termId)

    if (exact) return exact

  }

  const sameCourse = courses.filter((c) => c.course_id === courseId)

  if (sameCourse.length === 1) return sameCourse[0]

  if (sameCourse.length > 1) {
    if (sessionId != null) {
      const bySessionOnly = sameCourse.find((c) => c.session_id === sessionId)
      if (bySessionOnly) return bySessionOnly
    }
    return sameCourse.find((c) => c.is_active_term) ?? sameCourse[0]
  }

  return undefined
}



/** Keep localStorage course scope aligned with server-side TA assignments. */

export function reconcileFacultySelectedCourse(

  session: SessionRecord,

  courses: FacultyCourseOption[],

): { session: SessionRecord; changed: boolean; valid: boolean } {

  const next = { ...session }

  let changed = false

  const selectedId = next.selectedCourseId

  const selectedNum =

    selectedId != null && String(selectedId).trim() !== "" ? Number(selectedId) : NaN

  const termId = sessionTermId(next)

  const scopeSessionId = sessionScopeId(next)



  if (courses.length === 0) {

    const skipped = applyFacultySkipCourseScope(next)

    const changedSkip =

      skipped.courseScopeSkipped !== next.courseScopeSkipped ||

      skipped.selectedCourseId !== next.selectedCourseId

    return { session: skipped, changed: changedSkip, valid: true }

  }



  if (!Number.isFinite(selectedNum)) {

    if (courses.length === 1) {

      applyOfferingToSession(next, courses[0])

      changed = true

      return { session: next, changed, valid: true }

    }

    if (isFacultyCourseScopeSkipped(next)) {

      return { session: next, changed: false, valid: true }

    }

    return { session: next, changed, valid: false }

  }



  const match = findOfferingMatch(courses, selectedNum, termId, scopeSessionId)

  if (match) {

    const before = JSON.stringify({

      code: next.selectedCourseCode,

      title: next.selectedCourseTitle,

      role: next.staffRoleForCourse,

      term: next.selectedAcademicTermId,

      label: next.selectedTermLabel,

      sessionId: next.selectedSessionId,

      sessionCode: next.selectedSessionCode,

    })

    applyOfferingToSession(next, match)

    const after = JSON.stringify({

      code: next.selectedCourseCode,

      title: next.selectedCourseTitle,

      role: next.staffRoleForCourse,

      term: next.selectedAcademicTermId,

      label: next.selectedTermLabel,

      sessionId: next.selectedSessionId,

      sessionCode: next.selectedSessionCode,

    })

    if (before !== after) changed = true

    return { session: next, changed, valid: true }

  }



  if (courses.length === 1) {

    applyOfferingToSession(next, courses[0])

    changed = true

    return { session: next, changed, valid: true }

  }



  if (isFacultyCourseScopeSkipped(next)) {

    delete next.selectedCourseId

    delete next.selectedCourseCode

    delete next.selectedCourseTitle

    delete next.selectedCatalogCourseCode

    delete next.selectedSessionId

    delete next.selectedSessionCode

    delete next.selectedAcademicTermId

    delete next.selectedTermLabel

    delete next.coursePermissions

    changed = true

    return { session: next, changed, valid: true }

  }



  delete next.selectedCourseId

  delete next.selectedCourseCode

  delete next.selectedCourseTitle

  delete next.selectedCatalogCourseCode

  delete next.selectedSessionId

  delete next.selectedSessionCode

  delete next.selectedAcademicTermId

  delete next.selectedTermLabel

  delete next.coursePermissions

  changed = true

  return { session: next, changed, valid: false }

}



export function facultyCourseSelectValue(session: SessionRecord): string {

  const courseId = session.selectedCourseId

  if (courseId == null || String(courseId).trim() === "") return ""

  return facultyOfferingKey(Number(courseId), sessionTermId(session), sessionScopeId(session))

}



export { facultyOfferingKey, parseFacultyOfferingKey }



export async function fetchFacultyCourseOfferings(

  portal: PortalKind = "faculty",

): Promise<{

  offerings: FacultyCourseOption[]

  activeTerm: { id: number; label: string } | null

}> {

  const portalCfg = getPortalConfig(portal === "instructor" ? "faculty" : portal)

  const actorId = localStorage.getItem(portalCfg.idStorageKey)

  if (!actorId) return { offerings: [], activeTerm: null }

  const res = await fetch(`${portalCfg.apiPrefix}/courses`, {

    headers: { [portalCfg.idHeader]: actorId },

  })

  if (!res.ok) return { offerings: [], activeTerm: null }

  const data = (await res.json()) as {

    offerings?: FacultyCourseOption[]

    courses?: FacultyCourseOption[]

    activeTerm?: { id: number; label: string } | null

  }

  return {

    offerings: data.offerings ?? data.courses ?? [],

    activeTerm: data.activeTerm ?? null,

  }

}



/** @deprecated Use fetchFacultyCourseOfferings */

export async function fetchFacultyCourseOptions(

  portal: PortalKind = "faculty",

): Promise<FacultyCourseOption[]> {

  const { offerings } = await fetchFacultyCourseOfferings(portal)

  return offerings

}



export { offeringKeyFor as facultyOfferingSelectKey }

