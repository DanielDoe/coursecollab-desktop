"use client"

import { getFacultyModuleTheme } from "@/lib/faculty-module-themes"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ArrowUpRight, Clock, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { fallbackNotificationSummary } from "@/lib/notification-ai-summary-shared"

export type InstructorNotificationDetail = {
  id: number
  type: string
  title: string
  message: string
  link: string | null
  is_read: boolean
  created_at: string
  read_at?: string | null
  source_type?: string | null
  source_id?: string | null
  source_name?: string | null
  ai_summary?: string | null
}

function formatTypeLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function resolveSummary(notification: InstructorNotificationDetail): string {
  if (notification.ai_summary?.trim()) return notification.ai_summary.trim()
  return fallbackNotificationSummary({
    title: notification.title,
    message: notification.message,
    type: notification.type,
  })
}

export function InstructorNotificationDetailDialog({
  notification,
  open,
  onOpenChange,
  onOpenRelated,
  embedInDashboard,
}: {
  notification: InstructorNotificationDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenRelated?: (notification: InstructorNotificationDetail) => void
  embedInDashboard?: boolean
}) {
  const fp = getFacultyModuleTheme("notifications").page
  const cardBase = PORTAL_CARD

  if (!notification) return null

  const summary = resolveSummary(notification)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-3 border-b border-[var(--border)] px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Badge variant="outline" className="capitalize border-[var(--cc-accent)]/35">
                {formatTypeLabel(notification.type)}
              </Badge>
              <DialogTitle className={cn("text-left text-xl leading-snug", PORTAL_TEXT)}>{notification.title}</DialogTitle>
              <DialogDescription className={cn("flex items-center gap-2 text-left", PORTAL_TEXT_MUTED)}>
                <Clock className="h-3.5 w-3.5" />
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                {notification.source_name ? ` · From ${notification.source_name}` : null}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-xl bg-[var(--cc-accent-soft)]/25 px-4 py-3.5">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--cc-accent-dark)]" />
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-accent-dark)]">
                AI Summary
              </span>
            </div>
            <p className={cn("text-sm leading-relaxed", PORTAL_TEXT)}>{summary}</p>
          </div>

          <div className={cn("rounded-xl bg-[var(--sidebar-accent)]/25 p-4", cardBase, "border-0 shadow-none")}>
            <p className={cn("mb-2 text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>Full Message</p>
            <p className={cn("whitespace-pre-wrap text-sm leading-relaxed", PORTAL_TEXT)}>
              {notification.message}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-[var(--border)] px-6 py-4 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {notification.link ? (
            onOpenRelated ? (
              <Button
                className={embedInDashboard ? fp.cta : undefined}
                onClick={() => onOpenRelated(notification)}
              >
                Open Related Screen
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button asChild className={embedInDashboard ? fp.cta : undefined}>
                <Link href={notification.link}>
                  Open Related Screen
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
