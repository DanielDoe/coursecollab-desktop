import { sql } from "@/lib/db"
import { normalizeCoraCourseRoutingPolicy } from "@/lib/cora/models/course-policy"

export type CoraStudentCourseSettings = {
  enableAITutor: boolean
  allowCodeDebugging: boolean
  allowPracticeGeneration: boolean
  maxResponseLength: number
  responseStyle: string
  aiModel: string
  enableHints: boolean
  enableStepByStep: boolean
  enableCodeExamples: boolean
}

export const DEFAULT_CORA_STUDENT_SETTINGS: CoraStudentCourseSettings = {
  enableAITutor: true,
  allowCodeDebugging: true,
  allowPracticeGeneration: true,
  maxResponseLength: 500,
  responseStyle: "helpful",
  aiModel: "auto",
  enableHints: true,
  enableStepByStep: true,
  enableCodeExamples: true,
}

function asBool(row: Record<string, unknown>, camel: string, snake: string, fallback: boolean) {
  const value = row[camel] ?? row[snake]
  if (typeof value === "boolean") return value
  if (value === "true" || value === 1 || value === "1") return true
  if (value === "false" || value === 0 || value === "0") return false
  return fallback
}

function asNum(row: Record<string, unknown>, camel: string, snake: string, fallback: number) {
  const n = Number(row[camel] ?? row[snake])
  return Number.isFinite(n) ? n : fallback
}

function asStr(row: Record<string, unknown>, camel: string, snake: string, fallback: string) {
  const value = row[camel] ?? row[snake]
  return typeof value === "string" && value.trim() ? value : fallback
}

export function mapCoraStudentSettings(row?: Record<string, unknown>): CoraStudentCourseSettings {
  if (!row) return { ...DEFAULT_CORA_STUDENT_SETTINGS }
  return {
    enableAITutor: asBool(row, "enableAITutor", "enable_ai_tutor", true),
    allowCodeDebugging: asBool(row, "allowCodeDebugging", "allow_code_debugging", true),
    allowPracticeGeneration: asBool(row, "allowPracticeGeneration", "allow_practice_generation", true),
    maxResponseLength: asNum(row, "maxResponseLength", "max_response_length", 500),
    responseStyle: asStr(row, "responseStyle", "response_style", "helpful"),
    aiModel: normalizeCoraCourseRoutingPolicy(asStr(row, "aiModel", "ai_model", "auto")),
    enableHints: asBool(row, "enableHints", "enable_hints", true),
    enableStepByStep: asBool(row, "enableStepByStep", "enable_step_by_step", true),
    enableCodeExamples: asBool(row, "enableCodeExamples", "enable_code_examples", true),
  }
}

export async function loadCoraStudentCourseSettings(
  courseId: number | null | undefined,
): Promise<CoraStudentCourseSettings> {
  if (courseId == null || !Number.isFinite(Number(courseId))) {
    return { ...DEFAULT_CORA_STUDENT_SETTINGS }
  }
  try {
    const rows = await sql`
      SELECT *
      FROM ai_tutor_settings
      WHERE course_id = ${Number(courseId)}
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1
    `
    return mapCoraStudentSettings(rows[0] as Record<string, unknown> | undefined)
  } catch {
    return { ...DEFAULT_CORA_STUDENT_SETTINGS }
  }
}

export function buildCoraStudentSettingsPromptAppendix(settings: CoraStudentCourseSettings): string {
  const lines = [
    "\n\nCOURSE TUTOR POLICY (instructor-configured; follow strictly):",
    `- Response style: ${settings.responseStyle}.`,
    `- Keep replies around ${settings.maxResponseLength} words or fewer.`,
  ]
  if (!settings.enableHints) {
    lines.push("- Do not offer hints or scaffolding. Explain the concept without hint-style prompts.")
  }
  if (!settings.enableStepByStep) {
    lines.push("- Do not use numbered step-by-step walkthroughs unless the student explicitly asks.")
  }
  if (!settings.enableCodeExamples) {
    lines.push("- Do not include code examples, snippets, or sample implementations.")
  }
  if (!settings.allowCodeDebugging) {
    lines.push("- Do not debug, rewrite, or complete the student's code. Discuss concepts only.")
  }
  if (!settings.allowPracticeGeneration) {
    lines.push("- Do not generate practice problems or extra exercises.")
  }
  return lines.join("\n")
}

export function capTokensForCourseSettings(
  requested: number | undefined,
  settings: CoraStudentCourseSettings,
): number {
  const wordCap = Math.max(80, Math.min(2000, settings.maxResponseLength))
  const tokenCap = Math.ceil(wordCap * 2)
  if (requested == null || !Number.isFinite(requested)) return tokenCap
  return Math.min(requested, tokenCap)
}
