"use client"
/** @jsxImportSource react */

import React, { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Users, 
  Calendar, 
  ArrowLeft, 
  GraduationCap,
  BookOpen,
  ChevronRight,
  School,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  LayoutGrid,
  List,
  Filter
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"
import { buildAdminApiHeaders } from "@/lib/admin-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"

interface AcademicTerm {
  id: number
  year: number
  term: string
  start_date: string | null
  end_date: string | null
  is_active: boolean
  created_at: string
  session_count?: number
  total_students?: number
  courses?: { id: number; course_code: string; course_title: string }[]
}

interface Session {
  id: number
  code: string
  description: string | null
  academic_term_id: number | null
  created_at: string
  student_count: number
}

interface SessionsScopeCourse {
  id: number
  course_code: string
  course_title: string
}

/**
 * Banner-style section codes (P01, P02) are stored without the course prefix; show the full label
 * instructors/students recognize (e.g. ELEG1304 + P01 → ELEG1304P01).
 */
function canonicalSectionLabel(courseCodeRaw: string, sectionCodeRaw: string): string {
  const sectionCode = sectionCodeRaw.trim()
  if (!sectionCode) return sectionCodeRaw
  const courseCompact = courseCodeRaw.replace(/\s+/g, "").toUpperCase()
  const sectionNorm = sectionCode.toUpperCase().replace(/\s+/g, "")
  if (sectionNorm.startsWith(courseCompact) && sectionNorm.length >= courseCompact.length) {
    return sectionCode
  }
  if (sectionNorm.includes(courseCompact) && sectionNorm !== courseCompact) {
    return sectionCode
  }
  if (/^P\d+/i.test(sectionCode)) {
    return `${courseCompact}${sectionCode.toUpperCase()}`
  }
  return `${courseCodeRaw.trim()} · ${sectionCode}`
}

function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1">
      <h2 className="col-start-1 row-start-1 text-lg font-semibold text-slate-800 dark:text-white leading-tight">
        {title}
      </h2>
      {action ? (
        <div className="col-start-2 row-start-1 self-start">{action}</div>
      ) : null}
      {subtitle ? (
        <p className="col-start-1 row-start-2 text-sm text-slate-500 dark:text-slate-400 leading-snug truncate">
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}

function PanelAddButton({
  label,
  shortLabel,
  onClick,
  disabled,
}: {
  label: string
  shortLabel?: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className="h-9 shrink-0 rounded-xl bg-blue-600 px-3 hover:bg-blue-700 text-white whitespace-nowrap"
    >
      <Plus className="h-4 w-4 shrink-0" />
      <span className="ml-1.5 hidden min-[420px]:inline">{label}</span>
      {shortLabel ? (
        <span className="ml-1.5 min-[420px]:hidden">{shortLabel}</span>
      ) : (
        <span className="ml-1.5 min-[420px]:hidden">Add</span>
      )}
    </Button>
  )
}

export function AcademicTermsSessionsManagement({ userType = "instructor", embedInDashboard }: { userType?: "admin" | "instructor"; embedInDashboard?: boolean }) {
  const { toast } = useToast()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [scopedCourseTitle, setScopedCourseTitle] = useState("")
  const [scopedCourseCode, setScopedCourseCode] = useState("")
  /** Course row from sessions API (authoritative for display labels). */
  const [sessionsScopeCourse, setSessionsScopeCourse] = useState<SessionsScopeCourse | null>(null)
  const [academicTerms, setAcademicTerms] = useState<AcademicTerm[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  /** Same course, but not linked to the currently selected term (wrong term or unassigned). */
  const [sectionsElsewhere, setSectionsElsewhere] = useState<Session[]>([])
  const [assigningSectionId, setAssigningSectionId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTerm, setSelectedTerm] = useState<AcademicTerm | null>(null)
  
  // Dialogs
  const [showAddTermDialog, setShowAddTermDialog] = useState(false)
  const [showEditTermDialog, setShowEditTermDialog] = useState(false)
  const [showDeleteTermDialog, setShowDeleteTermDialog] = useState(false)
  const [showAddSessionDialog, setShowAddSessionDialog] = useState(false)
  const [showEditSessionDialog, setShowEditSessionDialog] = useState(false)
  const [showDeleteSessionDialog, setShowDeleteSessionDialog] = useState(false)
  
  // Form data
  const [termFormData, setTermFormData] = useState({
    year: new Date().getFullYear(),
    term: "Fall",
    start_date: "",
    end_date: "",
    is_active: true
  })
  const [sessionFormData, setSessionFormData] = useState({
    code: "",
    description: "",
    academic_term_id: 0
  })
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activatingTermId, setActivatingTermId] = useState<number | null>(null)

  // View organizer state (persisted per list type)
  const [termsView, setTermsView] = usePersistedState("academic-terms-view", {
    sortBy: "date",
    sortDir: "desc",
    filter: "all",
    search: "",
    viewMode: "list",
  })
  const [sessionsView, setSessionsView] = usePersistedState("academic-sessions-view", {
    sortBy: "code",
    sortDir: "asc",
    search: "",
    viewMode: "list",
  })

  const getApiPrefix = () => userType === "admin" ? "/api/admin" : "/api/instructor"

  const sectionCopy =
    userType === "instructor"
      ? { plural: "Sections", pluralLower: "sections", singular: "section" }
      : { plural: "Sessions", pluralLower: "sessions", singular: "session" }

  const sectionSingularProper =
    sectionCopy.singular.charAt(0).toUpperCase() + sectionCopy.singular.slice(1)

  const instructorBareHeaders = (): Record<string, string> => {
    const h = buildInstructorApiHeaders()
    const raw = localStorage.getItem("instructorSession")
    if (raw) h.authorization = raw
    return h
  }

  const adminBareHeaders = (): Record<string, string> => buildAdminApiHeaders()

  const scopedGetInit = (): RequestInit => ({
    headers: userType === "instructor" ? instructorBareHeaders() : adminBareHeaders(),
  })

  const jsonWriteInit = (): RequestInit => {
    const headers =
      userType === "instructor"
        ? { ...instructorBareHeaders(), "Content-Type": "application/json" }
        : { ...adminBareHeaders(), "Content-Type": "application/json" }
    return { headers }
  }

  // Filtered and sorted terms
  const displayedTerms = useMemo(() => {
    let items = academicTerms
    if (termsView.search.trim()) {
      const q = termsView.search.toLowerCase()
      items = items.filter(
        (t) =>
          `${t.term} ${t.year}`.toLowerCase().includes(q) ||
          (t.start_date && t.start_date.includes(q)) ||
          (t.end_date && t.end_date.includes(q))
      )
    }
    if (termsView.filter === "active") {
      items = items.filter((t) => t.is_active)
    }
    return [...items].sort((a, b) => {
      let cmp = 0
      switch (termsView.sortBy) {
        case "name":
          cmp = `${a.term} ${a.year}`.localeCompare(`${b.term} ${b.year}`)
          break
        case "date":
          cmp = (a.start_date || "").localeCompare(b.start_date || "")
          break
        case "students":
          cmp = (a.total_students || 0) - (b.total_students || 0)
          break
        case "sessions":
          cmp = (a.session_count || 0) - (b.session_count || 0)
          break
      }
      return termsView.sortDir === "desc" ? -cmp : cmp
    })
  }, [academicTerms, termsView.search, termsView.filter, termsView.sortBy, termsView.sortDir])

  // Filtered and sorted sessions
  const displayedSessions = useMemo(() => {
    let items = sessions
    if (sessionsView.search.trim()) {
      const q = sessionsView.search.toLowerCase()
      items = items.filter(
        (s) =>
          s.code.toLowerCase().includes(q) ||
          (s.description?.toLowerCase().includes(q) ?? false)
      )
    }
    return [...items].sort((a, b) => {
      let cmp = 0
      switch (sessionsView.sortBy) {
        case "code":
          cmp = a.code.localeCompare(b.code)
          break
        case "students":
          cmp = a.student_count - b.student_count
          break
        case "date":
          cmp = a.created_at.localeCompare(b.created_at)
          break
      }
      return sessionsView.sortDir === "desc" ? -cmp : cmp
    })
  }, [sessions, sessionsView.search, sessionsView.sortBy, sessionsView.sortDir])

  /** Prefer API course row; fall back to session snapshot in top bar. */
  const displayCourseCodeForSections = (
    sessionsScopeCourse?.course_code ??
    scopedCourseCode ??
    ""
  ).trim()

  useEffect(() => {
    if (userType !== "instructor") return
    try {
      const raw = localStorage.getItem("instructorSession")
      if (!raw) return
      const s = JSON.parse(raw) as { selectedCourseTitle?: string; selectedCourseCode?: string }
      setScopedCourseTitle(s.selectedCourseTitle?.trim() || "")
      setScopedCourseCode(s.selectedCourseCode?.trim() || "")
    } catch {
      setScopedCourseTitle("")
      setScopedCourseCode("")
    }
  }, [userType, courseScopeVersion])

  useEffect(() => {
    void fetchAcademicTerms()
    // Refetch when instructor changes scoped course (context version) or role switches
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchAcademicTerms intentionally reads latest localStorage in scopedGetInit
  }, [userType, courseScopeVersion])

  useEffect(() => {
    if (selectedTerm) {
      void fetchSessions(selectedTerm.id)
    } else {
      setSessions([])
      setSessionsScopeCourse(null)
      setSectionsElsewhere([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchSessions closes over scoped headers at call time
  }, [selectedTerm])

  const fetchAcademicTerms = async () => {
    try {
      const response = await fetch(`${getApiPrefix()}/academic-terms`, scopedGetInit())
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(
          (err as { error?: string }).error ||
            `Failed to fetch academic terms (${response.status})`,
        )
      }
      const data = await response.json()
      const terms = ((data.terms || []) as AcademicTerm[]).map((t) => {
        let courses = t.courses
        if (typeof courses === "string") {
          try {
            courses = JSON.parse(courses)
          } catch {
            courses = []
          }
        }
        return { ...t, courses: Array.isArray(courses) ? courses : [] }
      })
      setAcademicTerms(terms)

      // Keep the same calendar term selected when possible; refresh row from API (counts are per course).
      setSelectedTerm((prev) => {
        if (terms.length === 0) return null
        if (!prev) return terms[0]
        const match = terms.find((t) => t.id === prev.id)
        return match ?? terms[0]
      })
    } catch (error) {
      console.error("[v0] Failed to fetch academic terms:", error)
      toast({
        title: "Error",
        description: "Failed to load academic terms",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchSessions = async (termId: number) => {
    setSectionsElsewhere([])
    try {
      const response = await fetch(`${getApiPrefix()}/sessions?academic_term_id=${termId}`, scopedGetInit())
      if (!response.ok) throw new Error("Failed to fetch sessions")
      const data = await response.json()
      if (userType === "instructor" && data.course && typeof data.course.course_code === "string") {
        setSessionsScopeCourse(data.course as SessionsScopeCourse)
      } else {
        setSessionsScopeCourse(null)
      }
      // Filter out BETA session - it should never be linked to an academic term
      const filteredSessions = (data.sessions || []).filter((s: Session) => s.code.toUpperCase() !== "BETA")
      setSessions(filteredSessions)

      if (userType === "instructor") {
        const allRes = await fetch(`${getApiPrefix()}/sessions`, scopedGetInit())
        if (allRes.ok) {
          const allData = await allRes.json()
          if (allData.course && typeof allData.course.course_code === "string") {
            setSessionsScopeCourse(allData.course as SessionsScopeCourse)
          }
          const allRaw = (allData.sessions || []) as Session[]
          const all = allRaw.filter((s) => s.code.toUpperCase() !== "BETA")
          setSectionsElsewhere(all.filter((s) => s.academic_term_id !== termId))
        }
      }
    } catch (error) {
      console.error("[v0] Failed to fetch sessions:", error)
      setSessionsScopeCourse(null)
      setSessions([])
      setSectionsElsewhere([])
      toast({
        title: "Error",
        description: "Failed to load sessions",
        variant: "destructive",
      })
    }
  }

  const termLabelForId = (academicTermId: number | null): string => {
    if (academicTermId == null) return "No term assigned"
    const t = academicTerms.find((x) => x.id === academicTermId)
    return t ? `${t.term} ${t.year}` : `Term #${academicTermId}`
  }

  const linkSectionToSelectedTerm = async (session: Session) => {
    if (!selectedTerm || userType !== "instructor") return
    setAssigningSectionId(session.id)
    try {
      const res = await fetch(`${getApiPrefix()}/sessions/${session.id}`, {
        method: "PUT",
        ...jsonWriteInit(),
        body: JSON.stringify({
          code: session.code,
          description: session.description ?? null,
          academic_term_id: selectedTerm.id,
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || "Failed to link section to this term")
      }
      toast({
        title: "Section linked",
        description: `${session.code} is now under ${selectedTerm.term} ${selectedTerm.year}.`,
      })
      void fetchSessions(selectedTerm.id)
      void fetchAcademicTerms()
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Could not link section",
        variant: "destructive",
      })
    } finally {
      setAssigningSectionId(null)
    }
  }

  const handleAddTerm = async () => {
    if (!termFormData.year || !termFormData.term) {
      toast({
        title: "Validation Error",
        description: "Year and term are required",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`${getApiPrefix()}/academic-terms`, {
        method: "POST",
        ...jsonWriteInit(),
        body: JSON.stringify(termFormData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create academic term")
      }

      toast({
        title: "Success",
        description: "Academic term created successfully",
      })

      setShowAddTermDialog(false)
      setTermFormData({
        year: new Date().getFullYear(),
        term: "Fall",
        start_date: "",
        end_date: "",
        is_active: true
      })
      fetchAcademicTerms()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditTerm = async () => {
    if (!selectedTerm || !termFormData.year || !termFormData.term) {
      toast({
        title: "Validation Error",
        description: "Year and term are required",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`${getApiPrefix()}/academic-terms/${selectedTerm.id}`, {
        method: "PUT",
        ...jsonWriteInit(),
        body: JSON.stringify(termFormData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update academic term")
      }

      toast({
        title: "Success",
        description: "Academic term updated successfully",
      })

      setShowEditTermDialog(false)
      setSelectedTerm(null)
      fetchAcademicTerms()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSetActiveTerm = async (term: AcademicTerm) => {
    if (term.is_active) return
    setActivatingTermId(term.id)
    try {
      const response = await fetch(`${getApiPrefix()}/academic-terms/${term.id}/activate`, {
        method: "POST",
        ...scopedGetInit(),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to set active term")
      }
      const data = await response.json()
      toast({
        title: "Active term updated",
        description: `${term.term} ${term.year} is now the active term for student login.`,
      })
      setSelectedTerm((prev) =>
        prev?.id === term.id ? { ...prev, is_active: true } : prev,
      )
      fetchAcademicTerms()
      if (data.label) {
        console.info("[academic-terms] active term:", data.label)
      }
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not set active term",
        variant: "destructive",
      })
    } finally {
      setActivatingTermId(null)
    }
  }

  const handleDeleteTerm = async () => {
    if (!selectedTerm) return

    setSubmitting(true)
    try {
      const response = await fetch(`${getApiPrefix()}/academic-terms/${selectedTerm.id}`, {
        method: "DELETE",
        ...scopedGetInit(),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete academic term")
      }

      toast({
        title: "Success",
        description: "Academic term deleted successfully",
      })

      setShowDeleteTermDialog(false)
      setSelectedTerm(null)
      if (academicTerms.length > 1) {
        const remainingTerms = academicTerms.filter(t => t.id !== selectedTerm.id)
        setSelectedTerm(remainingTerms[0] || null)
      } else {
        setSelectedTerm(null)
      }
      fetchAcademicTerms()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddSession = async () => {
    if (!sessionFormData.code.trim() || !sessionFormData.academic_term_id) {
      toast({
        title: "Validation Error",
        description: "Session code and academic term are required",
        variant: "destructive",
      })
      return
    }

    // Prevent creating BETA session through this UI - BETA must be standalone
    if (sessionFormData.code.toUpperCase() === 'BETA') {
      toast({
        title: "Invalid Session Code",
        description: "BETA session cannot be linked to an academic term. BETA is a standalone session for testing purposes.",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`${getApiPrefix()}/sessions`, {
        method: "POST",
        ...jsonWriteInit(),
        body: JSON.stringify(sessionFormData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create session")
      }

      toast({
        title: "Success",
        description: "Session created successfully",
      })

      setShowAddSessionDialog(false)
      setSessionFormData({ code: "", description: "", academic_term_id: selectedTerm?.id || 0 })
      if (selectedTerm) {
        fetchSessions(selectedTerm.id)
        fetchAcademicTerms()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditSession = async () => {
    if (!selectedSession || !sessionFormData.code.trim()) {
      toast({
        title: "Validation Error",
        description: "Session code is required",
        variant: "destructive",
      })
      return
    }

    // Prevent editing BETA session through this UI - BETA must remain standalone
    if (selectedSession.code.toUpperCase() === 'BETA' || sessionFormData.code.toUpperCase() === 'BETA') {
      toast({
        title: "Cannot Edit BETA Session",
        description: "BETA session cannot be edited or linked to an academic term. BETA is a standalone session for testing purposes.",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`${getApiPrefix()}/sessions/${selectedSession.id}`, {
        method: "PUT",
        ...jsonWriteInit(),
        body: JSON.stringify(sessionFormData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update session")
      }

      toast({
        title: "Success",
        description: "Session updated successfully",
      })

      setShowEditSessionDialog(false)
      setSelectedSession(null)
      if (selectedTerm) {
        fetchSessions(selectedTerm.id)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteSession = async () => {
    if (!selectedSession) return

    setSubmitting(true)
    try {
      const response = await fetch(`${getApiPrefix()}/sessions/${selectedSession.id}`, {
        method: "DELETE",
        ...scopedGetInit(),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete session")
      }

      const data = await response.json()

      toast({
        title: "Success",
        description: `Session deleted. ${data.deletedStudents || 0} student(s) removed.`,
      })

      setShowDeleteSessionDialog(false)
      setSelectedSession(null)
      if (selectedTerm) {
        fetchSessions(selectedTerm.id)
        fetchAcademicTerms()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const openEditTermDialog = (term: AcademicTerm) => {
    setSelectedTerm(term)
    setTermFormData({
      year: term.year,
      term: term.term,
      start_date: term.start_date || "",
      end_date: term.end_date || "",
      is_active: term.is_active
    })
    setShowEditTermDialog(true)
  }

  const openDeleteTermDialog = (term: AcademicTerm) => {
    setSelectedTerm(term)
    setShowDeleteTermDialog(true)
  }

  const openEditSessionDialog = (session: Session) => {
    setSelectedSession(session)
    setSessionFormData({
      code: session.code,
      description: session.description || "",
      academic_term_id: session.academic_term_id
    })
    setShowEditSessionDialog(true)
  }

  const openDeleteSessionDialog = (session: Session) => {
    setSelectedSession(session)
    setShowDeleteSessionDialog(true)
  }

  const openAddSessionDialog = () => {
    if (!selectedTerm) return
    setSessionFormData({
      code: "",
      description: "",
      academic_term_id: selectedTerm.id,
    })
    setShowAddSessionDialog(true)
  }

  const sectionsPanelSubtitle = selectedTerm
    ? [
        sessionsScopeCourse?.course_code || displayCourseCodeForSections,
        `${selectedTerm.term} ${selectedTerm.year}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Select a term on the left to view and add sections"

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-20">
        <div className="flex flex-col items-center justify-center">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
      {!embedInDashboard && (
        <div className="flex justify-end">
          <Link href={userType === "admin" ? "/admin/dashboard-v2" : "/instructor/dashboard"}>
            <Button variant="outline" size="sm" className="border-slate-200 dark:border-white/10 rounded-xl">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      )}

      {embedInDashboard && userType === "instructor" && (
        <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-500/35 bg-emerald-50/90 dark:bg-emerald-500/10 px-3 sm:px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">Academic terms & course sections</p>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Set the <span className="font-medium">active academic term</span> to control which courses students see at login.
            {(scopedCourseTitle || scopedCourseCode) && (
              <>
                {" "}
                Section counts on the right are for{" "}
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {scopedCourseTitle || "Course"}
                  {scopedCourseCode ? (
                    <span className="text-slate-500 dark:text-slate-400 font-normal"> ({scopedCourseCode})</span>
                  ) : null}
                </span>
                . Switch course from the header to manage another offering.
              </>
            )}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 lg:items-start">
        {/* Section: Academic Terms */}
        <section className="space-y-4 rounded-xl sm:rounded-2xl border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.02] p-4 sm:p-5">
            <div className="space-y-4">
              <PanelHeader
                title="Academic Terms"
                subtitle="Active term controls student login; courses listed per term"
                action={
                  <PanelAddButton label="Add Term" onClick={() => setShowAddTermDialog(true)} />
                }
              />

              {academicTerms.length > 0 && (
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 md:gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.08]">
                  <div className="relative w-full sm:flex-1 sm:min-w-[140px] sm:max-w-none md:max-w-[220px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search terms..."
                      value={termsView.search}
                      onChange={(e) => setTermsView((prev) => ({ ...prev, search: e.target.value }))}
                      className="pl-8 h-9 rounded-lg text-sm border-slate-200 dark:border-white/10"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 rounded-lg gap-1.5 text-slate-600 dark:text-slate-400">
                        <ArrowUpDown className="h-3.5 w-3.5" />
                        Sort
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-44">
                      {(["name", "date", "students", "sessions"] as const).map((key) => (
                        <DropdownMenuItem
                          key={key}
                          onClick={() =>
                            setTermsView((prev) => ({
                              ...prev,
                              sortBy: key,
                              sortDir: prev.sortBy === key && prev.sortDir === "asc" ? "desc" : "asc",
                            }))
                          }
                          className="capitalize"
                        >
                          {key === "name"
                            ? "Term name"
                            : key === "date"
                              ? "Date"
                              : key === "students"
                                ? "Students"
                                : sectionCopy.plural}
                          {termsView.sortBy === key && (
                            <span className="ml-auto">{termsView.sortDir === "asc" ? <ArrowUp className="h-3.5" /> : <ArrowDown className="h-3.5" />}</span>
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 rounded-lg gap-1.5 text-slate-600 dark:text-slate-400">
                        <Filter className="h-3.5 w-3.5" />
                        {termsView.filter === "active" ? "Active only" : "All"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-36">
                      <DropdownMenuItem onClick={() => setTermsView((prev) => ({ ...prev, filter: "all" }))}>
                        All terms
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTermsView((prev) => ({ ...prev, filter: "active" }))}>
                        Active only
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="flex items-center gap-1 border rounded-lg p-1 border-slate-200 dark:border-white/10">
                    <Button
                      variant={termsView.viewMode === "list" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setTermsView((prev) => ({ ...prev, viewMode: "list" }))}
                      className="h-7 w-7 p-0 rounded-md"
                      title="List view"
                    >
                      <List className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant={termsView.viewMode === "grid" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setTermsView((prev) => ({ ...prev, viewMode: "grid" }))}
                      className="h-7 w-7 p-0 rounded-md"
                      title="Grid view"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 sm:ml-auto">
                    {displayedTerms.length} of {academicTerms.length}
                  </span>
                  </div>
                </div>
              )}

              {academicTerms.length === 0 ? (
                <Card className="border-slate-200/60 dark:border-white/[0.08] rounded-xl sm:rounded-2xl p-8 sm:p-12 text-center bg-white/80 dark:bg-white/[0.02]">
                  <div className="p-4 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <School className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-slate-600 mb-4">No academic terms found. Create your first term to get started.</p>
                  <Button
                    onClick={() => setShowAddTermDialog(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Term
                  </Button>
                </Card>
              ) : displayedTerms.length === 0 ? (
                <div className="rounded-xl p-8 text-center border border-slate-200/60 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.02]">
                  <p className="text-slate-500 dark:text-slate-400">No terms match your search or filter.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTermsView((prev) => ({ ...prev, search: "", filter: "all" }))}
                    className="mt-3 rounded-lg"
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div className={termsView.viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3" : "space-y-2"}>
                  {displayedTerms.map((term) => (
                    <div
                      key={term.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedTerm(term)}
                      onKeyDown={(e) => e.key === "Enter" && setSelectedTerm(term)}
                      className={`group flex rounded-xl px-4 py-3.5 transition-all cursor-pointer ${
                        termsView.viewMode === "grid"
                          ? "flex-col gap-3 border"
                          : "items-center gap-4 border-l-4"
                      } ${
                        selectedTerm?.id === term.id
                          ? termsView.viewMode === "grid"
                            ? "border-blue-500/60 bg-blue-500/8 dark:bg-blue-500/12"
                            : "border-l-blue-600 bg-blue-500/8 dark:bg-blue-500/12 border border-blue-200/60 dark:border-blue-500/30"
                          : termsView.viewMode === "grid"
                            ? "border-slate-200/60 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.02] hover:border-blue-300/50 hover:bg-slate-50/80 dark:hover:bg-white/5"
                            : "border-l-transparent border border-slate-200/60 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.02] hover:border-l-blue-400 hover:border-slate-300/60 dark:hover:border-white/10 hover:bg-slate-50/80 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/20 ${termsView.viewMode === "grid" ? "self-start" : ""}`}>
                        <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className={`min-w-0 ${termsView.viewMode === "grid" ? "w-full" : "flex-1"}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-slate-800 dark:text-white">
                            {term.term} {term.year}
                          </h3>
                          {term.is_active && (
                            <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-full">
                              Active
                            </span>
                          )}
                          {term.start_date && term.end_date && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {new Date(term.start_date).toLocaleDateString("en-US", { month: "short" })} – {new Date(term.end_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            {term.session_count || 0} {sectionCopy.pluralLower}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {term.total_students || 0} students
                          </span>
                        </div>
                        {Array.isArray(term.courses) && term.courses.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {term.courses.map((c) => (
                              <span
                                key={c.id}
                                className="inline-flex items-center rounded-md bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300"
                                title={c.course_code}
                              >
                                {c.course_title || c.course_code}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 opacity-70 sm:opacity-100 transition-opacity flex-wrap justify-end">
                        {!term.is_active && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={activatingTermId === term.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleSetActiveTerm(term)
                            }}
                            className="h-8 rounded-lg text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-600 dark:text-emerald-400"
                          >
                            {activatingTermId === term.id ? "Setting…" : "Set active"}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditTermDialog(term)
                          }}
                          className="h-8 w-8 p-0 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openDeleteTermDialog(term)
                          }}
                          className="h-8 w-8 p-0 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 rounded-lg"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
        </section>

        {/* Course sections (instructors call these Sections) */}
        <section className="space-y-4 rounded-xl sm:rounded-2xl border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.02] p-4 sm:p-5">
          <PanelHeader
            title={sectionCopy.plural}
            subtitle={sectionsPanelSubtitle}
            action={
              <PanelAddButton
                label={`Add ${sectionSingularProper}`}
                shortLabel="Section"
                onClick={openAddSessionDialog}
                disabled={!selectedTerm}
              />
            }
          />

          {!selectedTerm ? (
            <div className="rounded-xl p-8 text-center border border-slate-200/60 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="p-4 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Select a term to view its sections.</p>
            </div>
          ) : (
            <>
              {sessions.length > 0 && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 md:gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.08]">
                      <div className="relative w-full sm:flex-1 sm:min-w-[140px] sm:max-w-none md:max-w-[220px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder={`Search ${sectionCopy.pluralLower}...`}
                          value={sessionsView.search}
                          onChange={(e) => setSessionsView((prev) => ({ ...prev, search: e.target.value }))}
                          className="pl-8 h-9 rounded-lg text-sm border-slate-200 dark:border-white/10"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-9 rounded-lg gap-1.5 text-slate-600 dark:text-slate-400">
                            <ArrowUpDown className="h-3.5 w-3.5" />
                            Sort
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-44">
                          {(["code", "students", "date"] as const).map((key) => (
                            <DropdownMenuItem
                              key={key}
                              onClick={() =>
                                setSessionsView((prev) => ({
                                  ...prev,
                                  sortBy: key,
                                  sortDir: prev.sortBy === key && prev.sortDir === "asc" ? "desc" : "asc",
                                }))
                              }
                              className="capitalize"
                            >
                              {key === "code" ? "Code" : key === "students" ? "Students" : "Date"}
                              {sessionsView.sortBy === key && (
                                <span className="ml-auto">{sessionsView.sortDir === "asc" ? <ArrowUp className="h-3.5" /> : <ArrowDown className="h-3.5" />}</span>
                              )}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <div className="flex items-center gap-1 border rounded-lg p-1 border-slate-200 dark:border-white/10">
                        <Button
                          variant={sessionsView.viewMode === "list" ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => setSessionsView((prev) => ({ ...prev, viewMode: "list" }))}
                          className="h-7 w-7 p-0 rounded-md"
                          title="List view"
                        >
                          <List className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant={sessionsView.viewMode === "grid" ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => setSessionsView((prev) => ({ ...prev, viewMode: "grid" }))}
                          className="h-7 w-7 p-0 rounded-md"
                          title="Grid view"
                        >
                          <LayoutGrid className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 sm:ml-auto">
                        {displayedSessions.length} of {sessions.length}
                      </span>
                      </div>
                    </div>
                  )}

                  {sessions.length === 0 ? (
                    <>
                      {userType === "instructor" && sectionsElsewhere.length > 0 && selectedTerm && (
                        <div className="rounded-xl border border-amber-200/80 dark:border-amber-500/40 bg-amber-50/90 dark:bg-amber-500/10 p-4 sm:p-5 mb-4 text-left">
                          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                            {sectionsElsewhere.length} section{sectionsElsewhere.length === 1 ? "" : "s"} for this course
                            are not linked to{" "}
                            <span className="font-mono">
                              {selectedTerm.term} {selectedTerm.year}
                            </span>
                          </p>
                          <p className="text-xs text-amber-900/85 dark:text-amber-200/90 mt-1 mb-3">
                            Link them here so they appear for this term and in student login for the course you selected
                            in the top bar.
                          </p>
                          <ul className="space-y-2">
                            {sectionsElsewhere.map((s) => {
                              const canonical =
                                displayCourseCodeForSections && s.code.toUpperCase() !== "BETA"
                                  ? canonicalSectionLabel(displayCourseCodeForSections, s.code)
                                  : s.code
                              return (
                                <li
                                  key={s.id}
                                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-amber-200/60 dark:border-amber-500/25 bg-white/70 dark:bg-slate-900/40 px-3 py-2.5"
                                >
                                  <div className="min-w-0">
                                    <div className="font-mono font-medium text-slate-900 dark:text-slate-100">
                                      {canonical}
                                    </div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400">
                                      Stored: <span className="font-mono">{s.code}</span>
                                      {" · "}
                                      Currently: {termLabelForId(s.academic_term_id)}
                                      {typeof s.student_count === "number" ? (
                                        <>
                                          {" · "}
                                          {s.student_count} student{s.student_count === 1 ? "" : "s"}
                                        </>
                                      ) : null}
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="shrink-0 bg-amber-700 hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500 text-white"
                                    disabled={assigningSectionId === s.id}
                                    onClick={() => void linkSectionToSelectedTerm(s)}
                                  >
                                    {assigningSectionId === s.id ? (
                                      <span className="flex items-center gap-2">
                                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                        Linking…
                                      </span>
                                    ) : (
                                      <>
                                        Link to {selectedTerm.term} {selectedTerm.year}
                                      </>
                                    )}
                                  </Button>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                      <Card className="border-slate-200/60 dark:border-white/[0.08] rounded-xl sm:rounded-2xl p-8 sm:p-12 text-center bg-white/80 dark:bg-white/[0.02]">
                      <div className="p-4 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                        <BookOpen className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                      </div>
                      <p className="text-slate-700 dark:text-slate-200 mb-2 text-sm font-medium">
                        No {sectionCopy.pluralLower} for{" "}
                        <span className="font-mono text-violet-700 dark:text-violet-300">
                          {sessionsScopeCourse?.course_code || displayCourseCodeForSections || "this course"}
                        </span>{" "}
                        in {selectedTerm.term} {selectedTerm.year}.
                      </p>
                      {userType === "instructor" && sectionsElsewhere.length > 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-lg mx-auto leading-relaxed">
                          Use{" "}
                          <span className="font-medium text-slate-700 dark:text-slate-200">Link to {selectedTerm.term}</span>{" "}
                          above, or add a new short code (e.g.{" "}
                          <code className="font-mono px-1">P02</code>).
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-lg mx-auto leading-relaxed">
                          Sections are stored as short codes (often <code className="font-mono px-1">P01</code>,{" "}
                          <code className="font-mono px-1">P02</code>, …) under this term. Example label for students:{" "}
                          <code className="font-mono text-slate-700 dark:text-slate-200">
                            {displayCourseCodeForSections
                              ? canonicalSectionLabel(displayCourseCodeForSections, "P01")
                              : "ELEG1304P01"}
                          </code>
                          . If you already created <code className="font-mono">P01</code> under another term, select that
                          term on the left—or link it here when this page shows it in the amber box.
                        </p>
                      )}
                      <Button
                        onClick={openAddSessionDialog}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create First {sectionSingularProper}
                      </Button>
                    </Card>
                    </>
                  ) : displayedSessions.length === 0 ? (
                    <div className="rounded-xl p-8 text-center border border-slate-200/60 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.02]">
                      <p className="text-slate-500 dark:text-slate-400">
                        No {sectionCopy.pluralLower} match your search.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSessionsView((prev) => ({ ...prev, search: "" }))}
                        className="mt-3 rounded-lg"
                      >
                        Clear search
                      </Button>
                    </div>
                  ) : (
                    <div className={sessionsView.viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3" : "space-y-2"}>
                      {displayedSessions.map((session) => {
                        const canonical =
                          displayCourseCodeForSections && session.code.toUpperCase() !== "BETA"
                            ? canonicalSectionLabel(displayCourseCodeForSections, session.code)
                            : session.code
                        const storedNorm = session.code.replace(/\s+/g, "").toUpperCase()
                        const canonicalNorm = canonical.replace(/\s+/g, "").toUpperCase()
                        const showStoredCode =
                          session.code.toUpperCase() !== "BETA" && storedNorm !== canonicalNorm

                        return (
                        <div
                          key={session.id}
                          className={`group flex rounded-xl px-4 py-3.5 border transition-all ${
                            sessionsView.viewMode === "grid"
                              ? "flex-col gap-3 border-slate-200/60 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.02] hover:border-blue-300/50 hover:bg-slate-50/80 dark:hover:bg-white/5"
                              : "items-center gap-4 border-l-4 border-l-transparent border-slate-200/60 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.02] hover:border-l-blue-400 hover:border-slate-300/60 dark:hover:border-white/10 hover:bg-slate-50/80 dark:hover:bg-white/5"
                          }`}
                        >
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/20 ${sessionsView.viewMode === "grid" ? "self-start" : ""}`}>
                            <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className={`min-w-0 ${sessionsView.viewMode === "grid" ? "w-full" : "flex-1"}`}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-mono font-semibold text-slate-800 dark:text-white tracking-tight">
                                {canonical}
                              </h3>
                              {session.code.toUpperCase() === "BETA" && (
                                <span className="text-xs text-slate-500 dark:text-slate-400 italic">Standalone</span>
                              )}
                            </div>
                            {showStoredCode ? (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                                Stored code: {session.code}
                              </p>
                            ) : null}
                            {session.description ? (
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{session.description}</p>
                            ) : null}
                            <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                <span className="font-medium text-blue-600 dark:text-blue-400">{session.student_count}</span>
                                students
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(session.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            </div>
                          </div>
                          {session.code.toUpperCase() !== "BETA" && (
                            <div className="flex items-center gap-2 shrink-0 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditSessionDialog(session)}
                                className="h-8 w-8 p-0 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDeleteSessionDialog(session)}
                                className="h-8 w-8 p-0 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 rounded-lg"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                        )
                      })}
                    </div>
                  )}
            </>
          )}
        </section>
      </div>

      {/* Add Term Dialog */}
      <Dialog open={showAddTermDialog} onOpenChange={setShowAddTermDialog}>
        <DialogContent className="rounded-2xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Add Academic Term</DialogTitle>
            <DialogDescription>Create a new academic term (e.g., Fall 2025, Spring 2026)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="year">Year *</Label>
                <Input
                  id="year"
                  type="number"
                  value={termFormData.year}
                  onChange={(e) => setTermFormData({ ...termFormData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="term">Term *</Label>
                <Select value={termFormData.term} onValueChange={(value) => setTermFormData({ ...termFormData, term: value })}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fall">Fall</SelectItem>
                    <SelectItem value="Spring">Spring</SelectItem>
                    <SelectItem value="Summer">Summer</SelectItem>
                    <SelectItem value="Winter">Winter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={termFormData.start_date}
                  onChange={(e) => setTermFormData({ ...termFormData, start_date: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={termFormData.end_date}
                  onChange={(e) => setTermFormData({ ...termFormData, end_date: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTermDialog(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleAddTerm} disabled={submitting} className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl">
              {submitting ? "Creating..." : "Create Term"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Term Dialog */}
      <Dialog open={showEditTermDialog} onOpenChange={setShowEditTermDialog}>
        <DialogContent className="rounded-2xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Edit Academic Term</DialogTitle>
            <DialogDescription>Update academic term details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-year">Year *</Label>
                <Input
                  id="edit-year"
                  type="number"
                  value={termFormData.year}
                  onChange={(e) => setTermFormData({ ...termFormData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-term">Term *</Label>
                <Select value={termFormData.term} onValueChange={(value) => setTermFormData({ ...termFormData, term: value })}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fall">Fall</SelectItem>
                    <SelectItem value="Spring">Spring</SelectItem>
                    <SelectItem value="Summer">Summer</SelectItem>
                    <SelectItem value="Winter">Winter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-start_date">Start Date</Label>
                <Input
                  id="edit-start_date"
                  type="date"
                  value={termFormData.start_date}
                  onChange={(e) => setTermFormData({ ...termFormData, start_date: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end_date">End Date</Label>
                <Input
                  id="edit-end_date"
                  type="date"
                  value={termFormData.end_date}
                  onChange={(e) => setTermFormData({ ...termFormData, end_date: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditTermDialog(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleEditTerm} disabled={submitting} className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl">
              {submitting ? "Updating..." : "Update Term"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Term Dialog */}
      <AlertDialog open={showDeleteTermDialog} onOpenChange={setShowDeleteTermDialog}>
        <AlertDialogContent className="rounded-2xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Academic Term?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the academic term{" "}
              <strong>
                {selectedTerm?.term} {selectedTerm?.year}
              </strong>{" "}
              and all associated {sectionCopy.pluralLower}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTerm}
              disabled={submitting}
              className="bg-gradient-to-r from-red-600 to-pink-600 rounded-xl"
            >
              {submitting ? "Deleting..." : "Delete Term"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Session Dialog */}
      <Dialog open={showAddSessionDialog} onOpenChange={setShowAddSessionDialog}>
        <DialogContent className="rounded-2xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Add New Session</DialogTitle>
            <DialogDescription>Create a new course section for {selectedTerm?.term} {selectedTerm?.year}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-code">{sectionSingularProper} code *</Label>
              <Input
                id="add-code"
                placeholder="e.g., P01"
                value={sessionFormData.code}
                onChange={(e) => setSessionFormData({ ...sessionFormData, code: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-description">Description</Label>
              <Textarea
                id="add-description"
                placeholder="Optional description"
                value={sessionFormData.description}
                onChange={(e) => setSessionFormData({ ...sessionFormData, description: e.target.value })}
                className="rounded-xl min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSessionDialog(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleAddSession} disabled={submitting} className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl">
              {submitting ? "Creating..." : `Create ${sectionSingularProper}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Session Dialog */}
      <Dialog open={showEditSessionDialog} onOpenChange={setShowEditSessionDialog}>
        <DialogContent className="rounded-2xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Edit Session</DialogTitle>
            <DialogDescription>Update session details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-code">{sectionSingularProper} code *</Label>
              <Input
                id="edit-code"
                placeholder="e.g., P01"
                value={sessionFormData.code}
                onChange={(e) => setSessionFormData({ ...sessionFormData, code: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Optional description"
                value={sessionFormData.description}
                onChange={(e) => setSessionFormData({ ...sessionFormData, description: e.target.value })}
                className="rounded-xl min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditSessionDialog(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleEditSession} disabled={submitting} className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl">
              {submitting ? "Updating..." : `Update ${sectionSingularProper}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete section / session dialog */}
      <AlertDialog open={showDeleteSessionDialog} onOpenChange={setShowDeleteSessionDialog}>
        <AlertDialogContent className="rounded-2xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {sectionSingularProper}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {sectionCopy.singular}{" "}
              <strong>{selectedSession?.code}</strong> and all{" "}
              <strong>{selectedSession?.student_count}</strong> student(s). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSession}
              disabled={submitting}
              className="bg-gradient-to-r from-red-600 to-pink-600 rounded-xl"
            >
              {submitting ? "Deleting..." : `Delete ${sectionSingularProper}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </>
  )
}



