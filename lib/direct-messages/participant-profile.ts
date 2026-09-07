import { sql } from "@/lib/db"
import { initialsFromName } from "@/lib/initials-from-name"
import type { MessageActor, ParticipantKind } from "@/lib/direct-messages/types"

export type ParticipantUserCategory = "guest" | "summer_camper" | "student" | "faculty" | "teaching_assistant"

export type ProfileField = {
  label: string
  value: string
}

export type MessageParticipantProfile = {
  kind: ParticipantKind
  id: number
  displayName: string
  subtitle: string
  userCategory: ParticipantUserCategory
  categoryLabel: string
  email: string | null
  avatarInitials: string
  fields: ProfileField[]
}

function studentCategory(row: {
  is_platform_guest: boolean
  student_program_role: string | null
}): { userCategory: ParticipantUserCategory; categoryLabel: string } {
  if (row.is_platform_guest) return { userCategory: "guest", categoryLabel: "Guest" }
  const role = row.student_program_role?.trim()
  if (role === "summer_camper" || role === "summer_camp") {
    return { userCategory: "summer_camper", categoryLabel: "Summer Camp" }
  }
  return { userCategory: "student", categoryLabel: "Student" }
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export async function loadParticipantProfile(
  kind: ParticipantKind,
  id: number,
): Promise<MessageParticipantProfile | null> {
  if (kind === "student") {
    const rows = (await sql`
      SELECT id, full_name, email, student_id, section,
             COALESCE(is_platform_guest, false) AS is_platform_guest,
             student_program_role, membership_tier, created_at
      FROM students
      WHERE id = ${id}
      LIMIT 1
    `) as Array<{
      id: number
      full_name: string | null
      email: string | null
      student_id: string | null
      section: string | null
      is_platform_guest: boolean
      student_program_role: string | null
      membership_tier: string | null
      created_at: string | null
    }>
    if (rows.length === 0) return null
    const row = rows[0]
    const { userCategory, categoryLabel } = studentCategory(row)
    const displayName = row.full_name?.trim() || row.student_id || "Student"
    const fields: ProfileField[] = []

    if (row.email) fields.push({ label: "Email", value: row.email })
    if (row.student_id && userCategory !== "guest") {
      fields.push({ label: "Student ID", value: row.student_id })
    }
    if (row.section) fields.push({ label: "Section", value: row.section })
    if (userCategory === "student" && row.membership_tier) {
      fields.push({ label: "Membership", value: row.membership_tier })
    }
    if (userCategory === "summer_camper" && row.student_program_role) {
      fields.push({ label: "Program", value: "Summer Camp" })
    }
    const joined = formatDate(row.created_at)
    if (joined) fields.push({ label: "Joined", value: joined })

    let subtitle = categoryLabel
    if (userCategory === "student" && row.student_id) subtitle = `${categoryLabel} · ${row.student_id}`
    if (userCategory === "summer_camper") subtitle = "Summer Camp participant"

    return {
      kind: "student",
      id: row.id,
      displayName,
      subtitle,
      userCategory,
      categoryLabel,
      email: row.email,
      avatarInitials: initialsFromName(displayName),
      fields,
    }
  }

  const rows = (await sql`
    SELECT id, name, username, email, COALESCE(role, 'instructor') AS role,
           created_at, last_login
    FROM instructors
    WHERE id = ${id} AND COALESCE(is_active, true) = true
    LIMIT 1
  `) as Array<{
    id: number
    name: string | null
    username: string | null
    email: string | null
    role: string
    created_at: string | null
    last_login: string | null
  }>
  if (rows.length === 0) return null
  const row = rows[0]
  const isTa = row.role === "ta"
  const categoryLabel = isTa ? "Teaching Assistant" : "Faculty"
  const displayName = row.name?.trim() || row.username || "Instructor"
  const fields: ProfileField[] = []

  if (row.email) fields.push({ label: "Email", value: row.email })
  if (row.username) fields.push({ label: "Username", value: row.username })
  const joined = formatDate(row.created_at)
  if (joined) fields.push({ label: "Member since", value: joined })
  const lastLogin = formatDate(row.last_login)
  if (lastLogin) fields.push({ label: "Last sign-in", value: lastLogin })

  return {
    kind: "instructor",
    id: row.id,
    displayName,
    subtitle: categoryLabel,
    userCategory: isTa ? "teaching_assistant" : "faculty",
    categoryLabel,
    email: row.email,
    avatarInitials: initialsFromName(displayName),
    fields,
  }
}

export async function assertActorCanViewParticipantProfile(
  actor: MessageActor,
  targetKind: ParticipantKind,
  targetId: number,
): Promise<void> {
  if (actor.kind === targetKind && actor.id === targetId) {
    throw new Error("Cannot view your own profile here")
  }

  const shared = (await sql`
    SELECT 1
    FROM dm_participants p_self
    INNER JOIN dm_participants p_other ON p_other.thread_id = p_self.thread_id
    WHERE p_self.participant_kind = ${actor.kind}
      AND p_self.participant_id = ${actor.id}
      AND p_other.participant_kind = ${targetKind}
      AND p_other.participant_id = ${targetId}
    LIMIT 1
  `) as unknown[]

  if (shared.length > 0) return

  throw new Error("Access denied")
}
