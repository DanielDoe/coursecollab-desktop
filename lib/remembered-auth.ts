"use client"

import type { UniversityRecord } from "@/lib/universities-shared"
import {
  SELECTED_UNIVERSITY_DATA_KEY,
  SELECTED_UNIVERSITY_SESSION_KEY,
  readSessionSelectedUniversity,
  resolveUniversityFromStoredIdHints,
} from "@/lib/universities-shared"

export const REMEMBERED_UNIVERSITY_KEY = "ccRememberedUniversity"
export const REMEMBERED_STUDENT_LOGIN_KEY = "ccRememberedStudentLogin"
export const REMEMBERED_FACULTY_UNIVERSITY_KEY = "ccRememberedFacultyUniversity"
export const REMEMBERED_FACULTY_LOGIN_KEY = "ccRememberedFacultyLogin"
export const REMEMBERED_FACULTY_COURSE_KEY = "ccRememberedFacultyCourse"

export type RememberedFacultyLogin = {
  username: string
  rememberMe: true
}

export type RememberedStudentLogin = {
  identifier: string
  rememberMe: true
}

export function persistRememberedUniversity(university: UniversityRecord): void {
  if (typeof window === "undefined") return
  if (!university?.id || !university.short_name) return
  const raw = JSON.stringify(university)
  localStorage.setItem(REMEMBERED_UNIVERSITY_KEY, raw)
  localStorage.setItem(REMEMBERED_FACULTY_UNIVERSITY_KEY, raw)
  sessionStorage.setItem(SELECTED_UNIVERSITY_SESSION_KEY, String(university.id))
  sessionStorage.setItem(SELECTED_UNIVERSITY_DATA_KEY, raw)
}

export function persistRememberedStudentAuth(params: {
  university: UniversityRecord
  identifier?: string
  rememberMe: boolean
}): void {
  if (typeof window === "undefined") return
  persistRememberedUniversity(params.university)
  if (!params.rememberMe) {
    localStorage.removeItem(REMEMBERED_STUDENT_LOGIN_KEY)
    return
  }
  if (params.identifier?.trim()) {
    localStorage.setItem(
      REMEMBERED_STUDENT_LOGIN_KEY,
      JSON.stringify({ identifier: params.identifier.trim(), rememberMe: true } satisfies RememberedStudentLogin),
    )
  }
}

export function clearRememberedStudentIdentifier(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(REMEMBERED_STUDENT_LOGIN_KEY)
}

export function clearRememberedStudentAuth(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(REMEMBERED_STUDENT_LOGIN_KEY)
  localStorage.removeItem(REMEMBERED_UNIVERSITY_KEY)
  localStorage.removeItem(REMEMBERED_FACULTY_UNIVERSITY_KEY)
  sessionStorage.removeItem(SELECTED_UNIVERSITY_SESSION_KEY)
  sessionStorage.removeItem(SELECTED_UNIVERSITY_DATA_KEY)
}

export function persistRememberedFacultyAuth(params: {
  university: UniversityRecord
  username?: string
  rememberMe: boolean
  courseKey?: string | null
}): void {
  if (typeof window === "undefined") return
  persistRememberedUniversity(params.university)
  if (!params.rememberMe) {
    localStorage.removeItem(REMEMBERED_FACULTY_LOGIN_KEY)
    localStorage.removeItem(REMEMBERED_FACULTY_COURSE_KEY)
    return
  }
  if (params.username?.trim()) {
    localStorage.setItem(
      REMEMBERED_FACULTY_LOGIN_KEY,
      JSON.stringify({ username: params.username.trim(), rememberMe: true } satisfies RememberedFacultyLogin),
    )
  }
  if (params.courseKey?.trim()) {
    localStorage.setItem(REMEMBERED_FACULTY_COURSE_KEY, params.courseKey.trim())
  } else {
    localStorage.removeItem(REMEMBERED_FACULTY_COURSE_KEY)
  }
}

export function readRememberedUniversity(): UniversityRecord | null {
  if (typeof window === "undefined") return null
  try {
    const raw =
      localStorage.getItem(REMEMBERED_UNIVERSITY_KEY) || localStorage.getItem(REMEMBERED_FACULTY_UNIVERSITY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as UniversityRecord
    if (!parsed?.id || !parsed?.short_name) return null
    return parsed
  } catch {
    return null
  }
}

export function readRememberedStudentLogin(): RememberedStudentLogin | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(REMEMBERED_STUDENT_LOGIN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RememberedStudentLogin
    if (!parsed?.rememberMe) return null
    return parsed
  } catch {
    return null
  }
}

/** Hydrate sessionStorage from remembered university (same tab session). */
export function hydrateSessionUniversityFromRemembered(): UniversityRecord | null {
  const remembered = readRememberedUniversity()
  if (!remembered || typeof window === "undefined") return null
  sessionStorage.setItem(SELECTED_UNIVERSITY_SESSION_KEY, String(remembered.id))
  sessionStorage.setItem(SELECTED_UNIVERSITY_DATA_KEY, JSON.stringify(remembered))
  return remembered
}

export function hasRememberedStudentUniversity(): boolean {
  return readRememberedUniversity() != null
}

/** Student login: school picker, or credentials if a university is already remembered. */
export function getRememberedStudentLoginPath(): string {
  return hasRememberedStudentUniversity() ? "/auth/student" : "/auth/university"
}

export function clearRememberedFacultyAuth(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(REMEMBERED_FACULTY_LOGIN_KEY)
  localStorage.removeItem(REMEMBERED_FACULTY_COURSE_KEY)
  localStorage.removeItem(REMEMBERED_FACULTY_UNIVERSITY_KEY)
  localStorage.removeItem(REMEMBERED_UNIVERSITY_KEY)
  sessionStorage.removeItem(SELECTED_UNIVERSITY_SESSION_KEY)
  sessionStorage.removeItem(SELECTED_UNIVERSITY_DATA_KEY)
}

export function readRememberedFacultyUniversity(): UniversityRecord | null {
  if (typeof window === "undefined") return null
  try {
    const raw =
      localStorage.getItem(REMEMBERED_FACULTY_UNIVERSITY_KEY) || localStorage.getItem(REMEMBERED_UNIVERSITY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as UniversityRecord
    if (!parsed?.id || !parsed?.short_name) return null
    return parsed
  } catch {
    return null
  }
}

export function readRememberedFacultyLogin(): RememberedFacultyLogin | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(REMEMBERED_FACULTY_LOGIN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RememberedFacultyLogin
    if (!parsed?.rememberMe) return null
    return parsed
  } catch {
    return null
  }
}

export function readRememberedFacultyCourseKey(): string | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(REMEMBERED_FACULTY_COURSE_KEY)
  return raw?.trim() ? raw.trim() : null
}

export function hydrateFacultySessionUniversityFromRemembered(): UniversityRecord | null {
  const remembered = readRememberedFacultyUniversity()
  if (!remembered || typeof window === "undefined") return null
  sessionStorage.setItem(SELECTED_UNIVERSITY_SESSION_KEY, String(remembered.id))
  sessionStorage.setItem(SELECTED_UNIVERSITY_DATA_KEY, JSON.stringify(remembered))
  return remembered
}

/** Faculty login / course picker — never hang when only university id survived in storage. */
export function resolveFacultyPortalUniversity(): UniversityRecord | null {
  if (typeof window === "undefined") return null
  return (
    readSessionSelectedUniversity() ??
    readRememberedFacultyUniversity() ??
    resolveUniversityFromStoredIdHints() ??
    hydrateFacultySessionUniversityFromRemembered()
  )
}

export function hasRememberedFacultyUniversity(): boolean {
  return readRememberedFacultyUniversity() != null
}

export function getRememberedFacultyLoginPath(): string {
  return hasRememberedFacultyUniversity() ? "/faculty/login" : "/auth/university?next=faculty"
}

