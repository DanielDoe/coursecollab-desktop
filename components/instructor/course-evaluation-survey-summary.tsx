"use client"

import {
  LIKERT_5,
  PLATFORM_HELPFULNESS_LIKERT,
  INSTRUCTOR_CLARITY_LIKERT,
  likertLabel,
  SURVEY_OTHER_OPTION,
} from "@/lib/course-evaluation-survey"
import { cn } from "@/lib/utils"
import {
  CE_LABEL,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/course-evaluations/course-evaluation-surface-classes"

export type SurveySummaryData = {
  course_rating?: number | null
  platform_helpfulness?: number | null
  favorite_features?: string[] | null
  favorite_features_other?: string | null
  feature_to_improve?: string | null
  feature_to_improve_other?: string | null
  improvement_suggestions?: string | null
  instructor_clarity?: number | null
  workload?: string | null
  ai_tutor_usage?: string | null
  nps_score?: number | null
  missing_features?: string | null
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="text-sm">
      <p className={cn("mb-0.5 text-xs font-medium uppercase tracking-wide", CE_LABEL)}>{label}</p>
      <div className={PORTAL_TEXT}>{value}</div>
    </div>
  )
}

export function CourseEvaluationSurveySummary({
  data,
  variant = "instructor",
}: {
  data: SurveySummaryData
  variant?: "instructor" | "student"
}) {
  const favorites = Array.isArray(data.favorite_features) ? data.favorite_features : []
  const improveLabel =
    data.feature_to_improve === SURVEY_OTHER_OPTION && data.feature_to_improve_other?.trim()
      ? `Other — ${data.feature_to_improve_other.trim()}`
      : data.feature_to_improve || "—"
  const badgeClass =
    variant === "student"
      ? "rounded-md bg-sky-500/15 px-2 py-0.5 text-xs text-sky-800 dark:bg-sky-500/20 dark:text-sky-200"
      : "rounded-md bg-[var(--cc-accent-soft)] px-2 py-0.5 text-xs text-[var(--cc-accent-dark)]"

  return (
    <div
      className={cn(
        "space-y-4",
        variant === "instructor" && "rounded-xl border border-[var(--border)] bg-muted/20 p-3 sm:p-4",
      )}
    >
      {variant === "instructor" ? <p className={CE_LABEL}>Survey responses</p> : null}
      <Row
        label="Overall course experience"
        value={likertLabel(LIKERT_5, data.course_rating)}
      />
      <Row
        label="CourseCollab improved learning"
        value={likertLabel(PLATFORM_HELPFULNESS_LIKERT, data.platform_helpfulness)}
      />
      <Row
        label="Favorite features"
        value={
          favorites.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {favorites.map((f) => (
                <span key={f} className={badgeClass}>
                  {f === SURVEY_OTHER_OPTION && data.favorite_features_other?.trim()
                    ? `Other — ${data.favorite_features_other.trim()}`
                    : f}
                </span>
              ))}
            </div>
          ) : (
            "—"
          )
        }
      />
      <Row label="Improve first" value={improveLabel} />
      <Row
        label="Open feedback"
        value={<p className="whitespace-pre-wrap">{data.improvement_suggestions || "—"}</p>}
      />
      {data.instructor_clarity != null && data.instructor_clarity > 0 && (
        <Row
          label="Instructor explained clearly"
          value={likertLabel(INSTRUCTOR_CLARITY_LIKERT, data.instructor_clarity)}
        />
      )}
      {data.workload && <Row label="Workload" value={data.workload} />}
      {data.ai_tutor_usage && <Row label="AI Tutor usage" value={data.ai_tutor_usage} />}
      {data.nps_score != null && <Row label="Recommend score (NPS)" value={`${data.nps_score} / 10`} />}
      {data.missing_features?.trim() && (
        <Row label="Missing features" value={<p className="whitespace-pre-wrap">{data.missing_features}</p>} />
      )}
    </div>
  )
}
