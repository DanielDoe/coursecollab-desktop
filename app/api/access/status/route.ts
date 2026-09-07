import { type NextRequest, NextResponse } from "next/server"
import { resolveAccountAccessState } from "@/lib/access-governance/login-state"
import { AUTH_RATE_LIMIT, checkRateLimit, rateLimitKey } from "@/lib/compliance/rate-limit"

export const dynamic = "force-dynamic"

/** Public status lookup for pending applicants (no auth — rate limited). */
export async function GET(request: NextRequest) {
  try {
    const limited = checkRateLimit(
      rateLimitKey(request, "access-status"),
      AUTH_RATE_LIMIT.limit,
      AUTH_RATE_LIMIT.windowMs,
    )
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
      )
    }

    const portal = request.nextUrl.searchParams.get("portal") ?? "student"
    const loginId = request.nextUrl.searchParams.get("loginId") ?? request.nextUrl.searchParams.get("email") ?? ""
    const email = request.nextUrl.searchParams.get("email")

    if (!loginId.trim()) {
      return NextResponse.json({ error: "loginId or email required" }, { status: 400 })
    }

    const normalizedPortal =
      portal === "guest" || portal === "career_member"
        ? "guest"
        : portal === "faculty"
          ? "faculty"
          : portal === "summer" || portal === "summer_student"
            ? "summer"
            : "student"

    const snapshot = await resolveAccountAccessState({
      portal: normalizedPortal,
      loginId: loginId.trim(),
      email,
    })

    return NextResponse.json(snapshot)
  } catch (error) {
    console.error("[access/status]", error)
    return NextResponse.json({ error: "Failed to resolve access status" }, { status: 500 })
  }
}
