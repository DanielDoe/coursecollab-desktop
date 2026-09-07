"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useState, useEffect, useRef } from "react"
import { Bell, BellRing, CheckCircle2, Clock, ArrowRight, AlertCircle, TrendingUp, Users, BookOpen, FileText, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { PORTAL_NOTIFICATION_BADGE } from "@/lib/appearance/portal-nav-classes"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import {
  deliverNewDesktopNotifications,
  setDesktopBadgeCount,
  shouldKeepNotificationPollingWhenHidden,
} from "@/lib/desktop-notifications"
import { getNotificationPollIntervalMs } from "@/lib/desktop-notification-poll"
import { motion, AnimatePresence } from "framer-motion"

interface InstructorNotification {
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
}

const notificationIcons: Record<string, { icon: any; color: string; bgColor: string }> = {
  quiz_submission: { icon: CheckCircle2, color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  student_question: { icon: MessageSquare, color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
  low_completion: { icon: TrendingUp, color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  deadline_reminder: { icon: Clock, color: "text-rose-600", bgColor: "bg-rose-100 dark:bg-rose-900/30" },
  analytics: { icon: TrendingUp, color: "text-emerald-600", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
  student_registration: { icon: Users, color: "text-cyan-600", bgColor: "bg-cyan-100 dark:bg-cyan-900/30" },
  lecture: { icon: BookOpen, color: "text-indigo-600", bgColor: "bg-indigo-100 dark:bg-indigo-900/30" },
  project: { icon: FileText, color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/30" },
  group: { icon: Users, color: "text-teal-600", bgColor: "bg-teal-100 dark:bg-teal-900/30" },
  exam: { icon: AlertCircle, color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30" },
  homework: { icon: FileText, color: "text-violet-600", bgColor: "bg-violet-100 dark:bg-violet-900/30" },
  default: { icon: Bell, color: "text-gray-600", bgColor: "bg-gray-100 dark:bg-gray-900/30" },
}

export function InstructorNotificationBell({ variant = "default" }: { variant?: "default" | "app-bar" }) {
  const [notifications, setNotifications] = useState<InstructorNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const knownNotificationIds = useRef<Set<number>>(new Set())
  const notificationsInitialized = useRef(false)

  const applyNotificationPayload = (data: {
    notifications?: InstructorNotification[]
    unread_count?: number
  }) => {
    const list = data.notifications || []
    setNotifications(list)
    const apiUnread = Number(data.unread_count ?? 0)
    const derivedUnread = list.filter((n) => !n.is_read).length
    const nextUnread = Math.max(apiUnread, derivedUnread)
    setUnreadCount(nextUnread)

    if (notificationsInitialized.current) {
      void deliverNewDesktopNotifications(knownNotificationIds.current, list, {
        initialized: true,
        portal: "faculty",
      }).then((nextIds) => {
        knownNotificationIds.current = nextIds
      })
    } else {
      notificationsInitialized.current = true
      knownNotificationIds.current = new Set(list.map((n) => n.id))
    }

    void setDesktopBadgeCount(nextUnread)
  }

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/notifications?limit=50", {
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })
      if (response.ok) {
        const data = await response.json()
        applyNotificationPayload(data)
      } else if (response.status === 429) {
        // Rate limited - silently skip this fetch
        console.log("[Instructor Notifications] Rate limited, will retry on next interval")
      } else {
        console.warn("[Instructor Notifications] Failed to fetch:", response.status, response.statusText)
        // Don't clear existing notifications on transient errors
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'TimeoutError') {
          console.warn("[Instructor Notifications] Request timed out")
        } else if (error.name === 'AbortError') {
          console.warn("[Instructor Notifications] Request aborted")
        } else {
          console.warn("[Instructor Notifications] Fetch error:", error.message)
        }
      }
      // Don't clear existing notifications on fetch errors
    } finally {
      setIsLoading(false)
    }
  }

  // Desktop background-sync registration lives in InstructorNotificationProvider
  // (lib/instructor-notification-context.tsx). Registering it here tied it to the
  // lifetime of this bell, so any faculty page without the header or topbar tore
  // background sync down on unmount.

  useEffect(() => {
    fetchNotifications()
    
    // Set up polling with visibility awareness
    let interval: NodeJS.Timeout | null = null

    const pollMs = getNotificationPollIntervalMs()

    const startPolling = () => {
      if (interval) clearInterval(interval)
      interval = setInterval(() => {
        fetchNotifications()
      }, pollMs)
    }

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }

    // Handle visibility change - pause polling when tab is hidden
    const handleVisibilityChange = () => {
      if (document.hidden && !shouldKeepNotificationPollingWhenHidden()) {
        stopPolling()
      } else if (!document.hidden) {
        fetchNotifications()
        startPolling()
      }
    }

    startPolling()

    const handleWindowFocus = () => {
      if (shouldKeepNotificationPollingWhenHidden()) {
        fetchNotifications()
      }
    }

    if (!shouldKeepNotificationPollingWhenHidden()) {
      document.addEventListener("visibilitychange", handleVisibilityChange)
    } else {
      window.addEventListener("focus", handleWindowFocus)
    }

    return () => {
      stopPolling()
      if (!shouldKeepNotificationPollingWhenHidden()) {
        document.removeEventListener("visibilitychange", handleVisibilityChange)
      } else {
        window.removeEventListener("focus", handleWindowFocus)
      }
    }
  }, [])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const markAsRead = async (id: number) => {
    try {
      await instructorApiFetch("/api/instructor/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_id: id }),
      })

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error("Failed to mark notification as read:", error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await instructorApiFetch("/api/instructor/notifications/mark-all-read", {
        method: "POST",
      })

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      )
      setUnreadCount(0)
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error)
    }
  }

  const handleNotificationClick = (id: number) => {
    markAsRead(id)
    setIsOpen(false)
  }

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
        }
        className={cn(
          "relative overflow-visible transition-all duration-300",
          variant === "app-bar"
            ? cn(
                "size-9 rounded-xl text-[var(--cc-text-muted)] hover:bg-[var(--muted)] hover:text-[var(--cc-text)]",
                isOpen && "ring-2 ring-[var(--border)]",
              )
            : cn(
                "rounded-xl sm:rounded-2xl size-9 sm:size-10 md:size-11 min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] md:min-w-[44px] md:min-h-[44px]",
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
        {unreadCount > 0 ? (
          <BellRing className="h-5 w-5 pointer-events-none" strokeWidth={2.25} />
        ) : (
          <Bell className="h-5 w-5 pointer-events-none" strokeWidth={2} />
        )}

        {unreadCount > 0 && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute -top-0.5 -right-0.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5",
              unreadCount > 9 && "min-w-[17px] px-1",
              PORTAL_NOTIFICATION_BADGE,
              "text-[9px] font-bold tabular-nums leading-none",
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {/* Notification Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute right-0 mt-3 w-96 max-h-[500px] overflow-hidden rounded-2xl shadow-2xl border border-[var(--border)] backdrop-blur-xl bg-[var(--popover)]/95 z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)] bg-[var(--cc-accent-soft)]/40">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-[var(--cc-accent-soft)] flex items-center justify-center">
                  <Bell className="h-4 w-4 text-[var(--cc-accent-dark)]" />
                </div>
                <h3 className="font-bold text-lg tracking-tight text-[var(--cc-text)]">Notifications</h3>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-[var(--cc-accent-dark)] hover:underline font-medium px-2 py-1 rounded-md hover:bg-[var(--cc-accent-soft)] transition-all"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* Content */}
            <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="inline-flex items-center gap-2 text-[var(--cc-text-muted)] text-sm">
                    <div className="h-4 w-4 border-2 border-[var(--cc-accent)] border-t-transparent rounded-full animate-spin" />
                    Loading notifications...
                  </div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="h-16 w-16 rounded-full bg-[var(--muted)] flex items-center justify-center mb-4">
                    <Bell className="h-8 w-8 text-[var(--cc-text-muted)]" />
                  </div>
                  <h4 className="font-semibold text-[var(--cc-text)] mb-2">All caught up!</h4>
                  <p className="text-sm text-[var(--cc-text-muted)]">
                    You have no new notifications at the moment.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {notifications.map((n, index) => {
                    const iconConfig = notificationIcons[n.type] || notificationIcons.default
                    const IconComponent = iconConfig.icon
                    
                    return (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Link
                          href={n.link || "#"}
                          onClick={() => handleNotificationClick(n.id)}
                          className={cn(
                            "block p-5 transition-all duration-200 hover:bg-[var(--sidebar-accent)] group",
                            "hover:translate-x-1",
                            !n.is_read && "bg-[var(--cc-accent-soft)]/50 border-l-4 border-[var(--cc-accent)]"
                          )}
                        >
                          <div className="flex gap-4 items-start">
                            <div className={cn("p-2 rounded-lg flex-shrink-0", iconConfig.bgColor)}>
                              <IconComponent className={cn("h-5 w-5", iconConfig.color)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h4 className="font-semibold text-sm text-[var(--cc-text)] line-clamp-1">
                                  {n.title}
                                </h4>
                                {!n.is_read && (
                                  <div className="h-2 w-2 rounded-full bg-[var(--cc-accent)] flex-shrink-0 mt-1" />
                                )}
                              </div>
                              <p className="text-sm text-[var(--cc-text-secondary)] line-clamp-2 mb-2">
                                {n.message}
                              </p>
                              {n.source_name && (
                                <p className="text-xs text-[var(--cc-text-muted)] mb-2">
                                  From: {n.source_name}
                                </p>
                              )}
                              <div className="flex items-center justify-between text-xs text-[var(--cc-text-muted)]">
                                <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                                {n.link && (
                                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                )}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--border)] bg-[var(--muted)]/50">
              <Link
                href={`${FACULTY_DASHBOARD_BASE}/communication/notifications`}
                onClick={() => setIsOpen(false)}
                className="block text-center py-3 text-sm font-medium text-[var(--cc-accent-dark)] hover:bg-[var(--cc-accent-soft)]/50 transition-colors"
              >
                View all notifications
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
