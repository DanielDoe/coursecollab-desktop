"use client"

import { cn } from "@/lib/utils"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { parseProjectEvaluation } from "@/lib/projects/project-evaluation-text"

function levelTone(level: string | null) {
  const value = (level || "").toLowerCase()
  if (value === "met" || value.startsWith("exceed")) return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
  if (value.includes("partial")) return "bg-amber-500/15 text-amber-800 dark:text-amber-200"
  if (value.includes("not")) return "bg-rose-500/15 text-rose-800 dark:text-rose-200"
  return "bg-[var(--muted)] text-[var(--cc-text)]"
}

function levelLabel(level: string | null) {
  if (!level) return null
  return level.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function NoteList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div className="px-4 py-3">
      <p className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", PORTAL_TEXT_MUTED)}>{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className={cn("text-sm leading-relaxed", PORTAL_TEXT)}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ProjectEvaluationPanel({
  feedback,
  emptyLabel = "No graded feedback yet.",
}: {
  feedback?: string | null
  emptyLabel?: string
}) {
  const parsed = parseProjectEvaluation(feedback || "")
  const hasBody = Boolean(parsed.reason || parsed.rubric.length || parsed.didWell.length || parsed.missing.length || parsed.improve.length)
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Evaluation</p>
      </div>
      {!hasBody ? (
        <p className={cn("px-4 py-3 text-sm italic", PORTAL_TEXT_MUTED)}>{feedback?.trim() ? feedback : emptyLabel}</p>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {parsed.reason ? (
            <p className={cn("px-4 py-3 text-sm leading-relaxed", PORTAL_TEXT)}>{parsed.reason}</p>
          ) : null}
          {parsed.rubric.map((item) => (
            <div key={`${item.title}-${item.note}`} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>{item.title}</p>
                {item.level ? (
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", levelTone(item.level))}>
                    {levelLabel(item.level)}
                  </span>
                ) : null}
              </div>
              {item.note ? <p className={cn("mt-1.5 text-sm leading-relaxed", PORTAL_TEXT)}>{item.note}</p> : null}
            </div>
          ))}
          <NoteList title="What you did well" items={parsed.didWell} />
          <NoteList title="What's missing" items={parsed.missing} />
          <NoteList title="How to improve" items={parsed.improve} />
        </div>
      )}
    </div>
  )
}
