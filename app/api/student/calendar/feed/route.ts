import { NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { getOrCreateCalendarFeed, updateCalendarFeedPrefs } from "@/lib/calendar/feed-token"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await requireCallerStudentDbId(request)
  if (!session.ok) return session.response
  const feed = await getOrCreateCalendarFeed("student", session.studentDbId)
  return NextResponse.json({ success: true, ...feed })
}

export async function PATCH(request: NextRequest) {
  const session = await requireCallerStudentDbId(request)
  if (!session.ok) return session.response
  const body = (await request.json().catch(() => ({}))) as { beforeMinutes?: number; atStart?: boolean }
  const feed = await updateCalendarFeedPrefs("student", session.studentDbId, body)
  return NextResponse.json({ success: true, ...feed })
}
