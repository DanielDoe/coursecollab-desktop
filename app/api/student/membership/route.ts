import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { isBetaUser, getEffectiveMembershipTier } from "@/lib/membership"
import { isExpired } from "@/lib/semester-utils"
import {
  availableBillingCadences,
  isSemesterOnlyBillingStudent,
} from "@/lib/student-billing-eligibility"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"
import { getSemesterBillingWindow } from "@/lib/semester-utils"

// Define limits based on tier (moved before GET function to avoid hoisting issues)
async function getLimits(tier: string, studentId: number) {
  // Beta users get Trailblazer limits
  const isBeta = await isBetaUser(studentId)
  if (isBeta) {
    return {
      quizzes: 3, // 3 attempts per assessment
      lectures: -1, // unlimited
      forumPosts: -1, // unlimited
      aiChats: -1, // unlimited
    }
  }
  
  switch (tier) {
    case "Scholar":
      return {
        quizzes: 1,
        lectures: -1, // unlimited
        forumPosts: -1, // unlimited
        aiChats: 0, // no access
      }
    case "Explorer":
      return {
        quizzes: 2,
        lectures: -1, // unlimited
        forumPosts: -1, // unlimited
        aiChats: 5, // 5 per day
      }
    case "Trailblazer":
      return {
        quizzes: 3, // 3 attempts per assessment
        lectures: -1, // unlimited
        forumPosts: -1, // unlimited
        aiChats: -1, // unlimited
      }
    default:
      return {
        quizzes: 1,
        lectures: -1,
        forumPosts: -1,
        aiChats: 0,
      }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    if (!studentId) {
      return NextResponse.json({ error: "Student ID required" }, { status: 400 })
    }

    const auth = await requireStudentIdParamMatchesCaller(request, studentId)
    if (!auth.ok) return auth.response
    const studentIdNum = auth.studentDbId

    // Get user membership data
    // Use COALESCE to handle both tier and plan columns (for backward compatibility)
    const membershipData = await sql`
      SELECT 
        COALESCE(m.tier, m.plan) as tier,
        m.status,
        COALESCE(m.expires_at, m.end_date) as expires_at,
        COALESCE(m.auto_renew, false) as auto_renew,
        m.created_at,
        m.updated_at
      FROM memberships m
      WHERE m.student_id = ${studentIdNum}
      ORDER BY m.created_at DESC
      LIMIT 1
    `

    // Get effective tier (Trailblazer for beta users)
    const effectiveTier = await getEffectiveMembershipTier(studentIdNum)

    let institutionalAccess = null
    try {
      const { getEffectiveStudentAccess } = await import("@/lib/entitlements/resolver")
      const { INSTITUTION_SPONSORED_STUDENT_TIER } = await import("@/lib/entitlements/feature-bundles")
      const access = await getEffectiveStudentAccess(studentIdNum)
      if (access.institutionalEntitlement === "institution_student_access") {
        institutionalAccess = {
          active: true,
          providedBy: access.providedBy,
          expiresAt: access.expiresAt,
          personalTier: access.personalTier,
          sponsoredFeatureTier: INSTITUTION_SPONSORED_STUDENT_TIER,
        }
      }
    } catch {
      /* optional */
    }

    const featureTier = institutionalAccess?.active
      ? institutionalAccess.sponsoredFeatureTier
      : effectiveTier

    const studentBillingRows = await sql`
      SELECT COALESCE(is_platform_guest, false) AS is_platform_guest
      FROM students
      WHERE id = ${studentIdNum}
      LIMIT 1
    `
    const semesterOnlyBilling = isSemesterOnlyBillingStudent(
      studentBillingRows[0]?.is_platform_guest,
    )
    const billingCadences = availableBillingCadences(semesterOnlyBilling)
    const semesterWindow = await getSemesterBillingWindow()
    
    if (membershipData.length === 0) {
      // Return default membership (Trailblazer for beta users, Scholar for others)
      const limits = await getLimits(featureTier, studentIdNum)
      return NextResponse.json({
        membership: {
          tier: effectiveTier,
          effectiveFeatureTier: featureTier,
          status: "active",
          expiresAt: null,
          autoRenew: false,
          usage: {
            quizzes: 0,
            lectures: 0,
            forumPosts: 0,
            aiChats: 0,
          },
          limits
        },
        billing: {
          semesterOnly: semesterOnlyBilling,
          availableCadences: billingCadences,
        },
        semesterWindow,
        institutionalAccess,
      })
    }

    const membership = membershipData[0]
    
    // Check if membership has expired (unless it's Scholar or beta user)
    const hasExpired = membership.expires_at && isExpired(membership.expires_at)
    if (hasExpired && membership.tier !== "Scholar" && effectiveTier === membership.tier) {
      // Auto-downgrade expired memberships (except beta users who keep Trailblazer)
      console.log(`[Membership API] Membership expired for student ${studentIdNum}, downgrading to Scholar`)
      await sql`
        UPDATE memberships
        SET 
          tier = 'Scholar',
          plan = 'Scholar',
          status = 'expired',
          auto_renew = false,
          updated_at = CURRENT_TIMESTAMP
        WHERE student_id = ${studentIdNum}
      `
      await sql`
        UPDATE students
        SET membership_tier = 'Scholar'
        WHERE id = ${studentIdNum}
      `
      membership.tier = "Scholar"
      membership.status = "expired"
    }
    
    // Override tier with effective tier for beta users
    membership.tier = effectiveTier

    // Get usage statistics
    const usageData = await sql`
      SELECT 
        COUNT(CASE WHEN qa.completed_at IS NOT NULL THEN 1 END) as quizzes_completed,
        COUNT(CASE WHEN lv.viewed_at IS NOT NULL THEN 1 END) as lectures_viewed,
        COUNT(CASE WHEN ft.created_at IS NOT NULL THEN 1 END) as forum_posts,
        COUNT(CASE WHEN at.created_at IS NOT NULL THEN 1 END) as ai_chats
      FROM students s
      LEFT JOIN quiz_attempts qa ON s.id = qa.student_id
      LEFT JOIN lecture_views lv ON s.id = lv.student_id
      LEFT JOIN forum_threads ft ON s.id = ft.student_id
      LEFT JOIN ai_tutor_sessions at ON s.id = at.student_id
      WHERE s.id = ${studentIdNum}
    `

    const usage = usageData[0] || {
      quizzes_completed: 0,
      lectures_viewed: 0,
      forum_posts: 0,
      ai_chats: 0,
    }

    const limits = await getLimits(featureTier, studentIdNum)

    return NextResponse.json({
      membership: {
        tier: effectiveTier,
        effectiveFeatureTier: featureTier,
        status: membership.status,
        expiresAt: membership.expires_at,
        autoRenew: membership.auto_renew,
        usage: {
          quizzes: parseInt(usage.quizzes_completed) || 0,
          lectures: parseInt(usage.lectures_viewed) || 0,
          forumPosts: parseInt(usage.forum_posts) || 0,
          aiChats: parseInt(usage.ai_chats) || 0,
        },
        limits
      },
      billing: {
        semesterOnly: semesterOnlyBilling,
        availableCadences: billingCadences,
      },
      semesterWindow,
      institutionalAccess,
    })
  } catch (error) {
    console.error("Failed to fetch membership data:", error)
    return NextResponse.json({ error: "Failed to fetch membership data" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, tier } = body

    if (!studentId || !tier) {
      return NextResponse.json({ error: "Student ID and tier required" }, { status: 400 })
    }

    const auth = await requireStudentIdParamMatchesCaller(request, String(studentId))
    if (!auth.ok) return auth.response
    const studentIdNum = auth.studentDbId

    // Update or create membership
    const result = await sql`
      INSERT INTO memberships (student_id, tier, status, expires_at, auto_renew)
      VALUES (${studentIdNum}, ${tier}, 'active', 
              CASE 
                WHEN ${tier} = 'Scholar' THEN NULL
                ELSE CURRENT_TIMESTAMP + INTERVAL '1 month'
              END,
              CASE 
                WHEN ${tier} = 'Scholar' THEN false
                ELSE true
              END)
      ON CONFLICT (student_id) 
      DO UPDATE SET 
        tier = ${tier},
        status = 'active',
        expires_at = CASE 
          WHEN ${tier} = 'Scholar' THEN NULL
          ELSE CURRENT_TIMESTAMP + INTERVAL '1 month'
        END,
        auto_renew = CASE 
          WHEN ${tier} = 'Scholar' THEN false
          ELSE true
        END,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `

    // Also update students.membership_tier
    await sql`
      UPDATE students
      SET membership_tier = ${tier}
      WHERE id = ${studentIdNum}
    `

    // Grant perks for the new tier
    try {
      const { grantMembershipPerks } = await import("@/lib/membership")
      await grantMembershipPerks(studentIdNum, tier as any)
      console.log(`[Membership API] Granted perks for ${tier} tier`)
    } catch (error) {
      console.error("[Membership API] Failed to grant perks:", error)
      // Don't fail the request if perks fail
    }

    return NextResponse.json({ 
      success: true, 
      membership: result[0] 
    })
  } catch (error) {
    console.error("Failed to update membership:", error)
    return NextResponse.json({ error: "Failed to update membership" }, { status: 500 })
  }
}
