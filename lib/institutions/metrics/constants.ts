/** Minimum sample sizes before learning metrics are shown. */
export const MIN_STUDENTS_FOR_LEARNING_METRIC = 10
export const MIN_ATTEMPTS_FOR_ACCURACY = 25

/** Estimated manual minutes avoided per automated workflow type. */
export const WORKFLOW_MINUTES_SAVED: Record<string, number> = {
  grading: 3,
  grade: 3,
  auto_grading: 3,
  quiz: 15,
  homework: 12,
  assessment: 15,
  report: 20,
  progress_report: 20,
  announcement: 8,
  analysis: 10,
  course_analysis: 10,
  tutor: 5,
  chat: 2,
  default: 7,
}

export const LICENSE_UTILIZATION_THRESHOLDS = {
  normal: 70,
  monitor: 85,
  approaching: 95,
} as const

export const DATE_PRESETS = [
  "today",
  "last_7_days",
  "last_30_days",
  "current_term",
  "previous_term",
  "academic_year",
  "previous_academic_year",
  "custom",
] as const

export type InstitutionDatePreset = (typeof DATE_PRESETS)[number]

export const METRIC_DEFINITIONS = {
  activeStudent: {
    label: "Active Student",
    description:
      "Unique institution-sponsored student who performed at least one meaningful Course Collab activity during the selected period (login, assessment attempt, practice, Cora, or CodeBench).",
  },
  activeInstructor: {
    label: "Active Instructor",
    description:
      "Covered faculty member with meaningful platform activity during the selected period (Cora workflow, grading action, or course administration).",
  },
  estimatedHoursSaved: {
    label: "Estimated Instructor Hours Saved",
    description:
      "Estimated reduction in instructor workload based on automated grading volume and Cora workflow activity using configured manual-time baselines. Labeled estimated — not measured wall-clock time.",
    estimated: true,
  },
  coraWorkflowSuccess: {
    label: "Cora Workflow Success",
    description:
      "Percentage of recorded Cora workflows that completed debit/charge without error. Does not track intent-to-completion when that telemetry is unavailable.",
  },
  automatedGrading: {
    label: "Automated Grading Rate",
    description:
      "Share of graded quiz answers on covered courses marked as AI-graded during the selected period. Eligible = answers with a recorded score.",
  },
  seatUtilization: {
    label: "License Utilization",
    description:
      "Active learners in the contract measurement window divided by licensed active learner capacity.",
  },
  practiceAccuracy: {
    label: "Average Practice Accuracy",
    description:
      "Mean percentage correct across completed practice attempts in covered courses during the selected period.",
  },
  independentPerformance: {
    label: "Independent Performance",
    description:
      "Average performance on assessments designated by instructors as AI restricted, AI unavailable, or independent checks. Not available until assessments carry an AI policy tag.",
  },
  aiAssistedPerformance: {
    label: "AI Assisted Performance",
    description:
      "Average performance on learning activities during which AI assistance was permitted and CourseCollab recorded AI assistance. Requires linked Cora sessions.",
  },
  transferScore: {
    label: "Transfer Score",
    description:
      "Performance on a subsequent independent assessment following an AI-assisted learning activity targeting the same concept. Requires concept-linked events.",
  },
  assistanceDepth: {
    label: "Assistance Depth",
    description:
      "Level 0 = no AI … Level 5 = worked/direct solution. Deeper is not assumed better. Requires turn-level classification.",
  },
} as const
