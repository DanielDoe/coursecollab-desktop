"use client"

import dynamic from "next/dynamic"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

export const LazyGradeTrendChart = dynamic(
  () =>
    import("@/components/student/dashboard-v2/GradeTrendChart").then((m) => ({
      default: m.GradeTrendChart,
    })),
  { ssr: false, loading: () => <ModulePageSkeleton className="min-h-[220px]" /> },
)

export const LazyPerformanceComparisonChart = dynamic(
  () =>
    import("@/components/student/dashboard-v2/PerformanceComparisonChart").then((m) => ({
      default: m.PerformanceComparisonChart,
    })),
  { ssr: false, loading: () => <ModulePageSkeleton className="min-h-[220px]" /> },
)

export const LazyPerformanceInsightsCard = dynamic(
  () =>
    import("@/components/student/dashboard-v2/PerformanceInsightsCard").then((m) => ({
      default: m.PerformanceInsightsCard,
    })),
  { ssr: false, loading: () => <ModulePageSkeleton className="min-h-[200px]" /> },
)

export const LazyStudentInterventionRecommendations = dynamic(
  () =>
    import("@/components/student/interventions/StudentInterventionRecommendations").then((m) => ({
      default: m.StudentInterventionRecommendations,
    })),
  { ssr: false, loading: () => null },
)

export const LazyUpcomingDeadlinesPanel = dynamic(
  () =>
    import("@/components/student/dashboard-v2/UpcomingDeadlinesPanel").then((m) => ({
      default: m.UpcomingDeadlinesPanel,
    })),
  { ssr: false, loading: () => <ModulePageSkeleton className="min-h-[200px]" /> },
)

export const LazySemesterTimelinePanel = dynamic(
  () =>
    import("@/components/student/dashboard-v2/SemesterTimeline").then((m) => ({
      default: m.SemesterTimelinePanel,
    })),
  { ssr: false, loading: () => <ModulePageSkeleton className="min-h-[240px]" /> },
)

export const LazyEngagementStats = dynamic(
  () =>
    import("@/components/student/dashboard-v2/EngagementStats").then((m) => ({
      default: m.EngagementStats,
    })),
  { ssr: false, loading: () => <ModulePageSkeleton className="min-h-[180px]" /> },
)
