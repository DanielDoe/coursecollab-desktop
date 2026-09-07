"use client"

import { UserCheck } from "lucide-react"
import { InstructorAdministrationModulePage } from "@/components/instructor/InstructorAdministrationModulePage"
import { InstructorAttendancePoliciesHub } from "@/components/instructor/InstructorAttendancePoliciesHub"

export default function AttendancePoliciesPage() {
  return (
    <InstructorAdministrationModulePage
      title="Attendance Policies"
      description=""
      icon={UserCheck}
      moduleId="attendance-policies"
      showHeader={false}
    >
      <InstructorAttendancePoliciesHub />
    </InstructorAdministrationModulePage>
  )
}
