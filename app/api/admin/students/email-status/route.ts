/**
 * GET /api/admin/students/email-status
 * Returns count of students with valid emails vs total (for notification readiness)
 */

import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

const PLACEHOLDER_PATTERNS = [
  /@student\.placeholder\.edu$/i,
  /@example\.com$/i,
  /^[^@]+@placeholder/i,
]

function isValidEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string" || !email.includes("@")) return false
  return !PLACEHOLDER_PATTERNS.some((p) => p.test(email.trim()))
}

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const [total] = await sql`
      SELECT COUNT(*)::int as count FROM students
    `
    const [withEmail] = await sql`
      SELECT COUNT(*)::int as count FROM students
      WHERE email IS NOT NULL AND email != '' AND email NOT LIKE '%@student.placeholder.edu'
        AND email NOT LIKE '%@example.com'
    `
    const totalCount = total?.count ?? 0
    const withValidEmail = withEmail?.count ?? 0
    const missingEmail = totalCount - withValidEmail

    return NextResponse.json({
      total: totalCount,
      withValidEmail,
      missingEmail,
      percentReady: totalCount > 0 ? Math.round((withValidEmail / totalCount) * 100) : 0,
      message:
        missingEmail > 0
          ? `${missingEmail} student(s) need email addresses for notifications.`
          : "All students have valid emails on file.",
    })
  } catch (error) {
    console.error("[Email Status] Error:", error)
    return NextResponse.json({ error: "Failed to fetch email status" }, { status: 500 })
  }
}
