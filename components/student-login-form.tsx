"use client"

import type React from "react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import {
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  CheckCircle,
  UserPlus,
  ListChecks,
  Lock,
  LogIn,
} from "lucide-react"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { setStudentSession } from "@/lib/auth"
import { resolveStudentPostLoginPath, syncAppearanceSetupFromServer } from "@/lib/appearance/appearance-setup"
import { MfaLoginStep, parseMfaLoginResponse, type MfaLoginState } from "@/components/auth/MfaLoginStep"
import { formatStudentLoginErrorMessage } from "@/lib/student-login-errors"
import {
  formatCourseDefaultPasswordHint,
  getStudentRosterDefaultPassword,
} from "@/lib/student-roster-default-password"
import { normalizeGuestOnboardingPurpose } from "@/lib/guest/onboarding"
import { CAREER_MEMBER_LABEL } from "@/lib/guest/display"
import { appendNativeAppQuery } from "@/lib/mobile-native-app"
import { useNativeApp } from "@/hooks/use-native-app"
import { cn } from "@/lib/utils"
import { courseUsesLabSections } from "@/lib/course-section-model"
import {
  parseAccessLifecycleFromLoginError,
} from "@/components/auth/AccessRequestStatusPanel"
import { redirectToAccessStatusPage } from "@/lib/access-governance/access-status-session"

interface Session {
  id: number
  code: string
}

interface CourseOption {
  id: number
  course_code: string
  course_title: string
  university: string | null
  semester: string | null
}

interface RosterStudent {
  id: number
  student_id: string
  full_name: string
}

interface StudentLoginFormProps {
  defaultTab?: "guest" | "roster"
  className?: string
  /** Native shell — hide duplicate chrome; links keep ?native=1 */
  nativeApp?: boolean
}

export function StudentLoginForm({
  defaultTab = "roster",
  className,
  nativeApp = false,
}: StudentLoginFormProps = {} as StudentLoginFormProps) {
  const router = useRouter()
  const detectedNative = useNativeApp()
  const isNative = nativeApp || detectedNative
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [mfaState, setMfaState] = useState<MfaLoginState | null>(null)
  const [formData, setFormData] = useState({
    fullName: "",
    studentId: "",
    section: "",
    password: "",
    email: "",
  })

  const [accountRequestSubmitted, setAccountRequestSubmitted] = useState(false)

  const [courses, setCourses] = useState<CourseOption[]>([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [selectedCourseId, setSelectedCourseId] = useState("")

  const [sessions, setSessions] = useState<Session[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)

  /** Lecture/lab sections only (excludes BETA); beta testers enroll in a real section with `beta_user`. */
  const lectureSessions = useMemo(
    () => sessions.filter((s) => String(s.code).trim().toUpperCase() !== "BETA"),
    [sessions],
  )

  const [rosterSessionId, setRosterSessionId] = useState("")
  const [rosterStudents, setRosterStudents] = useState<RosterStudent[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState("")
  const [loadingRoster, setLoadingRoster] = useState(false)

  const [showPassword, setShowPassword] = useState(false)

  const selectedCourse = courses.find((c) => String(c.id) === selectedCourseId)

  const usesLabSections = courseUsesLabSections(selectedCourse?.course_code)

  /** ECE 2202 has no P-sections; skip the section step even though a roster session exists. */
  const showSectionStep = usesLabSections && lectureSessions.length > 0

  const rosterDefaultPassword = useMemo(
    () => getStudentRosterDefaultPassword(selectedCourse?.course_code),
    [selectedCourse?.course_code],
  )

  const rosterPasswordCourseLabel = useMemo(
    () => formatCourseDefaultPasswordHint(selectedCourse?.course_code, selectedCourse?.course_title),
    [selectedCourse?.course_code, selectedCourse?.course_title],
  )

  const fetchRoster = useCallback(
    async (sessionId: string) => {
      setLoadingRoster(true)
      setError("")
      try {
        const response = await fetch(
          `/api/student/sessions/${sessionId}/students?courseId=${encodeURIComponent(selectedCourseId)}`,
          { headers: { "x-coursecollab-legacy-login": "1" } },
        )
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Failed to fetch roster")
        setRosterStudents(data.students)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load roster")
        setRosterStudents([])
      } finally {
        setLoadingRoster(false)
      }
    },
    [selectedCourseId],
  )

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const response = await fetch("/api/student/courses", {
          headers: { "x-coursecollab-legacy-login": "1" },
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Failed to fetch courses")
        setCourses(data.courses || [])
        setError("")
      } catch {
        setError("Failed to load courses. Please refresh the page.")
      } finally {
        setLoadingCourses(false)
      }
    }
    void loadCourses()
  }, [])

  useEffect(() => {
    if (!selectedCourseId) {
      setSessions([])
      setRosterSessionId("")
      setRosterStudents([])
      setSelectedStudentId("")
      return
    }
    const loadSessions = async () => {
      setLoadingSessions(true)
      setRosterSessionId("")
      setRosterStudents([])
      setSelectedStudentId("")
      setError("")
      try {
        const response = await fetch(`/api/student/sessions?courseId=${encodeURIComponent(selectedCourseId)}`, {
          headers: { "x-coursecollab-legacy-login": "1" },
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Failed to fetch sections")
        setSessions(data.sessions)
      } catch {
        setError("Failed to load sections for this course.")
        setSessions([])
      } finally {
        setLoadingSessions(false)
      }
    }
    void loadSessions()
  }, [selectedCourseId])

  useEffect(() => {
    if (!selectedCourseId || loadingSessions) return
    if (lectureSessions.length === 0) {
      setRosterSessionId("")
      return
    }
    if (lectureSessions.length === 1) {
      setRosterSessionId(String(lectureSessions[0].id))
      return
    }
    setRosterSessionId((prev) =>
      prev && lectureSessions.some((s) => s.id.toString() === prev) ? prev : "",
    )
  }, [selectedCourseId, lectureSessions, loadingSessions])

  useEffect(() => {
    if (!selectedCourseId || loadingSessions) return
    if (lectureSessions.length === 1) {
      setFormData((fd) => ({ ...fd, section: lectureSessions[0].code }))
      return
    }
    if (lectureSessions.length > 1) {
      setFormData((fd) => {
        if (fd.section && !lectureSessions.some((s) => s.code === fd.section)) {
          return { ...fd, section: "" }
        }
        return fd
      })
      return
    }
    setFormData((fd) => ({ ...fd, section: "" }))
  }, [lectureSessions, selectedCourseId, loadingSessions])

  useEffect(() => {
    if (rosterSessionId) {
      fetchRoster(rosterSessionId)
    } else {
      setRosterStudents([])
      setSelectedStudentId("")
    }
  }, [rosterSessionId, selectedCourseId, fetchRoster])
  const handleLogin = async (data: any) => {
    const s = data.student
    const isGuest = Boolean(s.is_platform_guest)
    const guestPurpose = isGuest
      ? normalizeGuestOnboardingPurpose(s.guest_access_purpose)
      : undefined

    setStudentSession({
      id: s.student_id,
      name: s.full_name,
      section: s.section,
      databaseId: s.id.toString(),
      courseId: s.course_id != null ? Number(s.course_id) : selectedCourse?.id,
      courseCode: selectedCourse?.course_code,
      courseTitle: selectedCourse?.course_title,
      ...(isGuest ? { isPlatformGuest: true as const, guestAccessPurpose: guestPurpose } : {}),
    })

    const membershipTier =
      data.effectiveMembershipTier || s.membership_tier || "Scholar"
    sessionStorage.setItem("studentMembershipTier", membershipTier)
    localStorage.setItem("studentMembershipTier", membershipTier)

    if (data.hasApprovedResetRequest) {
      sessionStorage.setItem("resetRequestId", data.resetRequestId)
      router.push("/student/reset-password")
      return
    }

    sessionStorage.removeItem("showTrialModal")
    sessionStorage.removeItem("trialActivated")

    if (isGuest) {
      router.push("/guest")
      return
    }

    if (!data.student.has_changed_password) {
      router.push("/student/change-password?firstLogin=true")
    } else {
      const appearanceSetupCompleted = await syncAppearanceSetupFromServer(String(s.id))
      router.push(
        resolveStudentPostLoginPath({
          studentDbId: String(s.id),
          hasChangedPassword: true,
          appearanceSetupCompleted,
        }),
      )
    }
  }

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!selectedCourseId) {
      setError("Select your course first.")
      return
    }
    const sectionsForCourse = sessions.filter((s) => String(s.code).trim().toUpperCase() !== "BETA")
    if (sectionsForCourse.length === 0 && usesLabSections) {
      setError("This course has no lecture sections yet. Contact your instructor.")
      return
    }
    if (showSectionStep && sectionsForCourse.length > 1 && !formData.section.trim()) {
      setError("Select your lecture section.")
      return
    }
    setLoading(true)

    try {
      const response = await fetch("/api/student/request-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.fullName,
          studentId: formData.studentId,
          section: sectionsForCourse[0]?.code ?? formData.section,
          email: formData.email,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to submit account request")

      setAccountRequestSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleRosterLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const sectionsForCourse = sessions.filter((s) => String(s.code).trim().toUpperCase() !== "BETA")
    if (sectionsForCourse.length === 0 && usesLabSections) {
      setError("This course has no lecture sections yet. Contact your instructor.")
      return
    }
    if (showSectionStep && sectionsForCourse.length > 1 && !rosterSessionId) {
      setError("Select your lecture section.")
      return
    }
    if (!selectedStudentId) {
      setError("Please select your name from the roster")
      return
    }
    if (!selectedCourseId) {
      setError("Select your course first.")
      return
    }
    if (!formData.password) {
      setError("Please enter your password")
      return
    }

    setLoading(true)
    setError("")
    try {
      const selectedStudent = rosterStudents.find((s) => s.id.toString() === selectedStudentId)
      if (!selectedStudent) throw new Error("Selected student not found")

      const resolvedSession =
        sectionsForCourse.length === 1
          ? sectionsForCourse[0]
          : sectionsForCourse.find((s) => s.id.toString() === rosterSessionId)
      if (!resolvedSession) {
        throw new Error("Could not resolve section for login.")
      }

      const response = await fetch("/api/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: selectedStudent.full_name,
          studentId: selectedStudent.student_id,
          section: resolvedSession.code,
          password: formData.password,
          courseId: Number(selectedCourseId),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        const lifecycle = parseAccessLifecycleFromLoginError(data)
        if (lifecycle && redirectToAccessStatusPage(router, lifecycle)) {
          return
        }
        throw new Error(formatStudentLoginErrorMessage(data))
      }
      const mfa = parseMfaLoginResponse(data as Record<string, unknown>)
      if (mfa) {
        setMfaState(mfa)
        return
      }
      handleLogin(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    "w-full min-w-0 max-w-full rounded-xl border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 dark:focus:border-violet-500 transition-colors"
  /** SelectTrigger defaults to w-fit in ui/select — force full width + truncation for long labels. */
  const selectTriggerClass = cn(
    inputClass,
    "flex overflow-hidden text-left [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate",
  )
  /** Popper content: never wider than viewport on narrow screens. */
  const selectContentPopperClass =
    "rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800 max-w-[calc(100vw-2rem)] sm:max-w-[var(--radix-select-trigger-width)]"
  const labelClass = "text-sm font-medium text-slate-700 dark:text-slate-300 min-w-0"

  const canPickRosterName =
    Boolean(selectedCourseId) &&
    !loadingSessions &&
    lectureSessions.length > 0 &&
    (!showSectionStep || lectureSessions.length === 1 || Boolean(rosterSessionId))
  /** Pipeline steps 2+ (step 1 is course, above tabs). */
  const rosterSectionStep = 2
  const rosterNameStep = showSectionStep && lectureSessions.length > 1 ? 3 : 2
  const rosterPasswordStep = showSectionStep && lectureSessions.length > 1 ? 4 : 3
  /** New-account join form: course is step 1 above; section only for lab-section courses. */
  const joinSectionStep = 2
  const joinFullNameStep = showSectionStep ? 3 : 2
  const joinStudentIdStep = showSectionStep ? 4 : 3
  const joinEmailStep = showSectionStep ? 5 : 4

  const stepBadgeClass =
    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-500/30 text-violet-600 dark:text-violet-300 text-xs font-bold"

  if (mfaState) {
    return (
      <div className={className}>
        <MfaLoginStep
          state={mfaState}
          onBack={() => setMfaState(null)}
          onComplete={(data) => {
            setMfaState(null)
            void handleLogin(data)
          }}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-none overflow-hidden",
        className
      )}
    >
      <div
        className={cn(
          "px-4 sm:px-8 pt-8 pb-6 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 min-w-0 max-w-full",
        )}
      >
        <div className="flex justify-center mb-4">
          <CourseCollabLogo size="sm" />
        </div>
        <div className="text-balance px-1 sm:px-0 min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white text-center break-words">
          Student sign in
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-center text-sm mt-1 break-words">
          {selectedCourseId
            ? "Course selected — continue with roster or Career Member options below."
            : "Start with your course, then section (if needed), name, and password."}
        </p>
        {!selectedCourseId ? (
          <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium leading-snug break-words px-1">
            1 Course → 2 Section (if more than one) → 3 Your name → 4 Password
          </p>
        ) : null}
        </div>
      </div>

      <div className="p-4 sm:p-6 sm:p-8 min-w-0">
        <div
          id="student-login-course"
          className="rounded-2xl border-2 border-violet-300/70 dark:border-violet-500/40 bg-violet-50/50 dark:bg-violet-500/10 p-4 sm:p-5 mb-6 space-y-3 scroll-mt-4 min-w-0"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white text-xs font-bold shadow-sm dark:bg-violet-500">
                1
              </span>
              <Label className={cn(labelClass, "mb-0")}>Course</Label>
            </div>
            {selectedCourseId ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedCourseId("")
                  setError("")
                }}
                className="text-xs font-medium text-violet-700 dark:text-violet-300 hover:underline"
              >
                Change course
              </button>
            ) : null}
          </div>
          <Select
            value={selectedCourseId || undefined}
            onValueChange={setSelectedCourseId}
            disabled={loadingCourses || (!loadingCourses && courses.length === 0)}
          >
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue placeholder={loadingCourses ? "Loading courses…" : "Select your course"} />
            </SelectTrigger>
            <SelectContent className={cn(selectContentPopperClass, "max-h-[min(320px,50vh)]")}>
              {courses.map((c) => (
                <SelectItem
                  key={c.id}
                  value={String(c.id)}
                  className="rounded-lg whitespace-normal break-words py-2"
                >
                  <span className="font-medium">{c.course_title}</span>
                  <span className="text-xs text-slate-500 ml-2">{c.course_code}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!loadingCourses && courses.length === 0 ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              No active courses are available for student login right now. Ask your instructor, or use Career Member access if
              you only need a recommendation letter.
            </p>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sections and the roster load only after you choose a course. Beta testers use a real section — there is
              no separate &quot;BETA&quot; section in this list.
            </p>
          )}
        </div>

        {error && !selectedCourseId ? (
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm p-3 whitespace-pre-line mb-4">
            {error}
          </div>
        ) : null}

        {!selectedCourseId ? (
          <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.03] p-5 space-y-4">
            <p className="text-sm font-medium text-slate-900 dark:text-white">Pick your course to continue</p>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Roster sign-in stays locked until step 1 is complete so you always land in the right class. If you are not
              enrolled and only need Career Member access (for example recommendation letters), use the link below — that path
              does not require a course.
            </p>
            <Button
              type="button"
              asChild
              variant="outline"
              className="w-full rounded-xl border-slate-200 dark:border-white/20"
            >
              <Link href={isNative ? appendNativeAppQuery("/student/login/guest") : "/student/login/guest"} className="flex items-center justify-center gap-2">
                <LogIn className="h-4 w-4" />
                {CAREER_MEMBER_LABEL} (no course required)
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <Tabs defaultValue={defaultTab} className="w-full min-w-0">
          <TabsList className="grid grid-cols-2 w-full min-w-0 h-auto p-1 sm:p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 gap-1">
            <TabsTrigger
              value="roster"
              className="rounded-xl py-2.5 sm:py-3 px-2 sm:px-4 min-w-0 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-300 data-[state=active]:border data-[state=active]:border-slate-200/80 dark:data-[state=active]:border-white/20 font-medium text-slate-600 dark:text-slate-400 transition-all text-xs sm:text-sm"
            >
              <span className="flex items-center justify-center gap-1 sm:gap-2 min-w-0">
                <ListChecks className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="truncate">Roster</span>
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="guest"
              className="rounded-xl py-2.5 sm:py-3 px-2 sm:px-4 min-w-0 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-300 data-[state=active]:border data-[state=active]:border-slate-200/80 dark:data-[state=active]:border-white/20 font-medium text-slate-600 dark:text-slate-400 transition-all text-xs sm:text-sm"
            >
              <span className="flex items-center justify-center gap-1 sm:gap-2 min-w-0">
                <LogIn className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="truncate">{CAREER_MEMBER_LABEL}</span>
              </span>
            </TabsTrigger>
          </TabsList>

          {/* Guest tab: external users + optional enrolled join request */}
          <TabsContent value="guest" className="mt-6 focus-visible:outline-none space-y-6 min-w-0">
            <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.03] p-4 sm:p-5 space-y-4">
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Not on the class roster?</h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Career Member login is for people who need platform access without a roster account—for example to request or
                  manage a recommendation letter. The course you chose above is for roster sign-in and the join form
                  below; the Career Member letter flow on the next page does not depend on it.
                </p>
              </div>
              <Button
                type="button"
                asChild
                className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600 text-white py-6 text-base font-semibold shadow-lg shadow-violet-900/20"
              >
                <Link href={isNative ? appendNativeAppQuery("/student/login/guest") : "/student/login/guest"} className="flex items-center justify-center gap-2">
                  Create a {CAREER_MEMBER_LABEL} account
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <details className="rounded-xl border border-slate-200/70 dark:border-white/10 bg-white/40 dark:bg-slate-900/30 px-3 sm:px-4 py-3 group open:pb-4 min-w-0 max-w-full">
              <summary className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer list-none flex items-center justify-between gap-2 min-w-0">
                <span className="flex items-center gap-2 min-w-0">
                  <UserPlus className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
                  <span className="min-w-0 break-words text-left">Enrolled but not imported yet?</span>
                </span>
                <span className="text-xs text-violet-600 dark:text-violet-400 transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 mb-4 leading-relaxed">
                If you have a school student ID and need an account for an active section, use this join form (not Career
                Member access).
              </p>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mb-4 font-medium leading-snug break-words">
                {showSectionStep
                  ? "1 Course (above) → 2 Section → 3 Full name → 4 Student ID → 5 Email"
                  : "1 Course (above) → 2 Full name → 3 Student ID → 4 Email"}
              </p>
              {accountRequestSubmitted ? (
                <div className="space-y-4 pt-1">
                  <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-500/10 p-4">
                    <div className="flex gap-3">
                      <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-emerald-800 dark:text-emerald-200 text-base mb-1">Request sent</h3>
                        <p className="text-sm text-emerald-700 dark:text-emerald-300/90 mb-2">
                          Your instructor will review it. You&apos;ll get an email with login details once approved.
                        </p>
                        <ul className="text-xs text-emerald-700 dark:text-emerald-300/80 space-y-1 list-disc list-inside">
                          <li>Review and approval by instructor</li>
                          <li>Email with credentials</li>
                          <li>Change password on first login</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setAccountRequestSubmitted(false)
                      setFormData({ fullName: "", studentId: "", section: "", email: "", password: "" })
                    }}
                    variant="outline"
                    className="w-full rounded-xl border-slate-200 dark:border-white/20"
                  >
                    Submit another request
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleStandardLogin} className="space-y-4 min-w-0">
                  {showSectionStep ? (
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={stepBadgeClass}>{joinSectionStep}</span>
                      <Label htmlFor="joinSection" className={labelClass}>
                        Lecture section
                      </Label>
                    </div>
                    {lectureSessions.length === 0 ? (
                      <div className="w-full min-w-0 sm:pl-8">
                        <p className="text-xs text-amber-700 dark:text-amber-300 break-words">
                          No lecture sections for this course yet. Ask your instructor to add your section before you
                          submit a join request.
                        </p>
                      </div>
                    ) : lectureSessions.length === 1 ? (
                      <div className="w-full min-w-0 sm:pl-8">
                        <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.04] px-4 py-3 text-sm text-slate-700 dark:text-slate-300 break-words">
                          <span className="font-medium text-slate-900 dark:text-white">Section</span>{" "}
                          <span className="tabular-nums font-semibold">{lectureSessions[0].code}</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Only one section for this course — continue with your name and ID below.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full min-w-0 sm:pl-8">
                        <Select
                          value={formData.section}
                          onValueChange={(v) => setFormData({ ...formData, section: v })}
                          required
                          disabled={loading || loadingSessions || !selectedCourseId}
                        >
                          <SelectTrigger id="joinSection" className={selectTriggerClass}>
                            <SelectValue placeholder={loadingSessions ? "Loading…" : "Select section"} />
                          </SelectTrigger>
                          <SelectContent className={selectContentPopperClass}>
                            {lectureSessions.map((session) => (
                              <SelectItem key={session.id} value={session.code} className="rounded-lg">
                                {session.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  ) : lectureSessions.length === 0 ? (
                    <div className="rounded-xl border border-amber-200/80 dark:border-amber-500/40 bg-amber-50/80 dark:bg-amber-500/10 py-4 px-4 text-sm text-amber-900 dark:text-amber-100">
                      This course is not set up for student login yet. Contact your instructor.
                    </div>
                  ) : null}
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={stepBadgeClass}>{joinFullNameStep}</span>
                      <Label htmlFor="fullName" className={labelClass}>
                        Full name
                      </Label>
                    </div>
                    <div className="w-full min-w-0 sm:pl-8">
                      <Input
                        id="fullName"
                        placeholder="e.g. Jordan Smith"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        required
                        disabled={loading}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={stepBadgeClass}>{joinStudentIdStep}</span>
                      <Label htmlFor="studentId" className={labelClass}>
                        Student ID
                      </Label>
                    </div>
                    <div className="w-full min-w-0 sm:pl-8">
                      <Input
                        id="studentId"
                        placeholder="PVAMU # or Canvas SIS ID"
                        value={formData.studentId}
                        onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                        required
                        disabled={loading}
                        className={inputClass}
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 break-words">
                        Already on the roster? Use the <strong>Roster</strong> tab to sign in.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={stepBadgeClass}>{joinEmailStep}</span>
                      <Label htmlFor="email" className={labelClass}>
                        Email
                      </Label>
                    </div>
                    <div className="w-full min-w-0 sm:pl-8">
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        disabled={loading}
                        className={inputClass}
                      />
                      <p className="text-right mt-1.5">
                        <a
                          href={isNative ? appendNativeAppQuery("/student/forgot-password") : "/student/forgot-password"}
                          className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
                        >
                          Forgot password?
                        </a>
                      </p>
                    </div>
                  </div>
                  {error && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm p-3 whitespace-pre-line">
                      {error}
                    </div>
                  )}
                  <Button
                    type="submit"
                    disabled={loading || lectureSessions.length === 0}
                    className="w-full rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-violet-600 dark:hover:bg-violet-700 text-white py-3 text-sm font-semibold"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Submitting…
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Join CourseCollab
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    )}
                  </Button>
                </form>
              )}
            </details>
          </TabsContent>

          {/* Roster login - stepped feel */}
          <TabsContent value="roster" className="mt-6 focus-visible:outline-none min-w-0">
            <Alert className="mb-5 rounded-xl border-violet-200/60 dark:border-violet-500/30 bg-violet-50/80 dark:bg-violet-500/10 text-slate-700 dark:text-slate-300">
              <AlertCircle className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
              <AlertDescription className="text-xs sm:text-sm space-y-2">
                {selectedCourseId ? (
                  <p>
                    First time on the roster for{" "}
                    <span className="font-medium text-violet-900 dark:text-violet-100">
                      {rosterPasswordCourseLabel}
                    </span>
                    ? Unless your instructor or syllabus says otherwise, the default password is{" "}
                    <code className="rounded-md bg-violet-100/90 dark:bg-violet-500/20 px-1.5 py-0.5 font-mono text-[0.8125rem] font-semibold text-violet-900 dark:text-violet-100">
                      {rosterDefaultPassword}
                    </code>
                    . You&apos;ll be prompted to change it after login.
                  </p>
                ) : (
                  <p>
                    Select your course above to see the default roster password for that class. ELEG courses typically
                    use <code className="font-mono font-semibold">ELEG2026!</code>; ECE 2202 uses{" "}
                    <code className="font-mono font-semibold">ECE2202!</code>.
                  </p>
                )}
              </AlertDescription>
            </Alert>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mb-5 font-medium leading-snug break-words">
              {showSectionStep
                ? "1 Course (above) → 2 Section (if more than one) → 3 Your name on the roster → 4 Password"
                : "1 Course (above) → 2 Your name on the roster → 3 Password"}
            </p>
            <form onSubmit={handleRosterLogin} className="space-y-5 min-w-0">
              {selectedCourseId && !loadingSessions && lectureSessions.length === 0 ? (
                <div className="rounded-xl border border-amber-200 dark:border-amber-500/40 bg-amber-50/80 dark:bg-amber-500/10 py-4 px-4 text-sm text-amber-900 dark:text-amber-100">
                  This course has no lecture sections in the system yet. Ask your instructor to add sections, then try
                  again.
                </div>
              ) : null}

              {showSectionStep && lectureSessions.length > 1 ? (
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={stepBadgeClass}>
                      {rosterSectionStep}
                    </span>
                    <Label htmlFor="rosterSession" className={labelClass}>
                      Lecture / lab section
                    </Label>
                  </div>
                  <Select
                    value={rosterSessionId}
                    onValueChange={setRosterSessionId}
                    required
                    disabled={loading || loadingSessions || !selectedCourseId}
                  >
                    <SelectTrigger id="rosterSession" className={selectTriggerClass}>
                      <SelectValue placeholder={loadingSessions ? "Loading…" : "Select your section"} />
                    </SelectTrigger>
                    <SelectContent className={cn(selectContentPopperClass, "max-h-[min(320px,50vh)]")}>
                      {lectureSessions.map((session) => (
                        <SelectItem key={session.id} value={session.id.toString()} className="rounded-lg">
                          {session.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : showSectionStep && lectureSessions.length === 1 ? (
                <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.04] px-4 py-3 text-sm text-slate-700 dark:text-slate-300 min-w-0 break-words">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={stepBadgeClass}>
                      {rosterSectionStep}
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">Section</span>{" "}
                    <span className="tabular-nums font-semibold">{lectureSessions[0].code}</span>
                  </div>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 pl-8">
                    Only one section for this course — you&apos;ll pick your name next.
                  </span>
                </div>
              ) : null}

              {canPickRosterName ? (
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={stepBadgeClass}>
                      {rosterNameStep}
                    </span>
                    <Label className={labelClass}>Your name</Label>
                  </div>
                  {loadingRoster ? (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 py-4 text-center text-sm text-slate-500">
                      Loading roster…
                    </div>
                  ) : rosterStudents.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-500/40 bg-amber-50/80 dark:bg-amber-500/10 py-4 px-4 text-sm text-amber-800 dark:text-amber-200">
                      No students in this section. Contact your instructor.
                    </div>
                  ) : (
                    <Select value={selectedStudentId} onValueChange={setSelectedStudentId} required>
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Select your name" />
                      </SelectTrigger>
                      <SelectContent className={cn(selectContentPopperClass, "max-h-[60vh]")}>
                        {rosterStudents.map((s) => (
                          <SelectItem key={s.id} value={s.id.toString()} className="rounded-lg whitespace-normal break-words py-2">
                            {s.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : null}

              {selectedStudentId ? (
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={stepBadgeClass}>
                      {rosterPasswordStep}
                    </span>
                    <Label className={labelClass}>Password</Label>
                  </div>
                  <div className="relative min-w-0">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      className={cn(inputClass, "pl-10 pr-10")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-right">
                    <a
                      href={isNative ? appendNativeAppQuery("/student/forgot-password") : "/student/forgot-password"}
                      className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      Forgot password?
                    </a>
                  </p>
                </div>
              ) : null}

              {error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm p-3 whitespace-pre-line">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !selectedStudentId || lectureSessions.length === 0}
                className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600 text-white shadow-lg shadow-violet-900/20 py-4 text-base font-semibold transition-all hover:shadow-violet-900/30 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Signing in…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Continue to CourseCollab
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
        )}
      </div>
    </div>
  )
}
