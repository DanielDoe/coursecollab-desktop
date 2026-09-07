import { NextRequest, NextResponse } from "next/server"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { sql } from "@/lib/db"
import { ensureCourseExchangeSchema } from "@/lib/course-exchange/schema"

export const dynamic = "force-dynamic"

/** Pending incoming Course Exchange requests count (faculty badge). */
export async function GET(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response

    await ensureCourseExchangeSchema()
    const [row] = (await sql`
      SELECT
        COUNT(*) FILTER (
          WHERE source_instructor_id = ${session.instructorId}
            AND (
              status = 'PENDING'
              OR EXISTS (
                SELECT 1
                FROM course_exchange_copies copy
                WHERE copy.request_id = course_exchange_requests.id
                  AND EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements_text(course_exchange_requests.requested_modules) AS req(mod)
                    WHERE NOT req.mod = ANY(
                      SELECT jsonb_array_elements_text(copy.approved_modules)
                    )
                  )
              )
            )
        )::int AS received_pending,
        COUNT(*) FILTER (
          WHERE requester_instructor_id = ${session.instructorId}
            AND status IN ('PENDING', 'APPROVED', 'FAILED')
        )::int AS sent_active
      FROM course_exchange_requests
    `) as { received_pending: number; sent_active: number }[]

    const receivedPending = row?.received_pending ?? 0
    const sentActive = row?.sent_active ?? 0

    return NextResponse.json({
      pending: receivedPending,
      receivedPending,
      sentActive,
      sentActionable: sentActive,
    })
  } catch (error) {
    console.error("[course-exchange/summary]", error)
    return NextResponse.json({ pending: 0 })
  }
}
