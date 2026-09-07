import { redirect } from "next/navigation"

export default function FacultyAnalyticsResultsRedirectPage() {
  redirect("/faculty/dashboard/analytics?section=results")
}
