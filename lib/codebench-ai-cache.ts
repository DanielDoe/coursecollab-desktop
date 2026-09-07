import { normalizePaceMode, type ReplayPaceMode } from "@/lib/codebench-replay-modes"

const CACHE_VERSION = "v1"
const MAX_CACHE_ENTRIES = 80

export type CodebenchAiCachePayload = {
  explanation?: string
  replaySteps?: unknown[]
  debugResult?: unknown
  improvedCode?: unknown
  pseudocode?: unknown
}

type StoredCacheEntry = CodebenchAiCachePayload & { savedAt: number }

function cacheStorageKey(studentId: string | null): string {
  return studentId ? `codebench_ai_cache_${CACHE_VERSION}_${studentId}` : `codebench_ai_cache_${CACHE_VERSION}`
}

function progressStorageKey(studentId: string | null): string {
  return studentId ? `codebench_replay_progress_${CACHE_VERSION}_${studentId}` : `codebench_replay_progress_${CACHE_VERSION}`
}

export function loadCodebenchAiCache(studentId: string | null): Map<string, CodebenchAiCachePayload> {
  if (typeof window === "undefined") return new Map()
  try {
    const raw = localStorage.getItem(cacheStorageKey(studentId))
    if (!raw) return new Map()
    const parsed = JSON.parse(raw) as Record<string, StoredCacheEntry>
    return new Map(
      Object.entries(parsed).map(([key, entry]) => [
        key,
        {
          explanation: entry.explanation,
          replaySteps: entry.replaySteps,
          debugResult: entry.debugResult,
          improvedCode: entry.improvedCode,
          pseudocode: entry.pseudocode,
        },
      ]),
    )
  } catch {
    return new Map()
  }
}

export function persistCodebenchAiCacheEntry(
  studentId: string | null,
  cacheKey: string,
  payload: CodebenchAiCachePayload,
): void {
  if (typeof window === "undefined") return
  try {
    const storageKey = cacheStorageKey(studentId)
    const raw = localStorage.getItem(storageKey)
    const store: Record<string, StoredCacheEntry> = raw ? JSON.parse(raw) : {}

    store[cacheKey] = { ...payload, savedAt: Date.now() }

    const entries = Object.entries(store).sort((a, b) => b[1].savedAt - a[1].savedAt)
    const trimmed = Object.fromEntries(entries.slice(0, MAX_CACHE_ENTRIES))
    localStorage.setItem(storageKey, JSON.stringify(trimmed))
  } catch {
    // ignore quota / private mode
  }
}

export type ReplayProgress = {
  step: number
  paceMode: ReplayPaceMode
}

export function loadReplayProgress(studentId: string | null, codeHash: string): ReplayProgress | null {
  if (typeof window === "undefined" || !codeHash) return null
  try {
    const raw = localStorage.getItem(progressStorageKey(studentId))
    if (!raw) return null
    const all = JSON.parse(raw) as Record<string, ReplayProgress>
    const saved = all[codeHash]
    if (!saved) return null
    return {
      step: Number.isFinite(saved.step) ? Math.max(0, Math.floor(saved.step)) : 0,
      paceMode: normalizePaceMode(saved.paceMode),
    }
  } catch {
    return null
  }
}

export function saveReplayProgress(
  studentId: string | null,
  codeHash: string,
  progress: ReplayProgress,
): void {
  if (typeof window === "undefined" || !codeHash) return
  try {
    const storageKey = progressStorageKey(studentId)
    const raw = localStorage.getItem(storageKey)
    const all: Record<string, ReplayProgress> = raw ? JSON.parse(raw) : {}
    all[codeHash] = progress
    localStorage.setItem(storageKey, JSON.stringify(all))
  } catch {
    // ignore
  }
}
