"use client"

import { FacultyCourseDiscussions } from "@/components/instructor/discussions/FacultyCourseDiscussions"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"

export default function CommunicationDiscussionsPage() {
  return (
    <StudentDashboardModulePage scrollMode="panel">
      <FacultyCourseDiscussions />
    </StudentDashboardModulePage>
  )
}
