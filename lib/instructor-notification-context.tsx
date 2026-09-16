"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

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