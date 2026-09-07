/** CourseCollab native shell (Expo / Capacitor) detection — shared server + client. */

export const NATIVE_APP_UA_TOKEN = "CourseCollab-Native"
export const NATIVE_APP_QUERY = "native"
export const NATIVE_APP_COOKIE = "cc_native_app"

export function isNativeAppUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return userAgent.includes(NATIVE_APP_UA_TOKEN)
}

export function isNativeAppSearchParams(searchParams: URLSearchParams | { get(name: string): string | null }): boolean {
  return searchParams.get(NATIVE_APP_QUERY) === "1"
}

export function appendNativeAppQuery(path: string): string {
  if (path.includes(`${NATIVE_APP_QUERY}=1`)) return path
  const join = path.includes("?") ? "&" : "?"
  return `${path}${join}${NATIVE_APP_QUERY}=1`
}

export const NATIVE_LOGIN_PATH = "/student/login?native=1"
export const NATIVE_STUDENT_LOGIN_PATH = "/student/login?native=1&portal=student"
export const NATIVE_FACULTY_LOGIN_PATH = "/faculty/login?native=1"
export const NATIVE_SUMMER_LOGIN_PATH = "/student/login/summer-camp?native=1"
export const NATIVE_ADMIN_LOGIN_PATH = "/admin/login?native=1"
export const NATIVE_DASHBOARD_PATH = "/student/dashboard-v2?native=1"
