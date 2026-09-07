/** Canonical student dashboard shell (Dashboard V2). */
export const STUDENT_DASHBOARD_V2 = "/student/dashboard-v2"

export const STUDENT_MEMBERSHIP_V2 = `${STUDENT_DASHBOARD_V2}/membership`
export const STUDENT_MEMBERSHIP_CHECKOUT_V2 = `${STUDENT_MEMBERSHIP_V2}/checkout`
export const STUDENT_MEMBERSHIP_MANAGE_V2 = `${STUDENT_MEMBERSHIP_V2}/manage`

/** Exact-path redirects from retired classic module URLs to Dashboard V2. */
export const CLASSIC_STUDENT_MODULE_REDIRECTS: Record<string, string> = {
  "/student/dashboard": STUDENT_DASHBOARD_V2,
  "/student/quizzes": `${STUDENT_DASHBOARD_V2}/quizzes`,
  "/student/quiz-history": `${STUDENT_DASHBOARD_V2}/quiz-history`,
  "/student/homework": `${STUDENT_DASHBOARD_V2}/homework`,
  "/student/homeworks": `${STUDENT_DASHBOARD_V2}/homework`,
  "/student/mid-semester-exams": `${STUDENT_DASHBOARD_V2}/mid-semester-exams`,
  "/student/final-exams": `${STUDENT_DASHBOARD_V2}/final-exams`,
  "/student/finals": `${STUDENT_DASHBOARD_V2}/final-exams`,
  "/student/grades": `${STUDENT_DASHBOARD_V2}/grades`,
  "/student/lectures": `${STUDENT_DASHBOARD_V2}/lectures`,
  "/student/practice": `${STUDENT_DASHBOARD_V2}/practice`,
  "/student/codebench": `${STUDENT_DASHBOARD_V2}/codebench`,
  "/student/codebench/more": `${STUDENT_DASHBOARD_V2}/codebench/more`,
  "/student/ai-tutor": `${STUDENT_DASHBOARD_V2}/ai-tutor`,
  "/student/ai-notetaker": `${STUDENT_DASHBOARD_V2}/ai-notetaker`,
  "/student/forum": `${STUDENT_DASHBOARD_V2}/forum`,
  "/student/groups": `${STUDENT_DASHBOARD_V2}/groups`,
  "/student/projects": `${STUDENT_DASHBOARD_V2}/projects`,
  "/student/playground": `${STUDENT_DASHBOARD_V2}/playground`,
  "/student/classroom-points": `${STUDENT_DASHBOARD_V2}/classroom-points`,
  "/student/attendance": `${STUDENT_DASHBOARD_V2}/attendance`,
  "/student/attendance/history": `${STUDENT_DASHBOARD_V2}/attendance/history`,
  "/student/attendance/analytics": `${STUDENT_DASHBOARD_V2}/attendance/analytics`,
  "/student/trade-center": `${STUDENT_DASHBOARD_V2}/trade-center`,
  "/student/announcements": `${STUDENT_DASHBOARD_V2}/announcements`,
  "/student/calendar": `${STUDENT_DASHBOARD_V2}/calendar`,
  "/student/membership": `${STUDENT_DASHBOARD_V2}/membership`,
  "/student/membership/plans": `${STUDENT_DASHBOARD_V2}/membership`,
  "/student/membership/checkout": `${STUDENT_DASHBOARD_V2}/membership/checkout`,
  "/student/membership/manage": `${STUDENT_DASHBOARD_V2}/membership/manage`,
  "/student/help": `${STUDENT_DASHBOARD_V2}/help`,
  "/student/notifications": `${STUDENT_DASHBOARD_V2}/notifications`,
  "/student/profile": `${STUDENT_DASHBOARD_V2}/settings`,
  "/student/recommendations": `${STUDENT_DASHBOARD_V2}/recommendations`,
  "/student/my-quizzes": `${STUDENT_DASHBOARD_V2}/quizzes`,
  "/student/browse-quizzes": `${STUDENT_DASHBOARD_V2}/quizzes`,
  "/student/create-quiz": `${STUDENT_DASHBOARD_V2}/quizzes`,
  "/student/office-hours": `${STUDENT_DASHBOARD_V2}/office-hours`,
  "/student/practice/quiz": `${STUDENT_DASHBOARD_V2}/practice/quiz`,
  "/student/practice/history": `${STUDENT_DASHBOARD_V2}/practice/history`,
  "/student/playground/game": `${STUDENT_DASHBOARD_V2}/playground/game`,
  "/student/playground/leaderboard": `${STUDENT_DASHBOARD_V2}/playground/leaderboard`,
  "/student/projects/leaderboard": `${STUDENT_DASHBOARD_V2}/projects/leaderboard`,
}

const PREFIX_REDIRECTS: { prefix: string; target: string }[] = [
  { prefix: "/student/lectures/", target: `${STUDENT_DASHBOARD_V2}/lectures/` },
  { prefix: "/student/recommendations/", target: `${STUDENT_DASHBOARD_V2}/recommendations/` },
  { prefix: "/student/ai-notetaker/", target: `${STUDENT_DASHBOARD_V2}/ai-notetaker/` },
  { prefix: "/student/forum/thread/", target: `${STUDENT_DASHBOARD_V2}/forum/thread/` },
]

/** Map a classic student module path to Dashboard V2, or return unchanged if not mapped. */
export function resolveStudentDashboardV2Path(path: string): string {
  if (!path.startsWith("/student")) return path
  if (path.startsWith(STUDENT_DASHBOARD_V2)) return path
  const q = path.indexOf("?")
  const pathname = q >= 0 ? path.slice(0, q) : path
  const search = q >= 0 ? path.slice(q) : ""
  const exact = CLASSIC_STUDENT_MODULE_REDIRECTS[pathname]
  if (exact) return exact + search
  for (const { prefix, target } of PREFIX_REDIRECTS) {
    if (pathname.startsWith(prefix)) {
      return target + pathname.slice(prefix.length) + search
    }
  }
  return path
}

/** Middleware helper: redirect classic module URLs to V2. */
export function classicStudentModuleRedirect(pathname: string): string | null {
  if (pathname.startsWith(STUDENT_DASHBOARD_V2)) return null
  const exact = CLASSIC_STUDENT_MODULE_REDIRECTS[pathname]
  if (exact) return exact
  for (const { prefix, target } of PREFIX_REDIRECTS) {
    if (pathname.startsWith(prefix)) {
      return target + pathname.slice(prefix.length)
    }
  }
  return null
}
