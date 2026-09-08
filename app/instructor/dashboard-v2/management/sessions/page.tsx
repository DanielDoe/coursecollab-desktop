"use client"

import { AcademicTermsManagement } from "@/components/academic-terms-management"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"

export default function ManagementSessionsPage() {
  return (
    <StudentDashboardModulePage scrollMode="panel">
      <AcademicTermsManagement userType="instructor" embedInDashboard />
    </StudentDashboardModulePage>
  )
}
