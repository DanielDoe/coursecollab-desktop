import { sql } from "@/lib/db"

export const MODULE_COMPLETION_XP: Record<number, number> = {
  0: 50,
  1: 100,
  2: 125,
  3: 150,
  4: 150,
  5: 175,
  6: 200,
  7: 200,
  8: 250,
  9: 250,
  10: 350,
  11: 500,
}

export async function getCamperProfile(studentDbId: number) {
  const rows = await sql`
    SELECT student_id, profile, total_xp, badges, updated_at
    FROM camp_camper_profiles
    WHERE student_id = ${studentDbId}
    LIMIT 1
  `
  if (rows.length === 0) {
    return {
      student_id: studentDbId,
      profile: {},
      total_xp: 0,
      badges: [] as string[],
      updated_at: null,
    }
  }
  const row = rows[0] as {
    student_id: number
    profile: Record<string, unknown>
    total_xp: number
    badges: string[]
    updated_at: string
  }
  return {
    ...row,
    badges: Array.isArray(row.badges) ? row.badges : [],
    profile: row.profile ?? {},
  }
}

export async function upsertCamperProfile(
  studentDbId: number,
  patch: Record<string, unknown>,
) {
  const existing = await getCamperProfile(studentDbId)
  const merged = { ...existing.profile }
  for (const [key, value] of Object.entries(patch)) {
    if (
      value != null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      merged[key] != null &&
      typeof merged[key] === "object" &&
      !Array.isArray(merged[key])
    ) {
      merged[key] = {
        ...(merged[key] as Record<string, unknown>),
        ...(value as Record<string, unknown>),
      }
    } else {
      merged[key] = value
    }
  }
  await sql`
    INSERT INTO camp_camper_profiles (student_id, profile, total_xp, badges)
    VALUES (${studentDbId}, ${JSON.stringify(merged)}::jsonb, ${existing.total_xp}, ${JSON.stringify(existing.badges)}::jsonb)
    ON CONFLICT (student_id) DO UPDATE SET
      profile = ${JSON.stringify(merged)}::jsonb,
      updated_at = NOW()
  `
  return getCamperProfile(studentDbId)
}

export async function awardModuleCompletion(
  studentDbId: number,
  moduleSortOrder: number,
  badgeIds: string[] = [],
) {
  const { syncCampCamperXp } = await import("@/lib/summer-camp/camp-xp")
  const xpAwarded = MODULE_COMPLETION_XP[moduleSortOrder] ?? 25
  const existing = await getCamperProfile(studentDbId)
  const badges = [...new Set([...existing.badges, ...badgeIds])]

  await sql`
    INSERT INTO camp_camper_profiles (student_id, profile, total_xp, badges)
    VALUES (${studentDbId}, ${JSON.stringify(existing.profile)}::jsonb, ${existing.total_xp}, ${JSON.stringify(badges)}::jsonb)
    ON CONFLICT (student_id) DO UPDATE SET
      badges = ${JSON.stringify(badges)}::jsonb,
      updated_at = NOW()
  `

  const { total_xp: totalXp } = await syncCampCamperXp(studentDbId)
  return { xpAwarded, totalXp, badges }
}

export async function awardBadge(studentDbId: number, badgeId: string) {
  const existing = await getCamperProfile(studentDbId)
  if (existing.badges.includes(badgeId)) return existing
  const badges = [...existing.badges, badgeId]
  await sql`
    INSERT INTO camp_camper_profiles (student_id, profile, total_xp, badges)
    VALUES (${studentDbId}, ${JSON.stringify(existing.profile)}::jsonb, ${existing.total_xp}, ${JSON.stringify(badges)}::jsonb)
    ON CONFLICT (student_id) DO UPDATE SET
      badges = ${JSON.stringify(badges)}::jsonb,
      updated_at = NOW()
  `
  return getCamperProfile(studentDbId)
}
