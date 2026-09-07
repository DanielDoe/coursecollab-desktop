"use client"

import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Loader2,
  Megaphone,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  InstructorNotificationDetailDialog,
  type InstructorNotificationDetail,
} from "@/components/instructor/InstructorNotificationDetailDialog"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
  facultyToolbarIconButtonClass,
  facultyToolbarSelectTriggerClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import { fallbackNotificationSummary } from "@/lib/notification-ai-summary-shared"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type Notification = InstructorNotificationDetail

type NotificationVisual = {
  icon: LucideIcon
  tone: string
}

const TYPE_VISUALS: Record<string, NotificationVisual> = {
  quiz_submission: { icon: CheckCircle2, tone: "text-[var(--cc-sem-info)]" },
  student_question: { icon: MessageSquare, tone: "text-[var(--cc-accent-dark)]" },
  low_completion: { icon: TrendingUp, tone: "text-[var(--cc-sem-warning)]" },
  deadline_reminder: { icon: Clock, tone: "text-[var(--cc-sem-danger)]" },
  analytics: { icon: TrendingUp, tone: "text-[var(--cc-sem-success)]" },
  student_registration: { icon: Users, tone: "text-[var(--cc-sem-info)]" },
  lecture: { icon: BookOpen, tone: "text-[var(--cc-accent-dark)]" },
  project: { icon: FileText, tone: "text-[var(--cc-sem-warning)]" },
  group: { icon: Users, tone: "text-[var(--cc-sem-success)]" },
  exam: { icon: AlertCircle, tone: "text-[var(--cc-sem-danger)]" },
  homework: { icon: FileText, tone: "text-[var(--cc-accent-dark)]" },
  announcement: { icon: Megaphone, tone: "text-[var(--cc-accent-dark)]" },
  default: { icon: Bell, tone: "text-[var(--cc-text-muted)]" },
}

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "quiz_submission", label: "Quiz submissions" },
  { value: "student_question", label: "Student questions" },
  { value: "low_completion", label: "Low completion" },
  { value: "deadline_reminder", label: "Deadlines" },
  { value: "analytics", label: "Analytics" },
  { value: "announcement", label: "Announcements" },
  { value: "group", label: "Groups" },
  { value: "project", label: "Projects" },
] as const

function formatTypeLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function previewSummary(notif: Notification): string {
  if (notif.ai_summary?.trim()) return notif.ai_summary.trim()
  return fallbackNotificationSummary({
    title: notif.title,
    message: notif.message,
    type: notif.type,
  })
}

function getMockNotifications(): Notification[] {
  return [
    {
      id: 1,
      type: "quiz_submission",
      title: "New Quiz Submissions",
      message: "15 students have submitted Quiz 3: Control Structures",
      link: "/faculty/dashboard/analytics?section=results",
      is_read: false,
      created_at: new Date(Date.now() - 3600000).toISOString(),
      source_type: "quiz",
      source_id: "3",
    },
    {
      id: 2,
      type: "student_question",
      title: "Student Question on Lecture 5",
      message: "John Doe asked: Could you explain the difference between pointers and references?",
      link: "/faculty/dashboard/content/lectures",
      is_read: false,
      created_at: new Date(Date.now() - 7200000).toISOString(),
      source_type: "lecture",
      source_id: "5",
      source_name: "John Doe",
    },
    {
      id: 3,
      type: "deadline_reminder",
      title: "Upcoming Deadline",
      message: "Mid-semester exam is due in 2 days. 12 students haven't started yet.",
      link: "/faculty/dashboard/assessments/mid-semester",
      is_read: true,
      created_at: new Date(Date.now() - 14400000).toISOString(),
      read_at: new Date(Date.now() - 3600000).toISOString(),
      source_type: "exam",
      source_id: "1",
    },
  ]
}

export function FacultyNotificationsHub() {
  const chrome = facultyEmbedChrome("notifications")
  const spinner = facultyModuleSpinnerClass("notifications")
  const router = useRouter()
  const { toast } = useToast()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const response = await instructorApiFetch("/api/instructor/notifications?limit=100")
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
      } else {
        setNotifications(getMockNotifications())
      }
    } catch {
      setNotifications(getMockNotifications())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const instructorSession = localStorage.getItem("instructorSession")
    if (!instructorSession) {
      router.push("/faculty/login")
      return
    }
    void fetchNotifications()
  }, [router, fetchNotifications])

  const filteredNotifications = useMemo(() => {
    const q = search.trim().toLowerCase()
    return notifications.filter((notif) => {
      const matchesRead =
        readFilter === "all" ||
        (readFilter === "unread" && !notif.is_read) ||
        (readFilter === "read" && notif.is_read)
      const matchesType = typeFilter === "all" || notif.type === typeFilter
      const matchesSearch =
        !q ||
        notif.title.toLowerCase().includes(q) ||
        notif.message.toLowerCase().includes(q) ||
        previewSummary(notif).toLowerCase().includes(q)
      return matchesRead && matchesType && matchesSearch
    })
  }, [notifications, readFilter, typeFilter, search])

  const selectedNotification =
    filteredNotifications.find((n) => n.id === selectedId) ??
    notifications.find((n) => n.id === selectedId) ??
    null

  const unreadCount = notifications.filter((n) => !n.is_read).length

  useEffect(() => {
    if (filteredNotifications.length === 0) {
      setSelectedId(null)
      return
    }
    setSelectedId((prev) => {
      if (prev != null && filteredNotifications.some((n) => n.id === prev)) return prev
      return filteredNotifications[0]?.id ?? null
    })
  }, [filteredNotifications])

  const markAsRead = async (id: number) => {
    try {
      await instructorApiFetch("/api/instructor/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_id: id }),
      })
    } catch {
      /* update UI anyway */
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)),
    )
  }

  const markAllAsRead = async () => {
    try {
      await instructorApiFetch("/api/instructor/notifications/mark-all-read", { method: "POST" })
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() })),
      )
      toast({ title: "All caught up", description: "Every notification is marked read." })
    } catch {
      toast({ title: "Could not mark all read", variant: "destructive" })
    }
  }

  const deleteNotification = async (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    if (selectedId === id) setSelectedId(null)
    toast({ title: "Notification removed" })
  }

  const openDetail = async (notif: Notification) => {
    setSelectedId(notif.id)
    if (!notif.is_read) await markAsRead(notif.id)
    setDetailOpen(true)
  }

  const handleOpenRelated = (notif: Notification) => {
    setDetailOpen(false)
    if (notif.link) router.push(notif.link)
  }

  const activeFilterCount =
    (readFilter !== "all" ? 1 : 0) + (typeFilter !== "all" ? 1 : 0) + (search.trim() ? 1 : 0)

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className={cn("h-8 w-8 animate-spin", spinner)} />
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={chrome.iconBadge("md")}>
            <Bell className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className={cn("text-lg font-semibold sm:text-xl", PORTAL_TEXT)}>Notifications</h1>
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
              {unreadCount > 0
                ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"} across your course`
                : "You're caught up — new activity will appear here."}
            </p>
          </div>
        </div>
        <Link href={`${FACULTY_DASHBOARD_BASE}/communication/announcements`}>
          <Button type="button" size="sm" className={cn("h-9 gap-2 rounded-lg", chrome.cta)}>
            <Megaphone className="h-4 w-4" />
            Announcements
          </Button>
        </Link>
      </div>

      <FacultyIntegratedToolbar
        moduleId="notifications"
        search={search}
        onSearchChange={setSearch}
        onSearchClear={() => setSearch("")}
        searchPlaceholder="Search notifications…"
        filters={
          <>
            <Select value={readFilter} onValueChange={(v) => setReadFilter(v as typeof readFilter)}>
              <SelectTrigger className={facultyToolbarSelectTriggerClass(readFilter !== "all")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="read">Read</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className={cn(facultyToolbarSelectTriggerClass(typeFilter !== "all"), "w-[7.5rem] sm:w-[8.5rem]")}>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        trailing={
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={facultyToolbarIconButtonClass()}
              aria-label="Refresh notifications"
              title="Refresh"
              disabled={refreshing}
              onClick={() => void fetchNotifications(true)}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
            {unreadCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={facultyToolbarFilterButtonClass()}
                onClick={() => void markAllAsRead()}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span className="hidden sm:inline">Mark all read</span>
              </Button>
            ) : null}
          </>
        }
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {filteredNotifications.length} shown
            {unreadCount > 0 ? ` · ${unreadCount} unread` : ""}
            {activeFilterCount > 0 ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active` : ""}
          </p>
        }
      />

      {filteredNotifications.length === 0 ? (
        <div className={cn(PORTAL_CARD, "px-6 py-14 text-center")}>
          <Bell className={cn("mx-auto mb-3 h-8 w-8 opacity-40", PORTAL_TEXT_MUTED)} />
          <p className={cn("text-sm font-medium", PORTAL_TEXT)}>No notifications match</p>
          <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>
            {activeFilterCount > 0
              ? "Try clearing search or filters."
              : "New student activity and system alerts will show up here."}
          </p>
        </div>
      ) : (
        <div className="grid min-h-[28rem] grid-cols-1 gap-3 lg:grid-cols-[minmax(13rem,20rem)_minmax(0,1fr)] lg:gap-4">
          <div className={cn(PORTAL_CARD, "overflow-hidden p-1.5")}>
            <ul className="max-h-[min(560px,70vh)] space-y-0.5 overflow-y-auto">
              <AnimatePresence initial={false}>
                {filteredNotifications.map((notif) => {
                  const visual = TYPE_VISUALS[notif.type] ?? TYPE_VISUALS.default
                  const Icon = visual.icon
                  const active = notif.id === selectedId
                  return (
                    <motion.li
                      key={notif.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(notif.id)}
                        className={cn(
                          "w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                          active
                            ? "bg-[var(--sidebar-accent)] text-[var(--cc-text)]"
                            : "text-[var(--cc-text-muted)] hover:bg-[var(--sidebar-accent)]/45 hover:text-[var(--cc-text)]",
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <span
                            className={cn(
                              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--sidebar-accent)]/50",
                              visual.tone,
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="line-clamp-2 text-sm font-medium leading-snug">{notif.title}</p>
                              {!notif.is_read ? (
                                <span
                                  className="mt-1 size-2 shrink-0 rounded-full bg-[var(--cc-accent)]"
                                  aria-label="Unread"
                                />
                              ) : null}
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-xs opacity-80">{previewSummary(notif)}</p>
                            <p className="mt-1 truncate text-[11px] opacity-70">
                              {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      </button>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          </div>

          <div className={cn(PORTAL_CARD, "flex min-h-[28rem] min-w-0 flex-col overflow-hidden")}>
            {!selectedNotification ? (
              <div className="flex flex-1 items-center justify-center p-6">
                <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Select a notification</p>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-[var(--cc-accent)]/35 capitalize">
                          {formatTypeLabel(selectedNotification.type)}
                        </Badge>
                        {!selectedNotification.is_read ? (
                          <Badge className="bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)] hover:bg-[var(--cc-accent-soft)]">
                            Unread
                          </Badge>
                        ) : null}
                      </div>
                      <h2 className={cn("text-base font-semibold leading-snug sm:text-lg", PORTAL_TEXT)}>
                        {selectedNotification.title}
                      </h2>
                      {selectedNotification.source_name ? (
                        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>From {selectedNotification.source_name}</p>
                      ) : null}
                      <p className={cn("flex items-center gap-1.5 text-xs", PORTAL_TEXT_MUTED)}>
                        <Clock className="h-3.5 w-3.5" />
                        {formatDistanceToNow(new Date(selectedNotification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!selectedNotification.is_read ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={facultyToolbarIconButtonClass()}
                          aria-label="Mark read"
                          title="Mark read"
                          onClick={() => void markAsRead(selectedNotification.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(facultyToolbarIconButtonClass(), "text-red-600 dark:text-red-400")}
                        aria-label="Delete notification"
                        title="Delete"
                        onClick={() => void deleteNotification(selectedNotification.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[var(--cc-accent-soft)]/25 px-3.5 py-3 sm:px-4">
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--cc-accent-dark)]">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI summary
                    </p>
                    <p className={cn("text-sm leading-relaxed", PORTAL_TEXT)}>{previewSummary(selectedNotification)}</p>
                  </div>

                  <div className="space-y-1.5">
                    <p className={cn("text-xs font-medium uppercase tracking-wide", PORTAL_TEXT_MUTED)}>Full message</p>
                    <p className={cn("whitespace-pre-wrap text-sm leading-relaxed", PORTAL_TEXT)}>
                      {selectedNotification.message}
                    </p>
                  </div>
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)]/60 p-4 sm:p-5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={facultyToolbarFilterButtonClass()}
                    onClick={() => void openDetail(selectedNotification)}
                  >
                    Open in dialog
                  </Button>
                  {selectedNotification.link ? (
                    <Button
                      type="button"
                      size="sm"
                      className={cn("h-9 gap-2 rounded-lg", chrome.cta)}
                      onClick={() => handleOpenRelated(selectedNotification)}
                    >
                      Open related
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <InstructorNotificationDetailDialog
        notification={selectedNotification}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onOpenRelated={handleOpenRelated}
        embedInDashboard
      />
    </div>
  )
}
