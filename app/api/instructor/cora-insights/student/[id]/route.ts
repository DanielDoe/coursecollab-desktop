import { type NextRequest, NextResponse } from "next/server"
import { resolveFacultyInsightsScope } from "@/lib/cora/insights/scope"
import { loadStudentProfile } from "@/lib/cora/insights/query"
import { assignTargetedPractice } from "@/lib/cora/insights/assign-practice"

export const dynamic = "force-dynamic"
export const maxDuration = 60

async function scopedStudent(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const resolved = await resolveFacultyInsightsScope(request)
  if (!resolved.ok) return resolved
  const { id } = await ctx.params
  const studentId = Number(id)
  if (!Number.isFinite(studentId) || !resolved.scope.rosterIds.includes(studentId)) {
    return { ok: false as const, response: NextResponse.json({ error: "Student not in course scope" }, { status: 404 }) }
  }
  return { ok: true as const, scope: resolved.scope, studentId }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const resolved = await scopedStudent(request, ctx)
  if (!resolved.ok) return resolved.response
  try {
    const data = await loadStudentProfile(resolved.scope, resolved.studentId)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error("[cora-insights/student]", error)
    return NextResponse.json({ error: "Failed to load student profile" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const resolved = await scopedStudent(request, ctx)
  if (!resolved.ok) return resolved.response
  const action = request.nextUrl.searchParams.get("action")
  if (action !== "assign-practice") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }
  try {
    const data = await assignTargetedPractice(resolved.scope, resolved.studentId)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error("[cora-insights/assign-practice]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to assign targeted practice" },
      { status: 500 },
    )
  }
}
