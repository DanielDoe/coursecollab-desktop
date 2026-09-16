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

const notificationIcons: Record<string, { icon: any; color: string; bgColor: string }> = {
  quiz: { icon: CheckCircle2, color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  practice: { icon: Sparkles, color: "text-emerald-600", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
  ai_tutor: { icon: Sparkles, color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
  codebench: { icon: CheckCircle2, color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  deadline: { icon: Clock, color: "text-rose-600", bgColor: "bg-rose-100 dark:bg-rose-900/30" },
  group: { icon: CheckCircle2, color: "text-cyan-600", bgColor: "bg-cyan-100 dark:bg-cyan-900/30" },
  project: { icon: CheckCircle2, color: "text-indigo-600", bgColor: "bg-indigo-100 dark:bg-indigo-900/30" },
  homework: { icon: CheckCircle2, color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/30" },
  exam: { icon: CheckCircle2, color: "text-pink-600", bgColor: "bg-pink-100 dark:bg-pink-900/30" },
  lecture: { icon: CheckCircle2, color: "text-teal-600", bgColor: "bg-teal-100 dark:bg-teal-900/30" },
  forum: { icon: CheckCircle2, color: "text-violet-600", bgColor: "bg-violet-100 dark:bg-violet-900/30" },
  announcement: { icon: Bell, color: "text-rose-600", bgColor: "bg-rose-100 dark:bg-rose-900/30" },
  code_submission: { icon: CheckCircle2, color: "text-emerald-600", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
  default: { icon: Bell, color: "text-gray-600", bgColor: "bg-gray-100 dark:bg-gray-900/30" },
}

type NotificationBellProps = {
  /** Minimal circular bell + red dot — dashboard app bar reference style */
  variant?: "default" | "app-bar"
}

export function NotificationBell({ variant = "default" }: NotificationBellProps) {
  const { notifications, unreadCount, unreadAnnouncementCount, markAsRead, markAllAsRead, dismissNotification, isLoading } =
    useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const displayUnreadCount = Math.max(
    unreadCount,
    notifications.filter((n) => !n.is_read).length,
  )

  // --- Handle click outside ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  // --- Handlers ---
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

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={
          displayUnreadCount > 0
            ? `Notifications, ${displayUnreadCount} unread`
            : "Notifications"
        }
        className={cn(
          "relative overflow-visible transition-all duration-200",
          variant === "app-bar"
            ? cn(
                "size-9 rounded-xl text-[var(--cc-text-muted)] hover:bg-[var(--muted)] hover:text-[var(--cc-text)]",
                isOpen && "ring-2 ring-[var(--border)]",
              )
            : cn(
                "rounded-2xl size-10 sm:size-11 min-w-[48px] min-h-[48px]",
                "text-[var(--cc-text-secondary)] hover:text-[var(--cc-text)]",
                "hover:bg-[var(--sidebar-accent)]",
                isOpen && "bg-[var(--sidebar-accent)] text-[var(--cc-text)] ring-2 ring-[var(--cc-accent-border)]",
              ),
        )}
        style={{
          boxShadow: "none",
          outline: "none",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {variant === "app-bar" ? (
          <DrawerNavIcon name="notifications-outline" size={18} color="var(--cc-text-secondary)" />
        ) : displayUnreadCount > 0 ? (
          <BellRing className="h-5 w-5 pointer-events-none" strokeWidth={2.25} />
        ) : (
          <Bell className="h-5 w-5 pointer-events-none" strokeWidth={2} />
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
                "pointer-events-none absolute -top-0.5 -right-0.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5",
                displayUnreadCount > 9 && "min-w-[17px] px-1",
                unreadAnnouncementCount > 0 ? PORTAL_NOTIFICATION_BADGE_ALT : PORTAL_NOTIFICATION_BADGE,
                "text-[9px] font-bold tabular-nums leading-none",
              )}
            >
              {displayUnreadCount > 99 ? "99+" : displayUnreadCount}
            </span>
          ))}
      </Button>

      {/* 🎨 Modern Notification Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute right-0 mt-3 w-96 max-h-[500px] overflow-hidden rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/30 backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-gray-800/50 dark:to-gray-800/50">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                  <Bell className="h-4 w-4 text-white" />
                </div>
                <h3 className="font-bold text-lg tracking-tight text-gray-900 dark:text-gray-100">Notifications</h3>
                {unreadAnnouncementCount > 0 && (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                    {unreadAnnouncementCount} announcement{unreadAnnouncementCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline font-medium px-2 py-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* Content */}
            <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                    <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    Loading notifications...
                  </div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center">
                    <Bell className="h-8 w-8 text-gray-400" />
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">No notifications yet</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">You're all caught up!</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {notifications.map((n, index) => {
                    const iconConfig = notificationIcons[n.type] || notificationIcons.default
                    const IconComponent = iconConfig.icon
                    const isAnnouncement = n.type === "announcement"
                    
                    return (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn(
                          "relative group/item border-b border-gray-100 dark:border-gray-800 last:border-b-0",
                          !n.is_read && "bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/20 dark:to-purple-900/20 border-l-4 border-indigo-500",
                          isAnnouncement && !n.is_read && "border-l-sky-500 from-sky-50/60 to-indigo-50/40 dark:from-sky-950/30 dark:to-indigo-950/20",
                        )}
                      >
                        <Link
                          href={n.link ? resolveStudentDashboardV2Path(n.link) : "#"}
                          onClick={() => handleNotificationClick(n.id)}
                          className="block p-5 pr-12 transition-all duration-200 hover:bg-gray-50/80 dark:hover:bg-gray-800/50"
                        >
                          <div className="flex gap-4 items-start">
                            <div className={cn(
                              "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover/item:scale-110",
                              isAnnouncement ? "bg-sky-100 dark:bg-sky-900/40" : iconConfig.bgColor
                            )}>
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
                              <div className="flex justify-between items-start gap-2 mb-1">
                                <h4 className="font-semibold text-sm leading-tight text-gray-900 dark:text-gray-100 group-hover/item:text-indigo-600 dark:group-hover/item:text-indigo-400 transition-colors">
                                  {n.title}
                                </h4>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2 leading-relaxed">
                                {n.message}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
                                <Clock className="h-3 w-3" />
                                <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                                {!isAnnouncement && (
                                  <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium capitalize">
                                    {n.type.replace(/_/g, " ")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </Link>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Dismiss notification"
                          className="absolute right-2 top-2 h-8 w-8 rounded-lg text-gray-400 opacity-100 transition-opacity hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                          onClick={(e) => handleDismiss(e, n.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-gray-200/50 dark:border-gray-700/50 p-4 bg-gradient-to-t from-gray-50/80 dark:from-gray-800/80 to-transparent">
                <Link href="/student/dashboard-v2/notifications" onClick={() => setIsOpen(false)}>
                  <motion.button 
                    className="w-full text-sm py-3 rounded-xl font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50/80 dark:hover:bg-indigo-900/30 transition-all duration-200 flex items-center justify-center gap-2 group"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span>View all notifications</span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
