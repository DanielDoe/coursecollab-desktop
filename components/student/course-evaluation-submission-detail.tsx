"use client"

import { Calendar, ExternalLink, FileText, Target } from "lucide-react"
import { CourseEvaluationSurveySummary } from "@/components/instructor/course-evaluation-survey-summary"
import { CourseEvaluationProofPreview } from "@/components/course-evaluation-proof-preview"
import { getStudentNavGroupTheme } from "@/lib/student-module-themes"
import { cn } from "@/lib/utils"

type Proof = { id: number; url: string; file_name?: string; mime?: string }

export type CourseEvaluationSubmissionData = {
  self_assessed_letter_grade?: string | null
  submitted_at?: string
  reviewed_at?: string
  course_rating: number
  platform_helpfulness?: number | null
  favorite_features?: string[]
  favorite_features_other?: string | null
  feature_to_improve?: string | null
  feature_to_improve_other?: string | null
  improvement_suggestions: string
  instructor_clarity?: number | null
  workload?: string | null
  ai_tutor_usage?: string | null
  nps_score?: number | null
  missing_features?: string | null
  proofs?: Proof[]
}

const theme = getStudentNavGroupTheme("course-info")

const JEANS = cn(
  "rounded-xl border bg-white border-gray-200 shadow-md",
  "transition-shadow duration-300 hover:shadow-lg",
  "dark:border-white/15 dark:bg-[color-mix(in_srgb,var(--card)_78%,white)]",
  "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_22px_rgba(0,0,0,0.45)]",
)

const TITLE = "text-gray-800 dark:text-[var(--cc-text)]"
const BODY = "text-gray-700 dark:text-[var(--cc-text-muted)]"

function formatWhen(iso?: string) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function DetailCard({
  title,
  icon: Icon,
  crestClass,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  crestClass: string
  children: React.ReactNode
}) {
  return (
    <section className={cn(JEANS, "relative p-4 pt-0 sm:p-5 sm:pt-0")}>
      <div
        className={cn(
          "relative mx-0 -mt-3 mb-4 inline-flex h-11 items-center gap-2 rounded-xl px-3.5 shadow-md",
          crestClass,
        )}
      >
        <Icon className="size-4 text-white" />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </section>
  )
}

export function CourseEvaluationSubmissionDetail({
  evaluation,
}: {
  evaluation: CourseEvaluationSubmissionData
}) {
  const proofs = evaluation.proofs ?? []
  const submitted = formatWhen(evaluation.submitted_at)
  const reviewed = formatWhen(evaluation.reviewed_at)

  return (
    <div className="space-y-5 pt-3">
      <DetailCard title="Your responses" icon={FileText} crestClass="bg-sky-500">
        <CourseEvaluationSurveySummary data={evaluation} variant="student" />
      </DetailCard>

      <DetailCard title="Pass expectation" icon={Target} crestClass="bg-[var(--cc-accent)]">
        <p className={cn("text-sm", BODY)}>
          The letter grade that would feel like success to you in this course:
        </p>
        <p
          className={cn(
            "mt-2 inline-flex rounded-xl border px-3 py-1.5 text-lg font-semibold",
            theme.page.border,
            theme.page.softBg,
            theme.page.iconText,
          )}
        >
          {evaluation.self_assessed_letter_grade || "—"}
        </p>
      </DetailCard>

      <DetailCard title="Canvas evaluation proof" icon={ExternalLink} crestClass="bg-emerald-500">
        {proofs.length === 0 ? (
          <p className={cn("text-sm", BODY)}>No proof files on record.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {proofs.map((p) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  JEANS,
                  "group block overflow-hidden hover:shadow-lg",
                )}
              >
                <div className="relative aspect-[4/3] bg-gray-50 dark:bg-white/5">
                  <CourseEvaluationProofPreview url={p.url} fileName={p.file_name} mime={p.mime} />
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-gray-200 px-3 py-2.5 dark:border-white/10">
                  <p className={cn("min-w-0 truncate text-xs font-medium", TITLE)}>
                    {p.file_name || "Proof file"}
                  </p>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-sky-700 group-hover:text-sky-800 dark:text-sky-400 dark:group-hover:text-sky-300">
                    Open
                    <ExternalLink className="size-3" />
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </DetailCard>

      {(submitted || reviewed) && (
        <div className={cn(JEANS, "flex flex-wrap gap-4 px-4 py-3.5 text-xs sm:px-5", BODY)}>
          {submitted ? (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
              Submitted {submitted}
            </span>
          ) : null}
          {reviewed ? (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
              Reviewed {reviewed}
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
}
