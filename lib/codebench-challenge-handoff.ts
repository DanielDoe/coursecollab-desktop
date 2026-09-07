/** Handoff daily challenge context into CodeBench IDE / Ask Cora. */

import type { CoraProblemContext } from "@/lib/cora/types"

export type CodebenchChallengeHandoff = {
  id: string
  title: string
  description: string
  difficulty?: string
  xpReward?: number
  completed?: boolean
  date?: string
  intent?: "solve" | "tutor"
}

const KEY = "codebench_challenge_handoff"

export function setCodebenchChallengeHandoff(payload: CodebenchChallengeHandoff): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...payload, savedAt: Date.now() }))
  } catch {
    // ignore
  }
}

export function peekCodebenchChallengeHandoff(): CodebenchChallengeHandoff | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CodebenchChallengeHandoff
    if (!parsed?.title || !parsed?.description) return null
    return parsed
  } catch {
    return null
  }
}

export function consumeCodebenchChallengeHandoff(): CodebenchChallengeHandoff | null {
  const payload = peekCodebenchChallengeHandoff()
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(KEY)
    } catch {
      // ignore
    }
  }
  return payload
}

export function challengeToCoraProblem(challenge: CodebenchChallengeHandoff): CoraProblemContext {
  return {
    source: "codebench",
    domain: "coding",
    title: challenge.title,
    questionText: challenge.description,
    topic: "Daily challenge",
    hint: "Guide the student with hints and structure — do not dump a full solution unless they explicitly ask.",
  }
}
