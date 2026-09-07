/**
 * Workspace replay — records how a student built their circuit submission notebook.
 */

import {
  createEmptyWorkspace,
  type CircuitWorkspace,
  type WorkspaceStroke,
} from "@/lib/circuit-workspace"

export type WorkspaceReplayEventOp =
  | "stroke_add"
  | "strokes_replace"
  | "meta_change"
  | "page_switch"

export interface WorkspaceReplayEvent {
  t: number
  op: WorkspaceReplayEventOp
  pageIndex?: number
  stroke?: WorkspaceStroke
  strokes?: WorkspaceStroke[]
  patch?: Partial<CircuitWorkspace>
}

export interface WorkspaceReplay {
  startTime: number
  events: WorkspaceReplayEvent[]
  initialWorkspace?: CircuitWorkspace
}

export function createEmptyWorkspaceReplay(): WorkspaceReplay {
  return {
    startTime: Date.now(),
    events: [],
    initialWorkspace: createEmptyWorkspace(),
  }
}

export function getWorkspaceReplayDuration(replay: WorkspaceReplay | null | undefined): number {
  if (!replay?.events?.length) return 0
  return Math.max(...replay.events.map((e) => e.t), 0) + 500
}

function cloneWorkspace(ws: CircuitWorkspace): CircuitWorkspace {
  return {
    ...ws,
    pages: ws.pages.map((p) => ({ ...p, strokes: [...p.strokes] })),
  }
}

export function getWorkspaceAtTime(
  replay: WorkspaceReplay | null | undefined,
  tMs: number,
): CircuitWorkspace {
  const base = cloneWorkspace(replay?.initialWorkspace ?? createEmptyWorkspace())
  if (!replay?.events?.length) return base

  for (const event of replay.events) {
    if (event.t > tMs) break
    const pageIndex = event.pageIndex ?? base.activePageIndex

    switch (event.op) {
      case "stroke_add": {
        if (!event.stroke) break
        const page = base.pages[pageIndex]
        if (!page) break
        page.strokes = [...page.strokes, event.stroke]
        break
      }
      case "strokes_replace": {
        if (!event.strokes) break
        const page = base.pages[pageIndex]
        if (!page) break
        page.strokes = event.strokes.map((s) => ({ ...s, points: [...s.points] }))
        break
      }
      case "meta_change": {
        if (!event.patch) break
        if (event.patch.pages) {
          base.pages = event.patch.pages.map((p) => ({
            ...p,
            strokes: p.strokes.map((s) => ({ ...s, points: [...s.points] })),
          }))
        }
        if (event.patch.activePageIndex != null) {
          base.activePageIndex = Math.min(
            Math.max(0, event.patch.activePageIndex),
            base.pages.length - 1,
          )
        }
        if (event.patch.tool != null) base.tool = event.patch.tool
        if (event.patch.color != null) base.color = event.patch.color
        if (event.patch.width != null) base.width = event.patch.width
        if (event.patch.paperPattern != null) base.paperPattern = event.patch.paperPattern
        if (event.patch.paperSize != null) base.paperSize = event.patch.paperSize
        break
      }
      case "page_switch": {
        if (event.pageIndex != null) {
          base.activePageIndex = Math.min(
            Math.max(0, event.pageIndex),
            base.pages.length - 1,
          )
        }
        break
      }
    }
  }

  return base
}

export type WorkspaceReplayRecorder = {
  getReplay: () => WorkspaceReplay
  recordStrokeAdd: (pageIndex: number, stroke: WorkspaceStroke) => void
  recordStrokesReplace: (pageIndex: number, strokes: WorkspaceStroke[]) => void
  recordMetaChange: (patch: Partial<CircuitWorkspace>) => void
  recordPageSwitch: (pageIndex: number) => void
  reset: (workspace?: CircuitWorkspace) => void
}

const MAX_REPLAY_EVENTS = 120

export function createWorkspaceReplayRecorder(
  initialWorkspace?: CircuitWorkspace,
): WorkspaceReplayRecorder {
  const startTime = Date.now()
  let anchor = startTime
  let initial = initialWorkspace ? cloneWorkspace(initialWorkspace) : createEmptyWorkspace()
  const events: WorkspaceReplayEvent[] = []

  const push = (event: Omit<WorkspaceReplayEvent, "t">) => {
    if (events.length >= MAX_REPLAY_EVENTS) return
    events.push({ ...event, t: Date.now() - anchor })
  }

  return {
    getReplay: () => ({
      startTime,
      events: [...events],
      initialWorkspace: cloneWorkspace(initial),
    }),
    recordStrokeAdd: (pageIndex, stroke) => {
      push({
        op: "stroke_add",
        pageIndex,
        stroke: { ...stroke, points: [...stroke.points] },
      })
    },
    recordStrokesReplace: (pageIndex, strokes) => {
      push({
        op: "strokes_replace",
        pageIndex,
        strokes: strokes.map((s) => ({ ...s, points: [...s.points] })),
      })
    },
    recordMetaChange: (patch) => {
      push({ op: "meta_change", patch })
    },
    recordPageSwitch: (pageIndex) => {
      push({ op: "page_switch", pageIndex })
    },
    reset: (workspace) => {
      anchor = Date.now()
      events.length = 0
      initial = workspace ? cloneWorkspace(workspace) : createEmptyWorkspace()
    },
  }
}

export function parseWorkspaceReplay(raw: unknown): WorkspaceReplay | null {
  if (!raw || typeof raw !== "object") return null
  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj.events)) return null
  return {
    startTime: Number(obj.startTime) || Date.now(),
    events: obj.events as WorkspaceReplayEvent[],
    initialWorkspace: obj.initialWorkspace as CircuitWorkspace | undefined,
  }
}

export function workspaceReplayHasEvents(replay: WorkspaceReplay | null | undefined): boolean {
  return (replay?.events?.length ?? 0) > 0
}
