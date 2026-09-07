"use client"

import StudentRecommendationsPage from "@/app/student/dashboard-v2/recommendations/page"
import { GuestModulePage } from "@/components/guest/dashboard/GuestModulePage"

export default function GuestRecommendationsPage() {
  return (
    <GuestModulePage bare>
      <StudentRecommendationsPage />
    </GuestModulePage>
  )
}
