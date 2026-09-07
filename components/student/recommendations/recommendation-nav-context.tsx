"use client"

import type { ReactNode } from "react"
import { createContext, useContext } from "react"

const DEFAULT_BASE = "/student/dashboard-v2/recommendations"

const RecommendationNavContext = createContext({ base: DEFAULT_BASE })

export function RecommendationNavProvider({
  base,
  children,
}: {
  base: string
  children: ReactNode
}) {
  return (
    <RecommendationNavContext.Provider value={{ base }}>{children}</RecommendationNavContext.Provider>
  )
}

export function useRecommendationNav() {
  return useContext(RecommendationNavContext)
}
