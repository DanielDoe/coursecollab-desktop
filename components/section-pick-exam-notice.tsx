import { Clock, ListChecks, Shuffle } from "lucide-react"
import type { StudentPickSectionSummary } from "@/lib/section-pick-scoring"

type SectionPickExamNoticeProps = {
  sections: StudentPickSectionSummary[]
  /** Total questions in each pick section (by order band), keyed by sectionIndex */
  poolSizes?: Record<number, number>
  variant?: "instructions" | "inline"
}

export function SectionPickExamNotice({
  sections,
  poolSizes = {},
  variant = "instructions",
}: SectionPickExamNoticeProps) {
  if (!sections.length) return null

  const isInstructions = variant === "instructions"

  return (
    <div
      className={
        isInstructions
          ? "p-5 rounded-lg bg-violet-50 dark:bg-violet-950/30 border-2 border-violet-200 dark:border-violet-800/50 space-y-3"
          : "rounded-xl border border-violet-300/60 bg-violet-50/90 dark:bg-violet-950/40 dark:border-violet-700/60 px-4 py-3 text-sm"
      }
    >
      <div className="flex items-center gap-2">
        <ListChecks
          className={`${isInstructions ? "h-5 w-5" : "h-4 w-4"} text-violet-600 dark:text-violet-400 shrink-0`}
        />
        <h3
          className={
            isInstructions
              ? "font-bold text-base text-violet-900 dark:text-violet-100"
              : "font-semibold text-violet-900 dark:text-violet-100"
          }
        >
          Section II — pooled timer & grading picks
        </h3>
      </div>
      {sections.map((s) => {
        const pool = poolSizes[s.sectionIndex]
        const minutes =
          s.totalTimeSeconds != null ? Math.round(s.totalTimeSeconds / 60) : null
        return (
          <div key={s.sectionIndex} className="space-y-1.5">
            <p
              className={`${isInstructions ? "text-sm" : "text-xs"} text-violet-950 dark:text-violet-100 leading-relaxed`}
            >
              For <strong>{s.title}</strong>, mark exactly{" "}
              <strong>{s.questionsRequired}</strong>
              {pool != null ? (
                <>
                  {" "}
                  of <strong>{pool}</strong> circuit problems
                </>
              ) : (
                " circuit problems"
              )}{" "}
              as <em>Selected for grading</em>. Only those {s.questionsRequired} count toward your
              score ({s.questionsRequired}/{s.questionsRequired}, not {s.questionsRequired}/
              {pool ?? "all"}).
            </p>
            {minutes != null && (
              <div
                className={`space-y-1 ${isInstructions ? "text-xs" : "text-[11px]"} text-violet-800 dark:text-violet-200`}
              >
                <p className="flex items-start gap-1.5">
                  <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-violet-600 dark:text-violet-400" />
                  <span>
                    <strong>One shared timer:</strong> {minutes} minutes for the entire section —{" "}
                    <strong>no per-question countdown</strong> on circuit problems.
                  </span>
                </p>
                <p className="flex items-start gap-1.5">
                  <Shuffle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-violet-600 dark:text-violet-400" />
                  <span>
                    Jump to any Section II number below while time remains. You can revise uploads
                    until the section timer hits zero.
                  </span>
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
