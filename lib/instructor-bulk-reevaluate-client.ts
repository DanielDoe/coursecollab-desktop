/**
 * Calls POST /api/instructor/re-evaluate-attempt until done — same chunked protocol as the UI.
 * Does not create attempts; only updates existing quiz_answers / attempt score via server core.
 */
export type BulkReevalMode = "all" | "failed" | "stuck"

/**
 * Assessment → Re-evaluate tab: one HTTP request per attempt (batched AI for text code; plot questions use vision per question).
 */
export async function runInstructorBulkReevaluateTabBatch(
  attemptId: number,
  mode: BulkReevalMode,
  headers: Record<string, string>
): Promise<Record<string, unknown>> {
  const res = await instructorApiFetch("/api/instructor/re-evaluate-attempt-batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bulk-reevaluate": "1",
      ...headers,
    },
    body: JSON.stringify({ attemptId, mode }),
  })

  const data = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : res.statusText)
  }

  return data
}

export async function runInstructorBulkReevaluateAttempt(
  attemptId: number,
  mode: BulkReevalMode,
  headers: Record<string, string>
): Promise<{ last: Record<string, unknown> }> {
  let answerIds: number[] | undefined
  let index = 0
  let last: Record<string, unknown> = {}
  let guard = 0
  const maxChunks = 500

  for (;;) {
    guard++
    if (guard > maxChunks) {
      throw new Error("Re-evaluation stopped: exceeded maximum steps (possible API loop)")
    }
    const body: Record<string, unknown> = { attemptId, mode }
    if (answerIds != null && answerIds.length > 0) {
      body.answerIds = answerIds
      body.index = index
    }

    const res = await instructorApiFetch("/api/instructor/re-evaluate-attempt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        /** Smaller JSON + less server logging — avoids dev-server memory spikes on long bulk runs */
        "x-bulk-reevaluate": "1",
        ...headers,
      },
      body: JSON.stringify(body),
    })

    const data = (await res.json()) as Record<string, unknown>
    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : res.statusText)
    }

    last = data
    if (Array.isArray(data.answerIds)) {
      answerIds = data.answerIds as number[]
    }

    if (data.done === true) break
    if (typeof data.nextIndex === "number") index = data.nextIndex
    else break
  }

  return { last }
}

/**
 * Student "Re-evaluate all" — one HTTP request for the entire attempt (same batch path as Assessment tab).
 * Fewer API round-trips than chunked `runInstructorBulkReevaluateAttempt`.
 */
export async function runStudentBulkReevaluateBatch(
  attemptId: number,
  mode: BulkReevalMode,
  studentDatabaseId: string
): Promise<Record<string, unknown>> {
  const res = await instructorApiFetch("/api/instructor/re-evaluate-attempt-batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-student-id": studentDatabaseId,
    },
    body: JSON.stringify({ attemptId, mode }),
  })

  const data = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : res.statusText)
  }

  return data
}
