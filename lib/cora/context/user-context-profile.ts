import { sql } from "@/lib/db"
import { getEnrollmentAttendanceWindow } from "@/lib/attendance-enrollment-scope"
import { getEffectiveMembershipTier, getAITutorCredits } from "@/lib/membership"
import { getGuestMasterResume, listGuestApplications } from "@/lib/guest/career/store"
import { resolveGuestCapabilities } from "@/lib/guest/entitlements"
import { getGuestCoraProfileRecord } from "@/lib/cora/fetch-guest-context"
import { ensureCoraMemorySchema, type CoraMemoryRole } from "@/lib/cora/memory/cora-user-memory"

export type UserContextProfile = {
  role: CoraMemoryRole
  userId: number
  courseId: number | null
  content: string
  updatedAt: string
}

type ContextProfileRow = {
  id: number
  content: string
  updated_at: string | Date
}

const CONTEXT_PROFILE_KIND = "context_profile"
const CONTEXT_PROFILE_STALE_MS = 7 * 24 * 60 * 60 * 1000
const CONTEXT_PROFILE_MAX_CHARS = 1200

function trimLine(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim()
}

function normalizeProfileLines(content: string): string[] {
  return String(content ?? "")
    .split(/\r?\n/)
    .map(trimLine)
    .filter(Boolean)
}

function capProfileLines(lines: string[], maxChars = CONTEXT_PROFILE_MAX_CHARS): string[] {
  const capped: string[] = []
  let total = 0
  for (const raw of lines) {
    const line = trimLine(raw)
    if (!line) continue
    const nextLength = total === 0 ? line.length : total + 1 + line.length
    if (nextLength <= maxChars) {
      capped.push(line)
      total = nextLength
      continue
    }
    if (!capped.length) capped.push(line.slice(0, maxChars))
    break
  }
  return capped
}

export function mergeContextProfileContent(
  existingContent: string,
  newLines: string[],
  maxChars = CONTEXT_PROFILE_MAX_CHARS,
): string {
  const merged: string[] = []
  const seen = new Set<string>()
  const ordered = [...newLines, ...normalizeProfileLines(existingContent)]
  for (const rawLine of ordered) {
    const line = trimLine(rawLine)
    if (!line || seen.has(line)) continue
    seen.add(line)
    merged.push(line)
  }
  return capProfileLines(merged, maxChars).join("\n")
}

function mapRow(row: Record<string, unknown> | undefined): ContextProfileRow | null {
  if (!row) return null
  return {
    id: Number(row.id),
    content: String(row.content ?? ""),
    updated_at: row.updated_at instanceof Date ? row.updated_at : String(row.updated_at ?? ""),
  }
}

async function loadContextProfileRow(role: CoraMemoryRole, userId: number): Promise<ContextProfileRow | null> {
  await ensureCoraMemorySchema()
  const rows = (await sql`
    SELECT id, content, updated_at
    FROM cora_user_memory
    WHERE role = ${role}
      AND user_id = ${userId}
      AND scope = 'global'
      AND kind = ${CONTEXT_PROFILE_KIND}
    ORDER BY updated_at DESC
    LIMIT 1
  `) as Array<Record<string, unknown>>
  return mapRow(rows[0])
}

async function saveContextProfileRow(input: {
  role: CoraMemoryRole
  userId: number
  courseId?: number | null
  content: string
}): Promise<UserContextProfile> {
  await ensureCoraMemorySchema()
  const content = String(input.content ?? "").trim().slice(0, CONTEXT_PROFILE_MAX_CHARS)
  const existing = await loadContextProfileRow(input.role, input.userId)
  const rows = existing
    ? (await sql`
        UPDATE cora_user_memory
        SET
          course_id = ${input.courseId ?? null},
          scope = 'global',
          thread_id = NULL,
          kind = ${CONTEXT_PROFILE_KIND},
          content = ${content},
          updated_at = NOW()
        WHERE id = ${existing.id}
        RETURNING id, content, updated_at
      `) as Array<Record<string, unknown>>
    : (await sql`
        INSERT INTO cora_user_memory (
          role, user_id, course_id, scope, thread_id, kind, content, source
        )
        VALUES (
          ${input.role},
          ${input.userId},
          ${input.courseId ?? null},
          'global',
          NULL,
          ${CONTEXT_PROFILE_KIND},
          ${content},
          'cora_context_profile'
        )
        RETURNING id, content, updated_at
      `) as Array<Record<string, unknown>>

  const row = mapRow(rows[0]) ?? existing
  if (!row) throw new Error("Failed to save context profile.")
  return {
    role: input.role,
    userId: input.userId,
    courseId: input.courseId ?? null,
    content: row.content,
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  }
}

function formatNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "0"
  return String(Math.max(0, Math.round(n)))
}

function currentWeekOfTerm(termStart: string | null): number | null {
  if (!termStart) return null
  const start = new Date(`${termStart}T12:00:00`)
  if (Number.isNaN(start.getTime())) return null
  const deltaDays = Math.floor((Date.now() - start.getTime()) / 86_400_000)
  return Math.max(1, Math.floor(deltaDays / 7) + 1)
}

async function buildStudentBootstrapLines(userId: number, courseId: number | null): Promise<string[]> {
  const lines: string[] = []

  try {
    const rows = (await sql`
      SELECT
        s.full_name,
        s.student_id,
        s.section,
        s.course_id,
        s.session_id,
        COALESCE(NULLIF(TRIM(sess.code), ''), NULLIF(TRIM(s.section), '')) AS section_code,
        c.course_code,
        c.course_title
      FROM students s
      LEFT JOIN sessions sess ON sess.id = s.session_id
      LEFT JOIN courses c ON c.id = COALESCE(s.course_id, sess.course_id)
      WHERE s.id = ${userId}
      LIMIT 1
    `) as Array<Record<string, unknown>>
    const row = rows[0]
    if (row) {
      const fullName = trimLine(String(row.full_name ?? ""))
      const studentCode = trimLine(String(row.student_id ?? ""))
      const courseCode = trimLine(String(row.course_code ?? ""))
      const courseTitle = trimLine(String(row.course_title ?? ""))
      const sectionCode = trimLine(String(row.section_code ?? row.section ?? ""))

      if (fullName) lines.push(`Name: ${fullName}${studentCode ? ` (${studentCode})` : ""}`)
      lines.push("Role: Student")
      if (courseCode || courseTitle || sectionCode) {
        const courseLabel = [courseCode, courseTitle].filter(Boolean).join(" — ")
        lines.push(
          `Enrollment: ${courseLabel || "current course"}${sectionCode ? ` · section ${sectionCode}` : ""}`,
        )
      }
    }
  } catch {
    /* optional */
  }

  try {
    const tier = await getEffectiveMembershipTier(userId)
    const credits = await getAITutorCredits(userId)
    lines.push(`Membership: ${tier} · Cora credits: ${formatNumber(credits)}`)
  } catch {
    /* optional */
  }

  try {
    const noteRows = (await sql`
      SELECT COUNT(*)::int AS c
      FROM student_digital_notes
      WHERE student_id = ${userId}
        AND updated_at >= NOW() - INTERVAL '30 days'
    `.catch(() => [{ c: 0 }])) as { c: number }[]
    const deckRows = (await sql`
      SELECT COUNT(*)::int AS c
      FROM flashcard_decks
      WHERE student_id = ${userId}
        AND updated_at >= NOW() - INTERVAL '30 days'
    `.catch(() => [{ c: 0 }])) as { c: number }[]
    const practiceRows = (await sql`
      SELECT COUNT(*)::int AS c
      FROM practice_attempts
      WHERE student_id = ${userId}
        AND completed_at >= NOW() - INTERVAL '30 days'
    `.catch(() => [{ c: 0 }])) as { c: number }[]
    const notes = Number(noteRows[0]?.c ?? 0)
    const decks = Number(deckRows[0]?.c ?? 0)
    const practice = Number(practiceRows[0]?.c ?? 0)
    lines.push(`Activity (30d): ${notes} notes, ${decks} flashcard decks, ${practice} practice attempts`)
  } catch {
    /* optional */
  }

  try {
    const window = await getEnrollmentAttendanceWindow(userId)
    const week = currentWeekOfTerm(window?.termStart ?? null)
    if (week != null) {
      lines.push(`Semester week: ~${week}${window?.termEnd ? ` (through ${window.termEnd})` : ""}`)
    }
  } catch {
    /* optional */
  }

  if (courseId != null) {
    try {
      const rows = (await sql`
        SELECT c.course_code, c.course_title, s.section
        FROM students s
        LEFT JOIN sessions sess ON sess.id = s.session_id
        LEFT JOIN courses c ON c.id = COALESCE(s.course_id, sess.course_id)
        WHERE s.id = ${userId}
          AND COALESCE(s.course_id, sess.course_id) = ${courseId}
        LIMIT 1
      `) as Array<Record<string, unknown>>
      const row = rows[0]
      if (row) {
        const courseCode = trimLine(String(row.course_code ?? ""))
        const courseTitle = trimLine(String(row.course_title ?? ""))
        const section = trimLine(String(row.section ?? ""))
        if (courseCode || courseTitle || section) {
          lines.push(`Current course: ${[courseCode, courseTitle].filter(Boolean).join(" — ")}${section ? ` · section ${section}` : ""}`.trim())
        }
      }
    } catch {
      /* optional */
    }
  }

  return capProfileLines(lines)
}

async function buildInstructorBootstrapLines(userId: number): Promise<string[]> {
  const lines: string[] = []

  try {
    const rows = (await sql`
      SELECT name, email, username, membership_tier
      FROM instructors
      WHERE id = ${userId}
      LIMIT 1
    `) as Array<Record<string, unknown>>
    const row = rows[0]
    if (row) {
      const name = trimLine(String(row.name ?? ""))
      const username = trimLine(String(row.username ?? ""))
      lines.push(`Name: ${name || username || "Instructor"}`)
      lines.push("Role: Instructor")
      if (row.membership_tier != null) {
        lines.push(`Membership: ${trimLine(String(row.membership_tier))}`)
      }
    }
  } catch {
    /* optional */
  }

  try {
    const courseRows = (await sql`
      SELECT
        c.id,
        c.course_code,
        c.course_title,
        COUNT(DISTINCT sess.id)::int AS section_count,
        COUNT(DISTINCT st.id)::int AS student_count
      FROM courses c
      LEFT JOIN sessions sess ON sess.course_id = c.id
      LEFT JOIN students st ON st.course_id = c.id
      WHERE c.instructor_id = ${userId}
        AND c.is_active = true
      GROUP BY c.id, c.course_code, c.course_title
      ORDER BY c.course_code NULLS LAST, c.course_title NULLS LAST
      LIMIT 6
    `.catch(() => [])) as Array<Record<string, unknown>>
    const statsRows = (await sql`
      SELECT
        COUNT(DISTINCT sess.id)::int AS total_sections,
        COUNT(DISTINCT st.id)::int AS total_students
      FROM courses c
      LEFT JOIN sessions sess ON sess.course_id = c.id
      LEFT JOIN students st ON st.course_id = c.id
      WHERE c.instructor_id = ${userId}
        AND c.is_active = true
    `.catch(() => [{ total_sections: 0, total_students: 0 }])) as {
      total_sections: number
      total_students: number
    }[]

    const aggregate = statsRows[0]
    lines.push(
      `Courses: ${courseRows.length} · Sections: ${formatNumber(aggregate?.total_sections)} · Students: ${formatNumber(aggregate?.total_students)}`,
    )

    const courseLines = courseRows
      .map((row) => {
        const courseCode = trimLine(String(row.course_code ?? ""))
        const courseTitle = trimLine(String(row.course_title ?? ""))
        const sectionCount = formatNumber(Number(row.section_count ?? 0))
        const studentCount = formatNumber(Number(row.student_count ?? 0))
        const label = [courseCode, courseTitle].filter(Boolean).join(" — ") || "Course"
        return `- ${label}${sectionCount !== "0" ? ` · ${sectionCount} sections` : ""}${studentCount !== "0" ? ` · ${studentCount} students` : ""}`
      })
      .filter(Boolean)
    if (courseLines.length) {
      lines.push("Teaching load:")
      lines.push(...courseLines)
    }
  } catch {
    /* optional */
  }

  return capProfileLines(lines)
}

async function buildGuestBootstrapLines(userId: number): Promise<string[]> {
  const lines: string[] = []

  try {
    const rows = (await sql`
      SELECT full_name, email, guest_organization, guest_access_purpose
      FROM students
      WHERE id = ${userId}
      LIMIT 1
    `) as Array<Record<string, unknown>>
    const row = rows[0]
    if (row) {
      const name = trimLine(String(row.full_name ?? ""))
      lines.push(`Name: ${name || "Guest"}`)
      lines.push("Role: Guest")
      if (row.guest_organization != null) {
        lines.push(`Organization: ${trimLine(String(row.guest_organization))}`)
      }
      if (row.guest_access_purpose != null) {
        lines.push(`Purpose: ${trimLine(String(row.guest_access_purpose))}`)
      }
    }
  } catch {
    /* optional */
  }

  try {
    const [entitlement, profile, resume, applications] = await Promise.all([
      resolveGuestCapabilities(userId).catch(() => null),
      getGuestCoraProfileRecord(userId).catch(() => null),
      getGuestMasterResume(userId).catch(() => null),
      listGuestApplications(userId).catch(() => []),
    ])
    const recommendationRows = (await sql`
      SELECT COUNT(*)::int AS c
      FROM recommendation_requests
      WHERE student_id = ${userId}
    `.catch(() => [{ c: 0 }])) as { c: number }[]
    const coverLetterRows = (await sql`
      SELECT COUNT(*)::int AS c
      FROM guest_career_cover_letters
      WHERE guest_id = ${userId}
    `.catch(() => [{ c: 0 }])) as { c: number }[]

    if (entitlement) {
      const balanceRows = (await sql`
        SELECT balance, reserved
        FROM guest_cora_balances
        WHERE student_id = ${userId}
        LIMIT 1
      `.catch(() => [])) as Array<{ balance?: number; reserved?: number }>
      const available =
        balanceRows.length > 0
          ? Math.max(0, Number(balanceRows[0]?.balance ?? 0) - Number(balanceRows[0]?.reserved ?? 0))
          : null
      lines.push(`Plan: ${entitlement.plan} · Cora credits: ${formatNumber(available)}`)
    }
    if (profile) {
      if (profile.goals) lines.push(`Goals: ${trimLine(profile.goals)}`)
      if (profile.careerSummary) lines.push(`Career summary: ${trimLine(profile.careerSummary)}`)
      if (profile.targetRoles.length) lines.push(`Target roles: ${profile.targetRoles.slice(0, 4).join(", ")}`)
      if (profile.focusTopics.length) lines.push(`Focus topics: ${profile.focusTopics.slice(0, 4).join(", ")}`)
    }
    if (resume && (resume.parsedText.trim() || resume.originalFileUrl || resume.originalFileName)) {
      lines.push(
        `Master resume: ${resume.label ?? resume.originalFileName ?? "uploaded"} · ${resume.profile.experience.length} roles · ${resume.profile.skills.length} skills`,
      )
    }

    const applicationCount = Array.isArray(applications) ? applications.length : 0
    const recommendationCount = Number(recommendationRows[0]?.c ?? 0)
    const coverLetters = Number(coverLetterRows[0]?.c ?? 0)
    lines.push(`Applications: ${applicationCount} · Recommendation requests: ${recommendationCount} · Cover letters: ${coverLetters}`)
  } catch {
    /* optional */
  }

  return capProfileLines(lines)
}

async function buildBootstrapContent(input: {
  role: CoraMemoryRole
  userId: number
  courseId?: number | null
}): Promise<string> {
  const lines =
    input.role === "student"
      ? await buildStudentBootstrapLines(input.userId, input.courseId ?? null)
      : input.role === "instructor" || input.role === "admin"
        ? await buildInstructorBootstrapLines(input.userId)
        : await buildGuestBootstrapLines(input.userId)
  return lines.join("\n")
}

export async function getOrBootstrapContextProfile(input: {
  role: CoraMemoryRole
  userId: number
  courseId?: number | null
}): Promise<UserContextProfile> {
  await ensureCoraMemorySchema()
  const existing = await loadContextProfileRow(input.role, input.userId)
  if (existing) {
    const updatedAt = new Date(String(existing.updated_at)).getTime()
    if (Number.isFinite(updatedAt) && Date.now() - updatedAt < CONTEXT_PROFILE_STALE_MS) {
      return {
        role: input.role,
        userId: input.userId,
        courseId: input.courseId ?? null,
        content: existing.content,
        updatedAt: new Date(updatedAt).toISOString(),
      }
    }
  }

  const bootstrapContent = await buildBootstrapContent(input)
  const content = existing
    ? mergeContextProfileContent(existing.content, normalizeProfileLines(bootstrapContent))
    : String(bootstrapContent ?? "").trim().slice(0, CONTEXT_PROFILE_MAX_CHARS)

  return saveContextProfileRow({
    role: input.role,
    userId: input.userId,
    courseId: input.courseId ?? null,
    content,
  })
}

export async function updateContextProfileFacts(input: {
  role: CoraMemoryRole
  userId: number
  facts: string[]
}): Promise<UserContextProfile> {
  const baseline = await getOrBootstrapContextProfile({
    role: input.role,
    userId: input.userId,
    courseId: null,
  })
  const content = mergeContextProfileContent(baseline.content, input.facts)
  return saveContextProfileRow({
    role: input.role,
    userId: input.userId,
    content,
  })
}

export function formatContextProfilePrompt(profile: UserContextProfile): string {
  const lines = normalizeProfileLines(profile.content)
  const out = ["USER CONTEXT PROFILE (durable — built from platform data):"]
  for (const line of lines) {
    out.push(`- ${line}`)
  }
  out.push(
    "If the user asks about something not present in this context or in thread memory, DO NOT guess — call the relevant read tool to fetch it from the platform, then call remember_fact (scope global) with a one-line durable summary so future conversations have it.",
  )
  return out.join("\n")
}
