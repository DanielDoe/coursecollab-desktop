"use client"

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"
import {
  applyFacultySkipCourseScope,
  facultyCourseSelectValue,
  parseFacultyOfferingKey,
  reconcileFacultySelectedCourse,
} from "@/lib/faculty-course-session-sync"
import type { FacultyCourseOffering } from "@/lib/faculty-course-offerings-shared"
import {
  facultyOfferingChipCode,
  facultyOfferingPrimaryLabel,
  facultyOfferingShowsAsSection,
} from "@/lib/faculty-course-offerings-shared"
import {
  clearRememberedFacultyAuth,
  readRememberedFacultyCourseKey,
  getRememberedFacultyLoginPath,
  persistRememberedUniversity,
} from "@/lib/remembered-auth"
import { lookupUniversityById } from "@/lib/universities-shared"
import { appendNativeAppQuery } from "@/lib/mobile-native-app"
import { tryRestoreFacultySessionFromRefresh, markFacultyExplicitSignOut } from "@/lib/faculty-session-restore-client"

type SessionRecord = Record<string, unknown>

const FACULTY_SESSION_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const FACULTY_REMEMBER_ME_MS = 30 * 24 * 60 * 60 * 1000

function facultySessionDurationMs(session: SessionRecord): number {
  return session.rememberMe === true ? FACULTY_REMEMBER_ME_MS : FACULTY_SESSION_DAYS_MS
}

function withFacultyExpiry(session: SessionRecord): SessionRecord {
  if (typeof session.expiresAt === "number" && Number.isFinite(session.expiresAt)) {
    return session
  }
  return { ...session, expiresAt: Date.now() + facultySessionDurationMs(session) }
}

async function readJsonResponse<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text()
  const contentType = res.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) {
    const looksLikeHtml = /^\s*</.test(text)
    throw new Error(
      looksLikeHtml
        ? `Server error (${res.status}). Restart dev with: npm run dev:clean`
        : `Unexpected response (${res.status})`,
    )
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error("Invalid JSON from server")
  }
}

export function hydrateFacultySessionStorage(session: SessionRecord): void {
  if (typeof sessionStorage === "undefined") return
  if (session.id != null) {
    sessionStorage.setItem("instructorId", String(session.id))
  }
  if (session.selectedUniversityId != null) {
    sessionStorage.setItem("selectedUniversityId", String(session.selectedUniversityId))
  }
}

export function saveFacultySession(session: SessionRecord): void {
  const next = withFacultyExpiry(session)
  localStorage.setItem("instructorSession", JSON.stringify(next))
  if (session.id != null) {
    localStorage.setItem("instructorId", String(session.id))
  }
  hydrateFacultySessionStorage(session)
  const universityId = Number(session.selectedUniversityId)
  if (Number.isFinite(universityId) && universityId > 0) {
    const university = lookupUniversityById(universityId)
    if (university) persistRememberedUniversity(university)
  }
  window.dispatchEvent(new Event("instructor-session-updated"))
}

/** Course scope + permissions missing after refresh-only restore (remember-me auto-login). */
export function facultySessionNeedsCourseCompletion(session: SessionRecord): boolean {
  if (session.courseScopeSkipped === true) return false
  if (session.selectedCourseId == null) return false
  const perms = session.coursePermissions
  const hasPerms = Array.isArray(perms) && perms.length > 0
  const hasCourseMeta = Boolean(
    session.selectedCourseCode && session.selectedCourseTitle,
  )
  return !hasPerms || !hasCourseMeta
}

export function facultySessionReadyForDashboard(session: SessionRecord): boolean {
  if (facultySessionNeedsPasswordChange(session)) return false
  if (session.courseScopeSkipped === true) return true
  if (session.selectedCourseId == null) return false
  return !facultySessionNeedsCourseCompletion(session)
}

function slideFacultySessionExpiry(session: SessionRecord): SessionRecord {
  const next = {
    ...session,
    expiresAt: Date.now() + facultySessionDurationMs(session),
  }
  localStorage.setItem("instructorSession", JSON.stringify(next))
  return next
}

export function readFacultySession(): SessionRecord | null {
  try {
    const raw = localStorage.getItem("instructorSession")
    if (!raw) return null
    let session = withFacultyExpiry(JSON.parse(raw) as SessionRecord)
    if (session?.id == null) return null
    if (typeof session.expiresAt === "number" && Date.now() >= session.expiresAt) {
      return null
    }
    hydrateFacultySessionStorage(session)
    if (session.id != null) {
      localStorage.setItem("instructorId", String(session.id))
    }
    session = slideFacultySessionExpiry(session)
    return session
  } catch {
    return null
  }
}

/** True when local faculty session exists with a usable instructor identity. */
export function isFacultyAuthenticated(): boolean {
  return readFacultySession() != null
}

/** True when the httpOnly refresh cookie is still valid for this faculty member. */
export async function verifyFacultyServerSession(): Promise<boolean> {
  if (typeof window === "undefined") return false
  return tryRestoreFacultySessionFromRefresh()
}

/** Clear faculty local session keys (no redirect). */
export function clearFacultySessionStorage(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem("instructorSession")
  localStorage.removeItem("instructorId")
  sessionStorage.removeItem("instructorId")
  sessionStorage.removeItem("selectedUniversityId")
  window.dispatchEvent(new Event("instructor-session-updated"))
}

/** End faculty session, revoke cookies, and hard-navigate to login. */
export async function logoutFaculty(options?: { sessionExpired?: boolean }): Promise<void> {
  if (typeof window === "undefined") return
  void import("@/lib/data/session-events").then(({ dispatchSessionReset }) => {
    dispatchSessionReset("logout")
  })

  const sessionExpired = options?.sessionExpired === true
  if (sessionExpired) {
    clearFacultySessionStorage()
  } else {
    markFacultyExplicitSignOut()
    clearRememberedFacultyAuth()
    clearFacultySessionStorage()
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

  const base = sessionExpired ? getRememberedFacultyLoginPath() : "/auth/university?next=faculty"
  const params = new URLSearchParams()
  if (sessionExpired) {
    params.set("reason", "session_expired")
  } else {
    params.set("signed_out", "1")
  }
  const join = base.includes("?") ? "&" : "?"
  window.location.href = `${base}${join}${params.toString()}`
}

export function facultySessionNeedsPasswordChange(session: SessionRecord): boolean {
  if (session.requiresPasswordChange === true) return true
  if (session.requiresPasswordChange === false) return false
  return session.hasChangedPassword === false
}

export async function fetchFacultyOfferingsForSession(): Promise<{
  offerings: FacultyCourseOffering[]
  activeTermLabel: string | null
}> {
  const res = await fetch("/api/instructor/courses", {
    headers: buildInstructorApiHeaders(),
    credentials: "include",
  })
  const data = await readJsonResponse<{
    error?: string
    offerings?: FacultyCourseOffering[]
    courses?: FacultyCourseOffering[]
    activeTerm?: { label?: string | null } | null
  }>(res)
  if (!res.ok) throw new Error(String(data.error || "Failed to load courses"))
  return {
    offerings: (data.offerings || data.courses || []) as FacultyCourseOffering[],
    activeTermLabel: data.activeTerm?.label ?? null,
  }
}

export function applyRememberedCourseToSession(session: SessionRecord): SessionRecord {
  const next = { ...session }
  const rememberedKey = readRememberedFacultyCourseKey()
  if (!rememberedKey) return next
  try {
    const { courseId, academicTermId, sessionId } = parseFacultyOfferingKey(rememberedKey)
    next.selectedCourseId = courseId
    delete next.courseScopeSkipped
    if (sessionId != null) {
      next.selectedSessionId = sessionId
    } else {
      delete next.selectedSessionId
      delete next.selectedSessionCode
    }
    if (academicTermId != null) {
      next.selectedAcademicTermId = academicTermId
    } else {
      delete next.selectedAcademicTermId
      delete next.selectedTermLabel
    }
  } catch {
    /* ignore invalid key */
  }
  return next
}

export async function finalizeFacultyCourseSelection(
  session: SessionRecord,
  offering: FacultyCourseOffering,
): Promise<SessionRecord> {
  const next = { ...session }
  next.selectedCourseId = offering.course_id
  next.selectedCourseCode = offering.catalog_course_code ?? offering.course_code
  next.selectedCatalogCourseCode = offering.catalog_course_code ?? offering.course_code
  next.selectedCourseTitle = offering.course_title
  next.staffRoleForCourse = offering.staff_role ?? "INSTRUCTOR"
  delete next.courseScopeSkipped
  if (offering.session_id != null) {
    next.selectedSessionId = offering.session_id
    next.selectedSessionCode = offering.session_code ?? offering.course_code
  } else {
    delete next.selectedSessionId
    delete next.selectedSessionCode
  }
  if (offering.academic_term_id != null) {
    next.selectedAcademicTermId = offering.academic_term_id
    next.selectedTermLabel = offering.term_label
  } else {
    delete next.selectedAcademicTermId
    delete next.selectedTermLabel
  }

  const permRes = await fetch("/api/faculty/permissions", {
    headers: {
      ...buildInstructorApiHeaders(),
      "x-course-id": String(offering.course_id),
    },
    credentials: "include",
  })
  const permData = await readJsonResponse(permRes)
  if (permRes.ok) {
    next.coursePermissions = permData.permissions ?? []
    next.staffRoleForCourse = permData.staffRole ?? next.staffRoleForCourse
  }
  return next
}

export function enterFacultyDashboard(
  router: AppRouterInstance,
  session: SessionRecord,
  options?: { nativeApp?: boolean },
): void {
  saveFacultySession(session)
  const path = options?.nativeApp ? appendNativeAppQuery("/faculty/dashboard") : "/faculty/dashboard"
  router.push(path)
}

/** Finalize course scope + permissions after cookie refresh when localStorage is partial. */
export async function completeFacultySessionAfterRestore(
  session: SessionRecord,
): Promise<SessionRecord> {
  if (facultySessionNeedsPasswordChange(session)) return session

  let working = { ...session }

  try {
    if (working.courseScopeSkipped === true) {
      saveFacultySession(working)
      return working
    }

    const alreadyComplete =
      working.selectedCourseId != null && !facultySessionNeedsCourseCompletion(working)
    if (alreadyComplete) {
      hydrateFacultySessionStorage(working)
      return working
    }

    const { offerings } = await fetchFacultyOfferingsForSession()
    working = applyRememberedCourseToSession(working)
    const { session: reconciled, changed, valid } = reconcileFacultySelectedCourse(
      working,
      offerings,
    )
    if (changed) working = reconciled

    if (valid && working.selectedCourseId != null) {
      const key = facultyCourseSelectValue(working)
      const offering = findOfferingByKey(offerings, key)
      if (offering) {
        working = await finalizeFacultyCourseSelection(working, offering)
      }
    } else if (offerings.length === 0) {
      working = applyFacultySkipCourseScope(working)
    } else if (offerings.length === 1 && working.selectedCourseId == null) {
      working = await finalizeFacultyCourseSelection(working, offerings[0])
    }

    saveFacultySession(working)
    return working
  } catch (error) {
    console.warn("[completeFacultySessionAfterRestore]", error)
    saveFacultySession(working)
    return working
  }
}

export async function tryAutoProceedAfterFacultyLogin(
  router: AppRouterInstance,
  session: SessionRecord,
  options?: { nativeApp?: boolean },
): Promise<"dashboard" | "course" | "password" | "setup"> {
  if (facultySessionNeedsPasswordChange(session)) {
    saveFacultySession(session)
    const path = options?.nativeApp ? appendNativeAppQuery("/faculty/change-password") : "/faculty/change-password"
    router.push(path)
    return "password"
  }

  saveFacultySession(session)

  try {
    const setupRes = await fetch("/api/faculty/account-setup", {
      headers: buildInstructorApiHeaders(),
      credentials: "include",
    })
    if (setupRes.ok) {
      const setupData = (await setupRes.json()) as { needsSetup?: boolean }
      if (setupData.needsSetup) {
        const path = options?.nativeApp ? appendNativeAppQuery("/faculty/setup") : "/faculty/setup"
        router.push(path)
        return "setup"
      }
    }
  } catch {
    /* continue normal login flow */
  }

  const { offerings } = await fetchFacultyOfferingsForSession()
  let working = applyRememberedCourseToSession(session)
  const { session: reconciled, changed, valid } = reconcileFacultySelectedCourse(working, offerings)
  if (changed) {
    working = reconciled
    saveFacultySession(working)
  }

  if (valid && !working.courseScopeSkipped && working.selectedCourseId != null) {
    const key = facultyCourseSelectValue(working)
    const { courseId, academicTermId, sessionId } = parseFacultyOfferingKey(key)
    const offering = offerings.find(
      (o) =>
        o.course_id === courseId &&
        (o.academic_term_id ?? null) === academicTermId &&
        (sessionId != null ? o.session_id === sessionId : o.session_id == null),
    )
    if (offering) {
      const finalized = await finalizeFacultyCourseSelection(working, offering)
      enterFacultyDashboard(router, finalized, options)
      return "dashboard"
    }
  }

  if (offerings.length === 0) {
    const skipped = applyFacultySkipCourseScope(working)
    enterFacultyDashboard(router, skipped, options)
    return "dashboard"
  }

  if (offerings.length === 1) {
    const finalized = await finalizeFacultyCourseSelection(working, offerings[0])
    enterFacultyDashboard(router, finalized, options)
    return "dashboard"
  }

  return "course"
}

export function findOfferingByKey(
  offerings: FacultyCourseOffering[],
  key: string,
): FacultyCourseOffering | undefined {
  const { courseId, academicTermId, sessionId } = parseFacultyOfferingKey(key)
  return offerings.find(
    (o) =>
      o.course_id === courseId &&
      (o.academic_term_id ?? null) === academicTermId &&
      (sessionId != null ? o.session_id === sessionId : o.session_id == null),
  )
}

export function formatFacultyOfferingLabel(o: FacultyCourseOffering): string {
  const catalog = (o.catalog_course_code ?? o.course_code).trim()
  const section = facultyOfferingShowsAsSection(o) ? (o.session_code ?? o.course_code).trim() : null
  const title = section && section.toUpperCase() !== catalog.toUpperCase() ? `${catalog} · ${section}` : o.course_title
  const term = o.term_label?.trim()
  return term ? `${title} · ${term}` : title
}
