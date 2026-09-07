import { sql } from "@/lib/db"
import { formatAcademicTermLabel, getActiveAcademicTerm } from "@/lib/active-academic-term"
import { mergeCourseModuleSettings } from "@/lib/course-module-settings"
import { normalizeCourseStaffRole } from "@/lib/roles"
import {
  type FacultyCourseOffering,
  offeringsToLegacyCourses,
} from "@/lib/faculty-course-offerings-shared"

export type { FacultyCourseOffering } from "@/lib/faculty-course-offerings-shared"
export {
  facultyOfferingKey,
  parseFacultyOfferingKey,
  groupFacultyOfferings,
  facultyOfferingChipCode,
  facultyOfferingPrimaryLabel,
  facultyOfferingShowsAsSection,
  offeringsToLegacyCourses,
} from "@/lib/faculty-course-offerings-shared"

import { parseExchangeProvenance } from "@/lib/course-exchange/provenance-shared"
import { courseUsesLabSections, defaultSessionCodeForCourse } from "@/lib/course-section-model"
import { courseRowMatchesUniversity } from "@/lib/instructor-university-scope"

async function expandOfferingsWithTermSections(
  offerings: FacultyCourseOffering[],
): Promise<FacultyCourseOffering[]> {
  const withTerm = offerings.filter((o) => o.academic_term_id != null)
  if (withTerm.length === 0) return offerings

  const courseIds = [...new Set(withTerm.map((o) => o.course_id))]
  const termIds = [...new Set(withTerm.map((o) => o.academic_term_id as number))]

  const sessionRows = (await sql`
    SELECT s.id, s.code, s.description, s.course_id, s.academic_term_id
    FROM sessions s
    WHERE s.course_id = ANY(${courseIds}::int[])
      AND s.academic_term_id = ANY(${termIds}::int[])
      AND TRIM(UPPER(s.code)) <> 'BETA'
    ORDER BY s.code ASC
  `) as {
    id: number
    code: string
    description: string | null
    course_id: number
    academic_term_id: number
  }[]

  const sessionsByOffering = new Map<string, typeof sessionRows>()
  for (const row of sessionRows) {
    const key = `${row.course_id}:${row.academic_term_id}`
    const list = sessionsByOffering.get(key) ?? []
    list.push(row)
    sessionsByOffering.set(key, list)
  }

  const singleRosterCourseIds = [
    ...new Set(
      offerings
        .filter((o) => !courseUsesLabSections(o.catalog_course_code ?? o.course_code))
        .map((o) => o.course_id),
    ),
  ]
  const canonicalSessionByCourse = new Map<number, (typeof sessionRows)[number]>()
  if (singleRosterCourseIds.length > 0) {
    const canonicalRows = (await sql`
      SELECT s.id, s.code, s.description, s.course_id, s.academic_term_id
      FROM sessions s
      WHERE s.course_id = ANY(${singleRosterCourseIds}::int[])
        AND TRIM(UPPER(s.code)) <> 'BETA'
      ORDER BY
        CASE WHEN s.academic_term_id IS NOT NULL THEN 0 ELSE 1 END,
        s.id ASC
    `) as typeof sessionRows
    for (const row of canonicalRows) {
      const catalog = offerings.find((o) => o.course_id === row.course_id)?.course_code
      const expected = defaultSessionCodeForCourse(catalog)
      if (expected && row.code.trim().toUpperCase() !== expected) continue
      if (!canonicalSessionByCourse.has(row.course_id)) {
        canonicalSessionByCourse.set(row.course_id, row)
      }
    }
  }

  const expanded: FacultyCourseOffering[] = []
  for (const offering of offerings) {
    if (offering.academic_term_id == null) {
      expanded.push(offering)
      continue
    }

    const sessions =
      sessionsByOffering.get(`${offering.course_id}:${offering.academic_term_id}`) ?? []

    if (!courseUsesLabSections(offering.course_code)) {
      const rosterSession =
        sessions[0] ?? canonicalSessionByCourse.get(offering.course_id)
      if (rosterSession) {
        expanded.push({
          ...offering,
          session_id: rosterSession.id,
          session_code: rosterSession.code,
          catalog_course_code: offering.course_code,
        })
      } else {
        expanded.push(offering)
      }
      continue
    }

    if (sessions.length === 0) {
      expanded.push(offering)
      continue
    }
    if (sessions.length === 1) {
      const session = sessions[0]
      expanded.push({
        ...offering,
        session_id: session.id,
        session_code: session.code,
        catalog_course_code: offering.course_code,
        course_code: session.code,
      })
      continue
    }
    for (const session of sessions) {
      expanded.push({
        ...offering,
        session_id: session.id,
        session_code: session.code,
        catalog_course_code: offering.course_code,
        course_code: session.code,
        course_title: offering.course_title,
      })
    }
  }
  return expanded
}

function filterOfferingsByUniversity(
  offerings: FacultyCourseOffering[],
  universityId: number | null | undefined,
): FacultyCourseOffering[] {
  if (universityId == null) return offerings
  return offerings.filter((o) =>
    courseRowMatchesUniversity(
      {
        course_code: o.catalog_course_code ?? o.course_code,
        university: o.university,
        university_id: o.university_id ?? null,
      },
      universityId,
    ),
  )
}

/** ECE2202 is one roster — do not list separate rows per historical academic term. */
function collapseSingleRosterOfferings(offerings: FacultyCourseOffering[]): FacultyCourseOffering[] {
  const singleByCourse = new Map<number, FacultyCourseOffering>()
  const singleByCatalogKey = new Map<string, FacultyCourseOffering>()
  const multiSection: FacultyCourseOffering[] = []

  for (const offering of offerings) {
    const catalog = offering.catalog_course_code ?? offering.course_code
    if (courseUsesLabSections(catalog)) {
      multiSection.push(offering)
      continue
    }

    const catalogKey = `${(offering.university ?? "").trim().toUpperCase()}::${catalog.trim().toUpperCase()}`
    const existingByCatalog = singleByCatalogKey.get(catalogKey)
    if (existingByCatalog) {
      if (offering.is_active_term && !existingByCatalog.is_active_term) {
        singleByCatalogKey.set(catalogKey, offering)
        singleByCourse.set(offering.course_id, offering)
      }
      continue
    }

    const existing = singleByCourse.get(offering.course_id)
    if (!existing) {
      singleByCourse.set(offering.course_id, offering)
      singleByCatalogKey.set(catalogKey, offering)
      continue
    }
    if (offering.is_active_term && !existing.is_active_term) {
      singleByCourse.set(offering.course_id, offering)
      singleByCatalogKey.set(catalogKey, offering)
      continue
    }
    if (offering.is_active_term === existing.is_active_term && offering.session_id && !existing.session_id) {
      singleByCourse.set(offering.course_id, offering)
      singleByCatalogKey.set(catalogKey, offering)
    }
  }

  const singles = [...singleByCatalogKey.values()]
  return [...multiSection, ...singles]
}

async function finalizeFacultyOfferings(
  offerings: FacultyCourseOffering[],
  universityId?: number | null,
): Promise<FacultyCourseOffering[]> {
  const expanded = await expandOfferingsWithTermSections(offerings)
  return filterOfferingsByUniversity(collapseSingleRosterOfferings(expanded), universityId)
}

export async function listFacultyCourseOfferings(
  actorId: number,
  universityId?: number | null,
): Promise<FacultyCourseOffering[]> {
  const activeTerm = await getActiveAcademicTerm()
  const activeTermId = activeTerm?.id ?? null

  const termLinked = await sql`
    SELECT
      c.id AS course_id,
      at.id AS academic_term_id,
      at.year AS term_year,
      at.term AS term_name,
      at.is_active AS term_is_active,
      c.course_code,
      c.course_title,
      c.university,
      c.university_id,
      c.module_settings,
      c.exchange_provenance,
      owner.name AS owner_name,
      COALESCE(cs.role, 'INSTRUCTOR') AS staff_role
    FROM course_staff cs
    INNER JOIN courses c ON c.id = cs.course_id
    INNER JOIN academic_term_courses atc ON atc.course_id = c.id
    INNER JOIN academic_terms at ON at.id = atc.academic_term_id
    LEFT JOIN instructors owner ON owner.id = c.instructor_id
    WHERE cs.instructor_id = ${actorId}
      AND cs.is_active = true
      AND c.is_active = true
    ORDER BY
      (at.id = ${activeTermId}) DESC,
      at.year DESC,
      CASE at.term
        WHEN 'Fall' THEN 1
        WHEN 'Winter' THEN 2
        WHEN 'Spring' THEN 3
        WHEN 'Summer' THEN 4
        ELSE 5
      END DESC,
      c.course_title ASC,
      c.id ASC
  `

  const offerings: FacultyCourseOffering[] = (termLinked as Record<string, unknown>[]).map((r) => {
    const year = Number(r.term_year)
    const termName = String(r.term_name)
    const termLabel = formatAcademicTermLabel(year, termName)
    const academicTermId = Number(r.academic_term_id)
    const courseId = Number(r.course_id)
    const isActiveTerm = activeTermId != null && academicTermId === activeTermId
    const rawRole = String(r.staff_role ?? "INSTRUCTOR")
    return {
      id: courseId,
      course_id: courseId,
      academic_term_id: academicTermId,
      term_label: termLabel,
      is_active_term: isActiveTerm,
      course_code: String(r.course_code),
      course_title: String(r.course_title),
      university: r.university != null ? String(r.university) : null,
      university_id:
        r.university_id != null && Number.isFinite(Number(r.university_id))
          ? Number(r.university_id)
          : null,
      semester: termLabel,
      staff_role: normalizeCourseStaffRole(rawRole) ?? rawRole,
      module_settings: mergeCourseModuleSettings(r.module_settings),
      owner_name: r.owner_name != null ? String(r.owner_name) : null,
      exchange_provenance: parseExchangeProvenance(r.exchange_provenance),
    }
  })

  if (offerings.length > 0) {
    return finalizeFacultyOfferings(offerings, universityId)
  }

  // Fallback: staff assignments without a term link yet
  const staffOnly = await sql`
    SELECT
      c.id AS course_id,
      c.course_code,
      c.course_title,
      c.university,
      c.university_id,
      c.semester,
      c.module_settings,
      c.exchange_provenance,
      owner.name AS owner_name,
      COALESCE(cs.role, 'INSTRUCTOR') AS staff_role
    FROM course_staff cs
    INNER JOIN courses c ON c.id = cs.course_id
    LEFT JOIN instructors owner ON owner.id = c.instructor_id
    WHERE cs.instructor_id = ${actorId}
      AND cs.is_active = true
      AND c.is_active = true
    ORDER BY c.course_title ASC, c.id ASC
  `

  if (staffOnly.length > 0) {
    return filterOfferingsByUniversity(
      (staffOnly as Record<string, unknown>[]).map((r) => {
        const courseId = Number(r.course_id)
        const semester = r.semester != null ? String(r.semester) : null
        const rawRole = String(r.staff_role ?? "INSTRUCTOR")
        return {
          id: courseId,
          course_id: courseId,
          academic_term_id: null,
          term_label: semester,
          is_active_term: false,
          course_code: String(r.course_code),
          course_title: String(r.course_title),
          university: r.university != null ? String(r.university) : null,
          university_id:
            r.university_id != null && Number.isFinite(Number(r.university_id))
              ? Number(r.university_id)
              : null,
          semester,
          staff_role: normalizeCourseStaffRole(rawRole) ?? rawRole,
          module_settings: mergeCourseModuleSettings(r.module_settings),
          owner_name: r.owner_name != null ? String(r.owner_name) : null,
          exchange_provenance: parseExchangeProvenance(r.exchange_provenance),
        }
      }),
      universityId,
    )
  }

  // Fallback: owned courses with no term link yet
  const owned = await sql`
    SELECT
      c.id AS course_id,
      c.course_code,
      c.course_title,
      c.university,
      c.university_id,
      c.semester,
      c.module_settings,
      c.exchange_provenance,
      owner.name AS owner_name,
      'INSTRUCTOR' AS staff_role
    FROM courses c
    LEFT JOIN instructors owner ON owner.id = c.instructor_id
    WHERE c.instructor_id = ${actorId}
      AND c.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM academic_term_courses atc WHERE atc.course_id = c.id
      )
    ORDER BY c.course_title ASC, c.id ASC
  `

  return filterOfferingsByUniversity(
    (owned as Record<string, unknown>[]).map((r) => {
      const courseId = Number(r.course_id)
      const semester = r.semester != null ? String(r.semester) : null
      return {
        id: courseId,
        course_id: courseId,
        academic_term_id: null,
        term_label: semester,
        is_active_term: false,
        course_code: String(r.course_code),
        course_title: String(r.course_title),
        university: r.university != null ? String(r.university) : null,
        university_id:
          r.university_id != null && Number.isFinite(Number(r.university_id))
            ? Number(r.university_id)
            : null,
        semester,
        staff_role: "INSTRUCTOR",
        module_settings: mergeCourseModuleSettings(r.module_settings),
        owner_name: r.owner_name != null ? String(r.owner_name) : null,
        exchange_provenance: parseExchangeProvenance(r.exchange_provenance),
      }
    }),
    universityId,
  )
}

export { offeringsToLegacyCourses as legacyCoursesFromOfferings }
