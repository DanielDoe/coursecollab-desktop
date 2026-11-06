import {
  defaultGradingComponentsForMode,
  parseCourseProjectAssignment,
  parseGradingMode,
  validateGradingComponents,
} from "@/lib/projects/project-grading-config"
import type { ProjectGradingMode } from "@/lib/projects/project-grading-types"

export function buildAssignmentUpdateFromBody(
  body: Record<string, unknown>,
  courseId: number,
  instructorId: number | null,
) {
  const gradingMode = parseGradingMode(body.grading_mode)
  const maxPoints = Math.max(0.01, Math.min(1000, Number(body.max_points) || 50))
  const gradingComponents =
    Array.isArray(body.grading_components) && body.grading_components.length > 0
      ? body.grading_components
      : defaultGradingComponentsForMode(gradingMode, maxPoints)

  const validationError = validateGradingComponents(
    gradingComponents as import("@/lib/projects/project-grading-types").ProjectGradingComponent[],
  )
  if (validationError) {
    return { error: validationError as string }
  }

  const row = {
    course_id: courseId,
    session: body.session != null && String(body.session).trim() ? String(body.session).trim() : null,
    title: String(body.title || "").trim(),
    description: body.description != null ? String(body.description) : null,
    instructions: body.instructions != null ? String(body.instructions) : null,
    project_mode: body.project_mode === "individual" ? "individual" : "group",
    status: body.status === "published" || body.status === "archived" ? body.status : "draft",
    available_from: body.available_from || null,
    available_until: body.available_until || null,
    due_at: body.due_at || null,
    late_policy: body.late_policy ?? {},
    min_group_size: body.min_group_size == null ? null : Number(body.min_group_size),
    max_group_size: body.max_group_size == null ? null : Number(body.max_group_size),
    counts_toward_course_grade: body.counts_toward_course_grade !== false,
    max_points: maxPoints,
    required_deliverables: body.required_deliverables ?? [],
    resources: body.resources ?? [],
    resubmissions: body.resubmissions ?? {},
    grading_mode: gradingMode,
    grading_components: gradingComponents,
    rubric: body.rubric ?? {},
    peer_voting: body.peer_voting ?? {},
    submission: body.submission ?? {},
    presentation: body.presentation ?? {},
    integrity_settings: body.integrity_settings ?? {},
    ai_grading_settings: body.ai_grading_settings ?? {},
    feedback_release: body.feedback_release ?? {},
    created_by_instructor_id: instructorId,
  }

  if (!row.title) {
    return { error: "Title is required." }
  }

  return { row, parsed: parseCourseProjectAssignment({ id: 0, ...row }) }
}

export function applyGradingModeDefaults(mode: ProjectGradingMode, maxPoints: number) {
  return defaultGradingComponentsForMode(mode, maxPoints)
}
