"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PlaygroundAccessModal } from "@/components/playground-access-modal"
import { useToast } from "@/hooks/use-toast"
import { useStudentOpenPlaygroundLobbies } from "@/hooks/use-student-open-playground-lobbies"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { PLAYGROUND_WEEKLY_CREDITS } from "@/lib/membership-constants"
import { resolvePlaygroundJoinError } from "@/lib/playground-join-client"
import type { OpenPlaygroundLobby } from "@/lib/playground-open-lobby"
import { upsertPlaygroundSessionLock } from "@/lib/playground-session-lock"
import { appendStudentCatalogScopeToUrl } from "@/lib/student-catalog-scope-client"
import { isStudentLectureViewerPath } from "@/lib/dashboard-v2-layout"
import { cn } from "@/lib/utils"
import "@/components/codebench/student-live-classroom-banner.css"

function enterLobby(lobby: OpenPlaygroundLobby, resultId: number, displayName: string) {
  const student = getStudentData()
  upsertPlaygroundSessionLock({
    sessionId: lobby.sessionId,
    resultId,
    mode: "CLASSROOM",
    startedAt: Date.now(),
    answeredQuestionIds: [],
    lockedIndex: 0,
  })
  sessionStorage.setItem(
    "playgroundSession",
    JSON.stringify({
      sessionId: lobby.sessionId,
      resultId,
      mode: "CLASSROOM",
      durationSec: lobby.durationSec,
      displayName,
      waitingRoom: true,
      gameStarted: false,
      currentQuestionIndex: 0,
    }),
  )
  if (student) {
    sessionStorage.setItem(
      "playgroundStudent",
      JSON.stringify({ studentName: student.name, studentId: student.id, nickname: null }),
    )
  }
  sessionStorage.setItem("playgroundFromDashboardV2", "true")
}

export function StudentPlaygroundLobbyNotice({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [studentId, setStudentId] = useState<string | null>(null)
  const [studentName, setStudentName] = useState("")
  const { lobbies, reload } = useStudentOpenPlaygroundLobbies(studentId)
  const [joiningId, setJoiningId] = useState<number | null>(null)
  const [accessOpen, setAccessOpen] = useState(false)
  const [accessModalData, setAccessModalData] = useState<{
    errorType?: "insufficient_credits" | "no_access" | "upgrade_required" | "wait_for_reset"
    errorMessage?: string
    currentCredits?: number
    creditsLimit?: number | "unlimited"
    tier?: string
    daysUntilReset?: number
  }>({})

  useEffect(() => {
    const data = getStudentData()
    setStudentId(data?.id ?? null)
    setStudentName(data?.name ?? "")
  }, [])

  if (!studentId || lobbies.length === 0) return null

  const openWaitingRoom = (lobby: OpenPlaygroundLobby, resultId: number, displayName: string) => {
    enterLobby(lobby, resultId, displayName)
    router.push("/student/dashboard-v2/playground/waiting")
  }

  const joinLobby = async (lobby: OpenPlaygroundLobby) => {
    if (lobby.joinState === "waiting" && lobby.resultId) {
      openWaitingRoom(lobby, lobby.resultId, studentName || "Student")
      return
    }

    const current = getStudentData()
    if (!current) return
    setJoiningId(lobby.sessionId)
    try {
      const response = await studentApiFetch(appendStudentCatalogScopeToUrl("/api/playground/join"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: current.name,
          studentId: current.id,
          mode: "CLASSROOM",
          inviteSessionId: lobby.sessionId,
        }),
      })
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
      if (!response.ok) {
        const resolved = resolvePlaygroundJoinError({
          error: typeof data.error === "string" ? data.error : undefined,
          insufficientCredits: Boolean(data.insufficientCredits),
          creditsRemaining: typeof data.creditsRemaining === "number" ? data.creditsRemaining : undefined,
        })
        if (resolved.showAccessModal) {
          const now = new Date()
          const dayOfWeek = now.getDay()
          setAccessModalData({
            errorType: resolved.errorType,
            errorMessage: resolved.errorMessage,
            currentCredits: resolved.creditsRemaining,
            creditsLimit: PLAYGROUND_WEEKLY_CREDITS,
            tier: sessionStorage.getItem("studentMembershipTier") || "Scholar",
            daysUntilReset: dayOfWeek === 0 ? 7 : 7 - dayOfWeek,
          })
          setAccessOpen(true)
        } else {
          toast({
            title: "Could not join playground",
            description: resolved.errorMessage,
            variant: "destructive",
          })
        }
        void reload(true)
        return
      }

      const resultId = Number(data.resultId)
      if (!Number.isFinite(resultId)) {
        toast({
          title: "Could not join playground",
          description: "The lobby did not confirm your seat.",
          variant: "destructive",
        })
        return
      }
      openWaitingRoom(
        lobby,
        resultId,
        typeof data.displayName === "string" ? data.displayName : current.name,
      )
    } catch (error) {
      toast({
        title: "Could not join playground",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setJoiningId(null)
    }
  }

  const single = lobbies.length === 1 ? lobbies[0] : null

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "student-live-banner",
          compact ? "student-live-banner--compact" : "student-live-banner--roomy",
        )}
      >
        {single ? (
          <LobbyRow lobby={single} joiningId={joiningId} onJoin={joinLobby} compact={compact} />
        ) : (
          <div className="student-live-banner__row">
            <LobbySignal waiting={lobbies.some((lobby) => lobby.joinState === "waiting")} />
            <div className="student-live-banner__copy">
              <p className="student-live-banner__kicker">Playground lobbies are open</p>
              <p className="student-live-banner__title">{lobbies.length} sessions</p>
              <p className="student-live-banner__hint">
                Join a lobby and wait there. Your instructor starts the session when the class is ready.
              </p>
              <div className="student-live-banner__sessions">
                {lobbies.map((lobby) => (
                  <LobbyRow
                    key={lobby.sessionId}
                    lobby={lobby}
                    joiningId={joiningId}
                    onJoin={joinLobby}
                    nested
                    compact={compact}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <PlaygroundAccessModal
        open={accessOpen}
        onClose={() => setAccessOpen(false)}
        errorType={accessModalData.errorType}
        errorMessage={accessModalData.errorMessage}
        currentCredits={accessModalData.currentCredits}
        creditsLimit={accessModalData.creditsLimit}
        tier={accessModalData.tier}
        daysUntilReset={accessModalData.daysUntilReset}
      />
    </>
  )
}

function hidePlaygroundLobbyNotice(pathname: string | null): boolean {
  if (!pathname) return false
  return (
    pathname.includes("/codebench") ||
    isStudentLectureViewerPath(pathname) ||
    pathname.includes("/playground")
  )
}

/** Mounts the invite at the top of the student main column. The desktop shell re-pins layout.tsx, so the notice lives here. */
export function StudentPlaygroundLobbyNoticeHost() {
  const pathname = usePathname()
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (hidePlaygroundLobbyNotice(pathname)) {
      setSlot(null)
      return
    }
    const main = document.querySelector("main[data-tour='main-content']")
    if (!(main instanceof HTMLElement)) {
      setSlot(null)
      return
    }
    const host = document.createElement("div")
    main.prepend(host)
    setSlot(host)
    return () => {
      host.remove()
      setSlot(null)
    }
  }, [pathname])

  if (!slot || hidePlaygroundLobbyNotice(pathname)) return null
  return createPortal(
    <div className="mb-4">
      <StudentPlaygroundLobbyNotice />
    </div>,
    slot,
  )
}

function LobbySignal({ waiting }: { waiting: boolean }) {
  return (
    <div className="student-live-banner__signal">
      <span className="student-live-banner__dot" aria-hidden="true">
        <span className="student-live-banner__ripple" />
        <span className="student-live-banner__ripple student-live-banner__ripple--late" />
      </span>
      <span className="student-live-banner__pill">{waiting ? "LOBBY" : "OPEN"}</span>
    </div>
  )
}

function LobbyRow({
  lobby,
  joiningId,
  onJoin,
  nested = false,
  compact = false,
}: {
  lobby: OpenPlaygroundLobby
  joiningId: number | null
  onJoin: (lobby: OpenPlaygroundLobby) => void
  nested?: boolean
  compact?: boolean
}) {
  const waiting = lobby.joinState === "waiting"
  const busy = joiningId === lobby.sessionId
  const classmates =
    lobby.waitingCount === 1 ? "1 classmate is waiting" : `${lobby.waitingCount} classmates are waiting`

  return (
    <div className={cn(!nested && "student-live-banner__row", nested && "student-live-banner__session")}>
      {!nested ? <LobbySignal waiting={waiting} /> : null}
      <div className={cn(!nested && "student-live-banner__copy", "min-w-0")}>
        {compact ? (
          <p className="student-live-banner__title">
            {lobby.label}
            <span className="student-live-banner__kicker">
              {waiting ? " · in the lobby" : " · join and wait"}
            </span>
          </p>
        ) : (
          <>
            <p className="student-live-banner__kicker">
              {waiting ? "You're in the playground lobby" : "Playground lobby is open"}
            </p>
            <p className="student-live-banner__title">{lobby.label}</p>
            <p className="student-live-banner__hint">
              {waiting
                ? "Stay in the lobby until your instructor starts the session."
                : `Join and wait for your instructor to start. ${classmates}.`}
            </p>
          </>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        className="student-live-banner__cta shrink-0 rounded-full"
        disabled={busy}
        aria-label={waiting ? `Open lobby for ${lobby.label}` : `Join playground ${lobby.label}`}
        onClick={() => onJoin(lobby)}
      >
        {busy ? "Joining…" : waiting ? "Open lobby" : "Join"}
      </Button>
    </div>
  )
}
