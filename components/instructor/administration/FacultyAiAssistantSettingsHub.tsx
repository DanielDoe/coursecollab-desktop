"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  BarChart3,
  LayoutDashboard,
  Map,
  MessageSquare,
  Settings2,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { AITutorOverview } from "@/components/ai-tutor-overview"
import { AITutorStudents } from "@/components/ai-tutor-students"
import { AITutorConversations } from "@/components/ai-tutor-conversations"
import { AITutorStruggles } from "@/components/ai-tutor-struggles"
import { AITutorAnalytics } from "@/components/ai-tutor-analytics"
import { AITutorSettings } from "@/components/ai-tutor-settings"
import { FacultyCoraCopilotSettings } from "@/components/instructor/administration/FacultyCoraCopilotSettings"
import { FacultyCoraPlatformUsage } from "@/components/instructor/administration/FacultyCoraPlatformUsage"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"

type Section = "settings" | "copilot" | "usage" | "overview" | "students" | "conversations" | "struggles" | "analytics"

interface AIStats {
  totalQuestions: number
  activeStudents: number
  averageResponseTime: number
  satisfactionScore: number
  strugglingStudents: number
  weeklyGrowth: number
}

const SECTION_META: Record<Section, { label: string; icon: LucideIcon }> = {
  settings: { label: "Cora Assistant", icon: Settings2 },
  copilot: { label: "Cora Copilot", icon: Sparkles },
  usage: { label: "How Cora is used", icon: Map },
  overview: { label: "Overview", icon: LayoutDashboard },
  students: { label: "Students", icon: Users },
  conversations: { label: "Conversations", icon: MessageSquare },
  struggles: { label: "Alerts", icon: TriangleAlert },
  analytics: { label: "Analytics", icon: BarChart3 },
}

export function FacultyAiAssistantSettingsHub() {
  const router = useRouter()
  const [section, setSection] = useState<Section>("settings")
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<AIStats>({
    totalQuestions: 0,
    activeStudents: 0,
    averageResponseTime: 0,
    satisfactionScore: 0,
    strugglingStudents: 0,
    weeklyGrowth: 0,
  })

  useEffect(() => {
    const instructorSession = localStorage.getItem("instructorSession")
    if (!instructorSession) {
      router.push("/faculty/login")
      return
    }
    void instructorApiFetch("/api/instructor/ai-tutor/stats", { headers: buildInstructorApiHeaders() })
      .then(async (response) => {
        const data = await response.json()
        if (response.ok && data.stats) setStats(data.stats)
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [router])

  const sideMenuItems = useMemo(
    () =>
      (Object.keys(SECTION_META) as Section[]).map((id) => ({
        id,
        label: SECTION_META[id].label,
        icon: SECTION_META[id].icon,
        badge: id === "struggles" && stats.strugglingStudents > 0 ? stats.strugglingStudents : undefined,
        tone: id === "struggles" && stats.strugglingStudents > 0 ? ("warning" as const) : undefined,
      })),
    [stats.strugglingStudents],
  )

  if (loading) {
    return <InstructorPolicyLoadingState moduleId="ai-assistant-settings" label="Loading Cora Assistant…" />
  }

  return (
    <FacultyModuleSplitLayout
      menu={
        <FacultyModuleSideMenu
          moduleId="ai-assistant-settings"
          title="Cora Assistant"
          activeId={section}
          onSelect={(id) => setSection(id as Section)}
          items={sideMenuItems}
          accent="theme"
        />
      }
    >
      <div className="min-w-0">
        {section === "settings" ? <AITutorSettings embedInDashboard /> : null}
        {section === "copilot" ? <FacultyCoraCopilotSettings /> : null}
        {section === "usage" ? <FacultyCoraPlatformUsage /> : null}
        {section === "overview" ? <AITutorOverview stats={stats} embedInDashboard /> : null}
        {section === "students" ? <AITutorStudents embedInDashboard /> : null}
        {section === "conversations" ? <AITutorConversations embedInDashboard /> : null}
        {section === "struggles" ? <AITutorStruggles embedInDashboard /> : null}
        {section === "analytics" ? <AITutorAnalytics embedInDashboard /> : null}
      </div>
    </FacultyModuleSplitLayout>
  )
}
