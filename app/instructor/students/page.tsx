"use client"

import { StudentManagement } from "@/components/student-management"

export default function StudentsPage() {
    return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 overflow-x-hidden">
      <StudentManagement userType="instructor" />
    </div>
  )
}

