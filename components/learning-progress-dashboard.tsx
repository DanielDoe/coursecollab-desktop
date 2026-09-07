"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  TrendingUp,
  Trophy,
  Target,
  Calendar,
  Flame,
  Star,
  Award,
  BookOpen,
  Code,
  Zap,
  Crown,
  CheckCircle2,
  Lock,
  AlertCircle
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { portalAccentIconClass, portalProgressFillClass } from "@/lib/portal-module-themes"

const aiTutorTheme = getStudentModuleTheme("ai-tutor")
const BRAND_CHART = "#7a4eba"

interface TopicProgress {
  topic: string
  mastery: number
  questionsAsked: number
  lastPracticed: Date
  weaknessScore: number
  trend: 'improving' | 'stable' | 'declining'
}

interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  unlocked: boolean
  unlockedAt?: Date
  progress: number
  requirement: number
}

interface DailyChallenge {
  id: string
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
  question: string
  completed: boolean
  dueDate: Date
}

interface LearningProgressDashboardProps {
  studentId: string
  onProgressUpdate?: (topics: TopicProgress[]) => void
  embedInDashboard?: boolean
}

export function LearningProgressDashboard({
  studentId,
  onProgressUpdate,
  embedInDashboard = false,
}: LearningProgressDashboardProps) {
  const { toast } = useToast()
  const [topicProgress, setTopicProgress] = useState<TopicProgress[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(null)
  const [weeklyStreak, setWeeklyStreak] = useState(0)
  const [totalMasteryScore, setTotalMasteryScore] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProgressData()
    fetchAchievements()
    fetchDailyChallenge()
  }, [studentId])

  const fetchProgressData = async () => {
    try {
      const response = await fetch(`/api/ai-tutor/progress?studentId=${studentId}`)
      const data = await response.json()
      
      if (response.ok) {
        const topics = data.topics || generateMockTopics()
        setTopicProgress(topics)
        setWeeklyStreak(data.streak || 0)
        setTotalMasteryScore(data.overallMastery || 0)
        onProgressUpdate?.(topics)
      }
    } catch (error) {
      console.error("Failed to fetch progress:", error)
      // Use mock data for demonstration
      const mockTopics = generateMockTopics()
      setTopicProgress(mockTopics)
      onProgressUpdate?.(mockTopics)
    } finally {
      setLoading(false)
    }
  }

  const fetchAchievements = async () => {
    const mockAchievements: Achievement[] = [
      {
        id: 'first-question',
        title: 'First Steps',
        description: 'Ask your first question to the AI Tutor',
        icon: '🎯',
        unlocked: true,
        unlockedAt: new Date(),
        progress: 1,
        requirement: 1
      },
      {
        id: 'conversation-starter',
        title: 'Conversation Starter',
        description: 'Have a 10-message conversation',
        icon: '💬',
        unlocked: true,
        progress: 10,
        requirement: 10
      },
      {
        id: 'code-master',
        title: 'Code Master',
        description: 'Debug 5 code snippets successfully',
        icon: '🔧',
        unlocked: false,
        progress: 2,
        requirement: 5
      },
      {
        id: 'topic-explorer',
        title: 'Topic Explorer',
        description: 'Ask questions about 5 different topics',
        icon: '🧭',
        unlocked: false,
        progress: 3,
        requirement: 5
      },
      {
        id: 'week-warrior',
        title: 'Week Warrior',
        description: 'Maintain a 7-day learning streak',
        icon: '🔥',
        unlocked: false,
        progress: weeklyStreak,
        requirement: 7
      },
      {
        id: 'quiz-champion',
        title: 'Quiz Champion',
        description: 'Complete 10 AI-generated quizzes',
        icon: '🏆',
        unlocked: false,
        progress: 0,
        requirement: 10
      },
      {
        id: 'master-coder',
        title: 'Master Coder',
        description: 'Achieve 90%+ mastery in 3 topics',
        icon: '👑',
        unlocked: false,
        progress: 0,
        requirement: 3
      },
      {
        id: 'help-seeker',
        title: 'Help Seeker',
        description: 'Ask 50 questions total',
        icon: '⭐',
        unlocked: false,
        progress: 12,
        requirement: 50
      }
    ]
    setAchievements(mockAchievements)
  }

  const fetchDailyChallenge = async () => {
    // Generate daily challenge based on weakest topic
    const weakestTopic = topicProgress.length > 0 
      ? topicProgress.reduce((prev, current) => 
          current.mastery < prev.mastery ? current : prev
        )
      : null

    if (weakestTopic) {
      setDailyChallenge({
        id: `daily-${new Date().toDateString()}`,
        topic: weakestTopic.topic,
        difficulty: weakestTopic.mastery < 30 ? 'easy' : weakestTopic.mastery < 70 ? 'medium' : 'hard',
        question: `Practice problem on ${weakestTopic.topic}`,
        completed: false,
        dueDate: new Date(new Date().setHours(23, 59, 59))
      })
    }
  }

  const generateMockTopics = (): TopicProgress[] => {
    return [
      {
        topic: 'Variables',
        mastery: 85,
        questionsAsked: 12,
        lastPracticed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        weaknessScore: 15,
        trend: 'improving'
      },
      {
        topic: 'Loops',
        mastery: 45,
        questionsAsked: 8,
        lastPracticed: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        weaknessScore: 55,
        trend: 'stable'
      },
      {
        topic: 'Functions',
        mastery: 92,
        questionsAsked: 15,
        lastPracticed: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        weaknessScore: 8,
        trend: 'improving'
      },
      {
        topic: 'Arrays',
        mastery: 32,
        questionsAsked: 18,
        lastPracticed: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        weaknessScore: 68,
        trend: 'declining'
      },
      {
        topic: 'Pointers',
        mastery: 28,
        questionsAsked: 22,
        lastPracticed: new Date(Date.now() - 0.5 * 24 * 60 * 60 * 1000),
        weaknessScore: 72,
        trend: 'improving'
      },
      {
        topic: 'Classes',
        mastery: 65,
        questionsAsked: 10,
        lastPracticed: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        weaknessScore: 35,
        trend: 'stable'
      }
    ]
  }

  const getWeeklyProgressData = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return days.map((day, index) => ({
      name: day,
      mastery: 40 + (index * 8) + Math.random() * 10,
      questions: Math.floor(Math.random() * 5) + 1
    }))
  }

  const getRadarData = () => {
    return topicProgress.map(topic => ({
      topic: topic.topic,
      mastery: topic.mastery,
      fullMark: 100
    }))
  }

  const getMasteryColor = (mastery: number) => {
    if (mastery >= 80) return 'bg-emerald-600'
    if (mastery >= 60) return 'bg-sky-600'
    if (mastery >= 40) return 'bg-amber-600'
    return 'bg-rose-600'
  }

  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-green-500" />
    if (trend === 'declining') return <AlertCircle className="w-4 h-4 text-red-500" />
    return <Target className="w-4 h-4 text-blue-500" />
  }

  if (embedInDashboard) {
    const masteredCount = topicProgress.filter((t) => t.mastery >= 80).length

    if (loading) {
      return (
        <div className="space-y-3 animate-pulse">
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-[var(--muted)]/40" />
            ))}
          </div>
          <div className="h-24 rounded-xl bg-[var(--muted)]/40" />
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          <div className="flex items-center gap-3 rounded-xl bg-[var(--muted)]/30 px-3 py-2.5 min-w-0">
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", aiTutorTheme.page.iconBg)}>
              <Trophy className={cn("h-4 w-4", portalAccentIconClass(aiTutorTheme))} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[var(--cc-text-muted)]">Mastery</p>
              <p className={cn("text-lg font-semibold tabular-nums", aiTutorTheme.page.iconText)}>
                {totalMasteryScore}%
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-[var(--muted)]/30 px-3 py-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/10">
              <Flame className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[var(--cc-text-muted)]">Streak</p>
              <p className="text-lg font-semibold tabular-nums text-[var(--cc-text)]">
                {weeklyStreak}d
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-[var(--muted)]/30 px-3 py-2.5 min-w-0 sm:col-span-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
              <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[var(--cc-text-muted)]">Daily challenge</p>
              {dailyChallenge ? (
                <p className="text-sm font-medium text-[var(--cc-text)] truncate">{dailyChallenge.topic}</p>
              ) : (
                <p className="text-sm text-[var(--cc-text-muted)]">None yet</p>
              )}
            </div>
          </div>
        </div>

        {dailyChallenge ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl bg-[var(--muted)]/30 px-3 py-3">
            <p className="text-sm text-[var(--cc-text-muted)] min-w-0">{dailyChallenge.question}</p>
            <Button
              size="sm"
              className={cn("shrink-0 rounded-full", aiTutorTheme.page.cta)}
              onClick={() => toast({ title: "Challenge accepted!" })}
            >
              Start
            </Button>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--cc-text-muted)] px-0.5">
            Topics · {masteredCount}/{topicProgress.length} mastered
          </p>
          {topicProgress.length === 0 ? (
            <p className="text-sm text-[var(--cc-text-muted)] px-3 py-4 rounded-xl bg-[var(--muted)]/30">
              Ask the tutor a question to start tracking progress.
            </p>
          ) : (
            topicProgress
              .sort((a, b) => b.weaknessScore - a.weaknessScore)
              .map((topic) => (
                <div
                  key={topic.topic}
                  className="rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--muted)]/45"
                >
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-[var(--cc-text)] truncate">{topic.topic}</span>
                      {getTrendIcon(topic.trend)}
                      {topic.weaknessScore > 60 ? (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 shrink-0">
                          Focus
                        </Badge>
                      ) : null}
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-[var(--cc-text)] shrink-0">
                      {topic.mastery}%
                    </span>
                  </div>
                  <Progress
                    value={topic.mastery}
                    className="h-1.5 bg-[var(--muted)] [&_[data-slot=progress-indicator]]:!bg-[var(--cc-accent)]"
                  />
                  <p className="mt-1 text-[11px] text-[var(--cc-text-muted)]">
                    {topic.questionsAsked} questions · last {getDaysAgo(topic.lastPracticed)}d ago
                  </p>
                </div>
              ))
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Overall Mastery */}
        <Card className={cn("border-2", aiTutorTheme.page.softBg, aiTutorTheme.page.border)}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Trophy className={cn("w-5 h-5", portalAccentIconClass(aiTutorTheme))} />
              Overall Mastery
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-5xl font-bold mb-2", aiTutorTheme.page.iconText)}>
              {totalMasteryScore}%
            </div>
            <Progress
              value={totalMasteryScore}
              className={cn(
                "h-3 mb-2 bg-slate-200/80 dark:bg-white/10",
                "[&_[data-slot=progress-indicator]]:bg-[#582c83] dark:[&_[data-slot=progress-indicator]]:bg-[#7a4eba]",
              )}
            />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {topicProgress.filter(t => t.mastery >= 80).length} of {topicProgress.length} topics mastered
            </p>
          </CardContent>
        </Card>

        {/* Weekly Streak */}
        <Card className="border-2 border-orange-500/20 dark:border-orange-500/30 bg-orange-500/10 dark:bg-orange-500/15">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              Learning Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-orange-700 dark:text-orange-300 mb-2">
              {weeklyStreak} days
            </div>
            <Progress
              value={(weeklyStreak / 7) * 100}
              className={cn(
                "h-3 mb-2 bg-slate-200/80 dark:bg-white/10",
                "[&_[data-slot=progress-indicator]]:bg-orange-600 dark:[&_[data-slot=progress-indicator]]:bg-orange-500",
              )}
            />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {7 - weeklyStreak} days until Week Warrior badge!
            </p>
          </CardContent>
        </Card>

        {/* Daily Challenge */}
        <Card className="border-2 border-emerald-500/20 dark:border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Daily Challenge
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyChallenge ? (
              <div>
                <Badge className="mb-2 bg-emerald-600 text-white border-0">
                  {dailyChallenge.topic}
                </Badge>
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
                  {dailyChallenge.question}
                </p>
                <Button 
                  size="sm" 
                  className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => toast({ title: "Challenge accepted!" })}
                >
                  Start Challenge
                </Button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Loading challenge...</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Topic Mastery Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className={cn("w-5 h-5", portalAccentIconClass(aiTutorTheme))} />
            Topic Mastery & Weakness Detection
          </CardTitle>
          <CardDescription>
            AI-identified weak areas based on your questions and patterns
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {topicProgress.sort((a, b) => b.weaknessScore - a.weaknessScore).map((topic, index) => (
            <motion.div
              key={topic.topic}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${getMasteryColor(topic.mastery)} flex items-center justify-center text-white font-bold text-sm`}>
                    {topic.mastery}%
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{topic.topic}</span>
                      {getTrendIcon(topic.trend)}
                      {topic.weaknessScore > 60 && (
                        <Badge variant="destructive" className="text-xs">
                          Needs Practice
                        </Badge>
                      )}
                      {topic.mastery >= 80 && (
                        <Trophy className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {topic.questionsAsked} questions • Last practiced {getDaysAgo(topic.lastPracticed)}
                    </p>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast({ 
                    title: "Practice Mode",
                    description: `Starting ${topic.topic} practice...`
                  })}
                >
                  Practice Now
                </Button>
              </div>
              
              <Progress value={topic.mastery} className="h-2" />
            </motion.div>
          ))}
        </CardContent>
      </Card>

      {/* Progress Timeline */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Weekly Progress Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className={cn("w-5 h-5", portalAccentIconClass(aiTutorTheme))} />
              Weekly Progress
            </CardTitle>
            <CardDescription>Your mastery improvement over the past week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={getWeeklyProgressData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: "#94a3b8" }} />
                <YAxis stroke="#94a3b8" tick={{ fill: "#94a3b8" }} />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="mastery" 
                  stroke={BRAND_CHART} 
                  strokeWidth={3}
                  dot={{ fill: BRAND_CHART, r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Topic Radar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className={cn("w-5 h-5", portalAccentIconClass(aiTutorTheme))} />
              Skill Radar
            </CardTitle>
            <CardDescription>Visual overview of your topic strengths</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={getRadarData().slice(0, 6)}>
                <PolarGrid stroke="rgba(148,163,184,0.25)" />
                <PolarAngleAxis dataKey="topic" tick={{ fill: "#94a3b8" }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#94a3b8" }} />
                <Radar 
                  name="Mastery" 
                  dataKey="mastery" 
                  stroke={BRAND_CHART} 
                  fill={BRAND_CHART} 
                  fillOpacity={0.35}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Achievements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-600" />
            Achievements ({achievements.filter(a => a.unlocked).length}/{achievements.length})
          </CardTitle>
          <CardDescription>
            Unlock badges by learning and practicing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {achievements.map((achievement, index) => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={cn(
                  "relative overflow-hidden transition-all duration-200 py-0",
                  achievement.unlocked
                    ? "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/30 dark:border-amber-500/40 hover:shadow-lg"
                    : "bg-slate-100/80 dark:bg-white/[0.04] border-slate-200/70 dark:border-white/10 opacity-90",
                )}>
                  {achievement.unlocked && (
                    <div className="absolute top-0 right-0">
                      <Crown className="w-6 h-6 text-yellow-500" />
                    </div>
                  )}
                  {!achievement.unlocked && (
                    <div className="absolute top-2 right-2">
                      <Lock className="w-4 h-4 text-slate-400" />
                    </div>
                  )}
                  <CardContent className="p-4 text-center">
                    <div className="text-4xl mb-2">{achievement.icon}</div>
                    <p className="font-semibold text-sm mb-1 text-slate-900 dark:text-white">{achievement.title}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                      {achievement.description}
                    </p>
                    {!achievement.unlocked && (
                      <div>
                        <Progress 
                          value={(achievement.progress / achievement.requirement) * 100} 
                          className="h-1.5 mb-1"
                        />
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {achievement.progress}/{achievement.requirement}
                        </p>
                      </div>
                    )}
                    {achievement.unlocked && achievement.unlockedAt && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        ✓ Unlocked {achievement.unlockedAt.toLocaleDateString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Study Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            Personalized Study Plan
          </CardTitle>
          <CardDescription>
            AI-generated recommendations based on your weaknesses
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {topicProgress
            .filter(t => t.weaknessScore > 50)
            .sort((a, b) => b.weaknessScore - a.weaknessScore)
            .slice(0, 3)
            .map((topic, index) => (
              <motion.div
                key={topic.topic}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 rounded-lg border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <span className="font-semibold text-red-900 dark:text-red-100">
                        {topic.topic} Needs Attention
                      </span>
                      <Badge variant="destructive" className="text-xs">
                        {topic.weaknessScore}% weakness
                      </Badge>
                    </div>
                    <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                      You've asked {topic.questionsAsked} questions but only achieved {topic.mastery}% mastery.
                      {getDaysAgo(topic.lastPracticed) > 3 && ` Last practiced ${getDaysAgo(topic.lastPracticed)}.`}
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="border-red-300 hover:bg-red-100 dark:hover:bg-red-950/40"
                      >
                        <BookOpen className="w-3 h-3 mr-1" />
                        Review Lecture
                      </Button>
                      <Button 
                        size="sm"
                        className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
                      >
                        <Code className="w-3 h-3 mr-1" />
                        Practice Now
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

          {topicProgress.filter(t => t.weaknessScore > 50).length === 0 && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="font-semibold text-green-700 dark:text-green-300">
                Great job! No major weaknesses detected.
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Keep practicing to maintain your mastery levels.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Study Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className={cn("w-5 h-5", portalAccentIconClass(aiTutorTheme))} />
            This Week's Study Plan
          </CardTitle>
          <CardDescription>
            AI-generated schedule based on your weak topics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day, index) => {
              const weakTopics = topicProgress.filter(t => t.weaknessScore > 40).sort((a, b) => b.weaknessScore - a.weaknessScore)
              const todayTopic = weakTopics[index % weakTopics.length]
              
              return (
                <div
                  key={day}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-lg flex items-center justify-center text-white font-semibold",
                      index === 0 ? portalProgressFillClass(aiTutorTheme) : "bg-slate-400 dark:bg-slate-600",
                    )}>
                      {day.substring(0, 3)}
                    </div>
                    <div>
                      <p className="font-semibold">{todayTopic?.topic || 'Rest Day'}</p>
                      <p className="text-sm text-slate-500">
                        {todayTopic ? `30 min practice • ${Math.ceil(todayTopic.weaknessScore / 10)} exercises` : 'Review previous topics'}
                      </p>
                    </div>
                  </div>
                  {index === 0 && (
                    <Badge className={cn(aiTutorTheme.page.cta, "border-0")}>Today</Badge>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function getDaysAgo(date: Date): number {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

