"use client"

import { AdminProjectsManagement } from "@/components/admin-projects-management"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AdminHeader } from "@/components/admin-header"

export default function AdminProjectsPage() {
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
        <AdminProjectsManagement />
      </main>
    </div>
  )
}
