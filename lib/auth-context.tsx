"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  getStudentData,
  getInstructorData,
  getAdminData,
  isStudentAuthenticated,
  isAdminAuthenticated,
} from "@/lib/auth"
import type { UniversityRecord } from "@/lib/universities-shared"
import {
  SELECTED_UNIVERSITY_DATA_KEY,
  SELECTED_UNIVERSITY_SESSION_KEY,
  readSessionSelectedUniversity,
  readSessionSelectedUniversityId,
  resolveUniversityFromStoredIdHints,
} from "@/lib/universities-shared"
import {
  hydrateSessionUniversityFromRemembered,
  persistRememberedUniversity,
  readRememberedUniversity,
} from "@/lib/remembered-auth"
import { tryRestoreStudentSessionFromRefresh } from "@/lib/student-session-restore-client"
import { shouldBlockSessionRestore } from "@/lib/session-restore-guard"
import { bindStudentActiveEnrollment } from "@/lib/student-course-switch-client"

export type AuthRole = "student" | "instructor" | "admin" | null

export type AuthContextValue = {
  role: AuthRole
  isLoading: boolean
  user: ReturnType<typeof getStudentData> | ReturnType<typeof getInstructorData> | ReturnType<typeof getAdminData> | null
  university: UniversityRecord | null
  selectedUniversityId: number | null
  setSelectedUniversity: (university: UniversityRecord) => void
  clearSelectedUniversity: () => void
  refreshSession: () => Promise<void>
  activeCourseId: number | null
  switchActiveCourse: (input: {
    courseId: number
    courseCode?: string
    courseTitle?: string
    section?: string | null
    studentRowId?: number | null
  }) => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredUniversity(): UniversityRecord | null {
  if (typeof window === "undefined") return null
  const fromSession = readSessionSelectedUniversity()
  if (fromSession) return fromSession
  const fromId = resolveUniversityFromStoredIdHints()
  if (fromId) return fromId
  return readRememberedUniversity()
}

function readStoredUniversityId(): number | null {
  if (typeof window === "undefined") return null
  const fromSession = readSessionSelectedUniversityId()
  if (fromSession != null) return fromSession
  return readRememberedUniversity()?.id ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [university, setUniversity] = useState<UniversityRecord | null>(() => readStoredUniversity())
  const [selectedUniversityId, setSelectedUniversityId] = useState<number | null>(() => readStoredUniversityId())

  const refreshSession = useCallback(async () => {
    const restored = await tryRestoreStudentSessionFromRefresh()
    if (restored) {
      setTick((t) => t + 1)
    }
  }, [])

  useEffect(() => {
    hydrateSessionUniversityFromRemembered()
    setUniversity(readStoredUniversity())
    setSelectedUniversityId(readStoredUniversityId())
    const path = window.location.pathname
    const skipRestore = path === "/" || path.startsWith("/auth") || shouldBlockSessionRestore()
    if (skipRestore) {
      setIsLoading(false)
      return
    }
    void refreshSession().finally(() => setIsLoading(false))
  }, [refreshSession])

  const role: AuthRole = useMemo(() => {
    void tick
    if (isStudentAuthenticated()) return "student"
    if (getInstructorData()) return "instructor"
    if (isAdminAuthenticated()) return "admin"
    return null
  }, [tick])

  const user = useMemo(() => {
    void tick
    if (role === "student") return getStudentData()
    if (role === "instructor") return getInstructorData()
    if (role === "admin") return getAdminData()
    return null
  }, [role, tick])

  const activeCourseId = useMemo(() => {
    if (role === "student" && user && "courseId" in user) {
      return user.courseId ?? null
    }
    if (role === "instructor" && user && "selectedCourseId" in user) {
      return user.selectedCourseId ?? null
    }
    if (role === "admin" && user && "selectedCourseId" in user) {
      return user.selectedCourseId ?? null
    }
    return null
  }, [role, user])

  const setSelectedUniversity = useCallback((u: UniversityRecord) => {
    persistRememberedUniversity(u)
    setSelectedUniversityId(u.id)
    setUniversity(u)
  }, [])

  const clearSelectedUniversity = useCallback(() => {
    sessionStorage.removeItem(SELECTED_UNIVERSITY_SESSION_KEY)
    sessionStorage.removeItem(SELECTED_UNIVERSITY_DATA_KEY)
    setSelectedUniversityId(null)
    setUniversity(null)
  }, [])

  const switchActiveCourse = useCallback(
    async (input: {
      courseId: number
      courseCode?: string
      courseTitle?: string
      section?: string | null
      studentRowId?: number | null
    }) => {
      const student = getStudentData()
      if (!student) return false
      const ok = await bindStudentActiveEnrollment(input)
      if (ok) setTick((t) => t + 1)
      return ok
    },
    [],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      role,
      isLoading,
      user,
      university,
      selectedUniversityId,
      setSelectedUniversity,
      clearSelectedUniversity,
      refreshSession,
      activeCourseId,
      switchActiveCourse,
    }),
    [
      role,
      isLoading,
      user,
      university,
      selectedUniversityId,
      setSelectedUniversity,
      clearSelectedUniversity,
      refreshSession,
      activeCourseId,
      switchActiveCourse,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext)
}
