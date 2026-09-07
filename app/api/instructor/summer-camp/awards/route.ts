import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireSummerCampStaff } from "@/lib/summer-camp/permissions"
import { isFacultyAssignedToTraining } from "@/lib/summer-camp/permissions"
import {
  assignShowcaseAward,
  listTrainingAwards,
  SHOWCASE_AWARD_TYPES,
  type ShowcaseAwardType,
} from "@/lib/summer-camp/showcase"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const trainingId = Number(request.nextUrl.searchParams.get("trainingId"))
    if (!Number.isFinite(trainingId)) {
      return NextResponse.json({ error: "trainingId required" }, { status: 400 })
    }

    const assigned = await isFacultyAssignedToTraining(scope.instructorId, trainingId)
    if (!assigned) {
      return NextResponse.json({ error: "Not assigned" }, { status: 403 })
    }

    const awards = await listTrainingAwards(trainingId)
    return NextResponse.json({ awards, award_types: SHOWCASE_AWARD_TYPES })
  } catch (error) {
    console.error("[instructor/summer-camp/awards GET]", error)
    return NextResponse.json({ error: "Failed to load awards" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const { training_id, student_id, award_type, entry_id } = await request.json()
    const trainingId = Number(training_id)
    const studentId = Number(student_id)

    if (!Number.isFinite(trainingId) || !Number.isFinite(studentId) || !award_type) {
      return NextResponse.json({ error: "training_id, student_id, award_type required" }, { status: 400 })
    }

    if (!(award_type in SHOWCASE_AWARD_TYPES)) {
      return NextResponse.json({ error: "Invalid award_type" }, { status: 400 })
    }

    const assigned = await isFacultyAssignedToTraining(scope.instructorId, trainingId)
    if (!assigned) {
      return NextResponse.json({ error: "Not assigned" }, { status: 403 })
    }

    const enrolled = await sql`
      SELECT 1 FROM camp_enrollments
      WHERE student_id = ${studentId} AND training_id = ${trainingId}
      LIMIT 1
    `
    if (enrolled.length === 0) {
      return NextResponse.json({ error: "Student not in training" }, { status: 400 })
    }

    const award = await assignShowcaseAward(
      trainingId,
      studentId,
      award_type as ShowcaseAwardType,
      scope.instructorId,
      entry_id ? Number(entry_id) : undefined,
    )

    return NextResponse.json({ award })
  } catch (error) {
    console.error("[instructor/summer-camp/awards POST]", error)
    return NextResponse.json({ error: "Failed to assign award" }, { status: 500 })
  }
}
