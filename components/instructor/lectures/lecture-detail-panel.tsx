"use client"

import type { LucideIcon } from "lucide-react"
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Edit,
  Eye,
  FileText,
  MessageSquare,
  PenLine,
  Presentation,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalListStripe } from "@/lib/portal-module-themes"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { formatLectureIndexLabel } from "@/lib/lecture-index-label"
import { cn } from "@/lib/utils"

export type LectureDetailData = {
  id: number
  week: number
  title: string
  session: string | null
  description: string
  is_published: boolean
  pdf_url?: string | null
  original_file_url?: string | null
}

type LectureDetailPanelProps = {
  lecture: LectureDetailData
  chrome: ReturnType<typeof facultyEmbedChrome>
  onBack: () => void
  onPreview: () => void
  onSlideDeck: () => void
  onSlides: () => void
  onWorkspace: () => void
  onMaterials: () => void
  onComments: () => void
  onEdit: () => void
  onSamplePractice: () => void
  onDelete: () => void
}

type ActionTile = {
  label: string
  icon: LucideIcon
  onClick: () => void
}

function parseLectureTitle(title: string): { courseLine: string | null; lectureLine: string } {
  const dash = title.indexOf(" — ")
  if (dash <= 0) return { courseLine: null, lectureLine: title }
  return {
    courseLine: title.slice(0, dash).trim(),
    lectureLine: title.slice(dash + 3).trim(),
  }
}

function parseLectureDescription(description: string): {
  scheduledLabel: string | null
  body: string
} {
  const trimmed = description.trim()
  if (!trimmed) return { scheduledLabel: null, body: "" }
  const match = /^Scheduled:\s*([^.]+)\.\s*([\s\S]*)$/i.exec(trimmed)
  if (!match) return { scheduledLabel: null, body: trimmed }
  return {
    scheduledLabel: match[1].trim(),
    body: match[2].trim(),
  }
}

function StatusPill({ published }: { published: boolean }) {
  if (published) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
        Live
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" aria-hidden />
      Draft
    </span>
  )
}

function ActionGrid({
  actions,
  stripeOffset,
}: {
  actions: ActionTile[]
  stripeOffset: number
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {actions.map((action, index) => {
        const stripe = portalListStripe(stripeOffset + index)
        const Icon = action.icon
        return (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className="group flex min-h-[44px] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
          >
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", stripe.iconWell)}>
              <Icon className={cn("h-4 w-4", stripe.iconText)} />
            </span>
            <span className={cn("min-w-0 text-sm font-medium", PORTAL_TEXT)}>{action.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function LectureDetailPanel({
  lecture,
  chrome,
  onBack,
  onPreview,
  onSlideDeck,
  onSlides,
  onWorkspace,
  onMaterials,
  onComments,
  onEdit,
  onSamplePractice,
  onDelete,
}: LectureDetailPanelProps) {
  const { courseLine, lectureLine } = parseLectureTitle(lecture.title)
  const { scheduledLabel, body } = parseLectureDescription(lecture.description)
  const hasDeck = Boolean(lecture.pdf_url || lecture.original_file_url)

  const actions: ActionTile[] = [
    { label: "Preview", icon: Eye, onClick: onPreview },
    { label: "Slides", icon: Presentation, onClick: onSlides },
    { label: "Slide deck", icon: FileText, onClick: onSlideDeck },
    { label: "Workspace", icon: PenLine, onClick: onWorkspace },
    { label: "Materials", icon: Upload, onClick: onMaterials },
    { label: "Sample practice", icon: Sparkles, onClick: onSamplePractice },
    { label: "Edit details", icon: Edit, onClick: onEdit },
    { label: "Comments", icon: MessageSquare, onClick: onComments },
  ]

  return (
    <section className={cn(chrome.card, "overflow-hidden")}>
      <div className={cn("border-b border-[var(--border)] px-4 py-3 sm:px-5", chrome.p.softBg)}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("h-8 gap-1.5 rounded-lg px-2", chrome.quiet)}
            onClick={onBack}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All lectures
          </Button>
          <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", chrome.p.softBg, chrome.p.iconText)}>
            {formatLectureIndexLabel(lecture.week, { title: lecture.title })}
          </span>
          {lecture.session ? (
            <span className="rounded-md bg-[var(--card)] px-2 py-0.5 text-[11px] font-medium text-[var(--cc-text-muted)] ring-1 ring-[var(--border)]">
              {lecture.session}
            </span>
          ) : null}
          <StatusPill published={lecture.is_published} />
          {hasDeck ? (
            <span className="rounded-md bg-[var(--card)] px-2 py-0.5 text-[11px] font-medium text-[var(--cc-text-muted)] ring-1 ring-[var(--border)]">
              Deck attached
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="flex gap-3 sm:gap-4">
          <div className={cn("hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl sm:flex", chrome.iconBadge())}>
            <BookOpen className="h-6 w-6 !text-white" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            {courseLine ? (
              <p className={cn("text-xs font-medium uppercase tracking-wide", PORTAL_TEXT_MUTED)}>{courseLine}</p>
            ) : null}
            <h2 className={cn("text-lg font-semibold leading-snug sm:text-xl", PORTAL_TEXT)}>{lectureLine}</h2>
          </div>
        </div>

        {scheduledLabel || body ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/35 p-3.5 sm:p-4">
            {scheduledLabel ? (
              <p className={cn("flex items-start gap-2 text-sm font-medium", PORTAL_TEXT)}>
                <Calendar className={cn("mt-0.5 h-4 w-4 shrink-0", chrome.p.iconText)} />
                <span>{scheduledLabel}</span>
              </p>
            ) : null}
            {body ? (
              <p className={cn("mt-2 text-sm leading-relaxed", PORTAL_TEXT_MUTED, scheduledLabel && "pl-6")}>
                {body}
              </p>
            ) : null}
          </div>
        ) : null}

        <ActionGrid actions={actions} stripeOffset={0} />

        <div className="flex justify-end border-t border-[var(--border)] pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 rounded-lg text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-400"
            onClick={onDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete lecture
          </Button>
        </div>
      </div>
    </section>
  )
}
