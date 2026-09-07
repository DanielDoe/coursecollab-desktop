/**
 * Canvas rendering for circuit submission workspace pages.
 */

import type { WorkspacePage, WorkspacePoint, WorkspaceStroke } from "@/lib/circuit-workspace"
import {
  WORKSPACE_CANVAS_HEIGHT,
  WORKSPACE_CANVAS_WIDTH,
  WORKSPACE_EXPORT_SCALE,
  resolveStrokeColorForTheme,
  type WorkspacePaperPattern,
  type WorkspacePaperTheme,
} from "@/lib/circuit-workspace"

const imageElementCache = new Map<string, HTMLImageElement>()
const serverRenderImages = new Map<string, CanvasImageSource>()

export function registerServerWorkspaceImage(dataUrl: string, image: CanvasImageSource): void {
  serverRenderImages.set(dataUrl, image)
}

export function clearServerWorkspaceImages(): void {
  serverRenderImages.clear()
}

function getImageElement(dataUrl: string): HTMLImageElement | CanvasImageSource | null {
  const serverImg = serverRenderImages.get(dataUrl)
  if (serverImg) return serverImg
  let img = imageElementCache.get(dataUrl)
  if (!img) {
    if (imageElementCache.size >= 24) {
      const oldest = imageElementCache.keys().next().value
      if (oldest) imageElementCache.delete(oldest)
    }
    img = new Image()
    img.src = dataUrl
    imageElementCache.set(dataUrl, img)
  }
  return img.complete && img.naturalWidth > 0 ? img : null
}

export function preloadWorkspaceImage(dataUrl: string, onLoad: () => void): void {
  let img = imageElementCache.get(dataUrl)
  if (!img) {
    img = new Image()
    img.src = dataUrl
    imageElementCache.set(dataUrl, img)
  }
  if (img.complete) {
    onLoad()
    return
  }
  img.onload = () => onLoad()
}

type PaperStyle = {
  background: string
  lineColor: string
  marginColor: string
  headerBg: string
  headerText: string
}

function paperStyle(theme: WorkspacePaperTheme): PaperStyle {
  if (theme === "dark") {
    return {
      background: "#1a1a22",
      lineColor: "rgba(203, 213, 225, 0.22)",
      marginColor: "rgba(165, 180, 252, 0.35)",
      headerBg: "rgba(15, 23, 42, 0.95)",
      headerText: "#e2e8f0",
    }
  }
  // light + export (always light paper for grading readability)
  return {
    background: "#faf8f5",
    lineColor: "rgba(148, 163, 184, 0.45)",
    marginColor: "rgba(99, 102, 241, 0.18)",
    headerBg: "rgba(248, 250, 252, 0.95)",
    headerText: "#64748b",
  }
}

function drawRuledLines(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: PaperStyle,
  topOffset = 0,
) {
  ctx.save()
  ctx.strokeStyle = style.lineColor
  ctx.lineWidth = 1
  const lineSpacing = 32
  for (let y = 80 + topOffset; y < height; y += lineSpacing) {
    ctx.beginPath()
    ctx.moveTo(48, y)
    ctx.lineTo(width - 24, y)
    ctx.stroke()
  }
  ctx.strokeStyle = style.marginColor
  ctx.beginPath()
  ctx.moveTo(48, topOffset)
  ctx.lineTo(48, height)
  ctx.stroke()
  ctx.restore()
}

function drawDottedPattern(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: PaperStyle,
  topOffset = 0,
) {
  ctx.save()
  ctx.fillStyle = style.lineColor
  const spacing = 24
  for (let y = 48 + topOffset; y < height; y += spacing) {
    for (let x = 48; x < width - 24; x += spacing) {
      ctx.beginPath()
      ctx.arc(x, y, 1.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function drawGridPattern(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: PaperStyle,
  topOffset = 0,
) {
  ctx.save()
  ctx.strokeStyle = style.lineColor
  ctx.lineWidth = 1
  const spacing = 32
  for (let y = topOffset; y < height; y += spacing) {
    ctx.beginPath()
    ctx.moveTo(24, y)
    ctx.lineTo(width - 24, y)
    ctx.stroke()
  }
  for (let x = 24; x < width; x += spacing) {
    ctx.beginPath()
    ctx.moveTo(x, topOffset)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  ctx.restore()
}

function drawPaperPattern(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: PaperStyle,
  pattern: WorkspacePaperPattern,
  topOffset = 0,
) {
  switch (pattern) {
    case "plain":
      return
    case "dotted":
      drawDottedPattern(ctx, width, height, style, topOffset)
      return
    case "grid":
      drawGridPattern(ctx, width, height, style, topOffset)
      return
    case "ruled":
    default:
      drawRuledLines(ctx, width, height, style, topOffset)
  }
}

function drawImageStroke(ctx: CanvasRenderingContext2D, stroke: WorkspaceStroke) {
  if (!stroke.imageDataUrl || stroke.points.length === 0) return
  const img = getImageElement(stroke.imageDataUrl)
  if (!img) return
  const a = stroke.points[0]!
  const b = stroke.points[1] ?? { x: a.x + img.naturalWidth, y: a.y + img.naturalHeight }
  const w = b.x - a.x
  const h = b.y - a.y
  if (w === 0 || h === 0) return
  ctx.drawImage(img as CanvasImageSource, a.x, a.y, w, h)
}

function drawExportHeader(
  ctx: CanvasRenderingContext2D,
  width: number,
  label: string,
  style: PaperStyle,
) {
  const h = 56
  ctx.save()
  ctx.fillStyle = style.headerBg
  ctx.fillRect(0, 0, width, h)
  ctx.strokeStyle = style.lineColor
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, h)
  ctx.lineTo(width, h)
  ctx.stroke()
  ctx.fillStyle = style.headerText
  ctx.font = "500 22px system-ui, -apple-system, sans-serif"
  ctx.textBaseline = "middle"
  ctx.fillText(label, 48, h / 2)
  ctx.restore()
  return h
}

function strokePath(ctx: CanvasRenderingContext2D, points: WorkspacePoint[], closed = false) {
  if (points.length === 0) return
  if (points.length === 1) {
    const p = points[0]
    ctx.beginPath()
    ctx.arc(p.x, p.y, 0.5, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2
    const midY = (points[i].y + points[i + 1].y) / 2
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY)
  }
  const last = points[points.length - 1]
  if (points.length >= 2) {
    const prev = points[points.length - 2]
    ctx.quadraticCurveTo(prev.x, prev.y, last.x, last.y)
  }
  if (closed) ctx.closePath()
  ctx.stroke()
}

function applyStrokeStyle(
  ctx: CanvasRenderingContext2D,
  stroke: WorkspaceStroke,
  paperTheme: WorkspacePaperTheme,
) {
  const { tool, width, points } = stroke
  if (points.length === 0) return

  if (tool === "image") {
    drawImageStroke(ctx, stroke)
    return
  }

  const color = resolveStrokeColorForTheme(stroke.color, paperTheme)

  if (tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out"
    ctx.strokeStyle = "rgba(0,0,0,1)"
    ctx.lineWidth = Math.max(4, width)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    strokePath(ctx, points)
    ctx.globalCompositeOperation = "source-over"
    return
  }

  ctx.globalCompositeOperation = "source-over"
  ctx.lineCap = "round"
  ctx.lineJoin = "round"

  if (tool === "highlighter") {
    ctx.globalAlpha = paperTheme === "dark" ? 0.52 : 0.42
    ctx.strokeStyle = color
    ctx.lineWidth = width * 3.5
    strokePath(ctx, points)
    ctx.globalAlpha = 1
    return
  }

  if (tool === "line" && points.length >= 2) {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y)
    ctx.stroke()
    return
  }

  if (tool === "rect" && points.length >= 2) {
    const a = points[0]
    const b = points[points.length - 1]
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y)
    return
  }

  if (tool === "ellipse" && points.length >= 2) {
    const a = points[0]
    const b = points[points.length - 1]
    const cx = (a.x + b.x) / 2
    const cy = (a.y + b.y) / 2
    const rx = Math.abs(b.x - a.x) / 2
    const ry = Math.abs(b.y - a.y) / 2
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2)
    ctx.stroke()
    return
  }

  ctx.strokeStyle = color
  if (points.some((p) => p.p != null && p.p > 0)) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]
      const b = points[i]
      const pressure = ((a.p ?? 0.5) + (b.p ?? 0.5)) / 2
      ctx.lineWidth = width * (0.35 + pressure * 1.25)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
  } else {
    ctx.lineWidth = width
    strokePath(ctx, points)
  }
}

export type WorkspaceRenderOptions = {
  paperPattern?: WorkspacePaperPattern
  width?: number
  height?: number
  theme?: WorkspacePaperTheme
  exportLabel?: string
  scale?: number
  /** Live editor: draw ink directly (faster than compositing an offscreen layer). */
  directInk?: boolean
}

function drawWorkspaceStrokes(
  ctx: CanvasRenderingContext2D,
  page: WorkspacePage,
  renderTheme: WorkspacePaperTheme,
) {
  for (const stroke of page.strokes) {
    if (stroke.tool === "image") drawImageStroke(ctx, stroke)
  }
  for (const stroke of page.strokes) {
    if (stroke.tool !== "image" && stroke.tool !== "eraser") {
      applyStrokeStyle(ctx, stroke, renderTheme)
    }
  }
  for (const stroke of page.strokes) {
    if (stroke.tool === "eraser") applyStrokeStyle(ctx, stroke, renderTheme)
  }
}

/** Paper background only — safe to cache while pattern/theme/size are unchanged. */
export function renderWorkspacePaperBackground(
  ctx: CanvasRenderingContext2D,
  options?: WorkspaceRenderOptions,
) {
  const theme = options?.theme ?? "light"
  const style = paperStyle(theme === "export" ? "export" : theme)
  const logicalW = options?.width ?? WORKSPACE_CANVAS_WIDTH
  const logicalH = options?.height ?? WORKSPACE_CANVAS_HEIGHT
  const scale = options?.scale ?? 1

  ctx.save()
  if (scale !== 1) ctx.scale(scale, scale)
  ctx.fillStyle = style.background
  ctx.fillRect(0, 0, logicalW, logicalH)

  let topOffset = 0
  if (options?.exportLabel) {
    topOffset = drawExportHeader(ctx, logicalW, options.exportLabel, style)
  }

  drawPaperPattern(
    ctx,
    logicalW,
    logicalH,
    style,
    options?.paperPattern ?? "ruled",
    topOffset,
  )
  ctx.restore()
}

export function renderWorkspaceStrokes(
  ctx: CanvasRenderingContext2D,
  page: WorkspacePage,
  options?: WorkspaceRenderOptions,
) {
  const theme = options?.theme ?? "light"
  const renderTheme = theme === "export" ? "export" : theme
  const logicalW = options?.width ?? WORKSPACE_CANVAS_WIDTH
  const logicalH = options?.height ?? WORKSPACE_CANVAS_HEIGHT
  const scale = options?.scale ?? 1

  ctx.save()
  if (scale !== 1) ctx.scale(scale, scale)

  if (options?.directInk || typeof document === "undefined") {
    drawWorkspaceStrokes(ctx, page, renderTheme)
  } else {
    const inkCanvas = document.createElement("canvas")
    inkCanvas.width = logicalW
    inkCanvas.height = logicalH
    const inkCtx = inkCanvas.getContext("2d")
    if (inkCtx) {
      drawWorkspaceStrokes(inkCtx, page, renderTheme)
      ctx.drawImage(inkCanvas, 0, 0)
    }
  }
  ctx.restore()
}

export function renderWorkspacePage(
  ctx: CanvasRenderingContext2D,
  page: WorkspacePage,
  options?: WorkspaceRenderOptions,
) {
  renderWorkspacePaperBackground(ctx, options)
  renderWorkspaceStrokes(ctx, page, options)
}

export async function ensureWorkspaceImagesLoaded(page: WorkspacePage): Promise<void> {
  const waits = page.strokes
    .filter((s) => s.tool === "image" && s.imageDataUrl)
    .map(
      (s) =>
        new Promise<void>((resolve) => {
          if (!s.imageDataUrl) {
            resolve()
            return
          }
          preloadWorkspaceImage(s.imageDataUrl, resolve)
        }),
    )
  await Promise.all(waits)
}

export async function workspacePageToBlob(
  page: WorkspacePage,
  options?: {
    pageIndex?: number
    totalPages?: number
    title?: string
    mime?: "image/png" | "image/jpeg"
    paperPattern?: WorkspacePaperPattern
    width?: number
    height?: number
  },
): Promise<Blob | null> {
  if (typeof document === "undefined") return null
  await ensureWorkspaceImagesLoaded(page)

  const logicalW = options?.width ?? WORKSPACE_CANVAS_WIDTH
  const logicalH = options?.height ?? WORKSPACE_CANVAS_HEIGHT
  const scale = WORKSPACE_EXPORT_SCALE
  const canvas = document.createElement("canvas")
  canvas.width = logicalW * scale
  canvas.height = logicalH * scale
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  const pageNum = (options?.pageIndex ?? 0) + 1
  const total = options?.totalPages ?? 1
  const label = options?.title
    ? `${options.title} — Page ${pageNum} of ${total}`
    : `Worked solution — Page ${pageNum} of ${total}`

  renderWorkspacePage(ctx, page, {
    theme: "export",
    scale,
    exportLabel: label,
    paperPattern: options?.paperPattern ?? "ruled",
    width: logicalW,
    height: logicalH,
  })

  const mime = options?.mime ?? "image/png"
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, mime === "image/jpeg" ? 0.78 : undefined)
  })
}

export async function workspacePageToDataUrl(
  page: WorkspacePage,
  theme: WorkspacePaperTheme = "light",
  dimensions?: { width?: number; height?: number },
): Promise<string | null> {
  if (typeof document === "undefined") return null
  const logicalW = dimensions?.width ?? WORKSPACE_CANVAS_WIDTH
  const logicalH = dimensions?.height ?? WORKSPACE_CANVAS_HEIGHT
  const canvas = document.createElement("canvas")
  canvas.width = logicalW
  canvas.height = logicalH
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  renderWorkspacePage(ctx, page, { theme, width: logicalW, height: logicalH })
  return canvas.toDataURL("image/png")
}
