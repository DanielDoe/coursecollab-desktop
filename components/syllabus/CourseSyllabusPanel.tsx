"use client"

import { useCallback, useEffect, useState } from "react"
import { BookOpen } from "lucide-react"
import { toast } from "@/lib/app-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { SyllabusViewer } from "@/components/syllabus/SyllabusViewer"
import { SyllabusEditor, type SyllabusEditorPanel } from "@/components/syllabus/SyllabusEditor"
import { SyllabusAccentProvider } from "@/lib/syllabus/syllabus-accent"
import type { CourseSyllabus } from "@/lib/syllabus/types"
import type { SyllabusCourseInfo } from "@/lib/syllabus/syllabus-course-info"

type CourseSyllabusPanelProps = {
  courseId: number
  mode: "student" | "instructor"
  fetchUrl: string
  saveUrl?: string
  buildHeaders: () => Record<string, string>
  studentId?: string
  editorPanel?: SyllabusEditorPanel
  onSyllabusStatusChange?: (status: CourseSyllabus["status"] | null) => void
}

export function CourseSyllabusPanel({
  courseId,
  mode,
  fetchUrl,
  saveUrl,
  buildHeaders,
  studentId,
  editorPanel,
  onSyllabusStatusChange,
}: CourseSyllabusPanelProps) {
  const [syllabus, setSyllabus] = useState<CourseSyllabus | null>(null)
  const [courseInfo, setCourseInfo] = useState<SyllabusCourseInfo | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notPublished, setNotPublished] = useState(false)

  const resolvedFetchUrl =
    mode === "student" && studentId
      ? `${fetchUrl}${fetchUrl.includes("?") ? "&" : "?"}studentId=${encodeURIComponent(studentId)}`
      : fetchUrl

  const load = useCallback(async () => {
    setLoading(true)
    setNotPublished(false)
    try {
      const res = await fetch(resolvedFetchUrl, { headers: buildHeaders() })
      const data = await res.json()
      if (res.status === 404 && mode === "student") {
        setNotPublished(true)
        setSyllabus(null)
        return
      }
      if (!res.ok) throw new Error(data.error || "Failed to load syllabus")
      setSyllabus(data.syllabus)
      setCourseInfo(data.courseInfo ?? null)
      setCanEdit(Boolean(data.canEdit))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load syllabus")
    } finally {
      setLoading(false)
    }
  }, [resolvedFetchUrl, buildHeaders, mode])

  useEffect(() => {
    void load()
  }, [load, courseId])

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>
    )
  }

  if (mode === "instructor" && canEdit && saveUrl) {
    return (
      <SyllabusAccentProvider accent="portal">
        <SyllabusEditor
          courseId={courseId}
          courseInfo={courseInfo}
          fetchUrl={fetchUrl}
          saveUrl={saveUrl}
          buildHeaders={buildHeaders}
          activePanel={editorPanel}
          onStatusChange={onSyllabusStatusChange}
        />
      </SyllabusAccentProvider>
    )
  }

  if (mode === "student" && (notPublished || !syllabus)) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <BookOpen className="mb-4 h-10 w-10 text-[var(--cc-text-muted)]" />
        <h2 className="text-lg font-semibold text-[var(--cc-text)]">Syllabus not available yet</h2>
        <p className="mt-2 max-w-md text-sm text-[var(--cc-text-muted)]">
          {mode === "student"
            ? "Your instructor has not published the course syllabus yet. Check back later."
            : "Create and publish a syllabus so students can view it."}
        </p>
      </div>
    )
  }

  if (!syllabus) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-sm text-[var(--cc-text-muted)]">No syllabus has been created for this course yet.</p>
      </div>
    )
  }

  return (
    <SyllabusViewer
      syllabus={syllabus}
      courseInfo={courseInfo}
      showStatusBadge={mode === "instructor"}
      studentId={studentId}
      interactive={mode === "student"}
    />
  )
}
