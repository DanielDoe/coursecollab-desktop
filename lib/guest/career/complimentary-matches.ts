import { sql } from "@/lib/db"
import { ensureGuestCareerIntelligenceSchema } from "@/lib/guest/career/ensure-schema"
import { GUEST_FREE_COMPLIMENTARY_RESUME_MATCHES } from "@/lib/guest/membership-config"

export type ComplimentaryMatchStatus = {
  limit: number
  used: number
  remaining: number
}

async function ensureComplimentaryColumn(): Promise<void> {
  await ensureGuestCareerIntelligenceSchema()
  await sql`
    ALTER TABLE guest_cora_profiles
    ADD COLUMN IF NOT EXISTS complimentary_resume_matches_used INTEGER NOT NULL DEFAULT 0
  `
}

export async function getComplimentaryResumeMatchStatus(
  guestId: number,
): Promise<ComplimentaryMatchStatus> {
  await ensureComplimentaryColumn()
  const rows = (await sql`
    SELECT complimentary_resume_matches_used
    FROM guest_cora_profiles
    WHERE guest_id = ${guestId}
    LIMIT 1
  `) as Array<{ complimentary_resume_matches_used: number }>

  const used = Number(rows[0]?.complimentary_resume_matches_used ?? 0)
  const limit = GUEST_FREE_COMPLIMENTARY_RESUME_MATCHES
  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
  }
}

/** Consume one complimentary match slot (call only after a new non-cached analysis). */
export async function consumeComplimentaryResumeMatch(guestId: number): Promise<ComplimentaryMatchStatus> {
  await ensureComplimentaryColumn()
  await sql`
    INSERT INTO guest_cora_profiles (guest_id, complimentary_resume_matches_used)
    VALUES (${guestId}, 0)
    ON CONFLICT (guest_id) DO NOTHING
  `
  await sql`
    UPDATE guest_cora_profiles
    SET complimentary_resume_matches_used = complimentary_resume_matches_used + 1,
        updated_at = NOW()
    WHERE guest_id = ${guestId}
      AND complimentary_resume_matches_used < ${GUEST_FREE_COMPLIMENTARY_RESUME_MATCHES}
  `
  return getComplimentaryResumeMatchStatus(guestId)
}

export function complimentaryMatchMeta(status: ComplimentaryMatchStatus) {
  return {
    complimentaryResumeMatches: status,
  }
}
