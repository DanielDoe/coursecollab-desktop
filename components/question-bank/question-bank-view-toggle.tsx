"use client"

import { LayoutGrid, List } from "lucide-react"
import { cn } from "@/lib/utils"

export function QuestionBankViewToggle({
  value,
  onChange,
}: {
  value: "grid" | "list"
  onChange: (mode: "grid" | "list") => void
}) {
  return (
    <div className="inline-flex rounded-md border border-slate-200 dark:border-white/10 p-0.5 bg-slate-50 dark:bg-slate-900/50 shrink-0">
      <button
        type="button"
        onClick={() => onChange("grid")}
        aria-label="Grid view"
        className={cn(
          "p-1.5 rounded-[5px] transition-colors",
          value === "grid"
            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
        )}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        aria-label="List view"
        className={cn(
          "p-1.5 rounded-[5px] transition-colors",
          value === "list"
            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
        )}
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  )
}
