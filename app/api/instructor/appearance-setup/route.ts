import { type NextRequest, NextResponse } from "next/server"
import {
  APPEARANCE_SETUP_MODULE,
  isInstructorAppearanceSetupCompleted,
  markInstructorAppearanceSetupCompleted,
} from "@/lib/appearance/appearance-setup-server"

export const dynamic = "force-dynamic"

/**
 * Instructor counterpart of /api/student/appearance-setup.
 *
 * There is no instructor equivalent of `requireStudentIdParamMatchesCaller`,
 * and the neighbouring instructor routes trust an id in the query string with
 * no check at all. This at least requires the caller to present the same id in
 * the `x-instructor-id` header that `buildInstructorApiHeaders()` already
 * sends, so a bare URL cannot flip another instructor's flag. It is a
 * consistency check, not real authentication — worth replacing with a shared
 * instructor auth helper when one exists.
 */
function resolveInstructorId(request: NextRequest, claimed: string | null): number | null {
  const header = request.headers.get("x-instructor-id")
  if (!header || !claimed) return null
  if (header.trim() !== String(claimed).trim()) return null
  const parsed = Number.parseInt(String(claimed).trim(), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function GET(request: NextRequest) {
  try {
    const claimed = request.nextUrl.searchParams.get("instructorId")
    const instructorId = resolveInstructorId(request, claimed)
    if (instructorId === null) {
      return NextResponse.json({ error: "Instructor identity required" }, { status: 401 })
    }

    const completed = await isInstructorAppearanceSetupCompleted(instructorId)
    return NextResponse.json({ completed, module: APPEARANCE_SETUP_MODULE })
  } catch (error) {
    console.error("[instructor/appearance-setup GET]", error)
    return NextResponse.json({ error: "Failed to load appearance setup status" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const instructorId = resolveInstructorId(request, body?.instructorId ?? null)
    if (instructorId === null) {
      return NextResponse.json({ error: "Instructor identity required" }, { status: 401 })
    }

    await markInstructorAppearanceSetupCompleted(instructorId)
    return NextResponse.json({ success: true, completed: true })
  } catch (error) {
    console.error("[instructor/appearance-setup POST]", error)
    return NextResponse.json({ error: "Failed to save appearance setup" }, { status: 500 })
  }
}
