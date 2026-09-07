"use client"

import { RecommendationNavProvider } from "@/components/student/recommendations/recommendation-nav-context"

export default function StudentDashboardRecommendationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <RecommendationNavProvider base="/student/dashboard-v2/recommendations">{children}</RecommendationNavProvider>
}
