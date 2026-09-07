import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { recordInstitutionAudit } from "@/lib/institutions/audit"

export async function listInstitutionFaculty(institutionId: number) {
  await ensureInstitutionSchema()
  return sql`
    SELECT
      m.id, m.role, m.status, m.email, m.joined_at, m.organization_unit_id,
      i.id AS instructor_id, i.name, i.email AS instructor_email, i.membership_tier
    FROM institution_members m
    LEFT JOIN instructors i ON m.user_type = 'instructor' AND i.id = m.user_id
    WHERE m.institution_id = ${institutionId}
      AND m.role IN ('faculty', 'owner', 'institution_admin', 'academic_admin', 'department_admin')
      AND m.removed_at IS NULL
    ORDER BY m.created_at DESC
  `
}

export async function listInstitutionStudents(institutionId: number, courseId?: number | null) {
  await ensureInstitutionSchema()
  if (courseId && Number.isFinite(courseId)) {
    return sql`
      SELECT DISTINCT st.id, st.full_name, st.email, st.student_id, st.course_id, c.course_code
      FROM students st
      JOIN courses c ON c.id = st.course_id
      JOIN institution_license_scopes s ON s.course_id = st.course_id
      JOIN institution_licenses l ON l.id = s.license_id
      WHERE l.institution_id = ${institutionId}
        AND l.status = 'active'
        AND st.deleted_at IS NULL
        AND st.course_id = ${courseId}
      ORDER BY st.full_name
      LIMIT 500
    `
  }
  return sql`
    SELECT DISTINCT st.id, st.full_name, st.email, st.student_id, st.course_id, c.course_code
    FROM students st
    JOIN courses c ON c.id = st.course_id
    JOIN institution_license_scopes s ON s.course_id = st.course_id
    JOIN institution_licenses l ON l.id = s.license_id
    WHERE l.institution_id = ${institutionId}
      AND l.status = 'active'
      AND st.deleted_at IS NULL
    ORDER BY st.full_name
    LIMIT 500
  `
}

export async function inviteInstitutionInstructor(input: {
  institutionId: number
  email: string
  role?: string
  invitedBy?: number
  organizationUnitId?: number | null
}) {
  await ensureInstitutionSchema()
  const email = input.email.trim().toLowerCase()
  if (!email.includes("@")) throw new Error("Valid email required")

  const existingInstructor = await sql`
    SELECT id, name, email FROM instructors WHERE LOWER(email) = ${email} LIMIT 1
  `
  const userId = existingInstructor[0]?.id != null ? Number(existingInstructor[0].id) : 0
  const status = userId > 0 ? "active" : "invited"
  const pendingKey = userId > 0 ? userId : Math.abs(Number(String(Date.now()).slice(-9))) * -1

  const byEmail = await sql`
    SELECT id FROM institution_members
    WHERE institution_id = ${input.institutionId} AND LOWER(email) = ${email}
    LIMIT 1
  `
  if (byEmail.length > 0) {
    await sql`
      UPDATE institution_members
      SET status = ${status},
          removed_at = NULL,
          user_id = CASE WHEN ${userId} > 0 THEN ${userId} ELSE user_id END,
          joined_at = CASE WHEN ${status} = 'active' THEN COALESCE(joined_at, NOW()) ELSE joined_at END,
          updated_at = NOW()
      WHERE id = ${byEmail[0].id}
    `
    return { memberId: Number(byEmail[0].id), instructorId: userId || null, status, email }
  }

  const inserted = await sql`
    INSERT INTO institution_members (
      institution_id, user_type, user_id, role, organization_unit_id, status,
      invited_by, invited_at, joined_at, email
    ) VALUES (
      ${input.institutionId},
      'instructor',
      ${pendingKey},
      ${input.role ?? "faculty"},
      ${input.organizationUnitId ?? null},
      ${status},
      ${input.invitedBy ?? null},
      NOW(),
      ${status === "active" ? new Date().toISOString() : null},
      ${email}
    )
    ON CONFLICT (institution_id, user_type, user_id) DO UPDATE SET
      status = 'active',
      removed_at = NULL,
      email = EXCLUDED.email,
      updated_at = NOW()
    RETURNING id
  `

  await recordInstitutionAudit({
    institutionId: input.institutionId,
    actorUserId: input.invitedBy ?? null,
    actorUserType: "instructor",
    action: "instructor_added",
    entityType: "institution_member",
    entityId: Number(inserted[0]?.id ?? 0),
    newValue: { email, status, instructorId: userId || null },
  })

  return { memberId: Number(inserted[0]?.id), instructorId: userId || null, status, email }
}

export async function removeInstitutionSponsorship(input: {
  institutionId: number
  memberId: number
  actorUserId?: number
}) {
  await ensureInstitutionSchema()
  const rows = await sql`
    SELECT * FROM institution_members
    WHERE id = ${input.memberId} AND institution_id = ${input.institutionId}
    LIMIT 1
  `
  if (rows.length === 0) throw new Error("Member not found")
  await sql`
    UPDATE institution_members
    SET status = 'removed', removed_at = NOW(), updated_at = NOW()
    WHERE id = ${input.memberId} AND institution_id = ${input.institutionId}
  `
  await recordInstitutionAudit({
    institutionId: input.institutionId,
    actorUserId: input.actorUserId ?? null,
    action: "instructor_removed",
    entityType: "institution_member",
    entityId: input.memberId,
    previousValue: { status: rows[0].status },
    newValue: { status: "removed" },
  })
}
