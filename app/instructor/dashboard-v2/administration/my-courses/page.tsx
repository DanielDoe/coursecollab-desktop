"use client"

import { BookOpen } from "lucide-react"
import { InstructorAdministrationModulePage } from "@/components/instructor/InstructorAdministrationModulePage"
import { InstructorMyCoursesHub } from "@/components/instructor/InstructorMyCoursesHub"

export default function InstructorMyCoursesPage() {
  return (
    <InstructorAdministrationModulePage
      title="My courses"
      description=""
      icon={BookOpen}
      moduleId="my-courses"
      showHeader={false}
      scrollMode="panel"
    >
      <InstructorMyCoursesHub />
    </InstructorAdministrationModulePage>
  )
}
