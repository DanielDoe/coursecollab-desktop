import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import {
  STUDENT_CORA_MODULE_REGISTRY,
  STUDENT_CORA_AUTHORIZATION_PRINCIPLE,
  buildStudentCapabilityPacket,
  type StudentCoraModuleId,
} from "@/lib/cora/capabilities/student-module-registry"
import {
  resolveAssessmentIntegrityContext,
  formatAssessmentIntegrityForPrompt,
} from "@/lib/cora/security/assessment-integrity"
import { buildStudentCoraSession } from "@/lib/cora/security"

export const dynamic = "force-dynamic"

/**
 * GET /api/cora/student-capabilities
 * Returns the Student Cora module capability boundary + optional assessment integrity.
 *
 * Cora clients should load this instead of hard-coding permissions.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const assessmentIdParam = searchParams.get("assessmentId")
    const assessmentId =
      assessmentIdParam != null && Number.isFinite(Number(assessmentIdParam))
        ? Number(assessmentIdParam)
        : null
    const modulesParam = searchParams.get("modules")
    const moduleIds = (modulesParam?.split(",").filter(Boolean) ?? []) as StudentCoraModuleId[]

    const session = await buildStudentCoraSession({ studentDbId: auth.studentDbId })
    const integrity = await resolveAssessmentIntegrityContext(auth.studentDbId, assessmentId)

    const registry =
      moduleIds.length > 0
        ? Object.fromEntries(
            moduleIds
              .filter((id) => STUDENT_CORA_MODULE_REGISTRY[id])
              .map((id) => [id, STUDENT_CORA_MODULE_REGISTRY[id]]),
          )
        : STUDENT_CORA_MODULE_REGISTRY

    return NextResponse.json({
      principle: STUDENT_CORA_AUTHORIZATION_PRINCIPLE,
      principal: {
        userId: session.userId,
        role: session.role,
        courseIds: session.courseIds,
        membershipTier: session.membershipTier,
      },
      modules: registry,
      packet:
        moduleIds.length > 0
          ? buildStudentCapabilityPacket(moduleIds)
          : buildStudentCapabilityPacket([
              "notes",
              "flashcards",
              "calendar",
              "practice",
              "grades",
              "quizzes",
              "lectures",
            ]),
      assessmentIntegrity: integrity,
      assessmentIntegrityPrompt: formatAssessmentIntegrityForPrompt(integrity),
    })
  } catch (error) {
    console.error("[cora/student-capabilities]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load capabilities" },
      { status: 500 },
    )
  }
}
