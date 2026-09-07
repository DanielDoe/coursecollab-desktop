import { type NextRequest, NextResponse } from "next/server"
import {
  fetchInstructorDoorQrBundle,
  saveInstructorDoorQrBundle,
} from "@/lib/office-hours-public-profile"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { parseUniversityIdFromRequest } from "@/lib/instructor-university-scope"
import { readInstructorSessionScopeFromRequest } from "@/lib/instructor-session-scope"

export const dynamic = "force-dynamic"

function parseTermId(request: NextRequest): number | null {
  const raw =
    request.headers.get("x-academic-term-id")?.trim() ||
    request.nextUrl.searchParams.get("academicTermId")?.trim() ||
    ""
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response

    const universityId = parseUniversityIdFromRequest(request)
    const scope = readInstructorSessionScopeFromRequest(request)
    const academicTermId = scope.academicTermId ?? parseTermId(request)

    const bundle = await fetchInstructorDoorQrBundle(session.instructorId, universityId, academicTermId)
    if (!bundle) {
      return NextResponse.json({ error: "Unable to load door QR settings" }, { status: 500 })
    }
    return NextResponse.json(bundle)
  } catch (error) {
    console.error("[Door QR] GET:", error)
    return NextResponse.json({ error: "Failed to load door QR settings" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response

    const body = await request.json()
    const academicTermId = Math.trunc(Number(body.academicTermId))
    if (!Number.isFinite(academicTermId) || academicTermId < 1) {
      return NextResponse.json({ error: "academicTermId is required" }, { status: 400 })
    }

    const universityId =
      body.universityId != null ? Math.trunc(Number(body.universityId)) : parseUniversityIdFromRequest(request)

    const bundle = await saveInstructorDoorQrBundle(session.instructorId, {
      universityId: Number.isFinite(universityId) && universityId! > 0 ? universityId : null,
      academicTermId,
      defaultOfficeLocation: body.defaultOfficeLocation,
      publicNote: body.publicNote,
      instructorContact: body.instructorContact,
      courses: Array.isArray(body.courses) ? body.courses : [],
    })

    if (!bundle) {
      return NextResponse.json({ error: "Unable to save door QR settings" }, { status: 500 })
    }

    return NextResponse.json({ success: true, ...bundle })
  } catch (error) {
    console.error("[Door QR] POST:", error)
    return NextResponse.json({ error: "Failed to save door QR settings" }, { status: 500 })
  }
}
