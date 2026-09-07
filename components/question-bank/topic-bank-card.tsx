"use client"

import { Brain, ChevronRight, Edit, Eye, FolderOpen, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { questionBankCardClass, questionBankCardHoverClass } from "@/lib/question-bank-ui"
import { cn } from "@/lib/utils"

export type TopicBankCardData = {
  id: number
  name: string
  description: string | null
  question_count: number
}

type TopicCardProps = {
  topic: TopicBankCardData
  verifiedCount?: number
  viewMode: "grid" | "list"
  onView: () => void
  onVerify: () => void
  onEdit: () => void
}

export function TopicBankCard({ topic, verifiedCount, viewMode, onView, onVerify, onEdit }: TopicCardProps) {
  const countLabel = `${topic.question_count} ${topic.question_count === 1 ? "question" : "questions"}`

  if (viewMode === "list") {
    return (
      <article
        className={cn(
          questionBankCardClass,
          questionBankCardHoverClass,
          "flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3",
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--sidebar-accent)]/50">
          <FolderOpen className="h-4 w-4 text-[var(--cc-accent)]" />
        </div>
        <button type="button" onClick={onView} className="min-w-0 flex-1 text-left">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{topic.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {countLabel}
            {verifiedCount != null && verifiedCount > 0 ? ` · ${verifiedCount} verified` : ""}
          </p>
        </button>
        <TopicCardMenu onView={onView} onVerify={onVerify} onEdit={onEdit} />
      </article>
    )
  }

  return (
    <article
      className={cn(
        questionBankCardClass,
        questionBankCardHoverClass,
        "group flex items-center gap-3 px-3 py-3 sm:px-4",
      )}
    >
      <button type="button" onClick={onView} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--sidebar-accent)]/50">
          <FolderOpen className="h-4 w-4 text-[var(--cc-accent)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
            {topic.name}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {countLabel}
            {verifiedCount != null && verifiedCount > 0 ? ` · ${verifiedCount} verified` : ""}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 opacity-60 group-hover:opacity-100" aria-hidden />
      </button>
      <TopicCardMenu onView={onView} onVerify={onVerify} onEdit={onEdit} />
    </article>
  )
}

function TopicCardMenu({
  onView,
  onVerify,
  onEdit,
}: {
  onView: () => void
  onVerify: () => void
  onEdit: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-slate-500">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Topic actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onView}>
          <Eye className="h-4 w-4 mr-2" />
          View
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onVerify}>
          <Brain className="h-4 w-4 mr-2" />
          AI Verify
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
