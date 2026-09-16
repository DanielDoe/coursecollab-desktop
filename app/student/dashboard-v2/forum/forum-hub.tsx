"use client"


import { studentApiFetch } from "@/lib/auth"
import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  MessageSquare,
  Lightbulb,
  Bug,
  Users,
  Trophy,
  Plus,
  Search,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Award,
  TrendingUp,
  Clock,
  Send,
  Star,
  Filter,
  SortAsc,
  SortDesc,
  Zap,
  Flame,
  Crown,
  Target,
  Brain,
  Rocket,
  Heart,
  Bookmark,
  Share2,
  Eye,
  ChevronRight,
  Sparkles,
  Activity,
  BarChart3,
  Calendar,
  UserPlus,
  HelpCircle,
  CheckCircle,
  AlertCircle,
  XCircle,
  PlayCircle,
  Code,
  FileText,
  Image,
  Link as LinkIcon,
} from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence, PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import {
  EmbedModuleCard,
  EmbedSearchField,
  EmbedToolbar,
  EmbedToolbarActions,
} from "@/components/student/dashboard-v2/embed-module-ui"
import { getStudentModuleTheme, studentModuleIconBadgeClass, studentModuleSpinnerClass } from "@/lib/student-module-themes"
import { cn } from "@/lib/utils"

const forumTheme = getStudentModuleTheme("forum")

const FORUM_TAB_ITEMS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "discussions", label: "Discussions", icon: MessageSquare },
  { id: "tutoring", label: "Tutoring", icon: Users },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
] as const

const FORUM_SECTION_CARD =
  "border border-slate-200/70 dark:border-white/[0.08] bg-white/90 dark:bg-white/[0.03] rounded-2xl shadow-sm dark:shadow-none"

const QUICK_ACTION_TILE =
  "group flex w-full items-center gap-4 rounded-xl border border-slate-200/70 dark:border-white/[0.08] p-4 text-left transition-all bg-white/90 dark:bg-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/[0.1] shadow-sm dark:shadow-none"

function QuickActionIcon({
  icon: Icon,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  className: string
}) {
  return (
    <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", className)}>
      <Icon className="size-5" />
    </div>
  )
}

type Thread = {
  id: number
  student_id: number
  title: string
  description: string
  code_snippet?: string
  tags: string[]
  upvotes: number
  downvotes: number
  reply_count: number
  is_anonymous: boolean
  created_at: string
  author_name: string
  author_reputation: number
}

type TutoringOffer = {
  id: number
  student_id: number
  subject: string
  description: string
  hourly_rate: number
  availability: string
  rating: number
  total_sessions: number
  created_at: string
  author_name: string
  author_reputation: number
}

type LeaderboardEntry = {
  student_id: number
  student_name: string
  points: number
  rank: number
  threads_count: number
  replies_count: number
  upvotes_received: number
}

const FORUM_BASE = "/student/dashboard-v2/forum"

const PODIUM_FINISH: Record<1 | 2 | 3, { fill: string; ink: string; bar: string }> = {
  1: { fill: "#EAAA00", ink: "#3D2E00", bar: "h-[72px]" },
  2: { fill: "#22D3EE", ink: "#083344", bar: "h-[52px]" },
  3: { fill: "#FB7185", ink: "#4C0519", bar: "h-[40px]" },
}

function ForumLeaderboard({
  rows,
  view,
  onViewChange,
}: {
  rows: LeaderboardEntry[]
  view: "weekly" | "alltime"
  onViewChange: (view: "weekly" | "alltime") => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--cc-text-muted)]">
            {view === "weekly" ? "This week" : "All time"}
          </p>
          <p className="mt-0.5 text-sm text-[var(--cc-text-muted)]">
            Top contributors by threads, replies, and upvotes
          </p>
        </div>
        <div
          className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--muted)]/50 p-1"
          role="tablist"
          aria-label="Leaderboard period"
        >
          {(
            [
              { id: "weekly", label: "Weekly" },
              { id: "alltime", label: "All time" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={view === option.id}
              onClick={() => onViewChange(option.id)}
              className={cn(
                "min-h-[36px] rounded-lg px-3 text-xs font-medium touch-manipulation sm:text-sm",
                view === option.id
                  ? "bg-[var(--cc-accent)] text-white"
                  : "text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--cc-text-muted)]">
          No rankings yet. Start a thread or reply to appear here.
        </p>
      ) : (
        <>
          <div className="flex items-end justify-center gap-2 sm:gap-3">
            {([2, 1, 3] as const).map((place) => {
              const entry =
                rows.find((row) => row.rank === place) ??
                (rows.every((row) => !row.rank) ? rows[place - 1] : undefined)
              if (!entry) return <div key={`empty-${place}`} className="min-w-0 flex-1" />
              const finish = PODIUM_FINISH[place]
              return (
                <div key={`podium-${place}`} className="flex min-w-0 flex-1 flex-col items-center text-center">
                  <span
                    className="mb-1.5 flex size-11 items-center justify-center rounded-[14px] sm:size-12"
                    style={{ backgroundColor: finish.fill, color: finish.ink }}
                  >
                    <Trophy className="h-5 w-5" aria-hidden />
                  </span>
                  <p className="w-full truncate text-xs font-semibold text-[var(--cc-text)]">
                    {entry.student_name}
                  </p>
                  <p className="mb-2 text-[11px] font-semibold tabular-nums" style={{ color: finish.fill }}>
                    {entry.points} pts
                  </p>
                  <div
                    className={cn("flex w-full items-center justify-center rounded-t-xl text-sm font-bold", finish.bar)}
                    style={{ backgroundColor: finish.fill, color: finish.ink }}
                  >
                    {place}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
            {rows
              .filter((entry, index) => (entry.rank ?? index + 1) > 3)
              .map((entry, index) => {
                const rank = entry.rank ?? index + 4
                return (
                  <div key={entry.student_id} className="flex h-[72px] items-center gap-3 px-1 sm:px-2">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--muted)] text-sm font-semibold text-[var(--cc-text)]">
                      {rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--cc-text)]">{entry.student_name}</p>
                      <p className="truncate text-xs text-[var(--cc-text-muted)]">
                        {entry.threads_count} threads · {entry.replies_count} replies
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--cc-text)]">
                      {entry.points}
                    </span>
                  </div>
                )
              })}
          </div>
        </>
      )}
    </div>
  )
}

const FORUM_DIALOG_CLASS =
  "max-w-2xl dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
const FORUM_DIALOG_TITLE_CLASS = "dark:text-slate-100"
const FORUM_DIALOG_DESC_CLASS = "dark:text-slate-400"
const FORUM_FIELD_CLASS =
  "rounded-xl dark:bg-slate-900/50 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"

export default function ForumHub() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [studentId, setStudentId] = useState<string | null>(null)
  const [studentName, setStudentName] = useState("")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [threads, setThreads] = useState<Thread[]>([])
  const [tutoringOffers, setTutoringOffers] = useState<TutoringOffer[]>([])
  const [weeklyLeaderboard, setWeeklyLeaderboard] = useState<LeaderboardEntry[]>([])
  const [allTimeLeaderboard, setAllTimeLeaderboard] = useState<LeaderboardEntry[]>([])

  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("recent")
  const [selectedTag, setSelectedTag] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")

  // Dialog states
  const [showNewThread, setShowNewThread] = useState(false)
  const [showNewTutoring, setShowNewTutoring] = useState(false)

  // Form states
  const [newThread, setNewThread] = useState({
    title: "",
    description: "",
    codeSnippet: "",
    tags: [] as string[],
    isAnonymous: false,
  })
  const [newTutoring, setNewTutoring] = useState({
    subject: "",
    description: "",
    hourlyRate: "",
    availability: "",
  })

  const activeTab = searchParams.get("tab") || "overview"
  const [leaderboardView, setLeaderboardView] = useState<"weekly" | "alltime">("weekly")

  useEffect(() => {
    const id = sessionStorage.getItem("studentDatabaseId")
    const name = sessionStorage.getItem("studentName")
    const session = sessionStorage.getItem("studentSection")

    if (!id) {
      router.push("/student/login")
      return
    }

    setStudentId(id)
    setStudentName(name || "")
    if (session) {
      fetchSessionId(session)
    }
    setLoading(false)
  }, [router])

  const fetchSessionId = async (sectionCode: string) => {
    try {
      const response = await studentApiFetch(`/api/student/sessions?section=${sectionCode}`)
      const data = await response.json()
      if (response.ok && data.sessions.length > 0) {
        setSessionId(data.sessions[0].id.toString())
        fetchForumData(data.sessions[0].id.toString())
      }
    } catch (error) {
      console.error("Failed to fetch session:", error)
    }
  }

  const fetchForumData = async (sessionId: string) => {
    try {
      const [threadsRes, tutoringRes, leaderboardRes] = await Promise.all([
        fetch(`/api/forum/threads?sortBy=${sortBy}`),
        fetch(`/api/forum/tutoring?sortBy=${sortBy}`),
        fetch(`/api/forum/reputation?sessionId=${sessionId}`),
      ])

      if (threadsRes.ok) {
        const threadsData = await threadsRes.json()
        setThreads(threadsData.threads || [])
      }
      if (tutoringRes.ok) {
        const tutoringData = await tutoringRes.json()
        setTutoringOffers(tutoringData.offers || [])
      }
      if (leaderboardRes.ok) {
        const leaderboardData = await leaderboardRes.json()
        setWeeklyLeaderboard(leaderboardData.weekly || [])
        setAllTimeLeaderboard(leaderboardData.allTime || [])
      }
    } catch (error) {
      console.error("Failed to fetch forum data:", error)
    }
  }

  const handleCreateThread = async () => {
    if (!studentId || !newThread.title || !newThread.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/forum/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: parseInt(studentId),
          ...newThread,
        }),
      })

      if (response.ok) {
        toast({ title: "Success", description: "Thread created successfully!" })
        setNewThread({ title: "", description: "", codeSnippet: "", tags: [], isAnonymous: false })
        setShowNewThread(false)
        fetchForumData(sessionId!)
      } else {
        throw new Error("Failed to create thread")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create thread",
        variant: "destructive",
      })
    }
  }

  const handleCreateTutoring = async () => {
    if (!studentId || !newTutoring.subject || !newTutoring.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/forum/tutoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: parseInt(studentId),
          ...newTutoring,
          hourlyRate: parseFloat(newTutoring.hourlyRate),
        }),
      })

      if (response.ok) {
        toast({ title: "Success", description: "Tutoring offer created successfully!" })
        setNewTutoring({ subject: "", description: "", hourlyRate: "", availability: "" })
        setShowNewTutoring(false)
        fetchForumData(sessionId!)
      } else {
        throw new Error("Failed to create tutoring offer")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create tutoring offer",
        variant: "destructive",
      })
    }
  }

  const handleVote = async (type: "thread", id: number, voteType: "up" | "down") => {
    if (!studentId) return

    try {
      const response = await fetch("/api/forum/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: parseInt(studentId),
          type,
          itemId: id,
          voteType,
        }),
      })

      if (response.ok) {
        fetchForumData(sessionId!)
      }
    } catch (error) {
      console.error("Failed to vote:", error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className={cn("animate-spin rounded-full h-10 w-10 border-2 border-slate-200 dark:border-slate-700", studentModuleSpinnerClass("forum"))} />
      </div>
    )
  }

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 space-y-4 overflow-x-hidden p-3 sm:p-4 md:p-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
              Forum
            </p>
            <p className="mt-0.5 text-sm text-[var(--cc-text)]">
              Discussions, tutoring, and rankings
              <span className="text-[var(--cc-text-muted)]"> · ask, help, or climb the board</span>
            </p>
          </div>

          <div
            className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--muted)]/50 p-1 sm:grid-cols-4"
            role="tablist"
            aria-label="Forum sections"
          >
            {FORUM_TAB_ITEMS.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => router.push(`${FORUM_BASE}?tab=${id}`)}
                  className={cn(
                    "flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium touch-manipulation sm:text-sm",
                    isActive
                      ? "bg-[var(--cc-accent)] text-white"
                      : "text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              )
            })}
          </div>

          {activeTab !== "leaderboard" ? (
            <EmbedToolbar>
              <EmbedSearchField
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search discussions or tutoring…"
              />
              <EmbedToolbarActions>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 sm:w-40">
                    <SortAsc className="h-4 w-4 mr-2 shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Most Recent</SelectItem>
                    <SelectItem value="popular">Most Popular</SelectItem>
                    <SelectItem value="trending">Trending</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-xl border border-[var(--border)] bg-[var(--muted)]/40"
                >
                  <Filter className="h-4 w-4" />
                  <span className="sr-only">Filters</span>
                </Button>
              </EmbedToolbarActions>
            </EmbedToolbar>
          ) : null}

          <div className="w-full min-w-0">
                  {activeTab === "overview" && (
                    <div className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Quick Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="lg:col-span-2 space-y-6"
              >
                {/* Recent Activity */}
                <Card className={FORUM_SECTION_CARD}>
                  <CardHeader className="p-6">
                    <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", forumTheme.page.iconBg)}>
                          <Activity className={cn("h-5 w-5", forumTheme.page.iconText)} />
                        </div>
                      <div>
                          <CardTitle className="text-xl font-bold">Recent Activity</CardTitle>
                          <p className="text-slate-600 dark:text-slate-300">Latest discussions and updates</p>
                      </div>
                      </div>
                      <Button variant="outline" size="sm" className="rounded-xl">
                        View All
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {threads.length === 0 && (
                        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 dark:border-white/10 px-4 py-8 text-center">
                          <MessageSquare className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No discussions yet</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Start a discussion and it will show up here.</p>
                        </div>
                      )}
                      {threads.slice(0, 3).map((thread, index) => (
                        <motion.div
                          key={thread.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                          className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                          onClick={() => router.push(`${FORUM_BASE}/thread/${thread.id}`)}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${forumTheme.page.iconBg}`}>
                            <MessageSquare className={`h-5 w-5 ${forumTheme.page.iconText}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-800 dark:text-white truncate">{thread.title}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {thread.author_name}
                              </Badge>
                              <span className="text-xs text-slate-500">
                                {new Date(thread.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-slate-500">
                              <ThumbsUp className="h-4 w-4" />
                              <span className="text-sm">{thread.upvotes}</span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-500">
                              <MessageCircle className="h-4 w-4" />
                              <span className="text-sm">{thread.reply_count}</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className={FORUM_SECTION_CARD}>
                  <CardHeader className="p-6 pb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", forumTheme.page.iconBg)}>
                        <Zap className={cn("h-5 w-5", forumTheme.page.iconText)} />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold">Quick Actions</CardTitle>
                        <p className="text-slate-600 dark:text-slate-400 text-sm">Start a discussion, offer help, or reach support</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 pt-0 space-y-6">
                    <div>
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Community
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Dialog open={showNewThread} onOpenChange={setShowNewThread}>
                          <DialogTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "flex w-full items-center gap-4 rounded-xl p-4 text-left transition-all shadow-md shadow-orange-600/15",
                                forumTheme.page.cta,
                              )}
                            >
                              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
                                <MessageSquare className="size-5 text-white" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-white">New Discussion</p>
                                <p className="text-xs text-white/80 mt-0.5">Ask a question or share an idea</p>
                              </div>
                              <ChevronRight className="size-4 shrink-0 text-white/70" />
                            </button>
                          </DialogTrigger>
                        <DialogContent className={FORUM_DIALOG_CLASS}>
                          <DialogHeader>
                            <DialogTitle className={FORUM_DIALOG_TITLE_CLASS}>Start New Discussion</DialogTitle>
                            <DialogDescription className={FORUM_DIALOG_DESC_CLASS}>
                              Share your thoughts, ask questions, or help others learn
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="title">Title</Label>
                              <Input
                                id="title"
                                value={newThread.title}
                                onChange={(e) => setNewThread({ ...newThread, title: e.target.value })}
                                placeholder="What's your question or topic?"
                                className={FORUM_FIELD_CLASS}
                              />
                            </div>
                            <div>
                              <Label htmlFor="description">Description</Label>
                              <Textarea
                                id="description"
                                value={newThread.description}
                                onChange={(e) => setNewThread({ ...newThread, description: e.target.value })}
                                placeholder="Provide details about your question or topic..."
                                className={`${FORUM_FIELD_CLASS} min-h-[120px]`}
                              />
                            </div>
                            <div>
                              <Label htmlFor="codeSnippet">Code Snippet (Optional)</Label>
                              <Textarea
                                id="codeSnippet"
                                value={newThread.codeSnippet}
                                onChange={(e) => setNewThread({ ...newThread, codeSnippet: e.target.value })}
                                placeholder="Paste your code here if relevant..."
                                className={`${FORUM_FIELD_CLASS} min-h-[100px] font-mono`}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="anonymous"
                                checked={newThread.isAnonymous}
                                onChange={(e) => setNewThread({ ...newThread, isAnonymous: e.target.checked })}
                                className="rounded"
                              />
                              <Label htmlFor="anonymous">Post anonymously</Label>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setShowNewThread(false)}>
                                Cancel
                              </Button>
                              <Button onClick={handleCreateThread} className={forumTheme.page.cta}>
                                Create Discussion
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                        <Dialog open={showNewTutoring} onOpenChange={setShowNewTutoring}>
                          <DialogTrigger asChild>
                            <button type="button" className={QUICK_ACTION_TILE}>
                              <QuickActionIcon
                                icon={Users}
                                className={cn(forumTheme.page.iconBg, forumTheme.page.iconText)}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">Offer Tutoring</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Share your expertise with peers</p>
                              </div>
                              <ChevronRight className="size-4 shrink-0 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200" />
                            </button>
                          </DialogTrigger>
                        <DialogContent className={FORUM_DIALOG_CLASS}>
                          <DialogHeader>
                            <DialogTitle className={FORUM_DIALOG_TITLE_CLASS}>Offer Tutoring Services</DialogTitle>
                            <DialogDescription className={FORUM_DIALOG_DESC_CLASS}>
                              Help fellow students by offering your expertise
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="subject">Subject</Label>
                              <Input
                                id="subject"
                                value={newTutoring.subject}
                                onChange={(e) => setNewTutoring({ ...newTutoring, subject: e.target.value })}
                                placeholder="e.g., C++ Programming, Data Structures"
                                className={FORUM_FIELD_CLASS}
                              />
                            </div>
                            <div>
                              <Label htmlFor="tutoringDescription">Description</Label>
                              <Textarea
                                id="tutoringDescription"
                                value={newTutoring.description}
                                onChange={(e) => setNewTutoring({ ...newTutoring, description: e.target.value })}
                                placeholder="Describe your expertise and teaching approach..."
                                className={`${FORUM_FIELD_CLASS} min-h-[120px]`}
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                                <Input
                                  id="hourlyRate"
                                  type="number"
                                  value={newTutoring.hourlyRate}
                                  onChange={(e) => setNewTutoring({ ...newTutoring, hourlyRate: e.target.value })}
                                  placeholder="25"
                                  className={FORUM_FIELD_CLASS}
                                />
                              </div>
                              <div>
                                <Label htmlFor="availability">Availability</Label>
                                <Input
                                  id="availability"
                                  value={newTutoring.availability}
                                  onChange={(e) => setNewTutoring({ ...newTutoring, availability: e.target.value })}
                                  placeholder="e.g., Weekdays 6-8 PM"
                                  className={FORUM_FIELD_CLASS}
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setShowNewTutoring(false)}>
                                Cancel
                              </Button>
                              <Button onClick={handleCreateTutoring} className={forumTheme.page.cta}>
                                Offer Tutoring
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      </div>
                    </div>

                    <div>
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Support
                      </p>
                      <div className="space-y-2">
                        <Link href="/student/dashboard-v2/feature-requests" className="block">
                          <div className={QUICK_ACTION_TILE}>
                            <QuickActionIcon
                              icon={Lightbulb}
                              className="bg-violet-500/20 text-violet-600 dark:text-violet-300"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">Feature Request</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Suggest improvements for CourseCollab</p>
                            </div>
                            <ChevronRight className="size-4 shrink-0 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200" />
                          </div>
                        </Link>
                        <Link href="/student/dashboard-v2/report-bug" className="block">
                          <div className={QUICK_ACTION_TILE}>
                            <QuickActionIcon
                              icon={Bug}
                              className="bg-rose-500/20 text-rose-600 dark:text-rose-300"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">Report Bug</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Tell us when something is broken</p>
                            </div>
                            <ChevronRight className="size-4 shrink-0 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200" />
                          </div>
                        </Link>
                        <Link href="/student/dashboard-v2/submit-ticket" className="block">
                          <div className={QUICK_ACTION_TILE}>
                            <QuickActionIcon
                              icon={Send}
                              className="bg-sky-500/20 text-sky-600 dark:text-sky-300"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">Submit Support Ticket</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Get help from the CourseCollab team</p>
                            </div>
                            <ChevronRight className="size-4 shrink-0 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200" />
                          </div>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Sidebar */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="space-y-6"
              >
                {/* Stats */}
                <Card className={FORUM_SECTION_CARD}>
                  <CardHeader className="p-6">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", forumTheme.page.iconBg)}>
                        <BarChart3 className={cn("h-5 w-5", forumTheme.page.iconText)} />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold">Forum Stats</CardTitle>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Community activity</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 pt-0 space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-white/[0.03]">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        <span className="text-sm text-slate-600 dark:text-slate-300">Discussions</span>
                      </div>
                      <span className="text-xl font-bold text-slate-800 dark:text-white">{threads.length}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-white/[0.03]">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        <span className="text-sm text-slate-600 dark:text-slate-300">Tutoring Offers</span>
                      </div>
                      <span className="text-xl font-bold text-slate-800 dark:text-white">{tutoringOffers.length}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Contributors */}
                <Card className={FORUM_SECTION_CARD}>
                  <CardHeader className="p-6">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", forumTheme.page.iconBg)}>
                        <Crown className={cn("h-5 w-5", forumTheme.page.iconText)} />
                      </div>
                    <div>
                        <CardTitle className="text-lg font-bold">Top Contributors</CardTitle>
                        <p className="text-slate-500 text-sm">This week</p>
                    </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 pt-0">
                    <div className="space-y-2">
                      {weeklyLeaderboard.length === 0 && (
                        <p className="rounded-xl bg-slate-50/80 px-3 py-4 text-center text-xs text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
                          No contributions this week yet — post or reply to appear here.
                        </p>
                      )}
                      {weeklyLeaderboard.slice(0, 5).map((entry, index) => (
                        <div key={entry.student_id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] hover:bg-slate-100/80 dark:hover:bg-white/[0.06] transition-colors">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            index === 0 ? cn(forumTheme.page.softBg, forumTheme.page.iconText) :
                            index === 1 ? "bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300" :
                            index === 2 ? "bg-amber-500/20 dark:bg-amber-500/30 text-amber-700 dark:text-amber-400" :
                            "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400"
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{entry.student_name}</p>
                            <p className="text-xs text-slate-500">{entry.points} points</p>
                  </div>
                          <Badge variant="outline" className="text-xs">
                            {entry.threads_count + entry.replies_count} posts
                    </Badge>
                    </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

                {/* Quick Tips */}
                <Card className={FORUM_SECTION_CARD}>
                  <CardHeader className="p-6">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", forumTheme.page.iconBg)}>
                        <Lightbulb className={cn("h-5 w-5", forumTheme.page.iconText)} />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold">Forum Tips</CardTitle>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Maximize your experience</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 pt-0 space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-white/[0.03]">
                      <Star className={cn("h-4 w-4 mt-0.5 flex-shrink-0", forumTheme.page.iconText)} />
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        <strong className="text-slate-800 dark:text-white">Be specific</strong> in your questions and provide context
                      </p>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-white/[0.03]">
                      <Heart className={cn("h-4 w-4 mt-0.5 flex-shrink-0", forumTheme.page.iconText)} />
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        <strong className="text-slate-800 dark:text-white">Help others</strong> by answering questions and sharing knowledge
                      </p>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-white/[0.03]">
                      <Award className={cn("h-4 w-4 mt-0.5 flex-shrink-0", forumTheme.page.iconText)} />
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        <strong className="text-slate-800 dark:text-white">Earn reputation</strong> through quality contributions
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
                    </div>
                  )}

                  {activeTab === "discussions" && (
                    <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <span className="text-dashboard-v2-muted text-sm">Browse and participate in discussions</span>
                  <Dialog open={showNewThread} onOpenChange={setShowNewThread}>
                    <DialogTrigger asChild>
                  <Button className={cn("rounded-xl", forumTheme.page.cta)}>
                        <Plus className="h-4 w-4 mr-2" />
                    New Discussion
                      </Button>
                    </DialogTrigger>
                    <DialogContent className={FORUM_DIALOG_CLASS}>
                      <DialogHeader>
                    <DialogTitle className={FORUM_DIALOG_TITLE_CLASS}>Start New Discussion</DialogTitle>
                    <DialogDescription className={FORUM_DIALOG_DESC_CLASS}>
                      Share your thoughts, ask questions, or help others learn
                    </DialogDescription>
                      </DialogHeader>
                  <div className="space-y-4">
                        <div>
                          <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={newThread.title}
                        onChange={(e) => setNewThread({ ...newThread, title: e.target.value })}
                        placeholder="What's your question or topic?"
                        className={FORUM_FIELD_CLASS}
                      />
                        </div>
                        <div>
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                        value={newThread.description}
                        onChange={(e) => setNewThread({ ...newThread, description: e.target.value })}
                        placeholder="Provide details about your question or topic..."
                        className={`${FORUM_FIELD_CLASS} min-h-[120px]`}
                          />
                        </div>
                        <div>
                      <Label htmlFor="codeSnippet">Code Snippet (Optional)</Label>
                          <Textarea
                            id="codeSnippet"
                        value={newThread.codeSnippet}
                        onChange={(e) => setNewThread({ ...newThread, codeSnippet: e.target.value })}
                        placeholder="Paste your code here if relevant..."
                        className={`${FORUM_FIELD_CLASS} min-h-[100px] font-mono`}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="anonymous"
                        checked={newThread.isAnonymous}
                        onChange={(e) => setNewThread({ ...newThread, isAnonymous: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor="anonymous">Post anonymously</Label>
                        </div>
                        <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowNewThread(false)}>
                            Cancel
                          </Button>
                      <Button onClick={handleCreateThread} className={forumTheme.page.cta}>
                        Create Discussion
                          </Button>
                        </div>
                  </div>
                    </DialogContent>
                  </Dialog>
              </div>

            <div className="grid gap-6">
              {threads.map((thread, index) => (
                <motion.div
                  key={thread.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card className={cn(FORUM_SECTION_CARD, "hover:bg-slate-100/40 dark:hover:bg-white/[0.05] transition-all duration-300 cursor-pointer")}
                        onClick={() => router.push(`${FORUM_BASE}/thread/${thread.id}`)}>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", forumTheme.page.iconBg)}>
                          <MessageSquare className={cn("h-6 w-6", forumTheme.page.iconText)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white line-clamp-2">
                              {thread.title}
                            </h3>
                            <div className="flex items-center gap-2 ml-4">
                            <Button
                              variant="ghost"
                              size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleVote("thread", thread.id, "up")
                                }}
                                className="text-slate-500 hover:text-green-600"
                            >
                              <ThumbsUp className="h-4 w-4" />
                                <span className="ml-1">{thread.upvotes}</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleVote("thread", thread.id, "down")
                                }}
                                className="text-slate-500 hover:text-red-600"
                            >
                              <ThumbsDown className="h-4 w-4" />
                                <span className="ml-1">{thread.downvotes}</span>
                            </Button>
                          </div>
                            </div>
                          <p className="text-slate-600 dark:text-slate-300 line-clamp-2 mb-3">
                            {thread.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-slate-500">
                            <div className="flex items-center gap-1">
                              <UserPlus className="h-4 w-4" />
                              <span>{thread.is_anonymous ? "Anonymous" : thread.author_name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{new Date(thread.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MessageCircle className="h-4 w-4" />
                              <span>{thread.reply_count} replies</span>
                            </div>
                            {thread.tags.length > 0 && (
                              <div className="flex items-center gap-1">
                                <span>Tags:</span>
                                {thread.tags.slice(0, 3).map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                {thread.tags.length > 3 && (
                                  <span className="text-xs">+{thread.tags.length - 3} more</span>
                                )}
                              </div>
                            )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                </motion.div>
              ))}
              </div>
                    </div>
                  )}

                  {activeTab === "tutoring" && (
                    <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-dashboard-v2-muted text-sm">Find and offer tutoring services</span>
                <Dialog open={showNewTutoring} onOpenChange={setShowNewTutoring}>
                  <DialogTrigger asChild>
                  <Button className={cn("rounded-xl", forumTheme.page.cta)}>
                      <Plus className="h-4 w-4 mr-2" />
                    Offer Tutoring
                    </Button>
                  </DialogTrigger>
                  <DialogContent className={FORUM_DIALOG_CLASS}>
                    <DialogHeader>
                    <DialogTitle className={FORUM_DIALOG_TITLE_CLASS}>Offer Tutoring Services</DialogTitle>
                    <DialogDescription className={FORUM_DIALOG_DESC_CLASS}>
                      Help fellow students by offering your expertise
                    </DialogDescription>
                    </DialogHeader>
                  <div className="space-y-4">
                      <div>
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        value={newTutoring.subject}
                        onChange={(e) => setNewTutoring({ ...newTutoring, subject: e.target.value })}
                        placeholder="e.g., C++ Programming, Data Structures"
                        className={FORUM_FIELD_CLASS}
                      />
                      </div>
                      <div>
                      <Label htmlFor="tutoringDescription">Description</Label>
                      <Textarea
                        id="tutoringDescription"
                        value={newTutoring.description}
                        onChange={(e) => setNewTutoring({ ...newTutoring, description: e.target.value })}
                        placeholder="Describe your expertise and teaching approach..."
                        className={`${FORUM_FIELD_CLASS} min-h-[120px]`}
                      />
                      </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                        <Input
                          id="hourlyRate"
                          type="number"
                          value={newTutoring.hourlyRate}
                          onChange={(e) => setNewTutoring({ ...newTutoring, hourlyRate: e.target.value })}
                          placeholder="25"
                          className="rounded-xl"
                        />
                      </div>
                      <div>
                        <Label htmlFor="availability">Availability</Label>
                        <Input
                          id="availability"
                          value={newTutoring.availability}
                          onChange={(e) => setNewTutoring({ ...newTutoring, availability: e.target.value })}
                          placeholder="e.g., Weekdays 6-8 PM"
                          className="rounded-xl"
                        />
                      </div>
                      </div>
                      <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowNewTutoring(false)}>
                          Cancel
                        </Button>
                      <Button onClick={handleCreateTutoring} className={forumTheme.page.cta}>
                        Offer Tutoring
                        </Button>
                      </div>
                  </div>
                  </DialogContent>
                </Dialog>
              </div>

            <div className="grid gap-6">
              {tutoringOffers.map((offer, index) => (
                <motion.div
                  key={offer.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card className={cn(FORUM_SECTION_CARD, "transition-all duration-300")}>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", forumTheme.page.iconBg)}>
                          <Users className={cn("h-6 w-6", forumTheme.page.iconText)} />
                                </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white line-clamp-2">
                              {offer.subject}
                            </h3>
                            <div className="flex items-center gap-2 ml-4">
                              <div className="flex items-center gap-1 text-slate-500">
                                <Star className="h-4 w-4 text-yellow-500" />
                                <span className="text-sm">{offer.rating.toFixed(1)}</span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                ${offer.hourly_rate}/hr
                              </Badge>
                            </div>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 line-clamp-2 mb-3">
                            {offer.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-slate-500">
                                <div className="flex items-center gap-1">
                              <UserPlus className="h-4 w-4" />
                              <span>{offer.author_name}</span>
                                </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{new Date(offer.created_at).toLocaleDateString()}</span>
                              </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{offer.availability}</span>
                              </div>
                            <div className="flex items-center gap-1">
                              <Trophy className="h-4 w-4" />
                              <span>{offer.total_sessions} sessions</span>
                                </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                </motion.div>
              ))}
            </div>
                    </div>
                  )}

                  {activeTab === "leaderboard" && (
                    <ForumLeaderboard
                      rows={leaderboardView === "weekly" ? weeklyLeaderboard : allTimeLeaderboard}
                      view={leaderboardView}
                      onViewChange={setLeaderboardView}
                    />
                  )}
          </div>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}

