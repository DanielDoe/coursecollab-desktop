import type { getSQL } from "@/lib/db"
import {
  getInstructorMembershipExpiry,
  upsertInstructorMembership,
} from "@/lib/instructor-membership"
import type { MembershipTier } from "@/lib/membership-constants"

type Sql = ReturnType<typeof getSQL>

async function setDemoStudentTier(sql: Sql, studentId: number, tier: MembershipTier) {
  await sql`
    UPDATE students
    SET membership_tier = ${tier},
        stripe_subscription_id = NULL,
        beta_user = false,
        trial_start_date = NULL
    WHERE id = ${studentId}
  `

  const existing = (await sql`
    SELECT id FROM memberships WHERE student_id = ${studentId} LIMIT 1
  `) as { id: number }[]

  if (existing.length) {
    await sql`
      UPDATE memberships
      SET tier = ${tier},
          plan = ${tier},
          status = 'active',
          expires_at = NULL,
          end_date = NULL,
          auto_renew = false,
          stripe_subscription_id = NULL,
          billing_cadence = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE student_id = ${studentId}
    `
  } else {
    await sql`
      INSERT INTO memberships (student_id, tier, plan, status, auto_renew)
      VALUES (${studentId}, ${tier}, ${tier}, 'active', false)
    `
  }

  const { grantMembershipPerks } = await import("@/lib/membership")
  await grantMembershipPerks(studentId, tier)
}

/** Maya Chen / mchen — full faculty analytics for App Review. */
export async function grantAppStoreReviewInstructorPro(instructorId: number) {
  const expiresAt = await getInstructorMembershipExpiry("semester")
  await upsertInstructorMembership({
    instructorId,
    tier: "Pro",
    billingCadence: "semester",
    expiresAt,
  })
}

/** Alex Rivera (primary Apple test student) — both ECE + ELEG enrollments. */
export async function grantAppStoreReviewPrimaryStudentTrailblazer(
  sql: Sql,
  primaryStudentInternalIds: number[],
) {
  for (const studentId of primaryStudentInternalIds) {
    await setDemoStudentTier(sql, studentId, "Trailblazer")
  }
}

/** Classmates stay on Scholar so upgrade flows remain demo-able. */
export async function resetAppStoreReviewClassmatesToScholar(
  sql: Sql,
  classmateInternalIds: number[],
) {
  for (const studentId of classmateInternalIds) {
    await setDemoStudentTier(sql, studentId, "Scholar")
  }
}

export async function applyAppStoreReviewMembershipTiers(
  sql: Sql,
  instructorId: number,
  allStudentInternalIds: number[],
  primaryStudentInternalIds: number[],
) {
  await grantAppStoreReviewInstructorPro(instructorId)

  const primary = new Set(primaryStudentInternalIds)
  const primaryIds = allStudentInternalIds.filter((id) => primary.has(id))
  const classmateIds = allStudentInternalIds.filter((id) => !primary.has(id))

  if (primaryIds.length) {
    await grantAppStoreReviewPrimaryStudentTrailblazer(sql, primaryIds)
  }
  if (classmateIds.length) {
    await resetAppStoreReviewClassmatesToScholar(sql, classmateIds)
  }

  console.log(
    `App Store memberships: instructor id=${instructorId} → Pro; primary student(s) → Trailblazer (${primaryIds.length}); classmates → Scholar (${classmateIds.length})`,
  )
}
