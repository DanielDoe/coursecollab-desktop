"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Plus } from "lucide-react"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import type { FacultyCourseOffering } from "@/lib/faculty-course-offerings-shared"
import { facultyCourseSelectValue } from "@/lib/faculty-course-session-sync"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type Props = {
  onCreated: (offering: FacultyCourseOffering) => void
  compact?: boolean
  portal?: boolean
}

const FIELD = cn("h-10 rounded-lg border shadow-none", CC_FIELD.base, CC_FIELD.focus)
const TEXTAREA = cn("min-h-[5.5rem] resize-none rounded-lg border shadow-none", CC_FIELD.base, CC_FIELD.focus)

export function FacultyCreateCourseForm({ onCreated, compact, portal = false }: Props) {
  const [courseCode, setCourseCode] = useState("")
  const [courseTitle, setCourseTitle] = useState("")
  const [description, setDescription] = useState("")
  const [university, setUniversity] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const chrome = portal ? facultyEmbedChrome("my-courses") : null
  const spinner = portal ? facultyModuleSpinnerClass("my-courses") : undefined
  const labelClass = portal ? cn("text-xs font-medium", PORTAL_TEXT_MUTED) : undefined
  const fieldClass = portal ? FIELD : "rounded-xl"
  const textareaClass = portal ? TEXTAREA : "rounded-xl resize-none"

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const res = await instructorApiFetch("/api/instructor/courses", {
        method: "POST",
        headers: {
          ...buildInstructorApiHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          course_code: courseCode,
          course_title: courseTitle,
          description: description.trim() || null,
          university: university.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not create course")

      const course = data.course as {
        id: number
        course_code: string
        course_title: string
        university: string | null
        semester: string | null
        academic_term_id: number | null
        module_settings: FacultyCourseOffering["module_settings"]
      }

      const offering: FacultyCourseOffering = {
        id: course.id,
        course_id: course.id,
        academic_term_id: course.academic_term_id,
        term_label: course.semester,
        is_active_term: course.academic_term_id != null,
        course_code: course.course_code,
        course_title: course.course_title,
        university: course.university,
        semester: course.semester,
        staff_role: "INSTRUCTOR",
        module_settings: course.module_settings,
      }

      onCreated(offering)
      setCourseCode("")
      setCourseTitle("")
      setDescription("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create course")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className={compact ? "space-y-3" : "space-y-4"}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <div className="space-y-1.5">
          <Label htmlFor="faculty-course-code" className={labelClass}>
            Course code
          </Label>
          <Input
            id="faculty-course-code"
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
            placeholder="ECE2202"
            required
            className={fieldClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="faculty-course-title" className={labelClass}>
            Course title
          </Label>
          <Input
            id="faculty-course-title"
            value={courseTitle}
            onChange={(e) => setCourseTitle(e.target.value)}
            placeholder="Circuit Analysis"
            required
            className={fieldClass}
          />
        </div>
      </div>
      {!compact ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="faculty-course-university" className={labelClass}>
              University (optional)
            </Label>
            <Input
              id="faculty-course-university"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              placeholder="Uses your profile institution if blank"
              className={fieldClass}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="faculty-course-description" className={labelClass}>
              Description (optional)
            </Label>
            <Textarea
              id="faculty-course-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={textareaClass}
            />
          </div>
        </>
      ) : null}
      {error ? (
        <p className={cn("text-sm", portal ? "text-[var(--cc-sem-danger)]" : "text-red-600 dark:text-red-400")}>
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={saving}
        className={cn("gap-2", portal ? cn("h-9 rounded-lg", chrome?.cta) : "rounded-xl gap-2")}
      >
        {saving ? (
          <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        {saving ? "Creating…" : "Create course"}
      </Button>
    </form>
  )
}

export { facultyCourseSelectValue }
