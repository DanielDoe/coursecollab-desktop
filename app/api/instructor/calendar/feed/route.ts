import { NextRequest, NextResponse } from "next/server"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { getOrCreateCalendarFeed, updateCalendarFeedPrefs } from "@/lib/calendar/feed-token"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await requireInstructorSession(request)
  if (!session.ok) return session.response
  const feed = await getOrCreateCalendarFeed("faculty", session.instructorId)
  return NextResponse.json({ success: true, ...feed })
}

export async function PATCH(request: NextRequest) {
  const session = await requireInstructorSession(request)
  if (!session.ok) return session.response
  const body = (await request.json().catch(() => ({}))) as { beforeMinutes?: number; atStart?: boolean }
  const feed = await updateCalendarFeedPrefs("faculty", session.instructorId, body)
  return NextResponse.json({ success: true, ...feed })
}
