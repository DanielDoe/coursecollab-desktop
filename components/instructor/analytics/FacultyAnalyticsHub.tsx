"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { FileText, Plus, BarChart3, TrendingUp, Users, BookOpen, LineChart, Brain, Code2 } from "lucide-react"
import { FacultyCodebenchStudioAnalytics } from "@/components/instructor/analytics/FacultyCodebenchStudioAnalytics"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { InstructorAdvancedAnalytics } from "@/components/instructor-advanced-analytics"
import { InstructorReportsContent } from "@/app/instructor/reports/page"
import { ResultsViewer } from "@/components/results-viewer"
import { ProgressReviewPanel } from "@/components/instructor/MidtermProgressReviewPanel"
import { cn } from "@/lib/utils"
import {
  type AnalyticsHubSection,
  AN_SPINNER,
} from "@/lib/analytics/analytics-instructor-ui"

function parseSection(raw: string | null): AnalyticsHubSection {
  const normalized = raw === "analytics" ? "student-progress" : raw
  const allowed: AnalyticsHubSection[] = ["results", "student-progress", "reports", "progress-reviews"]
  if (normalized && allowed.includes(normalized as AnalyticsHubSection)) {
    return normalized as AnalyticsHubSection
  }
  return "results"
}

export function FacultyAnalyticsHub() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const section = parseSection(searchParams.get("section"))
  const subParam = searchParams.get("sub")

  useEffect(() => {
    if (!searchParams.get("section")) {
      router.replace("/faculty/dashboard/analytics?section=results", { scroll: false })
    }
  }, [router, searchParams])

  const defaultSub = useMemo(() => {
    if (section === "reports") return "templates"
    if (section === "student-progress") return "overview"
    return "main"
  }, [section])

  const [activeSub, setActiveSub] = useState(subParam || defaultSub)

  useEffect(() => {
    setActiveSub(subParam || defaultSub)
  }, [section, subParam, defaultSub])

  const syncSub = useCallback(
    (nextSub: string) => {
      const params = new URLSearchParams()
      params.set("section", section)
      if (nextSub && nextSub !== "main") params.set("sub", nextSub)
      router.replace(`/faculty/dashboard/analytics?${params.toString()}`, { scroll: false })
    },
    [router, section],
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="w-full min-w-0 overflow-x-hidden"
    >
      {section === "student-progress" ? (
        <FacultyModuleSplitLayout
          menu={
            <FacultyModuleSideMenu
              moduleId="advanced-analytics"
              title="Student Progress"
              activeId={activeSub}
              onSelect={(id) => {
                setActiveSub(id)
                syncSub(id)
              }}
              items={[
                { id: "overview", label: "Overview", icon: BarChart3 },
                { id: "performance", label: "Performance", icon: TrendingUp },
                { id: "students", label: "Students", icon: Users },
                { id: "assessments", label: "Assessments", icon: BookOpen },
                { id: "trends", label: "Trends", icon: LineChart },
                { id: "ai-tutor", label: "AI Tutor", icon: Brain },
                { id: "codebench", label: "CodeBench", icon: Code2 },
              ]}
            />
          }
        >
          {activeSub === "codebench" ? (
            <FacultyCodebenchStudioAnalytics />
          ) : (
            <InstructorAdvancedAnalytics
              key="student-progress"
              embedInDashboard
              embedInHub
              activeTab={activeSub}
              onActiveTabChange={(tab) => {
                setActiveSub(tab)
                syncSub(tab)
              }}
              hideSideMenu
            />
          )}
        </FacultyModuleSplitLayout>
      ) : null}

      {section === "reports" ? (
        <FacultyModuleSplitLayout
          menu={
            <FacultyModuleSideMenu
              moduleId="reports"
              title="Manage Reports"
              activeId={activeSub}
              onSelect={(id) => {
                setActiveSub(id)
                syncSub(id)
              }}
              items={[
                { id: "templates", label: "Templates", icon: Plus },
                { id: "generated", label: "Generated", icon: FileText },
              ]}
            />
          }
        >
          <InstructorReportsContent
            key="reports"
            embedInDashboard
            embedInHub
            activeTab={activeSub as "templates" | "generated"}
            onActiveTabChange={(tab) => {
              setActiveSub(tab)
              syncSub(tab)
            }}
          />
        </FacultyModuleSplitLayout>
      ) : null}

      {section === "results" ? (
        <ResultsViewer key="results" userType="instructor" embedInDashboard embedInHub />
      ) : null}

      {section === "progress-reviews" ? (
        <ProgressReviewPanel key="progress-reviews" fullPage embedInHub />
      ) : null}
    </motion.div>
  )
}

export function FacultyAnalyticsHubFallback() {
  return (
    <div className="flex min-h-[280px] items-center justify-center">
      <div className={cn("h-8 w-8", AN_SPINNER)} />
    </div>
  )
}
