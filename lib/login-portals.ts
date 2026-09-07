import type { LucideIcon } from "lucide-react"
import { Briefcase, GraduationCap, Shield, Sun, Users } from "lucide-react"

export type LoginPortalId = "student" | "guest" | "summer" | "faculty" | "admin"

export type LoginPortalOption = {
  id: LoginPortalId
  label: string
  description: string
  href: string
  icon: LucideIcon
  accent: string
  iconBg: string
  primary?: boolean
}

/** Sign-in entry points — aligned with mobile app portal picker. */
export const LOGIN_PORTAL_OPTIONS: LoginPortalOption[] = [
  {
    id: "student",
    label: "Continue with University",
    description: "Sign in through your school to access courses, assignments, and AI tools.",
    href: "/auth/university",
    icon: GraduationCap,
    accent: "#582c83",
    iconBg: "rgba(88, 44, 131, 0.12)",
    primary: true,
  },
  {
    id: "faculty",
    label: "Faculty",
    description: "Instructors, TAs, graders, and observers.",
    href: "/auth/university?next=faculty",
    icon: Users,
    accent: "#582c83",
    iconBg: "rgba(88, 44, 131, 0.1)",
  },
  {
    id: "guest",
    label: "Career Member",
    description: "Résumé AI, cover letters, applications, and recommendation letters.",
    href: "/student/login/guest",
    icon: Briefcase,
    accent: "#7a4eba",
    iconBg: "rgba(122, 78, 186, 0.12)",
  },
  {
    id: "summer",
    label: "Summer Camp",
    description: "Sign in with your camp email.",
    href: "/student/login/summer-camp",
    icon: Sun,
    accent: "#eaaa00",
    iconBg: "rgba(234, 170, 0, 0.16)",
  },
  {
    id: "admin",
    label: "Platform Admin",
    description: "CourseCollab administration.",
    href: "/admin/login",
    icon: Shield,
    accent: "#3d1f5c",
    iconBg: "rgba(61, 31, 92, 0.12)",
  },
]

export const SECONDARY_LOGIN_PORTALS = LOGIN_PORTAL_OPTIONS.filter((option) => !option.primary)

/** Portal picker on desktop — excludes primary CTA and hidden admin entry. */
export const DESKTOP_VISIBLE_PORTALS = LOGIN_PORTAL_OPTIONS.filter(
  (option) => !option.primary && option.id !== "admin",
)

export const ADMIN_PORTAL_LINK = LOGIN_PORTAL_OPTIONS.find((option) => option.id === "admin")

export function loginPortalById(id: LoginPortalId): LoginPortalOption | undefined {
  return LOGIN_PORTAL_OPTIONS.find((option) => option.id === id)
}
