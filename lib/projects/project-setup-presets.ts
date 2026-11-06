import { createEmptyProjectAssignment, createLegacyStyleAssignment } from "@/lib/projects/default-assignment-form-state"
import { applyGradingMethodFlags } from "@/lib/projects/project-grading-methods"
import type { CourseProjectAssignmentRecord } from "@/lib/projects/project-grading-types"
import { slugifySectionKey } from "@/lib/projects/project-template-utils"
import { DEFAULT_SECTION_CONFIG } from "@/lib/projects/project-template-types"

export type ProjectSetupPresetId =
  | "custom"
  | "legacy_voting_instructor_50"
  | "structured_engineering_report"
  | "instructor_only_group"
  | "voting_only"
  | "instructor_plus_ai"
  | "all_three_grading_sources"

export type ProjectSetupPreset = {
  id: ProjectSetupPresetId
  title: string
  subtitle: string
  report: "Freeform" | "Structured report" | "Your choice in editor"
  grading: string
  /** After create, load engineering section template from public sample */
  applyEngineeringSectionTemplate?: boolean
}

export const PROJECT_SETUP_PRESETS: ProjectSetupPreset[] = [
  {
    id: "custom",
    title: "Custom project setup",
    subtitle: "Pick student voting, instructor grading, and AI grading yourself; freeform or structured report.",
    report: "Your choice in editor",
    grading: "You configure weights (must total 100%)",
  },
  {
    id: "legacy_voting_instructor_50",
    title: "Same as current CourseCollab projects",
    subtitle: "Peer voting + instructor scoring, 50 points total (30 voting + 20 instructor). Freeform deliverables.",
    report: "Freeform",
    grading: "Student voting 60% · Instructor 40%",
  },
  {
    id: "structured_engineering_report",
    title: "Structured group report (engineering)",
    subtitle:
      "Nine graded sections (cover, problem, design, results, presentation, etc.). Use for ELEG-style capstone reports — not hard-coded to one course.",
    report: "Structured report",
    grading: "Instructor 100% (change voting/AI on Grading tab)",
    applyEngineeringSectionTemplate: true,
  },
  {
    id: "instructor_only_group",
    title: "Instructor-graded group project",
    subtitle: "Group workspace; only instructor rubric counts toward the grade.",
    report: "Your choice in editor",
    grading: "Instructor 100%",
  },
  {
    id: "voting_only",
    title: "Peer voting only",
    subtitle: "Leaderboard / star voting determines the full project grade.",
    report: "Freeform",
    grading: "Student voting 100%",
  },
  {
    id: "instructor_plus_ai",
    title: "Instructor + AI grading",
    subtitle: "Two independent grade sources (e.g. 70% instructor, 30% AI). Structured report recommended.",
    report: "Your choice in editor",
    grading: "Instructor 70% · AI 30%",
  },
  {
    id: "all_three_grading_sources",
    title: "Voting + instructor + AI",
    subtitle: "All three sources enabled with example weights 20% / 60% / 20%.",
    report: "Your choice in editor",
    grading: "Voting 20% · Instructor 60% · AI 20%",
  },
]

export function buildAssignmentFromPreset(
  presetId: ProjectSetupPresetId,
  title: string,
): CourseProjectAssignmentRecord {
  const trimmed = title.trim()
  let base: CourseProjectAssignmentRecord

  switch (presetId) {
    case "legacy_voting_instructor_50":
      base = { ...createLegacyStyleAssignment(0, null), title: trimmed || "Course projects (legacy 50 pt)" }
      break
    case "structured_engineering_report":
      base = applyGradingMethodFlags(
        {
          ...createEmptyProjectAssignment(0, null),
          title: trimmed || "Structured engineering group report",
          max_points: 100,
          project_mode: "group",
          description:
            "Collaborative structured report with section rubrics, evidence, and group workspace. Section points sum to 100.",
        },
        { studentVoting: false, instructorGrading: true, aiGrading: false, instructorAiAssist: true },
      )
      break
    case "instructor_only_group":
      base = applyGradingMethodFlags(
        {
          ...createEmptyProjectAssignment(0, null),
          title: trimmed || "Instructor-graded group project",
          project_mode: "group",
        },
        { studentVoting: false, instructorGrading: true, aiGrading: false, instructorAiAssist: false },
      )
      break
    case "voting_only":
      base = applyGradingMethodFlags(
        { ...createEmptyProjectAssignment(0, null), title: trimmed || "Peer-voted project" },
        { studentVoting: true, instructorGrading: false, aiGrading: false, instructorAiAssist: false },
      )
      break
    case "instructor_plus_ai":
      base = applyGradingMethodFlags(
        {
          ...createEmptyProjectAssignment(0, null),
          title: trimmed || "Instructor + AI graded project",
          max_points: 100,
          project_mode: "group",
        },
        { studentVoting: false, instructorGrading: true, aiGrading: true, instructorAiAssist: false },
      )
      base.grading_components = base.grading_components.map((c) => {
        if (c.key === "instructor") return { ...c, weight_percent: 70 }
        if (c.key === "ai") return { ...c, weight_percent: 30 }
        return c
      })
      break
    case "all_three_grading_sources":
      base = applyGradingMethodFlags(
        {
          ...createEmptyProjectAssignment(0, null),
          title: trimmed || "Voting + instructor + AI project",
          max_points: 100,
          project_mode: "group",
        },
        { studentVoting: true, instructorGrading: true, aiGrading: true, instructorAiAssist: false },
      )
      base.grading_components = base.grading_components.map((c) => {
        if (c.key === "peer") return { ...c, weight_percent: 20 }
        if (c.key === "instructor") return { ...c, weight_percent: 60 }
        if (c.key === "ai") return { ...c, weight_percent: 20 }
        return c
      })
      base.peer_voting = { ...base.peer_voting, enabled: true, show_leaderboard: true }
      break
    case "custom":
    default:
      base = {
        ...createEmptyProjectAssignment(0, null),
        title: trimmed || "New project setup",
        project_mode: "group",
      }
      base = applyGradingMethodFlags(base, {
        studentVoting: false,
        instructorGrading: true,
        aiGrading: false,
        instructorAiAssist: false,
      })
      break
  }

  return base
}

export async function applyEngineeringReportTemplate(
  assignmentId: number,
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>,
  headers: Record<string, string>,
) {
  const sample = await fetch("/samples/project-template-example-engineering.json")
  if (!sample.ok) return
  const data = await sample.json()
  const sections = (data.sections as Array<{ title: string; config?: Record<string, unknown> }>).map((s, i) => ({
    section_key: slugifySectionKey(s.title, i),
    sort_order: i,
    title: s.title,
    instructions: null as string | null,
    config: { ...DEFAULT_SECTION_CONFIG(), ...s.config },
  }))
  await apiFetch(`/api/instructor/project-assignments/${assignmentId}/template-sections`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      submission_mode: "STRUCTURED_REPORT",
      sections,
      submission_workflow: {
        confirmation_mode: "ALL_MEMBERS",
        require_references: true,
        require_presentation_upload: true,
      },
    }),
  })
}
