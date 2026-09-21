"use client"

import { canonicalSessionCode } from "@/lib/session-code-aliases"
import { isSummerProgramRole } from "@/lib/summer-camp/program-roles"
import { clearRememberedStudentAuth } from "@/lib/remembered-auth"
import {
  STUDENT_SKIP_SESSION_RESTORE_KEY,
  markStudentExplicitSignOut,
} from "@/lib/student-session-restore-client"
import { forceExpiredSessionLogout, logoutOnUnauthorizedResponse } from "@/lib/session-expiry-logout"
import { applyDesktopRefreshHeader } from "@/lib/desktop-refresh-token"
import { readFacultySession } from "@/lib/faculty-auth-flow"

interface SessionData {
  id: string
  name: string
  section: string
  databaseId?: string
  expiresAt: number
  rememberMe?: boolean
  universityId?: number
  universityName?: string
  universityShortName?: string
  isPlatformGuest?: boolean
  guestAccessPurpose?: import("@/lib/guest/types").GuestOnboardingPurpose
  isSummerCamper?: boolean
  studentProgramRole?: "regular" | "summer_camper" | "summer_student" | "platform_guest"
  courseId?: number
  courseCode?: string
  courseTitle?: string
  enrollments?: Array<{
    courseId: number
    courseCode: string
    courseTitle: string
    section?: string
    studentRowId?: number
    sessionId?: number | null
    academicTermId?: number | null
    academicTermLabel?: string | null
  }>
  hasChangedPassword?: boolean
}

interface AdminSessionData {
  id: string
  username: string
  name?: string
  platformRole?: string
  expiresAt: number
  /** Selected course scope for multi-course admin v2 */
  selectedCourseId?: number
  selectedCourseCode?: string
  selectedCourseTitle?: string
}

interface InstructorSessionData {
  id: number
  username: string
  email?: string
  name?: string
  role?: string
  assignedInstructorId?: number | null
  taPermissions?: Record<string, unknown>
  accountType?: "faculty"
  coursePermissions?: string[]
  staffRoleForCourse?: string | null
  loginTime?: string
  /** Selected course scope for multi-course installs */
  selectedCourseId?: number
  selectedCourseCode?: string
  selectedCatalogCourseCode?: string
  selectedCourseTitle?: string
  selectedSessionId?: number
  selectedSessionCode?: string
}

const SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 hours default sliding window
const REMEMBER_ME_DURATION = 30 * 24 * 60 * 60 * 1000 // 30 days
const EXTENDED_SESSION_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days without remember-me cookie

// Session management now relies on expiry checks and explicit logout functions

function sessionDurationFor(data: { rememberMe?: boolean }): number {
  return data.rememberMe ? REMEMBER_ME_DURATION : EXTENDED_SESSION_DURATION
}

function refreshSession(type: "student" | "admin") {
  try {
    const key = type === "student" ? "studentSession" : "adminSession"
    const sessionStr = localStorage.getItem(key)
    if (!sessionStr) return

    const session = JSON.parse(sessionStr)
    const duration =
      type === "student" ? sessionDurationFor({ rememberMe: session.rememberMe }) : SESSION_DURATION
    session.expiresAt = Date.now() + duration
    localStorage.setItem(key, JSON.stringify(session))
  } catch (error) {
    console.error(`[v0] Error refreshing ${type} session:`, error)
  }
}

function isSessionValid(expiresAt: number): boolean {
  return Date.now() < expiresAt
}

function normalizeStudentSectionForStorage(section: string): string {
  return canonicalSessionCode(String(section ?? "").trim())
}

function persistStudentSectionKeys(section: string) {
  sessionStorage.setItem("studentSection", section)
}

/** Sync sessionStorage from localStorage (WebView cold start clears sessionStorage). */
function hydrateStudentSessionStorage(session: SessionData) {
  const section = normalizeStudentSectionForStorage(session.section)
  sessionStorage.setItem("studentId", session.id)
  sessionStorage.setItem("studentName", session.name)
  persistStudentSectionKeys(section)
  if (session.databaseId) {
    sessionStorage.setItem("studentDatabaseId", session.databaseId)
  }
  if (session.studentProgramRole) {
    sessionStorage.setItem("studentProgramRole", session.studentProgramRole)
  }
}

/** Migrate stale sessionStorage/localStorage (e.g. ECE2202P01 → ECE2202). */
function syncStoredStudentSection(section: string, courseCode?: string) {
  const canonical = normalizeStudentSectionForStorage(section)
  persistStudentSectionKeys(canonical)
  try {
    const sessionStr = localStorage.getItem("studentSession")
    if (!sessionStr) return canonical
    const session = JSON.parse(sessionStr) as SessionData
    if (session.section !== canonical || (courseCode && session.courseCode !== courseCode)) {
      session.section = canonical
      if (courseCode) session.courseCode = courseCode
      localStorage.setItem("studentSession", JSON.stringify(session))
    }
  } catch {
    /* ignore */
  }
  return canonical
}

function setStudentSession(data: {
  id: string
  name: string
  section: string
  databaseId?: string
  rememberMe?: boolean
  universityId?: number
  universityName?: string
  universityShortName?: string
  isPlatformGuest?: boolean
  guestAccessPurpose?: import("@/lib/guest/types").GuestOnboardingPurpose
  isSummerCamper?: boolean
  studentProgramRole?: "regular" | "summer_camper" | "summer_student" | "platform_guest"
  courseId?: number
  courseCode?: string
  courseTitle?: string
  enrollments?: Array<{
    courseId: number
    courseCode: string
    courseTitle: string
    section?: string
    studentRowId?: number
    sessionId?: number | null
    academicTermId?: number | null
    academicTermLabel?: string | null
  }>
  hasChangedPassword?: boolean
}) {
  const section = normalizeStudentSectionForStorage(data.section)
  const sessionData: SessionData = {
    ...data,
    section,
    expiresAt: Date.now() + sessionDurationFor({ rememberMe: data.rememberMe }),
  }

  // Write to localStorage (new system with expiry)
  localStorage.setItem("studentSession", JSON.stringify(sessionData))

  hydrateStudentSessionStorage(sessionData)

  // Clear admin session when logging in as student
  localStorage.removeItem("adminSession")
  sessionStorage.removeItem("adminId")
  sessionStorage.removeItem("adminUsername")
}

function setAdminSession(data: {
  id: string
  username: string
  name?: string
  platformRole?: string
  selectedCourseId?: number
  selectedCourseCode?: string
  selectedCourseTitle?: string
}) {
  const sessionData: AdminSessionData = {
    ...data,
    expiresAt: Date.now() + SESSION_DURATION,
  }

  // Write to localStorage (new system with expiry)
  localStorage.setItem("adminSession", JSON.stringify(sessionData))
  localStorage.setItem("adminId", data.id)

  // Also write to sessionStorage for backwards compatibility
  sessionStorage.setItem("adminId", data.id)
  sessionStorage.setItem("adminUsername", data.username)
  if (data.name) sessionStorage.setItem("adminName", data.name)

  // Clear student session when logging in as admin
  localStorage.removeItem("studentSession")
  sessionStorage.removeItem("studentId")
  sessionStorage.removeItem("studentName")
  sessionStorage.removeItem("studentSection")
  sessionStorage.removeItem("studentDatabaseId")
}

/** Clear student session storage only (no redirect). Use when session expired on login page. */
function clearStudentSessionStorage() {
  localStorage.removeItem("studentSession")
  localStorage.removeItem("studentMembershipTier")
  sessionStorage.removeItem("studentId")
  sessionStorage.removeItem("studentName")
  sessionStorage.removeItem("studentSection")
  sessionStorage.removeItem("studentDatabaseId")
  sessionStorage.removeItem("studentMembershipTier")
  sessionStorage.removeItem("studentProgramRole")
  sessionStorage.removeItem("codebench_access_v2")
  sessionStorage.removeItem("codebench_trailblazer_access")
}

/** Check if last logout was due to session expiry (for showing message on login page) */
export function wasSessionExpired(): boolean {
  if (typeof window === "undefined") return false
  const flag = sessionStorage.getItem("studentSessionExpired")
  if (flag) {
    sessionStorage.removeItem("studentSessionExpired")
    return true
  }
  return false
}

export async function logoutStudent(sessionExpired?: boolean) {
  console.log("[v0] Logging out student")
  if (typeof window !== "undefined") {
    if (!sessionExpired) {
      markStudentExplicitSignOut()
      sessionStorage.setItem(STUDENT_SKIP_SESSION_RESTORE_KEY, "1")
      clearRememberedStudentAuth()
    }
  }
  const { dispatchSessionReset } = await import("@/lib/data/session-events")
  dispatchSessionReset("logout")
  clearStudentSessionStorage()
  if (!sessionExpired) {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ explicit: true }),
      })
    } catch {
      /* non-blocking */
    }
  }
  const base = sessionExpired ? "/auth/student" : "/auth/university"
  const params = new URLSearchParams()
  if (sessionExpired) {
    params.set("reason", "session_expired")
  } else {
    params.set("signed_out", "1")
  }
  const join = base.includes("?") ? "&" : "?"
  window.location.href = `${base}${join}${params.toString()}`
}

/** Clear admin session storage only (no redirect). Use when session expired on login page. */
function clearAdminSessionStorage() {
  localStorage.removeItem("adminSession")
  localStorage.removeItem("adminId")
  sessionStorage.removeItem("adminId")
  sessionStorage.removeItem("adminUsername")
}

export function logoutAdmin() {
  console.log("[v0] Logging out admin")
  void import("@/lib/data/session-events").then(({ dispatchSessionReset }) => {
    dispatchSessionReset("logout")
  })
  clearAdminSessionStorage()
  window.location.href = "/admin/login"
}

export function resolveStudentDatabaseId(): string | null {
  if (typeof window === "undefined") return null
  const fromSession = sessionStorage.getItem("studentDatabaseId")
  if (fromSession) return fromSession
  return getStudentData()?.databaseId ?? null
}

export function resolveStudentDisplayId(): string | null {
  if (typeof window === "undefined") return null
  const fromSession = sessionStorage.getItem("studentId")
  if (fromSession) return fromSession
  return getStudentData()?.id ?? null
}

export function resolveStudentSection(): string {
  if (typeof window === "undefined") return "ALL"
  const fromSession = sessionStorage.getItem("studentSection")
  if (fromSession) return fromSession
  return getStudentData()?.section ?? "ALL"
}

export function getStudentData() {
  if (typeof window === "undefined") return null

  try {
    const sessionStr = localStorage.getItem("studentSession")
    if (!sessionStr) return null

    const session: SessionData = JSON.parse(sessionStr)

    // Check if session is expired - clear storage and flag for redirect message
    if (!isSessionValid(session.expiresAt)) {
      console.log("[v0] Student session expired")
      if (typeof window !== "undefined") {
        sessionStorage.setItem("studentSessionExpired", "1")
      }
      clearStudentSessionStorage()
      forceExpiredSessionLogout()
      return null
    }

    hydrateStudentSessionStorage(session)
    refreshSession("student")

    const section = syncStoredStudentSection(session.section, session.courseCode)

    return {
      id: session.id,
      name: session.name,
      section,
      databaseId: session.databaseId,
      rememberMe: session.rememberMe,
      universityId: session.universityId,
      universityName: session.universityName,
      universityShortName: session.universityShortName,
      isPlatformGuest: session.isPlatformGuest,
      guestAccessPurpose: session.guestAccessPurpose,
      isSummerCamper:
        session.isSummerCamper ?? isSummerProgramRole(session.studentProgramRole ?? ""),
      studentProgramRole: session.studentProgramRole,
      courseId: session.courseId,
      courseCode: session.courseCode,
      courseTitle: session.courseTitle,
      enrollments: session.enrollments,
    }
  } catch (error) {
    console.error("[v0] Error reading student session:", error)
    return null
  }
}

export function getAdminData() {
  if (typeof window === "undefined") return null

  try {
    const sessionStr = localStorage.getItem("adminSession")
    if (!sessionStr) return null

    const session: AdminSessionData = JSON.parse(sessionStr)

    // Check if session is expired - clear storage without redirect (user may be on login page)
    if (!isSessionValid(session.expiresAt)) {
      console.log("[v0] Admin session expired")
      clearAdminSessionStorage()
      forceExpiredSessionLogout()
      return null
    }

    refreshSession("admin")

    if (session.id) {
      localStorage.setItem("adminId", String(session.id))
    }

    return {
      id: session.id,
      username: session.username,
      name: session.name,
      platformRole: session.platformRole ?? "PLATFORM_ADMIN",
      selectedCourseId: session.selectedCourseId,
      selectedCourseCode: session.selectedCourseCode,
      selectedCourseTitle: session.selectedCourseTitle,
    }
  } catch (error) {
    console.error("[v0] Error reading admin session:", error)
    return null
  }
}

export function isStudentAuthenticated(): boolean {
  if (typeof window === "undefined") return false
  const data = getStudentData()
  return data !== null
}

export function isAdminAuthenticated(): boolean {
  if (typeof window === "undefined") return false
  const data = getAdminData()
  return data !== null
}

export function getInstructorData() {
  if (typeof window === "undefined") return null

  try {
    const session = readFacultySession()
    if (!session) {
      if (localStorage.getItem("instructorSession")) {
        localStorage.removeItem("instructorSession")
        localStorage.removeItem("instructorId")
        sessionStorage.removeItem("instructorId")
      }
      return null
    }

    return {
      id: session.id as number,
      username: String(session.username ?? ""),
      email: session.email as string | undefined,
      name: session.name as string | undefined,
      role: (session.role as string | undefined) ?? "instructor",
      assignedInstructorId: (session.assignedInstructorId as number | null | undefined) ?? null,
      taPermissions: (session.taPermissions as Record<string, unknown> | undefined) ?? {},
      accountType: (session.accountType as "faculty" | undefined) ?? "faculty",
      coursePermissions: (session.coursePermissions as string[] | undefined) ?? [],
      staffRoleForCourse: (session.staffRoleForCourse as string | null | undefined) ?? null,
      loginTime: session.loginTime as string | undefined,
      selectedCourseId: session.selectedCourseId as number | undefined,
      selectedCourseCode: session.selectedCourseCode as string | undefined,
      selectedCatalogCourseCode: session.selectedCatalogCourseCode as string | undefined,
      selectedCourseTitle: session.selectedCourseTitle as string | undefined,
      selectedSessionId: session.selectedSessionId as number | undefined,
      selectedSessionCode: session.selectedSessionCode as string | undefined,
    }
  } catch (error) {
    console.error("[v0] Error reading instructor session:", error)
    return null
  }
}

/** Refresh stored section from DB (e.g. after ECE2202P01 → ECE2202 migration). */
export function patchStudentSessionSection(section: string, courseCode?: string): string {
  return syncStoredStudentSection(section, courseCode)
}

/** After a successful password change, keep the client gate in sync until the next login refresh. */
export function patchStudentSessionPasswordChanged(): void {
  if (typeof window === "undefined") return
  try {
    const raw = localStorage.getItem("studentSession")
    if (!raw) return
    const session = JSON.parse(raw) as SessionData
    session.hasChangedPassword = true
    localStorage.setItem("studentSession", JSON.stringify(session))
    sessionStorage.setItem("studentPasswordChanged", "1")
  } catch {
    /* ignore */
  }
}

export function studentSessionReportsPasswordChanged(): boolean {
  if (typeof window === "undefined") return false
  if (sessionStorage.getItem("studentPasswordChanged") === "1") return true
  try {
    const raw = localStorage.getItem("studentSession")
    if (!raw) return false
    const session = JSON.parse(raw) as SessionData
    return session.hasChangedPassword === true
  } catch {
    return false
  }
}

// Export session setters for login forms
export function getStudentAuthHeaders(): HeadersInit {
  if (typeof window === "undefined") return {}
  const databaseId =
    sessionStorage.getItem("studentDatabaseId") ??
    (() => {
      try {
        const raw = localStorage.getItem("studentSession")
        if (!raw) return null
        const parsed = JSON.parse(raw) as { databaseId?: string }
        return parsed.databaseId ?? null
      } catch {
        return null
      }
    })()
  const headers: HeadersInit = {}
  if (databaseId) headers["x-student-id"] = databaseId
  return headers
}

/** Same-origin student API calls must include the httpOnly refresh cookie. */
export function withStudentApiInit(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers)
  applyDesktopRefreshHeader(headers)
  const authHeaders = getStudentAuthHeaders()
  if (authHeaders instanceof Headers) {
    authHeaders.forEach((value, key) => headers.set(key, value))
  } else if (Array.isArray(authHeaders)) {
    for (const [key, value] of authHeaders) headers.set(key, value)
  } else {
    for (const [key, value] of Object.entries(authHeaders)) {
      if (value) headers.set(key, value)
    }
  }
  return { ...init, credentials: "include", headers }
}

export async function studentApiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const nextInit = withStudentApiInit(init)
  const response = await fetch(input, nextInit)
  logoutOnUnauthorizedResponse(response, input, nextInit)
  return response
}

export { setStudentSession, setAdminSession }
