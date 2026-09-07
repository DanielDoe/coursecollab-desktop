import { redirect } from "next/navigation"

export default function LegacyStudentRecommendationsRequestRedirect() {
  redirect("/student/dashboard-v2/recommendations/request")
}
