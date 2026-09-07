import { redirect } from "next/navigation"

/** Semester / academic term management lives on Sections (shared terms + course sections). */
export default function AdminSemestersPage() {
  redirect("/admin/dashboard-v2/management/sessions")
}
