import { sql } from "@/lib/db"
import { ensureCodebenchLiveSnapshotsSchema } from "@/lib/codebench-live-session-schema"
import {
  LIVE_HOLDER_FRESH_MS,
  type LiveEditorHoldSnapshot,
} from "@/lib/codebench-live-handoff"

type HoldQueryRow = {
  assignment_id?: number
  holder_client_id?: string | null
  holder_client_label?: string | null
  holder_seen_at?: string | Date | null
  student_joined_at?: string | Date | null
  student_left_at?: string | Date | null
}

function timeMs(value: string | Date | null | undefined): number | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

function toSnapshot(row: HoldQueryRow | undefined): LiveEditorHoldSnapshot | null {
  if (!row) return null
  return {
    clientId: typeof row.holder_client_id === "string" ? row.holder_client_id : null,
    seenAtMs: timeMs(row.holder_seen_at) ?? timeMs(row.student_joined_at),
    left: row.student_left_at != null,
  }
}

export async function readLiveEditorHold(
  studentDbId: number,
  assignmentId: number,
): Promise<(LiveEditorHoldSnapshot & { clientLabel: string | null }) | null> {
  await ensureCodebenchLiveSnapshotsSchema()
  const rows = await sql`
    SELECT holder_client_id, holder_client_label, holder_seen_at, student_joined_at, student_left_at
    FROM codebench_live_snapshots
    WHERE student_id = ${studentDbId}
      AND assignment_id = ${assignmentId}
    LIMIT 1
  `.catch(() => [])
  const row = rows[0] as HoldQueryRow | undefined
  const snapshot = toSnapshot(row)
  if (!snapshot) return null
  return {
    ...snapshot,
    clientLabel: typeof row?.holder_client_label === "string" ? row.holder_client_label : null,
  }
}

export type FreshEditorHold = {
  assignmentId: number
  clientId: string | null
  clientLabel: string | null
}

/** The student's editor that is still heartbeating, if any. */
export async function readFreshStudentEditorHolds(studentDbId: number): Promise<FreshEditorHold[]> {
  await ensureCodebenchLiveSnapshotsSchema()
  const cutoff = new Date(Date.now() - LIVE_HOLDER_FRESH_MS)
  const rows = await sql`
    SELECT assignment_id, holder_client_id, holder_client_label
    FROM codebench_live_snapshots
    WHERE student_id = ${studentDbId}
      AND student_left_at IS NULL
      AND COALESCE(holder_seen_at, student_joined_at) > ${cutoff}
    ORDER BY COALESCE(holder_seen_at, student_joined_at) DESC
    LIMIT 5
  `.catch(() => [])
  return (rows as HoldQueryRow[])
    .map((row) => ({
      assignmentId: Number(row.assignment_id),
      clientId: typeof row.holder_client_id === "string" ? row.holder_client_id : null,
      clientLabel: typeof row.holder_client_label === "string" ? row.holder_client_label : null,
    }))
    .filter((row) => Number.isFinite(row.assignmentId) && row.assignmentId > 0)
}

/** Assignments whose editor code is already stored, including after a device dies. */
export async function readSavedLiveAssignmentIds(studentDbId: number): Promise<number[]> {
  await ensureCodebenchLiveSnapshotsSchema()
  const rows = await sql`
    SELECT assignment_id
    FROM codebench_live_snapshots
    WHERE student_id = ${studentDbId}
      AND length(btrim(code)) > 0
  `.catch(() => [])
  return (rows as { assignment_id?: number }[])
    .map((row) => Number(row.assignment_id))
    .filter((id) => Number.isFinite(id) && id > 0)
}
