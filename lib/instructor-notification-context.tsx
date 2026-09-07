"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"
import {
  buildDesktopNotificationSyncContext,
  isDesktopElectronShell,
  registerDesktopNotificationSync,
} from "@/lib/desktop-notifications"

interface InstructorNotification {
  id: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "error"
  timestamp: Date
  read: boolean
}

interface InstructorNotificationContextType {
  notifications: InstructorNotification[]
  unreadCount: number
  addNotification: (notification: Omit<InstructorNotification, "id" | "timestamp" | "read">) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
  clearAll: () => void
}

const InstructorNotificationContext = createContext<InstructorNotificationContextType | undefined>(undefined)

export function InstructorNotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<InstructorNotification[]>([])

  const unreadCount = notifications.filter(n => !n.read).length

  const addNotification = (notification: Omit<InstructorNotification, "id" | "timestamp" | "read">) => {
    const newNotification: InstructorNotification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false
    }
    setNotifications(prev => [newNotification, ...prev])
  }

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    )
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const clearAll = () => {
    setNotifications([])
  }

  /**
   * Register the desktop background-sync context here rather than in the
   * notification bell. The bell only exists on pages that render the faculty
   * header or topbar, so navigating to CodeBench, the playground or a
   * full-screen assessment used to unmount it and tear down background sync —
   * and the remount re-primed its "seen" set, silently swallowing anything that
   * arrived meanwhile. This provider wraps every authenticated faculty route.
   */
  useEffect(() => {
    // Web app renders this provider too; the sync context is desktop-only.
    if (!isDesktopElectronShell()) return

    const headers = buildInstructorApiHeaders()
    if (!headers["x-instructor-id"]) {
      void registerDesktopNotificationSync(null)
      return
    }

    void registerDesktopNotificationSync(
      buildDesktopNotificationSyncContext(
        "faculty",
        "/api/instructor/notifications?limit=50",
        headers,
      ),
    )

    return () => {
      void registerDesktopNotificationSync(null)
    }
  }, [])

  return (
    <InstructorNotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      removeNotification,
      clearAll
    }}>
      {children}
    </InstructorNotificationContext.Provider>
  )
}

export function useInstructorNotifications() {
  const context = useContext(InstructorNotificationContext)
  if (context === undefined) {
    throw new Error("useInstructorNotifications must be used within an InstructorNotificationProvider")
  }
  return context
}