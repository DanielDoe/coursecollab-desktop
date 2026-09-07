import { redirect } from "next/navigation"

export default function InstructorDashboardV2ResultsPage() {
  redirect("/faculty/dashboard/analytics?section=results")
}
