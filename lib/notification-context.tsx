"use client"


import { studentApiFetch } from "@/lib/auth"
import type React from "react"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import { toast } from "@/hooks/use-toast"
import { emitModuleRefresh, notificationTypeToModules } from "@/lib/notification-module-refresh"
import {
  buildDesktopNotificationSyncContext,
  deliverNewDesktopNotifications,
  registerDesktopNotificationSync,
  setDesktopBadgeCount,
  shouldKeepNotificationPollingWhenHidden,
} from "@/lib/desktop-notifications"
import { getNotificationPollIntervalMs } from "@/lib/desktop-notification-poll"

interface Notification {
  id: number
  type: string
  title: string
  message: string
  link: string | null
  is_read: boolean
  created_at: string
  read_at: string | null
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  unreadAnnouncementCount: number
  isLoading: boolean
  markAsRead: (id: number) => Promise<void>
  markAllAsRead: () => Promise<void>
  dismissNotification: (id: number) => Promise<void>
  refreshNotifications: () => Promise<void>
  showToast: (notification: Omit<Notification, "id" | "is_read" | "created_at" | "read_at">) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({
  children,
  studentId,
}: {
  children: React.ReactNode
  studentId: string | null
}) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const knownNotificationIds = useRef<Set<number>>(new Set())
  const notificationsInitialized = useRef(false)

  const unreadAnnouncementCount = notifications.filter(
    (n) => n.type === "announcement" && !n.is_read,
  ).length

  const applyNotificationPayload = (data: {
    notifications?: Notification[]
    unread_count?: number
  }) => {
    const list = data.notifications || []
    setNotifications(list)
    const apiUnread = Number(data.unread_count ?? 0)
    const derivedUnread = list.filter((n) => !n.is_read).length
    setUnreadCount(Math.max(apiUnread, derivedUnread))

    if (notificationsInitialized.current) {
      for (const n of list) {
        if (!knownNotificationIds.current.has(n.id)) {
          emitModuleRefresh(notificationTypeToModules(n.type, n.link))
        }
      }
      void deliverNewDesktopNotifications(knownNotificationIds.current, list, {
        initialized: true,
        portal: "student",
      }).then((nextIds) => {
        knownNotificationIds.current = nextIds
      })
    } else {
      notificationsInitialized.current = true
      knownNotificationIds.current = new Set(list.map((n) => n.id))
    }

    void setDesktopBadgeCount(Math.max(apiUnread, derivedUnread))
  }

  const fetchNotifications = async (retryCount = 0) => {
    if (!studentId) {
      setIsLoading(false)
      return
    }

    try {
      const response = await studentApiFetch("/api/student/notifications?limit=50", {
        headers: {
          "x-student-id": studentId,
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      if (response.ok) {
        const data = await response.json()
        if (data.throttled) {
          if (retryCount < 2) {
            setTimeout(() => {
              void fetchNotifications(retryCount + 1)
            }, 1500)
          }
          return
        }
        applyNotificationPayload(data)
      } else if (response.status === 404) {
        console.warn("[Notifications] Student not found for bell feed")
      } else if (response.status === 429) {
        if (retryCount < 2) {
          setTimeout(() => {
            void fetchNotifications(retryCount + 1)
          }, 1500)
        }
      } else {
        console.warn("[Notifications] Failed to fetch:", response.status, response.statusText)
        // Don't clear existing notifications on transient errors
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'TimeoutError') {
          console.warn("[Notifications] Request timed out")
        } else if (error.name === 'AbortError') {
          console.warn("[Notifications] Request aborted")
        } else {
          console.warn("[Notifications] Fetch error:", error.message)
        }
      }
      // Don't clear existing notifications on fetch errors
    } finally {
      setIsLoading(false)
    }
  }

  const markAsRead = async (id: number) => {
    if (!studentId) return

    try {
      const response = await studentApiFetch("/api/student/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-student-id": studentId,
        },
        body: JSON.stringify({ notification_id: id }),
      })

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)),
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch (error) {
      // Silent fail
    }
  }

  const markAllAsRead = async () => {
    if (!studentId) return

    try {
      const response = await studentApiFetch("/api/student/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-student-id": studentId,
        },
        body: JSON.stringify({ mark_all_read: true }),
      })

      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() })))
        setUnreadCount(0)
      }
    } catch (error) {
      // Silent fail
    }
  }

  const dismissNotification = async (id: number) => {
    if (!studentId) return

    const target = notifications.find((n) => n.id === id)
    if (!target) return

    try {
      const response = await studentApiFetch("/api/student/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-student-id": studentId,
        },
        body: JSON.stringify({ notification_id: id, dismiss: true }),
      })

      if (response.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id))
        if (!target.is_read) {
          setUnreadCount((prev) => Math.max(0, prev - 1))
        }
      }
    } catch {
      // Silent fail
    }
  }

  const showToast = (notification: Omit<Notification, "id" | "is_read" | "created_at" | "read_at">) => {
    toast({
      title: notification.title,
      description: notification.message,
      duration: 6000,
    })
  }

  useEffect(() => {
    if (!studentId) {
      void registerDesktopNotificationSync(null)
      return
    }

    void registerDesktopNotificationSync(
      buildDesktopNotificationSyncContext("student", "/api/student/notifications?limit=50", {
        "x-student-id": studentId,
      }),
    )

    return () => {
      void registerDesktopNotificationSync(null)
    }
  }, [studentId])

  useEffect(() => {
    fetchNotifications()

    if (!studentId) return

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
        // Fetch immediately when tab becomes visible, then resume polling
        fetchNotifications()
        startPolling()
      }
    }

    // Start initial polling
    startPolling()

    const handleWindowFocus = () => {
      if (shouldKeepNotificationPollingWhenHidden()) {
        fetchNotifications()
      }
    }

    // Pause polling when backgrounded in browser; keep polling in desktop shell for OS alerts.
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
  }, [studentId])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        unreadAnnouncementCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        dismissNotification,
        refreshNotifications: fetchNotifications,
        showToast,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider")
  }
  return context
}
