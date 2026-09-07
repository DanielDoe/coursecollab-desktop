/**
 * Ephemeral presentation pointer — wet felt marker / highlighter overlay.
 * Never persisted to workspace strokes or exports.
 */

import type { WorkspacePaperTheme } from "@/lib/circuit-workspace"

export const WORKSPACE_POINTER_FADE_MS = 1_500
export const WORKSPACE_POINTER_HOVER_FADE_MS = 550

export type EphemeralPointerPoint = { x: number; y: number; t: number }

export type EphemeralPointerTrail = {
  id: string
  color: string
  width: number
  points: EphemeralPointerPoint[]
  /** Set when stylus/mouse is lifted; fade starts from this moment. */
  releasedAt?: number
}

export type EphemeralPointerHover = {
  x: number
  y: number
  t: number
  color: string
  width: number
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.trim().toLowerCase()
  const match = /^#?([0-9a-f]{6})$/.exec(normalized)
  if (!match) return { r: 230, g: 57, b: 70 }
  const value = Number.parseInt(match[1]!, 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function fadeAlpha(ageMs: number, fadeMs: number): number {
  if (ageMs >= fadeMs) return 0
  const t = 1 - ageMs / fadeMs
  return t * t * (3 - 2 * t)
}

/** Match persisted highlighter ink opacity on light vs dark paper. */
function markerInkAlpha(paperTheme: WorkspacePaperTheme): number {
  return paperTheme === "dark" ? 0.52 : 0.42
}

function drawMarkerDab(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  rgb: { r: number; g: number; b: number },
  alpha: number,
  paperTheme: WorkspacePaperTheme,
) {
  if (alpha <= 0.01 || radius <= 0) return
  const ink = markerInkAlpha(paperTheme) * alpha
  ctx.save()
  ctx.globalCompositeOperation = "source-over"
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${ink * 0.88})`)
  gradient.addColorStop(0.72, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${ink * 0.5})`)
  gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawMarkerSegment(
  ctx: CanvasRenderingContext2D,
  a: EphemeralPointerPoint,
  b: EphemeralPointerPoint,
  width: number,
  rgb: { r: number; g: number; b: number },
  alpha: number,
  paperTheme: WorkspacePaperTheme,
) {
  if (alpha <= 0.01) return

  const ink = markerInkAlpha(paperTheme) * alpha
  ctx.save()
  ctx.globalCompositeOperation = "source-over"
  ctx.lineCap = "round"
  ctx.lineJoin = "round"

  ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${ink * 0.35})`
  ctx.lineWidth = width * 1.12
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()

  ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${ink * 0.82})`
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
  ctx.restore()
}

function trailDrawAlpha(trail: EphemeralPointerTrail, now: number, fadeMs: number): number {
  if (trail.releasedAt == null) return 1
  return fadeAlpha(now - trail.releasedAt, fadeMs)
}

function drawTrail(
  trail: EphemeralPointerTrail,
  ctx: CanvasRenderingContext2D,
  now: number,
  fadeMs: number,
  paperTheme: WorkspacePaperTheme,
) {
  const trailAlpha = trailDrawAlpha(trail, now, fadeMs)
  if (trailAlpha <= 0.01) return

  const rgb = hexToRgb(trail.color)
  const radius = trail.width * 0.48

  for (let i = 0; i < trail.points.length; i++) {
    const p = trail.points[i]!
    drawMarkerDab(ctx, p.x, p.y, radius, rgb, trailAlpha, paperTheme)
    if (i > 0) {
      drawMarkerSegment(ctx, trail.points[i - 1]!, p, trail.width, rgb, trailAlpha, paperTheme)
    }
  }
}

export function drawPointerSpot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  width: number,
  ageMs: number,
  fadeMs: number,
  paperTheme: WorkspacePaperTheme = "light",
) {
  const alpha = fadeAlpha(ageMs, fadeMs)
  if (alpha <= 0.01) return
  const rgb = hexToRgb(color)
  drawMarkerDab(ctx, x, y, width * 0.38, rgb, alpha, paperTheme)
}

export function drawEphemeralPointerOverlay(
  ctx: CanvasRenderingContext2D,
  trails: EphemeralPointerTrail[],
  hover: EphemeralPointerHover | null,
  now: number,
  fadeMs = WORKSPACE_POINTER_FADE_MS,
  paperTheme: WorkspacePaperTheme = "light",
) {
  ctx.save()
  for (const trail of trails) {
    drawTrail(trail, ctx, now, fadeMs, paperTheme)
  }
  if (hover) {
    drawPointerSpot(
      ctx,
      hover.x,
      hover.y,
      hover.color,
      hover.width,
      now - hover.t,
      WORKSPACE_POINTER_HOVER_FADE_MS,
      paperTheme,
    )
  }
  ctx.restore()
}

export function pruneEphemeralTrails(
  trails: EphemeralPointerTrail[],
  now: number,
  fadeMs = WORKSPACE_POINTER_FADE_MS,
): EphemeralPointerTrail[] {
  return trails.filter(
    (trail) => trail.releasedAt == null || now - trail.releasedAt < fadeMs,
  )
}

export function newEphemeralPointerTrailId(): string {
  return `ptr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/** Same width feel as the highlighter tool, slightly wider minimum for presentation. */
export function pointerDrawWidth(strokeWidth: number): number {
  return Math.max(18, strokeWidth * 3.5)
}
