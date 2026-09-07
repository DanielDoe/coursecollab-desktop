import { NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { sql } from "@/lib/db"
import { checkAndAwardBadges } from "@/lib/codebench-badges"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const auth = await requireCodebenchStudent(request, searchParams.get("studentId"))
    if (!auth.ok) return auth.response

    await checkAndAwardBadges(auth.studentDbId)

    const earnedBadges = await sql`
      SELECT badge_type, badge_name, badge_icon, badge_color, earned_at
      FROM student_achievements
      WHERE student_id = ${auth.studentDbId}
    `

    const badges: { [key: string]: boolean } = {}
    const badgeDetails: { [key: string]: { name: string; icon: string; earnedAt: string } } = {}

    earnedBadges.forEach((badge: any) => {
      badges[badge.badge_type] = true
      badgeDetails[badge.badge_type] = {
        name: badge.badge_name,
        icon: badge.badge_icon,
        earnedAt: badge.earned_at?.toISOString() || new Date().toISOString()
      }
    })

    return NextResponse.json({ badges, badgeDetails })
  } catch (error) {
    console.error("Badges check error:", error)
    return NextResponse.json({ error: "Failed to check badges" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    let claimed: string | null = null
    try {
      const body = await request.json()
      claimed = body?.studentId != null ? String(body.studentId) : null
    } catch {
      claimed = null
    }
    const auth = await requireCodebenchStudent(request, claimed)
    if (!auth.ok) return auth.response

    await checkAndAwardBadges(auth.studentDbId)

    return NextResponse.json({ success: true, message: "Badges checked and awarded" })
  } catch (error) {
    console.error("Badge award error:", error)
    return NextResponse.json({ error: "Failed to award badges" }, { status: 500 })
  }
}
