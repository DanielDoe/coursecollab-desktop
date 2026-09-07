"use client"

import StudentRecommendationRequestPage from "@/app/student/dashboard-v2/recommendations/request/page"
import { GuestModulePage } from "@/components/guest/dashboard/GuestModulePage"

export default function GuestRecommendationRequestPage() {
  return (
    <GuestModulePage bare>
      <StudentRecommendationRequestPage guestMode />
    </GuestModulePage>
  )
}
