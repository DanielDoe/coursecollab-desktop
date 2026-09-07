"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react"
import { getPortalConfig, type PortalKind } from "@/lib/portal-config"
import { createPortalNav, type NavGroup, type NavItem } from "@/lib/portal-nav-config"
import { ADMIN_DASHBOARD_LINK, ADMIN_NAV_GROUPS } from "@/lib/admin-nav-config"
import {
  FACULTY_DASHBOARD_BASE,
  buildFacultyNavFromPermissions,
  buildFacultyNavFull,
} from "@/lib/faculty-portal-nav-config"
import { facultyHasSelectedCourse } from "@/lib/faculty-course-scope-routes"
import { getInstructorData } from "@/lib/auth"
import { isTaRole } from "@/lib/ta-permissions"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"

export const INSTRUCTOR_DASHBOARD_V2_BASE = FACULTY_DASHBOARD_BASE
export const ADMIN_DASHBOARD_V2_BASE = "/admin/dashboard-v2"

export const INSTRUCTOR_V2_QUESTION_BANK_PATH = `${FACULTY_DASHBOARD_BASE}/assessments/quizzes/question-bank`
export const ADMIN_V2_QUESTION_BANK_PATH = `${ADMIN_DASHBOARD_V2_BASE}/assessments/quizzes/question-bank`

export type CourseSwitchSplash = { title: string; code: string }

interface InstructorDashboardV2ContextValue {
  portal: PortalKind
  permissions: string[]
  staffRoleForCourse: string | null
  hasPermission: (code: string) => boolean
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  basePath: string
  dashboardLink: NavItem
  navGroups: NavGroup[]
  loginPath: string
  courseScopeVersion: number
  bumpCourseScope: () => void
  beginCourseSwitch: (course: CourseSwitchSplash) => void
  courseSwitchSplash: CourseSwitchSplash | null
  refreshPermissions: () => Promise<void>
  coraImmersive: boolean
  setCoraImmersive: (on: boolean) => void
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
  /** Extra breadcrumb segment for in-module sub-views (e.g. New lecture). */
  pageBreadcrumbTail: string | null
  setPageBreadcrumbTail: (label: string | null) => void
}

const InstructorDashboardV2Context = createContext<InstructorDashboardV2ContextValue | null>(null)

export function InstructorDashboardV2Provider({
  children,
  portal = "faculty",
}: {
  children: ReactNode
  portal?: PortalKind
}) {
  const portalCfg = getPortalConfig(portal === "instructor" ? "faculty" : portal)
  const [permissions, setPermissions] = useState<string[]>([])
  const [staffRoleForCourse, setStaffRoleForCourse] = useState<string | null>(null)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [courseScopeVersion, setCourseScopeVersion] = useState(() =>
    typeof window !== "undefined" && facultyHasSelectedCourse() ? 1 : 0,
  )
  const [courseSwitchSplash, setCourseSwitchSplash] = useState<CourseSwitchSplash | null>(null)
  const [coraImmersive, setCoraImmersive] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [pageBreadcrumbTail, setPageBreadcrumbTail] = useState<string | null>(null)
  const [hasSelectedCourse, setHasSelectedCourse] = useState(() =>
    typeof window !== "undefined" ? facultyHasSelectedCourse() : false,
  )

  const refreshPermissions = useCallback(async () => {
    if (portal === "admin") return
    const data = getInstructorData()
    if (data?.coursePermissions?.length) {
      setPermissions(data.coursePermissions as string[])
      setStaffRoleForCourse((data.staffRoleForCourse as string) ?? null)
    }
    if (!data?.selectedCourseId) return
    try {
      const res = await fetch("/api/faculty/permissions", { headers: buildInstructorApiHeaders() })
      const json = await res.json()
      if (!res.ok) return
      const perms = json.permissions ?? []
      setPermissions(perms)
      setStaffRoleForCourse(json.staffRole ?? null)
      const raw = localStorage.getItem("instructorSession")
      if (raw) {
        const session = JSON.parse(raw)
        session.coursePermissions = perms
        session.staffRoleForCourse = json.staffRole
        localStorage.setItem("instructorSession", JSON.stringify(session))
      }
    } catch {
      /* ignore */
    }
  }, [portal])

  useEffect(() => {
    if (portal === "admin") return
    setHasSelectedCourse(facultyHasSelectedCourse())
    void refreshPermissions()
    const onSync = () => {
      setHasSelectedCourse(facultyHasSelectedCourse())
      void refreshPermissions()
    }
    window.addEventListener("instructor-session-updated", onSync)
    window.addEventListener(portalCfg.courseScopeEvent, onSync)
    return () => {
      window.removeEventListener("instructor-session-updated", onSync)
      window.removeEventListener(portalCfg.courseScopeEvent, onSync)
    }
  }, [portal, portalCfg.courseScopeEvent, refreshPermissions, courseScopeVersion])

  const nav = useMemo(() => {
    if (portal === "admin") {
      return { dashboardLink: ADMIN_DASHBOARD_LINK, navGroups: ADMIN_NAV_GROUPS }
    }
    const accountRole =
      typeof window !== "undefined" ? getInstructorData()?.role : undefined
    // Faculty instructors always see the full drawer; TAs stay permission-scoped.
    if (!isTaRole(accountRole)) return buildFacultyNavFull()
    if (!hasSelectedCourse) return buildFacultyNavFull()
    return buildFacultyNavFromPermissions(permissions)
  }, [portal, permissions, hasSelectedCourse])

  const hasPermission = useCallback(
    (code: string) => permissions.includes(code),
    [permissions],
  )

  const bumpCourseScope = useCallback(() => {
    setCourseScopeVersion((v) => v + 1)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(portalCfg.courseScopeEvent))
    }
  }, [portalCfg.courseScopeEvent])

  const beginCourseSwitch = useCallback(
    (course: CourseSwitchSplash) => {
      setCourseSwitchSplash(course)
      setCourseScopeVersion((v) => v + 1)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(portalCfg.courseScopeEvent))
      }
    },
    [portalCfg.courseScopeEvent],
  )

  useEffect(() => {
    if (!courseSwitchSplash) return
    const id = window.setTimeout(() => setCourseSwitchSplash(null), 840)
    return () => window.clearTimeout(id)
  }, [courseSwitchSplash])

  return (
    <InstructorDashboardV2Context.Provider
      value={{
        portal: portal === "instructor" ? "faculty" : portal,
        permissions,
        staffRoleForCourse,
        hasPermission,
        mobileSidebarOpen,
        setMobileSidebarOpen,
        sidebarCollapsed,
        setSidebarCollapsed,
        basePath: portalCfg.basePath,
        dashboardLink: nav.dashboardLink,
        navGroups: nav.navGroups,
        loginPath: portalCfg.loginPath,
        courseScopeVersion,
        bumpCourseScope,
        beginCourseSwitch,
        courseSwitchSplash,
        refreshPermissions,
        coraImmersive,
        setCoraImmersive,
        searchOpen,
        setSearchOpen,
        pageBreadcrumbTail,
        setPageBreadcrumbTail,
      }}
    >
      {children}
    </InstructorDashboardV2Context.Provider>
  )
}

export function useInstructorDashboardV2() {
  const ctx = useContext(InstructorDashboardV2Context)
  const fallbackNav = createPortalNav(FACULTY_DASHBOARD_BASE)
  return (
    ctx ?? {
      portal: "faculty" as PortalKind,
      permissions: [],
      staffRoleForCourse: null,
      hasPermission: () => false,
      mobileSidebarOpen: false,
      setMobileSidebarOpen: () => {},
      sidebarCollapsed: false,
      setSidebarCollapsed: () => {},
      basePath: FACULTY_DASHBOARD_BASE,
      dashboardLink: fallbackNav.dashboardLink,
      navGroups: fallbackNav.navGroups,
      loginPath: "/faculty/login",
      courseScopeVersion: 0,
      bumpCourseScope: () => {},
      beginCourseSwitch: () => {},
      courseSwitchSplash: null,
      refreshPermissions: async () => {},
      coraImmersive: false,
      setCoraImmersive: () => {},
      searchOpen: false,
      setSearchOpen: () => {},
      pageBreadcrumbTail: null,
      setPageBreadcrumbTail: () => {},
    }
  )
}
