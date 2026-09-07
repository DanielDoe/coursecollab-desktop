import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { getAssessmentImportAccess } from "@/lib/cora/assessment-import-gate"
import { resolveImportedQuestion } from "@/lib/cora/resolve-question-import"
import {
  listImportContainers,
  listImportQuestionsInContainer,
  listImportSources,
  type ImportSourceKey,
} from "@/lib/cora/question-import-browse"
import type { CoraQuestionImportResolveInput } from "@/lib/cora/question-import-types"

export const dynamic = "force-dynamic"

const SOURCE_KEYS = new Set([
  "quizzes",
  "homework",
  "mid_semester",
  "final_exam",
  "practice_hub",
  "lecture_workspace",
  "classroom_points",
])

function parsePurpose(raw: string | null | undefined): "cora" | "messages" {
  return raw === "messages" ? "messages" : "cora"
}

async function resolveStudent(request: NextRequest) {
  const auth = await requireCallerStudentDbId(request)
  if (!auth.ok) return { error: auth.response }
  return { studentDatabaseId: auth.studentDbId }
}

export async function GET(request: NextRequest) {
  try {
    const resolved = await resolveStudent(request)
    if ("error" in resolved) return resolved.error

    const level = request.nextUrl.searchParams.get("level") || "sources"
    const sourceKey = request.nextUrl.searchParams.get("sourceKey") as ImportSourceKey | null
    const containerId = request.nextUrl.searchParams.get("containerId")
    const purpose = parsePurpose(request.nextUrl.searchParams.get("purpose"))
    const forMessages = purpose === "messages"

    if (level === "sources") {
      const sources = await listImportSources(resolved.studentDatabaseId)
      return NextResponse.json({ level: "sources", sources, purpose })
    }

    if (level === "containers") {
      if (!sourceKey || !SOURCE_KEYS.has(sourceKey)) {
        return NextResponse.json({ error: "Valid sourceKey required" }, { status: 400 })
      }
      const containers = await listImportContainers(resolved.studentDatabaseId, sourceKey, { purpose })
      return NextResponse.json({ level: "containers", sourceKey, containers, purpose })
    }

    if (level === "questions") {
      if (!sourceKey || !SOURCE_KEYS.has(sourceKey) || !containerId) {
        return NextResponse.json({ error: "sourceKey and containerId required" }, { status: 400 })
      }

      const assessmentSources = new Set(["quizzes", "homework", "mid_semester", "final_exam"])
      if (!forMessages && assessmentSources.has(sourceKey)) {
        const quizId = Number(containerId)
        if (Number.isFinite(quizId)) {
          const access = await getAssessmentImportAccess(resolved.studentDatabaseId, quizId)
          if (!access.allowed) {
            return NextResponse.json(
              {
                level: "questions",
                sourceKey,
                containerId,
                items: [],
                locked: true,
                lockReason: access.message,
                accessStatus: access.status,
                error: access.message,
                purpose,
              },
              { status: 403 },
            )
          }
        }
      }

      const items = await listImportQuestionsInContainer(
        resolved.studentDatabaseId,
        sourceKey,
        containerId,
        { purpose },
      )
      return NextResponse.json({ level: "questions", sourceKey, containerId, items, purpose })
    }

    return NextResponse.json({ error: "Invalid level" }, { status: 400 })
  } catch (error) {
    console.error("[cora/question-import GET]", error)
    return NextResponse.json({ error: "Failed to load" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CoraQuestionImportResolveInput
    const purpose = parsePurpose(body.purpose)

    if (!body?.source) {
      return NextResponse.json({ error: "source is required" }, { status: 400 })
    }

    const resolved = await resolveStudent(request)
    if ("error" in resolved) return resolved.error
    const studentDatabaseId = resolved.studentDatabaseId

    const problem = await resolveImportedQuestion({ ...body, studentDatabaseId, purpose })
    return NextResponse.json({ problem, purpose })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to import question"
    const locked =
      /attempt this assessment|submit this assessment|haven't submitted|still pending|in progress/i.test(
        msg,
      )
    console.error("[cora/question-import POST]", error)
    return NextResponse.json({ error: msg, locked }, { status: locked ? 403 : 400 })
  }
}
