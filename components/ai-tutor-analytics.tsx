"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"
import { InstructorPolicySurfaceCard } from "@/components/instructor/InstructorPolicySurfaceCard"
import { BarChart3, Target, Activity, Info, Loader2, RefreshCw } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { CoraSectionTools } from "@/components/instructor/administration/CoraSectionTools"
import { Button } from "@/components/ui/button"

interface TopicData {
  topic: string
  questions: number
  mastery: number
}

interface AnalyticsInsight {
  label: string
  value: string
  description: string
  color: string
}

export function AITutorAnalytics({ embedInDashboard }: { embedInDashboard?: boolean } = {}) {
  const [topicData, setTopicData] = useState<TopicData[]>([])
  const [insights, setInsights] = useState<AnalyticsInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    void fetchAnalytics()
  }, [])

  const fetchAnalytics = async (silent = false) => {
    if (silent) setRefreshing(true)
    try {
      const [topicsResponse, insightsResponse] = await Promise.all([
        instructorApiFetch("/api/instructor/ai-tutor/topic-analytics", { headers: buildInstructorApiHeaders() }),
        instructorApiFetch("/api/instructor/ai-tutor/analytics-insights", { headers: buildInstructorApiHeaders() }),
      ])
      const topicsData = await topicsResponse.json()
      const insightsData = await insightsResponse.json()
      setTopicData(topicsData.topics || [])
      setInsights(insightsData.insights || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  if (loading) {
    if (embedInDashboard) {
      return <InstructorPolicyLoadingState moduleId="ai-assistant-settings" label="Loading analytics…" />
    }
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-purple-600" />
      </div>
    )
  }

  const masteryBar = (mastery: number) => (
    <div className="h-2 overflow-hidden rounded-full bg-[var(--sidebar-accent)]/50">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          mastery < 60
            ? "bg-[var(--cc-sem-danger)]"
            : mastery < 75
              ? "bg-[var(--cc-sem-warning)]"
              : "bg-[var(--cc-sem-success)]",
        )}
        style={{ width: `${mastery}%` }}
      />
    </div>
  )

  const charts = (
    <div className={embedInDashboard ? "grid gap-4 lg:grid-cols-2" : "grid gap-6 md:grid-cols-2"}>
      <InstructorPolicySurfaceCard variant="section" title="Questions by topic" description="Topics taken from Cora chat content, not auto-detect labels">
        {topicData.length === 0 ? (
          <div className="py-12 text-center">
            <BarChart3 className="mx-auto mb-3 h-10 w-10 text-[var(--cc-text-muted)]/50" />
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No topic data yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topicData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="topic" stroke="var(--cc-text-muted)" angle={-35} textAnchor="end" height={72} />
              <YAxis stroke="var(--cc-text-muted)" />
              <Tooltip />
              <Bar dataKey="questions" fill="var(--cc-sem-ai)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </InstructorPolicySurfaceCard>

      <InstructorPolicySurfaceCard variant="section" title="Topic mastery" description="Estimated understanding by topic area">
        {topicData.length === 0 ? (
          <div className="py-12 text-center">
            <Target className="mx-auto mb-3 h-10 w-10 text-[var(--cc-text-muted)]/50" />
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No mastery data yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {topicData.map((item) => (
              <div key={item.topic} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-sm font-medium", PORTAL_TEXT)}>{item.topic}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{item.mastery}%</span>
                    {item.mastery < 60 ? (
                      <Badge className="bg-[var(--cc-sem-danger)] text-xs text-white">Low</Badge>
                    ) : item.mastery < 75 ? (
                      <Badge className="bg-[var(--cc-sem-warning)] text-xs text-white">Medium</Badge>
                    ) : (
                      <Badge className="bg-[var(--cc-sem-success)] text-xs text-white">High</Badge>
                    )}
                  </div>
                </div>
                {masteryBar(item.mastery)}
              </div>
            ))}
          </div>
        )}
      </InstructorPolicySurfaceCard>
    </div>
  )

  const insightCards = (
    <InstructorPolicySurfaceCard variant="section" title="Key insights" description="Summary metrics from student Cora Assistant usage">
      {insights.length === 0 ? (
        <div className="py-10 text-center">
          <Info className="mx-auto mb-3 h-10 w-10 text-[var(--cc-text-muted)]/50" />
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Insights will appear as students use the tutor</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {insights.map((insight, index) => (
            <div
              key={index}
              className="rounded-xl border border-[var(--border)] bg-[var(--sidebar-accent)]/15 p-4"
            >
              <div className="mb-1 flex items-center gap-2">
                <Activity className="h-4 w-4 text-[var(--cc-accent-dark)]" />
                <span className="text-xl font-bold tabular-nums">{insight.value}</span>
              </div>
              <p className={cn("text-xs font-medium", PORTAL_TEXT)}>{insight.label}</p>
              <p className={cn("mt-1 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{insight.description}</p>
            </div>
          ))}
        </div>
      )}
    </InstructorPolicySurfaceCard>
  )

  if (embedInDashboard) {
    return (
      <div className="space-y-4">
        <CoraSectionTools
          meta="Topics from Cora chat content"
          trailing={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label="Refresh analytics"
              disabled={refreshing}
              onClick={() => void fetchAnalytics(true)}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
          }
        />
        {charts}
        {insightCards}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {charts}
      {insightCards}
    </div>
  )
}
