import {
  defaultGradingComponentsForMode,
  parsePeerVoting,
  parsePresentation,
  parseRubric,
  parseSubmission,
} from "@/lib/projects/project-grading-config"
import type { CourseProjectAssignmentRecord } from "@/lib/projects/project-grading-types"
import {
  DEFAULT_AI_GRADING_SETTINGS,
  DEFAULT_FEEDBACK_RELEASE,
  DEFAULT_PROJECT_INTEGRITY_SETTINGS,
} from "@/lib/projects/project-integrity-types"

export function createEmptyProjectAssignment(
  courseId: number,
  session: string | null = null,
): CourseProjectAssignmentRecord {
  const grading_mode = "INSTRUCTOR_ONLY"
  const max_points = 50
  return {
    id: 0,
    course_id: courseId,
    session,
    title: "",
    description: "",
    instructions: "",
    project_mode: "group",
    status: "draft",
    available_from: null,
    available_until: null,
    due_at: null,
    late_policy: { allow_late: false, penalty_percent_per_day: 5, max_days_late: null },
    min_group_size: 2,
    max_group_size: 5,
    counts_toward_course_grade: true,
    max_points,
    required_deliverables: [],
    resources: [],
    resubmissions: parseSubmission({}),
    grading_mode,
    grading_components: defaultGradingComponentsForMode(grading_mode, max_points),
    rubric: parseRubric({}),
    peer_voting: parsePeerVoting({ enabled: false }, grading_mode),
    submission: parseSubmission({ require_instructor_approval: true }),
    presentation: parsePresentation({}),
    integrity_settings: DEFAULT_PROJECT_INTEGRITY_SETTINGS(),
    ai_grading_settings: DEFAULT_AI_GRADING_SETTINGS(),
    feedback_release: DEFAULT_FEEDBACK_RELEASE(),
  }
}

export function createLegacyStyleAssignment(courseId: number, session: string | null = null) {
  const base = createEmptyProjectAssignment(courseId, session)
  return {
    ...base,
    title: "Legacy-style peer + instructor project",
    grading_mode: "PEER_PLUS_INSTRUCTOR" as const,
    grading_components: defaultGradingComponentsForMode("PEER_PLUS_INSTRUCTOR", 50),
    peer_voting: parsePeerVoting({ enabled: true, show_leaderboard: true }, "PEER_PLUS_INSTRUCTOR"),
    max_points: 50,
  }
}
