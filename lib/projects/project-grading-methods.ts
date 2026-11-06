import { defaultGradingComponentsForMode, legacyPeerInstructorComponents } from "@/lib/projects/project-grading-config"
import type {
  CourseProjectAssignmentRecord,
  ProjectGradingComponent,
  ProjectGradingMode,
} from "@/lib/projects/project-grading-types"

export type ProjectGradingMethodFlags = {
  studentVoting: boolean
  instructorGrading: boolean
  aiGrading: boolean
  instructorAiAssist: boolean
}

function component(
  components: ProjectGradingComponent[],
  key: ProjectGradingComponent["key"],
): ProjectGradingComponent | undefined {
  return components.find((c) => c.key === key)
}

export function readGradingMethodFlags(assignment: CourseProjectAssignmentRecord): ProjectGradingMethodFlags {
  const peer = component(assignment.grading_components, "peer")
  const instructor = component(assignment.grading_components, "instructor")
  const ai = component(assignment.grading_components, "ai")

  const studentVoting =
    assignment.grading_mode === "PEER_ONLY" ||
    assignment.grading_mode === "PEER_PLUS_INSTRUCTOR" ||
    assignment.peer_voting.enabled ||
    peer?.enabled === true

  let instructorGrading =
    assignment.grading_mode === "INSTRUCTOR_ONLY" ||
    assignment.grading_mode === "PEER_PLUS_INSTRUCTOR" ||
    assignment.grading_mode === "INSTRUCTOR_WITH_AI_ASSIST" ||
    assignment.grading_mode === "CUSTOM_WEIGHTED" ||
    instructor?.enabled === true

  if (assignment.grading_mode === "PEER_ONLY") instructorGrading = false
  if (assignment.grading_mode === "AI_ONLY") instructorGrading = false

  const aiGrading =
    assignment.grading_mode === "AI_ONLY" ||
    (ai?.enabled === true && (Number(ai.weight_percent) || 0) > 0 && assignment.grading_mode !== "INSTRUCTOR_WITH_AI_ASSIST")

  const instructorAiAssist =
    assignment.grading_mode === "INSTRUCTOR_WITH_AI_ASSIST" || Boolean(assignment.presentation.instructor_ai_assist)

  return {
    studentVoting,
    instructorGrading,
    aiGrading,
    instructorAiAssist: instructorAiAssist && !aiGrading,
  }
}

export function deriveGradingMode(flags: ProjectGradingMethodFlags): ProjectGradingMode {
  const { studentVoting, instructorGrading, aiGrading, instructorAiAssist } = flags
  const count = [studentVoting, instructorGrading, aiGrading].filter(Boolean).length
  if (count === 0) return "INSTRUCTOR_ONLY"
  if (count === 1) {
    if (studentVoting) return "PEER_ONLY"
    if (aiGrading) return "AI_ONLY"
    return instructorAiAssist ? "INSTRUCTOR_WITH_AI_ASSIST" : "INSTRUCTOR_ONLY"
  }
  if (studentVoting && instructorGrading && !aiGrading) return "PEER_PLUS_INSTRUCTOR"
  return "CUSTOM_WEIGHTED"
}

function ensureComponent(
  components: ProjectGradingComponent[],
  key: ProjectGradingComponent["key"],
  label: string,
): ProjectGradingComponent {
  const existing = component(components, key)
  if (existing) return { ...existing, label: existing.label || label }
  return { key, label, weight_percent: 0, enabled: false, points_cap: null }
}

export function applyGradingMethodFlags(
  assignment: CourseProjectAssignmentRecord,
  flags: ProjectGradingMethodFlags,
): CourseProjectAssignmentRecord {
  const enabledCount = [flags.studentVoting, flags.instructorGrading, flags.aiGrading].filter(Boolean).length
  if (enabledCount === 0) return assignment

  let components = assignment.grading_components.map((c) => ({ ...c }))
  const peer = ensureComponent(components, "peer", "Student voting")
  const instructor = ensureComponent(components, "instructor", "Instructor grading")
  const ai = ensureComponent(components, "ai", "AI grading")

  peer.enabled = flags.studentVoting
  instructor.enabled = flags.instructorGrading
  ai.enabled = flags.aiGrading

  if (enabledCount === 1) {
    peer.weight_percent = flags.studentVoting ? 100 : 0
    instructor.weight_percent = flags.instructorGrading ? 100 : 0
    ai.weight_percent = flags.aiGrading ? 100 : 0
  } else if (flags.studentVoting && flags.instructorGrading && !flags.aiGrading && assignment.max_points === 50) {
    peer.weight_percent = 60
    peer.points_cap = peer.points_cap ?? 30
    instructor.weight_percent = 40
    instructor.points_cap = instructor.points_cap ?? 20
  } else if (enabledCount >= 2) {
    const enabled = [
      flags.studentVoting ? peer : null,
      flags.instructorGrading ? instructor : null,
      flags.aiGrading ? ai : null,
    ].filter(Boolean) as ProjectGradingComponent[]
    const total = enabled.reduce((s, c) => s + (Number(c.weight_percent) || 0), 0)
    if (total < 0.01) {
      const each = 100 / enabled.length
      for (const c of enabled) c.weight_percent = Math.round(each * 10) / 10
    }
  }

  components = [peer, instructor, ai, ...components.filter((c) => !["peer", "instructor", "ai"].includes(c.key))]
  for (const c of components) {
    if (!c.enabled) c.weight_percent = 0
  }

  const grading_mode = deriveGradingMode(flags)
  const peer_voting = {
    ...assignment.peer_voting,
    enabled: flags.studentVoting,
    show_leaderboard: flags.studentVoting ? assignment.peer_voting.show_leaderboard : false,
  }

  const presentation = {
    ...assignment.presentation,
    instructor_ai_assist: flags.instructorAiAssist && flags.instructorGrading && !flags.aiGrading,
  }

  return { ...assignment, grading_mode, grading_components: components, peer_voting, presentation }
}

export function formatGradingMethodsSummary(assignment: CourseProjectAssignmentRecord): string {
  const f = readGradingMethodFlags(assignment)
  const parts: string[] = []
  if (f.studentVoting) parts.push("Student voting")
  if (f.instructorGrading) parts.push("Instructor")
  if (f.aiGrading) parts.push("AI grading")
  if (parts.length === 0) parts.push("Not configured")
  return parts.join(" + ")
}

export function applyLegacyTemplateDefaults(assignment: CourseProjectAssignmentRecord): CourseProjectAssignmentRecord {
  return {
    ...applyGradingMethodFlags(assignment, {
      studentVoting: true,
      instructorGrading: true,
      aiGrading: false,
      instructorAiAssist: false,
    }),
    grading_components: legacyPeerInstructorComponents(),
    max_points: 50,
  }
}

export function resetComponentsForSingleMethod(
  mode: ProjectGradingMode,
  maxPoints: number,
): ProjectGradingComponent[] {
  return defaultGradingComponentsForMode(mode, maxPoints)
}
