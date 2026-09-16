"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  BookOpen,
  Building2,
  CalendarDays,
  Loader2,
  Plus,
  Search,
  Settings2,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "@/lib/app-toast"
import { FacultyCreateCourseForm } from "@/components/faculty-create-course-form"
import { ImsccImportWizard } from "@/components/imscc-import-wizard"
import {
  InstructorPolicyDividedList,
  InstructorPolicySurfaceCard,
} from "@/components/instructor/InstructorPolicySurfaceCard"
import { portalListStripe } from "@/lib/portal-module-themes"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { getPortalConfig } from "@/lib/portal-config"
import { FACULTY_DASHBOARD_BASE, staffRoleLabel } from "@/lib/faculty-portal-nav-config"
import {
  facultyOfferingKey,
  groupFacultyOfferings,
  facultyOfferingChipCode,
  facultyOfferingShowsAsSection,
  type FacultyCourseOffering,
} from "@/lib/faculty-course-offerings-shared"
import { facultyCourseSelectValue } from "@/lib/faculty-course-session-sync"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { PORTAL_OUTLINE_BTN, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

const SEARCH_FIELD = cn(
  "h-10 rounded-lg border pl-9 pr-9 shadow-none",
  CC_FIELD.base,
  CC_FIELD.focus,
)

function PolicyBlock({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-4 border-t border-[var(--border)] pt-5 first:border-t-0 first:pt-0">
      <div>
        <h4 className={cn("text-sm font-semibold", PORTAL_TEXT)}>{title}</h4>
        {description ? <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>{description}</p> : null}
      </div>
      {children}
    </div>
  )
}

function isCurrentOffering(
  offering: FacultyCourseOffering,
  selectedKey: string | null,
): boolean {
  if (!selectedKey) return false
  return facultyOfferingKey(offering.course_id, offering.academic_term_id, offering.session_id ?? null) === selectedKey
}

function CourseOfferingRow({
  offering,
  isCurrent,
  onOpen,
  onDelete,
  opening,
  chrome,
  spinner,
  index,
}: {
  offering: FacultyCourseOffering
  isCurrent: boolean
  onOpen: () => void
  onDelete?: () => void
  opening: boolean
  chrome: ReturnType<typeof facultyEmbedChrome>
  spinner: string
  index: number
}) {
  const settingsHref = `${FACULTY_DASHBOARD_BASE}/administration/course-settings`
  const tasHref = `${FACULTY_DASHBOARD_BASE}/administration/teaching-assistants`
  const stripe = portalListStripe(index, chrome.theme.family)

  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-3 py-3 transition-colors hover:bg-[var(--cc-accent-soft)]/45 sm:px-3.5 sm:py-3.5 lg:flex-row lg:items-start lg:justify-between",
        isCurrent && "bg-[var(--muted)]/35",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
            stripe.iconBg,
            stripe.iconText,
          )}
        >
          <BookOpen className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className={cn("text-xs font-semibold tracking-wide", chrome.p.iconText)}>
              {facultyOfferingShowsAsSection(offering)
                ? (offering.session_code ?? offering.course_code)
                : facultyOfferingChipCode(offering)}
            </span>
            {offering.is_active_term ? (
              <Badge className="border-0 bg-[var(--cc-sem-success)]/15 text-[var(--cc-sem-success)] hover:bg-[var(--cc-sem-success)]/15">
                Current term
              </Badge>
            ) : null}
            {isCurrent ? (
              <Badge className="border-0 bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)] hover:bg-[var(--cc-accent-soft)]">
                Active in dashboard
              </Badge>
            ) : null}
            {offering.exchange_provenance ? (
              <Badge className="border-0 bg-sky-500/15 text-sky-800 hover:bg-sky-500/15 dark:text-sky-300">
                {offering.exchange_provenance.destinationInstructorName || offering.owner_name || "Your"} variant
              </Badge>
            ) : null}
          </div>
          <h3 className={cn("text-sm font-semibold leading-snug sm:text-base", PORTAL_TEXT)}>
            {offering.course_title}
          </h3>
          {offering.exchange_provenance ? (
            <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
              Inherited from {offering.exchange_provenance.sourceInstructorName}
              {offering.exchange_provenance.sourceCourseCode
                ? ` · ${offering.exchange_provenance.sourceCourseCode}`
                : ""}
              {offering.exchange_provenance.sourceCourseTitle
                ? ` — ${offering.exchange_provenance.sourceCourseTitle}`
                : ""}
            </p>
          ) : null}
          <p className={cn("mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm", PORTAL_TEXT_MUTED)}>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              {offering.term_label ?? "Not linked to a term"}
            </span>
            {offering.university ? (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  {offering.university}
                </span>
              </>
            ) : null}
          </p>
          <p className={cn("mt-1.5 text-xs", PORTAL_TEXT_MUTED)}>
            {staffRoleLabel(offering.staff_role ?? "INSTRUCTOR")}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-12 lg:pl-0">
        <Button
          type="button"
          size="sm"
          disabled={opening}
          className={cn("h-9 gap-1.5 rounded-lg", chrome.cta)}
          onClick={onOpen}
        >
          {opening ? <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} /> : null}
          Open course
        </Button>
        <Button variant="outline" size="sm" className={cn("h-9 gap-1.5 rounded-lg", PORTAL_OUTLINE_BTN)} asChild>
          <Link href={settingsHref}>
            <Settings2 className="h-4 w-4" />
            Settings
          </Link>
        </Button>
        <Button variant="outline" size="sm" className={cn("h-9 gap-1.5 rounded-lg", PORTAL_OUTLINE_BTN)} asChild>
          <Link href={tasHref}>
            <Users className="h-4 w-4" />
            TAs
          </Link>
        </Button>
        {onDelete ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("h-9 gap-1.5 rounded-lg", PORTAL_OUTLINE_BTN)}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function InstructorMyCoursesHub() {
  const router = useRouter()
  const portalCfg = getPortalConfig("faculty")
  const { beginCourseSwitch, refreshPermissions, bumpCourseScope } = useInstructorDashboardV2()
  const chrome = facultyEmbedChrome("my-courses")
  const spinner = facultyModuleSpinnerClass("my-courses")

  const [offerings, setOfferings] = useState<FacultyCourseOffering[]>([])
  const [activeTermLabel, setActiveTermLabel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [createMode, setCreateMode] = useState<"scratch" | "canvas">("scratch")
  const [openingKey, setOpeningKey] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const [blockDelete, setBlockDelete] = useState<FacultyCourseOffering | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<FacultyCourseOffering | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/courses", { headers: buildInstructorApiHeaders() })
      const data = await res.json()
      if (res.ok) {
        setOfferings((data.offerings || data.courses || []) as FacultyCourseOffering[])
        setActiveTermLabel(data.activeTerm?.label ?? null)
      }
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    try {
      const raw = localStorage.getItem(portalCfg.sessionStorageKey)
      if (raw) {
        const s = JSON.parse(raw) as Record<string, unknown>
        setSelectedKey(facultyCourseSelectValue(s) || null)
        const cid = Number(s.selectedCourseId)
        setSelectedCourseId(Number.isFinite(cid) && cid > 0 ? cid : null)
      }
    } catch {
      /* ignore */
    }
  }, [load, portalCfg.sessionStorageKey])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return offerings
    return offerings.filter((o) => {
      const hay = `${o.course_code} ${o.course_title} ${o.term_label ?? ""} ${o.university ?? ""}`.toLowerCase()
      return hay.includes(q)
    })
  }, [offerings, search])

  const grouped = useMemo(() => groupFacultyOfferings(filtered), [filtered])

  const openOffering = async (offering: FacultyCourseOffering) => {
    const key = facultyOfferingKey(offering.course_id, offering.academic_term_id, offering.session_id ?? null)
    setOpeningKey(key)
    try {
      const raw = localStorage.getItem(portalCfg.sessionStorageKey)
      const s = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
      delete s.courseScopeSkipped
      s.selectedCourseId = offering.course_id
      s.selectedCourseCode = offering.catalog_course_code ?? offering.course_code
      s.selectedCatalogCourseCode = offering.catalog_course_code ?? offering.course_code
      s.selectedCourseTitle = offering.course_title
      if (offering.session_id != null) {
        s.selectedSessionId = offering.session_id
        s.selectedSessionCode = offering.session_code ?? offering.course_code
      } else {
        delete s.selectedSessionId
        delete s.selectedSessionCode
      }
      s.staffRoleForCourse = offering.staff_role ?? "INSTRUCTOR"
      if (offering.academic_term_id != null) {
        s.selectedAcademicTermId = offering.academic_term_id
        s.selectedTermLabel = offering.term_label
      } else {
        delete s.selectedAcademicTermId
        delete s.selectedTermLabel
      }
      localStorage.setItem(portalCfg.sessionStorageKey, JSON.stringify(s))
      setSelectedKey(key)
      setSelectedCourseId(offering.course_id)
      window.dispatchEvent(new Event("instructor-session-updated"))
      bumpCourseScope()
      beginCourseSwitch({
        title: offering.course_title,
        code: facultyOfferingChipCode(offering),
      })
      try {
        const res = await fetch("/api/faculty/permissions", {
          headers: {
            ...buildInstructorApiHeaders(),
            "x-course-id": String(offering.course_id),
          },
        })
        const json = await res.json()
        if (res.ok) {
          const raw2 = localStorage.getItem(portalCfg.sessionStorageKey)
          if (raw2) {
            const s2 = JSON.parse(raw2) as Record<string, unknown>
            s2.coursePermissions = json.permissions ?? []
            s2.staffRoleForCourse = json.staffRole ?? s2.staffRoleForCourse
            localStorage.setItem(portalCfg.sessionStorageKey, JSON.stringify(s2))
          }
          await refreshPermissions()
        }
      } catch {
        /* ignore */
      }
      router.push(FACULTY_DASHBOARD_BASE)
      router.refresh()
    } finally {
      setOpeningKey(null)
    }
  }

  const renderOfferingList = (list: FacultyCourseOffering[]) => (
    <InstructorPolicyDividedList>
      {list.map((o, index) => {
        const key = facultyOfferingKey(o.course_id, o.academic_term_id, o.session_id ?? null)
        return (
          <CourseOfferingRow
            key={key}
            offering={o}
            isCurrent={isCurrentOffering(o, selectedKey)}
            onOpen={() => void openOffering(o)}
            onDelete={
              String(o.staff_role ?? "INSTRUCTOR").toUpperCase() === "INSTRUCTOR"
                ? () => {
                    if (selectedCourseId != null && o.course_id === selectedCourseId) {
                      setBlockDelete(o)
                      return
                    }
                    setConfirmDelete(o)
                  }
                : undefined
            }
            opening={openingKey === key}
            chrome={chrome}
            spinner={spinner}
            index={index}
          />
        )
      })}
    </InstructorPolicyDividedList>
  )

  if (loading) {
    return <InstructorPolicyLoadingState moduleId="my-courses" label="Loading your courses…" />
  }

  const deleteCourse = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      const res = await instructorApiFetch("/api/instructor/courses", {
        method: "DELETE",
        headers: {
          ...buildInstructorApiHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ courseId: confirmDelete.course_id }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && data.code === "course_selected") {
        setConfirmDelete(null)
        setBlockDelete(confirmDelete)
        return
      }
      if (!res.ok) throw new Error(data.error || "Could not delete course")
      setOfferings((prev) => prev.filter((o) => o.course_id !== confirmDelete.course_id))
      setConfirmDelete(null)
      toast.success("Course permanently deleted")
      bumpCourseScope()
      void load({ silent: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete course")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
    <div className="flex w-full min-w-0 flex-col gap-4">
      <InstructorPolicySurfaceCard className="w-full">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_min(22rem,100%)]">
          <div className="min-w-0 space-y-5">
            <PolicyBlock
              title="Your offerings"
              description={
                activeTermLabel
                  ? `Switch dashboard scope or open course tools. Active term: ${activeTermLabel}.`
                  : "Switch dashboard scope or open course settings and TA management."
              }
            >
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by code, title, term, or university…"
                  className={SEARCH_FIELD}
                  aria-label="Search courses"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--cc-text-muted)] hover:bg-[var(--cc-accent-soft)]/45 hover:text-[var(--cc-text)]"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/25 px-4 py-10 text-center">
                  <span className={cn("mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl", chrome.p.softBg, chrome.p.iconText)}>
                    <BookOpen className="h-5 w-5" aria-hidden />
                  </span>
                  <p className={cn("font-medium", PORTAL_TEXT)}>
                    {search ? "No courses match your search" : "No courses yet"}
                  </p>
                  <p className={cn("mx-auto mt-1 max-w-md text-sm", PORTAL_TEXT_MUTED)}>
                    {search
                      ? "Try a different keyword or clear the search box."
                      : "Create your first course using the form on the right."}
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {grouped.active.length > 0 ? (
                    <div className="space-y-2">
                      <p className={cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                        {grouped.activeTermLabel ? `${grouped.activeTermLabel} offerings` : "Current term"}
                      </p>
                      {renderOfferingList(grouped.active)}
                    </div>
                  ) : null}
                  {grouped.other.length > 0 ? (
                    <div className="space-y-2">
                      <p className={cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                        Other terms & archives
                      </p>
                      {renderOfferingList(grouped.other)}
                    </div>
                  ) : null}
                </div>
              )}
            </PolicyBlock>
          </div>

          <div className="min-w-0 border-t border-[var(--border)] pt-5 xl:sticky xl:top-4 xl:self-start xl:border-t-0 xl:pt-0">
            <PolicyBlock
              title="Add a course"
              description="Start from scratch or import a Canvas Common Cartridge. Export from Canvas: course → Settings → Export Course Content."
            >
              <div className="mb-3 flex rounded-lg border border-[var(--border)] p-0.5">
                <button
                  type="button"
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-xs font-medium",
                    createMode === "scratch" ? cn(chrome.p.softBg, chrome.p.iconText) : PORTAL_TEXT_MUTED,
                  )}
                  onClick={() => setCreateMode("scratch")}
                >
                  From scratch
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-xs font-medium",
                    createMode === "canvas" ? cn(chrome.p.softBg, chrome.p.iconText) : PORTAL_TEXT_MUTED,
                  )}
                  onClick={() => setCreateMode("canvas")}
                >
                  Import Canvas
                </button>
              </div>
              {createMode === "scratch" ? (
                <FacultyCreateCourseForm
                  portal
                  onCreated={(offering) => {
                    setOfferings((prev) => [offering, ...prev])
                    void load()
                    bumpCourseScope()
                  }}
                />
              ) : (
                <ImsccImportWizard
                  portal="faculty"
                  onImported={(result) => {
                    const offering: FacultyCourseOffering = {
                      id: result.course.id,
                      course_id: result.course.id,
                      academic_term_id: result.course.academic_term_id,
                      term_label: result.course.semester,
                      is_active_term: result.course.academic_term_id != null,
                      course_code: result.course.course_code,
                      course_title: result.course.course_title,
                      university: result.course.university,
                      semester: result.course.semester,
                      staff_role: "INSTRUCTOR",
                      module_settings: result.course.module_settings as FacultyCourseOffering["module_settings"],
                    }
                    setOfferings((prev) => [offering, ...prev.filter((o) => o.course_id !== offering.course_id)])
                    void load({ silent: true })
                    bumpCourseScope()
                  }}
                  onOpenCourse={(result) => {
                    void openOffering({
                      id: result.course.id,
                      course_id: result.course.id,
                      academic_term_id: result.course.academic_term_id,
                      term_label: result.course.semester,
                      is_active_term: result.course.academic_term_id != null,
                      course_code: result.course.course_code,
                      course_title: result.course.course_title,
                      university: result.course.university,
                      semester: result.course.semester,
                      staff_role: "INSTRUCTOR",
                      module_settings: result.course.module_settings as FacultyCourseOffering["module_settings"],
                    })
                  }}
                  commit={async (payload) => {
                    const res = await instructorApiFetch("/api/instructor/courses/import/commit", {
                      method: "POST",
                      headers: {
                        ...buildInstructorApiHeaders(),
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify(payload),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || "Import failed")
                    return data
                  }}
                />
              )}
            </PolicyBlock>
          </div>
        </div>
      </InstructorPolicySurfaceCard>
    </div>
    <AlertDialog open={blockDelete != null} onOpenChange={(open) => { if (!open) setBlockDelete(null) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Course is active in your dashboard</AlertDialogTitle>
          <AlertDialogDescription>
            {blockDelete
              ? `${blockDelete.course_code} is currently selected. Switch to another course, then delete.`
              : "Switch to another course, then delete."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={confirmDelete != null} onOpenChange={(open) => { if (!open && !deleting) setConfirmDelete(null) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently delete this course?</AlertDialogTitle>
          <AlertDialogDescription>
            {confirmDelete
              ? `${confirmDelete.course_code} and everything in it will be deleted: students, sessions, notes, syllabus, quizzes, lectures, files, and related records. This cannot be undone.`
              : "This course and all of its data will be permanently deleted."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={chrome.danger}
            disabled={deleting}
            onClick={(e) => {
              e.preventDefault()
              void deleteCourse()
            }}
          >
            {deleting ? <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} /> : "Delete permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
