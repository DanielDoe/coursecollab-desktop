import { redirect } from "next/navigation"

export default function LegacyStudentAttendanceHistoryPage() {
  redirect("/student/dashboard-v2/attendance/history")
}
