"use client"

import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import { getStudentDatabaseId } from "@/lib/student-session-ids"
import { BANNER_PREF_MODULES } from "@/lib/student-dashboard-banner-prefs-shared"

export { BANNER_PREF_MODULES }

const LEGACY_WELCOME_KEY = "cc_dashboard_v2_welcome_dismissed"

/** Numeric `students.id` for dashboard v2 banner prefs (session + sessionStorage). */
export function getStudentDatabaseIdFromClient(): string | null {
  return getStudentDatabaseId()
}

export function welcomeBannerStorageKey(studentDbId: string): string {
  return `cc_student_${studentDbId}_welcome_dismissed`
}

export function coursePolicyNoticeStorageKey(studentDbId: string): string {
  return `cc_student_${studentDbId}_course_policy_notice_dismissed`
}

export function readClientWelcomeDismissed(studentDbId: string | null): boolean {
  if (!studentDbId || typeof window === "undefined") return false
  try {
    const key = welcomeBannerStorageKey(studentDbId)
    if (localStorage.getItem(key) === "true") return true
    if (localStorage.getItem(LEGACY_WELCOME_KEY) === "true") {
      localStorage.setItem(key, "true")
      localStorage.removeItem(LEGACY_WELCOME_KEY)
      return true
    }
  } catch {
    /* private mode */
  }
  return false
}

export function readClientCoursePolicyNoticeDismissed(studentDbId: string | null): boolean {
  if (!studentDbId || typeof window === "undefined") return false
  try {
    return localStorage.getItem(coursePolicyNoticeStorageKey(studentDbId)) === "true"
  } catch {
    return false
  }
}

export function writeClientWelcomeDismissed(studentDbId: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(welcomeBannerStorageKey(studentDbId), "true")
    localStorage.removeItem(LEGACY_WELCOME_KEY)
  } catch {
    /* ignore */
  }
}

export function writeClientCoursePolicyNoticeDismissed(studentDbId: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(coursePolicyNoticeStorageKey(studentDbId), "true")
  } catch {
    /* ignore */
  }
}

export type DashboardBannerPrefs = {
  welcomeDismissed: boolean
  coursePolicyNoticeDismissed: boolean
}

export async function fetchDashboardBannerPrefs(
  studentDbId: string,
): Promise<DashboardBannerPrefs | null> {
  if (!studentDbId) return null

  try {
    const response = await fetch(
      `/api/student/dashboard-banner-prefs?studentId=${encodeURIComponent(studentDbId)}`,
      { headers: getStudentAuthHeaders() },
    )
    if (response.ok) {
      return (await response.json()) as DashboardBannerPrefs
    }
  } catch {
    /* fall back to localStorage */
  }

  return {
    welcomeDismissed: readClientWelcomeDismissed(studentDbId),
    coursePolicyNoticeDismissed: readClientCoursePolicyNoticeDismissed(studentDbId),
  }
}

export async function persistBannerDismissal(
  studentDbId: string,
  banner: "welcome" | "coursePolicyNotice",
): Promise<void> {
  if (banner === "welcome") {
    writeClientWelcomeDismissed(studentDbId)
  } else {
    writeClientCoursePolicyNoticeDismissed(studentDbId)
  }

  try {
    await studentApiFetch("/api/student/dashboard-banner-prefs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getStudentAuthHeaders(),
      },
      body: JSON.stringify({ banner, dismissed: true }),
    })
  } catch {
    /* local dismissal still applies */
  }
}

/** Dismiss welcome banner everywhere (card, tour skip, tour complete). */
export async function dismissWelcomeBannerPermanently(studentDbId: string | null): Promise<void> {
  if (!studentDbId) return
  await persistBannerDismissal(studentDbId, "welcome")
}

export async function dismissCoursePolicyNoticePermanently(studentDbId: string | null): Promise<void> {
  if (!studentDbId) return
  await persistBannerDismissal(studentDbId, "coursePolicyNotice")
}
