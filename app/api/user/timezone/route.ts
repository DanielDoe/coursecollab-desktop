import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureUserTimezoneSchema } from "@/lib/ensure-user-timezone-schema"
import {
  DEFAULT_USER_TIMEZONE,
  isValidTimezone,
  normalizeTimezone,
  type UserTimezoneRole,
} from "@/lib/user-timezone"

export const dynamic = "force-dynamic"

function parseRole(raw: string | null): UserTimezoneRole | null {
  if (raw === "student" || raw === "instructor" || raw === "admin") return raw
  return null
}

async function fetchTimezone(role: UserTimezoneRole, userId: number): Promise<string | null> {
  if (role === "student") {
    const rows = await sql`SELECT timezone FROM students WHERE id = ${userId} LIMIT 1`
    return (rows[0]?.timezone as string | null) ?? null
  }
  if (role === "instructor") {
    const rows = await sql`SELECT timezone FROM instructors WHERE id = ${userId} LIMIT 1`
    return (rows[0]?.timezone as string | null) ?? null
  }
  const rows = await sql`SELECT timezone FROM admin_users WHERE id = ${userId} LIMIT 1`
  return (rows[0]?.timezone as string | null) ?? null
}

async function saveTimezone(role: UserTimezoneRole, userId: number, timezone: string) {
  if (role === "student") {
    await sql`UPDATE students SET timezone = ${timezone} WHERE id = ${userId}`
    return
  }
  if (role === "instructor") {
    await sql`UPDATE instructors SET timezone = ${timezone} WHERE id = ${userId}`
    return
  }
  await sql`UPDATE admin_users SET timezone = ${timezone} WHERE id = ${userId}`
}

export async function GET(request: Request) {
  try {
    await ensureUserTimezoneSchema()
    const { searchParams } = new URL(request.url)
    const role = parseRole(searchParams.get("role"))
    const userIdRaw = searchParams.get("userId")
    const userId = userIdRaw ? parseInt(userIdRaw, 10) : NaN

    if (!role || !Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: "role and userId are required" }, { status: 400 })
    }

    const stored = await fetchTimezone(role, userId)
    const timezone = normalizeTimezone(stored)

    return NextResponse.json({
      success: true,
      timezone,
      stored: stored && isValidTimezone(stored) ? stored : null,
      defaultTimezone: DEFAULT_USER_TIMEZONE,
    })
  } catch (error) {
    console.error("[user/timezone GET]", error)
    return NextResponse.json({ error: "Failed to load timezone" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    await ensureUserTimezoneSchema()
    const body = await request.json()
    const role = parseRole(body.role)
    const userId = typeof body.userId === "number" ? body.userId : parseInt(String(body.userId ?? ""), 10)
    const timezoneRaw = body.timezone

    if (!role || !Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: "role and userId are required" }, { status: 400 })
    }
    if (!isValidTimezone(timezoneRaw)) {
      return NextResponse.json({ error: "Invalid timezone" }, { status: 400 })
    }

    const timezone = normalizeTimezone(timezoneRaw)
    await saveTimezone(role, userId, timezone)

    return NextResponse.json({ success: true, timezone })
  } catch (error) {
    console.error("[user/timezone PUT]", error)
    return NextResponse.json({ error: "Failed to save timezone" }, { status: 500 })
  }
}
