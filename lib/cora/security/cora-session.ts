import { createHash, randomUUID } from "crypto"
import type { MembershipTier } from "@/lib/membership-constants"
import type { CoraAgentRole } from "@/lib/cora/roles"
import { CORA_ROLE_META } from "@/lib/cora/roles"
import { permissionsForRole } from "@/lib/cora/security/capabilities"
import type { CoraPrincipalRole, CoraSession } from "@/lib/cora/security/types"
import { sql } from "@/lib/db"

function principalToAgentRole(role: CoraPrincipalRole): CoraAgentRole {
  switch (role) {
    case "faculty":
      return "copilot"
    case "admin":
      return "admin"
    default:
      return "assistant"
  }
}

async function loadStudentEnrollmentScope(studentDbId: number): Promise<{
  institutionId: number | null
  courseIds: number[]
  sectionIds: number[]
}> {
  try {
    const rows = (await sql`
      SELECT
        s.course_id,
        s.section,
        COALESCE(c.university_id, s.university_id) AS institution_id
      FROM students s
      LEFT JOIN courses c ON c.id = s.course_id
      WHERE s.id = ${studentDbId}
      LIMIT 1
    `) as { course_id: number | null; section: string | null; institution_id: number | null }[]

    const row = rows[0]
    const courseId = row?.course_id != null ? Number(row.course_id) : null
    const institutionId = row?.institution_id != null ? Number(row.institution_id) : null

    return {
      institutionId: institutionId && institutionId > 0 ? institutionId : null,
      courseIds: courseId && courseId > 0 ? [courseId] : [],
      sectionIds: [],
    }
  } catch {
    return { institutionId: null, courseIds: [], sectionIds: [] }
  }
}

/** Build a student-scoped Cora session — never elevates beyond the authenticated student. */
export async function buildStudentCoraSession(input: {
  studentDbId: number
  membershipTier?: MembershipTier | null
}): Promise<CoraSession> {
  const scope = await loadStudentEnrollmentScope(input.studentDbId)
  const role: CoraPrincipalRole = "student"
  const agentRole = principalToAgentRole(role)
  return {
    requestId: randomUUID(),
    role,
    agentRole,
    userId: input.studentDbId,
    institutionId: scope.institutionId,
    courseIds: scope.courseIds,
    sectionIds: scope.sectionIds,
    membershipTier: input.membershipTier ?? null,
    permissions: permissionsForRole(role),
    productName: CORA_ROLE_META[agentRole].productName,
    claims: { studentDbId: input.studentDbId },
  }
}

/** Build a faculty-scoped Cora session — only the assigned course (+ sections when available). */
export async function buildFacultyCoraSession(input: {
  instructorId: number
  courseId: number
  courseCode?: string | null
  courseTitle?: string | null
  institutionId?: number | null
  sectionIds?: number[]
  instructorMembershipTier?: string | null
}): Promise<CoraSession> {
  const role: CoraPrincipalRole = "faculty"
  const agentRole = principalToAgentRole(role)

  let instructorMembershipTier = input.instructorMembershipTier ?? null
  if (instructorMembershipTier == null) {
    try {
      const { getInstructorMembership } = await import("@/lib/instructor-membership")
      const mem = await getInstructorMembership(input.instructorId)
      instructorMembershipTier = mem?.tier ?? "Free"
    } catch {
      instructorMembershipTier = "Free"
    }
  }

  let sectionIds = input.sectionIds ?? []
  if (sectionIds.length === 0) {
    try {
      const rows = (await sql`
        SELECT id FROM sessions
        WHERE course_id = ${input.courseId}
        LIMIT 50
      `) as { id: number }[]
      sectionIds = rows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n) && n > 0)
    } catch {
      sectionIds = []
    }
  }
  // Fallback: distinct numeric section codes from enrolled students
  if (sectionIds.length === 0) {
    try {
      const rows = (await sql`
        SELECT DISTINCT TRIM(section::text) AS section
        FROM students
        WHERE course_id = ${input.courseId}
          AND section IS NOT NULL
          AND TRIM(section::text) <> ''
        LIMIT 50
      `) as { section: string }[]
      sectionIds = rows
        .map((r) => Number.parseInt(String(r.section).replace(/\D/g, ""), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
      sectionIds = [...new Set(sectionIds)]
    } catch {
      /* ignore */
    }
  }

  let institutionId = input.institutionId ?? null
  if (institutionId == null) {
    try {
      const rows = (await sql`
        SELECT university_id AS institution_id FROM courses WHERE id = ${input.courseId} LIMIT 1
      `) as { institution_id: number | null }[]
      const n = rows[0]?.institution_id != null ? Number(rows[0].institution_id) : null
      institutionId = n && n > 0 ? n : null
    } catch {
      institutionId = null
    }
  }

  return {
    requestId: randomUUID(),
    role,
    agentRole,
    userId: input.instructorId,
    institutionId,
    courseIds: [input.courseId],
    sectionIds,
    membershipTier: null,
    instructorMembershipTier,
    permissions: permissionsForRole(role),
    productName: CORA_ROLE_META[agentRole].productName,
    claims: {
      instructorId: input.instructorId,
      courseCode: input.courseCode ?? null,
      courseTitle: input.courseTitle ?? null,
    },
  }
}

/** Build an admin-scoped Cora session — institution ops only, no student/faculty impersonation. */
export async function buildAdminCoraSession(input: {
  adminId: number
  institutionId?: number | null
}): Promise<CoraSession> {
  const role: CoraPrincipalRole = "admin"
  const agentRole = principalToAgentRole(role)
  return {
    requestId: randomUUID(),
    role,
    agentRole,
    userId: input.adminId,
    institutionId: input.institutionId ?? null,
    courseIds: [],
    sectionIds: [],
    membershipTier: null,
    permissions: permissionsForRole(role),
    productName: CORA_ROLE_META[agentRole].productName,
    claims: { adminId: input.adminId },
  }
}

export function hashPrompt(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 24)
}
