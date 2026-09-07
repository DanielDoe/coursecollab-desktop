/**
 * Eraser geometry — pixel (partial) and stroke (whole) modes.
 */

import {
  newWorkspaceStrokeId,
  type WorkspaceEraserMode,
  type WorkspacePoint,
  type WorkspaceStroke,
} from "@/lib/circuit-workspace"
import { distanceToStroke, removeStrokesById, strokesNearPoint } from "@/lib/circuit-workspace-selection"

function distPointToSegment(p: WorkspacePoint, a: WorkspacePoint, b: WorkspacePoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 < 0.01) {
    const ex = p.x - a.x
    const ey = p.y - a.y
    return Math.sqrt(ex * ex + ey * ey)
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  const px = a.x + t * dx
  const py = a.y + t * dy
  const ex = p.x - px
  const ey = p.y - py
  return Math.sqrt(ex * ex + ey * ey)
}

function isPointErased(p: WorkspacePoint, eraserPath: WorkspacePoint[], radius: number): boolean {
  for (const e of eraserPath) {
    const dx = p.x - e.x
    const dy = p.y - e.y
    if (dx * dx + dy * dy <= radius * radius) return true
  }
  for (let i = 1; i < eraserPath.length; i++) {
    if (distPointToSegment(p, eraserPath[i - 1]!, eraserPath[i]!) <= radius) return true
  }
  return false
}

/** Sample points along the eraser path for hit-testing and brush preview. */
export function sampleEraserBrushPath(path: WorkspacePoint[], radius: number): WorkspacePoint[] {
  if (path.length <= 1) return path
  const out: WorkspacePoint[] = [path[0]!]
  const step = Math.max(4, radius * 0.35)
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!
    const b = path[i]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.sqrt(dx * dx + dy * dy)
    const n = Math.max(1, Math.ceil(len / step))
    for (let s = 1; s <= n; s++) {
      const t = s / n
      out.push({ x: a.x + dx * t, y: a.y + dy * t })
    }
  }
  return out
}

function splitPenStroke(
  stroke: WorkspaceStroke,
  eraserPath: WorkspacePoint[],
  radius: number,
): WorkspaceStroke[] {
  const segments: WorkspacePoint[][] = []
  let current: WorkspacePoint[] = []

  for (const p of stroke.points) {
    if (isPointErased(p, eraserPath, radius)) {
      if (current.length >= 2) segments.push(current)
      current = []
      continue
    }
    current.push(p)
  }
  if (current.length >= 2) segments.push(current)

  if (segments.length === 0) return []
  return segments.map((points) => ({
    ...stroke,
    id: newWorkspaceStrokeId(),
    points,
  }))
}

function imageTouchesEraser(stroke: WorkspaceStroke, eraserPath: WorkspacePoint[], radius: number): boolean {
  if (stroke.points.length === 0) return false
  const a = stroke.points[0]!
  const b = stroke.points[1] ?? a
  const corners = [
    a,
    { x: b.x, y: a.y },
    b,
    { x: a.x, y: b.y },
    { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  ]
  return corners.some((p) => isPointErased(p, eraserPath, radius))
}

function shapeTouchesEraser(stroke: WorkspaceStroke, eraserPath: WorkspacePoint[], radius: number): boolean {
  return stroke.points.some((p) => isPointErased(p, eraserPath, radius))
}

/** Remove legacy eraser strokes from stored page data. */
export function stripLegacyEraserStrokes(strokes: WorkspaceStroke[]): WorkspaceStroke[] {
  return strokes.filter((s) => s.tool !== "eraser")
}

/** Partial erase — trim/split ink strokes along the eraser path. */
export function applyPixelEraser(
  strokes: WorkspaceStroke[],
  eraserPath: WorkspacePoint[],
  radius: number,
): WorkspaceStroke[] {
  const ink = stripLegacyEraserStrokes(strokes)
  if (eraserPath.length === 0) return ink

  const sampled = sampleEraserBrushPath(eraserPath, radius)
  const out: WorkspaceStroke[] = []

  for (const stroke of ink) {
    if (stroke.tool === "image") {
      if (!imageTouchesEraser(stroke, sampled, radius)) out.push(stroke)
      continue
    }
    if (["line", "rect", "ellipse"].includes(stroke.tool)) {
      if (!shapeTouchesEraser(stroke, sampled, radius)) out.push(stroke)
      continue
    }
    out.push(...splitPenStroke(stroke, sampled, radius))
  }
  return out
}

/** Whole-stroke erase — remove strokes touched by the eraser path. */
export function applyStrokeEraser(
  strokes: WorkspaceStroke[],
  eraserPath: WorkspacePoint[],
  radius: number,
): WorkspaceStroke[] {
  const ink = stripLegacyEraserStrokes(strokes)
  if (eraserPath.length === 0) return ink

  const toRemove = new Set<string>()
  for (const sample of sampleEraserBrushPath(eraserPath, radius)) {
    for (const hit of strokesNearPoint(ink, sample, radius)) {
      toRemove.add(hit.id)
    }
  }
  return removeStrokesById(ink, toRemove)
}

/** Live preview while the eraser gesture is in progress. */
export function computeEraserPreview(
  strokes: WorkspaceStroke[],
  eraserPath: WorkspacePoint[],
  radius: number,
  mode: WorkspaceEraserMode,
): WorkspaceStroke[] {
  if (eraserPath.length === 0) return stripLegacyEraserStrokes(strokes)
  return mode === "stroke"
    ? applyStrokeEraser(strokes, eraserPath, radius)
    : applyPixelEraser(strokes, eraserPath, radius)
}

/** Stroke ids that would be removed in stroke-eraser mode (for highlight overlay). */
export function strokesMarkedForStrokeEraser(
  strokes: WorkspaceStroke[],
  eraserPath: WorkspacePoint[],
  radius: number,
): Set<string> {
  const ink = stripLegacyEraserStrokes(strokes)
  if (eraserPath.length === 0) return new Set()

  const after = applyStrokeEraser(ink, eraserPath, radius)
  const afterIds = new Set(after.map((s) => s.id))
  const marked = new Set<string>()
  for (const s of ink) {
    if (!afterIds.has(s.id)) marked.add(s.id)
  }
  return marked
}
