import {
  LayoutDashboard,
  Sun,
  BookOpen,
  MessageCircle,
  Mail,
  HelpCircle,
  GraduationCap,
  Map,
  FolderKanban,
  Upload,
  Library,
  Images,
  Award,
  Trophy,
  Calendar,
  Megaphone,
  LifeBuoy,
} from "lucide-react"

export const SUMMER_CAMP_DASHBOARD_BASE = "/student/dashboard-v2/summer-camp"

export function campRoute(subpath = ""): string {
  if (!subpath) return SUMMER_CAMP_DASHBOARD_BASE
  return `${SUMMER_CAMP_DASHBOARD_BASE}${subpath.startsWith("/") ? subpath : `/${subpath}`}`
}

export const CAMPER_DASHBOARD_LINK = {
  id: "camp-dashboard",
  label: "Dashboard",
  href: SUMMER_CAMP_DASHBOARD_BASE,
  icon: LayoutDashboard,
}

export const CAMPER_NAV_GROUPS = [
  {
    id: "summer-camp",
    label: "Summer Camp",
    icon: Sun,
    items: [
      {
        id: "camp-dashboard",
        label: "Dashboard",
        href: SUMMER_CAMP_DASHBOARD_BASE,
        icon: LayoutDashboard,
      },
      {
        id: "my-trainings",
        label: "My Trainings",
        href: campRoute("/my-trainings"),
        icon: GraduationCap,
      },
      {
        id: "browse-trainings",
        label: "Browse Trainings",
        href: campRoute("/browse"),
        icon: BookOpen,
      },
      {
        id: "learning-roadmap",
        label: "Learning Roadmap",
        href: campRoute("/roadmap"),
        icon: Map,
      },
      {
        id: "camp-projects",
        label: "Projects",
        href: campRoute("/projects"),
        icon: FolderKanban,
      },
      {
        id: "checkpoints",
        label: "Checkpoints & Submissions",
        href: campRoute("/checkpoints"),
        icon: Upload,
      },
      {
        id: "discussions-help",
        label: "Discussions & Help",
        href: campRoute("/discussions"),
        icon: MessageCircle,
      },
      {
        id: "camp-messages",
        label: "Messages",
        href: campRoute("/messages"),
        icon: Mail,
      },
      {
        id: "resources",
        label: "Resources",
        href: campRoute("/resources"),
        icon: Library,
      },
      {
        id: "gallery",
        label: "Project Gallery",
        href: campRoute("/gallery"),
        icon: Images,
      },
      {
        id: "graduation",
        label: "Camp Graduation",
        href: campRoute("/graduation"),
        icon: GraduationCap,
      },
      {
        id: "camp-leaderboard",
        label: "Leaderboard",
        href: campRoute("/leaderboard"),
        icon: Trophy,
      },
      {
        id: "achievements",
        label: "Certificates & Achievements",
        href: campRoute("/achievements"),
        icon: Award,
      },
    ],
  },
  {
    id: "camp-extras",
    label: "Camp Info",
    icon: Calendar,
    items: [
      {
        id: "camp-calendar",
        label: "Calendar",
        href: campRoute("/calendar"),
        icon: Calendar,
      },
      {
        id: "camp-announcements",
        label: "Announcements",
        href: campRoute("/announcements"),
        icon: Megaphone,
      },
      {
        id: "camp-support",
        label: "Support",
        href: campRoute("/support"),
        icon: LifeBuoy,
      },
    ],
  },
]
