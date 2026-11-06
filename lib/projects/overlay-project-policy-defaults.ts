import type { ProjectPolicy } from "@/lib/course-policy-settings"
import { applyGradingMethodFlags } from "@/lib/projects/project-grading-methods"
import type { CourseProjectAssignmentRecord } from "@/lib/projects/project-grading-types"

/** Overlay course-wide Project Settings onto a new assignment (presets still win on grading mix). */
export function overlayProjectPolicyDefaults(
  assignment: CourseProjectAssignmentRecord,
  policy: ProjectPolicy,
  opts: { applyGradingMix?: boolean } = {},
): CourseProjectAssignmentRecord {
  const d = policy.module_defaults
  let next: CourseProjectAssignmentRecord = {
    ...assignment,
    project_mode: d.project_mode,
    min_group_size: policy.min_team_size,
    max_group_size: policy.max_team_size,
    max_points: d.max_points,
    counts_toward_course_grade: d.counts_toward_course_grade,
    late_policy: {
      ...assignment.late_policy,
      penalty_percent_per_day: policy.late_project_penalty_percent_per_day,
    },
    resubmissions: {
      ...assignment.resubmissions,
      allow_resubmissions: d.allow_resubmissions,
    },
    presentation: {
      ...assignment.presentation,
      required: d.presentation_required,
      duration_minutes: d.presentation_duration_minutes,
    },
    integrity_settings: {
      ...assignment.integrity_settings,
      strict_mode: d.strict_mode,
      copy_paste: d.copy_paste,
      cora_policy: d.cora_policy,
    },
    peer_voting: {
      ...assignment.peer_voting,
      show_leaderboard: d.show_leaderboard,
      anonymous: d.anonymous_votes,
    },
  }

  if (opts.applyGradingMix) {
    next = applyGradingMethodFlags(next, {
      studentVoting: d.voting_enabled,
      instructorGrading: d.instructor_grading_enabled,
      aiGrading: d.ai_grading_enabled,
      instructorAiAssist: d.instructor_ai_assist,
    })
    next.max_points = d.max_points
    next.grading_components = next.grading_components.map((c) => {
      if (c.key === "peer") return { ...c, weight_percent: d.voting_weight_percent }
      if (c.key === "instructor") return { ...c, weight_percent: d.instructor_weight_percent }
      if (c.key === "ai") return { ...c, weight_percent: d.ai_weight_percent }
      return c
    })
  }

  return next
}
