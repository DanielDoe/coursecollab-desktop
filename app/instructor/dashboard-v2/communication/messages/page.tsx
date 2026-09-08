"use client"

import { Suspense } from "react"
import { MessagesInbox } from "@/components/messages/MessagesInbox"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"

export default function FacultyMessagesPage() {
  return (
    <StudentDashboardModulePage scrollMode="panel">
      <Suspense fallback={null}>
        <MessagesInbox portal="instructor" />
      </Suspense>
    </StudentDashboardModulePage>
  )
}
