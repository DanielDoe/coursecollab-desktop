/**
 * Shared portal configuration for instructor and admin dashboards.
 */

export type PortalKind = "admin" | "instructor" | "faculty"

export const PORTAL_CONFIG: Record<
  PortalKind,
  {
    basePath: string
    loginPath: string
    selectCoursePath: string
    sessionStorageKey: string
    idStorageKey: string
    apiPrefix: "/api/admin" | "/api/instructor"
    portalLabel: string
    idHeader: "x-admin-id" | "x-instructor-id"
    courseScopeEvent: string
  }
> = {
  admin: {
    basePath: "/admin/dashboard-v2",
    loginPath: "/admin/login",
    selectCoursePath: "/admin/select-course",
    sessionStorageKey: "adminSession",
    idStorageKey: "adminId",
    apiPrefix: "/api/admin",
    portalLabel: "Admin",
    idHeader: "x-admin-id",
    courseScopeEvent: "admin-course-scope-changed",
  },
  instructor: {
    basePath: "/faculty/dashboard",
    loginPath: "/faculty/login",
    selectCoursePath: "/faculty/select-course",
    sessionStorageKey: "instructorSession",
    idStorageKey: "instructorId",
    apiPrefix: "/api/instructor",
    portalLabel: "Faculty",
    idHeader: "x-instructor-id",
    courseScopeEvent: "instructor-course-scope-changed",
  },
  faculty: {
    basePath: "/faculty/dashboard",
    loginPath: "/faculty/login",
    selectCoursePath: "/faculty/select-course",
    sessionStorageKey: "instructorSession",
    idStorageKey: "instructorId",
    apiPrefix: "/api/instructor",
    portalLabel: "Faculty",
    idHeader: "x-instructor-id",
    courseScopeEvent: "instructor-course-scope-changed",
  },
}

export function detectPortalFromPathname(pathname: string | null | undefined): PortalKind {
  if (pathname?.startsWith("/admin")) return "admin"
  if (pathname?.startsWith("/faculty")) return "faculty"
  if (pathname?.startsWith("/instructor")) return "instructor"
  return "faculty"
}

export function getPortalConfig(portal: PortalKind) {
  if (portal === "faculty" || portal === "instructor") {
    return PORTAL_CONFIG.faculty
  }
  return PORTAL_CONFIG[portal]
}
