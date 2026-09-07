"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { NotificationProvider } from "@/lib/notification-context"
import { StudentErrorProvider } from "@/components/student-error-context"
import { CoraProvider } from "@/components/cora/CoraProvider"
import { getStudentData } from "@/lib/auth"

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const resolveStudentNotificationId = () => {
    if (typeof window === "undefined") return null
    const data = getStudentData()
    const fromStorage = sessionStorage.getItem("studentDatabaseId")
    return fromStorage || data?.databaseId?.toString() || data?.id || null
  }

  const [studentId, setStudentId] = useState<string | null>(() => resolveStudentNotificationId())

  useEffect(() => {
    const id = resolveStudentNotificationId()
    if (id) {
      setStudentId((prev) => (prev === id ? prev : id))
    }
  }, [])

  return (
    <StudentErrorProvider>
      <NotificationProvider studentId={studentId}>
        <CoraProvider>{children}</CoraProvider>
      </NotificationProvider>
    </StudentErrorProvider>
  )
}
