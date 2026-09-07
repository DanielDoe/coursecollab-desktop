"use client"

import { getStudentAuthHeaders } from "@/lib/auth"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"

/**
 * Which table the completion flag lives in. There are only two, because
 * summer campers and career members are rows in `students` — they differ in
 * where they LAND, not in where the flag is stored.
 */
export type AppearanceSetupRole = "student" | "instructor"

/** Who is being prompted. Drives the post-setup destination. */
export type AppearanceAudience = "student" | "summer_camper" | "guest" | "instructor"

const AUDIENCE_ROLE: Record<AppearanceAudience, AppearanceSetupRole> = {
  student: "student",
  summer_camper: "student",
  guest: "student",
  instructor: "instructor",
}

/**
 * Hard-coded rather than accepted as a `?next=` query param on purpose: an
 * arbitrary redirect target on a post-auth page is an open redirect waiting to
 * happen, and there are only four possible destinations.
 */
const AUDIENCE_DESTINATION: Record<AppearanceAudience, string> = {
  student: "/student/dashboard-v2",
  summer_camper: "/student/dashboard-v2/summer-camp",
  guest: "/guest",
  instructor: "/faculty/select-course",
}

const ROLE_ENDPOINT: Record<AppearanceSetupRole, string> = {
  student: "/api/student/appearance-setup",
  instructor: "/api/instructor/appearance-setup",
}

const ROLE_ID_FIELD: Record<AppearanceSetupRole, string> = {
  student: "studentId",
  instructor: "instructorId",
}

export function appearanceRoleFor(audience: AppearanceAudience): AppearanceSetupRole {
  return AUDIENCE_ROLE[audience]
}

export function appearanceDestinationFor(audience: AppearanceAudience): string {
  return AUDIENCE_DESTINATION[audience]
}

function authHeadersFor(role: AppearanceSetupRole): HeadersInit {
  return role === "instructor" ? buildInstructorApiHeaders() : getStudentAuthHeaders()
}

/**
 * Per-user flag: this account explicitly picked an appearance during onboarding.
 *
 * The role segment is not cosmetic — instructor #5 and student #5 are different
 * people, and without it they would share a key on a shared browser. For role
 * "student" this produces exactly the key shipped before roles existed, so
 * students who already completed setup are not re-prompted.
 */
export function appearanceSetupStorageKey(
  userId: string | number,
  role: AppearanceSetupRole = "student",
): string {
  return `cc_${role}_${String(userId).trim()}_appearance_setup_v1`
}

export function hasCompletedAppearanceSetup(
  userId: string | number | null | undefined,
  role: AppearanceSetupRole = "student",
): boolean {
  const id = String(userId ?? "").trim()
  if (!id || typeof window === "undefined") return false
  try {
    return localStorage.getItem(appearanceSetupStorageKey(id, role)) === "true"
  } catch {
    return false
  }
}

export function markAppearanceSetupComplete(
  userId: string | number,
  role: AppearanceSetupRole = "student",
): void {
  const id = String(userId).trim()
  if (!id || typeof window === "undefined") return
  try {
    localStorage.setItem(appearanceSetupStorageKey(id, role), "true")
  } catch {
    /* private mode */
  }
}

/** Load server-side completion and mirror into localStorage for fast client checks. */
export async function syncAppearanceSetupFromServer(
  userId: string | number | null | undefined,
  role: AppearanceSetupRole = "student",
): Promise<boolean> {
  const id = String(userId ?? "").trim()
  if (!id) return false
  if (hasCompletedAppearanceSetup(id, role)) return true

  try {
    const field = ROLE_ID_FIELD[role]
    const res = await fetch(`${ROLE_ENDPOINT[role]}?${field}=${encodeURIComponent(id)}`, {
      headers: authHeadersFor(role),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { completed?: boolean }
    if (data.completed) {
      markAppearanceSetupComplete(id, role)
      return true
    }
  } catch {
    /* offline — fall back to local flag only */
  }
  return false
}

/** Persist completion on the account (server) and this browser (localStorage). */
export async function persistAppearanceSetupComplete(
  userId: string | number,
  role: AppearanceSetupRole = "student",
): Promise<void> {
  markAppearanceSetupComplete(userId, role)
  try {
    await fetch(ROLE_ENDPOINT[role], {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeadersFor(role) },
      body: JSON.stringify({ [ROLE_ID_FIELD[role]]: String(userId) }),
    })
  } catch {
    /* local flag still prevents repeat prompts on this device */
  }
}

/**
 * Gate for flows with no first-password-change moment to hang the prompt on —
 * career members choose their own password at registration, and campers have
 * no change-password page at all, so for those two it hangs off the portal
 * shell instead. Returns the theme page, or the normal destination.
 */
export async function resolveAppearanceGatePath(opts: {
  audience: AppearanceAudience
  userId: string | number | null | undefined
  /** Overrides the audience default (e.g. camper onboarding). */
  fallback?: string
}): Promise<string> {
  const destination = opts.fallback ?? appearanceDestinationFor(opts.audience)
  const id = String(opts.userId ?? "").trim()
  if (!id) return destination
  const completed = await syncAppearanceSetupFromServer(id, appearanceRoleFor(opts.audience))
  return completed ? destination : "/auth/theme"
}

/* --------------------------------------------------------------------- */
/* Student-named aliases — kept so the existing student call sites (login  */
/* forms, change-password, dashboard layout) need no churn.                */
/* --------------------------------------------------------------------- */

export function hasStudentCompletedAppearanceSetup(
  studentDbId: string | null | undefined,
): boolean {
  return hasCompletedAppearanceSetup(studentDbId, "student")
}

export function markStudentAppearanceSetupComplete(studentDbId: string): void {
  markAppearanceSetupComplete(studentDbId, "student")
}

export function resolveStudentPostLoginPath(opts: {
  studentDbId: string | number
  hasChangedPassword?: boolean
  hasApprovedResetRequest?: boolean
  /** When set, skips localStorage read (e.g. after server sync on login). */
  appearanceSetupCompleted?: boolean
  enrollmentCount?: number
  courseSelectionCompleted?: boolean
}): string {
  if (opts.hasApprovedResetRequest) return "/student/reset-password"
  if (opts.hasChangedPassword === false) return "/student/change-password?firstLogin=true"
  const setupDone =
    opts.appearanceSetupCompleted ??
    hasCompletedAppearanceSetup(String(opts.studentDbId), "student")
  if (!setupDone) return "/auth/theme"
  if (!opts.courseSelectionCompleted && (opts.enrollmentCount ?? 0) > 1) {
    return "/auth/student/select-course"
  }
  return "/student/dashboard-v2"
}
