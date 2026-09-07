"use client"

import { FinancialManagement } from "@/components/financial-management"
import { AdminHeader } from "@/components/admin-header"

export default function AdminFinancialsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <AdminHeader />
      <main className="container mx-auto px-4 py-8">
        <FinancialManagement />
      </main>
    </div>
  )
}

