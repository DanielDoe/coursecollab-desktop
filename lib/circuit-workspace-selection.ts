/**
 * Selection helpers for circuit workspace (box + freeform lasso).
 */

import type { WorkspacePoint, WorkspaceStroke } from "@/lib/circuit-workspace"

export type WorkspaceSelectionRect = { x: number; y: number; w: number; h: number }

export function strokeBounds(stroke: WorkspaceStroke): WorkspaceSelectionRect | null {
  if (stroke.points.length === 0) return null
  if (stroke.tool === "image" && stroke.points.length >= 2) {
    const a = stroke.points[0]!
    const b = stroke.points[1]!
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(b.x - a.x),
      h: Math.abs(b.y - a.y),
    }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of stroke.points) {
    const pad = stroke.width * 2
    minX = Math.min(minX, p.x - pad)
    minY = Math.min(minY, p.y - pad)
    maxX = Math.max(maxX, p.x + pad)
    maxY = Math.max(maxY, p.y + pad)
  }
  if (!Number.isFinite(minX)) return null
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

function rectsOverlap(a: WorkspaceSelectionRect, b: WorkspaceSelectionRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function pointInRect(p: WorkspacePoint, r: WorkspaceSelectionRect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
}

function pointInPolygon(p: WorkspacePoint, polygon: WorkspacePoint[]): boolean {
  if (polygon.length < 3) return false
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.x
    const yi = polygon[i]!.y
    const xj = polygon[j]!.x
    const yj = polygon[j]!.y
    const intersect =
      yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 0.0001) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function normalizeSelectionRect(a: WorkspacePoint, b: WorkspacePoint): WorkspaceSelectionRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  }
}

export function strokesInRect(strokes: WorkspaceStroke[], rect: WorkspaceSelectionRect): WorkspaceStroke[] {
  return strokes.filter((s) => {
    if (s.tool === "eraser") return false
    const bounds = strokeBounds(s)
    return bounds ? rectsOverlap(bounds, rect) : false
  })
}

export function strokesInLasso(strokes: WorkspaceStroke[], lasso: WorkspacePoint[]): WorkspaceStroke[] {
  if (lasso.length < 3) return []
  return strokes.filter((s) => {
    if (s.tool === "eraser") return false
    return s.points.some((p) => pointInPolygon(p, lasso))
  })
}

/** Distance from point to nearest point on stroke path. */
export function distanceToStroke(point: WorkspacePoint, stroke: WorkspaceStroke): number {
  let min = Infinity
  for (const p of stroke.points) {
    const dx = p.x - point.x
    const dy = p.y - point.y
    min = Math.min(min, dx * dx + dy * dy)
  }
  if (stroke.points.length >= 2) {
    for (let i = 1; i < stroke.points.length; i++) {
      const a = stroke.points[i - 1]!
      const b = stroke.points[i]!
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len2 = dx * dx + dy * dy
      if (len2 < 0.01) continue
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2))
      const px = a.x + t * dx
      const py = a.y + t * dy
      const ddx = point.x - px
      const ddy = point.y - py
      min = Math.min(min, ddx * ddx + ddy * ddy)
    }
  }
  return Math.sqrt(min)
}

export function strokesNearPoint(
  strokes: WorkspaceStroke[],
  point: WorkspacePoint,
  radius: number,
): WorkspaceStroke[] {
  return strokes.filter((s) => {
    if (s.tool === "eraser") return false
    const hitRadius = radius + Math.max(2, s.width * 0.5)
    return distanceToStroke(point, s) <= hitRadius
  })
}

export function removeStrokesById(strokes: WorkspaceStroke[], ids: Set<string>): WorkspaceStroke[] {
  return strokes.filter((s) => !ids.has(s.id))
}

/** Union bounding box for a set of selected strokes. */
export function selectionBoundsForStrokes(strokes: WorkspaceStroke[]): WorkspaceSelectionRect | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const stroke of strokes) {
    const b = strokeBounds(stroke)
    if (!b) continue
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.w)
    maxY = Math.max(maxY, b.y + b.h)
  }
  if (!Number.isFinite(minX)) return null
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function pointInStrokeBounds(point: WorkspacePoint, stroke: WorkspaceStroke): boolean {
  const b = strokeBounds(stroke)
  if (!b) return false
  return point.x >= b.x && point.x <= b.x + b.w && point.y >= b.y && point.y <= b.y + b.h
}

/** Topmost stroke under a canvas point (images use bounding box; ink uses path distance). */
export function strokeAtPoint(strokes: WorkspaceStroke[], point: WorkspacePoint): WorkspaceStroke | null {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i]!
    if (stroke.tool === "eraser") continue
    if (stroke.tool === "image") {
      if (pointInStrokeBounds(point, stroke)) return stroke
      continue
    }
    const hitRadius = Math.max(8, stroke.width * 2)
    if (distanceToStroke(point, stroke) <= hitRadius) return stroke
  }
  return null
}

export function translateStrokesByDelta(
  strokes: WorkspaceStroke[],
  ids: Set<string>,
  dx: number,
  dy: number,
): WorkspaceStroke[] {
  if (dx === 0 && dy === 0) return strokes
  return strokes.map((stroke) =>
    ids.has(stroke.id)
      ? { ...stroke, points: stroke.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
      : stroke,
  )
}

export type ImageResizeHandle = "nw" | "ne" | "sw" | "se"

/** Normalized top-left + size for an image attachment stroke. */
export function imageStrokeRect(stroke: WorkspaceStroke): WorkspaceSelectionRect | null {
  if (stroke.tool !== "image" || stroke.points.length < 2) return strokeBounds(stroke)
  const a = stroke.points[0]!
  const b = stroke.points[1]!
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  }
}

const IMAGE_HANDLE_POSITIONS: { handle: ImageResizeHandle; corner: (r: WorkspaceSelectionRect) => WorkspacePoint }[] =
  [
    { handle: "nw", corner: (r) => ({ x: r.x, y: r.y }) },
    { handle: "ne", corner: (r) => ({ x: r.x + r.w, y: r.y }) },
    { handle: "sw", corner: (r) => ({ x: r.x, y: r.y + r.h }) },
    { handle: "se", corner: (r) => ({ x: r.x + r.w, y: r.y + r.h }) },
  ]

export function imageResizeHandleAtPoint(
  point: WorkspacePoint,
  stroke: WorkspaceStroke,
  hitRadius = 12,
): ImageResizeHandle | null {
  const rect = imageStrokeRect(stroke)
  if (!rect || rect.w < 1 || rect.h < 1) return null
  for (const { handle, corner } of IMAGE_HANDLE_POSITIONS) {
    const c = corner(rect)
    const dx = point.x - c.x
    const dy = point.y - c.y
    if (dx * dx + dy * dy <= hitRadius * hitRadius) return handle
  }
  return null
}

export function imageResizeHandlePositions(stroke: WorkspaceStroke): { handle: ImageResizeHandle; x: number; y: number }[] {
  const rect = imageStrokeRect(stroke)
  if (!rect) return []
  return IMAGE_HANDLE_POSITIONS.map(({ handle, corner }) => {
    const c = corner(rect)
    return { handle, x: c.x, y: c.y }
  })
}

export function resizeImageStroke(
  origin: WorkspaceStroke,
  handle: ImageResizeHandle,
  pointer: WorkspacePoint,
  minSize = 32,
): WorkspaceStroke {
  const o = imageStrokeRect(origin)
  if (!o) return origin

  let left = o.x
  let top = o.y
  let right = o.x + o.w
  let bottom = o.y + o.h

  switch (handle) {
    case "nw":
      left = pointer.x
      top = pointer.y
      break
    case "ne":
      right = pointer.x
      top = pointer.y
      break
    case "sw":
      left = pointer.x
      bottom = pointer.y
      break
    case "se":
      right = pointer.x
      bottom = pointer.y
      break
  }

  if (right - left < minSize) {
    if (handle === "nw" || handle === "sw") left = right - minSize
    else right = left + minSize
  }
  if (bottom - top < minSize) {
    if (handle === "nw" || handle === "ne") top = bottom - minSize
    else bottom = top + minSize
  }

  return {
    ...origin,
    points: [
      { x: left, y: top },
      { x: right, y: bottom },
    ],
  }
}
