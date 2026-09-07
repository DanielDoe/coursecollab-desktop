import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorQuestionBankScope } from "@/lib/instructor-question-bank-scope"
import {
  deleteCustomQuestionType,
  listCustomQuestionTypesForCourse,
  saveCustomQuestionType,
} from "@/lib/custom-question-types-server"
import { validateCustomQuestionTypeDraft, type CustomQuestionTypeDraft } from "@/lib/custom-question-types"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorQuestionBankScope(request)
    if (!scope.ok) return scope.response

    const types = await listCustomQuestionTypesForCourse(scope.course.id)
    return NextResponse.json({ types })
  } catch (error) {
    console.error("[custom-types GET]", error)
    return NextResponse.json({ error: "Failed to load custom question types" }, { status: 500 })
  }
}

function parseDraft(body: Record<string, unknown>): CustomQuestionTypeDraft | null {
  const schema = body.schema as CustomQuestionTypeDraft["schema"] | undefined
  if (!schema || !Array.isArray(schema.fields)) return null

  const fields = schema.fields
    .filter((field) => field && typeof field === "object")
    .map((field) => ({
      key: String(field.key ?? "").trim(),
      label: String(field.label ?? "").trim(),
      kind: field.kind,
      required: field.required === true,
      description: field.description ? String(field.description).slice(0, 400) : undefined,
    }))

  return {
    typeId: String(body.typeId ?? "").trim(),
    label: String(body.label ?? "").trim().slice(0, 80),
    description: String(body.description ?? "").trim().slice(0, 400),
    category: String(body.category ?? "structured") as CustomQuestionTypeDraft["category"],
    requiresOptions: body.requiresOptions === true,
    usesCodeEditor: body.usesCodeEditor === true,
    usesGradingGuidelines: body.usesGradingGuidelines === true,
    schema: { fields },
    aiQuestionPrompt: String(body.aiQuestionPrompt ?? "").slice(0, 2000),
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorQuestionBankScope(request)
    if (!scope.ok) return scope.response

    const body = await request.json()
    const draft = parseDraft(body)
    if (!draft) {
      return NextResponse.json({ error: "Invalid custom type payload" }, { status: 400 })
    }

    const validationError = validateCustomQuestionTypeDraft(draft)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const saved = await saveCustomQuestionType(scope.course.id, scope.instructorId, draft)
    return NextResponse.json({ type: saved })
  } catch (error) {
    console.error("[custom-types POST]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save custom question type" },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const scope = await requireInstructorQuestionBankScope(request)
    if (!scope.ok) return scope.response

    const body = await request.json().catch(() => ({} as { typeId?: string }))
    const typeId = String(body.typeId ?? "").trim()
    if (!typeId) {
      return NextResponse.json({ error: "typeId is required" }, { status: 400 })
    }

    const deleted = await deleteCustomQuestionType(scope.course.id, typeId)
    if (!deleted) {
      return NextResponse.json({ error: "Custom type not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[custom-types DELETE]", error)
    return NextResponse.json({ error: "Failed to delete custom question type" }, { status: 500 })
  }
}
