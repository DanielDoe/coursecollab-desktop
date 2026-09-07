import type { QuestionBankTypeCategory } from "@/lib/question-bank-type-config"
import { PORTAL_CARD } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

/** Subtle accent for icons only — no card gradients. */
export type QuestionBankCategoryAccent = {
  icon: string
  iconBg: string
}

export const QUESTION_BANK_CATEGORY_ACCENTS: Record<QuestionBankTypeCategory, QuestionBankCategoryAccent> = {
  choice: {
    icon: "text-slate-600 dark:text-slate-300",
    iconBg: "bg-slate-100 dark:bg-slate-800",
  },
  coding: {
    icon: "text-slate-600 dark:text-slate-300",
    iconBg: "bg-slate-100 dark:bg-slate-800",
  },
  structured: {
    icon: "text-slate-600 dark:text-slate-300",
    iconBg: "bg-slate-100 dark:bg-slate-800",
  },
}

/** Shared surface styles for question bank cards */
export const questionBankCardClass = cn(PORTAL_CARD, "shadow-none transition-colors")

export const questionBankCardHoverClass = cn(
  "hover:border-[var(--cc-accent)]/30 hover:bg-[var(--cc-accent-soft)]/45",
)

export function difficultyBadgeClass(difficulty: string): string {
  const d = (difficulty || "").toLowerCase()
  return cn(
    "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
    d === "easy" &&
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300",
    d === "medium" &&
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-300",
    d === "hard" &&
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-300",
    !["easy", "medium", "hard"].includes(d) &&
      "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300",
  )
}

export const questionBankSectionClass =
  "rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] shadow-sm overflow-hidden"

export const questionBankSectionHeaderClass =
  "px-4 py-3 sm:px-5 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/80 dark:bg-white/[0.03]"
