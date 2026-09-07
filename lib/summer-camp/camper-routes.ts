/** Summer camper menu → page path + API path (for docs and tests). */
export const CAMPER_MENU_ROUTES = [
  { menu: "Dashboard", page: "/student/dashboard-v2/summer-camp", api: "/api/summer-camp/dashboard" },
  { menu: "My Trainings", page: "/student/dashboard-v2/summer-camp/my-trainings", api: "/api/summer-camp/my-trainings" },
  { menu: "Browse Trainings", page: "/student/dashboard-v2/summer-camp/browse", api: "/api/summer-camp/browse-trainings" },
  { menu: "Learning Roadmap", page: "/student/dashboard-v2/summer-camp/roadmap", api: "/api/summer-camp/roadmap" },
  { menu: "Projects", page: "/student/dashboard-v2/summer-camp/projects", api: "/api/summer-camp/camp-projects" },
  { menu: "Checkpoints & Submissions", page: "/student/dashboard-v2/summer-camp/checkpoints", api: "/api/summer-camp/checkpoints" },
  { menu: "Discussions & Help", page: "/student/dashboard-v2/summer-camp/discussions", api: "/api/summer-camp/discussions-hub" },
  { menu: "Resources", page: "/student/dashboard-v2/summer-camp/resources", api: "/api/summer-camp/resources" },
  { menu: "Leaderboard", page: "/student/dashboard-v2/summer-camp/leaderboard", api: "/api/summer-camp/leaderboard" },
  { menu: "Certificates & Achievements", page: "/student/dashboard-v2/summer-camp/achievements", api: "/api/summer-camp/achievements" },
  { menu: "Calendar", page: "/student/dashboard-v2/summer-camp/calendar", api: "/api/summer-camp/calendar" },
  { menu: "Announcements", page: "/student/dashboard-v2/summer-camp/announcements", api: "/api/summer-camp/announcements" },
  { menu: "Support", page: "/student/dashboard-v2/summer-camp/support", api: "/api/summer-camp/support" },
] as const
