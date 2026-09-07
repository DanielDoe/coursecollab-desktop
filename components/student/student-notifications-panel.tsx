"use client"

import { useState, type MouseEvent } from "react"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck, Sparkles, Clock, ArrowRight, Megaphone, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useNotifications } from "@/lib/notification-context"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { motion, AnimatePresence } from "framer-motion"
import { resolveStudentDashboardV2Path } from "@/lib/student-v2-routes"

const notificationIcons: Record<string, { icon: typeof Bell; color: string; bgColor: string }> = {
  quiz: { icon: CheckCheck, color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/40" },
  practice: { icon: Sparkles, color: "text-emerald-600", bgColor: "bg-emerald-50 dark:bg-emerald-950/40" },
  ai_tutor: { icon: Sparkles, color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950/40" },
  codebench: { icon: CheckCheck, color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-950/40" },
  deadline: { icon: Clock, color: "text-rose-600", bgColor: "bg-rose-50 dark:bg-rose-950/40" },
  group: { icon: CheckCheck, color: "text-cyan-600", bgColor: "bg-cyan-50 dark:bg-cyan-950/40" },
  project: { icon: CheckCheck, color: "text-indigo-600", bgColor: "bg-indigo-50 dark:bg-indigo-950/40" },
  homework: { icon: CheckCheck, color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-950/40" },
  exam: { icon: CheckCheck, color: "text-pink-600", bgColor: "bg-pink-50 dark:bg-pink-950/40" },
  lecture: { icon: CheckCheck, color: "text-teal-600", bgColor: "bg-teal-50 dark:bg-teal-950/40" },
  forum: { icon: CheckCheck, color: "text-violet-600", bgColor: "bg-violet-50 dark:bg-violet-950/40" },
  announcement: { icon: Megaphone, color: "text-sky-700 dark:text-sky-300", bgColor: "bg-sky-50 dark:bg-sky-950/40" },
  default: { icon: Bell, color: "text-[var(--cc-text-secondary)]", bgColor: "bg-[var(--muted)]" },
}

function formatTypeLabel(type: string) {
  return type.replace(/_/g, " ")
}

export function StudentNotificationsPanel() {
  const router = useRouter()
  const { notifications, unreadCount, unreadAnnouncementCount, markAsRead, markAllAsRead, dismissNotification, isLoading } =
    useNotifications()
  const [filter, setFilter] = useState<"all" | "unread">("all")

  const filteredNotifications = filter === "unread" ? notifications.filter((n) => !n.is_read) : notifications

  const statusLine =
    unreadCount > 0
      ? [
          `${unreadCount} unread`,
          unreadAnnouncementCount > 0
            ? `${unreadAnnouncementCount} announcement${unreadAnnouncementCount > 1 ? "s" : ""}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "All caught up"

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-dashboard-v2-fg">Notifications</h1>
          <p className="mt-1 text-[13px] text-dashboard-v2-muted">{statusLine}</p>
        </div>
        {unreadCount > 0 ? (
          <Button onClick={markAllAsRead} variant="outline" className="shrink-0 rounded-lg">
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        ) : null}
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "unread")}>
        <TabsList className="rounded-lg border border-dashboard-v2-border bg-dashboard-v2-card p-1">
          <TabsTrigger value="all" className="rounded-md px-5 text-[13px]">
            All
          </TabsTrigger>
          <TabsTrigger value="unread" className="rounded-md px-5 text-[13px]">
            Unread {unreadCount > 0 ? `(${unreadCount})` : ""}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-16 text-center text-[13px] text-dashboard-v2-muted"
          >
            <div className="inline-flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--cc-accent)] border-t-transparent" />
              Loading notifications…
            </div>
          </motion.div>
        ) : filteredNotifications.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="rounded-xl border border-dashed border-dashboard-v2-border bg-dashboard-v2-card p-10 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--muted)]">
                <Bell className="h-5 w-5 text-dashboard-v2-muted" />
              </div>
              <h3 className="text-[15px] font-semibold text-dashboard-v2-fg">No notifications</h3>
              <p className="mt-1 text-[13px] text-dashboard-v2-muted">
                {filter === "unread" ? "You're all caught up." : "You don't have any notifications yet."}
              </p>
            </Card>
          </motion.div>
        ) : (
          <motion.ul
            key="notifications"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="divide-y divide-dashboard-v2-border overflow-hidden rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card"
          >
            {filteredNotifications.map((n, index) => {
              const iconConfig = notificationIcons[n.type] || notificationIcons.default
              const IconComponent = iconConfig.icon
              const isAnnouncement = n.type === "announcement"

              const handleDismiss = (e: MouseEvent) => {
                e.stopPropagation()
                void dismissNotification(n.id)
              }

              return (
                <motion.li
                  key={n.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="group/item relative"
                >
                  <button
                    type="button"
                    className={cn(
                      "flex w-full gap-3 px-4 py-4 pr-12 text-left transition-colors hover:bg-[var(--muted)]/50",
                      !n.is_read && "bg-[color-mix(in_srgb,var(--cc-accent-soft)_45%,transparent)]",
                    )}
                    onClick={() => {
                      markAsRead(n.id)
                      if (n.link) router.push(resolveStudentDashboardV2Path(n.link))
                    }}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        iconConfig.bgColor,
                      )}
                    >
                      <IconComponent className={cn("h-4 w-4", iconConfig.color)} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <p className="line-clamp-2 flex-1 text-[14px] font-semibold leading-snug text-dashboard-v2-fg">
                          {n.title}
                        </p>
                        {!n.is_read ? (
                          <span
                            aria-hidden
                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--cc-accent)]"
                          />
                        ) : null}
                      </div>

                      {n.message ? (
                        <p className="mt-1.5 text-[13px] leading-relaxed text-dashboard-v2-muted">{n.message}</p>
                      ) : null}

                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-dashboard-v2-muted">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0" />
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </span>
                        <span aria-hidden>·</span>
                        <span className="capitalize">
                          {isAnnouncement ? "Announcement" : formatTypeLabel(n.type)}
                        </span>
                        {n.link ? (
                          <>
                            <span aria-hidden>·</span>
                            <span className="inline-flex items-center gap-1 font-medium text-[var(--cc-accent-dark)]">
                              View details
                              <ArrowRight className="h-3 w-3" />
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Dismiss notification"
                    className="absolute right-2 top-3 h-7 w-7 rounded-md text-dashboard-v2-muted opacity-0 transition-opacity hover:bg-[var(--muted)] group-hover/item:opacity-100 focus-visible:opacity-100"
                    onClick={handleDismiss}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </motion.li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
