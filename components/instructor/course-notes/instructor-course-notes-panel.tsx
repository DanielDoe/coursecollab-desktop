"use client"

import { useEffect, useMemo, useState } from "react"
import type { CourseDigitalNote } from "@/lib/course-digital-notes"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { InstructorCourseNotesAllView } from "@/components/instructor/course-notes/instructor-course-notes-all-view"
import { InstructorCourseNotesTopicsView } from "@/components/instructor/course-notes/instructor-course-notes-topics-view"
import { InstructorCourseNotesConfigView } from "@/components/instructor/course-notes/instructor-course-notes-config-view"
import { InstructorCourseNotesDeletedView } from "@/components/instructor/course-notes/instructor-course-notes-deleted-view"
import { InstructorCourseNotesNativePanel } from "@/components/instructor/course-notes/instructor-course-notes-native-panel"
import { InstructorModuleStudentActivityView } from "@/components/instructor/module-activity/InstructorModuleStudentActivityView"
import { useNativeApp } from "@/hooks/use-native-app"
import { FilePenLine, FolderOpen, SlidersHorizontal, Trash2, Users } from "lucide-react"
import { useInstructorScopeKey } from "@/hooks/use-instructor-scope-key"
import { useFacultyCourseNotesQuery } from "@/hooks/data/use-faculty-course-notes-query"
import { ModuleListSkeleton, StaleRefreshHint } from "@/components/data/module-list-skeleton"

export type CourseNoteMenu = "all" | "topics" | "configuration" | "deleted" | "student-activity"

const MODULE_ID = "course-notes"

const MENU_ITEMS = [
  { id: "all" as const, label: "All Notes", icon: FilePenLine },
  { id: "topics" as const, label: "Topics", icon: FolderOpen },
  { id: "configuration" as const, label: "Note Configuration", icon: SlidersHorizontal },
  { id: "student-activity" as const, label: "Student Activity", icon: Users },
  { id: "deleted" as const, label: "Deleted Items", icon: Trash2 },
]

export function InstructorCourseNotesPanel() {
  const isNativeApp = useNativeApp()
  const scopeKey = useInstructorScopeKey()
  const [activeMenu, setActiveMenu] = useState<CourseNoteMenu>("all")
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null)
  const notesQuery = useFacultyCourseNotesQuery()
  const notes = notesQuery.notes
  const deletedCount = notesQuery.deletedCount
  const loading = notesQuery.isLoading
  const reload = notesQuery.refetch
  const setNotes = notesQuery.setNotes

  useEffect(() => {
    void notesQuery.refetch()
  }, [scopeKey])

  const topicCount = useMemo(() => {
    const names = new Set<string>()
    for (const note of notes) {
      names.add(note.topic?.trim() || "General")
    }
    return names.size
  }, [notes])

  const sidebar = (
    <FacultyModuleSideMenu
      moduleId={MODULE_ID}
      title="Course Notes"
      activeId={activeMenu}
      onSelect={(id) => setActiveMenu(id as CourseNoteMenu)}
      items={MENU_ITEMS.map((item) => ({
        ...item,
        badge:
          item.id === "topics"
            ? topicCount
            : item.id === "deleted" && deletedCount > 0
              ? deletedCount
              : undefined,
        tone: item.id === "deleted" ? ("destructive" as const) : undefined,
      }))}
    />
  )

  if (isNativeApp) {
    return <InstructorCourseNotesNativePanel />
  }

  if (loading && notes.length === 0 && activeMenu === "all") {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <ModuleListSkeleton rows={6} />
      </div>
    )
  }

  return (
    <FacultyModuleSplitLayout menu={sidebar}>
      <StaleRefreshHint visible={notesQuery.refreshFailed} onRetry={() => notesQuery.refetch()} />
      {activeMenu === "all" ? (
        <InstructorCourseNotesAllView
          notes={notes}
          selectedNoteId={selectedNoteId}
          topicFilter={null}
          onSelectNote={setSelectedNoteId}
          onClearTopicFilter={() => {}}
          onReload={reload}
        />
      ) : null}

      {activeMenu === "topics" ? (
        <InstructorCourseNotesTopicsView notes={notes} onReload={reload} />
      ) : null}

      {activeMenu === "configuration" ? <InstructorCourseNotesConfigView /> : null}

      {activeMenu === "student-activity" ? (
        <InstructorModuleStudentActivityView module="notes" moduleId={MODULE_ID} />
      ) : null}

      {activeMenu === "deleted" ? <InstructorCourseNotesDeletedView onRestored={reload} /> : null}
    </FacultyModuleSplitLayout>
  )
}
