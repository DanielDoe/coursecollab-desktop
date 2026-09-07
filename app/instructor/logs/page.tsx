"use client"

import { SystemLogsContent } from "@/components/instructor/SystemLogsContent"

export default function InstructorLogsPage() {
  return (
    <div className="container mx-auto px-6 py-8">
      <SystemLogsContent portal="instructor" />
    </div>
  )
}