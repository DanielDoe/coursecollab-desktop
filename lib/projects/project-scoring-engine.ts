import {
  type CourseProjectAssignmentRecord,
  type ProjectGradingComponent,
} from "@/lib/projects/project-grading-types"
import {
  legacyProjectGradingConfig,
  LEGACY_INSTRUCTOR_CAP,
  LEGACY_PEER_CAP,
} from "@/lib/projects/project-grading-config"

export type ProjectRawScoreInputs = {
  student_points?: number
  instructor_points?: number
  report_points?: number
  presentation_points?: number
  ai_points?: number
  other_points?: number
}

export type ProjectScoreBreakdownLine = {
  key: string
  label: string
  weight_percent: number
  points_earned: number
  points_possible: number
  /** Raw performance within this component (0–100). */
  raw_percent: number
  /** Weighted contribution toward final project total (same as points_earned when configured correctly). */
  contribution_points: number
  explanation: string
}

export type ProjectScoreBreakdown = {
  total_earned: number
  max_points: number
  percent: number
  grading_mode: string
  lines: ProjectScoreBreakdownLine[]
  legacy: boolean
}

function componentPointsPossible(component: ProjectGradingComponent, maxPoints: number): number {
  if (component.points_cap != null && Number.isFinite(component.points_cap)) {
    return Math.min(maxPoints, Math.max(0, Number(component.points_cap)))
  }
  return (maxPoints * (Number(component.weight_percent) || 0)) / 100
}

function rawPointsForKey(key: string, raw: ProjectRawScoreInputs): number {
  switch (key) {
    case "peer":
      return Number(raw.student_points) || 0
    case "instructor":
      return Number(raw.instructor_points) || 0
    case "report":
      return Number(raw.report_points) || 0
    case "presentation":
      return Number(raw.presentation_points) || 0
    case "ai":
      return Number(raw.ai_points) || 0
    default:
      return Number(raw.other_points) || 0
  }
}

function legacyExplanation(key: string): string {
  if (key === "peer") {
    return `Peer average rating × 6 (max ${LEGACY_PEER_CAP} pts on legacy scale).`
  }
  if (key === "instructor") {
    return `Instructor stars × 4 (max ${LEGACY_INSTRUCTOR_CAP} pts on legacy scale).`
  }
  return "Component score from stored project totals."
}

/**
 * Computes an explainable project total from configurable components.
 * Legacy projects without assignment config use peer + instructor caps (30 + 20).
 */
export function computeProjectScoreBreakdown(
  config: Pick<
    CourseProjectAssignmentRecord,
    "max_points" | "grading_mode" | "grading_components"
  > | null,
  raw: ProjectRawScoreInputs,
): ProjectScoreBreakdown {
  const resolved = config ?? legacyProjectGradingConfig()
  const maxPoints = Math.max(0.01, Number(resolved.max_points) || 50)
  const enabled = resolved.grading_components.filter((c) => c.enabled)
  const legacy = !config

  const lines: ProjectScoreBreakdownLine[] = enabled.map((component) => {
    const possible = componentPointsPossible(component, maxPoints)
    const earned = Math.min(possible, Math.max(0, rawPointsForKey(component.key, raw)))
    const rawPercent = possible > 0 ? (earned / possible) * 100 : 0
    return {
      key: component.key,
      label: component.label,
      weight_percent: Number(component.weight_percent) || 0,
      points_earned: earned,
      points_possible: possible,
      raw_percent: rawPercent,
      contribution_points: earned,
      explanation: legacy
        ? legacyExplanation(component.key)
        : `Raw ${rawPercent.toFixed(1)}% × ${component.weight_percent}% weight → ${earned.toFixed(1)} / ${maxPoints.toFixed(1)} project pts.`,
    }
  })

  const totalEarned = lines.reduce((s, l) => s + l.points_earned, 0)
  const cappedTotal = Math.min(maxPoints, totalEarned)

  return {
    total_earned: cappedTotal,
    max_points: maxPoints,
    percent: Math.min(100, (cappedTotal / maxPoints) * 100),
    grading_mode: resolved.grading_mode,
    lines,
    legacy,
  }
}

/** Gradebook category percent from raw project score row. */
export function projectScoreToCategoryPercent(
  totalEarned: number,
  maxPoints: number,
): number {
  const max = Math.max(0.01, maxPoints)
  return Math.min(100, (totalEarned / max) * 100)
}
