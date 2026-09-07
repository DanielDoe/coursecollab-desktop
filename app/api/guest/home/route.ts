import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requirePlatformGuestDatabaseId } from "@/lib/require-platform-guest"
import { resolveGuestCapabilities } from "@/lib/guest/entitlements"
import { normalizeGuestOnboardingPurpose, guestOnboardingPurposeLabel } from "@/lib/guest/onboarding"
import { purposeLabel as recPurposeLabel } from "@/lib/recommendation-letters-shared"
import { getGuestMasterResume, listGuestApplications } from "@/lib/guest/career/store"

export const dynamic = "force-dynamic"

function greetingName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0]
  return first || "there"
}

function timeGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

/** Guest home dashboard data. */
export async function GET(request: NextRequest) {
  try {
    const raw = (new URL(request.url).searchParams.get("studentDatabaseId") ?? "").trim()
    if (!raw) return NextResponse.json({ error: "student id required" }, { status: 400 })

    const guestId = await requirePlatformGuestDatabaseId(raw)
    if (guestId == null) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const entitlements = await resolveGuestCapabilities(guestId)

    const profileRows = await sql`
      SELECT full_name, guest_access_purpose, guest_organization
      FROM students WHERE id = ${guestId} LIMIT 1
    `
    const profile = profileRows[0] as
      | { full_name: string; guest_access_purpose: string | null; guest_organization: string | null }
      | undefined

    const onboardingPurpose = normalizeGuestOnboardingPurpose(profile?.guest_access_purpose)
    const fullName = profile?.full_name ?? "Guest"

    const requestRows = await sql`
      SELECT r.id, r.status, r.purpose, r.deadline, r.updated_at, i.name AS instructor_name
      FROM recommendation_requests r
      JOIN instructors i ON i.id = r.instructor_id
      WHERE r.student_id = ${guestId}
      ORDER BY r.updated_at DESC
      LIMIT 8
    `

    const requests = (requestRows as Record<string, unknown>[]).map((r) => ({
      id: Number(r.id),
      status: String(r.status),
      purpose: recPurposeLabel(String(r.purpose)),
      deadline: r.deadline ? String(r.deadline) : null,
      instructorName: String(r.instructor_name ?? ""),
      updatedAt: String(r.updated_at ?? ""),
    }))

    const active = requests.filter((r) => !["rejected", "downloaded"].includes(r.status))
    const nextDeadline = [...requests]
      .filter((r) => r.deadline)
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())[0]

    const [masterResume, applications] = await Promise.all([
      getGuestMasterResume(guestId),
      listGuestApplications(guestId),
    ])
    const latestScored = applications.find((a) => a.matchScore != null)

    return NextResponse.json({
      greeting: `${timeGreeting()}, ${greetingName(fullName)}`,
      fullName,
      organization: profile?.guest_organization ?? "",
      onboardingPurpose,
      onboardingLabel: guestOnboardingPurposeLabel(onboardingPurpose),
      plan: entitlements.plan,
      capabilities: entitlements.capabilities,
      recommendations: {
        total: requests.length,
        activeCount: active.length,
        latest: active[0] ?? null,
      },
      upcoming: nextDeadline
        ? {
            kind: "recommendation_deadline" as const,
            label: "Recommendation deadline",
            date: nextDeadline.deadline,
            requestId: nextDeadline.id,
          }
        : null,
      recentRequests: requests.slice(0, 4),
      career: {
        hasMasterResume: Boolean(masterResume?.parsedText?.trim()),
        resumeUpdatedAt: masterResume?.updatedAt ?? null,
        resumeFileName: masterResume?.originalFileName ?? null,
        applicationCount: applications.length,
        latestMatchScore: latestScored?.matchScore ?? null,
        latestMatchBand: latestScored?.matchBand ?? null,
        latestApplicationId: latestScored?.id ?? null,
      },
    })
  } catch (e) {
    console.error("[guest/home GET]", e)
    return NextResponse.json({ error: "Failed to load Career Member home" }, { status: 500 })
  }
}
