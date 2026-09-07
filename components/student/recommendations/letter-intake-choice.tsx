"use client"

import { FileEdit, Sparkles, Star } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  allowAi: boolean
  busy: boolean
  onChoose: (mode: "bring_own_draft" | "questionnaire_ai") => void
}

export function LetterIntakeChoice({ allowAi, busy, onChoose }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">How would you like to continue?</h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
          Choose one option before entering your questionnaire or letter workspace. Pick the path that fits what you already have prepared.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => onChoose("bring_own_draft")}
          className={cn(
            "relative text-left rounded-2xl border-2 border-emerald-400/45 dark:border-emerald-500/35",
            "bg-emerald-50/70 dark:bg-emerald-950/30",
            "p-4 sm:p-5 hover:border-emerald-500/70 hover:shadow-md hover:shadow-emerald-500/10 dark:hover:shadow-emerald-900/25 transition-all",
            "flex flex-col gap-2 disabled:opacity-60 min-h-[132px] overflow-hidden",
          )}
          aria-label="I already have a draft — recommended"
        >
          <span
            className={cn(
              "absolute right-3 top-3 z-[1] inline-flex items-center gap-1 rounded-full",
              "bg-amber-400",
              "px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-amber-950",
              "shadow-md shadow-amber-500/25 ring-2 ring-amber-100/90 dark:ring-amber-400/50",
            )}
          >
            <Star className="h-3 w-3 shrink-0 fill-amber-950 text-amber-950" aria-hidden strokeWidth={2.25} />
            Recommended
          </span>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-emerald-700 dark:text-emerald-400 font-medium pr-28 sm:pr-32">
            <FileEdit className="h-5 w-5 shrink-0" aria-hidden />
            I already have a draft
          </div>
          <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 leading-relaxed flex-1">
            Open our letter workspace with a template editor. Paste your existing draft or type your letter here, revise it like a doc, then send it for review.
          </p>
          <span className="inline-flex mt-1 items-center rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white pointer-events-none w-fit">
            Use template workspace
          </span>
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => onChoose("questionnaire_ai")}
          className={cn(
            "text-left rounded-2xl border border-slate-200/90 dark:border-white/[0.1] bg-white/80 dark:bg-slate-950/40",
            "p-4 sm:p-5 hover:border-sky-600/55 hover:bg-sky-600/[0.06] dark:hover:bg-sky-500/15 transition-colors shadow-sm min-h-[132px]",
            "flex flex-col gap-2 disabled:opacity-60",
          )}
        >
          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-300 font-medium">
            <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
            {allowAi ? "Answer questions first, then AI letter" : "Answer questions step by step"}
          </div>
          <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 leading-relaxed flex-1">
            {allowAi
              ? "A guided, one-at-a-time questionnaire lets you flash through prompts. Afterwards we briefly prepare your drafts, then you review and finalize in your workspace."
              : "One question at a time helps you stay focused. Afterwards you’ll draft your letter on this page (AI generation is turned off by your instructor)."}
          </p>
          <span className="inline-flex mt-1 items-center rounded-xl border border-sky-600/35 bg-sky-600/10 dark:bg-sky-500/15 px-3 py-1.5 text-xs font-medium text-sky-600 dark:text-sky-200 pointer-events-none w-fit">
            {allowAi ? "Start guided questionnaire" : "Start guided questionnaire"}
          </span>
        </button>
      </div>
    </div>
  )
}
