"use client"

import { InstructorGroupsManagement } from "@/components/instructor-groups-management-v2"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"

export default function ManagementGroupsPage() {
  return (
    <StudentDashboardModulePage scrollMode="panel">
      <InstructorGroupsManagement embedInDashboard />
    </StudentDashboardModulePage>
  )
}
