import { type NextRequest, NextResponse } from "next/server"
import { loadInstructorActor } from "@/lib/instructor-actor-scope"

/** Institution-wide academic-term mutations — any active instructor/TA. */
export async function requireAcademicTermInstructor(request: Request | NextRequest) {
  const instructorIdRaw = request.headers.get("x-instructor-id")
  if (!instructorIdRaw) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  const instructorId = Number(instructorIdRaw)
  if (!Number.isFinite(instructorId) || instructorId <= 0) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  const actor = await loadInstructorActor(instructorId)
  if (!actor || !actor.is_active) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  return { ok: true as const, instructorId, actor }
}
