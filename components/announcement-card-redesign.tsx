"use client"

import { formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Eye,
  Pin,
  Sparkles,
  MessageSquare,
  Clock,
  ChevronRight,
  Paperclip,
  User,
  MoreVertical,
  Edit,
  Trash2,
  Lock,
  Unlock,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { announcementPlainText } from "@/lib/announcement-content"

interface Announcement {
  id: number
  title: string
  content: string
  author_name?: string
  pinned: boolean
  views_count: number
  reactions_count: number
  reactions_breakdown?: Record<string, number>
  created_at: string
  updated_at: string
  attachments?: Array<{ name: string; url: string; type: string }>
  priority?: "urgent" | "important" | "normal"
  category?: string
  comments_count?: number
  is_read?: boolean
  viewed_by_me?: boolean
  my_reaction?: string | null
  student_content_locked?: boolean
  attachment_count?: number
  ai_summary?: string | null
}

interface AnnouncementCardProps {
  announcement: Announcement
  variant?: "student" | "instructor"
  displayMode?: "list" | "grid"
  onView?: () => void
  onReact?: (reaction: string) => void
  onEdit?: () => void
  onDelete?: () => void
  onPin?: () => void
  onLock?: () => void
}

const announcementCardBorder =
  "border border-slate-200/90 dark:border-white/[0.16] hover:border-slate-300 dark:hover:border-white/25"
const announcementCardDivider = "border-slate-200/80 dark:border-white/12"

const reactionEmojis = [
  { emoji: "👍", name: "like" },
  { emoji: "❤️", name: "love" },
  { emoji: "🔥", name: "fire" },
  { emoji: "😮", name: "wow" },
]

const categoryStyles: Record<string, string> = {
  exam: "bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-300 ring-red-500/20",
  homework: "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)] ring-[var(--cc-accent-border)]",
  lecture: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 ring-emerald-500/20",
  event: "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)] ring-[var(--cc-accent-border)]",
  general: "bg-[var(--muted)] text-[var(--cc-text)] ring-[var(--border)]",
}

function StatChip({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  value: number
  label: string
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--muted)]/80 px-2.5 py-1 text-[11px] font-medium text-[var(--cc-text-muted)]"
      title={label}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={2} />
      {value}
    </span>
  )
}

function InstructorActionsMenu({
  announcement,
  isLockedForStudents,
  onEdit,
  onPin,
  onLock,
  onDelete,
}: {
  announcement: Announcement
  isLockedForStudents: boolean
  onEdit?: () => void
  onPin?: () => void
  onLock?: () => void
  onDelete?: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-lg text-[var(--cc-text-muted)] hover:bg-[var(--muted)]"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onEdit} className="cursor-pointer text-sm">
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPin} className="cursor-pointer text-sm">
          <Pin className="mr-2 h-4 w-4" />
          {announcement.pinned ? "Unpin" : "Pin"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onLock} className="cursor-pointer text-sm">
          {isLockedForStudents ? (
            <>
              <Unlock className="mr-2 h-4 w-4" />
              Unlock for students
            </>
          ) : (
            <>
              <Lock className="mr-2 h-4 w-4" />
              Lock for students
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDelete}
          className="cursor-pointer text-sm text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SummaryPreview({
  previewSummary,
  hasAiSummary,
  isLockedForStudents,
  isInstructor,
  compact,
}: {
  previewSummary: string
  hasAiSummary: boolean
  isLockedForStudents: boolean
  isInstructor: boolean
  compact?: boolean
}) {
  if (!isInstructor && isLockedForStudents) {
    return (
      <p className="text-sm italic text-[var(--cc-text-muted)]">
        Content hidden until your instructor unlocks this announcement.
      </p>
    )
  }

  if (hasAiSummary) {
    return (
      <div
        className={cn(
          "rounded-xl border border-[var(--border)] bg-[var(--card)] p-3",
          compact && "p-2.5",
        )}
      >
        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
          <Sparkles className="h-3 w-3 shrink-0" />
          AI summary
        </p>
        <p className={cn("line-clamp-2 text-sm leading-relaxed text-[var(--cc-text-muted)]", compact && "line-clamp-1 text-[13px]")}>
          {previewSummary}
        </p>
      </div>
    )
  }

  return (
    <p className={cn("line-clamp-2 text-sm leading-relaxed text-[var(--cc-text-muted)]", compact && "line-clamp-1")}>
      {previewSummary}
    </p>
  )
}

function InstructorAnnouncementCard({
  announcement,
  displayMode,
  previewSummary,
  isLockedForStudents,
  hasAttachments,
  attachmentCount,
  views,
  onView,
  onEdit,
  onDelete,
  onPin,
  onLock,
}: {
  announcement: Announcement
  displayMode: "list" | "grid"
  previewSummary: string
  isLockedForStudents: boolean
  hasAttachments: boolean
  attachmentCount: number
  views: number
  onView?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onPin?: () => void
  onLock?: () => void
}) {
  const timeAgo = formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })
  const isGrid = displayMode === "grid"
  const meta = [
    announcement.author_name || "Instructor",
    timeAgo,
    announcement.category,
    views > 0 ? `${views} view${views === 1 ? "" : "s"}` : null,
    hasAttachments ? `${attachmentCount} file${attachmentCount === 1 ? "" : "s"}` : null,
  ].filter(Boolean)

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onView}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onView?.()
        }
      }}
      className={cn(
        "group w-full cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--card)] text-left transition-colors hover:bg-[var(--muted)]/30",
        announcement.pinned && "border-[color-mix(in_srgb,var(--cc-accent)_35%,var(--border))]",
        isGrid ? "flex h-full flex-col p-4" : "px-3.5 py-3 sm:px-4 sm:py-3.5",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("min-w-0 font-semibold tracking-tight text-[var(--cc-text)]", isGrid ? "line-clamp-2 text-base" : "truncate text-sm sm:text-[15px]")}>
              {announcement.title}
            </h3>
            {announcement.pinned ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-accent-dark)]">
                <Pin className="h-3 w-3 fill-current" />
                Pinned
              </span>
            ) : null}
            {isLockedForStudents ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                <Lock className="h-3 w-3" />
                Locked
              </span>
            ) : null}
          </div>
          <p className={cn("mt-1 text-sm leading-relaxed text-[var(--cc-text-muted)]", isGrid ? "line-clamp-3" : "line-clamp-1")}>
            {previewSummary}
          </p>
          <p className="mt-1.5 truncate text-xs text-[var(--cc-text-muted)]">{meta.join(" · ")}</p>
        </div>
        <div
          className="shrink-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <InstructorActionsMenu
            announcement={announcement}
            isLockedForStudents={isLockedForStudents}
            onEdit={onEdit}
            onPin={onPin}
            onLock={onLock}
            onDelete={onDelete}
          />
        </div>
      </div>
    </article>
  )
}

export function AnnouncementCardRedesign({
  announcement,
  variant = "student",
  displayMode = "grid",
  onView,
  onReact,
  onEdit,
  onDelete,
  onPin,
  onLock,
}: AnnouncementCardProps) {
  const isInstructor = variant === "instructor"
  const isLockedForStudents = announcement.student_content_locked === true

  const truncateContent = (content: string, maxLength = 200) =>
    announcementPlainText(content, maxLength)

  const hasAiSummary = Boolean(announcement.ai_summary?.trim())
  const previewSummary =
    announcement.ai_summary?.trim() ||
    (isLockedForStudents && !isInstructor
      ? "Summary available after your instructor unlocks this announcement."
      : truncateContent(announcement.content || "", 160))

  const hasAttachments =
    (announcement.attachments && announcement.attachments.length > 0) ||
    (isLockedForStudents && Number(announcement.attachment_count ?? 0) > 0)
  const lockedAttachmentCount =
    isLockedForStudents && !isInstructor
      ? Number(announcement.attachment_count ?? announcement.attachments?.length ?? 0)
      : announcement.attachments?.length ?? 0
  const views = Number(announcement.views_count || 0)
  const reactions = Number(announcement.reactions_count || 0)
  const comments = Number(announcement.comments_count || 0)

  if (isInstructor) {
    return (
      <InstructorAnnouncementCard
        announcement={announcement}
        displayMode={displayMode}
        previewSummary={previewSummary}
        isLockedForStudents={isLockedForStudents}
        hasAttachments={hasAttachments}
        attachmentCount={lockedAttachmentCount}
        views={views}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        onPin={onPin}
        onLock={onLock}
      />
    )
  }

  const accent = {
    ring: "ring-[var(--cc-accent-border)]",
    pinnedBg: "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]",
    titleHover: "group-hover:text-[var(--cc-accent-dark)]",
    unreadRing: "ring-[var(--cc-accent)]/45",
  }

  const isList = displayMode === "list"

  const metaLine = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--cc-text-muted)]">
      {announcement.author_name ? (
        <span className="inline-flex items-center gap-1">
          <User className="h-3 w-3 shrink-0 opacity-60" strokeWidth={2} />
          <span>{announcement.author_name}</span>
        </span>
      ) : null}
      <span className="inline-flex items-center gap-1">
        <Clock className="h-3 w-3 shrink-0 opacity-60" strokeWidth={2} />
        {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
      </span>
      {announcement.updated_at !== announcement.created_at ? <span>Edited</span> : null}
    </div>
  )

  const labelsRow = (
    <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
      {announcement.pinned ? (
        <span className="inline-flex items-center gap-1 text-[var(--cc-accent-dark)]">
          <Pin className="h-3 w-3 shrink-0" />
          Pinned
        </span>
      ) : null}
      {announcement.category ? (
        <span className="text-[var(--cc-text-muted)] capitalize">{announcement.category}</span>
      ) : null}
      {!announcement.is_read ? (
        <span className="text-[var(--cc-accent-dark)]">Unread</span>
      ) : null}
      {isLockedForStudents ? (
        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
          <Lock className="h-3 w-3 shrink-0" />
          Locked
        </span>
      ) : null}
    </div>
  )

  const actionsRow = (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {!isLockedForStudents ? (
          <div className="flex items-center gap-0.5">
            {reactionEmojis.map((reaction) => (
              <button
                key={reaction.name}
                type="button"
                aria-label={`React with ${reaction.name}`}
                className={cn(
                  "rounded-md p-1 text-base transition-opacity hover:opacity-100 opacity-80",
                  announcement.my_reaction === reaction.name && "opacity-100 scale-110",
                )}
                onClick={() => onReact?.(reaction.name)}
              >
                {reaction.emoji}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-2.5">
          {reactions > 0 ? <StatChip icon={Sparkles} value={reactions} label="Reactions" /> : null}
          {comments > 0 ? <StatChip icon={MessageSquare} value={comments} label="Comments" /> : null}
          <StatChip icon={Eye} value={views} label="Views" />
        </div>
      </div>
      <Button
        variant="ghost"
        onClick={onView}
        size="sm"
        className={cn(
          "h-8 shrink-0 gap-0.5 px-2 text-[var(--cc-accent-dark)] hover:bg-[var(--cc-accent-soft)] hover:text-[var(--cc-accent-dark)]",
          isList && "font-medium",
        )}
      >
        View
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  )

  if (isList) {
    return (
      <article
        className={cn(
          "group relative rounded-2xl border border-transparent px-3 py-3 transition-colors hover:bg-[var(--muted)]/35 sm:px-4 sm:py-4",
          "hover:border-slate-200/90 dark:hover:border-white/[0.16]",
          !announcement.is_read && "border-[var(--cc-accent-border)]/40 bg-[var(--cc-accent-soft)]/25",
        )}
      >
        <button type="button" onClick={onView} className="w-full text-left">
          <div className="space-y-2">
            {labelsRow}
            <h3
              className={cn(
                "text-base font-semibold leading-snug text-[var(--cc-text)] sm:text-[17px]",
                accent.titleHover,
              )}
            >
              {announcement.title}
            </h3>
            {metaLine}
            <SummaryPreview
              previewSummary={previewSummary}
              hasAiSummary={hasAiSummary}
              isLockedForStudents={isLockedForStudents}
              isInstructor={false}
            />
          </div>
        </button>
        {actionsRow}
      </article>
    )
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="h-full"
    >
      <div
        className={cn(
          "group relative flex h-full flex-col overflow-hidden rounded-2xl bg-[var(--card)] shadow-sm transition-all hover:shadow-md",
          announcementCardBorder,
          "hover:border-[var(--cc-accent-border)] dark:hover:border-[var(--cc-accent-border)]",
          !announcement.is_read && `ring-2 ${accent.unreadRing}`,
          announcement.pinned && `ring-2 ${accent.ring}`,
        )}
      >
        <div className="flex-shrink-0 px-4 pt-4 pb-2 sm:px-5">
          <div className="mb-2">{labelsRow}</div>
          <button type="button" onClick={onView} className="w-full text-left">
            <h3
              className={cn(
                "mb-2 line-clamp-2 text-base font-semibold leading-snug text-[var(--cc-text)] sm:text-lg",
                accent.titleHover,
              )}
            >
              {announcement.title}
            </h3>
          </button>
          {metaLine}
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-4 pb-2 sm:px-5">
          <SummaryPreview
            previewSummary={previewSummary}
            hasAiSummary={hasAiSummary}
            isLockedForStudents={isLockedForStudents}
            isInstructor={false}
          />
          {hasAttachments && !isLockedForStudents ? (
            <p className="mt-2 text-xs text-[var(--cc-text-muted)]">
              <Paperclip className="mr-1 inline h-3 w-3 opacity-60" />
              {announcement.attachments!.length} file{announcement.attachments!.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>

        <div className="mt-auto px-4 pb-4 sm:px-5">{actionsRow}</div>
      </div>
    </motion.article>
  )
}
