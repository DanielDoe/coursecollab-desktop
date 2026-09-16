"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { toast } from "@/hooks/use-toast"

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

interface AdminNotificationContextType {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  markAsRead: (id: number) => Promise<void>
  markAllAsRead: () => Promise<void>
  refreshNotifications: () => Promise<void>
  showToast: (notification: Omit<Notification, "id" | "is_read" | "created_at" | "read_at">) => void
}

const AdminNotificationContext = createContext<AdminNotificationContextType | undefined>(undefined)

export function AdminNotificationProvider({
  children,
  adminId,
}: {
  children: React.ReactNode
  adminId: string | null
}) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchNotifications = async () => {
    if (!adminId) {
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/admin/notifications?limit=20", {
        headers: {
          "x-admin-id": adminId,
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unread_count || 0)
      } else if (response.status === 429) {
        // Rate limited - silently skip this fetch
        console.log("[Admin Notifications] Rate limited, will retry on next interval")
      } else {
        console.warn("[Admin Notifications] Failed to fetch:", response.status, response.statusText)
        // Don't clear existing notifications on transient errors
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'TimeoutError') {
          console.warn("[Admin Notifications] Request timed out")
        } else if (error.name === 'AbortError') {
          console.warn("[Admin Notifications] Request aborted")
        } else {
          console.warn("[Admin Notifications] Fetch error:", error.message)
        }
      }
      // Don't clear existing notifications on fetch errors
    } finally {
      setIsLoading(false)
    }
  }

  const markAsRead = async (id: number) => {
    if (!adminId) return

    try {
      const response = await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-id": adminId,
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
      console.error("[v0] Failed to mark admin notification as read:", error)
    }
  }

  const markAllAsRead = async () => {
    if (!adminId) return

    try {
      const response = await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-id": adminId,
        },
        body: JSON.stringify({ mark_all_read: true }),
      })

      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() })))
        setUnreadCount(0)
      }
    } catch (error) {
      console.error("[v0] Failed to mark all admin notifications as read:", error)
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
    fetchNotifications()

    if (!adminId) return

    // Set up polling with visibility awareness
    let interval: NodeJS.Timeout | null = null

    const startPolling = () => {
      if (interval) clearInterval(interval)
      interval = setInterval(() => {
        fetchNotifications()
      }, 30000)
    }

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }

    // Handle visibility change - pause polling when tab is hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        // Fetch immediately when tab becomes visible, then resume polling
        fetchNotifications()
        startPolling()
      }
    }

    // Start initial polling
    startPolling()

    // Listen for visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [adminId])

  return (
    <AdminNotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        refreshNotifications: fetchNotifications,
        showToast,
      }}
    >
      {children}
    </AdminNotificationContext.Provider>
  )
}

export function useAdminNotifications() {
  const context = useContext(AdminNotificationContext)
  if (context === undefined) {
    throw new Error("useAdminNotifications must be used within an AdminNotificationProvider")
  }
  return context
}
