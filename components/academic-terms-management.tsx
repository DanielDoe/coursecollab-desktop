"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Calendar, Plus, Trash2, BookOpen, Layers, Users } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { buildAdminApiHeaders } from "@/lib/admin-api-headers"
import { getFacultyModuleTheme } from "@/lib/faculty-module-themes"
import { cn } from "@/lib/utils"
import type { TermCourseRow } from "@/lib/academic-term-courses"

interface AcademicTerm {
  id: number
  year: number
  term: string
  start_date: string | null
  end_date: string | null
  is_active: boolean
  course_count?: number
  session_count?: number
  total_students?: number
  courses?: { id: number; course_code: string; course_title: string }[]
}

interface SectionRow {
  id: number
  code: string
  description: string | null
  student_count: number
}

interface CatalogCourse {
  id: number
  course_code: string
  course_title: string
}

function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-[var(--cc-text)]">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

function canonicalSectionLabel(courseCode: string, sectionCode: string): string {
  const compact = courseCode.replace(/\s+/g, "").toUpperCase()
  const code = sectionCode.trim()
  if (/^P\d+/i.test(code)) return `${compact}${code.toUpperCase()}`
  return code
}

export function AcademicTermsManagement({
  userType = "instructor",
  embedInDashboard = false,
}: {
  userType?: "admin" | "instructor"
  embedInDashboard?: boolean
}) {
  void embedInDashboard
  const fp = userType === "instructor" ? getFacultyModuleTheme("sections").page : null
  const columnClass = "min-h-[280px] space-y-3 rounded-xl bg-[var(--muted)]/30 p-3 sm:p-4"
  const selectedRowClass = (selected: boolean) =>
    selected
      ? cn(fp?.border ?? "border-[var(--cc-accent-border)]", fp?.softBg ?? "bg-[var(--cc-accent-soft)]")
      : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/45"
  const accentIcon = fp?.iconText ?? "text-[var(--cc-accent-dark)]"
  const iconWell = cn(
    "flex size-8 shrink-0 items-center justify-center rounded-lg",
    fp?.softBg ?? "bg-[var(--cc-accent-soft)]",
    accentIcon,
  )
  const ctaClass = fp?.cta ?? ""
  const addBtnClass = "h-8 rounded-full px-3 text-xs"

  const { toast } = useToast()
  const apiPrefix = userType === "admin" ? "/api/admin" : "/api/instructor"

  const headers = useCallback((): Record<string, string> => {
    if (userType === "admin") return buildAdminApiHeaders()
    const h = buildInstructorApiHeaders()
    const raw = localStorage.getItem("instructorSession")
    if (raw) h.authorization = raw
    return h
  }, [userType])

  const [loading, setLoading] = useState(true)
  const [terms, setTerms] = useState<AcademicTerm[]>([])
  const [termCourses, setTermCourses] = useState<TermCourseRow[]>([])
  const [sections, setSections] = useState<SectionRow[]>([])
  const [catalogCourses, setCatalogCourses] = useState<CatalogCourse[]>([])
  const [selectedTerm, setSelectedTerm] = useState<AcademicTerm | null>(null)
  const [selectedCourse, setSelectedCourse] = useState<TermCourseRow | null>(null)
  const [usesSections, setUsesSections] = useState(true)

  const [showAddTerm, setShowAddTerm] = useState(false)
  const [showAddCourse, setShowAddCourse] = useState(false)
  const [showAddSection, setShowAddSection] = useState(false)
  const [removeCourseTarget, setRemoveCourseTarget] = useState<TermCourseRow | null>(null)
  const [removeSectionTarget, setRemoveSectionTarget] = useState<SectionRow | null>(null)
  const [activatingTermId, setActivatingTermId] = useState<number | null>(null)

  const [termForm, setTermForm] = useState({
    year: new Date().getFullYear(),
    term: "Summer",
    start_date: "",
    end_date: "",
  })
  const [courseToAdd, setCourseToAdd] = useState("")
  const [sectionForm, setSectionForm] = useState({ code: "", description: "" })
  const [submitting, setSubmitting] = useState(false)

  const availableCoursesToAdd = useMemo(() => {
    const inTerm = new Set(termCourses.map((c) => c.course_id))
    return catalogCourses.filter((c) => !inTerm.has(c.id))
  }, [catalogCourses, termCourses])

  const fetchTerms = useCallback(async () => {
    const res = await fetch(`${apiPrefix}/academic-terms`, { headers: headers() })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Failed to load terms")
    const list = (data.terms || []) as AcademicTerm[]
    setTerms(list)
    setSelectedTerm((prev) => {
      if (!list.length) return null
      if (!prev) return list.find((t) => t.is_active) ?? list[0]
      return list.find((t) => t.id === prev.id) ?? list[0]
    })
  }, [apiPrefix, headers])

  const fetchCatalogCourses = useCallback(async () => {
    if (userType !== "instructor") {
      const res = await fetch(`${apiPrefix}/courses`, { headers: headers() })
      if (res.ok) {
        const data = await res.json()
        setCatalogCourses(data.courses || [])
      }
      return
    }
    const res = await instructorApiFetch("/api/instructor/courses", { headers: headers() })
    if (res.ok) {
      const data = await res.json()
      setCatalogCourses(data.courses || [])
    }
  }, [apiPrefix, headers, userType])

  const fetchTermCourses = useCallback(
    async (termId: number) => {
      const res = await fetch(`${apiPrefix}/academic-terms/${termId}/courses`, { headers: headers() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load courses")
      const list = (data.courses || []) as TermCourseRow[]
      setTermCourses(list)
      setSelectedCourse((prev) => {
        if (!list.length) return null
        if (!prev) return list[0]
        return list.find((c) => c.course_id === prev.course_id) ?? list[0]
      })
    },
    [apiPrefix, headers],
  )

  const fetchSections = useCallback(
    async (termId: number, courseId: number) => {
      const res = await fetch(
        `${apiPrefix}/academic-terms/${termId}/courses/${courseId}/sections`,
        { headers: headers() },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load sections")
      setSections(data.sections || [])
      setUsesSections(data.uses_sections !== false)
    },
    [apiPrefix, headers],
  )

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([fetchTerms(), fetchCatalogCourses()])
      } catch (e) {
        toast({
          title: "Error",
          description: e instanceof Error ? e.message : "Failed to load",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    })()
  }, [fetchTerms, fetchCatalogCourses, toast])

  useEffect(() => {
    if (!selectedTerm) {
      setTermCourses([])
      setSelectedCourse(null)
      return
    }
    void fetchTermCourses(selectedTerm.id).catch((e) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
    )
  }, [selectedTerm, fetchTermCourses, toast])

  useEffect(() => {
    if (!selectedTerm || !selectedCourse) {
      setSections([])
      return
    }
    if (!selectedCourse.uses_sections) {
      setSections([])
      setUsesSections(false)
      return
    }
    void fetchSections(selectedTerm.id, selectedCourse.course_id).catch((e) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
    )
  }, [selectedTerm, selectedCourse, fetchSections, toast])

  const handleCreateTerm = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`${apiPrefix}/academic-terms`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ ...termForm, is_active: false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create term")
      toast({ title: "Term created" })
      setShowAddTerm(false)
      await fetchTerms()
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Could not create term",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSetActiveTerm = async (term: AcademicTerm) => {
    setActivatingTermId(term.id)
    try {
      const res = await fetch(`${apiPrefix}/academic-terms/${term.id}/activate`, {
        method: "POST",
        headers: headers(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to activate term")
      toast({ title: `${term.term} ${term.year} is now active for student login` })
      await fetchTerms()
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Could not set active term",
        variant: "destructive",
      })
    } finally {
      setActivatingTermId(null)
    }
  }

  const handleAddCourse = async () => {
    if (!selectedTerm || !courseToAdd) return
    setSubmitting(true)
    try {
      const res = await fetch(`${apiPrefix}/academic-terms/${selectedTerm.id}/courses`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: Number(courseToAdd) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to add course")
      toast({ title: "Course added to term" })
      setShowAddCourse(false)
      setCourseToAdd("")
      await fetchTermCourses(selectedTerm.id)
      await fetchTerms()
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Could not add course",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveCourse = async () => {
    if (!selectedTerm || !removeCourseTarget) return
    setSubmitting(true)
    try {
      const res = await fetch(
        `${apiPrefix}/academic-terms/${selectedTerm.id}/courses/${removeCourseTarget.course_id}`,
        { method: "DELETE", headers: headers() },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to remove course")
      toast({ title: "Course removed from term" })
      setRemoveCourseTarget(null)
      if (selectedCourse?.course_id === removeCourseTarget.course_id) {
        setSelectedCourse(null)
      }
      await fetchTermCourses(selectedTerm.id)
      await fetchTerms()
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Could not remove course",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddSection = async () => {
    if (!selectedTerm || !selectedCourse || !sectionForm.code.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(
        `${apiPrefix}/academic-terms/${selectedTerm.id}/courses/${selectedCourse.course_id}/sections`,
        {
          method: "POST",
          headers: { ...headers(), "Content-Type": "application/json" },
          body: JSON.stringify(sectionForm),
        },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to add section")
      toast({ title: "Section added" })
      setShowAddSection(false)
      setSectionForm({ code: "", description: "" })
      await fetchSections(selectedTerm.id, selectedCourse.course_id)
      await fetchTermCourses(selectedTerm.id)
      await fetchTerms()
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Could not add section",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveSection = async () => {
    if (!removeSectionTarget || !selectedTerm || !selectedCourse) return
    setSubmitting(true)
    try {
      const res = await fetch(`${apiPrefix}/sessions/${removeSectionTarget.id}`, {
        method: "DELETE",
        headers: headers(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete section")
      toast({ title: "Section removed" })
      setRemoveSectionTarget(null)
      await fetchSections(selectedTerm.id, selectedCourse.course_id)
      await fetchTermCourses(selectedTerm.id)
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Could not remove section",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <div className={cn("h-8 w-8 animate-spin rounded-full border-2 border-t-transparent", fp?.spinner ?? "border-[var(--cc-accent)]")} />
        <p className="text-sm text-[var(--cc-text-muted)]">Loading terms…</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
          Academic terms
        </p>
        <p className="mt-0.5 text-sm text-[var(--cc-text)]">
          Choose a term, then its courses
          <span className="text-[var(--cc-text-muted)]"> · sections only when a course uses them</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <section className={columnClass}>
          <PanelHeader
            title="Terms"
            subtitle="Active term is used at student login"
            action={
              <Button size="sm" variant="outline" className={addBtnClass} onClick={() => setShowAddTerm(true)}>
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            }
          />
          <div className="max-h-[520px] space-y-2 overflow-y-auto">
            {terms.map((term) => (
              <div
                key={term.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedTerm(term)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setSelectedTerm(term)
                  }
                }}
                className={cn(
                  "w-full cursor-pointer rounded-xl border px-3 py-3 text-left transition-colors",
                  selectedRowClass(selectedTerm?.id === term.id),
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={iconWell}>
                      <Calendar className="h-4 w-4" />
                    </span>
                    <span className="truncate font-semibold text-[var(--cc-text)]">
                      {term.term} {term.year}
                    </span>
                    {term.is_active ? (
                      <span className="rounded-full bg-[var(--cc-success)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--cc-success)]">
                        Active
                      </span>
                    ) : null}
                  </div>
                  {!term.is_active ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn("h-7 shrink-0 px-2 text-xs", accentIcon)}
                      disabled={activatingTermId === term.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleSetActiveTerm(term)
                      }}
                    >
                      Set active
                    </Button>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
                  {term.course_count ?? 0} courses · {term.session_count ?? 0} sections ·{" "}
                  {term.total_students ?? 0} students
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className={columnClass}>
          <PanelHeader
            title="Courses"
            subtitle={selectedTerm ? `${selectedTerm.term} ${selectedTerm.year}` : "Select a term"}
            action={
              <Button
                size="sm"
                variant="outline"
                className={addBtnClass}
                disabled={!selectedTerm}
                onClick={() => setShowAddCourse(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            }
          />
          {!selectedTerm ? (
            <p className="py-10 text-center text-sm text-[var(--cc-text-muted)]">Select a term.</p>
          ) : termCourses.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--cc-text-muted)]">No courses in this term yet.</p>
          ) : (
            <div className="max-h-[520px] space-y-2 overflow-y-auto">
              {termCourses.map((course) => (
                <div
                  key={course.course_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedCourse(course)}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedCourse(course)}
                  className={cn("cursor-pointer rounded-xl border px-3 py-3", selectedRowClass(selectedCourse?.course_id === course.course_id))}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={iconWell}>
                          <BookOpen className="h-4 w-4" />
                        </span>
                        <span className="truncate font-semibold text-[var(--cc-text)]">{course.course_title}</span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
                        {course.course_code}
                        {" · "}
                        {course.uses_sections
                          ? `${course.section_count} section${course.section_count === 1 ? "" : "s"}`
                          : "Single roster"}
                        {" · "}
                        {course.student_count} students
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 shrink-0 p-0 text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        setRemoveCourseTarget(course)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={columnClass}>
          <PanelHeader
            title="Sections"
            subtitle={
              selectedCourse
                ? selectedCourse.uses_sections
                  ? selectedCourse.course_code
                  : "Not used for this course"
                : "Select a course"
            }
            action={
              selectedCourse?.uses_sections ? (
                <Button
                  size="sm"
                  variant="outline"
                  className={addBtnClass}
                  disabled={!selectedTerm || !selectedCourse}
                  onClick={() => setShowAddSection(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              ) : null
            }
          />
          {!selectedCourse ? (
            <p className="py-10 text-center text-sm text-[var(--cc-text-muted)]">Select a course.</p>
          ) : !selectedCourse.uses_sections ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center">
              <Layers className="mx-auto mb-2 h-6 w-6 text-[var(--cc-text-muted)]" />
              <p className="text-sm font-medium text-[var(--cc-text)]">Single roster</p>
              <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
                Students enroll directly in {selectedCourse.course_title}.
              </p>
            </div>
          ) : sections.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--cc-text-muted)]">No sections yet.</p>
          ) : (
            <div className="max-h-[520px] space-y-2 overflow-y-auto">
              {sections.map((section) => (
                <div
                  key={section.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--cc-text)]">
                      {canonicalSectionLabel(selectedCourse.course_code, section.code)}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--cc-text-muted)]">
                      <Users className="h-3 w-3" />
                      {section.student_count} students
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 shrink-0 p-0 text-red-600"
                    onClick={() => setRemoveSectionTarget(section)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Add term */}
      <Dialog open={showAddTerm} onOpenChange={setShowAddTerm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add academic term</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Year</Label>
                <Input
                  type="number"
                  value={termForm.year}
                  onChange={(e) => setTermForm((f) => ({ ...f, year: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Term</Label>
                <Select value={termForm.term} onValueChange={(v) => setTermForm((f) => ({ ...f, term: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Spring", "Summer", "Fall", "Winter"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={termForm.start_date}
                  onChange={(e) => setTermForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>End date</Label>
                <Input
                  type="date"
                  value={termForm.end_date}
                  onChange={(e) => setTermForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTerm(false)}>Cancel</Button>
            <Button className={ctaClass || undefined} onClick={() => void handleCreateTerm()} disabled={submitting}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add course */}
      <Dialog open={showAddCourse} onOpenChange={setShowAddCourse}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add course to {selectedTerm?.term} {selectedTerm?.year}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Course</Label>
            <Select value={courseToAdd} onValueChange={setCourseToAdd}>
              <SelectTrigger><SelectValue placeholder="Choose a course" /></SelectTrigger>
              <SelectContent>
                {availableCoursesToAdd.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.course_title} ({c.course_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCourse(false)}>Cancel</Button>
            <Button className={ctaClass || undefined} onClick={() => void handleAddCourse()} disabled={submitting || !courseToAdd}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add section */}
      <Dialog open={showAddSection} onOpenChange={setShowAddSection}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add section — {selectedCourse?.course_code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Section code</Label>
              <Input
                placeholder="P01 or ELEG1304P01"
                value={sectionForm.code}
                onChange={(e) => setSectionForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input
                value={sectionForm.description}
                onChange={(e) => setSectionForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSection(false)}>Cancel</Button>
            <Button className={ctaClass || undefined} onClick={() => void handleAddSection()} disabled={submitting || !sectionForm.code.trim()}>
              Add section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeCourseTarget} onOpenChange={() => setRemoveCourseTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove course from term?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {removeCourseTarget?.course_title} from {selectedTerm?.term} {selectedTerm?.year} and
              deletes its sections in this term (if any).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleRemoveCourse()}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeSectionTarget} onOpenChange={() => setRemoveSectionTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete section?</AlertDialogTitle>
            <AlertDialogDescription>
              Students enrolled in {removeSectionTarget?.code} will need to be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleRemoveSection()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
