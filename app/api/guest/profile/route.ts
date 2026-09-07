import { type NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { sql } from "@/lib/db"
import { requirePlatformGuestDatabaseId } from "@/lib/require-platform-guest"

export const dynamic = "force-dynamic"

function splitFullName(full: string): { firstName: string; lastName: string } {
  const t = full.trim()
  if (!t) return { firstName: "", lastName: "" }
  const parts = t.split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: "" }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

export async function GET(request: NextRequest) {
  try {
    const raw = (new URL(request.url).searchParams.get("studentDatabaseId") ?? "").trim()
    if (!raw) return NextResponse.json({ error: "student id required" }, { status: 400 })

    const guestId = await requirePlatformGuestDatabaseId(raw)
    if (guestId == null) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const rows = await sql`
      SELECT full_name, email, guest_organization
      FROM students
      WHERE id = ${guestId}
      LIMIT 1
    `
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const row = rows[0] as { full_name: string; email: string | null; guest_organization: string | null }
    const { firstName, lastName } = splitFullName(row.full_name ?? "")

    return NextResponse.json({
      firstName,
      lastName,
      email: row.email ?? "",
      organization: row.guest_organization ?? "",
    })
  } catch (e) {
    console.error("[guest/profile GET]", e)
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const raw = String(body.studentDatabaseId ?? body.studentId ?? "").trim()
    if (!raw) return NextResponse.json({ error: "student id required" }, { status: 400 })

    const guestId = await requirePlatformGuestDatabaseId(raw)
    if (guestId == null) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const hasProfileFields =
      body.firstName != null || body.lastName != null || body.email != null || body.organization != null
    const currentPassword =
      body.currentPassword != null && String(body.currentPassword).length > 0
        ? String(body.currentPassword)
        : ""
    const newPassword =
      body.newPassword != null && String(body.newPassword).length > 0 ? String(body.newPassword) : ""

    // Password-only update from Settings → Password & security
    if (!hasProfileFields && (currentPassword || newPassword)) {
      if (!currentPassword || !newPassword) {
        return NextResponse.json(
          { error: "Enter both current password and new password to change password" },
          { status: 400 },
        )
      }
      if (newPassword.length < 8) {
        return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 })
      }
      if (!/\d/.test(newPassword)) {
        return NextResponse.json({ error: "New password must contain at least one number" }, { status: 400 })
      }
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
        return NextResponse.json(
          { error: "New password must contain at least one special character" },
          { status: 400 },
        )
      }

      const students = await sql`SELECT password_hash, full_name FROM students WHERE id = ${guestId} LIMIT 1`
      if (students.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
      const row = students[0] as { password_hash: string; full_name: string | null }
      const ok = await bcrypt.compare(currentPassword, row.password_hash)
      if (!ok) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 })
      }

      const hash = await bcrypt.hash(newPassword, 10)
      await sql`
        UPDATE students
        SET password_hash = ${hash}, has_changed_password = true
        WHERE id = ${guestId}
      `
      return NextResponse.json({ success: true, fullName: row.full_name ?? "" })
    }

    const firstName = String(body.firstName ?? "").trim()
    const lastName = String(body.lastName ?? "").trim()
    const email = String(body.email ?? "").trim().toLowerCase()
    const organization = String(body.organization ?? body.guest_organization ?? "").trim()

    if (!firstName) {
      return NextResponse.json({ error: "First name is required" }, { status: 400 })
    }
    if (!email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email" }, { status: 400 })
    }
    if (!organization) {
      return NextResponse.json({ error: "Organization is required" }, { status: 400 })
    }

    const dup = await sql`
      SELECT id FROM students
      WHERE TRIM(LOWER(COALESCE(email, ''))) = ${email}
        AND id <> ${guestId}
      LIMIT 1
    `
    if (dup.length > 0) {
      return NextResponse.json({ error: "Another account already uses this email" }, { status: 409 })
    }

    const fullName = lastName ? `${firstName} ${lastName}`.trim() : firstName.trim()

    if (currentPassword || newPassword) {
      if (!currentPassword || !newPassword) {
        return NextResponse.json(
          { error: "Enter both current password and new password to change password" },
          { status: 400 },
        )
      }
      if (newPassword.length < 8) {
        return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 })
      }
      if (!/\d/.test(newPassword)) {
        return NextResponse.json({ error: "New password must contain at least one number" }, { status: 400 })
      }
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
        return NextResponse.json(
          { error: "New password must contain at least one special character" },
          { status: 400 },
        )
      }

      const students = await sql`SELECT password_hash FROM students WHERE id = ${guestId} LIMIT 1`
      if (students.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
      const row = students[0] as { password_hash: string }
      const ok = await bcrypt.compare(currentPassword, row.password_hash)
      if (!ok) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 })
      }

      const hash = await bcrypt.hash(newPassword, 10)
      await sql`
        UPDATE students
        SET
          full_name = ${fullName},
          email = ${email},
          guest_organization = ${organization},
          password_hash = ${hash},
          has_changed_password = true
        WHERE id = ${guestId}
      `
    } else {
      await sql`
        UPDATE students
        SET
          full_name = ${fullName},
          email = ${email},
          guest_organization = ${organization}
        WHERE id = ${guestId}
      `
    }

    return NextResponse.json({ success: true, fullName })
  } catch (e) {
    console.error("[guest/profile PATCH]", e)
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}
