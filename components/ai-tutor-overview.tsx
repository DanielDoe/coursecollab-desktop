"use client"

import { useState, useEffect, type ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  TrendingUp, Clock, Target, Award, AlertCircle,
  Sparkles, Info, BookOpen, Lightbulb, Loader2, BarChart3, Zap,
  MessageSquare, Presentation, Code, FileText, Layers, Megaphone, LayoutDashboard, Search, RefreshCw,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { motion } from "framer-motion"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"
import { InstructorPolicySurfaceCard } from "@/components/instructor/InstructorPolicySurfaceCard"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { CoraSectionTools } from "@/components/instructor/administration/CoraSectionTools"
import { Button } from "@/components/ui/button"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts"

interface AIStats {
  totalQuestions: number
  activeStudents: number
  averageResponseTime: number
  satisfactionScore: number
  strugglingStudents: number
  weeklyGrowth: number
}

interface AITutorOverviewProps {
  stats: AIStats
  embedInDashboard?: boolean
}

interface WeeklyData {
  day: string
  questions: number
  students: number
}

interface TopTopic {
  topic: string
  questions: number
  mastery: number
  struggling_count: number
}

interface AIInsight {
  type: 'peak_time' | 'misconception' | 'recommendation' | 'success'
  title: string
  description: string
}

interface ModuleUsage {
  module: string
  questions: number
  students: number
  icon?: string
  color: string
}

const MODULE_ICONS: Record<string, LucideIcon> = {
  MessageSquare,
  Presentation,
  Code,
  FileText,
  Layers,
  BookOpen,
  Target,
  BarChart3,
  Megaphone,
  LayoutDashboard,
  Search,
  Sparkles,
}

const MODULE_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

export function AITutorOverview({ stats, embedInDashboard }: AITutorOverviewProps) {
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([])
  const [topTopics, setTopTopics] = useState<TopTopic[]>([])
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [moduleUsage, setModuleUsage] = useState<ModuleUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchOverviewData()
  }, [])

  const fetchOverviewData = async (silent = false) => {
    if (silent) setRefreshing(true)
    try {
      const [weeklyResponse, topicsResponse, insightsResponse, moduleResponse] = await Promise.all([
        instructorApiFetch('/api/instructor/ai-tutor/weekly-activity', { headers: buildInstructorApiHeaders() }),
        instructorApiFetch('/api/instructor/ai-tutor/hot-topics', { headers: buildInstructorApiHeaders() }),
        instructorApiFetch('/api/instructor/ai-tutor/insights', { headers: buildInstructorApiHeaders() }),
        instructorApiFetch('/api/instructor/ai-tutor/module-usage', { headers: buildInstructorApiHeaders() })
      ])

      const weeklyData = await weeklyResponse.json()
      const topicsData = await topicsResponse.json()
      const insightsData = await insightsResponse.json()
      const moduleData = await moduleResponse.json()

      setWeeklyData(weeklyData.weeklyData || [])
      setTopTopics(topicsData.topics || [])
      setInsights(insightsData.insights || [])
      setModuleUsage(moduleData.modules || [])
    } catch (error) {
      console.error('Failed to fetch overview data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const getInsightConfig = (type: string) => {
    const configs = {
      peak_time: {
        icon: Clock,
        color: 'text-blue-900 dark:text-blue-100',
        textColor: 'text-blue-700 dark:text-blue-300',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        borderColor: 'border-blue-200 dark:border-blue-800',
        iconBg: 'bg-blue-100 dark:bg-blue-900/40'
      },
      misconception: {
        icon: AlertCircle,
        color: 'text-orange-900 dark:text-orange-100',
        textColor: 'text-orange-700 dark:text-orange-300',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        borderColor: 'border-orange-200 dark:border-orange-800',
        iconBg: 'bg-orange-100 dark:bg-orange-900/40'
      },
      recommendation: {
        icon: Lightbulb,
        color: 'text-green-900 dark:text-green-100',
        textColor: 'text-green-700 dark:text-green-300',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        borderColor: 'border-green-200 dark:border-green-800',
        iconBg: 'bg-green-100 dark:bg-green-900/40'
      },
      success: {
        icon: Award,
        color: 'text-purple-900 dark:text-purple-100',
        textColor: 'text-purple-700 dark:text-purple-300',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        borderColor: 'border-purple-200 dark:border-purple-800',
        iconBg: 'bg-purple-100 dark:bg-purple-900/40'
      }
    }
    return configs[type as keyof typeof configs] || configs.recommendation
  }

  if (loading) {
    if (embedInDashboard) {
      return <InstructorPolicyLoadingState moduleId="ai-assistant-settings" label="Loading overview…" />
    }
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const shell = (
    title: string,
    description: string | undefined,
    children: ReactNode,
    legacyClass: string,
  ) =>
    embedInDashboard ? (
      <InstructorPolicySurfaceCard variant="section" title={title} description={description}>
        {children}
      </InstructorPolicySurfaceCard>
    ) : (
      <div className={legacyClass}>{children}</div>
    )

  return (
    <div className={embedInDashboard ? "space-y-4" : "space-y-6"}>
      {embedInDashboard ? (
        <CoraSectionTools
          meta={`${stats.activeStudents} active · ${stats.totalQuestions} questions`}
          trailing={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label="Refresh overview"
              disabled={refreshing}
              onClick={() => void fetchOverviewData(true)}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
          }
        />
      ) : null}
      {shell(
        "Cora usage by module",
        "Where students opened Cora — inferred from chat content, not a stored source tag",
        moduleUsage.length === 0 ? (
          <div className="py-10 text-center">
            <Info className="mx-auto mb-3 h-10 w-10 text-[var(--cc-text-muted)]/50" />
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No Cora usage in this course yet</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={moduleUsage}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.module}: ${entry.questions}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="questions"
                  >
                    {moduleUsage.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={MODULE_COLORS[index % MODULE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {moduleUsage.map((module, index) => {
                const Icon = MODULE_ICONS[module.icon ?? ""] ?? Sparkles
                return (
                  <div
                    key={module.module}
                    className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--sidebar-accent)]/15 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="rounded-lg p-2"
                        style={{ backgroundColor: `${MODULE_COLORS[index % MODULE_COLORS.length]}20` }}
                      >
                        <Icon className="h-4 w-4" style={{ color: MODULE_COLORS[index % MODULE_COLORS.length] }} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{module.module}</div>
                        <div className={cn("text-xs", PORTAL_TEXT_MUTED)}>{module.students} students</div>
                      </div>
                    </div>
                    <Badge variant="secondary">{module.questions} Q&apos;s</Badge>
                  </div>
                )
              })}
            </div>
          </div>
        ),
        "rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm p-6",
      )}

      {shell(
        "Weekly activity",
        "Combined AI usage across lectures, practice, and chat",
        <>
          {stats.weeklyGrowth !== 0 && !embedInDashboard ? (
            <div className="mb-4 flex justify-end">
              <Badge
                className={
                  stats.weeklyGrowth > 0
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                }
              >
                <TrendingUp className="mr-1 h-3 w-3" />
                {stats.weeklyGrowth > 0 ? "+" : ""}
                {stats.weeklyGrowth}% this week
              </Badge>
            </div>
          ) : null}
          {weeklyData.length === 0 ? (
            <div className="py-12 text-center">
              <BarChart3 className="mx-auto mb-3 h-10 w-10 text-[var(--cc-text-muted)]/50" />
              <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No activity data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--cc-text-muted)" />
                <YAxis stroke="var(--cc-text-muted)" />
                <Tooltip />
                <Line type="monotone" dataKey="questions" stroke="var(--cc-sem-ai)" strokeWidth={2} name="Questions" />
                <Line type="monotone" dataKey="students" stroke="var(--cc-sem-info)" strokeWidth={2} name="Students" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </>,
        "rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm p-6",
      )}

      <div className={embedInDashboard ? "grid gap-4 md:grid-cols-2" : "grid md:grid-cols-2 gap-6"}>
        {shell(
          "Hot topics",
          "Course topics taken from what students actually asked Cora — not auto-detect labels",
          topTopics.length === 0 ? (
            <div className="py-10 text-center">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-[var(--cc-text-muted)]/50" />
              <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No topic data yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topTopics.map((topic, index) => (
                <motion.div
                  key={topic.topic}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.06 }}
                  className="rounded-xl border border-[var(--border)] bg-[var(--sidebar-accent)]/15 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{topic.topic}</span>
                      {topic.struggling_count > 3 ? (
                        <Badge className="bg-[var(--cc-sem-danger)] text-xs text-white">
                          {topic.struggling_count} struggling
                        </Badge>
                      ) : null}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {topic.questions} Q&apos;s
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={topic.mastery} className="h-2" />
                    <span className={cn("whitespace-nowrap text-xs", PORTAL_TEXT_MUTED)}>{topic.mastery}%</span>
                  </div>
                </motion.div>
              ))}
            </div>
          ),
          "rounded-2xl border border-slate-200/60 p-6 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85",
        )}

        {shell(
          "Insights",
          "Recommendations from student AI usage patterns",
          insights.length === 0 ? (
            <div className="py-10 text-center">
              <Info className="mx-auto mb-3 h-10 w-10 text-[var(--cc-text-muted)]/50" />
              <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No insights yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {insights.map((insight, index) => {
                const config = getInsightConfig(insight.type)
                const Icon = config.icon
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06 }}
                    className={cn(
                      "rounded-xl border p-3",
                      embedInDashboard
                        ? "border-[var(--border)] bg-[var(--sidebar-accent)]/15"
                        : `${config.bgColor} ${config.borderColor}`,
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-[var(--cc-accent-soft)] p-2 text-[var(--cc-accent-dark)]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="mb-1 text-sm font-semibold">{insight.title}</h4>
                        <p className={cn("text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{insight.description}</p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ),
          "rounded-2xl border border-slate-200/60 p-6 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85",
        )}
      </div>
    </div>
  )
}
