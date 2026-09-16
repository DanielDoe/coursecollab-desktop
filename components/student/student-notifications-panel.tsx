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
  quiz: { icon: CheckCheck, color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  practice: { icon: Sparkles, color: "text-emerald-600", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
  ai_tutor: { icon: Sparkles, color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
  codebench: { icon: CheckCheck, color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  deadline: { icon: Clock, color: "text-rose-600", bgColor: "bg-rose-100 dark:bg-rose-900/30" },
  group: { icon: CheckCheck, color: "text-cyan-600", bgColor: "bg-cyan-100 dark:bg-cyan-900/30" },
  project: { icon: CheckCheck, color: "text-indigo-600", bgColor: "bg-indigo-100 dark:bg-indigo-900/30" },
  homework: { icon: CheckCheck, color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/30" },
  exam: { icon: CheckCheck, color: "text-pink-600", bgColor: "bg-pink-100 dark:bg-pink-900/30" },
  lecture: { icon: CheckCheck, color: "text-teal-600", bgColor: "bg-teal-100 dark:bg-teal-900/30" },
  forum: { icon: CheckCheck, color: "text-violet-600", bgColor: "bg-violet-100 dark:bg-violet-900/30" },
  announcement: { icon: Bell, color: "text-rose-600", bgColor: "bg-rose-100 dark:bg-rose-900/30" },
  default: { icon: Bell, color: "text-gray-600", bgColor: "bg-gray-100 dark:bg-gray-900/30" },
}

export function StudentNotificationsPanel() {
  const router = useRouter()
  const { notifications, unreadCount, unreadAnnouncementCount, markAsRead, markAllAsRead, dismissNotification, isLoading } =
    useNotifications()
  const [filter, setFilter] = useState<"all" | "unread">("all")

  const filteredNotifications = filter === "unread" ? notifications.filter((n) => !n.is_read) : notifications

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dashboard-v2-fg tracking-tight">Notifications</h1>
          <p className="text-dashboard-v2-muted mt-1">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}${
                  unreadAnnouncementCount > 0
                    ? ` · ${unreadAnnouncementCount} announcement${unreadAnnouncementCount > 1 ? "s" : ""}`
                    : ""
                }`
              : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={markAllAsRead} className="rounded-xl shrink-0">
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        )}
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "unread")}>
        <TabsList className="rounded-xl bg-dashboard-v2-card border border-dashboard-v2-border p-1">
          <TabsTrigger value="all" className="rounded-lg px-6">
            All
          </TabsTrigger>
          <TabsTrigger value="unread" className="rounded-lg px-6">
            Unread {unreadCount > 0 && `(${unreadCount})`}
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
            className="text-center py-16 text-dashboard-v2-muted"
          >
            <div className="inline-flex items-center gap-3">
              <div className="h-6 w-6 border-2 border-[var(--cc-accent)] border-t-transparent rounded-full animate-spin" />
              <span>Loading notifications...</span>
            </div>
          </motion.div>
        ) : filteredNotifications.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card className="p-12 text-center border-dashed border-2 border-dashboard-v2-border bg-dashboard-v2-card rounded-2xl">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Bell className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-dashboard-v2-fg mb-2">No notifications</h3>
              <p className="text-dashboard-v2-muted">
                {filter === "unread" ? "You're all caught up!" : "You don't have any notifications yet."}
              </p>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="notifications" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {filteredNotifications.map((n, index) => {
              const iconConfig = notificationIcons[n.type] || notificationIcons.default
              const IconComponent = iconConfig.icon
              const isAnnouncement = n.type === "announcement"

              const handleDismiss = (e: MouseEvent) => {
                e.stopPropagation()
                void dismissNotification(n.id)
              }

              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card
                    className={cn(
                      "relative p-5 rounded-2xl border border-dashboard-v2-border hover:shadow-md transition-all cursor-pointer group/card",
                      !n.is_read && "bg-[var(--cc-accent-soft)] border-[var(--cc-accent-soft-strong)]",
                      isAnnouncement && !n.is_read && "bg-sky-500/5 border-sky-500/25",
                    )}
                    onClick={() => {
                      markAsRead(n.id)
                      if (n.link) router.push(resolveStudentDashboardV2Path(n.link))
                    }}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Dismiss notification"
                      className="absolute right-3 top-3 h-8 w-8 rounded-lg text-dashboard-v2-muted opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={handleDismiss}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <div className="flex gap-4 items-start pr-8">
                      <div
                        className={cn(
                          "h-11 w-11 rounded-xl flex items-center justify-center shrink-0",
                          isAnnouncement ? "bg-sky-100 dark:bg-sky-900/40" : iconConfig.bgColor,
                        )}
                      >
                        {isAnnouncement ? (
                          <Megaphone className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                        ) : (
                          <IconComponent className={cn("h-5 w-5", iconConfig.color)} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          {isAnnouncement && (
                            <span className="inline-flex items-center rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              Announcement
                            </span>
                          )}
                          {!n.is_read && (
                            <span className="inline-flex items-center rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              New
                            </span>
                          )}
                        </div>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-semibold text-dashboard-v2-fg">{n.title}</h3>
                        </div>
                        <p className="text-sm text-dashboard-v2-muted mb-2">{n.message}</p>
                        <div className="flex items-center gap-3 text-xs text-dashboard-v2-muted">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </span>
                          {n.link && (
                            <span className="text-[var(--cc-accent-dark)] font-medium flex items-center gap-1">
                              View details
                              <ArrowRight className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
