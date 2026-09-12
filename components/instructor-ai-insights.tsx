"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle,
  Brain,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { DashboardKpiCard } from "@/components/dashboard-v2/DashboardKpiCard"
import { cn } from "@/lib/utils"
import { getFacultyModuleTheme } from "@/lib/faculty-module-themes"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

type InsightSummary = {
  tutor: {
    conversations14d: number
    uniqueStudents14d: number
    uniqueTopics14d: number
  }
  mastery: {
    avgMastery: number
    studentsTracked: number
    topicsTracked: number
  }
  earlyWarningCount: number
  recentInsights: Array<{ type: string; createdAt: string; preview: string }>
}

export function InstructorAIInsights({
  instructorId,
  embedInDashboard = false,
}: {
  instructorId?: string
  embedInDashboard?: boolean
}) {
  const fp = getFacultyModuleTheme("cora-insights").page
  const cardBase = PORTAL_CARD
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [summary, setSummary] = useState<InsightSummary | null>(null)
  const [predictions, setPredictions] = useState<Record<string, unknown> | null>(null)
  const [activeTab, setActiveTab] = useState("overview")

  const loadSummary = () => {
    setLoading(true)
    instructorApiFetch("/api/instructor/ai-insights/summary", { headers: buildInstructorApiHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data?.error || !data?.tutor || !data?.mastery) {
          setSummary(null)
          return
        }
        setSummary(data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadSummary()
  }, [])

  const generatePredictions = async () => {
    setGenerating("predictive")
    try {
      const res = await instructorApiFetch("/api/instructor/ai-insights/predictive-analytics", {
        method: "POST",
        headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ examTopic: "mid-semester", days: 14 }),
      })
      const data = await res.json()
      if (data.success) setPredictions(data)
      loadSummary()
    } catch (e) {
      console.error(e)
    } finally {
      setGenerating(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">Loading AI insights…</p>
        </div>
      </div>
    )
  }

  const predList = Array.isArray(predictions?.predictions) ? predictions.predictions as Array<Record<string, unknown>> : []
  const predSummary = predictions?.summary as Record<string, unknown> | undefined

  const cardClass = embedInDashboard
    ? "border-slate-200/60 bg-white/80 shadow-sm backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03] rounded-xl"
    : ""

  return (
    <div className={cn("space-y-4 sm:space-y-6", embedInDashboard ? "" : "p-2")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        {!embedInDashboard ? (
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              <Brain className="h-3.5 w-3.5" />
              Cora analytics
            </div>
            <h2 className="text-xl font-bold tracking-tight">Cora Insights</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Predictions, learning gaps, and intervention ideas from Cora chats and assessments.
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Predictions, learning gaps, and intervention ideas from Cora chats and assessments.
          </p>
        )}
        <Button variant="outline" size="sm" onClick={loadSummary} className="gap-2 rounded-lg">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {embedInDashboard ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <DashboardKpiCard
            label="Cora conversations (14d)"
            value={summary?.tutor?.conversations14d ?? 0}
            sub={`${summary?.tutor?.uniqueStudents14d ?? 0} students · ${summary?.tutor?.uniqueTopics14d ?? 0} topics`}
            icon={Brain}
            iconBg="bg-violet-500/10"
            iconColor="text-violet-600 dark:text-violet-400"
          />
          <DashboardKpiCard
            label="Avg topic mastery"
            value={`${summary?.mastery?.avgMastery ?? 0}%`}
            sub={`${summary?.mastery?.studentsTracked ?? 0} students tracked`}
            icon={Target}
            iconBg="bg-sky-500/10"
            iconColor="text-sky-600 dark:text-sky-400"
          />
          <DashboardKpiCard
            label="Early warnings"
            value={summary?.earlyWarningCount ?? 0}
            sub="Repeated topic questions (7d)"
            icon={AlertTriangle}
            iconBg="bg-amber-500/10"
            iconColor="text-amber-600 dark:text-amber-400"
            valueClassName="text-amber-700 dark:text-amber-400"
          />
          <DashboardKpiCard
            label="Stored insights"
            value={summary?.recentInsights?.length ?? 0}
            sub="Recent AI-generated analyses"
            icon={Sparkles}
            iconBg="bg-emerald-500/10"
            iconColor={fp.iconText}
          />
        </div>
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Brain className="h-4 w-4" /> AI Conversations (14d)</CardDescription>
            <CardTitle className="text-2xl">{summary?.tutor?.conversations14d ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {summary?.tutor?.uniqueStudents14d ?? 0} students · {summary?.tutor?.uniqueTopics14d ?? 0} topics
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Target className="h-4 w-4" /> Avg Topic Mastery</CardDescription>
            <CardTitle className="text-2xl">{summary?.mastery?.avgMastery ?? 0}%</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {summary?.mastery?.studentsTracked ?? 0} students tracked
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /> Early Warnings</CardDescription>
            <CardTitle className="text-2xl text-amber-700">{summary?.earlyWarningCount ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Repeated topic questions (7d)</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-600" /> Stored Insights</CardDescription>
            <CardTitle className="text-2xl">{summary?.recentInsights?.length ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Recent AI-generated analyses</CardContent>
        </Card>
      </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={cn(
          "grid w-full",
          embedInDashboard ? "grid-cols-3 h-auto gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-white/[0.04]" : "grid-cols-3 lg:w-auto lg:grid-cols-3"
        )}>
          <TabsTrigger value="overview" className={embedInDashboard ? "rounded-lg text-xs sm:text-sm" : ""}>Overview</TabsTrigger>
          <TabsTrigger value="predictive" className={embedInDashboard ? "rounded-lg text-xs sm:text-sm" : ""}>Predictive Analytics</TabsTrigger>
          <TabsTrigger value="history" className={embedInDashboard ? "rounded-lg text-xs sm:text-sm" : ""}>Insight History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: TrendingUp, title: "Predictive Analytics", desc: "Forecast exam outcomes and identify at-risk students from AI tutor + quiz data", action: generatePredictions, key: "predictive" },
              { icon: Lightbulb, title: "Learning Gaps", desc: "Compare expected curriculum topics vs actual student AI interactions", action: null, key: "gaps" },
              { icon: Zap, title: "Interventions", desc: "AI-generated action plans based on struggle patterns and hot topics", action: null, key: "interventions" },
            ].map((item) => (
              <Card key={item.key} className={cn(embedInDashboard ? cardClass : "border-violet-100")}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <item.icon className="h-5 w-5 text-violet-600" />
                    {item.title}
                  </CardTitle>
                  <CardDescription>{item.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  {item.action ? (
                    <Button
                      size="sm"
                      onClick={item.action}
                      disabled={generating === item.key}
                      className="gap-2"
                    >
                      {generating === item.key ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Generate Analysis
                    </Button>
                  ) : (
                    <Badge variant="secondary">API Ready</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="predictive" className="mt-4">
          <Card className={cardClass}>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>At-Risk Predictions</CardTitle>
                  <CardDescription>LLM analysis of engagement, quiz performance, and topic mastery</CardDescription>
                </div>
                <Button size="sm" onClick={generatePredictions} disabled={generating === "predictive"} className="gap-2">
                  {generating === "predictive" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Run Prediction
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {predSummary ? (
                <div className="mb-4 flex flex-wrap gap-3">
                  <Badge variant="destructive">High Risk: {String(predSummary.highRiskCount ?? 0)}</Badge>
                  <Badge className="bg-amber-500">Medium: {String(predSummary.mediumRiskCount ?? 0)}</Badge>
                  <Badge variant="secondary">Low: {String(predSummary.lowRiskCount ?? 0)}</Badge>
                </div>
              ) : null}
              {predList.length > 0 ? (
                <div className="space-y-3">
                  {predList.slice(0, 8).map((p, i) => (
                    <div key={i} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{String(p.studentName ?? "Student")}</span>
                        <Badge variant={p.riskLevel === "high" ? "destructive" : p.riskLevel === "medium" ? "default" : "secondary"}>
                          {String(p.riskLevel ?? "unknown")} risk
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Predicted score: {String(p.predictedExamScore ?? "—")}% · Confidence: {String(p.confidenceLevel ?? "—")}%
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Click &quot;Run Prediction&quot; to generate at-risk forecasts from live student data.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className={cardClass}>
            <CardHeader>
              <CardTitle>Recent Cora analyses</CardTitle>
              <CardDescription>Previously generated analyses stored in the platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(summary?.recentInsights ?? []).length > 0 ? (
                summary!.recentInsights.map((insight, i) => (
                  <div key={i} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">{insight.type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(insight.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No stored insights yet. Generate predictive analytics to populate this history.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
