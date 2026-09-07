import { sql } from "@/lib/db"
import { getActiveAcademicTerm } from "@/lib/active-academic-term"
import { ensureFacultySetupSchema } from "@/lib/ensure-faculty-setup-schema"
import {
  provisionFacultyInstructorCourseAccess,
  provisionFacultyTeachingAccess,
} from "@/lib/provision-faculty-course-access"
import { listFacultyCourseOfferings } from "@/lib/faculty-course-offerings"
import { facultyOfferingKey } from "@/lib/faculty-course-offerings-shared"
import { provisionFacultyDestinationShell } from "@/lib/faculty-destination-course-shell"
import { normalizeShellCourseCode } from "@/lib/faculty-destination-course-shell-shared"
import {
  FACULTY_ACCOUNT_SETUP_STEPS,
  type FacultyAccountSetupStepId,
  type FacultySetupCheck,
} from "@/lib/faculty-account-setup-shared"

export {
  FACULTY_ACCOUNT_SETUP_STEPS,
  type FacultyAccountSetupStepId,
  type FacultySetupCheck,
} from "@/lib/faculty-account-setup-shared"

export type FacultyAccountSetupResult = {
  step: FacultyAccountSetupStepId
  complete: boolean
  checks: FacultySetupCheck[]
  offerings: Awaited<ReturnType<typeof listFacultyCourseOfferings>>
  recommendedOfferingKey: string | null
  error?: string
}

function offeringKey(courseId: number, academicTermId: number | null): string {
  return facultyOfferingKey(courseId, academicTermId)
}

async function resolveCourseTitleForCode(courseCode: string): Promise<string | null> {
  const normalized = normalizeShellCourseCode(courseCode)
  const rows = (await sql`
    SELECT course_title FROM courses
    WHERE is_active = true
      AND REPLACE(UPPER(TRIM(course_code)), ' ', '') = ${normalized}
    ORDER BY id ASC
    LIMIT 1
  `) as { course_title: string }[]
  return rows[0]?.course_title?.trim() || null
}

async function provisionPendingCourseCodes(
  instructorId: number,
  codes: string[],
  institution: string | null,
): Promise<string[]> {
  const imported: string[] = []
  for (const code of codes) {
    const baseTitle = (await resolveCourseTitleForCode(code)) ?? code
    const { courseCode } = await provisionFacultyDestinationShell(instructorId, code, {
      institution,
      baseTitle,
      university: institution,
    })
    imported.push(courseCode)
  }
  return imported
}

async function ensureTermLinkForCourse(courseId: number): Promise<boolean> {
  const activeTerm = await getActiveAcademicTerm()
  if (!activeTerm?.id) return true
  const existing = await sql`
    SELECT 1 FROM academic_term_courses
    WHERE course_id = ${courseId} AND academic_term_id = ${activeTerm.id}
    LIMIT 1
  `
  if (existing.length > 0) return true
  await sql`
    INSERT INTO academic_term_courses (academic_term_id, course_id)
    VALUES (${activeTerm.id}, ${courseId})
    ON CONFLICT DO NOTHING
  `
  return true
}

export async function instructorNeedsFacultySetup(instructorId: number): Promise<boolean> {
  await ensureFacultySetupSchema()
  const [row] = (await sql`
    SELECT faculty_setup_completed_at, COALESCE(role, 'instructor') AS role
    FROM instructors WHERE id = ${instructorId} LIMIT 1
  `) as Array<{ faculty_setup_completed_at: string | null; role: string }>
  if (!row) return false
  if (row.role === "ta") return false
  return row.faculty_setup_completed_at == null
}

export async function runFacultyAccountSetup(
  instructorId: number,
  onStep?: (step: FacultyAccountSetupStepId) => void | Promise<void>,
): Promise<FacultyAccountSetupResult> {
  await ensureFacultySetupSchema()
  const checks: FacultySetupCheck[] = []

  onStep?.("verify_account")
  const [instructor] = (await sql`
    SELECT id, username, email, name, institution,
           COALESCE(is_active, true) AS is_active,
           COALESCE(account_lifecycle_status, 'active') AS account_lifecycle_status,
           setup_metadata
    FROM instructors WHERE id = ${instructorId} LIMIT 1
  `) as Array<{
    id: number
    username: string
    email: string
    name: string
    institution: string | null
    is_active: boolean
    account_lifecycle_status: string
    setup_metadata: Record<string, unknown> | null
  }>

  if (!instructor || !instructor.is_active) {
    return {
      step: "verify_account",
      complete: false,
      checks: [{ id: "account", label: "Active faculty account", ok: false, detail: "Account not found or inactive" }],
      offerings: [],
      recommendedOfferingKey: null,
      error: "Faculty account is not active.",
    }
  }

  checks.push({
    id: "account",
    label: "Active faculty account",
    ok: true,
    detail: instructor.name,
  })

  if (instructor.account_lifecycle_status !== "active") {
    checks.push({
      id: "lifecycle",
      label: "Account lifecycle",
      ok: false,
      detail: instructor.account_lifecycle_status,
    })
    return {
      step: "verify_account",
      complete: false,
      checks,
      offerings: [],
      recommendedOfferingKey: null,
      error: "Your account is not fully activated yet.",
    }
  }

  checks.push({ id: "lifecycle", label: "Account lifecycle", ok: true, detail: "Active" })

  onStep?.("load_courses")
  let offerings = await listFacultyCourseOfferings(instructorId)
  checks.push({
    id: "assignments",
    label: "Course assignments loaded",
    ok: offerings.length > 0,
    detail: offerings.length > 0 ? `${offerings.length} course(s)` : "No courses assigned yet",
  })

  const pendingCodes = Array.isArray(instructor.setup_metadata?.pendingCourseCodes)
    ? (instructor.setup_metadata!.pendingCourseCodes as unknown[]).map((c) => String(c))
    : []

  if (offerings.length === 0 && pendingCodes.length > 0) {
    onStep?.("import_course")
    const imported = await provisionPendingCourseCodes(instructorId, pendingCodes, instructor.institution)
    checks.push({
      id: "import",
      label: "Course workspace imported",
      ok: imported.length > 0,
      detail: imported.length > 0 ? imported.join(", ") : pendingCodes.join(", "),
    })
    offerings = await listFacultyCourseOfferings(instructorId)
  } else if (offerings.length > 0) {
    checks.push({
      id: "import",
      label: "Course workspace",
      ok: true,
      detail: offerings.map((o) => o.course_code).join(", "),
    })
  }

  if (offerings.length === 0) {
    return {
      step: "load_courses",
      complete: false,
      checks,
      offerings: [],
      recommendedOfferingKey: null,
      error: "No courses are assigned to your account yet. Contact your administrator.",
    }
  }

  onStep?.("link_term")
  const primary = offerings.find((o) => o.is_active_term) ?? offerings[0]
  await ensureTermLinkForCourse(primary.course_id)
  checks.push({
    id: "term",
    label: "Active term linked",
    ok: true,
    detail: primary.term_label ?? "Current term",
  })

  onStep?.("sync_permissions")
  await provisionFacultyTeachingAccess(instructorId)
  for (const offering of offerings) {
    await provisionFacultyInstructorCourseAccess(instructorId, offering.course_id, null)
  }
  checks.push({
    id: "permissions",
    label: "Teaching permissions",
    ok: true,
    detail: primary.staff_role ?? "INSTRUCTOR",
  })

  onStep?.("ready")
  await sql`
    UPDATE instructors
    SET
      faculty_setup_completed_at = NOW(),
      setup_metadata = COALESCE(setup_metadata, '{}'::jsonb) || ${JSON.stringify({
        lastSetupAt: new Date().toISOString(),
        primaryCourseCode: primary.course_code,
      })}::jsonb
    WHERE id = ${instructorId}
  `

  checks.push({
    id: "ready",
    label: "Setup complete",
    ok: true,
    detail: `${primary.course_code} · ${primary.course_title}`,
  })

  return {
    step: "ready",
    complete: true,
    checks,
    offerings,
    recommendedOfferingKey: offeringKey(primary.course_id, primary.academic_term_id),
  }
}

export async function markInstructorPendingCourses(
  instructorId: number,
  courseCodes: string[],
): Promise<void> {
  await ensureFacultySetupSchema()
  await sql`
    UPDATE instructors
    SET setup_metadata = COALESCE(setup_metadata, '{}'::jsonb) || ${JSON.stringify({
      pendingCourseCodes: courseCodes,
    })}::jsonb
    WHERE id = ${instructorId}
  `
}
