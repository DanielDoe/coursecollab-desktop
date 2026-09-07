import type { DashboardPortal } from "./types"

export function getDashboardBasePath(portal: DashboardPortal): string {
  switch (portal) {
    case "admin":
      return "/admin/dashboard-v2"
    case "faculty":
      return "/faculty/dashboard"
    case "student":
      return "/student/dashboard-v2"
    case "camper":
      return "/student/dashboard-v2/summer-camp"
    default:
      return "/"
  }
}
