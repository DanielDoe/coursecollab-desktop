"use client"

import { ChevronRight } from "lucide-react"
import { getQuestionBankTypeMeta } from "@/lib/question-bank-type-config"
import { questionBankCardClass, questionBankCardHoverClass } from "@/lib/question-bank-ui"
import { cn } from "@/lib/utils"
import { FileQuestion } from "lucide-react"

export function QuestionTypeBankCard({
  typeId,
  label,
  count,
  onView,
}: {
  typeId: string
  label: string
  count: number
  onView: () => void
}) {
  const meta = getQuestionBankTypeMeta(typeId)
  const Icon = meta?.icon ?? FileQuestion
  const countLabel = `${count} ${count === 1 ? "question" : "questions"}`

  return (
    <button
      type="button"
      onClick={onView}
      className={cn(
        questionBankCardClass,
        questionBankCardHoverClass,
        "w-full flex items-center gap-3 px-4 py-3 text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-2",
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--sidebar-accent)]/50">
        <Icon className="h-4 w-4 text-[var(--cc-accent)]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{countLabel}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
    </button>
  )
}
