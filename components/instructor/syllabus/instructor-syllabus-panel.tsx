"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BookOpen, Building2, FileText, Search, Users } from "lucide-react"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { InstructorModuleStudentActivityView } from "@/components/instructor/module-activity/InstructorModuleStudentActivityView"
import { CourseSyllabusPanel } from "@/components/syllabus/CourseSyllabusPanel"
import type { SyllabusEditorPanel } from "@/components/syllabus/SyllabusEditor"
import { getInstructorData } from "@/lib/auth"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import type { SyllabusStatus } from "@/lib/syllabus/types"

type SyllabusMenu = SyllabusEditorPanel | "student-activity"

const MODULE_ID = "syllabus"

const MENU_ITEMS = [
  { id: "structured" as const, label: "Sections", icon: BookOpen },
  { id: "exchange" as const, label: "Find template", icon: Search },
  { id: "pdf" as const, label: "PDF upload", icon: FileText },
  { id: "branding" as const, label: "Logo & branding", icon: Building2 },
  { id: "student-activity" as const, label: "Student Activity", icon: Users },
]

export function InstructorSyllabusPanel() {
  const router = useRouter()
  const [courseId, setCourseId] = useState<number | null>(null)
  const [activeMenu, setActiveMenu] = useState<SyllabusMenu>("structured")
  const [status, setStatus] = useState<SyllabusStatus | null>(null)

  useEffect(() => {
    const data = getInstructorData()
    if (!data) {
      router.push("/faculty/login")
      return
    }
    if (data.selectedCourseId) setCourseId(Number(data.selectedCourseId))
  }, [router])

  const chrome = facultyEmbedChrome(MODULE_ID)
  const editorPanel = activeMenu === "student-activity" ? "structured" : activeMenu

  const sidebar = (
    <FacultyModuleSideMenu
      moduleId={MODULE_ID}
      title="Syllabus"
      activeId={activeMenu}
      onSelect={(id) => setActiveMenu(id as SyllabusMenu)}
      items={MENU_ITEMS}
      footer={
        status ? (
          <span
            className={cn(
              "inline-flex h-8 w-full items-center justify-center rounded-lg px-2.5 text-xs font-semibold",
              status === "published" ? chrome.success : chrome.quiet,
            )}
          >
            {status === "published" ? "Published" : "Draft"}
          </span>
        ) : null
      }
    />
  )

  return (
    <FacultyModuleSplitLayout menu={sidebar}>
      {activeMenu === "student-activity" ? (
        <InstructorModuleStudentActivityView module="syllabus" moduleId={MODULE_ID} />
      ) : courseId != null ? (
        <CourseSyllabusPanel
          courseId={courseId}
          mode="instructor"
          fetchUrl="/api/instructor/syllabus"
          saveUrl="/api/instructor/syllabus"
          buildHeaders={buildInstructorApiHeaders}
          editorPanel={editorPanel}
          onSyllabusStatusChange={setStatus}
        />
      ) : (
        <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Select a course to manage its syllabus.</p>
      )}
    </FacultyModuleSplitLayout>
  )
}
