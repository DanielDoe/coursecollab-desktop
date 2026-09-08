"use client"

import { CamperManagement } from "@/components/summer-camp/CamperManagement"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"

export default function FacultyCampersPage() {
  return (
    <StudentDashboardModulePage scrollMode="panel">
      <CamperManagement portal="faculty" />
    </StudentDashboardModulePage>
  )
}
