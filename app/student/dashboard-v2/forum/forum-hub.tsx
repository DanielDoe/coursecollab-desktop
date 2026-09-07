"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  MessageSquare,
  Users,
  Trophy,
  Plus,
  Search,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Clock,
  Star,
  SortAsc,
  Calendar,
  UserPlus,
} from "lucide-react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { StudentModuleHubLayout } from "@/components/student/dashboard-v2/StudentModuleHubLayout"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import { Card, CardContent } from "@/components/ui/card"
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
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { cn } from "@/lib/utils"

const forumTheme = getStudentModuleTheme("forum")

const FORUM_SECTION_CARD =
  "min-w-0 border border-slate-200/70 dark:border-white/[0.08] bg-white/90 dark:bg-white/[0.03] rounded-2xl shadow-sm dark:shadow-none"

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

const FORUM_TABS = [
  { id: "discussions", label: "Discussions", icon: MessageSquare },
  { id: "tutoring", label: "Tutoring", icon: Users },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
] as const

type ForumTab = (typeof FORUM_TABS)[number]["id"]

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

  const rawTab = searchParams.get("tab")
  const activeTab: ForumTab =
    rawTab === "tutoring" || rawTab === "leaderboard" ? rawTab : "discussions"
  const [leaderboardView, setLeaderboardView] = useState<"weekly" | "alltime">("weekly")

  const navigateTab = (id: ForumTab) => {
    router.push(id === "discussions" ? FORUM_BASE : `${FORUM_BASE}?tab=${id}`)
  }

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

  if (loading || !studentId) {
    return (
      <StudentModuleHubLayout
        moduleId="forum"
        title="Forum"
        metaLine="Loading…"
        menuView="discussions"
        onMenuSelect={() => {}}
        menuItems={FORUM_TABS.map(({ id, label, icon }) => ({ id, label, icon }))}
        loading
      >
        {null}
      </StudentModuleHubLayout>
    )
  }

  const desktopChrome = isDesktopAppShell()

  const forumMenuItems = FORUM_TABS.map(({ id, label, icon }) => ({
    id,
    label,
    icon,
    badge:
      id === "discussions"
        ? threads.length
        : id === "tutoring"
          ? tutoringOffers.length
          : undefined,
  }))

  const toolbar = (
    <>
      {activeTab !== "leaderboard" ? (
        <>
          <div className="relative h-10 min-w-0 flex-1 basis-[min(100%,12rem)]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
            <Input
              placeholder="Search discussions or tutoring…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "h-10 w-full pl-10 text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] shadow-none focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]/30",
                desktopChrome
                  ? "rounded-full border-0 bg-[var(--sidebar-accent)]/50 focus-visible:bg-[var(--sidebar-accent)]/70"
                  : "rounded-xl border border-[var(--border)] bg-[var(--muted)]/40",
              )}
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-10 w-[9.25rem] shrink-0 rounded-xl border border-[var(--border)] bg-[var(--muted)]/40">
              <SortAsc className="mr-2 h-4 w-4 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="popular">Most Popular</SelectItem>
              <SelectItem value="trending">Trending</SelectItem>
            </SelectContent>
          </Select>
        </>
      ) : null}
    </>
  )

  const headerAction =
    activeTab === "discussions" ? (
      <Button
        type="button"
        className={cn("h-9 shrink-0 rounded-xl border-0 px-3 shadow-none hover:opacity-90", forumTheme.page.cta)}
        onClick={() => setShowNewThread(true)}
      >
        <Plus className="h-4 w-4 sm:mr-1.5" />
        <span className="hidden sm:inline">New discussion</span>
      </Button>
    ) : activeTab === "tutoring" ? (
      <Button
        type="button"
        className={cn("h-9 shrink-0 rounded-xl border-0 px-3 shadow-none hover:opacity-90", forumTheme.page.cta)}
        onClick={() => setShowNewTutoring(true)}
      >
        <Plus className="h-4 w-4 sm:mr-1.5" />
        <span className="hidden sm:inline">Offer tutoring</span>
      </Button>
    ) : null

  const metaLine = (
    <>
      {threads.length} discussion{threads.length === 1 ? "" : "s"} · {tutoringOffers.length} tutoring
      offer{tutoringOffers.length === 1 ? "" : "s"}
    </>
  )

  return (
    <StudentModuleHubLayout
      moduleId="forum"
      title="Forum"
      metaLine={metaLine}
      metaSuffix="ask, help, or climb the board"
      toolbar={toolbar}
      headerAction={headerAction}
      menuView={activeTab}
      onMenuSelect={(id) => navigateTab(id as ForumTab)}
      menuItems={forumMenuItems}
    >
      <div className="w-full min-w-0 overflow-x-hidden">
                  {activeTab === "discussions" && (
                    <div className="space-y-4">
            {threads.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 dark:border-white/10 px-4 py-12 text-center">
                <MessageSquare className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No discussions yet</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Start a discussion with the New discussion button above.
                </p>
              </div>
            ) : (
            <div className="grid gap-4">
              {threads.map((thread, index) => (
                <motion.div
                  key={thread.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card className={cn(FORUM_SECTION_CARD, "hover:bg-slate-100/40 dark:hover:bg-white/[0.05] transition-all duration-300 cursor-pointer")}
                        onClick={() => router.push(`${FORUM_BASE}/thread/${thread.id}`)}>
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", forumTheme.page.iconBg)}>
                          <MessageSquare className={cn("h-6 w-6", forumTheme.page.iconText)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <h3 className="line-clamp-2 text-lg font-semibold text-slate-800 dark:text-white">
                              {thread.title}
                            </h3>
                            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
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
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
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
            )}
                    </div>
                  )}

                  {activeTab === "tutoring" && (
                    <div className="space-y-4">
            {tutoringOffers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 dark:border-white/10 px-4 py-12 text-center">
                <Users className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No tutoring offers yet</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Offer tutoring with the button above.
                </p>
              </div>
            ) : (
            <div className="grid gap-4">
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
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
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
            )}
                    </div>
                  )}

                  {activeTab === "leaderboard" && (
                    <ForumLeaderboard
                      rows={leaderboardView === "weekly" ? weeklyLeaderboard : allTimeLeaderboard}
                      view={leaderboardView}
                      onViewChange={setLeaderboardView}
                    />
                  )}

        <Dialog open={showNewThread} onOpenChange={setShowNewThread}>
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
    </StudentModuleHubLayout>
  )
}

