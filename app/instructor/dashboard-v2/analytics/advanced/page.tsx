import { redirect } from "next/navigation"

export default function AnalyticsAdvancedPage() {
  redirect("/faculty/dashboard/analytics?section=student-progress")
}
