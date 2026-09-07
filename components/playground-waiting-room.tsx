"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Loader, Users, Gamepad2, Clock, LogOut, Radio } from "lucide-react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { useToast } from "@/hooks/use-toast"
import { getStudentAuthHeaders } from "@/lib/auth"
import {
  PLAYGROUND_LEAVE_LOBBY_MESSAGE,
  PLAYGROUND_LEAVE_LOBBY_TITLE,
} from "@/lib/playground-join-guard"
import { clearPlaygroundSessionLock, upsertPlaygroundSessionLock } from "@/lib/playground-session-lock"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  getStudentModuleTheme,
  studentModuleIconBadgeClass,
  studentModuleSpinnerClass,
} from "@/lib/student-module-themes"
import { portalOutlineButtonClass } from "@/lib/portal-module-themes"
import { solidListThumb } from "@/lib/student-color-hunt-theme"

const playgroundTheme = getStudentModuleTheme("playground")

type LobbyParticipant = {
  resultId: number
  displayName: string
  inWaitingRoom: boolean
  is_current_user?: boolean
}

type PlaygroundWaitingRoomProps = {
  lobbyPath?: string
  gamePath?: string
  backPath?: string
}

function playerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase()
}

export function PlaygroundWaitingRoom({
  lobbyPath = "/student/dashboard-v2/playground",
  gamePath = "/student/dashboard-v2/playground/game",
  backPath = "/student/dashboard-v2/playground",
}: PlaygroundWaitingRoomProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isPreview = searchParams.get("preview") === "1"
  const { toast } = useToast()
  const [sessionData, setSessionData] = useState<{
    sessionId: number
    resultId: number
    displayName?: string
  } | null>(null)
  const [sessionLabel, setSessionLabel] = useState("")
  const [participants, setParticipants] = useState<LobbyParticipant[]>([])
  const [participantCount, setParticipantCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sessionEndedPollStreakRef = useRef(0)

  useEffect(() => {
    if (isPreview) {
      setSessionData({ sessionId: 0, resultId: 0, displayName: "Daniel Doe" })
      setSessionLabel("Preview lobby")
      setParticipants([
        { resultId: 0, displayName: "Daniel Doe", inWaitingRoom: true, is_current_user: true },
      ])
      setParticipantCount(1)
      setLoading(false)
      return
    }
    const session = sessionStorage.getItem("playgroundSession")
    const student = sessionStorage.getItem("playgroundStudent")
    if (!session || !student) {
      router.push(backPath)
      return
    }
    const parsed = JSON.parse(session)
    setSessionData({
      sessionId: parsed.sessionId,
      resultId: parsed.resultId,
      displayName: parsed.displayName,
    })
    upsertPlaygroundSessionLock({
      sessionId: parsed.sessionId,
      resultId: parsed.resultId,
      mode: parsed.mode === "PERSONAL" ? "PERSONAL" : "CLASSROOM",
      startedAt: Date.now(),
      answeredQuestionIds: [],
      lockedIndex: 0,
    })
  }, [router, backPath, isPreview])

  const leaveLobby = useCallback(() => {
    if (!window.confirm(`${PLAYGROUND_LEAVE_LOBBY_TITLE}\n\n${PLAYGROUND_LEAVE_LOBBY_MESSAGE}`)) {
      return
    }
    sessionStorage.removeItem("playgroundSession")
    sessionStorage.removeItem("playgroundStudent")
    sessionStorage.removeItem("playgroundFromDashboardV2")
    clearPlaygroundSessionLock()
    router.replace(backPath)
  }, [router, backPath])

  const pollLobby = useCallback(async () => {
    if (!sessionData) return
    try {
      const res = await fetch(
        `/api/playground/lobby?sessionId=${sessionData.sessionId}&resultId=${sessionData.resultId}`,
        { headers: getStudentAuthHeaders() },
      )
      if (!res.ok) {
        sessionEndedPollStreakRef.current = 0
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to load lobby")
      }
      const data = await res.json()
      setSessionLabel(data.sessionLabel || data.sessionCode || "Playground")
      setParticipants(data.participants || [])
      setParticipantCount(data.participantCount || 0)
      setError(null)

      if (data.gameStarted) {
        sessionEndedPollStreakRef.current = 0
        const stored = sessionStorage.getItem("playgroundSession")
        if (stored) {
          const parsed = JSON.parse(stored)
          sessionStorage.setItem(
            "playgroundSession",
            JSON.stringify({
              ...parsed,
              waitingRoom: false,
              gameStarted: true,
              currentQuestionIndex: 0,
            }),
          )
        }
        router.replace(gamePath)
        return
      }

      if (data.sessionEnded) {
        sessionEndedPollStreakRef.current += 1
        if (sessionEndedPollStreakRef.current >= 2) {
          sessionStorage.removeItem("playgroundSession")
          sessionStorage.removeItem("playgroundStudent")
          sessionStorage.removeItem("playgroundFromDashboardV2")
          toast({
            title: "Session ended",
            description: "Your instructor closed this playground session.",
          })
          router.replace(backPath)
        }
        return
      }

      sessionEndedPollStreakRef.current = 0
    } catch (e: unknown) {
      sessionEndedPollStreakRef.current = 0
      setError(e instanceof Error ? e.message : "Connection error")
    } finally {
      setLoading(false)
    }
  }, [sessionData, router, gamePath, backPath, toast])

  useEffect(() => {
    if (!sessionData || isPreview) return
    pollLobby()
    const interval = setInterval(pollLobby, 2000)
    return () => clearInterval(interval)
  }, [sessionData, pollLobby, isPreview])

  if (!sessionData) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div
          className={cn(
            "h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)]",
            studentModuleSpinnerClass("playground"),
          )}
        />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-lg space-y-5"
    >
      <header className="space-y-3 text-center">
        <div className="flex justify-center">
          <span className={studentModuleIconBadgeClass("playground", "md")}>
            <Gamepad2 className="h-6 w-6" />
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
            Playground
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--cc-text)]">Waiting room</h1>
          <p className="text-sm text-[var(--cc-text-muted)]">{sessionLabel}</p>
        </div>
        {sessionData.displayName ? (
          <Badge className={cn("text-xs font-medium", playgroundTheme.page.badge)}>
            Playing as {sessionData.displayName}
          </Badge>
        ) : null}
      </header>

      <section className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-7 text-center sm:px-8 sm:py-8">
        <div className="relative mx-auto mb-4 flex size-[4.5rem] items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-[var(--cc-accent)]/20" />
          <span
            className={cn(
              "relative flex size-16 items-center justify-center rounded-2xl shadow-sm",
              playgroundTheme.page.iconBg,
            )}
          >
            <Clock className={cn("h-7 w-7", playgroundTheme.page.iconText)} />
          </span>
        </div>
        <div className="relative space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--muted)]/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--cc-text-muted)]">
            <Radio className={cn("h-3 w-3", playgroundTheme.page.iconText)} />
            Live lobby
          </div>
          <p className="text-base font-semibold text-[var(--cc-text)]">
            Waiting for your instructor to start…
          </p>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-[var(--cc-text-muted)]">
            The quiz begins automatically when your instructor starts the session. You can leave the
            lobby anytime.
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3.5">
          <span className="flex items-center gap-2 text-sm font-semibold text-[var(--cc-text)]">
            <Users className="h-4 w-4 text-[var(--cc-text-muted)]" />
            Players in lobby
          </span>
          <Badge variant="secondary" className={cn("tabular-nums", playgroundTheme.page.badge)}>
            {participantCount}
          </Badge>
        </div>
        <div className="max-h-60 overflow-y-auto">
          {loading && participants.length === 0 ? (
            <div className="flex justify-center p-8">
              <Loader className="h-6 w-6 animate-spin text-[var(--cc-text-muted)]" />
            </div>
          ) : participants.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--cc-text-muted)]">No players yet</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {participants.map((p, index) => {
                const isMe = p.is_current_user || p.resultId === sessionData.resultId
                const thumb = solidListThumb(index)
                return (
                  <li
                    key={p.resultId}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 transition-colors",
                      isMe ? "bg-[color-mix(in_srgb,var(--cc-accent)_10%,var(--card))]" : "hover:bg-[var(--muted)]/40",
                    )}
                  >
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold"
                      style={{ backgroundColor: thumb.fill, color: thumb.icon }}
                    >
                      {playerInitials(p.displayName)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--cc-text)]">
                      {p.displayName}
                    </span>
                    {isMe ? (
                      <Badge
                        variant="outline"
                        className={cn("shrink-0 text-[10px] uppercase tracking-wide", playgroundTheme.page.border, playgroundTheme.page.iconText)}
                      >
                        You
                      </Badge>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-200/80 bg-red-50 px-4 py-3 text-center text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <Button
        variant="outline"
        className={cn("h-11 w-full gap-2", portalOutlineButtonClass(playgroundTheme))}
        onClick={leaveLobby}
      >
        <LogOut className="h-4 w-4" />
        Leave lobby
      </Button>
    </motion.div>
  )
}
