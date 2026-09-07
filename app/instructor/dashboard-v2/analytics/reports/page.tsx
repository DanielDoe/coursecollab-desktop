import { redirect } from "next/navigation"

export default function AnalyticsReportsPage() {
  redirect("/faculty/dashboard/analytics?section=reports")
}
