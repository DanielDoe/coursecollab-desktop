"use client"

import { SessionManagement } from "@/components/session-management"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AdminHeader } from "@/components/admin-header"

export default function SessionsPage() {
  return (
    <div className="min-h-screen bg-secondary">
      <AdminHeader />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/admin/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
        <SessionManagement />
      </main>
    </div>
  )
}
