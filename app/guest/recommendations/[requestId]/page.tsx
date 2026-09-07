"use client"

import StudentRecommendationDetailPage from "@/app/student/dashboard-v2/recommendations/[requestId]/page"
import { GuestModulePage } from "@/components/guest/dashboard/GuestModulePage"

export default function GuestRecommendationDetailPage() {
  return (
    <GuestModulePage bare>
      <StudentRecommendationDetailPage />
    </GuestModulePage>
  )
}
