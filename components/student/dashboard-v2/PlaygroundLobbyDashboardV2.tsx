"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Users,
  User,
  Gamepad2,
  Trophy,
  Loader2,
  Star,
  Target,
  Coins,
  Zap,
} from "lucide-react"
import { ThemeKpiCard } from "@/components/student/dashboard-v2/ThemeKpiCard"
import { solidListThumb } from "@/lib/student-color-hunt-theme"
import { useToast } from "@/hooks/use-toast"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { PlaygroundAccessModal } from "@/components/playground-access-modal"
import { resolvePlaygroundJoinError } from "@/lib/playground-join-client"
import { PLAYGROUND_WEEKLY_CREDITS } from "@/lib/membership-constants"
import {
  getPlaygroundSessionLock,
  playgroundLockStillActive,
  resumePlaygroundWebSession,
  upsertPlaygroundSessionLock,
} from "@/lib/playground-session-lock"
import { cn } from "@/lib/utils"
import { studentModuleSpinnerClass } from "@/lib/student-module-themes"

const DASHBOARD_V2_PLAYGROUND = "/student/dashboard-v2/playground"

export function PlaygroundLobbyDashboardV2() {
  const router = useRouter()
  const { toast } = useToast()
  const [studentName, setStudentName] = useState("")
  const [studentId, setStudentId] = useState("")
  const [nickname, setNickname] = useState("")
  const [classPasscode, setClassPasscode] = useState("")
  const [mode, setMode] = useState<"CLASSROOM" | "PERSONAL">("CLASSROOM")
  const [isJoining, setIsJoining] = useState(false)
  const [studentData, setStudentData] = useState<any>(null)
  const [accumulatedPoints, setAccumulatedPoints] = useState<number | null>(null)
  const [bestScore, setBestScore] = useState<number | null>(null)
  const [averageScore, setAverageScore] = useState<number | null>(null)
  const [totalGames, setTotalGames] = useState<number | null>(null)
  const [playgroundCredits, setPlaygroundCredits] = useState<number | null>(null)
  const [creditsLimit, setCreditsLimit] = useState<number | "unlimited" | null>(null)
  const [isUnlimited, setIsUnlimited] = useState<boolean>(false)
  const [showAccessModal, setShowAccessModal] = useState(false)
  const [accessModalData, setAccessModalData] = useState<{
    errorType?: "insufficient_credits" | "no_access" | "upgrade_required" | "wait_for_reset"
    errorMessage?: string
    currentCredits?: number
    creditsLimit?: number | "unlimited"
    tier?: string
    daysUntilReset?: number
  }>({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const data = getStudentData()
    if (!data) {
      router.push("/student/login")
      return
    }
    setStudentData(data)
    setStudentName(data.name || "")
    setStudentId(data.id || "")
    setMounted(true)
  }, [router])

  useEffect(() => {
    const fetchStudentStats = async () => {
      try {
        const studentSessionData = localStorage.getItem("studentSession")
        if (!studentSessionData) return

        const sessionData = JSON.parse(studentSessionData)
        const studentDbId = sessionData.databaseId
        const sessionCode = sessionData.section || "ALL"

        if (!studentDbId) return

        await studentApiFetch(`/api/student/membership/refresh?studentId=${studentDbId}`).catch(() => {})

        const pointsResponse = await studentApiFetch(
          `/api/trade-center/points?studentId=${studentDbId}&session=${sessionCode}`,
        )
        if (pointsResponse.ok) {
          const pointsData = await pointsResponse.json()
          if (pointsData.points) {
            setAccumulatedPoints(pointsData.points.playground_points || 0)
          }
        }

        const scoresResponse = await studentApiFetch(`/api/playground/scores?studentId=${studentDbId}`)
        if (scoresResponse.ok) {
          const scoresData = await scoresResponse.json()
          const games = Number(scoresData.totalGames ?? 0)
          setTotalGames(games)
          if (games > 0) {
            setBestScore(scoresData.bestScore || 0)
            setAverageScore(scoresData.averageScore || 0)
          } else {
            setBestScore(null)
            setAverageScore(null)
          }
        }

        const creditsResponse = await studentApiFetch(`/api/playground/credits?studentId=${studentDbId}`)
        if (creditsResponse.ok) {
          const creditsData = await creditsResponse.json()
          setPlaygroundCredits(creditsData.credits || 0)
          setCreditsLimit(creditsData.creditsLimit || 0)
          setIsUnlimited(creditsData.isUnlimited || false)
        }
      } catch {
        // Error fetching
      }
    }

    if (studentData) {
      fetchStudentStats()
    }
  }, [studentData])

  useEffect(() => {
    void (async () => {
      const lock = getPlaygroundSessionLock()
      if (!lock || lock.completed) return
      const stillActive = await playgroundLockStillActive(lock.sessionId, lock.resultId)
      if (!stillActive) return
      const resumePath = await resumePlaygroundWebSession(lock, true)
      if (resumePath) {
        toast({
          title: "Session in progress",
          description: "Resuming your active playground session.",
        })
        router.replace(resumePath)
      }
    })()
  }, [router, toast])

  const handleJoin = async () => {
    if (!studentName.trim() || !studentId.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both your name and student ID",
        variant: "destructive",
      })
      return
    }

    if (mode === "CLASSROOM" && classPasscode.trim().length !== 5) {
      toast({
        title: "Passcode Required",
        description: "Enter the 5-character passcode from your instructor",
        variant: "destructive",
      })
      return
    }

    setIsJoining(true)

    const existingLock = getPlaygroundSessionLock()
    if (existingLock && !existingLock.completed) {
      const stillActive = await playgroundLockStillActive(existingLock.sessionId, existingLock.resultId)
      if (stillActive) {
        toast({
          title: "Session in progress",
          description: "Leave and rejoin is disabled during active games.",
          variant: "destructive",
        })
        const resumePath = await resumePlaygroundWebSession(existingLock, true)
        if (resumePath) router.replace(resumePath)
        setIsJoining(false)
        return
      }
    }

    const goToPlayground = (data: Record<string, unknown>) => {
      if (typeof data.sessionId === "number" && typeof data.resultId === "number") {
        upsertPlaygroundSessionLock({
          sessionId: data.sessionId,
          resultId: data.resultId,
          mode,
          startedAt: Date.now(),
          answeredQuestionIds: [],
          lockedIndex: 0,
        })
      }
      sessionStorage.setItem("playgroundSession", JSON.stringify(data))
      sessionStorage.setItem(
        "playgroundStudent",
        JSON.stringify({ studentName, studentId, nickname: nickname.trim() || null }),
      )
      sessionStorage.setItem("playgroundFromDashboardV2", "true")
      if (data.waitingRoom && !data.gameStarted) {
        router.push("/student/dashboard-v2/playground/waiting")
      } else {
        router.push("/student/dashboard-v2/playground/game")
      }
    }

    try {
      const response = await studentApiFetch("/api/playground/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName,
          studentId,
          mode,
          nickname: nickname.trim() || null,
          passcode: mode === "CLASSROOM" ? classPasscode.trim().toUpperCase() : undefined,
        }),
      })

      if (!response.ok) {
        let errorData: Record<string, unknown> = {}
        try {
          errorData = await response.json()
        } catch {}

        const resolved = resolvePlaygroundJoinError({
          error: typeof errorData.error === "string" ? errorData.error : undefined,
          insufficientCredits: Boolean(errorData.insufficientCredits),
          creditsRemaining:
            typeof errorData.creditsRemaining === "number" ? errorData.creditsRemaining : undefined,
        })

        if (!resolved.showAccessModal) {
          toast({
            title: "Could not join",
            description: resolved.errorMessage,
            variant: "destructive",
          })
          setIsJoining(false)
          return
        }

        const now = new Date()
        const dayOfWeek = now.getDay()
        const daysUntilReset = dayOfWeek === 0 ? 7 : 7 - dayOfWeek

        const studentSessionData = localStorage.getItem("studentSession")
        let studentDbId: string | null = null
        let currentTier = "Scholar"
        if (studentSessionData) {
          const sessionData = JSON.parse(studentSessionData)
          studentDbId = sessionData.databaseId
          currentTier = sessionStorage.getItem("studentMembershipTier") || "Scholar"
        }

        try {
          const refreshResponse = await studentApiFetch(`/api/student/membership/refresh?studentId=${studentDbId}`)
          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json()
            if (refreshData.tier) {
              sessionStorage.setItem("studentMembershipTier", refreshData.tier)
              localStorage.setItem("studentMembershipTier", refreshData.tier)
            }
            if (refreshData.hasDonationAccess) {
              const retryResponse = await studentApiFetch("/api/playground/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  studentName,
                  studentId,
                  mode,
                  nickname: nickname.trim() || null,
                  passcode: mode === "CLASSROOM" ? classPasscode.trim().toUpperCase() : undefined,
                }),
              })
              if (retryResponse.ok) {
                const retryData = await retryResponse.json()
                goToPlayground(retryData)
                return
              }
            }
          }
        } catch {}

        setAccessModalData({
          errorType: resolved.errorType,
          errorMessage: resolved.errorMessage,
          currentCredits: resolved.creditsRemaining ?? playgroundCredits ?? 0,
          creditsLimit: creditsLimit || PLAYGROUND_WEEKLY_CREDITS,
          tier: currentTier,
          daysUntilReset,
        })
        setShowAccessModal(true)
        setIsJoining(false)
        return
      }

      const data = await response.json()
      goToPlayground(data)
    } catch (error: any) {
      if (!showAccessModal) {
        toast({
          title: "Error",
          description: error?.message || "Failed to join playground. Please try again.",
          variant: "destructive",
        })
      }
    } finally {
      setIsJoining(false)
    }
  }

  if (!mounted || !studentData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className={cn("animate-spin rounded-full h-10 w-10 border-2 border-slate-200 dark:border-slate-700", studentModuleSpinnerClass("playground"))} />
      </div>
    )
  }

  let lastClassroomSessionId: number | null = null
  try {
    const lastSession = sessionStorage.getItem("playgroundSession")
    if (lastSession) {
      const sessionData = JSON.parse(lastSession)
      if (sessionData.sessionId && sessionData.mode === "CLASSROOM") {
        lastClassroomSessionId = sessionData.sessionId
      }
    }
  } catch {
    lastClassroomSessionId = null
  }

  const creditsLabel = isUnlimited
    ? "Unlimited credits"
    : playgroundCredits !== null
      ? `${playgroundCredits} credits${creditsLimit ? ` / ${creditsLimit}` : ""}`
      : null

  const outOfPlaygroundCredits =
    !isUnlimited && playgroundCredits !== null && playgroundCredits <= 0

  const handleJoinClick = () => {
    if (outOfPlaygroundCredits) {
      const now = new Date()
      const dayOfWeek = now.getDay()
      const daysUntilReset = dayOfWeek === 0 ? 7 : 7 - dayOfWeek
      setAccessModalData({
        errorType: "insufficient_credits",
        errorMessage: "You've used your weekly playground credits. Upgrade for more sessions or wait until Monday.",
        currentCredits: playgroundCredits ?? 0,
        creditsLimit: creditsLimit || PLAYGROUND_WEEKLY_CREDITS,
        tier: sessionStorage.getItem("studentMembershipTier") || "Scholar",
        daysUntilReset,
      })
      setShowAccessModal(true)
      return
    }
    void handleJoin()
  }

  const showStats =
    accumulatedPoints !== null ||
    bestScore !== null ||
    averageScore !== null ||
    playgroundCredits !== null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 w-full min-w-0 overflow-x-hidden"
    >
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
          Playground
        </p>
        <p className="mt-0.5 text-sm text-[var(--cc-text)]">
          Join a live classroom battle or practice solo at your own pace.
        </p>
      </div>

      {showStats ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {accumulatedPoints !== null ? (
            <ThemeKpiCard
              label="Playground pts"
              value={accumulatedPoints.toLocaleString()}
              icon={Trophy}
              thumb={solidListThumb(0)}
              footer="Trade Center balance"
            />
          ) : null}
          {bestScore !== null ? (
            <ThemeKpiCard
              label="Best score"
              value={bestScore.toLocaleString()}
              icon={Star}
              thumb={solidListThumb(1)}
              footer="Personal peak"
            />
          ) : null}
          {averageScore !== null ? (
            <ThemeKpiCard
              label="Average"
              value={averageScore.toLocaleString()}
              icon={Target}
              thumb={solidListThumb(2)}
              footer={totalGames != null ? `${totalGames} games played` : "Across sessions"}
            />
          ) : null}
          {playgroundCredits !== null ? (
            <ThemeKpiCard
              label="Credits"
              value={isUnlimited ? "∞" : playgroundCredits}
              icon={isUnlimited ? Zap : Coins}
              thumb={solidListThumb(3)}
              footer={
                isUnlimited
                  ? "Unlimited this week"
                  : creditsLimit
                    ? `${creditsLimit} per week`
                    : "Weekly allowance"
              }
            />
          ) : null}
        </div>
      ) : null}

      <p className="text-xs text-[var(--cc-text-muted)]">
        10s per question · +100 correct · +10 speed bonus
        {creditsLabel ? ` · ${creditsLabel}` : ""}
      </p>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
          Choose mode
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("CLASSROOM")}
            className={cn(
              "flex min-h-[104px] w-full items-center gap-3 rounded-xl border px-3 text-left sm:px-4",
              mode === "CLASSROOM"
                ? "border-[var(--cc-accent)] bg-[var(--card)]"
                : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/40",
            )}
          >
            <span
              className="flex size-12 shrink-0 items-center justify-center rounded-[14px]"
              style={{
                backgroundColor: mode === "CLASSROOM" ? "var(--cc-accent)" : "var(--muted)",
                color: mode === "CLASSROOM" ? "#FFFFFF" : "var(--cc-text)",
              }}
            >
              <Users className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--cc-text)]">Classroom battle</p>
              <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">
                Live vs classmates · instructor passcode
              </p>
              <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-[var(--cc-accent-dark)]">
                <Trophy className="h-3 w-3" />
                Live leaderboard
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode("PERSONAL")}
            className={cn(
              "flex min-h-[104px] w-full items-center gap-3 rounded-xl border px-3 text-left sm:px-4",
              mode === "PERSONAL"
                ? "border-[var(--cc-accent)] bg-[var(--card)]"
                : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/40",
            )}
          >
            <span
              className="flex size-12 shrink-0 items-center justify-center rounded-[14px]"
              style={{
                backgroundColor: mode === "PERSONAL" ? "var(--cc-accent)" : "var(--muted)",
                color: mode === "PERSONAL" ? "#FFFFFF" : "var(--cc-text)",
              }}
            >
              <User className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--cc-text)]">Solo practice</p>
              <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">
                Your pace · track personal bests
              </p>
              <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-[var(--cc-accent-dark)]">
                <Star className="h-3 w-3" />
                Personal records
              </p>
            </div>
          </button>
        </div>
      </div>

      <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
            Your details
          </p>
          <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">
            Name and ID are locked for verification. Add a nickname to show on the leaderboard instead.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="playground-full-name" className="text-sm font-medium text-[var(--cc-text)]">
              Full name
            </Label>
            <Input
              id="playground-full-name"
              value={studentName}
              disabled
              readOnly
              className="h-11 rounded-xl border-[var(--border)] bg-[var(--muted)]/50 text-[var(--cc-text)] cursor-not-allowed opacity-90"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="playground-student-id" className="text-sm font-medium text-[var(--cc-text)]">
              Student ID
            </Label>
            <Input
              id="playground-student-id"
              value={studentId}
              disabled
              readOnly
              className="h-11 rounded-xl border-[var(--border)] bg-[var(--muted)]/50 text-[var(--cc-text)] cursor-not-allowed opacity-90"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="playground-nickname" className="text-sm font-medium text-[var(--cc-text)]">
            Gaming nickname{" "}
            <span className="text-xs font-normal text-[var(--cc-text-muted)]">(optional)</span>
          </Label>
          <Input
            id="playground-nickname"
            placeholder="Shown on the leaderboard instead of your name"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            disabled={isJoining}
            maxLength={50}
            className="h-11 rounded-xl border-[var(--border)] bg-[var(--muted)]/40"
          />
          <p className="text-xs text-[var(--cc-text-muted)]">
            Leave blank to use your full name on the leaderboard.
          </p>
        </div>

        {mode === "CLASSROOM" ? (
          <div className="space-y-1.5">
            <Label htmlFor="playground-passcode" className="text-sm font-medium text-[var(--cc-text)]">
              Session passcode
            </Label>
            <Input
              id="playground-passcode"
              placeholder="PASSCODE"
              value={classPasscode}
              onChange={(e) =>
                setClassPasscode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))
              }
              disabled={isJoining}
              maxLength={5}
              className="h-14 rounded-xl border-[var(--border)] bg-[var(--muted)]/40 text-center font-mono text-xl tracking-[0.4em] uppercase"
            />
          </div>
        ) : null}
        <Button
          onClick={handleJoinClick}
          disabled={isJoining || outOfPlaygroundCredits}
          className="h-11 w-full rounded-xl border-0 shadow-none hover:opacity-90"
          style={{ backgroundColor: "var(--cc-accent)", color: "#FFFFFF" }}
        >
          {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gamepad2 className="mr-2 h-4 w-4" />}
          {isJoining ? "Joining…" : outOfPlaygroundCredits ? "No credits left" : mode === "CLASSROOM" ? "Join battle" : "Start practice"}
        </Button>
        {outOfPlaygroundCredits ? (
          <p className="text-center text-xs text-[var(--cc-text-muted)]">
            Weekly playground credits reset every Monday. Upgrade for more sessions.
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        {lastClassroomSessionId ? (
          <Button variant="outline" className="rounded-xl" asChild>
            <Link
              href={`${DASHBOARD_V2_PLAYGROUND}/leaderboard?sessionId=${lastClassroomSessionId}&mode=CLASSROOM`}
            >
              <Trophy className="mr-2 h-4 w-4" />
              Classroom leaderboard
            </Link>
          </Button>
        ) : null}
        {totalGames != null && totalGames > 0 ? (
          <Button variant="outline" className="rounded-xl" asChild>
            <Link href={`${DASHBOARD_V2_PLAYGROUND}/leaderboard?sessionId=0&mode=PERSONAL`}>
              <Star className="mr-2 h-4 w-4" />
              Personal records
            </Link>
          </Button>
        ) : null}
      </div>

      <PlaygroundAccessModal
        open={showAccessModal}
        onClose={() => setShowAccessModal(false)}
        errorType={accessModalData.errorType}
        errorMessage={accessModalData.errorMessage}
        currentCredits={accessModalData.currentCredits}
        creditsLimit={accessModalData.creditsLimit || 0}
        tier={accessModalData.tier}
        daysUntilReset={accessModalData.daysUntilReset}
      />
    </motion.div>
  )
}
