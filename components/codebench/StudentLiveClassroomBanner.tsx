"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import type { StudentLiveClassroomSession } from "@/lib/codebench-live-classroom-types"
import { cn } from "@/lib/utils"
import "./student-live-classroom-banner.css"

type Props = {
  sessions: StudentLiveClassroomSession[]
  activeAssignmentId?: string | null
  onJoin: (session: StudentLiveClassroomSession) => void
  onLeave?: (session: StudentLiveClassroomSession) => void
  compact?: boolean
}

function questionPreview(text: string, max = 140) {
  const plain = text.replace(/\s+/g, " ").trim()
  if (plain.length <= max) return plain
  return `${plain.slice(0, max).trim()}…`
}

function LiveSignal({ joined }: { joined: boolean }) {
  return (
    <div className="student-live-banner__signal">
      <span className="student-live-banner__dot" aria-hidden="true">
        <span className="student-live-banner__ripple" />
        <span className="student-live-banner__ripple student-live-banner__ripple--late" />
      </span>
      <span className="student-live-banner__pill">{joined ? "ON AIR" : "LIVE"}</span>
    </div>
  )
}

function sessionAction(opts: {
  session: StudentLiveClassroomSession
  joined: boolean
  compact: boolean
  onJoin: (session: StudentLiveClassroomSession) => void
  onLeave?: (session: StudentLiveClassroomSession) => void
}) {
  const { session, joined, compact, onJoin, onLeave } = opts
  if (joined && onLeave) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        {!compact ? (
          <Button
            type="button"
            size="sm"
            className="student-live-banner__cta rounded-full"
            aria-label={`Open editor for ${session.title}`}
            onClick={() => onJoin(session)}
          >
            Open editor
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            "student-live-banner__cta student-live-banner__cta--exit rounded-full",
            compact && "h-7 px-3 text-xs",
          )}
          aria-label={`Exit live classroom ${session.title}`}
          onClick={() => onLeave(session)}
        >
          Exit
        </Button>
      </div>
    )
  }
  return (
    <Button
      type="button"
      size="sm"
      variant={joined ? "outline" : "default"}
      className={cn("student-live-banner__cta rounded-full", compact && "h-7 px-3 text-xs")}
      aria-label={joined ? `Stay in ${session.title}` : `Join live classroom ${session.title}`}
      onClick={() => onJoin(session)}
    >
      {joined ? (compact ? "Joined" : "Open editor") : "Join"}
    </Button>
  )
}

export function StudentLiveClassroomBanner({
  sessions,
  activeAssignmentId,
  onJoin,
  onLeave,
  compact = false,
}: Props) {
  const joinedAny = sessions.some(
    (session) => String(activeAssignmentId ?? "") === String(session.assignmentId),
  )
  const [joinBurst, setJoinBurst] = useState(false)
  const wasJoinedRef = useRef(false)

  useEffect(() => {
    if (joinedAny && !wasJoinedRef.current) {
      setJoinBurst(true)
      const timer = window.setTimeout(() => setJoinBurst(false), 900)
      wasJoinedRef.current = true
      return () => window.clearTimeout(timer)
    }
    wasJoinedRef.current = joinedAny
  }, [joinedAny])

  if (sessions.length === 0) return null

  const single = sessions.length === 1 ? sessions[0] : null
  const singleJoined =
    Boolean(single) && String(activeAssignmentId ?? "") === String(single?.assignmentId)

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "student-live-banner",
        compact ? "student-live-banner--compact" : "student-live-banner--roomy",
        joinedAny && "student-live-banner--on-air",
        joinBurst && "student-live-banner--joining",
      )}
    >
      {single ? (
        <div className="student-live-banner__row">
          <LiveSignal joined={singleJoined} />
          <div className="student-live-banner__copy">
            {compact ? (
              <p className="student-live-banner__title">
                {single.title}
                {singleJoined ? (
                  <span className="student-live-banner__kicker"> · sharing your editor</span>
                ) : null}
              </p>
            ) : (
              <>
                <p className="student-live-banner__kicker">
                  {singleJoined ? "You are in live classroom" : "Live classroom is open"}
                </p>
                <p className="student-live-banner__title">{single.title}</p>
                <p className="student-live-banner__hint">
                  {singleJoined
                    ? "Your instructor can see this editor as you type."
                    : "Join to open the assignment. Your instructor can watch your code."}
                </p>
              </>
            )}
          </div>
          {sessionAction({
            session: single,
            joined: singleJoined,
            compact,
            onJoin,
            onLeave,
          })}
        </div>
      ) : (
        <div className="student-live-banner__row">
          <LiveSignal joined={joinedAny} />
          <div className="student-live-banner__copy">
            <p className="student-live-banner__title">
              {sessions.length} live classroom sessions
            </p>
            {!compact ? (
              <p className="student-live-banner__hint">
                Join the assignment you are working on. Your instructor can watch your code.
              </p>
            ) : null}
            <div className="student-live-banner__sessions">
              {sessions.map((session) => {
                const joined = String(activeAssignmentId ?? "") === String(session.assignmentId)
                return (
                  <div key={session.sessionId} className="student-live-banner__session">
                    <div className="min-w-0">
                      <p className="student-live-banner__title">{session.title}</p>
                      {!compact ? (
                        <p className="student-live-banner__hint">
                          {joined
                            ? "You are in this session · instructor can see your keystrokes"
                            : questionPreview(session.questionText)}
                        </p>
                      ) : null}
                    </div>
                    {sessionAction({
                      session,
                      joined,
                      compact,
                      onJoin,
                      onLeave,
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
