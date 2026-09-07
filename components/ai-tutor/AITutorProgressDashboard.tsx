"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  TrendingUp,
  Brain,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  MessageSquare,
  Target,
  Calendar,
  Award,
  BookOpen,
  Zap,
  CheckCircle2,
  Clock,
  ArrowUp,
  ArrowDown
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import {
  portalAccentIconClass,
  portalProgressFillClass,
} from "@/lib/portal-module-themes"

const aiTutorTheme = getStudentModuleTheme("ai-tutor")

interface AITutorProgressData {
  conceptMastery: Array<{
    topic: string
    mastery: number
    questionsAsked: number
    accuracy: number
    lastPracticed: string
  }>
  reasoningScore: number
  reasoningHistory: Array<{ week: string; score: number }>
  misconceptions: Array<{
    name: string
    topic: string
    occurrences: number
    severity: "minor" | "moderate" | "severe"
  }>
  behaviorInsights: {
    avgQuestionDepth: number
    curiosityIndex: number
    struggleDetection: number
    independenceScore: number
  }
  interactionTrends: {
    conceptQuestions: number
    debugQuestions: number
    totalInteractions: number
    weeklyPattern: Record<number, number>
  }
  conversationTimeline: Array<{
    id: number
    date: string
    topic: string
    messagePreview: string
    responseTime: number
    satisfaction: number
  }>
  conceptHeatmap: Record<string, number>
}

interface AITutorProgressDashboardProps {
  studentId: string
  embedInDashboard?: boolean
}

export function AITutorProgressDashboard({
  studentId,
  embedInDashboard = false,
}: AITutorProgressDashboardProps) {
  const [data, setData] = useState<AITutorProgressData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!studentId) return

    const fetchProgress = async () => {
      try {
        const response = await fetch(`/api/ai-tutor/progress-detailed?studentId=${studentId}`)
        if (response.ok) {
          const progressData = await response.json()
          setData(progressData)
        }
      } catch (error) {
        console.error("Failed to fetch AI Tutor progress:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchProgress()
  }, [studentId])

  if (loading) {
    return (
      <div className={cn(embedInDashboard ? "space-y-3 animate-pulse" : "flex items-center justify-center h-64")}>
        {embedInDashboard ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-[var(--muted)]/40" />
              ))}
            </div>
            <div className="h-32 rounded-xl bg-[var(--muted)]/40" />
          </>
        ) : (
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#582c83] dark:border-[#b8a0e0]" />
        )}
      </div>
    )
  }

  if (!data) {
    return (
      <p className={cn("text-sm text-center py-8", embedInDashboard ? "text-[var(--cc-text-muted)] rounded-xl bg-[var(--muted)]/30" : "text-slate-500")}>
        No progress data yet. Chat with your AI Tutor to start tracking.
      </p>
    )
  }

  // API may return partial shapes (e.g. interactionTrends {} without weeklyPattern when no chats)
  const behaviorInsights = {
    avgQuestionDepth: data.behaviorInsights?.avgQuestionDepth ?? 0,
    curiosityIndex: data.behaviorInsights?.curiosityIndex ?? 0,
    struggleDetection: data.behaviorInsights?.struggleDetection ?? 0,
    independenceScore: data.behaviorInsights?.independenceScore ?? 0,
  }
  const interactionTrends = {
    conceptQuestions: data.interactionTrends?.conceptQuestions ?? 0,
    debugQuestions: data.interactionTrends?.debugQuestions ?? 0,
    totalInteractions: data.interactionTrends?.totalInteractions ?? 0,
    weeklyPattern: data.interactionTrends?.weeklyPattern ?? ({} as Record<number, number>),
  }
  const conceptHeatmap = data.conceptHeatmap ?? {}
  const conceptMastery = data.conceptMastery ?? []
  const misconceptions = data.misconceptions ?? []
  const reasoningHistory = data.reasoningHistory ?? []
  const conversationTimeline = data.conversationTimeline ?? []

  const getMasteryColor = (mastery: number) => {
    if (mastery >= 80) return "text-green-600"
    if (mastery >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const getMasteryBgColor = (mastery: number) => {
    if (mastery >= 80) return "bg-green-100 dark:bg-green-900/30"
    if (mastery >= 60) return "bg-yellow-100 dark:bg-yellow-900/30"
    return "bg-red-100 dark:bg-red-900/30"
  }

  const getSeverityColor = (severity: string) => {
    if (severity === "severe") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    if (severity === "moderate") return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
  }

  const heatmapValues = Object.values(conceptHeatmap)
  const maxHeatmapValue = heatmapValues.length > 0 ? Math.max(...heatmapValues, 1) : 1

  if (embedInDashboard) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="rounded-xl bg-[var(--muted)]/30 px-3 py-2.5 min-w-0">
            <p className="text-xs text-[var(--cc-text-muted)]">Reasoning</p>
            <p className={cn("text-lg font-semibold tabular-nums", aiTutorTheme.page.iconText)}>
              {data.reasoningScore}
            </p>
          </div>
          <div className="rounded-xl bg-[var(--muted)]/30 px-3 py-2.5 min-w-0">
            <p className="text-xs text-[var(--cc-text-muted)]">Curiosity</p>
            <p className="text-lg font-semibold tabular-nums text-[var(--cc-text)]">
              {behaviorInsights.curiosityIndex}%
            </p>
          </div>
          <div className="rounded-xl bg-[var(--muted)]/30 px-3 py-2.5 min-w-0">
            <p className="text-xs text-[var(--cc-text-muted)]">Independence</p>
            <p className="text-lg font-semibold tabular-nums text-[var(--cc-text)]">
              {behaviorInsights.independenceScore}%
            </p>
          </div>
          <div className="rounded-xl bg-[var(--muted)]/30 px-3 py-2.5 min-w-0">
            <p className="text-xs text-[var(--cc-text-muted)]">Interactions</p>
            <p className="text-lg font-semibold tabular-nums text-[var(--cc-text)]">
              {interactionTrends.totalInteractions}
            </p>
          </div>
        </div>

        <Progress
          value={data.reasoningScore}
          className="h-1.5 bg-[var(--muted)] [&_[data-slot=progress-indicator]]:!bg-[var(--cc-accent)]"
        />

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--cc-text-muted)] px-0.5">
            Concept mastery
          </p>
          {conceptMastery.length === 0 ? (
            <p className="text-sm text-[var(--cc-text-muted)] px-3 py-3 rounded-xl bg-[var(--muted)]/30">
              No concept data yet.
            </p>
          ) : (
            conceptMastery.slice(0, 8).map((concept) => (
              <div
                key={concept.topic}
                className="rounded-xl px-3 py-2.5 hover:bg-[var(--muted)]/45 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-medium text-[var(--cc-text)] truncate">{concept.topic}</span>
                  <span className="text-sm font-semibold tabular-nums shrink-0">{concept.mastery}%</span>
                </div>
                <Progress
                  value={concept.mastery}
                  className="h-1.5 bg-[var(--muted)] [&_[data-slot=progress-indicator]]:!bg-[var(--cc-accent)]"
                />
              </div>
            ))
          )}
        </div>

        {misconceptions.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--cc-text-muted)] px-0.5">
              Watch areas
            </p>
            {misconceptions.slice(0, 4).map((m) => (
              <div
                key={m.name}
                className="flex items-center justify-between gap-3 rounded-xl bg-[var(--muted)]/30 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--cc-text)] truncate">{m.name}</p>
                  <p className="text-xs text-[var(--cc-text-muted)]">{m.topic}</p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                  {m.severity}
                </Badge>
              </div>
            ))}
          </div>
        ) : null}

        {conversationTimeline.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--cc-text-muted)] px-0.5">
              Recent chats
            </p>
            {conversationTimeline.slice(0, 5).map((c) => (
              <div
                key={c.id}
                className="rounded-xl px-3 py-2.5 hover:bg-[var(--muted)]/45 transition-colors"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                    {c.topic}
                  </Badge>
                  <span className="text-[11px] text-[var(--cc-text-muted)]">
                    {new Date(c.date).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-[var(--cc-text-muted)] truncate">{c.messagePreview}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn("text-3xl font-bold", aiTutorTheme.page.iconText)}>
            My Learning Progress
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Track your reasoning skills, conceptual mastery, and learning journey
          </p>
        </div>
      </div>

      {/* Reasoning Skill Score */}
      <Card className={cn("border", aiTutorTheme.page.border, aiTutorTheme.page.softBg)}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className={cn("h-5 w-5", portalAccentIconClass(aiTutorTheme))} />
            <CardTitle className="text-slate-900 dark:text-white">Reasoning Skill Score</CardTitle>
          </div>
          <CardDescription className="text-slate-600 dark:text-slate-400">
            Measures clarity of explanations, correctness of reasoning, and depth of understanding
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-4">
            <div className={cn("text-5xl font-bold", aiTutorTheme.page.iconText)}>
              {data.reasoningScore}
            </div>
            <div className="text-2xl text-slate-400">/ 100</div>
            {reasoningHistory.length > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <ArrowUp className="h-5 w-5 text-green-600" />
                <span className="text-green-600 font-semibold">
                  +{reasoningHistory[0].score - data.reasoningScore} this week
                </span>
              </div>
            )}
          </div>
          <Progress
            value={data.reasoningScore}
            className={cn(
              "mt-4 h-3 bg-slate-200/80 dark:bg-white/10",
              "[&_[data-slot=progress-indicator]]:bg-[#582c83] dark:[&_[data-slot=progress-indicator]]:bg-[#7a4eba]",
            )}
          />
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-slate-600 dark:text-slate-400">Question Depth</div>
              <div className="font-semibold text-slate-900 dark:text-white">{behaviorInsights.avgQuestionDepth} chars</div>
            </div>
            <div>
              <div className="text-slate-600 dark:text-slate-400">Curiosity Index</div>
              <div className="font-semibold text-slate-900 dark:text-white">{behaviorInsights.curiosityIndex}%</div>
            </div>
            <div>
              <div className="text-slate-600 dark:text-slate-400">Independence</div>
              <div className="font-semibold text-slate-900 dark:text-white">{behaviorInsights.independenceScore}%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Concept Mastery Map */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <CardTitle>Concept Mastery Map</CardTitle>
            </div>
            <CardDescription>AI-inferred mastery based on your chat interactions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {conceptMastery.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No concept data yet</p>
            ) : (
              conceptMastery.slice(0, 6).map((concept, idx) => (
                <motion.div
                  key={concept.topic}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{concept.topic}</span>
                    <div className="flex items-center gap-2">
                      <Badge className={cn("text-xs", getMasteryBgColor(concept.mastery), getMasteryColor(concept.mastery))}>
                        {concept.mastery}%
                      </Badge>
                      <span className="text-xs text-slate-500">{concept.questionsAsked} questions</span>
                    </div>
                  </div>
                  <Progress value={concept.mastery} className="h-2" />
                  <div className="text-xs text-slate-500">
                    {concept.mastery >= 80 ? "Strong understanding" : 
                     concept.mastery >= 60 ? "Developing understanding" : 
                     "Needs more practice"}
                  </div>
                </motion.div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Misconception Tracker */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <CardTitle>Misconception Tracker</CardTitle>
            </div>
            <CardDescription>Recurring misunderstandings identified during chat</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {misconceptions.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No major misconceptions detected!</p>
              </div>
            ) : (
              misconceptions.map((misconception, idx) => (
                <motion.div
                  key={misconception.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{misconception.name}</span>
                      <Badge className={cn("text-xs", getSeverityColor(misconception.severity))}>
                        {misconception.severity}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {misconception.topic} • {misconception.occurrences} occurrence{misconception.occurrences !== 1 ? 's' : ''}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Learning Behavior Insights */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-600" />
            <CardTitle>Learning Behavior Insights</CardTitle>
          </div>
          <CardDescription>How you learn and interact with the AI Tutor</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 dark:border-blue-500/30">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{behaviorInsights.avgQuestionDepth}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Avg Question Depth</div>
            </div>
            <div className={cn("text-center p-4 rounded-lg border", aiTutorTheme.page.softBg, aiTutorTheme.page.border)}>
              <div className={cn("text-2xl font-bold", aiTutorTheme.page.iconText)}>{behaviorInsights.curiosityIndex}%</div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Curiosity Index</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/20 dark:border-orange-500/30">
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{behaviorInsights.struggleDetection}%</div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Struggle Detection</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 dark:border-emerald-500/30">
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{behaviorInsights.independenceScore}%</div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Independence Score</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Tutor Interaction Trends */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className={cn("h-5 w-5", portalAccentIconClass(aiTutorTheme))} />
            <CardTitle>AI Tutor Interaction Trends</CardTitle>
          </div>
          <CardDescription>Your usage patterns and question types</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div className={cn("p-4 rounded-lg border", aiTutorTheme.page.softBg, aiTutorTheme.page.border)}>
              <div className={cn("text-2xl font-bold", aiTutorTheme.page.iconText)}>{interactionTrends.conceptQuestions}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Concept Questions</div>
            </div>
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30">
              <div className="text-2xl font-bold text-red-600">{interactionTrends.debugQuestions}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Debug Questions</div>
            </div>
            <div className={cn("p-4 rounded-lg border", aiTutorTheme.page.softBg, aiTutorTheme.page.border)}>
              <div className={cn("text-2xl font-bold", aiTutorTheme.page.iconText)}>{interactionTrends.totalInteractions}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Total Interactions</div>
            </div>
          </div>
          
          {/* Weekly Pattern */}
          {Object.keys(interactionTrends.weeklyPattern).length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium mb-2">Weekly Engagement Pattern</div>
              <div className="flex gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                  const count = interactionTrends.weeklyPattern[idx] || 0
                  const maxCount = Math.max(...Object.values(interactionTrends.weeklyPattern), 1)
                  const height = (count / maxCount) * 100
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center">
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-t" style={{ height: `${Math.max(height, 10)}px` }}>
                        <div className={cn("h-full rounded-t", portalProgressFillClass(aiTutorTheme))}></div>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{day}</div>
                      <div className="text-xs font-semibold">{count}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Concept Review Heatmap */}
      {Object.keys(conceptHeatmap).length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className={cn("h-5 w-5", portalAccentIconClass(aiTutorTheme))} />
              <CardTitle>Concept Review Heatmap</CardTitle>
            </div>
            <CardDescription>Topics you discuss most frequently</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(conceptHeatmap)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 8)
                .map(([topic, count]) => {
                  const intensity = (count / maxHeatmapValue) * 100
                  return (
                    <div key={topic} className="flex items-center gap-3">
                      <span className="w-32 text-sm font-medium">{topic}</span>
                      <div className="flex-1 h-6 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", portalProgressFillClass(aiTutorTheme))}
                          style={{ width: `${intensity}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold w-12 text-right">{count}</span>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conversation Timeline */}
      {conversationTimeline.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className={cn("h-5 w-5", portalAccentIconClass(aiTutorTheme))} />
              <CardTitle>Recent Learning Journey</CardTitle>
            </div>
            <CardDescription>Your conversation history with insights</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {conversationTimeline.slice(0, 10).map((conversation, idx) => (
                <motion.div
                  key={conversation.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex gap-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-[#582c83] dark:bg-[#7a4eba] mt-2"></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={cn("text-xs", aiTutorTheme.page.badge)}>
                        {conversation.topic}
                      </Badge>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(conversation.date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                      {conversation.messagePreview}...
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {conversation.responseTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {Math.round(conversation.responseTime / 1000)}s
                        </span>
                      )}
                      {conversation.satisfaction && (
                        <span className="flex items-center gap-1">
                          <Award className="h-3 w-3" />
                          {conversation.satisfaction}/5
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
