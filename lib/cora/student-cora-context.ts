import type { CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"
import {
  STUDENT_CORA_CAPABILITIES,
  tailorStudentCoraCapabilities,
  type StudentCoraCapability,
} from "@/lib/cora/student-capabilities"

export const STUDENT_CORA_CONTEXT_VERSION = 1 as const

export type StudentCoraSetupStepId =
  | "preparing"
  | "exploring"
  | "reading"
  | "generating"
  | "finalizing"

export const STUDENT_CORA_SETUP_STEPS: Array<{ id: StudentCoraSetupStepId; label: string }> = [
  { id: "preparing", label: "Setting things up" },
  { id: "exploring", label: "Exploring your course" },
  { id: "reading", label: "Reading your progress" },
  { id: "generating", label: "Personalizing suggestions" },
  { id: "finalizing", label: "Finalizing Cora setup" },
]

export type StudentCoraContext = {
  version: typeof STUDENT_CORA_CONTEXT_VERSION
  studentId: string
  studentName?: string
  courseCode?: string
  courseTitle?: string
  section?: string
  focusLabel?: string
  focusTopics: string[]
  payload: CoraStudentContextPayload
  tailoredCapabilities: StudentCoraCapability[]
  generatedAt: string
  setupComplete: boolean
}

function resolveFocusTopics(payload: CoraStudentContextPayload): string[] {
  const fromStruggling = payload.strugglingTopics ?? []
  const fromMastery =
    payload.topicMastery
      ?.filter((row) => row.status === "weak" || row.mastery < 0.55)
      .map((row) => row.topic) ?? []
  const combined = [...fromStruggling, ...fromMastery]
  const seen = new Set<string>()
  const result: string[] = []
  for (const topic of combined) {
    const key = topic.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(topic.trim())
  }
  return result.slice(0, 5)
}

function resolveFocusLabel(payload: CoraStudentContextPayload, focusTopics: string[]): string | undefined {
  if (focusTopics[0]) return focusTopics[0]
  if (payload.upcomingAssessments?.[0]?.title) return payload.upcomingAssessments[0].title
  if (payload.account?.courseCode) return payload.account.courseCode
  return undefined
}

export function buildStudentCoraContext(
  studentId: string,
  payload: CoraStudentContextPayload,
  studentName?: string,
): StudentCoraContext {
  const focusTopics = resolveFocusTopics(payload)
  return {
    version: STUDENT_CORA_CONTEXT_VERSION,
    studentId,
    studentName: payload.account?.fullName ?? studentName,
    courseCode: payload.account?.courseCode ?? undefined,
    courseTitle: payload.account?.courseTitle ?? undefined,
    section: payload.account?.section ?? undefined,
    focusLabel: resolveFocusLabel(payload, focusTopics),
    focusTopics,
    payload,
    tailoredCapabilities: tailorStudentCoraCapabilities(payload),
    generatedAt: new Date().toISOString(),
    setupComplete: true,
  }
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

/** Runs the mobile-parity setup sequence against `/api/ai-tutor/student-context`. */
export async function runStudentCoraContextSetup(
  studentId: string,
  options?: {
    studentName?: string
    onStep?: (step: StudentCoraSetupStepId) => void
  },
): Promise<StudentCoraContext> {
  options?.onStep?.("preparing")
  await delay(280)
  options?.onStep?.("exploring")
  await delay(320)
  options?.onStep?.("reading")

  const response = await fetch("/api/ai-tutor/student-context", {
    headers: { "x-student-id": studentId },
  })
  if (!response.ok) {
    throw new Error("Could not load your course context for Cora.")
  }
  const payload = (await response.json()) as CoraStudentContextPayload

  options?.onStep?.("generating")
  await delay(360)
  const context = buildStudentCoraContext(studentId, payload, options?.studentName)
  options?.onStep?.("finalizing")
  await delay(220)
  return context
}

export { STUDENT_CORA_CAPABILITIES }
