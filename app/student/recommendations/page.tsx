import { redirect } from "next/navigation"

export default function LegacyStudentRecommendationsIndexRedirect() {
  redirect("/student/dashboard-v2/recommendations")
}
