"use client"

import { EditMidSemesterForm } from "@/components/edit-mid-semester-form"
import { AdminHeader } from "@/components/admin-header"

export default function EditMidSemesterPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-secondary">
      <AdminHeader />

      <main className="container mx-auto px-4 py-8">
        <EditMidSemesterForm examId={params.id} />
      </main>
    </div>
  )
}
