import { redirect } from "next/navigation"

/** Classic dashboard retired — send all traffic to Dashboard V2. */
export default function StudentDashboardPage() {
  redirect("/student/dashboard-v2")
}
