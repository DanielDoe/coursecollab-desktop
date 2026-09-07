import { redirect } from "next/navigation"

export default function LegacyStudentAttendanceAnalyticsPage() {
  redirect("/student/dashboard-v2/attendance/analytics")
}
