import { isPlaygroundAttemptResumable } from "@/lib/playground-attempt-status"

const LOCK_KEY = "cc_playground_session_lock"

export type PlaygroundSessionLock = {
  sessionId: number
  resultId: number
  mode: "CLASSROOM" | "PERSONAL"
  startedAt: number
  answeredQuestionIds: number[]
  lockedIndex: number
  completed?: boolean
}

export function getPlaygroundSessionLock(): PlaygroundSessionLock | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(LOCK_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PlaygroundSessionLock
  } catch {
    return null
  }
}

export function setPlaygroundSessionLock(lock: PlaygroundSessionLock): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LOCK_KEY, JSON.stringify(lock))
}

export function clearPlaygroundSessionLock(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(LOCK_KEY)
}

export function upsertPlaygroundSessionLock(
  partial: Pick<PlaygroundSessionLock, "sessionId" | "resultId" | "mode"> &
    Partial<PlaygroundSessionLock>,
): PlaygroundSessionLock {
  const existing = getPlaygroundSessionLock()
  const resultChanged = existing != null && existing.resultId !== partial.resultId
  const next: PlaygroundSessionLock = {
    sessionId: partial.sessionId,
    resultId: partial.resultId,
    mode: partial.mode,
    startedAt: partial.startedAt ?? existing?.startedAt ?? Date.now(),
    answeredQuestionIds:
      partial.answeredQuestionIds ??
      (resultChanged ? [] : existing?.answeredQuestionIds ?? []),
    lockedIndex: partial.lockedIndex ?? (resultChanged ? 0 : existing?.lockedIndex ?? 0),
    completed: partial.completed ?? (resultChanged ? false : existing?.completed ?? false),
  }
  setPlaygroundSessionLock(next)
  return next
}

export function recordPlaygroundAnswerLock(questionId: number, nextIndex: number): void {
  const lock = getPlaygroundSessionLock()
  if (!lock) return
  const answered = lock.answeredQuestionIds.includes(questionId)
    ? lock.answeredQuestionIds
    : [...lock.answeredQuestionIds, questionId]
  setPlaygroundSessionLock({
    ...lock,
    answeredQuestionIds: answered,
    lockedIndex: Math.max(lock.lockedIndex, nextIndex),
  })
}

export function completePlaygroundSessionLock(): void {
  const lock = getPlaygroundSessionLock()
  if (!lock) return
  clearPlaygroundSessionLock()
}

export function playgroundLockGamePath(lock: PlaygroundSessionLock, fromDashboardV2: boolean): string {
  const params = `sessionId=${lock.sessionId}&resultId=${lock.resultId}`
  const base = fromDashboardV2 ? "/student/dashboard-v2/playground" : "/student/playground"
  return lock.completed ? base : `${base}/game`
}

export async function playgroundLockStillActive(
  sessionId: number,
  resultId: number,
): Promise<boolean> {
  try {
    const res = await fetch(`/api/playground/lobby?sessionId=${sessionId}&resultId=${resultId}`)
    if (!res.ok) {
      clearPlaygroundSessionLock()
      return false
    }
    const data = await res.json()
    if (data.sessionEnded || data.attemptRevoked) {
      clearPlaygroundSessionLock()
      return false
    }
    if (!data.myResult) {
      clearPlaygroundSessionLock()
      return false
    }
    const questionCount = Number(data.questionCount ?? 0)
    if (!isPlaygroundAttemptResumable(data.myResult, questionCount)) {
      clearPlaygroundSessionLock()
      return false
    }
    return true
  } catch {
    clearPlaygroundSessionLock()
    return false
  }
}

/** Restore sessionStorage and return the route to resume an in-progress web session. */
export async function resumePlaygroundWebSession(
  lock: PlaygroundSessionLock,
  fromDashboardV2: boolean,
): Promise<string | null> {
  const base = fromDashboardV2 ? "/student/dashboard-v2/playground" : "/student/playground"
  if (lock.completed) return base

  try {
    const res = await fetch(`/api/playground/lobby?sessionId=${lock.sessionId}&resultId=${lock.resultId}`)
    if (!res.ok) {
      clearPlaygroundSessionLock()
      return null
    }
    const data = await res.json()
    if (data.sessionEnded || data.attemptRevoked) {
      clearPlaygroundSessionLock()
      return null
    }
    if (!data.myResult) {
      clearPlaygroundSessionLock()
      return null
    }
    const questionCount = Number(data.questionCount ?? 0)
    if (!isPlaygroundAttemptResumable(data.myResult, questionCount)) {
      clearPlaygroundSessionLock()
      return null
    }

    const gameStarted = Boolean(data.gameStarted)
    sessionStorage.setItem(
      "playgroundSession",
      JSON.stringify({
        sessionId: lock.sessionId,
        resultId: lock.resultId,
        mode: lock.mode,
        durationSec: data.durationSec ?? 10,
        displayName: data.displayName,
        waitingRoom: !gameStarted,
        gameStarted,
        currentQuestionIndex: lock.lockedIndex,
      }),
    )
    if (fromDashboardV2) {
      sessionStorage.setItem("playgroundFromDashboardV2", "true")
    } else {
      sessionStorage.removeItem("playgroundFromDashboardV2")
    }

    return gameStarted ? `${base}/game` : `${base}/waiting`
  } catch {
    clearPlaygroundSessionLock()
    return null
  }
}
