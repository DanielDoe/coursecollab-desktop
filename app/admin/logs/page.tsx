"use client"

import { AdminHeader } from "@/components/admin-header"
import { SystemLogsContent } from "@/components/instructor/SystemLogsContent"

export default function AdminLogsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AdminHeader />
      <div className="container mx-auto px-6 py-8">
        <SystemLogsContent portal="admin" />
      </div>
    </div>
  )
}
