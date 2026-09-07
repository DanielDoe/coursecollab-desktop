"use client"

import dynamic from "next/dynamic"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"
import { LazyMount } from "@/components/student/dashboard-v2/LazyMount"
import { dashboardV2PageStackClass } from "@/lib/dashboard-v2-layout"

const RoleDashboardPage = dynamic(
  () =>
    import("@/components/dashboard-v2/RoleDashboardPage").then((m) => ({
      default: m.RoleDashboardPage,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[520px]" /> },
)

const WelcomeTourCard = dynamic(
  () =>
    import("@/components/student/dashboard-v2/WelcomeTourCard").then((m) => ({
      default: m.WelcomeTourCard,
    })),
  { loading: () => null },
)

const StructuredSessionCheckIn = dynamic(
  () =>
    import("@/components/student/dashboard-v2/StructuredSessionCheckIn").then((m) => ({
      default: m.StructuredSessionCheckIn,
    })),
  { loading: () => null },
)

const PendingAssignmentsBanner = dynamic(
  () =>
    import("@/components/student/dashboard-v2/PendingAssignmentsBanner").then((m) => ({
      default: m.PendingAssignmentsBanner,
    })),
  { loading: () => null },
)

const GradesAwaitingReviewBanner = dynamic(
  () =>
    import("@/components/student/dashboard-v2/GradesAwaitingReviewBanner").then((m) => ({
      default: m.GradesAwaitingReviewBanner,
    })),
  { loading: () => null },
)

const CoursePolicyNoticeCard = dynamic(
  () =>
    import("@/components/governance/CoursePolicyNoticeCard").then((m) => ({
      default: m.CoursePolicyNoticeCard,
    })),
  { loading: () => null },
)

const RegularAssessmentsDeadlineBanner = dynamic(
  () =>
    import("@/components/student/RegularAssessmentsDeadlineBanner").then((m) => ({
      default: m.RegularAssessmentsDeadlineBanner,
    })),
  { loading: () => null },
)

const Ece2202ClassCancelBanner = dynamic(
  () =>
    import("@/components/student/Ece2202ClassCancelBanner").then((m) => ({
      default: m.Ece2202ClassCancelBanner,
    })),
  { loading: () => null },
)

export default function StudentDashboardV2Page() {
  return (
    <PageEnter className={dashboardV2PageStackClass}>
      <WelcomeTourCard />
      <LazyMount minHeight={0}>
        <StructuredSessionCheckIn />
      </LazyMount>
      <LazyMount minHeight={0}>
        <CoursePolicyNoticeCard />
      </LazyMount>
      <LazyMount minHeight={0}>
        <RegularAssessmentsDeadlineBanner />
      </LazyMount>
      <LazyMount minHeight={0}>
        <Ece2202ClassCancelBanner />
      </LazyMount>
      <LazyMount minHeight={72}>
        <PendingAssignmentsBanner />
      </LazyMount>
      <LazyMount minHeight={0}>
        <GradesAwaitingReviewBanner />
      </LazyMount>
      <RoleDashboardPage portal="student" />
    </PageEnter>
  )
}
