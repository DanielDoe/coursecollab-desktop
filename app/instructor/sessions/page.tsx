"use client"

import { AcademicTermsSessionsManagement } from "@/components/academic-terms-sessions-management"

export default function SessionsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <AcademicTermsSessionsManagement userType="instructor" />
    </div>
  )
}
