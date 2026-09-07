import bcrypt from "bcryptjs"
import { getSQL } from "@/lib/db"
import { requireActiveCourse } from "@/lib/instructor-course-scope"
import { getStudentRosterDefaultPassword } from "@/lib/student-roster-default-password"
import { getEffectiveMembershipTier, getPlaygroundCredits } from "@/lib/membership"
import { getUniversityById } from "@/lib/universities"
import { resolveAccountAccessState } from "@/lib/access-governance/login-state"
import { studentLoginNotFoundPayload } from "@/lib/student-login-errors"
import { resolveSessionForCourseLogin } from "@/lib/student-login-session"
import { getActiveAcademicTerm } from "@/lib/active-academic-term"

export type StudentEnrollmentOption = {
  courseId: number
  courseCode: string
  courseTitle: string
  section: string
  sessionId: number | null
  studentRowId: number
}

export type UniversityStudentLoginResult =
  | {
      ok: true
      student: Record<string, unknown>
      effectiveMembershipTier: string
      hasApprovedResetRequest: boolean
      resetRequestId: number | null
      trialActivated: boolean
      enrollments: StudentEnrollmentOption[]
      selectedEnrollment: StudentEnrollmentOption
    }
  | {
      ok: false
      status: number
      error: string
      lifecycle?: string
      accountType?: string
      request?: Record<string, unknown>
      rejectionReason?: string | null
      requiresAccessRequest?: boolean
      message?: string
    }
  | {
      ok: true
      requiresCourseSelection: true
      enrollments: StudentEnrollmentOption[]
      studentPreview: { fullName: string; studentId: string }
    }

function loginIdentifierVariantsForSql(rawInput: string) {
  const idInput = String(rawInput ?? "").trim()
  if (!idInput) return { idEquals: [] as string[], sisLoginLower: "", emailLocalLower: "" }
  const idEquals = new Set<string>([idInput])
  const pDigits = idInput.match(/^p(\d+)$/i)
  if (pDigits) idEquals.add(pDigits[1])
  const sisLoginLower = idInput.toLowerCase()
  const emailLocalLower = idInput.includes("@") ? idInput.split("@")[0]?.trim().toLowerCase() ?? "" : ""
  if (emailLocalLower) idEquals.add(emailLocalLower)
  return { idEquals: [...idEquals], sisLoginLower, emailLocalLower }
}

function loginIdentifierVariants(rawInput: string) {
  return loginIdentifierVariantsForSql(rawInput)
}

/** Find student rows at a university matching login identifier (ID, SIS, or email). */
export async function findStudentEnrollmentsAtUniversity(
  universityId: number,
  rawInput: string,
): Promise<StudentEnrollmentOption[]> {
  const sql = getSQL()
  const idInput = String(rawInput ?? "").trim()
  if (!idInput) return []

  const activeTerm = await getActiveAcademicTerm()
  const activeTermId = activeTerm?.id ?? null

  if (idInput === "DEMO001") {
    const demoRows = await sql`
      SELECT s.id AS student_row_id, s.student_id, s.full_name, s.section, s.session_id,
             c.id AS course_id, c.course_code, c.course_title
      FROM students s
      INNER JOIN courses c ON c.id = s.course_id
      WHERE s.student_id = 'DEMO001'
        AND s.deleted_at IS NULL
        AND c.is_active = true
        AND (c.university_id = ${universityId} OR c.university_id IS NULL)
      LIMIT 5
    `
    return mapEnrollmentRows(demoRows as unknown[])
  }

  const { idEquals, sisLoginLower, emailLocalLower } = loginIdentifierVariants(idInput)
  if (idEquals.length === 0 && !sisLoginLower) return []

  const rows = activeTermId
    ? await sql`
        SELECT s.id AS student_row_id, s.student_id, s.full_name, s.section, s.session_id,
               c.id AS course_id, c.course_code, c.course_title
        FROM students s
        INNER JOIN courses c ON c.id = s.course_id
        WHERE s.deleted_at IS NULL
          AND c.is_active = true
          AND (c.university_id = ${universityId} OR (c.university_id IS NULL AND s.university_id = ${universityId}))
          AND (
            TRIM(s.student_id::text) = ANY(${idEquals}::text[])
            OR TRIM(COALESCE(s.sis_user_id::text, '')) = ANY(${idEquals}::text[])
            OR (
              NULLIF(TRIM(LOWER(COALESCE(s.sis_login_id, ''))), '') IS NOT NULL
              AND (
                TRIM(LOWER(COALESCE(s.sis_login_id, ''))) = ${sisLoginLower}
                OR (${emailLocalLower} <> '' AND TRIM(LOWER(COALESCE(s.sis_login_id, ''))) = ${emailLocalLower})
              )
            )
            OR (
              NULLIF(TRIM(LOWER(COALESCE(s.email, ''))), '') IS NOT NULL
              AND TRIM(LOWER(COALESCE(s.email, ''))) = ${sisLoginLower}
            )
          )
        ORDER BY
          CASE WHEN EXISTS (
            SELECT 1 FROM academic_term_courses atc
            WHERE atc.course_id = c.id AND atc.academic_term_id = ${activeTermId}
          ) THEN 0 ELSE 1 END,
          c.course_title ASC,
          c.id ASC
      `
    : await sql`
        SELECT s.id AS student_row_id, s.student_id, s.full_name, s.section, s.session_id,
               c.id AS course_id, c.course_code, c.course_title
        FROM students s
        INNER JOIN courses c ON c.id = s.course_id
        WHERE s.deleted_at IS NULL
          AND c.is_active = true
          AND (c.university_id = ${universityId} OR (c.university_id IS NULL AND s.university_id = ${universityId}))
          AND (
            TRIM(s.student_id::text) = ANY(${idEquals}::text[])
            OR TRIM(COALESCE(s.sis_user_id::text, '')) = ANY(${idEquals}::text[])
            OR (
              NULLIF(TRIM(LOWER(COALESCE(s.sis_login_id, ''))), '') IS NOT NULL
              AND (
                TRIM(LOWER(COALESCE(s.sis_login_id, ''))) = ${sisLoginLower}
                OR (${emailLocalLower} <> '' AND TRIM(LOWER(COALESCE(s.sis_login_id, ''))) = ${emailLocalLower})
              )
            )
            OR (
              NULLIF(TRIM(LOWER(COALESCE(s.email, ''))), '') IS NOT NULL
              AND TRIM(LOWER(COALESCE(s.email, ''))) = ${sisLoginLower}
            )
          )
        ORDER BY c.course_title ASC, c.id ASC
      `

  return mapEnrollmentRows(rows as unknown[])
}

/** If the student exists at a different university, return it for a helpful login error. */
async function findStudentUniversityMismatch(
  selectedUniversityId: number,
  rawInput: string,
): Promise<{ id: number; name: string; short_name: string } | null> {
  const sql = getSQL()
  const idInput = String(rawInput ?? "").trim()
  if (!idInput) return null

  const activeTerm = await getActiveAcademicTerm()
  const activeTermId = activeTerm?.id ?? null

  const { idEquals, sisLoginLower, emailLocalLower } = loginIdentifierVariants(idInput)

  const rows = (activeTermId
    ? await sql`
        SELECT u.id, u.name, u.short_name
        FROM students s
        INNER JOIN courses c ON c.id = s.course_id
        INNER JOIN universities u ON u.id = COALESCE(c.university_id, s.university_id)
        WHERE s.deleted_at IS NULL
          AND c.is_active = true
          AND u.id IS NOT NULL
          AND u.id <> ${selectedUniversityId}
          AND (
            TRIM(s.student_id::text) = ANY(${idEquals}::text[])
            OR TRIM(COALESCE(s.sis_user_id::text, '')) = ANY(${idEquals}::text[])
            OR (
              NULLIF(TRIM(LOWER(COALESCE(s.sis_login_id, ''))), '') IS NOT NULL
              AND (
                TRIM(LOWER(COALESCE(s.sis_login_id, ''))) = ${sisLoginLower}
                OR (${emailLocalLower} <> '' AND TRIM(LOWER(COALESCE(s.sis_login_id, ''))) = ${emailLocalLower})
              )
            )
            OR (
              NULLIF(TRIM(LOWER(COALESCE(s.email, ''))), '') IS NOT NULL
              AND TRIM(LOWER(COALESCE(s.email, ''))) = ${sisLoginLower}
            )
          )
        GROUP BY u.id, u.name, u.short_name
        ORDER BY MIN(CASE WHEN EXISTS (
          SELECT 1 FROM academic_term_courses atc
          WHERE atc.course_id = c.id AND atc.academic_term_id = ${activeTermId}
        ) THEN 0 ELSE 1 END)
        LIMIT 1
      `
    : await sql`
        SELECT DISTINCT u.id, u.name, u.short_name
        FROM students s
        INNER JOIN courses c ON c.id = s.course_id
        INNER JOIN universities u ON u.id = COALESCE(c.university_id, s.university_id)
        WHERE s.deleted_at IS NULL
          AND c.is_active = true
          AND u.id IS NOT NULL
          AND u.id <> ${selectedUniversityId}
          AND (
            TRIM(s.student_id::text) = ANY(${idEquals}::text[])
            OR TRIM(COALESCE(s.sis_user_id::text, '')) = ANY(${idEquals}::text[])
            OR (
              NULLIF(TRIM(LOWER(COALESCE(s.sis_login_id, ''))), '') IS NOT NULL
              AND (
                TRIM(LOWER(COALESCE(s.sis_login_id, ''))) = ${sisLoginLower}
                OR (${emailLocalLower} <> '' AND TRIM(LOWER(COALESCE(s.sis_login_id, ''))) = ${emailLocalLower})
              )
            )
            OR (
              NULLIF(TRIM(LOWER(COALESCE(s.email, ''))), '') IS NOT NULL
              AND TRIM(LOWER(COALESCE(s.email, ''))) = ${sisLoginLower}
            )
          )
        LIMIT 1
      `) as { id: number; name: string; short_name: string }[]

  return rows[0] ?? null
}

function mapEnrollmentRows(rows: unknown[]): StudentEnrollmentOption[] {
  return (rows as Record<string, unknown>[]).map((r) => ({
    courseId: Number(r.course_id),
    courseCode: String(r.course_code ?? ""),
    courseTitle: String(r.course_title ?? ""),
    section: String(r.section ?? ""),
    sessionId: r.session_id != null ? Number(r.session_id) : null,
    studentRowId: Number(r.student_row_id),
  }))
}

/** University-first student login — auto-resolves course from roster enrollment. */
export async function authenticateStudentAtUniversity(params: {
  universityId: number
  identifier: string
  password: string
  courseId?: number | null
  section?: string | null
  rememberMe?: boolean
}): Promise<UniversityStudentLoginResult> {
  const { universityId, identifier, password, courseId: requestedCourseId, section: requestedSection } = params
  const idInput = String(identifier ?? "").trim()

  if (!idInput || !password) {
    return { ok: false, status: 400, error: "Student ID or email and password are required." }
  }

  const university = await getUniversityById(universityId)
  if (!university) {
    return { ok: false, status: 400, error: "Invalid university." }
  }

  const enrollments = await findStudentEnrollmentsAtUniversity(universityId, idInput)
  if (enrollments.length === 0) {
    const otherUni = await findStudentUniversityMismatch(universityId, idInput)
    if (otherUni) {
      return {
        ok: false,
        status: 403,
        error: `Your account is registered at ${otherUni.name}. Go back and select ${otherUni.short_name}, then sign in again.`,
      }
    }

    const access = await resolveAccountAccessState({
      portal: "student",
      loginId: idInput,
      email: idInput.includes("@") ? idInput : null,
    })

    if (access.lifecycle === "pending_email_verification" || access.lifecycle === "pending_approval") {
      return {
        ok: false,
        status: 403,
        error:
          access.lifecycle === "pending_email_verification"
            ? "Verify your email to continue. Check your inbox for the verification link."
            : "Access request pending",
        lifecycle: access.lifecycle,
        accountType: access.accountType,
        request: access.request,
      }
    }

    if (access.lifecycle === "rejected") {
      return {
        ok: false,
        status: 403,
        error: "Access request not approved",
        lifecycle: "rejected",
        rejectionReason: access.rejectionReason,
      }
    }

    return {
      ok: false,
      status: 403,
      ...studentLoginNotFoundPayload(),
    }
  }

  const sql = getSQL()
  const passwordInput = String(password ?? "").trim()
  if (!passwordInput) {
    return { ok: false, status: 400, error: "Student ID or email and password are required." }
  }

  let candidateEnrollments = enrollments
  if (requestedCourseId != null && Number.isFinite(requestedCourseId)) {
    candidateEnrollments = enrollments.filter((e) => e.courseId === requestedCourseId)
    const section = requestedSection?.trim()
    if (section) {
      const bySection = candidateEnrollments.filter((e) => e.section.trim() === section)
      if (bySection.length > 0) candidateEnrollments = bySection
    }
    if (candidateEnrollments.length === 0) {
      return { ok: false, status: 403, error: "You are not enrolled in the selected course." }
    }
  }

  const uniqueRowIds = [...new Set(candidateEnrollments.map((e) => e.studentRowId))]
  const studentRows = (await sql`
    SELECT * FROM students
    WHERE id = ANY(${uniqueRowIds}::int[])
      AND deleted_at IS NULL
  `) as Record<string, unknown>[]

  if (studentRows.length === 0) {
    return { ok: false, status: 401, error: "Invalid credentials. Check your student ID or email and password." }
  }

  async function rowPasswordMatches(row: Record<string, unknown>): Promise<boolean> {
    const canonicalStudentId = String(row.student_id ?? "")
    if (canonicalStudentId === "DEMO001" && passwordInput === "demo123") {
      let ok = await bcrypt.compare("demo123", String(row.password_hash ?? ""))
      if (!ok) {
        const demoPasswordHash = await bcrypt.hash("demo123", 10)
        await sql`UPDATE students SET password_hash = ${demoPasswordHash} WHERE student_id = 'DEMO001'`
        ok = true
      }
      return ok
    }

    if (await bcrypt.compare(passwordInput, String(row.password_hash ?? ""))) {
      return true
    }

    const rowEnrollments = candidateEnrollments.filter((e) => e.studentRowId === Number(row.id))
    for (const enrollment of rowEnrollments) {
      const defaultPassword = getStudentRosterDefaultPassword(enrollment.courseCode)
      if (passwordInput === defaultPassword) {
        const passwordHash = await bcrypt.hash(defaultPassword, 10)
        await sql`UPDATE students SET password_hash = ${passwordHash} WHERE id = ${Number(row.id)}`
        return true
      }
    }
    return false
  }

  const matchedRows: Record<string, unknown>[] = []
  for (const row of studentRows) {
    if (await rowPasswordMatches(row)) matchedRows.push(row)
  }

  if (matchedRows.length === 0) {
    return { ok: false, status: 401, error: "Invalid credentials. Check your student ID or email and password." }
  }

  const matchedRowIds = new Set(matchedRows.map((row) => Number(row.id)))
  const matchedEnrollments = candidateEnrollments.filter((e) => matchedRowIds.has(e.studentRowId))

  // Email (or other identifier) matched multiple roster rows — let the student pick a course.
  if (matchedEnrollments.length > 1 && (requestedCourseId == null || !Number.isFinite(requestedCourseId))) {
    const first = matchedRows[0]
    return {
      ok: true,
      requiresCourseSelection: true,
      enrollments: matchedEnrollments,
      studentPreview: {
        fullName: String(first?.full_name ?? ""),
        studentId: String(first?.student_id ?? ""),
      },
    }
  }

  const requestedSectionTrimmed = requestedSection?.trim()
  const targetEnrollment =
    matchedEnrollments.find(
      (e) =>
        e.courseId === requestedCourseId &&
        (!requestedSectionTrimmed || e.section.trim() === requestedSectionTrimmed),
    ) ?? matchedEnrollments[0]
  if (!targetEnrollment) {
    return { ok: false, status: 403, error: "You are not enrolled in the selected course." }
  }

  const row =
    matchedRows.find((candidate) => Number(candidate.id) === targetEnrollment.studentRowId) ?? matchedRows[0]
  if (!row) {
    return { ok: false, status: 401, error: "Invalid credentials. Check your student ID or email and password." }
  }
  const canonicalStudentId = String(row.student_id ?? "")

  const courseGate = await requireActiveCourse(targetEnrollment.courseId)
  if (!courseGate.ok) {
    return { ok: false, status: courseGate.response.status, error: "Course is not available." }
  }

  const resolved = await resolveSessionForCourseLogin(
    targetEnrollment.courseId,
    targetEnrollment.section,
    targetEnrollment.sessionId,
  )
  if (!resolved) {
    return { ok: false, status: 400, error: "Could not resolve your course section. Contact your instructor." }
  }

  const internalStudentId = Number(row.id)
  const isDemoStudent = canonicalStudentId === "DEMO001"
  const isFirstLogin = !row.has_changed_password && !isDemoStudent
  const hasTrial = row.trial_start_date !== null
  let trialActivated = false

  let student: Record<string, unknown>
  if (isFirstLogin && !hasTrial) {
    const updated = (await sql`
      UPDATE students
      SET full_name = ${String(row.full_name ?? "")},
          section = ${resolved.sectionCode},
          session_id = ${resolved.sessionId},
          course_id = ${targetEnrollment.courseId},
          university_id = ${universityId},
          trial_start_date = NOW()
      WHERE id = ${internalStudentId}
      RETURNING *
    `) as Record<string, unknown>[]
    student = updated[0] as Record<string, unknown>
    trialActivated = true
  } else if (isDemoStudent && !row.has_changed_password) {
    const updated = (await sql`
      UPDATE students
      SET section = ${resolved.sectionCode},
          session_id = ${resolved.sessionId},
          course_id = ${targetEnrollment.courseId},
          university_id = ${universityId},
          has_changed_password = true
      WHERE id = ${internalStudentId}
      RETURNING *
    `) as Record<string, unknown>[]
    student = updated[0] as Record<string, unknown>
  } else {
    const updated = (await sql`
      UPDATE students
      SET section = ${resolved.sectionCode},
          session_id = ${resolved.sessionId},
          course_id = ${targetEnrollment.courseId},
          university_id = ${universityId}
      WHERE id = ${internalStudentId}
      RETURNING *
    `) as Record<string, unknown>[]
    student = updated[0] as Record<string, unknown>
  }

  try {
    await getPlaygroundCredits(internalStudentId)
  } catch {
    /* non-blocking */
  }

  const resetRequests = (await sql`
    SELECT id FROM password_reset_requests
    WHERE student_id = ${internalStudentId} AND status = 'approved'
    ORDER BY requested_at DESC
    LIMIT 1
  `) as { id: number }[]

  const effectiveMembershipTier = await getEffectiveMembershipTier(internalStudentId)

  return {
    ok: true,
    student,
    effectiveMembershipTier,
    hasApprovedResetRequest: resetRequests.length > 0,
    resetRequestId: resetRequests.length > 0 ? Number((resetRequests[0] as { id: number }).id) : null,
    trialActivated,
    enrollments: matchedEnrollments,
    selectedEnrollment: {
      ...targetEnrollment,
      section: resolved.sectionCode,
      sessionId: resolved.sessionId,
    },
  }
}

/** Mask name for activation hint — prevents full roster enumeration. */
export function maskStudentName(fullName: string): string {
  return String(fullName ?? "")
    .trim()
    .split(/\s+/)
    .map((part) => (part.length <= 1 ? part : `${part[0]}${"*".repeat(Math.min(part.length - 1, 3))}`))
    .join(" ")
}
