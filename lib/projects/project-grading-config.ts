import {
  DEFAULT_AI_GRADING_SETTINGS,
  DEFAULT_FEEDBACK_RELEASE,
  DEFAULT_PROJECT_INTEGRITY_SETTINGS,
  type ProjectAiGradingSettings,
  type ProjectFeedbackReleaseSettings,
  type ProjectIntegritySettings,
} from "@/lib/projects/project-integrity-types"
import {
  type CourseProjectAssignmentRecord,
  type ProjectGradingComponent,
  type ProjectGradingMode,
  type ProjectLatePolicy,
  type ProjectPeerVotingConfig,
  type ProjectPresentationConfig,
  type ProjectRubric,
  type ProjectSubmissionConfig,
  PROJECT_GRADING_MODES,
} from "@/lib/projects/project-grading-types"

/** Historical default: 30 peer + 20 instructor on a 50-point scale (60/40 weights). */
export const LEGACY_PROJECT_MAX_POINTS = 50

export const LEGACY_PEER_CAP = 30
export const LEGACY_INSTRUCTOR_CAP = 20

export function legacyPeerInstructorComponents(): ProjectGradingComponent[] {
  return [
    {
      key: "peer",
      label: "Peer voting",
      weight_percent: 60,
      enabled: true,
      points_cap: LEGACY_PEER_CAP,
    },
    {
      key: "instructor",
      label: "Instructor evaluation",
      weight_percent: 40,
      enabled: true,
      points_cap: LEGACY_INSTRUCTOR_CAP,
    },
  ]
}

export function defaultGradingComponentsForMode(
  mode: ProjectGradingMode,
  maxPoints: number,
): ProjectGradingComponent[] {
  switch (mode) {
    case "INSTRUCTOR_ONLY":
      return [{ key: "instructor", label: "Instructor", weight_percent: 100, enabled: true }]
    case "PEER_ONLY":
      return [{ key: "peer", label: "Peer voting", weight_percent: 100, enabled: true }]
    case "PEER_PLUS_INSTRUCTOR":
      return legacyPeerInstructorComponents()
    case "AI_ONLY":
      return [{ key: "ai", label: "AI evaluation", weight_percent: 100, enabled: true }]
    case "INSTRUCTOR_WITH_AI_ASSIST":
      return [
        { key: "instructor", label: "Instructor", weight_percent: 85, enabled: true },
        { key: "ai", label: "AI assist", weight_percent: 15, enabled: true },
      ]
    case "CUSTOM_WEIGHTED":
      return [
        { key: "report", label: "Report", weight_percent: 60, enabled: true },
        { key: "presentation", label: "Presentation", weight_percent: 20, enabled: true },
        { key: "instructor", label: "Instructor", weight_percent: 20, enabled: true },
      ]
    default:
      return [{ key: "instructor", label: "Instructor", weight_percent: 100, enabled: true }]
  }
}

export function parseLatePolicy(raw: unknown): ProjectLatePolicy {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    allow_late: Boolean(o.allow_late),
    penalty_percent_per_day: Math.min(100, Math.max(0, Number(o.penalty_percent_per_day) || 0)),
    max_days_late: o.max_days_late == null ? null : Math.max(0, Number(o.max_days_late) || 0),
  }
}

export function parsePeerVoting(raw: unknown, gradingMode: ProjectGradingMode): ProjectPeerVotingConfig {
  const peerModes: ProjectGradingMode[] = ["PEER_ONLY", "PEER_PLUS_INSTRUCTOR", "CUSTOM_WEIGHTED"]
  const defaultEnabled = peerModes.includes(gradingMode)
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    enabled: o.enabled !== undefined ? Boolean(o.enabled) : defaultEnabled,
    voters: (o.voters as ProjectPeerVotingConfig["voters"]) || "section_peers",
    anonymous: o.anonymous !== undefined ? Boolean(o.anonymous) : true,
    allow_own_group_voting: Boolean(o.allow_own_group_voting),
    open_at: typeof o.open_at === "string" ? o.open_at : null,
    close_at: typeof o.close_at === "string" ? o.close_at : null,
    rating_method: o.rating_method === "simple_vote" ? "simple_vote" : "stars",
    require_written_feedback: Boolean(o.require_written_feedback),
    show_running_results: o.show_running_results !== undefined ? Boolean(o.show_running_results) : true,
    show_leaderboard: o.show_leaderboard !== undefined ? Boolean(o.show_leaderboard) : defaultEnabled,
  }
}

export function parsePresentation(raw: unknown): ProjectPresentationConfig {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    required: Boolean(o.required),
    window_start: typeof o.window_start === "string" ? o.window_start : null,
    window_end: typeof o.window_end === "string" ? o.window_end : null,
    duration_minutes: o.duration_minutes == null ? null : Number(o.duration_minutes) || null,
    location: typeof o.location === "string" ? o.location : null,
    slides_required: Boolean(o.slides_required),
    demonstration_required: Boolean(o.demonstration_required),
    points_weight_percent: Math.min(100, Math.max(0, Number(o.points_weight_percent) || 0)),
    rubric_section_id: typeof o.rubric_section_id === "string" ? o.rubric_section_id : null,
    instructor_ai_assist: Boolean(o.instructor_ai_assist),
  }
}

export function parseSubmission(raw: unknown): ProjectSubmissionConfig {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    allow_resubmissions: Boolean(o.allow_resubmissions),
    max_resubmissions: o.max_resubmissions == null ? null : Math.max(0, Number(o.max_resubmissions) || 0),
    require_instructor_approval: o.require_instructor_approval !== undefined ? Boolean(o.require_instructor_approval) : true,
    template_url: typeof o.template_url === "string" ? o.template_url : null,
    template_instructions: typeof o.template_instructions === "string" ? o.template_instructions : null,
    proposal_mode: o.proposal_mode === "instructor" ? "instructor" : "student",
  }
}

export function parseRubric(raw: unknown): ProjectRubric {
  const empty: ProjectRubric = { type: "simple", criteria: [], overall_comment_enabled: true }
  if (!raw || typeof raw !== "object") return empty
  const o = raw as Record<string, unknown>
  const type = o.type === "analytic" ? "analytic" : "simple"
  const criteriaRaw = Array.isArray(o.criteria) ? o.criteria : []
  const criteria = criteriaRaw
    .map((c, idx) => {
      if (!c || typeof c !== "object") return null
      const row = c as Record<string, unknown>
      const levelsRaw = Array.isArray(row.levels) ? row.levels : []
      return {
        id: String(row.id || `criterion-${idx + 1}`),
        title: String(row.title || `Criterion ${idx + 1}`),
        description: typeof row.description === "string" ? row.description : undefined,
        weight_percent: Math.min(100, Math.max(0, Number(row.weight_percent) || 0)),
        max_points: Math.max(0, Number(row.max_points) || 0),
        levels: levelsRaw.map((l, li) => {
          const lv = l as Record<string, unknown>
          return {
            id: String(lv.id || `level-${idx}-${li}`),
            label: String(lv.label || "Level"),
            description: typeof lv.description === "string" ? lv.description : undefined,
            points: lv.points == null ? null : Number(lv.points),
          }
        }),
      }
    })
    .filter(Boolean) as ProjectRubric["criteria"]
  return {
    type,
    criteria,
    overall_comment_enabled: o.overall_comment_enabled !== false,
  }
}

export function parseGradingComponents(raw: unknown, mode: ProjectGradingMode, maxPoints: number): ProjectGradingComponent[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return defaultGradingComponentsForMode(mode, maxPoints)
  }
  return raw
    .map((c, idx) => {
      if (!c || typeof c !== "object") return null
      const row = c as Record<string, unknown>
      const key = String(row.key || "other")
      return {
        key: key as ProjectGradingComponent["key"],
        label: String(row.label || key),
        weight_percent: Math.min(100, Math.max(0, Number(row.weight_percent) || 0)),
        enabled: row.enabled !== false,
        points_cap: row.points_cap == null ? null : Number(row.points_cap),
      }
    })
    .filter(Boolean) as ProjectGradingComponent[]
}

export function parseGradingMode(raw: unknown): ProjectGradingMode {
  const s = String(raw || "INSTRUCTOR_ONLY").toUpperCase()
  return (PROJECT_GRADING_MODES as readonly string[]).includes(s)
    ? (s as ProjectGradingMode)
    : "INSTRUCTOR_ONLY"
}

export function parseCourseProjectAssignment(row: Record<string, unknown>): CourseProjectAssignmentRecord {
  const maxPoints = Math.max(0.01, Number(row.max_points) || LEGACY_PROJECT_MAX_POINTS)
  const gradingMode = parseGradingMode(row.grading_mode)
  return {
    id: Number(row.id),
    course_id: Number(row.course_id),
    session: row.session != null ? String(row.session) : null,
    title: String(row.title || ""),
    description: row.description != null ? String(row.description) : null,
    instructions: row.instructions != null ? String(row.instructions) : null,
    project_mode: row.project_mode === "individual" ? "individual" : "group",
    status: row.status === "published" || row.status === "archived" ? row.status : "draft",
    available_from: row.available_from != null ? String(row.available_from) : null,
    available_until: row.available_until != null ? String(row.available_until) : null,
    due_at: row.due_at != null ? String(row.due_at) : null,
    late_policy: parseLatePolicy(row.late_policy),
    min_group_size: row.min_group_size == null ? null : Number(row.min_group_size),
    max_group_size: row.max_group_size == null ? null : Number(row.max_group_size),
    counts_toward_course_grade: row.counts_toward_course_grade !== false,
    max_points: maxPoints,
    required_deliverables: Array.isArray(row.required_deliverables)
      ? row.required_deliverables.map(String)
      : [],
    resources: Array.isArray(row.resources)
      ? row.resources
          .map((r) => {
            if (!r || typeof r !== "object") return null
            const o = r as Record<string, unknown>
            return { title: String(o.title || ""), url: String(o.url || "") }
          })
          .filter((x): x is { title: string; url: string } => Boolean(x?.url))
      : [],
    resubmissions: parseSubmission(row.resubmissions),
    grading_mode: gradingMode,
    grading_components: parseGradingComponents(row.grading_components, gradingMode, maxPoints),
    rubric: parseRubric(row.rubric),
    peer_voting: parsePeerVoting(row.peer_voting, gradingMode),
    submission: parseSubmission(row.submission),
    presentation: parsePresentation(row.presentation),
    integrity_settings: parseIntegritySettings(row.integrity_settings),
    ai_grading_settings: parseAiGradingSettings(row.ai_grading_settings),
    feedback_release: parseFeedbackRelease(row.feedback_release),
  }
}

function parseIntegritySettings(raw: unknown): ProjectIntegritySettings {
  const d = DEFAULT_PROJECT_INTEGRITY_SETTINGS()
  if (!raw || typeof raw !== "object") return d
  return { ...d, ...(raw as Partial<ProjectIntegritySettings>) }
}

function parseAiGradingSettings(raw: unknown): ProjectAiGradingSettings {
  const d = DEFAULT_AI_GRADING_SETTINGS()
  if (!raw || typeof raw !== "object") return d
  return { ...d, ...(raw as Partial<ProjectAiGradingSettings>) }
}

function parseFeedbackRelease(raw: unknown): ProjectFeedbackReleaseSettings {
  const d = DEFAULT_FEEDBACK_RELEASE()
  if (!raw || typeof raw !== "object") return d
  return { ...d, ...(raw as Partial<ProjectFeedbackReleaseSettings>) }
}

/** Config used when a student project has no assignment_id (legacy behavior). */
export function legacyProjectGradingConfig(): Pick<
  CourseProjectAssignmentRecord,
  "max_points" | "grading_mode" | "grading_components" | "peer_voting"
> {
  return {
    max_points: LEGACY_PROJECT_MAX_POINTS,
    grading_mode: "PEER_PLUS_INSTRUCTOR",
    grading_components: legacyPeerInstructorComponents(),
    peer_voting: parsePeerVoting({ enabled: true, show_leaderboard: true }, "PEER_PLUS_INSTRUCTOR"),
  }
}

export function validateGradingComponents(components: ProjectGradingComponent[]): string | null {
  const enabled = components.filter((c) => c.enabled)
  if (enabled.length === 0) return "Enable at least one grading component."
  const total = enabled.reduce((s, c) => s + (Number(c.weight_percent) || 0), 0)
  if (Math.abs(total - 100) > 0.01) {
    return `Grading component weights must total 100%. Current total: ${total.toFixed(1)}%.`
  }
  return null
}
