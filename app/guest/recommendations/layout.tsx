"use client"

import { RecommendationNavProvider } from "@/components/student/recommendations/recommendation-nav-context"

export default function GuestRecommendationsSegmentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <RecommendationNavProvider base="/guest/recommendations">{children}</RecommendationNavProvider>
}
