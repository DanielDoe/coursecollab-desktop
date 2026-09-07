import { sql } from "@/lib/db"
import { ensureGuestCareerIntelligenceSchema } from "@/lib/guest/career/ensure-schema"
import { getGuestMasterResume, listGuestApplications } from "@/lib/guest/career/store"
import { getGuestCoraBalance } from "@/lib/guest/cora-credit-ledger"
import { resolveGuestCapabilities } from "@/lib/guest/entitlements"
import { purposeLabel } from "@/lib/recommendation-letters-shared"
import { sqlRows } from "@/lib/sql-rows"

export type GuestCoraProfileRecord = {
  careerSummary: string
  goals: string
  targetRoles: string[]
  focusTopics: string[]
  coraNotes: Record<string, unknown>
  lastContextSyncAt: string | null
  updatedAt: string
}

export type GuestCoraContextPayload = {
  account: {
    guestId: number
    fullName: string
    email: string | null
    organization: string | null
    onboardingPurpose: string | null
  }
  entitlements: {
    plan: string
    capabilities: string[]
    coraCredits: number
  }
  careerProfile: GuestCoraProfileRecord
  masterResume: {
    hasResume: boolean
    label: string | null
    fileName: string | null
    updatedAt: string | null
    skillCount: number
    experienceCount: number
    preview: string
  } | null
  applications: Array<{
    id: number
    title: string
    organization: string | null
    status: string
    matchScore: number | null
    matchBand: string | null
    coverLetterStatus: string
    updatedAt: string
  }>
  recommendations: Array<{
    id: number
    status: string
    purpose: string
    deadline: string | null
    instructorName: string
    questionnaireComplete: boolean
    hasBrief: boolean
    updatedAt: string
  }>
  summary: {
    applicationCount: number
    recommendationCount: number
    activeRecommendations: number
    avgMatchScore: number | null
    hasCoverLetterDrafts: number
  }
  focusTopics: string[]
  syncedAt: string
}

function rowToGuestCoraProfile(row: Record<string, unknown>): GuestCoraProfileRecord {
  const notes = row.cora_notes
  return {
    careerSummary: String(row.career_summary ?? ""),
    goals: String(row.goals ?? ""),
    targetRoles: Array.isArray(row.target_roles) ? row.target_roles.map(String) : [],
    focusTopics: Array.isArray(row.focus_topics) ? row.focus_topics.map(String) : [],
    coraNotes:
      notes && typeof notes === "object" && !Array.isArray(notes)
        ? (notes as Record<string, unknown>)
        : {},
    lastContextSyncAt: row.last_context_sync_at ? String(row.last_context_sync_at) : null,
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  }
}

export async function getGuestCoraProfileRecord(guestId: number): Promise<GuestCoraProfileRecord> {
  await ensureGuestCareerIntelligenceSchema()
  const rows = await sql`
    SELECT * FROM guest_cora_profiles WHERE guest_id = ${guestId} LIMIT 1
  `
  if (rows[0]) return rowToGuestCoraProfile(rows[0] as Record<string, unknown>)

  const inserted = await sql`
    INSERT INTO guest_cora_profiles (guest_id) VALUES (${guestId})
    ON CONFLICT (guest_id) DO NOTHING
    RETURNING *
  `
  if (inserted[0]) return rowToGuestCoraProfile(inserted[0] as Record<string, unknown>)

  const fallback = await sql`SELECT * FROM guest_cora_profiles WHERE guest_id = ${guestId} LIMIT 1`
  return rowToGuestCoraProfile((fallback[0] ?? {}) as Record<string, unknown>)
}

export async function upsertGuestCoraProfile(
  guestId: number,
  patch: Partial<{
    careerSummary: string
    goals: string
    targetRoles: string[]
    focusTopics: string[]
    coraNotes: Record<string, unknown>
  }>,
): Promise<GuestCoraProfileRecord> {
  await ensureGuestCareerIntelligenceSchema()
  const existing = await getGuestCoraProfileRecord(guestId)
  const mergedNotes =
    patch.coraNotes != null ? { ...existing.coraNotes, ...patch.coraNotes } : undefined

  const rows = await sql`
    UPDATE guest_cora_profiles
    SET
      career_summary = COALESCE(${patch.careerSummary ?? null}, career_summary),
      goals = COALESCE(${patch.goals ?? null}, goals),
      target_roles = COALESCE(${patch.targetRoles ?? null}, target_roles),
      focus_topics = COALESCE(${patch.focusTopics ?? null}, focus_topics),
      cora_notes = COALESCE(${mergedNotes ? JSON.stringify(mergedNotes) : null}::jsonb, cora_notes),
      updated_at = NOW()
    WHERE guest_id = ${guestId}
    RETURNING *
  `
  return rowToGuestCoraProfile(rows[0] as Record<string, unknown>)
}

export async function touchGuestCoraContextSync(guestId: number): Promise<void> {
  await ensureGuestCareerIntelligenceSchema()
  await sql`
    UPDATE guest_cora_profiles
    SET last_context_sync_at = NOW(), updated_at = NOW()
    WHERE guest_id = ${guestId}
  `
}

export async function getGuestContextForCora(guestId: number): Promise<GuestCoraContextPayload> {
  await ensureGuestCareerIntelligenceSchema()

  const [profileRows, entitlements, balance, careerProfile, masterResume, applications] = await Promise.all([
    sql`SELECT full_name, email, guest_organization, guest_access_purpose FROM students WHERE id = ${guestId} LIMIT 1`,
    resolveGuestCapabilities(guestId),
    getGuestCoraBalance(guestId),
    getGuestCoraProfileRecord(guestId),
    getGuestMasterResume(guestId),
    listGuestApplications(guestId),
  ])

  const accountRow = profileRows[0] as
    | { full_name: string; email: string | null; guest_organization: string | null; guest_access_purpose: string | null }
    | undefined

  const recRows = sqlRows<Record<string, unknown>>(
    await sql`
      SELECT r.id, r.status, r.purpose, r.deadline, r.updated_at, i.name AS instructor_name,
        EXISTS(SELECT 1 FROM recommendation_profiles p WHERE p.request_id = r.id) AS questionnaire_complete,
        EXISTS(SELECT 1 FROM recommendation_briefs b WHERE b.request_id = r.id) AS has_brief
      FROM recommendation_requests r
      JOIN instructors i ON i.id = r.instructor_id
      WHERE r.student_id = ${guestId}
      ORDER BY r.updated_at DESC
      LIMIT 12
    `,
  )

  const coverLetterCountRows = await sql`
    SELECT COUNT(*)::int AS c FROM guest_career_cover_letters WHERE guest_id = ${guestId}
  `
  const hasCoverLetterDrafts = Number((coverLetterCountRows[0] as { c: number })?.c ?? 0)

  const matchScores = applications.map((a) => a.matchScore).filter((s): s is number => s != null)
  const avgMatchScore =
    matchScores.length > 0 ? Math.round(matchScores.reduce((a, b) => a + b, 0) / matchScores.length) : null

  const recommendations = recRows.map((r) => ({
    id: Number(r.id),
    status: String(r.status),
    purpose: purposeLabel(String(r.purpose)),
    deadline: r.deadline ? String(r.deadline) : null,
    instructorName: String(r.instructor_name ?? ""),
    questionnaireComplete: Boolean(r.questionnaire_complete),
    hasBrief: Boolean(r.has_brief),
    updatedAt: String(r.updated_at ?? ""),
  }))

  const focusFromApps = applications
    .slice(0, 3)
    .map((a) => a.opportunity.title)
    .filter(Boolean)
  const focusFromRecs = recommendations
    .filter((r) => !["finalized", "rejected", "withdrawn"].includes(r.status))
    .slice(0, 2)
    .map((r) => r.purpose)
  const focusTopics = [
    ...careerProfile.focusTopics,
    ...focusFromApps,
    ...focusFromRecs,
  ]
    .filter(Boolean)
    .slice(0, 8)

  await touchGuestCoraContextSync(guestId)

  return {
    account: {
      guestId,
      fullName: accountRow?.full_name ?? "Guest",
      email: accountRow?.email ?? null,
      organization: accountRow?.guest_organization ?? null,
      onboardingPurpose: accountRow?.guest_access_purpose ?? null,
    },
    entitlements: {
      plan: entitlements.plan,
      capabilities: [...entitlements.capabilities],
      coraCredits: balance.available,
    },
    careerProfile,
    masterResume: masterResume
      ? {
          hasResume: Boolean(
            masterResume.parsedText.trim() || masterResume.originalFileUrl || masterResume.originalFileName,
          ),
          label: masterResume.label,
          fileName: masterResume.originalFileName,
          updatedAt: masterResume.updatedAt,
          skillCount: masterResume.profile.skills.length,
          experienceCount: masterResume.profile.experience.length,
          preview: masterResume.parsedText.slice(0, 600),
        }
      : null,
    applications: applications.slice(0, 10).map((a) => ({
      id: a.id,
      title: a.opportunity.title,
      organization: a.opportunity.organization,
      status: a.status,
      matchScore: a.matchScore,
      matchBand: a.matchBand,
      coverLetterStatus: a.coverLetterStatus,
      updatedAt: a.updatedAt,
    })),
    recommendations,
    summary: {
      applicationCount: applications.length,
      recommendationCount: recommendations.length,
      activeRecommendations: recommendations.filter(
        (r) => !["finalized", "rejected", "withdrawn", "downloaded", "delivered"].includes(r.status),
      ).length,
      avgMatchScore,
      hasCoverLetterDrafts,
    },
    focusTopics,
    syncedAt: new Date().toISOString(),
  }
}
