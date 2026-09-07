"use client"

import { AlertCircle } from "lucide-react"
import { InstructorAdministrationModulePage } from "@/components/instructor/InstructorAdministrationModulePage"
import { InstructorSubmissionIssuesPanel } from "@/components/instructor/InstructorSubmissionIssuesPanel"

export default function SubmissionIssuesPage() {
  return (
    <InstructorAdministrationModulePage
      title="Submission Issues"
      description=""
      icon={AlertCircle}
      moduleId="submission-issues"
      showHeader={false}
    >
      <InstructorSubmissionIssuesPanel embedInAdmin />
    </InstructorAdministrationModulePage>
  )
}
