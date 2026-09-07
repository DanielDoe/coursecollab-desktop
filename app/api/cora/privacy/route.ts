import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import {
  getCoraPrivacySettings,
  setCoraPrivacySettings,
  type CoraPrivacySettings,
} from "@/lib/cora/privacy/cora-privacy-settings"
import {
  getCoraActorPrivacySettings,
  setCoraActorPrivacySettings,
} from "@/lib/cora/privacy/cora-actor-privacy-settings"

export const dynamic = "force-dynamic"

function studentPayload(settings: CoraPrivacySettings) {
  return {
    actorType: "student" as const,
    ...settings,
    shareWithInstructor: settings.shareWithInstructor,
  }
}

function actorPayload(
  actorType: "instructor" | "admin",
  settings: { personalizedLearning: boolean; useLearningContext: boolean },
) {
  return {
    actorType,
    personalizedLearning: settings.personalizedLearning,
    useLearningContext: settings.useLearningContext,
    shareWithInstructor: false,
  }
}

export async function GET(request: NextRequest) {
  const student = await requireCallerStudentDbId(request)
  if (student.ok) {
    const settings = await getCoraPrivacySettings(student.studentDbId)
    return NextResponse.json(studentPayload(settings))
  }

  const instructor = await requireInstructorSession(request)
  if (instructor.ok) {
    const settings = await getCoraActorPrivacySettings("instructor", String(instructor.instructorId))
    return NextResponse.json(actorPayload("instructor", settings))
  }

  const admin = await requireAdminId(request)
  if (admin.ok) {
    const settings = await getCoraActorPrivacySettings("admin", admin.adminId)
    return NextResponse.json(actorPayload("admin", settings))
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

export async function PUT(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Partial<CoraPrivacySettings> & {
    shareWithInstructor?: unknown
  }

  const student = await requireCallerStudentDbId(request)
  if (student.ok) {
    const patch: Partial<CoraPrivacySettings> = {}
    if (typeof body.personalizedLearning === "boolean") patch.personalizedLearning = body.personalizedLearning
    if (typeof body.useLearningContext === "boolean") patch.useLearningContext = body.useLearningContext
    if (typeof body.shareWithInstructor === "boolean") patch.shareWithInstructor = body.shareWithInstructor
    const settings = await setCoraPrivacySettings(student.studentDbId, patch)
    return NextResponse.json(studentPayload(settings))
  }

  const instructor = await requireInstructorSession(request)
  if (instructor.ok) {
    const patch: Partial<{ personalizedLearning: boolean; useLearningContext: boolean }> = {}
    if (typeof body.personalizedLearning === "boolean") patch.personalizedLearning = body.personalizedLearning
    if (typeof body.useLearningContext === "boolean") patch.useLearningContext = body.useLearningContext
    const settings = await setCoraActorPrivacySettings("instructor", String(instructor.instructorId), patch)
    return NextResponse.json(actorPayload("instructor", settings))
  }

  const admin = await requireAdminId(request)
  if (admin.ok) {
    const patch: Partial<{ personalizedLearning: boolean; useLearningContext: boolean }> = {}
    if (typeof body.personalizedLearning === "boolean") patch.personalizedLearning = body.personalizedLearning
    if (typeof body.useLearningContext === "boolean") patch.useLearningContext = body.useLearningContext
    const settings = await setCoraActorPrivacySettings("admin", admin.adminId, patch)
    return NextResponse.json(actorPayload("admin", settings))
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
