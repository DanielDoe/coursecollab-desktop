import { redirect } from "next/navigation"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"

export default function TaPermissionsRedirectPage() {
  redirect(`${FACULTY_DASHBOARD_BASE}/administration/teaching-assistants`)
}
