"use client"

import type { SurveySummaryData } from "@/components/instructor/course-evaluation-survey-summary"

export type CourseEvaluationNavSection = "overview" | "evaluations" | "pending-approval"

export type EvaluationRow = SurveySummaryData & {
  id: number
  student_id: number
  full_name: string
  student_code: string
  section: string
  course_rating: number
  improvement_suggestions: string
  platform_helpfulness?: number | null
  favorite_features?: string[] | null
  favorite_features_other?: string | null
  feature_to_improve?: string | null
  feature_to_improve_other?: string | null
  self_assessed_letter_grade?: string | null
  actual_letter_grade?: string | null
  actual_total_score?: number | null
  status: string
  submitted_at?: string
  proof_count?: number
}

export type Proof = { id: number; url: string; file_name?: string; mime?: string }

export function gradeMismatch(selfGrade?: string | null, actualGrade?: string | null): boolean {
  if (!selfGrade || !actualGrade) return false
  return selfGrade.trim().toUpperCase() !== actualGrade.trim().toUpperCase()
}

export function normalizeEvaluationRow(raw: Record<string, unknown>): EvaluationRow {
  let favoriteFeatures: string[] = []
  const ff = raw.favorite_features
  if (Array.isArray(ff)) favoriteFeatures = ff.map(String)
  else if (typeof ff === "string" && ff.trim()) {
    try {
      const parsed = JSON.parse(ff) as unknown
      if (Array.isArray(parsed)) favoriteFeatures = parsed.map(String)
    } catch {
      favoriteFeatures = []
    }
  }

  return {
    ...(raw as EvaluationRow),
    favorite_features: favoriteFeatures,
  }
}

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Returned",
  draft: "Draft",
}
