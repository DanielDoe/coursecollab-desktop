"use client"

import { useState, useEffect, useRef, type MouseEvent } from "react"
import { Bell, BellRing, CheckCircle2, Clock, ArrowRight, Sparkles, X, Megaphone } from "lucide-react"
import { DrawerNavIcon } from "@/components/student/dashboard-v2/DrawerNavIcon"
import { Button } from "@/components/ui/button"
import { useNotifications } from "@/lib/notification-context"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { PORTAL_NOTIFICATION_BADGE, PORTAL_NOTIFICATION_BADGE_ALT } from "@/lib/appearance/portal-nav-classes"
import { resolveStudentDashboardV2Path } from "@/lib/student-v2-routes"
import { motion, AnimatePresence } from "@/components/student/dashboard-v2/light-motion"

const notificationIcons: Record<string, { icon: typeof Bell; color: string; bgColor: string }> = {
  quiz: { icon: CheckCircle2, color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/40" },
  practice: { icon: Sparkles, color: "text-emerald-600", bgColor: "bg-emerald-50 dark:bg-emerald-950/40" },
  ai_tutor: { icon: Sparkles, color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950/40" },
  codebench: { icon: CheckCircle2, color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-950/40" },
  deadline: { icon: Clock, color: "text-rose-600", bgColor: "bg-rose-50 dark:bg-rose-950/40" },
  group: { icon: CheckCircle2, color: "text-cyan-600", bgColor: "bg-cyan-50 dark:bg-cyan-950/40" },
  project: { icon: CheckCircle2, color: "text-indigo-600", bgColor: "bg-indigo-50 dark:bg-indigo-950/40" },
  homework: { icon: CheckCircle2, color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-950/40" },
  exam: { icon: CheckCircle2, color: "text-pink-600", bgColor: "bg-pink-50 dark:bg-pink-950/40" },
  lecture: { icon: CheckCircle2, color: "text-teal-600", bgColor: "bg-teal-50 dark:bg-teal-950/40" },
  forum: { icon: CheckCircle2, color: "text-violet-600", bgColor: "bg-violet-50 dark:bg-violet-950/40" },
  announcement: { icon: Megaphone, color: "text-sky-700 dark:text-sky-300", bgColor: "bg-sky-50 dark:bg-sky-950/40" },
  code_submission: { icon: CheckCircle2, color: "text-emerald-600", bgColor: "bg-emerald-50 dark:bg-emerald-950/40" },
  default: { icon: Bell, color: "text-[var(--cc-text-secondary)]", bgColor: "bg-[var(--muted)]" },
}

function formatTypeLabel(type: string) {
  return type.replace(/_/g, " ")
}

type NotificationBellProps = {
  variant?: "default" | "app-bar"
}

export function NotificationBell({ variant = "default" }: NotificationBellProps) {
  const { notifications, unreadCount, unreadAnnouncementCount, markAsRead, markAllAsRead, dismissNotification, isLoading } =
    useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const displayUnreadCount = Math.max(unreadCount, notifications.filter((n) => !n.is_read).length)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const handleMarkAllAsRead = () => markAllAsRead()
  const handleNotificationClick = (id: number) => {
    markAsRead(id)
    setIsOpen(false)
  }

  const handleDismiss = (e: MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    void dismissNotification(id)
  }

  const statusLine =
    displayUnreadCount > 0
      ? [
          `${displayUnreadCount} unread`,
          unreadAnnouncementCount > 0
            ? `${unreadAnnouncementCount} announcement${unreadAnnouncementCount > 1 ? "s" : ""}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "You're all caught up"

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={
          displayUnreadCount > 0 ? `Notifications, ${displayUnreadCount} unread` : "Notifications"
        }
        className={cn(
          "relative overflow-visible transition-colors duration-200",
          variant === "app-bar"
            ? cn(
                "size-9 rounded-xl text-[var(--cc-text-muted)] hover:bg-[var(--muted)] hover:text-[var(--cc-text)]",
                isOpen && "bg-[var(--muted)] text-[var(--cc-text)]",
              )
            : cn(
                "size-10 min-h-[48px] min-w-[48px] rounded-2xl sm:size-11",
                "text-[var(--cc-text-secondary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--cc-text)]",
                isOpen && "bg-[var(--sidebar-accent)] text-[var(--cc-text)]",
              ),
        )}
        style={{ boxShadow: "none", outline: "none", WebkitTapHighlightColor: "transparent" }}
      >
        {variant === "app-bar" ? (
          <DrawerNavIcon name="notifications-outline" size={18} color="var(--cc-text-secondary)" />
        ) : displayUnreadCount > 0 ? (
          <BellRing className="pointer-events-none h-5 w-5" strokeWidth={2.25} />
        ) : (
          <Bell className="pointer-events-none h-5 w-5" strokeWidth={2} />
        )}

        {displayUnreadCount > 0 &&
          (variant === "app-bar" ? (
            <span
              aria-hidden
              className="pointer-events-none absolute right-2 top-2 z-10 size-2 rounded-full bg-red-500 ring-2 ring-[var(--card)]"
            />
          ) : (
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute -right-0.5 -top-0.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5",
                displayUnreadCount > 9 && "min-w-[17px] px-1",
                unreadAnnouncementCount > 0 ? PORTAL_NOTIFICATION_BADGE_ALT : PORTAL_NOTIFICATION_BADGE,
                "text-[9px] font-bold tabular-nums leading-none",
              )}
            >
              {displayUnreadCount > 99 ? "99+" : displayUnreadCount}
            </span>
          ))}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--popover)] shadow-lg"
          >
            <div className="border-b border-[var(--border)] px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold tracking-tight text-[var(--cc-text)]">
                    Notifications
                  </h3>
                  <p className="mt-0.5 text-[12px] text-[var(--cc-text-muted)]">{statusLine}</p>
                </div>
                {displayUnreadCount > 0 ? (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    className="shrink-0 text-[12px] font-medium text-[var(--cc-accent-dark)] transition-colors hover:text-[var(--cc-accent)]"
                  >
                    Mark all read
                  </button>
                ) : null}
              </div>
            </div>

            <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-[13px] text-[var(--cc-text-muted)]">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--cc-accent)] border-t-transparent" />
                  Loading…
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--muted)]">
                    <Bell className="h-5 w-5 text-[var(--cc-text-muted)]" />
                  </div>
                  <p className="text-[14px] font-medium text-[var(--cc-text)]">No notifications</p>
                  <p className="mt-1 text-[12px] text-[var(--cc-text-muted)]">You're all caught up.</p>
                </div>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {notifications.map((n) => {
                    const iconConfig = notificationIcons[n.type] || notificationIcons.default
                    const IconComponent = iconConfig.icon
                    const isAnnouncement = n.type === "announcement"

                    return (
                      <li key={n.id} className="group/item relative">
                        <Link
                          href={n.link ? resolveStudentDashboardV2Path(n.link) : "#"}
                          onClick={() => handleNotificationClick(n.id)}
                          className={cn(
                            "flex gap-3 px-4 py-3.5 pr-10 transition-colors hover:bg-[var(--muted)]/60",
                            !n.is_read && "bg-[color-mix(in_srgb,var(--cc-accent-soft)_45%,transparent)]",
                          )}
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
                              <p className="line-clamp-2 flex-1 text-[13px] font-semibold leading-snug text-[var(--cc-text)]">
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
                              <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[var(--cc-text-secondary)]">
                                {n.message}
                              </p>
                            ) : null}

                            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--cc-text-muted)]">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3 shrink-0" />
                                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                              </span>
                              <span aria-hidden className="text-[var(--border)]">
                                ·
                              </span>
                              <span className="capitalize">
                                {isAnnouncement ? "Announcement" : formatTypeLabel(n.type)}
                              </span>
                            </div>
                          </div>
                        </Link>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Dismiss notification"
                          className="absolute right-1.5 top-2.5 h-7 w-7 rounded-md text-[var(--cc-text-muted)] opacity-0 transition-opacity hover:bg-[var(--muted)] hover:text-[var(--cc-text)] group-hover/item:opacity-100 focus-visible:opacity-100"
                          onClick={(e) => handleDismiss(e, n.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {notifications.length > 0 ? (
              <div className="border-t border-[var(--border)] px-4 py-2.5">
                <Link
                  href="/student/dashboard-v2/notifications"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium text-[var(--cc-accent-dark)] transition-colors hover:bg-[var(--cc-accent-soft)]/60"
                >
                  View all notifications
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
