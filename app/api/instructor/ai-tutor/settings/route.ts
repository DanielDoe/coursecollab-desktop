import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureAiTutorSettingsSchema } from "@/lib/ensure-ai-tutor-settings-schema"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { requireInstructorMinTier } from "@/lib/instructor-membership-guard"
import { normalizeCoraCourseRoutingPolicy } from "@/lib/cora/models/course-policy"
import {
  DEFAULT_CORA_STUDENT_SETTINGS,
  mapCoraStudentSettings,
} from "@/lib/cora/models/course-student-settings"

export async function GET(request: NextRequest) {
  const scope = await requireInstructorCourse(request)
  if (!scope.ok) {
    return scope.response
  }
  const tier = await requireInstructorMinTier(
    scope.instructorId,
    "Pro",
    "Cora Assistant Settings require Instructor Pro.",
  )
  if (!tier.ok) return tier.response

  const { instructorId, course } = scope
  const courseId = course.id

  try {
    await ensureAiTutorSettingsSchema()

    const settings = await sql`
      SELECT * FROM ai_tutor_settings 
      WHERE instructor_id = ${String(instructorId)} AND course_id = ${courseId}
      LIMIT 1
    `

    return NextResponse.json({
      settings: mapCoraStudentSettings(settings[0] as Record<string, unknown> | undefined),
    })
  } catch (error) {
    console.error("[AI Tutor Settings GET] Error:", error)
    return NextResponse.json({ settings: { ...DEFAULT_CORA_STUDENT_SETTINGS } })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }
    const tier = await requireInstructorMinTier(
      scope.instructorId,
      "Pro",
      "Cora Assistant Settings require Instructor Pro.",
    )
    if (!tier.ok) return tier.response

    const { instructorId, course } = scope
    const courseId = course.id

    await ensureAiTutorSettingsSchema()

    const body = await request.json()
    const next = mapCoraStudentSettings(body as Record<string, unknown>)

    await sql`
      INSERT INTO ai_tutor_settings (
        instructor_id,
        course_id,
        enable_ai_tutor,
        allow_code_debugging,
        allow_practice_generation,
        max_response_length,
        response_style,
        ai_model,
        enable_hints,
        enable_step_by_step,
        enable_code_examples,
        updated_at
      ) VALUES (
        ${String(instructorId)},
        ${courseId},
        ${next.enableAITutor},
        ${next.allowCodeDebugging},
        ${next.allowPracticeGeneration},
        ${next.maxResponseLength},
        ${next.responseStyle},
        ${normalizeCoraCourseRoutingPolicy(next.aiModel)},
        ${next.enableHints},
        ${next.enableStepByStep},
        ${next.enableCodeExamples},
        NOW()
      )
      ON CONFLICT (instructor_id, course_id) 
      DO UPDATE SET
        enable_ai_tutor = EXCLUDED.enable_ai_tutor,
        allow_code_debugging = EXCLUDED.allow_code_debugging,
        allow_practice_generation = EXCLUDED.allow_practice_generation,
        max_response_length = EXCLUDED.max_response_length,
        response_style = EXCLUDED.response_style,
        ai_model = EXCLUDED.ai_model,
        enable_hints = EXCLUDED.enable_hints,
        enable_step_by_step = EXCLUDED.enable_step_by_step,
        enable_code_examples = EXCLUDED.enable_code_examples,
        updated_at = NOW()
    `

    return NextResponse.json({
      message: "Settings saved successfully",
      success: true,
      settings: next,
    })
  } catch (error) {
    console.error("[AI Tutor Settings POST] Error:", error)
    return NextResponse.json({ error: "Failed to save Cora Assistant settings" }, { status: 500 })
  }
}
