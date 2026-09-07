import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Server-side debug log endpoint.
 * Accepts POST with { tag, message, data? } and logs to server stdout (terminal).
 * Use from client components to see logs in the dev server terminal instead of browser console.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { tag = "Quiz", message, data } = body
    const prefix = `[${tag}]`
    if (data !== undefined && data !== null) {
      console.log(prefix, message, data)
    } else {
      console.log(prefix, message)
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
