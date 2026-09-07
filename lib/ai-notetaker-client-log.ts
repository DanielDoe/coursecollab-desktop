"use client"


import { studentApiFetch } from "@/lib/auth"
import type { AiNotetakerClientLogEvent } from "@/lib/ai-notetaker-client-log-shared"
import { isAiNotetakerClientLogEnabled } from "@/lib/ai-notetaker-client-log-shared"

const MAX_BATCH = 40
const FLUSH_MS = 400

type QueueState = {
  timer: ReturnType<typeof setTimeout> | null
  pending: AiNotetakerClientLogEvent[]
  studentId: string | null
  source: string
}

const queues = new Map<string, QueueState>()

function queueKey(studentId: string, source: string) {
  return `${studentId}::${source}`
}

function flushNow(studentId: string, source: string) {
  const key = queueKey(studentId, source)
  const q = queues.get(key)
  if (!q || q.pending.length === 0) return
  const batch = q.pending.splice(0, MAX_BATCH)
  if (q.timer) {
    clearTimeout(q.timer)
    q.timer = null
  }
  void studentApiFetch("/api/student/ai-notetaker/client-log", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-student-database-id": studentId,
    },
    body: JSON.stringify({ source, events: batch }),
    keepalive: true,
  }).catch(() => {})
}

function flushAllQueues() {
  for (const q of queues.values()) {
    if (q.pending.length > 0 && q.studentId) flushNow(q.studentId, q.source)
  }
}

const g = globalThis as typeof globalThis & { __aiNotetakerClientLogHooks?: boolean }
if (typeof document !== "undefined" && !g.__aiNotetakerClientLogHooks) {
  g.__aiNotetakerClientLogHooks = true
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAllQueues()
  })
  document.addEventListener("pagehide", () => flushAllQueues())
}

/**
 * Batched client logs → server terminal (see `client-log` route).
 * Enable with NEXT_PUBLIC_AI_NOTETAKER_CLIENT_LOG=1 in .env.local, then watch `next dev` stdout.
 */
export function logAiNotetakerClient(
  studentDatabaseId: string | null | undefined,
  source: string,
  event: string,
  detail?: Record<string, unknown>,
) {
  if (!isAiNotetakerClientLogEnabled()) return
  const studentId = studentDatabaseId?.trim()
  if (!studentId) return

  const key = queueKey(studentId, source)
  let q = queues.get(key)
  if (!q) {
    q = { timer: null, pending: [], studentId, source }
    queues.set(key, q)
  }
  q.pending.push({ ts: Date.now(), event, detail })
  if (q.pending.length >= MAX_BATCH) {
    flushNow(studentId, source)
    return
  }
  if (!q.timer) {
    q.timer = setTimeout(() => {
      q!.timer = null
      flushNow(studentId, source)
    }, FLUSH_MS)
  }
}
