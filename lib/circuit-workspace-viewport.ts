/**
 * Viewport pan/zoom for circuit workspace canvas.
 */

import {
  WORKSPACE_CANVAS_HEIGHT,
  WORKSPACE_CANVAS_WIDTH,
} from "@/lib/circuit-workspace"
import type { WorkspacePoint } from "@/lib/circuit-workspace"

/** userZoom 1 = fitted to container; pan offsets in screen pixels */
export type WorkspaceViewport = {
  userZoom: number
  panX: number
  panY: number
}

export type WorkspaceFitMode = "width" | "page" | "cover"

export const DEFAULT_WORKSPACE_VIEWPORT: WorkspaceViewport = {
  userZoom: 1,
  panX: 0,
  panY: 0,
}

export const WORKSPACE_USER_ZOOM_MIN = 0.5
export const WORKSPACE_USER_ZOOM_MAX = 4
export const WORKSPACE_USER_ZOOM_STEP = 0.25

export function clampUserZoom(zoom: number): number {
  return Math.min(WORKSPACE_USER_ZOOM_MAX, Math.max(WORKSPACE_USER_ZOOM_MIN, zoom))
}

export type WorkspacePaperDimensions = {
  width?: number
  height?: number
}

function resolvePaperDimensions(dims?: WorkspacePaperDimensions) {
  return {
    width: dims?.width ?? WORKSPACE_CANVAS_WIDTH,
    height: dims?.height ?? WORKSPACE_CANVAS_HEIGHT,
  }
}

/**
 * Fit zoom for the workspace page.
 * - width: fit page width (scroll/pan vertically — notebook default)
 * - page: entire page visible (letterbox)
 * - cover: fill container (legacy)
 */
export function computeFitZoom(
  containerWidth: number,
  containerHeight: number,
  paper: WorkspacePaperDimensions = {},
  mode: WorkspaceFitMode = "width",
): number {
  if (containerWidth <= 0 || containerHeight <= 0) return 0
  const { width: paperWidth, height: paperHeight } = resolvePaperDimensions(paper)
  const fitW = containerWidth / paperWidth
  const fitH = containerHeight / paperHeight
  if (mode === "width") return fitW
  if (mode === "page") return Math.min(fitW, fitH)
  return Math.max(fitW, fitH)
}

export function fitWorkspaceViewport(
  containerWidth: number,
  containerHeight: number,
  paper: WorkspacePaperDimensions = {},
  mode: WorkspaceFitMode = "width",
): WorkspaceViewport {
  const { width: paperWidth, height: paperHeight } = resolvePaperDimensions(paper)
  const fitZoom = computeFitZoom(containerWidth, containerHeight, paper, mode)
  const scaledW = paperWidth * fitZoom
  const scaledH = paperHeight * fitZoom
  return clampWorkspacePan(
    {
      userZoom: 1,
      panX: scaledW >= containerWidth ? 0 : (containerWidth - scaledW) / 2,
      panY: scaledH >= containerHeight ? 0 : (containerHeight - scaledH) / 2,
    },
    containerWidth,
    containerHeight,
    paper,
  )
}

export function totalViewportScale(
  containerWidth: number,
  containerHeight: number,
  viewport: WorkspaceViewport,
  paper: WorkspacePaperDimensions = {},
  mode: WorkspaceFitMode = "width",
): number {
  return computeFitZoom(containerWidth, containerHeight, paper, mode) * viewport.userZoom
}

/** Keep pan within scrollable bounds; center when the page is smaller than the view. */
export function clampWorkspacePan(
  viewport: WorkspaceViewport,
  containerWidth: number,
  containerHeight: number,
  paper: WorkspacePaperDimensions = {},
  mode: WorkspaceFitMode = "width",
): WorkspaceViewport {
  const { width: paperWidth, height: paperHeight } = resolvePaperDimensions(paper)
  const scale = computeFitZoom(containerWidth, containerHeight, paper, mode) * viewport.userZoom
  const scaledW = paperWidth * scale
  const scaledH = paperHeight * scale

  let panX = viewport.panX
  let panY = viewport.panY

  if (scaledW <= containerWidth + 1) {
    panX = (containerWidth - scaledW) / 2
  } else {
    panX = Math.min(0, Math.max(containerWidth - scaledW, panX))
  }

  if (scaledH <= containerHeight + 1) {
    panY = (containerHeight - scaledH) / 2
  } else {
    panY = Math.min(0, Math.max(containerHeight - scaledH, panY))
  }

  return { ...viewport, panX, panY }
}

export function panWorkspaceByDelta(
  viewport: WorkspaceViewport,
  deltaX: number,
  deltaY: number,
  containerWidth: number,
  containerHeight: number,
  paper: WorkspacePaperDimensions = {},
): WorkspaceViewport {
  return clampWorkspacePan(
    {
      ...viewport,
      panX: viewport.panX - deltaX,
      panY: viewport.panY - deltaY,
    },
    containerWidth,
    containerHeight,
    paper,
  )
}

export function screenToCanvasPoint(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  pressure?: number,
  tiltX?: number,
  tiltY?: number,
): WorkspacePoint {
  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0 }
  }
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const x = (clientX - rect.left) * scaleX
  const y = (clientY - rect.top) * scaleY
  const point: WorkspacePoint = { x, y }
  if (pressure != null && pressure > 0) point.p = pressure
  if (tiltX != null || tiltY != null) {
    const tilt = Math.min(1, Math.hypot(tiltX ?? 0, tiltY ?? 0) / 60)
    if (tilt > 0) point.p = Math.max(point.p ?? 0.5, 0.35 + tilt * 0.5)
  }
  return point
}

export function zoomUserAt(
  viewport: WorkspaceViewport,
  nextUserZoom: number,
  anchorX: number,
  anchorY: number,
  containerWidth: number,
  containerHeight: number,
  paper: WorkspacePaperDimensions = {},
  mode: WorkspaceFitMode = "width",
): WorkspaceViewport {
  const userZoom = clampUserZoom(nextUserZoom)
  const fitZoom = computeFitZoom(containerWidth, containerHeight, paper, mode)
  const oldScale = fitZoom * viewport.userZoom
  const newScale = fitZoom * userZoom
  if (oldScale <= 0) return { ...viewport, userZoom }
  const ratio = newScale / oldScale
  return clampWorkspacePan(
    {
      userZoom,
      panX: anchorX - (anchorX - viewport.panX) * ratio,
      panY: anchorY - (anchorY - viewport.panY) * ratio,
    },
    containerWidth,
    containerHeight,
    paper,
    mode,
  )
}

export function formatZoomPercent(userZoom: number): string {
  return `${Math.round(userZoom * 100)}%`
}

export function pointerDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function pointerMidpoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
