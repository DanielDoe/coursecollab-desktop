"use client"

import { useState, useEffect } from "react"
import { Trophy, Medal, TrendingUp, Users, MessageSquare, Heart, ThumbsUp, ThumbsDown, Calendar, Zap, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { motion } from "framer-motion"
import { toast } from "@/lib/app-toast"
import { cn } from "@/lib/utils"
import { PROJECT_MODULE_SESSIONS } from "@/lib/project-module-sessions"
import { getStudentAuthHeaders } from "@/lib/auth"
import { PRIVACY_PLACEHOLDER_NAME } from "@/lib/student-privacy"
import { getStudentModuleTheme, studentModuleSpinnerClass } from "@/lib/student-module-themes"
import { portalOutlineButtonClass } from "@/lib/portal-module-themes"
import {
  PortalLeaderboardPodium,
  type PortalPodiumEntry,
} from "@/components/dashboard-v2/PortalLeaderboardPodium"

const projectsTheme = getStudentModuleTheme("projects")

interface LeaderboardData {
  leaderboard: Project[]
  stats: Stats
  sessionLeaders: SessionLeader[]
  trending: TrendingProject[]
}

interface Project {
  rank: number
  id: number
  title: string
  summary: string
  platform: string
  projectLink?: string | null
  timeline: string
  session: string
  createdAt: string
  engagementScore?: number
  totalScore?: number
  studentPoints?: number
  instructorPoints?: number
  voteCount?: number
  likeCount?: number
  commentCount?: number
  voteRatio?: number
  recentActivity?: number
  groupName: string
  leaderName: string
  leaderStudentId: string
  is_current_user?: boolean
}

interface Stats {
  totalProjects: number
  totalVotes: number
  totalLikes: number
  totalComments: number
  avgEngagement?: number
  maxEngagement?: number
}

interface SessionLeader {
  session: string
  projectCount: number
  avgEngagement?: number
  topScore?: number
}

interface TrendingProject {
  id: number
  title: string
  engagementScore?: number
  recentComments: number
  recentLikes: number
  trendingScore?: number
}

interface ProjectLeaderboardProps {
  currentSession?: string
  onProjectClick?: (projectId: number) => void
  embedInDashboard?: boolean
}

export function ProjectLeaderboard({ currentSession, onProjectClick, embedInDashboard = false }: ProjectLeaderboardProps) {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState(currentSession || "all")
  const [selectedTimeframe, setSelectedTimeframe] = useState("all")

  useEffect(() => {
    fetchLeaderboard()
  }, [selectedSession, selectedTimeframe])

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      const studentId = sessionStorage.getItem("studentDatabaseId")
      const params = new URLSearchParams({
        session: selectedSession === "all" ? "" : selectedSession,
        timeframe: selectedTimeframe,
        limit: "50"
      })
      if (studentId) params.set("studentId", studentId)

      const response = await fetch(`/api/projects/leaderboard?${params}`, {
        headers: getStudentAuthHeaders(),
      })
      if (response.ok) {
        const leaderboardData = await response.json()
        setData(leaderboardData)
      } else {
        toast.error("Failed to fetch leaderboard")
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error)
      toast.error("Failed to fetch leaderboard")
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500 dark:text-yellow-400" />
    if (rank === 2) return <Medal className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400 dark:text-gray-500" />
    if (rank === 3) return <Medal className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-500" />
    return <span className="text-base sm:text-lg font-bold text-slate-600 dark:text-slate-400">#{rank}</span>
  }

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-600 dark:from-yellow-500 dark:to-yellow-700 text-white text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1">🥇 1st</Badge>
    if (rank === 2) return <Badge className="bg-gradient-to-r from-gray-300 to-gray-500 dark:from-gray-400 dark:to-gray-600 text-white text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1">🥈 2nd</Badge>
    if (rank === 3) return <Badge className="bg-gradient-to-r from-amber-400 to-amber-600 dark:from-amber-500 dark:to-amber-700 text-white text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1">🥉 3rd</Badge>
    return <Badge variant="outline" className="text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1 dark:border-slate-700 dark:text-slate-300">#{rank}</Badge>
  }

  if (loading) {
    return (
      <Card className="w-full border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85">
        <CardContent className="flex items-center justify-center h-48 sm:h-64 p-4 sm:p-6">
          <div className="text-center">
            <div className={cn(
              "animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-2 border-slate-200 dark:border-slate-700 mx-auto mb-2 sm:mb-3",
              embedInDashboard ? studentModuleSpinnerClass("projects") : "border-b-2 border-indigo-500 dark:border-indigo-400 border-0",
            )} />
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <span className="sm:hidden">Loading...</span>
              <span className="hidden sm:inline">Loading leaderboard...</span>
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="w-full border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85">
        <CardContent className="flex items-center justify-center h-48 sm:h-64 p-4 sm:p-6">
          <div className="text-center text-slate-600 dark:text-slate-400">
            <Trophy className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-50 dark:text-slate-500" />
            <p className="text-xs sm:text-sm">
              <span className="sm:hidden">No data</span>
              <span className="hidden sm:inline">No leaderboard data available</span>
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const statItems = [
    { label: "Projects", value: data.stats.totalProjects, icon: Trophy },
    { label: "Votes", value: data.stats.totalVotes, icon: ThumbsUp },
    { label: "Likes", value: data.stats.totalLikes, icon: Heart },
    { label: "Comments", value: data.stats.totalComments, icon: MessageSquare },
    { label: "Avg Score", value: Number(data.stats.avgEngagement || 0).toFixed(1), suffix: "/50", icon: TrendingUp },
    { label: "Top Score", value: Number(data.stats.maxEngagement || 0).toFixed(1), suffix: "/50", icon: Zap },
  ]

  const podiumEntries: PortalPodiumEntry[] = [2, 1, 3]
    .map((rank) => data.leaderboard.find((p) => p.rank === rank))
    .filter(Boolean)
    .map((project) => ({
      rank: project!.rank,
      primaryLabel: project!.title,
      secondaryLabel: project!.groupName,
      score: Number(project!.totalScore || 0),
      scoreUnit: "/ 50",
    }))

  const restLeaderboard = data.leaderboard.filter((p) => p.rank > 3)

  const renderLeaderboardRow = (project: Project, compact = false) => (
    <Card
      key={project.id}
      className={cn(
        "cursor-pointer transition-all hover:shadow-md border border-slate-200/70 dark:border-white/[0.08] bg-white/90 dark:bg-white/[0.04]",
        project.rank <= 3 && "ring-1 ring-amber-500/25 dark:ring-amber-400/20",
      )}
      onClick={() => onProjectClick?.(project.id)}
    >
      <CardContent className={cn("p-3 sm:p-4", compact && "p-3")}>
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-8 text-center">{getRankIcon(project.rank)}</div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm sm:text-base text-slate-800 dark:text-slate-200 truncate">{project.title}</h3>
                {project.summary && !compact && (
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">{project.summary}</p>
                )}
              </div>
              {getRankBadge(project.rank)}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{project.groupName}</span>
              <span>{project.is_current_user ? (project.leaderName || "You") : PRIVACY_PLACEHOLDER_NAME}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-200/60 dark:border-white/[0.06]">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                <ThumbsUp className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                {Number(project.voteCount || 0)}
              </span>
              <Badge className={cn("text-xs", projectsTheme.page.cta)}>
                {Number(project.totalScore || 0).toFixed(1)} / 50
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (embedInDashboard) {
    return (
      <div className="space-y-4 sm:space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
          {statItems.map(({ label, value, suffix, icon: Icon }) => (
            <div
              key={label}
              className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/90 dark:bg-white/[0.04] p-3 shadow-sm"
            >
              <div className={cn("inline-flex p-1.5 rounded-lg mb-2", projectsTheme.page.iconBg)}>
                <Icon className={cn("h-4 w-4", projectsTheme.page.iconText)} />
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">{label}</p>
              <p className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200">
                {value}
                {suffix && <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-0.5">{suffix}</span>}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200/70 dark:border-white/[0.08] bg-white/90 dark:bg-white/[0.04] p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 mb-4">
            <Select value={selectedSession} onValueChange={setSelectedSession}>
              <SelectTrigger className="w-full sm:w-44 h-9 bg-white dark:bg-slate-900/80 border-slate-200/70 dark:border-slate-700/60 text-sm rounded-xl">
                <SelectValue placeholder="Session" />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                <SelectItem value="all" className="dark:text-slate-200">All Sessions</SelectItem>
                {PROJECT_MODULE_SESSIONS.map(({ code, label }) => (
                  <SelectItem key={code} value={code} className="dark:text-slate-200">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
              <SelectTrigger className="w-full sm:w-40 h-9 bg-white dark:bg-slate-900/80 border-slate-200/70 dark:border-slate-700/60 text-sm rounded-xl">
                <SelectValue placeholder="Timeframe" />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                <SelectItem value="all" className="dark:text-slate-200">All Time</SelectItem>
                <SelectItem value="week" className="dark:text-slate-200">This Week</SelectItem>
                <SelectItem value="month" className="dark:text-slate-200">This Month</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchLeaderboard} variant="outline" className={cn("h-9 rounded-xl", portalOutlineButtonClass(projectsTheme))}>
              Refresh
            </Button>
          </div>

          <Tabs defaultValue="leaderboard" className="space-y-4">
            <TabsList className="w-full grid grid-cols-3 h-10 p-1 gap-0.5 rounded-xl bg-slate-100/80 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 overflow-hidden">
              <TabsTrigger value="leaderboard" className={cn("rounded-lg text-xs sm:text-sm font-semibold min-w-0 truncate", projectsTheme.page.tabActive)}>
                Leaderboard
              </TabsTrigger>
              <TabsTrigger value="trending" className={cn("rounded-lg text-xs sm:text-sm font-semibold min-w-0 truncate", projectsTheme.page.tabActive)}>
                Trending
              </TabsTrigger>
              <TabsTrigger value="sessions" className={cn("rounded-lg text-xs sm:text-sm font-semibold min-w-0 truncate", projectsTheme.page.tabActive)}>
                Sessions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="leaderboard" className="space-y-4 mt-0">
              {data.leaderboard.length === 0 ? (
                <div className="text-center py-12">
                  <div className={cn("inline-flex p-4 rounded-2xl mb-3", projectsTheme.page.iconBg)}>
                    <Trophy className={cn("h-8 w-8", projectsTheme.page.iconText)} />
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">No ranked projects yet. Check back once groups start proposing.</p>
                </div>
              ) : (
                <>
                  {podiumEntries.length > 0 && (
                    <PortalLeaderboardPodium
                      entries={podiumEntries}
                      heading="Top projects"
                      onEntrySelect={(entry) => {
                        const project = data.leaderboard.find((p) => p.rank === entry.rank)
                        if (project) onProjectClick?.(project.id)
                      }}
                    />
                  )}
                  <div className="space-y-2 sm:space-y-3 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
                    {(podiumEntries.length > 0 ? restLeaderboard : data.leaderboard).map((project) => renderLeaderboardRow(project))}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="trending" className="space-y-2 sm:space-y-3 mt-0 max-h-[520px] overflow-y-auto pr-1">
              {data.trending.length === 0 ? (
                <p className="text-sm text-center text-slate-500 dark:text-slate-400 py-10">No trending activity in this period.</p>
              ) : (
                data.trending.map((project, index) => (
                  <motion.div key={project.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                    <Card className="cursor-pointer border border-slate-200/70 dark:border-white/[0.08] hover:shadow-md" onClick={() => onProjectClick?.(project.id)}>
                      <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate dark:text-slate-200">{project.title}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {project.recentComments} comments · {project.recentLikes} likes
                          </p>
                        </div>
                        <Badge className={cn("shrink-0", projectsTheme.page.badge)}>
                          <TrendingUp className="h-3 w-3 mr-1" />
                          {Number(project.engagementScore || 0).toFixed(1)}
                        </Badge>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </TabsContent>

            <TabsContent value="sessions" className="space-y-2 sm:space-y-3 mt-0 max-h-[520px] overflow-y-auto pr-1">
              {data.sessionLeaders.length === 0 ? (
                <p className="text-sm text-center text-slate-500 dark:text-slate-400 py-10">No session data available.</p>
              ) : (
                data.sessionLeaders.map((session, index) => (
                  <motion.div key={session.session} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                    <Card className="border border-slate-200/70 dark:border-white/[0.08]">
                      <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-sm dark:text-slate-200">{session.session}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{session.projectCount} projects</p>
                        </div>
                        <div className="text-right text-xs text-slate-600 dark:text-slate-300">
                          <p>Avg {Number(session.avgEngagement || 0).toFixed(1)}</p>
                          <p className={projectsTheme.page.iconText}>Top {Number(session.topScore || 0).toFixed(1)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
        <Card className={cn(
          "rounded-xl transition-all duration-300",
          embedInDashboard
            ? "border-l-4 border-l-emerald-500/60 dark:border-l-emerald-400/50 border border-slate-200/60 dark:border-white/[0.08] bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-white/[0.02] shadow-md hover:shadow-lg hover:-translate-y-0.5"
            : "bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white"
        )}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2">
              <div className={cn("shrink-0", embedInDashboard && "p-1.5 rounded-lg bg-emerald-500/15 dark:bg-emerald-500/25")}>
                <Trophy className={cn("h-4 w-4 sm:h-5 sm:w-5", embedInDashboard ? "text-emerald-600 dark:text-emerald-400" : "text-white")} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("text-xs sm:text-sm", embedInDashboard ? "text-slate-600 dark:text-slate-400" : "opacity-90")}>Projects</p>
                <p className={cn("text-xl sm:text-2xl font-bold", embedInDashboard ? "text-slate-800 dark:text-slate-200" : "text-white")}>{data.stats.totalProjects}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "rounded-xl transition-all duration-300",
          embedInDashboard
            ? "border-l-4 border-l-sky-500/50 dark:border-l-sky-400/40 border border-slate-200/60 dark:border-white/[0.08] bg-gradient-to-br from-sky-50/50 to-white dark:from-sky-950/20 dark:to-white/[0.02] shadow-md hover:shadow-lg hover:-translate-y-0.5"
            : "bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 text-white"
        )}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2">
              <div className={cn("shrink-0", embedInDashboard && "p-1.5 rounded-lg bg-sky-500/15 dark:bg-sky-500/25")}>
                <ThumbsUp className={cn("h-4 w-4 sm:h-5 sm:w-5", embedInDashboard ? "text-sky-600 dark:text-sky-400" : "text-white")} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("text-xs sm:text-sm", embedInDashboard ? "text-slate-600 dark:text-slate-400" : "opacity-90")}>Votes</p>
                <p className={cn("text-xl sm:text-2xl font-bold", embedInDashboard ? "text-slate-800 dark:text-slate-200" : "text-white")}>{data.stats.totalVotes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "rounded-xl transition-all duration-300",
          embedInDashboard
            ? "border-l-4 border-l-rose-500/50 dark:border-l-rose-400/40 border border-slate-200/60 dark:border-white/[0.08] bg-gradient-to-br from-rose-50/50 to-white dark:from-rose-950/20 dark:to-white/[0.02] shadow-md hover:shadow-lg hover:-translate-y-0.5"
            : "bg-gradient-to-br from-pink-500 to-pink-600 dark:from-pink-600 dark:to-pink-700 text-white"
        )}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2">
              <div className={cn("shrink-0", embedInDashboard && "p-1.5 rounded-lg bg-rose-500/15 dark:bg-rose-500/25")}>
                <Heart className={cn("h-4 w-4 sm:h-5 sm:w-5", embedInDashboard ? "text-rose-600 dark:text-rose-400" : "text-white")} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("text-xs sm:text-sm", embedInDashboard ? "text-slate-600 dark:text-slate-400" : "opacity-90")}>Likes</p>
                <p className={cn("text-xl sm:text-2xl font-bold", embedInDashboard ? "text-slate-800 dark:text-slate-200" : "text-white")}>{data.stats.totalLikes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "rounded-xl transition-all duration-300",
          embedInDashboard
            ? "border-l-4 border-l-violet-500/50 dark:border-l-violet-400/40 border border-slate-200/60 dark:border-white/[0.08] bg-gradient-to-br from-violet-50/50 to-white dark:from-violet-950/20 dark:to-white/[0.02] shadow-md hover:shadow-lg hover:-translate-y-0.5"
            : "bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 text-white"
        )}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2">
              <div className={cn("shrink-0", embedInDashboard && "p-1.5 rounded-lg bg-violet-500/15 dark:bg-violet-500/25")}>
                <MessageSquare className={cn("h-4 w-4 sm:h-5 sm:w-5", embedInDashboard ? "text-violet-600 dark:text-violet-400" : "text-white")} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("text-xs sm:text-sm", embedInDashboard ? "text-slate-600 dark:text-slate-400" : "opacity-90")}>
                  <span className="sm:hidden">Comments</span>
                  <span className="hidden sm:inline">Comments</span>
                </p>
                <p className={cn("text-xl sm:text-2xl font-bold", embedInDashboard ? "text-slate-800 dark:text-slate-200" : "text-white")}>{data.stats.totalComments}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "rounded-xl transition-all duration-300",
          embedInDashboard
            ? "border-l-4 border-l-amber-500/50 dark:border-l-amber-400/40 border border-slate-200/60 dark:border-white/[0.08] bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-950/20 dark:to-white/[0.02] shadow-md hover:shadow-lg hover:-translate-y-0.5"
            : "bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 text-white"
        )}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2">
              <div className={cn("shrink-0", embedInDashboard && "p-1.5 rounded-lg bg-amber-500/15 dark:bg-amber-500/25")}>
                <TrendingUp className={cn("h-4 w-4 sm:h-5 sm:w-5", embedInDashboard ? "text-amber-600 dark:text-amber-400" : "text-white")} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("text-xs sm:text-sm", embedInDashboard ? "text-slate-600 dark:text-slate-400" : "opacity-90")}>
                  <span className="sm:hidden">Avg</span>
                  <span className="hidden sm:inline">Avg Score</span>
                </p>
                <p className={cn("text-xl sm:text-2xl font-bold", embedInDashboard ? "text-slate-800 dark:text-slate-200" : "text-white")}>{Number(data.stats.avgEngagement || 0).toFixed(1)}</p>
                <p className={cn("text-xs hidden sm:block", embedInDashboard ? "text-slate-500 dark:text-slate-400" : "opacity-75")}>out of 50</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "rounded-xl transition-all duration-300",
          embedInDashboard
            ? "border-l-4 border-l-orange-500/50 dark:border-l-orange-400/40 border border-slate-200/60 dark:border-white/[0.08] bg-gradient-to-br from-orange-50/50 to-white dark:from-orange-950/20 dark:to-white/[0.02] shadow-md hover:shadow-lg hover:-translate-y-0.5"
            : "bg-gradient-to-br from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 text-white"
        )}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2">
              <div className={cn("shrink-0", embedInDashboard && "p-1.5 rounded-lg bg-orange-500/15 dark:bg-orange-500/25")}>
                <Zap className={cn("h-4 w-4 sm:h-5 sm:w-5", embedInDashboard ? "text-orange-600 dark:text-orange-400" : "text-white")} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("text-xs sm:text-sm", embedInDashboard ? "text-slate-600 dark:text-slate-400" : "opacity-90")}>
                  <span className="sm:hidden">Top</span>
                  <span className="hidden sm:inline">Top Score</span>
                </p>
                <p className={cn("text-xl sm:text-2xl font-bold", embedInDashboard ? "text-slate-800 dark:text-slate-200" : "text-white")}>{Number(data.stats.maxEngagement || 0).toFixed(1)}</p>
                <p className={cn("text-xs hidden sm:block", embedInDashboard ? "text-slate-500 dark:text-slate-400" : "opacity-75")}>out of 50</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85">
        <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl md:text-2xl dark:text-slate-200">
            <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 dark:text-yellow-400" />
            <span className="sm:hidden">Leaderboard</span>
            <span className="hidden sm:inline">Project Leaderboard</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
            <Select value={selectedSession} onValueChange={setSelectedSession}>
              <SelectTrigger className="w-full sm:w-48 h-9 sm:h-10 bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-xs sm:text-sm rounded-lg sm:rounded-xl dark:text-slate-200">
                <SelectValue placeholder="Session" />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                <SelectItem value="all" className="dark:text-slate-200">
                  <span className="sm:hidden">All</span>
                  <span className="hidden sm:inline">All Sessions</span>
                </SelectItem>
                {PROJECT_MODULE_SESSIONS.map(({ code, label }) => (
                  <SelectItem key={code} value={code} className="dark:text-slate-200">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
              <SelectTrigger className="w-full sm:w-48 h-9 sm:h-10 bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-xs sm:text-sm rounded-lg sm:rounded-xl dark:text-slate-200">
                <SelectValue placeholder="Timeframe" />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                <SelectItem value="all" className="dark:text-slate-200">
                  <span className="sm:hidden">All Time</span>
                  <span className="hidden sm:inline">All Time</span>
                </SelectItem>
                <SelectItem value="week" className="dark:text-slate-200">
                  <span className="sm:hidden">Week</span>
                  <span className="hidden sm:inline">This Week</span>
                </SelectItem>
                <SelectItem value="month" className="dark:text-slate-200">
                  <span className="sm:hidden">Month</span>
                  <span className="hidden sm:inline">This Month</span>
                </SelectItem>
              </SelectContent>
            </Select>

            <Button 
              onClick={fetchLeaderboard} 
              variant="outline"
              className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl dark:border-slate-700 dark:text-slate-300"
            >
              Refresh
            </Button>
          </div>

          <Tabs defaultValue="leaderboard" className="space-y-3 sm:space-y-4">
            <TabsList className={cn(
              "grid w-full grid-cols-3 rounded-lg sm:rounded-xl h-10 sm:h-11 md:h-12 p-0.5 sm:p-1",
              embedInDashboard
                ? "bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10"
                : "bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60"
            )}>
              <TabsTrigger 
                value="leaderboard" 
                className={cn(
                  "rounded-md sm:rounded-lg font-semibold text-xs sm:text-sm px-2 sm:px-3",
                  embedInDashboard
                    ? "data-[state=active]:bg-emerald-500/10 dark:data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300"
                    : "data-[state=active]:bg-yellow-500 dark:data-[state=active]:bg-yellow-600 data-[state=active]:text-white"
                )}
              >
                <span className="sm:hidden">Board</span>
                <span className="hidden sm:inline">Leaderboard</span>
              </TabsTrigger>
              <TabsTrigger 
                value="trending" 
                className={cn(
                  "rounded-md sm:rounded-lg font-semibold text-xs sm:text-sm px-2 sm:px-3",
                  embedInDashboard
                    ? "data-[state=active]:bg-emerald-500/10 dark:data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300"
                    : "data-[state=active]:bg-orange-500 dark:data-[state=active]:bg-orange-600 data-[state=active]:text-white"
                )}
              >
                Trending
              </TabsTrigger>
              <TabsTrigger 
                value="sessions" 
                className={cn(
                  "rounded-md sm:rounded-lg font-semibold text-xs sm:text-sm px-2 sm:px-3",
                  embedInDashboard
                    ? "data-[state=active]:bg-emerald-500/10 dark:data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300"
                    : "data-[state=active]:bg-blue-500 dark:data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                )}
              >
                Sessions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="leaderboard" className="space-y-3 sm:space-y-4 overflow-y-auto max-h-[500px] sm:max-h-[600px] pr-1 sm:pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
              {data.leaderboard.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card 
                    className={`cursor-pointer transition-all hover:shadow-lg border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 ${
                      project.rank <= 3 ? 'ring-2 ring-yellow-400 dark:ring-yellow-500' : ''
                    }`}
                    onClick={() => onProjectClick?.(project.id)}
                  >
                    <CardContent className="p-4 sm:p-5 md:p-6">
                      <div className="flex items-start gap-2 sm:gap-3 md:gap-4">
                        <div className="flex-shrink-0">
                          {getRankIcon(project.rank)}
                        </div>
                        
                        <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base sm:text-lg font-semibold dark:text-slate-200 break-words">{project.title}</h3>
                              {project.summary && (
                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 break-words">{project.summary}</p>
                              )}
                            </div>
                            {getRankBadge(project.rank)}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                            <div className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                              <span className="truncate max-w-[100px] sm:max-w-none">{project.groupName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="font-medium truncate max-w-[80px] sm:max-w-none">
                                {project.is_current_user ? (project.leaderName || "You") : PRIVACY_PLACEHOLDER_NAME}
                              </span>
                              {project.is_current_user && project.leaderStudentId && (
                              <Badge variant="outline" className="text-xs px-1.5 sm:px-2 py-0.5 dark:border-slate-700 dark:text-slate-300 shrink-0">
                                {project.leaderStudentId}
                              </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                              <span className="whitespace-nowrap">{new Date(project.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 md:gap-6 pt-1 sm:pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4">
                              <div className="flex items-center gap-1">
                                <ThumbsUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 dark:text-green-400 shrink-0" />
                                <span className="text-xs sm:text-sm font-medium">
                                  {Number(project.voteCount || 0)}
                                  <span className="hidden sm:inline"> votes</span>
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                <span className="text-xs sm:text-sm font-medium">
                                  {Number(project.studentPoints || 0).toFixed(1)}
                                  <span className="sm:hidden">s</span>
                                  <span className="hidden sm:inline"> pts (students)</span>
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span className="text-xs sm:text-sm font-medium">
                                  {Number(project.instructorPoints || 0).toFixed(1)}
                                  <span className="sm:hidden">i</span>
                                  <span className="hidden sm:inline"> pts (instructor)</span>
                                </span>
                              </div>
                            </div>

                            <div className="ml-0 sm:ml-auto w-full sm:w-auto">
                              <Badge 
                                className="text-xs sm:text-sm bg-gradient-to-r from-green-500 to-emerald-500 dark:from-green-600 dark:to-emerald-600 text-white px-2 sm:px-3 py-1 w-full sm:w-auto justify-center"
                              >
                                <span className="sm:hidden">Total: {Number(project.totalScore || 0).toFixed(1)}/50</span>
                                <span className="hidden sm:inline">Total: {Number(project.totalScore || 0).toFixed(1)} / 50</span>
                              </Badge>
                            </div>
                          </div>

                          {/* Project Link */}
                          {project.projectLink && (
                            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                              <a
                                href={project.projectLink.startsWith('http://') || project.projectLink.startsWith('https://') 
                                  ? project.projectLink 
                                  : `https://${project.projectLink}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 break-all"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                                <span className="truncate">{project.projectLink}</span>
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </TabsContent>

            <TabsContent value="trending" className="space-y-3 sm:space-y-4 overflow-y-auto max-h-[500px] sm:max-h-[600px] pr-1 sm:pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
              {data.trending.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card 
                    className="cursor-pointer transition-all hover:shadow-lg border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85"
                    onClick={() => onProjectClick?.(project.id)}
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm sm:text-base font-semibold dark:text-slate-200 break-words">{project.title}</h3>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                            <span>
                              {project.recentComments}
                              <span className="sm:hidden"> com</span>
                              <span className="hidden sm:inline"> recent comments</span>
                            </span>
                            <span>
                              {project.recentLikes}
                              <span className="sm:hidden"> likes</span>
                              <span className="hidden sm:inline"> recent likes</span>
                            </span>
                          </div>
                        </div>
                        <div className="text-left sm:text-right w-full sm:w-auto">
                          <Badge className="bg-gradient-to-r from-orange-500 to-red-500 dark:from-orange-600 dark:to-red-600 text-white text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Trending
                          </Badge>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                            <span className="sm:hidden">Score: {Number(project.engagementScore || 0).toFixed(1)}/50</span>
                            <span className="hidden sm:inline">Score: {Number(project.engagementScore || 0).toFixed(1)} / 50</span>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </TabsContent>

            <TabsContent value="sessions" className="space-y-3 sm:space-y-4 overflow-y-auto max-h-[500px] sm:max-h-[600px] pr-1 sm:pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
              {data.sessionLeaders.map((session, index) => (
                <motion.div
                  key={session.session}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm sm:text-base font-semibold dark:text-slate-200">{session.session}</h3>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                            {session.projectCount}
                            <span className="sm:hidden"> proj</span>
                            <span className="hidden sm:inline"> projects</span>
                          </p>
                        </div>
                        <div className="text-left sm:text-right w-full sm:w-auto">
                          <Badge variant="outline" className="text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1 dark:border-slate-700 dark:text-slate-300">
                            <span className="sm:hidden">Avg: {Number(session.avgEngagement || 0).toFixed(1)}/50</span>
                            <span className="hidden sm:inline">Avg: {Number(session.avgEngagement || 0).toFixed(1)} / 50</span>
                          </Badge>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                            <span className="sm:hidden">Top: {Number(session.topScore || 0).toFixed(1)}/50</span>
                            <span className="hidden sm:inline">Top: {Number(session.topScore || 0).toFixed(1)} / 50</span>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}




