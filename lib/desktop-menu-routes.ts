import { isAdminAuthenticated, isStudentAuthenticated } from "@/lib/auth"
import { isFacultyAuthenticated } from "@/lib/faculty-auth-flow"
import {
  homePathForPortal,
  readLastDesktopPortal,
  type DesktopPortal,
} from "@/lib/desktop-session-resume"

const STUDENT_ROUTES: Record<string, string> = {
  home: "/student/dashboard-v2",
  cora: "/student/dashboard-v2/ai-tutor",
  codebench: "/student/dashboard-v2/codebench",
  lectures: "/student/dashboard-v2/lectures",
  notes: "/student/dashboard-v2/notes",
  calendar: "/student/dashboard-v2/calendar",
  quizzes: "/student/dashboard-v2/quizzes",
  messages: "/student/dashboard-v2/messages",
  membership: "/student/dashboard-v2/membership",
  settings: "/student/dashboard-v2/settings",
  help: "/student/dashboard-v2/help",
  bug: "/student/dashboard-v2/report-bug",
}

const FACULTY_ROUTES: Record<string, string> = {
  home: "/faculty/dashboard",
  cora: "/faculty/dashboard/cora",
  lectures: "/faculty/dashboard/content/lectures",
  notes: "/faculty/dashboard/content/notes",
  calendar: "/faculty/dashboard/calendar",
  quizzes: "/faculty/dashboard/assessments/quizzes",
  messages: "/faculty/dashboard/communication/notifications",
  membership: "/faculty/dashboard/membership",
  settings: "/faculty/dashboard/settings",
  help: "/faculty/dashboard",
  bug: "/faculty/dashboard",
  codebench: "/faculty/dashboard",
}

const ADMIN_ROUTES: Record<string, string> = {
  home: "/admin/dashboard-v2",
  cora: "/admin/dashboard-v2",
  settings: "/admin/dashboard-v2",
  membership: "/admin/dashboard-v2",
  help: "/admin/dashboard-v2",
  bug: "/admin/dashboard-v2",
}

function currentPortal(): DesktopPortal | null {
  if (isStudentAuthenticated()) return "student"
  if (isFacultyAuthenticated()) return "faculty"
  if (isAdminAuthenticated()) return "admin"
  return readLastDesktopPortal()
}

/** Menu commands (`desktop:cora`) resolve to the signed-in portal, or welcome if none. */
export function resolveDesktopMenuTarget(link: string): string {
  const target = link.trim()
  if (!target) return "/auth/welcome"
  if (!target.startsWith("desktop:")) {
    return target.startsWith("/") ? target : `/${target}`
  }

  const action = target.slice("desktop:".length)
  if (action === "welcome") return "/auth/welcome"
  if (action === "signin") return "/auth/university"

  const portal = currentPortal()
  if (!portal) return "/auth/welcome"

  if (action === "home") return homePathForPortal(portal)

  const routes =
    portal === "faculty" ? FACULTY_ROUTES : portal === "admin" ? ADMIN_ROUTES : STUDENT_ROUTES
  return routes[action] ?? homePathForPortal(portal)
}
