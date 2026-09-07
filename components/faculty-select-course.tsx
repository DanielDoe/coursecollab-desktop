"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { GraduationCap, ArrowRight, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { staffRoleLabel } from "@/lib/faculty-portal-nav-config"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"
import { FacultyCourseOfferingSelectItems } from "@/components/faculty-course-offering-select-items"
import {
  applyFacultySkipCourseScope,
  facultyCourseSelectValue,
  reconcileFacultySelectedCourse,
} from "@/lib/faculty-course-session-sync"
import {
  fetchFacultyOfferingsForSession,
  findOfferingByKey,
  formatFacultyOfferingLabel,
  facultySessionNeedsPasswordChange,
  readFacultySession,
} from "@/lib/faculty-auth-flow"
import type { FacultyCourseOffering } from "@/lib/faculty-course-offerings-shared"

const COURSE_PLACEHOLDER = "Choose course and term"

function formatOfferingLabel(o: FacultyCourseOffering): string {
  return formatFacultyOfferingLabel(o)
}

export function FacultySelectCourse() {
  const router = useRouter()
  const [offerings, setOfferings] = useState<FacultyCourseOffering[]>([])
  const [activeTermLabel, setActiveTermLabel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [selectedKey, setSelectedKey] = useState<string>("")

  useEffect(() => {
    const session = readFacultySession()
    if (!session?.id) {
      router.replace("/faculty/login")
      return
    }
    if (facultySessionNeedsPasswordChange(session)) {
      router.replace("/faculty/change-password")
      return
    }
    const key = facultyCourseSelectValue(session)
    if (key) setSelectedKey(key)

    const load = async () => {
      try {
        const data = await fetchFacultyOfferingsForSession()
        const list = data.offerings
        setOfferings(list)
        setActiveTermLabel(data.activeTermLabel)

        const raw = localStorage.getItem("instructorSession")
        if (raw) {
          const session = JSON.parse(raw) as Record<string, unknown>
          const { session: next, changed, valid } = reconcileFacultySelectedCourse(session, list)
          if (changed) {
            localStorage.setItem("instructorSession", JSON.stringify(next))
          }
          if (valid) {
            setSelectedKey(facultyCourseSelectValue(next))
          } else {
            setSelectedKey("")
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load courses")
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [router])

  const selectedOffering = selectedKey ? findOfferingByKey(offerings, selectedKey) : undefined

  const enterDashboard = (session: Record<string, unknown>) => {
    localStorage.setItem("instructorSession", JSON.stringify(session))
    window.dispatchEvent(new Event("instructor-session-updated"))
    router.push("/faculty/dashboard")
  }

  const onSkip = () => {
    setSaving(true)
    setError("")
    try {
      const raw = localStorage.getItem("instructorSession")
      if (!raw) return
      const session = applyFacultySkipCourseScope(JSON.parse(raw) as Record<string, unknown>)
      enterDashboard(session)
    } catch {
      setError("Could not continue")
      setSaving(false)
    }
  }

  const onContinue = async () => {
    if (!selectedKey || !selectedOffering) {
      setError("Choose a course to continue, or skip to enter without a course.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const raw = localStorage.getItem("instructorSession")
      if (!raw) return
      const session = JSON.parse(raw) as Record<string, unknown>
      session.selectedCourseId = selectedOffering.course_id
      session.selectedCourseCode = selectedOffering.catalog_course_code ?? selectedOffering.course_code
      session.selectedCatalogCourseCode = selectedOffering.catalog_course_code ?? selectedOffering.course_code
      session.selectedCourseTitle = selectedOffering.course_title
      session.staffRoleForCourse = selectedOffering.staff_role ?? "INSTRUCTOR"
      delete session.courseScopeSkipped
      if (selectedOffering.session_id != null) {
        session.selectedSessionId = selectedOffering.session_id
        session.selectedSessionCode = selectedOffering.session_code ?? selectedOffering.course_code
      } else {
        delete session.selectedSessionId
        delete session.selectedSessionCode
      }
      if (selectedOffering.academic_term_id != null) {
        session.selectedAcademicTermId = selectedOffering.academic_term_id
        session.selectedTermLabel = selectedOffering.term_label
      } else {
        delete session.selectedAcademicTermId
        delete session.selectedTermLabel
      }

      const permRes = await fetch("/api/faculty/permissions", {
        headers: {
          ...buildInstructorApiHeaders(),
          "x-course-id": String(selectedOffering.course_id),
        },
      })
      const permData = await permRes.json()
      if (permRes.ok) {
        session.coursePermissions = permData.permissions ?? []
        session.staffRoleForCourse = permData.staffRole ?? session.staffRoleForCourse
      }

      enterDashboard(session)
    } catch {
      setError("Could not save selection")
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl shadow-xl p-8 sm:p-10">
        <div className="flex justify-end mb-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-lg text-slate-600 dark:text-slate-400"
            onClick={() => void onSkip()}
            disabled={saving || loading}
          >
            Skip for now
          </Button>
        </div>

        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-white">Select a course</h1>
        <p className="text-sm text-center text-slate-600 dark:text-slate-400 mt-2">
          {loading
            ? "Loading your courses…"
            : offerings.length === 0
              ? "No courses are assigned yet. Skip to open the dashboard, then create one under Administration → My Courses."
              : activeTermLabel
                ? `Courses in ${activeTermLabel} appear first. You can also open offerings from other terms.`
                : "Choose a course to scope your tools, or skip and pick one later from the header."}
        </p>

        <div className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label>Course</Label>
            <Select
              value={selectedKey}
              onValueChange={setSelectedKey}
              disabled={loading || offerings.length === 0}
            >
              <SelectTrigger className="h-11 w-full rounded-xl border-[var(--border)] bg-[var(--card)] text-left text-slate-900 dark:text-white">
                <SelectValue
                  placeholder={
                    loading
                      ? "Loading…"
                      : offerings.length === 0
                        ? "No courses available"
                        : COURSE_PLACEHOLDER
                  }
                >
                  {selectedOffering ? formatOfferingLabel(selectedOffering) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-[min(320px,55vh)] rounded-xl bg-[var(--popover)] text-slate-900 dark:text-white">
                <FacultyCourseOfferingSelectItems
                  offerings={offerings}
                  activeTermLabel={activeTermLabel}
                  showStaffRole
                />
              </SelectContent>
            </Select>
          </div>

          {selectedOffering?.staff_role ? (
            <div className="flex flex-wrap justify-center gap-2">
              <Badge variant="secondary" className="rounded-lg">
                {staffRoleLabel(selectedOffering.staff_role)} in this course
              </Badge>
              {selectedOffering.term_label ? (
                <Badge variant="outline" className="rounded-lg">
                  {selectedOffering.term_label}
                </Badge>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-700 text-sm px-4 py-3">
              {error}
            </div>
          ) : null}

          <Button
            type="button"
            onClick={() => void onContinue()}
            disabled={saving || loading || !selectedKey}
            className={cn(
              "w-full rounded-xl py-6 text-base font-semibold gap-2",
              "bg-emerald-600 hover:bg-emerald-700 text-white",
            )}
          >
            {saving ? "Loading portal…" : "Continue to Faculty Dashboard"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-8 pt-6 border-t flex justify-center gap-2 text-sm text-slate-500">
          <GraduationCap className="h-4 w-4" />
          <span>CourseCollab Faculty</span>
        </div>
      </div>
    </div>
  )
}
