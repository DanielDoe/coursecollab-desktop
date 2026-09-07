"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
  newWorkspaceStrokeId,
  type WorkspaceEraserMode,
  type WorkspacePage,
  type WorkspacePaperPattern,
  type WorkspacePoint,
  type WorkspaceStroke,
  type WorkspaceTool,
} from "@/lib/circuit-workspace"
import { computeEraserPreview, sampleEraserBrushPath } from "@/lib/circuit-workspace-eraser"
import {
  imageResizeHandleAtPoint,
  imageResizeHandlePositions,
  normalizeSelectionRect,
  resizeImageStroke,
  selectionBoundsForStrokes,
  strokeAtPoint,
  strokeBounds,
  strokesInLasso,
  strokesInRect,
  translateStrokesByDelta,
  type ImageResizeHandle,
  type WorkspaceSelectionRect,
} from "@/lib/circuit-workspace-selection"
import {
  preloadWorkspaceImage,
  renderWorkspacePaperBackground,
  renderWorkspaceStrokes,
} from "@/lib/circuit-workspace-render"
import type { WorkspacePaperTheme } from "@/lib/circuit-workspace"
import {
  clampUserZoom,
  clampWorkspacePan,
  panWorkspaceByDelta,
  pointerDistance,
  pointerMidpoint,
  screenToCanvasPoint,
  totalViewportScale,
  zoomUserAt,
  type WorkspaceViewport,
} from "@/lib/circuit-workspace-viewport"
import {
  WORKSPACE_POINTER_FADE_MS,
  drawEphemeralPointerOverlay,
  newEphemeralPointerTrailId,
  pointerDrawWidth,
  pruneEphemeralTrails,
  type EphemeralPointerHover,
  type EphemeralPointerTrail,
} from "@/lib/circuit-workspace-pointer"

type PointerSample = { x: number; y: number; type: string }

const INK_DRAW_TOOLS: WorkspaceTool[] = ["pen", "highlighter", "line", "rect", "ellipse"]

type Props = {
  page: WorkspacePage
  tool: WorkspaceTool
  color: string
  width: number
  eraserMode?: WorkspaceEraserMode
  eraserWidth?: number
  paperTheme?: WorkspacePaperTheme
  paperPattern?: WorkspacePaperPattern
  paperWidth: number
  paperHeight: number
  disabled?: boolean
  className?: string
  interactive?: boolean
  viewport: WorkspaceViewport
  onViewportChange: (next: WorkspaceViewport) => void
  onStrokesChange?: (strokes: WorkspaceStroke[]) => void
  onSelectionChange?: (strokes: WorkspaceStroke[]) => void
  selectedStrokes?: WorkspaceStroke[]
  clearSelectionOverlayRef?: React.MutableRefObject<(() => void) | null>
  hostSize?: { w: number; h: number }
  onRegisterImageInsert?: (insert: (dataUrl: string) => Promise<void>) => void
}

function safeSetPointerCapture(target: Element, pointerId: number) {
  try {
    target.setPointerCapture(pointerId)
  } catch {
    /* pointer may not be active yet in some browsers */
  }
}

function clearSelectionOverlayRefs(
  selectionRectRef: React.MutableRefObject<WorkspaceSelectionRect | null>,
  lassoPointsRef: React.MutableRefObject<WorkspacePoint[]>,
  selectionStartRef: React.MutableRefObject<WorkspacePoint | null>,
) {
  selectionRectRef.current = null
  lassoPointsRef.current = []
  selectionStartRef.current = null
}

function drawSelectedStrokesHighlight(
  ctx: CanvasRenderingContext2D,
  strokes: WorkspaceStroke[],
  animMs: number,
) {
  if (strokes.length === 0) return
  const pulse = 0.45 + 0.25 * Math.sin(animMs / 220)
  const dashOffset = -(animMs / 45) % 32

  for (const stroke of strokes) {
    const b = strokeBounds(stroke)
    if (!b) continue
    const pad = 6
    ctx.save()
    ctx.fillStyle = `rgba(59, 130, 246, ${0.08 + pulse * 0.1})`
    ctx.fillRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2)
    ctx.restore()
  }

  const union = selectionBoundsForStrokes(strokes)
  if (!union) return
  const pad = 10
  ctx.save()
  ctx.fillStyle = `rgba(59, 130, 246, ${0.06 + pulse * 0.06})`
  ctx.fillRect(union.x - pad, union.y - pad, union.w + pad * 2, union.h + pad * 2)
  ctx.strokeStyle = `rgba(37, 99, 235, ${0.75 + pulse * 0.2})`
  ctx.lineWidth = 2
  ctx.setLineDash([10, 6])
  ctx.lineDashOffset = dashOffset
  ctx.strokeRect(union.x - pad, union.y - pad, union.w + pad * 2, union.h + pad * 2)
  ctx.restore()

  if (strokes.length === 1 && strokes[0]?.tool === "image") {
    drawImageResizeHandles(ctx, strokes[0]!)
  }
}

function drawImageResizeHandles(ctx: CanvasRenderingContext2D, stroke: WorkspaceStroke) {
  const half = 6
  for (const { x, y } of imageResizeHandlePositions(stroke)) {
    ctx.save()
    ctx.fillStyle = "#ffffff"
    ctx.strokeStyle = "rgba(37, 99, 235, 0.95)"
    ctx.lineWidth = 2
    ctx.fillRect(x - half, y - half, half * 2, half * 2)
    ctx.strokeRect(x - half, y - half, half * 2, half * 2)
    ctx.restore()
  }
}

const IMAGE_INTERACTION_TOOLS: WorkspaceTool[] = [
  "pen",
  "highlighter",
  "line",
  "rect",
  "ellipse",
  "select_rect",
  "select_lasso",
]

function isPointOnCanvas(clientX: number, clientY: number, canvas: HTMLCanvasElement): boolean {
  const rect = canvas.getBoundingClientRect()
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  )
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = dataUrl
  })
}

function drawEraserPreview(
  ctx: CanvasRenderingContext2D,
  path: WorkspacePoint[],
  diameter: number,
  mode: WorkspaceEraserMode,
  paperTheme: WorkspacePaperTheme,
) {
  if (path.length === 0) return
  const radius = diameter / 2
  const samples = sampleEraserBrushPath(path, radius)
  const isDark = paperTheme === "dark"
  const isStrokeMode = mode === "stroke"

  ctx.save()
  ctx.globalCompositeOperation = "source-over"

  // Soft brush footprint along the drag path
  for (const p of samples) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
    ctx.fillStyle = isStrokeMode
      ? isDark
        ? "rgba(248, 113, 113, 0.14)"
        : "rgba(254, 202, 202, 0.45)"
      : isDark
        ? "rgba(255, 255, 255, 0.1)"
        : "rgba(255, 255, 255, 0.42)"
    ctx.fill()
  }

  // Active eraser ring at the pointer
  const last = path[path.length - 1]!
  ctx.beginPath()
  ctx.arc(last.x, last.y, radius, 0, Math.PI * 2)
  ctx.fillStyle = isStrokeMode
    ? isDark
      ? "rgba(248, 113, 113, 0.22)"
      : "rgba(254, 226, 226, 0.65)"
    : isDark
      ? "rgba(255, 255, 255, 0.14)"
      : "rgba(255, 255, 255, 0.55)"
  ctx.fill()
  ctx.strokeStyle = isStrokeMode
    ? "rgba(239, 68, 68, 0.85)"
    : isDark
      ? "rgba(165, 180, 252, 0.9)"
      : "rgba(99, 102, 241, 0.75)"
  ctx.lineWidth = Math.max(1.5, radius * 0.08)
  ctx.setLineDash(isStrokeMode ? [6, 4] : [])
  ctx.stroke()
  ctx.setLineDash([])

  // Center precision dot
  ctx.beginPath()
  ctx.arc(last.x, last.y, Math.max(1.5, radius * 0.08), 0, Math.PI * 2)
  ctx.fillStyle = isStrokeMode ? "rgba(239, 68, 68, 0.9)" : "rgba(99, 102, 241, 0.85)"
  ctx.fill()
  ctx.restore()
}

export function CircuitWorkspaceCanvas({
  page,
  tool,
  color,
  width: strokeWidth,
  eraserMode = "pixel",
  eraserWidth = 24,
  paperTheme = "light",
  paperPattern = "ruled",
  paperWidth,
  paperHeight,
  disabled,
  className,
  interactive = true,
  viewport,
  onViewportChange,
  onStrokesChange,
  onSelectionChange,
  selectedStrokes = [],
  clearSelectionOverlayRef,
  hostSize,
  onRegisterImageInsert,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const drawingPointerRef = useRef<number | null>(null)
  const penActiveRef = useRef(false)
  const gestureActiveRef = useRef(false)
  const pointersRef = useRef<Map<number, PointerSample>>(new Map())
  const pinchRef = useRef<{
    startDistance: number
    startMid: { x: number; y: number }
    startUserZoom: number
    startPanX: number
    startPanY: number
  } | null>(null)
  const currentStrokeRef = useRef<WorkspaceStroke | null>(null)
  const eraserPathRef = useRef<WorkspacePoint[]>([])
  const eraserPreviewStrokesRef = useRef<WorkspaceStroke[] | null>(null)
  const strokesRef = useRef(page.strokes)
  const previewStrokeRef = useRef<WorkspaceStroke | null>(null)
  const selectionRectRef = useRef<WorkspaceSelectionRect | null>(null)
  const lassoPointsRef = useRef<WorkspacePoint[]>([])
  const selectionStartRef = useRef<WorkspacePoint | null>(null)
  const moveDragRef = useRef<{
    ids: Set<string>
    startPoint: WorkspacePoint
    originStrokes: WorkspaceStroke[]
  } | null>(null)
  const resizeDragRef = useRef<{
    strokeId: string
    handle: ImageResizeHandle
    originStroke: WorkspaceStroke
  } | null>(null)
  const imageHandleHoverRef = useRef<ImageResizeHandle | null>(null)
  const paintRafRef = useRef<number | null>(null)
  const paintRef = useRef<() => void>(() => {})
  const paperLayerRef = useRef<HTMLCanvasElement | null>(null)
  const paperLayerKeyRef = useRef("")
  const strokesLayerRef = useRef<HTMLCanvasElement | null>(null)
  const strokesLayerKeyRef = useRef("")
  const [isDrawing, setIsDrawing] = useState(false)
  const [imageHandleHover, setImageHandleHover] = useState<ImageResizeHandle | null>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const selectionAnimRef = useRef(0)
  const selectionAnimFrameRef = useRef<number | null>(null)
  const ephemeralTrailsRef = useRef<EphemeralPointerTrail[]>([])
  const activePointerTrailRef = useRef<EphemeralPointerTrail | null>(null)
  const pointerHoverRef = useRef<EphemeralPointerHover | null>(null)
  const pointerAnimFrameRef = useRef<number | null>(null)
  const pointerColorWidthRef = useRef({ color, width: strokeWidth })
  pointerColorWidthRef.current = { color, width: strokeWidth }
  const toolRef = useRef(tool)
  toolRef.current = tool
  const selectedStrokesRef = useRef(selectedStrokes)
  selectedStrokesRef.current = selectedStrokes
  const layoutW = hostSize && hostSize.w > 0 ? hostSize.w : containerSize.w
  const layoutH = hostSize && hostSize.h > 0 ? hostSize.h : containerSize.h
  const paper = { width: paperWidth, height: paperHeight }

  const ensurePaperLayer = useCallback(() => {
    const key = `${paperWidth}x${paperHeight}:${paperTheme}:${paperPattern}`
    if (paperLayerKeyRef.current === key && paperLayerRef.current) {
      return paperLayerRef.current
    }
    const layer = document.createElement("canvas")
    layer.width = paperWidth
    layer.height = paperHeight
    const layerCtx = layer.getContext("2d")
    if (layerCtx) {
      renderWorkspacePaperBackground(layerCtx, {
        theme: paperTheme,
        paperPattern,
        width: paperWidth,
        height: paperHeight,
      })
    }
    paperLayerRef.current = layer
    paperLayerKeyRef.current = key
    return layer
  }, [paperWidth, paperHeight, paperTheme, paperPattern])

  const measureContainer = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    if (width > 0 && height > 0) {
      setContainerSize((prev) =>
        prev.w === width && prev.h === height ? prev : { w: width, h: height },
      )
    }
  }, [])

  const updateEraserPreview = useCallback(
    (path: WorkspacePoint[]) => {
      if (path.length === 0) {
        eraserPreviewStrokesRef.current = null
        return
      }
      eraserPreviewStrokesRef.current = computeEraserPreview(
        strokesRef.current,
        path,
        eraserWidth / 2,
        eraserMode,
      )
    },
    [eraserMode, eraserWidth],
  )

  const ensureStrokesLayer = useCallback(
    (strokes: WorkspaceStroke[]) => {
      const key = `${strokes.length}:${strokes.map((s) => `${s.id}:${s.points.length}`).join("|")}`
      if (strokesLayerRef.current && strokesLayerKeyRef.current === key) {
        return strokesLayerRef.current
      }
      const layer = document.createElement("canvas")
      layer.width = paperWidth
      layer.height = paperHeight
      const layerCtx = layer.getContext("2d")
      if (layerCtx) {
        renderWorkspaceStrokes(layerCtx, { ...page, strokes }, {
          theme: paperTheme,
          paperPattern,
          width: paperWidth,
          height: paperHeight,
          directInk: true,
        })
      }
      strokesLayerRef.current = layer
      strokesLayerKeyRef.current = key
      return layer
    },
    [page, paperTheme, paperPattern, paperWidth, paperHeight],
  )

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const preview = previewStrokeRef.current
    const eraserPath = eraserPathRef.current
    const isErasing = tool === "eraser" && eraserPath.length > 0
    const isDragging = Boolean(moveDragRef.current || resizeDragRef.current)
    let strokes = strokesRef.current
    if (isErasing && eraserPreviewStrokesRef.current) {
      strokes = eraserPreviewStrokesRef.current
    } else if (preview) {
      strokes = [...strokesRef.current, preview]
    }
    const paperLayer = ensurePaperLayer()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(paperLayer, 0, 0)

    const canUseStrokeCache = !isErasing && !isDragging
    if (canUseStrokeCache && strokesRef.current.length > 0) {
      const strokesLayer = ensureStrokesLayer(strokesRef.current)
      ctx.drawImage(strokesLayer, 0, 0)
      if (preview) {
        renderWorkspaceStrokes(ctx, { ...page, strokes: [preview] }, {
          theme: paperTheme,
          paperPattern,
          width: paperWidth,
          height: paperHeight,
          directInk: true,
        })
      }
    } else {
      renderWorkspaceStrokes(ctx, { ...page, strokes }, {
        theme: paperTheme,
        paperPattern,
        width: paperWidth,
        height: paperHeight,
        directInk: true,
      })
    }

    if (isErasing) {
      drawEraserPreview(ctx, eraserPath, eraserWidth, eraserMode, paperTheme)
    }

    const selectionRect = selectionRectRef.current
    if (selectionRect) {
      ctx.save()
      ctx.strokeStyle = "rgba(59, 130, 246, 0.9)"
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h)
      ctx.restore()
    }
    const lassoPoints = lassoPointsRef.current
    if (lassoPoints.length >= 2) {
      ctx.save()
      ctx.strokeStyle = "rgba(59, 130, 246, 0.9)"
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(lassoPoints[0]!.x, lassoPoints[0]!.y)
      for (let i = 1; i < lassoPoints.length; i++) {
        ctx.lineTo(lassoPoints[i]!.x, lassoPoints[i]!.y)
      }
      if (lassoPoints.length >= 3) ctx.closePath()
      ctx.stroke()
      ctx.restore()
    }

    if (selectedStrokesRef.current.length > 0) {
      drawSelectedStrokesHighlight(ctx, selectedStrokesRef.current, selectionAnimRef.current)
    }

    const now = performance.now()
    const pointerTrails = [...ephemeralTrailsRef.current]
    const activePointer = activePointerTrailRef.current
    if (activePointer && activePointer.points.length > 0) {
      pointerTrails.push(activePointer)
    }
    if (tool === "pointer" && (pointerTrails.length > 0 || pointerHoverRef.current)) {
      drawEphemeralPointerOverlay(
        ctx,
        pointerTrails,
        tool === "pointer" ? pointerHoverRef.current : null,
        now,
        WORKSPACE_POINTER_FADE_MS,
        paperTheme,
      )
    }
  }, [page, paperTheme, paperPattern, paperWidth, paperHeight, tool, eraserWidth, eraserMode, ensurePaperLayer, ensureStrokesLayer])

  paintRef.current = paint

  const markDrawing = useCallback((active: boolean) => {
    drawingRef.current = active
    setIsDrawing(active)
  }, [])

  const schedulePaint = useCallback((urgent = false) => {
    const run = () => {
      paintRafRef.current = null
      paintRef.current()
    }
    if (urgent) {
      if (paintRafRef.current != null) {
        cancelAnimationFrame(paintRafRef.current)
        paintRafRef.current = null
      }
      run()
      return
    }
    if (paintRafRef.current != null) return
    paintRafRef.current = requestAnimationFrame(run)
  }, [])

  const clearSelectionOverlay = useCallback(() => {
    clearSelectionOverlayRefs(selectionRectRef, lassoPointsRef, selectionStartRef)
    schedulePaint(true)
  }, [schedulePaint])

  useEffect(() => {
    if (!clearSelectionOverlayRef) return
    clearSelectionOverlayRef.current = clearSelectionOverlay
    return () => {
      clearSelectionOverlayRef.current = null
    }
  }, [clearSelectionOverlayRef, clearSelectionOverlay])

  useEffect(() => {
    if (selectedStrokes.length === 0) {
      if (selectionAnimFrameRef.current != null) {
        cancelAnimationFrame(selectionAnimFrameRef.current)
        selectionAnimFrameRef.current = null
      }
      return
    }
    const tick = () => {
      selectionAnimRef.current = performance.now()
      schedulePaint(true)
      selectionAnimFrameRef.current = requestAnimationFrame(tick)
    }
    selectionAnimFrameRef.current = requestAnimationFrame(tick)
    return () => {
      if (selectionAnimFrameRef.current != null) {
        cancelAnimationFrame(selectionAnimFrameRef.current)
        selectionAnimFrameRef.current = null
      }
    }
  }, [selectedStrokes, schedulePaint])

  const startPointerAnimLoop = useCallback(() => {
    if (pointerAnimFrameRef.current != null) return
    const tick = () => {
      const now = performance.now()
      ephemeralTrailsRef.current = pruneEphemeralTrails(
        ephemeralTrailsRef.current,
        now,
        WORKSPACE_POINTER_FADE_MS,
      )
      schedulePaint(true)
      const hasTrails = ephemeralTrailsRef.current.length > 0 || activePointerTrailRef.current != null
      const hasHover = toolRef.current === "pointer" && pointerHoverRef.current != null
      if (hasTrails || hasHover) {
        pointerAnimFrameRef.current = requestAnimationFrame(tick)
      } else {
        pointerAnimFrameRef.current = null
      }
    }
    pointerAnimFrameRef.current = requestAnimationFrame(tick)
  }, [schedulePaint])

  useEffect(() => {
    if (tool !== "pointer") {
      pointerHoverRef.current = null
      schedulePaint(true)
    }
  }, [tool, schedulePaint])

  useEffect(
    () => () => {
      if (pointerAnimFrameRef.current != null) {
        cancelAnimationFrame(pointerAnimFrameRef.current)
        pointerAnimFrameRef.current = null
      }
    },
    [],
  )

  const attachCanvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      canvasRef.current = node
      if (node) paint()
    },
    [paint],
  )

  useEffect(() => {
    strokesRef.current = page.strokes
    strokesLayerRef.current = null
    strokesLayerKeyRef.current = ""
    eraserPreviewStrokesRef.current = null
    eraserPathRef.current = []
    schedulePaint()
  }, [page.strokes, schedulePaint])

  useEffect(() => {
    schedulePaint()
  }, [paperPattern, paperTheme, schedulePaint])

  useEffect(
    () => () => {
      if (paintRafRef.current != null) cancelAnimationFrame(paintRafRef.current)
    },
    [],
  )

  useLayoutEffect(() => {
    measureContainer()
  }, [measureContainer])

  useLayoutEffect(() => {
    if (containerSize.w <= 0 || containerSize.h <= 0) return
    paint()
  }, [containerSize.w, containerSize.h, paint])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => measureContainer())
    ro.observe(el)
    return () => ro.disconnect()
  }, [measureContainer])

  useEffect(() => {
    if (containerSize.w > 0 && containerSize.h > 0) return
    let cancelled = false
    let attempts = 0
    const retry = () => {
      if (cancelled || attempts++ > 40) return
      measureContainer()
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0 || rect.height === 0) {
        requestAnimationFrame(retry)
      }
    }
    requestAnimationFrame(retry)
    return () => {
      cancelled = true
    }
  }, [containerSize.w, containerSize.h, measureContainer])

  const addImageStroke = useCallback(
    async (dataUrl: string) => {
      if (disabled || !interactive || !onStrokesChange) {
        throw new Error("Workspace is not ready for attachments")
      }
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) {
        throw new Error("Canvas is still loading — try again in a moment")
      }

      let natural: { width: number; height: number }
      try {
        natural = await loadImageSize(dataUrl)
      } catch {
        throw new Error("Could not load that image")
      }

      const maxW = paperWidth * 0.75
      const maxH = paperHeight * 0.5
      const fitScale = Math.min(1, maxW / natural.width, maxH / natural.height)
      const w = natural.width * fitScale
      const h = natural.height * fitScale

      const rect = container.getBoundingClientRect()
      const center = screenToCanvasPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        canvas,
      )
      const x = Math.max(24, Math.min(paperWidth - w - 24, center.x - w / 2))
      const y = Math.max(24, Math.min(paperHeight - h - 24, center.y - h / 2))

      const stroke: WorkspaceStroke = {
        id: newWorkspaceStrokeId(),
        tool: "image",
        color: "#000000",
        width: 0,
        imageDataUrl: dataUrl,
        points: [
          { x, y },
          { x: x + w, y: y + h },
        ],
      }

      preloadWorkspaceImage(dataUrl, paint)
      const next = [...strokesRef.current, stroke]
      strokesRef.current = next
      onStrokesChange(next)
      onSelectionChange?.([stroke])
    },
    [disabled, interactive, onStrokesChange, onSelectionChange, paint, paperWidth, paperHeight],
  )

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (disabled || !interactive) return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (!item.type.startsWith("image/")) continue
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue
        const dataUrl = await readFileAsDataUrl(file)
        await addImageStroke(dataUrl)
        break
      }
    },
    [disabled, interactive, addImageStroke],
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled || !interactive) return
      const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith("image/"))
      if (!file) return
      e.preventDefault()
      const dataUrl = await readFileAsDataUrl(file)
      await addImageStroke(dataUrl)
    },
    [disabled, interactive, addImageStroke],
  )

  useEffect(() => {
    onRegisterImageInsert?.(addImageStroke)
  }, [addImageStroke, onRegisterImageInsert])

  const commitEraser = useCallback(() => {
    const path = eraserPathRef.current
    eraserPathRef.current = []
    if (path.length === 0 || !onStrokesChange) {
      eraserPreviewStrokesRef.current = null
      schedulePaint(true)
      return
    }

    const next =
      eraserPreviewStrokesRef.current ??
      computeEraserPreview(strokesRef.current, path, eraserWidth / 2, eraserMode)

    strokesRef.current = next
    eraserPreviewStrokesRef.current = null
    onStrokesChange(next)
    schedulePaint(true)
  }, [eraserMode, eraserWidth, onStrokesChange, schedulePaint])

  const cloneStrokesSnapshot = (strokes: WorkspaceStroke[]) =>
    strokes.map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) }))

  const tryStartMoveDrag = useCallback(
    (point: WorkspacePoint): boolean => {
      if (!onStrokesChange) return false

      const selected = selectedStrokesRef.current
      if (selected.length === 1 && selected[0]?.tool === "image") {
        const image = selected[0]
        const handle = imageResizeHandleAtPoint(point, image)
        if (handle) {
          resizeDragRef.current = {
            strokeId: image.id,
            handle,
            originStroke: { ...image, points: image.points.map((p) => ({ ...p })) },
          }
          markDrawing(true)
          schedulePaint(true)
          return true
        }
      }

      if (selected.length > 0) {
        const bounds = selectionBoundsForStrokes(selected)
        const pad = 10
        if (
          bounds &&
          point.x >= bounds.x - pad &&
          point.x <= bounds.x + bounds.w + pad &&
          point.y >= bounds.y - pad &&
          point.y <= bounds.y + bounds.h + pad
        ) {
          moveDragRef.current = {
            ids: new Set(selected.map((s) => s.id)),
            startPoint: point,
            originStrokes: cloneStrokesSnapshot(strokesRef.current),
          }
          markDrawing(true)
          schedulePaint(true)
          return true
        }
      }

      if (tool === "select_rect" || tool === "select_lasso") {
        const hit = strokeAtPoint(strokesRef.current, point)
        if (hit) {
          onSelectionChange?.([hit])
          moveDragRef.current = {
            ids: new Set([hit.id]),
            startPoint: point,
            originStrokes: cloneStrokesSnapshot(strokesRef.current),
          }
          markDrawing(true)
          schedulePaint(true)
          return true
        }
      }

      if (IMAGE_INTERACTION_TOOLS.includes(tool)) {
        const hit = strokeAtPoint(strokesRef.current, point)
        if (hit?.tool === "image") {
          onSelectionChange?.([hit])
          moveDragRef.current = {
            ids: new Set([hit.id]),
            startPoint: point,
            originStrokes: cloneStrokesSnapshot(strokesRef.current),
          }
          markDrawing(true)
          schedulePaint(true)
          return true
        }
      }

      return false
    },
    [onStrokesChange, onSelectionChange, tool, markDrawing, schedulePaint],
  )

  const finishStroke = useCallback(() => {
    if (resizeDragRef.current) {
      const drag = resizeDragRef.current
      resizeDragRef.current = null
      const next = strokesRef.current
      onStrokesChange?.(next)
      const updated = next.find((s) => s.id === drag.strokeId)
      onSelectionChange?.(updated ? [updated] : [])
      markDrawing(false)
      drawingPointerRef.current = null
      schedulePaint(true)
      return
    }

    if (moveDragRef.current) {
      const drag = moveDragRef.current
      moveDragRef.current = null
      const next = strokesRef.current
      onStrokesChange?.(next)
      onSelectionChange?.(next.filter((s) => drag.ids.has(s.id)))
      markDrawing(false)
      drawingPointerRef.current = null
      schedulePaint(true)
      return
    }

    const selectionRect = selectionRectRef.current
    const lassoPoints = lassoPointsRef.current
    if (tool === "select_rect" && selectionRect) {
      if (selectionRect.w < 8 && selectionRect.h < 8) {
        const center = {
          x: selectionRect.x + selectionRect.w / 2,
          y: selectionRect.y + selectionRect.h / 2,
        }
        const hit = strokeAtPoint(strokesRef.current, center)
        clearSelectionOverlayRefs(selectionRectRef, lassoPointsRef, selectionStartRef)
        onSelectionChange?.(hit ? [hit] : [])
        markDrawing(false)
        drawingPointerRef.current = null
        schedulePaint(true)
        return
      }
      const selected = strokesInRect(strokesRef.current, selectionRect)
      clearSelectionOverlayRefs(selectionRectRef, lassoPointsRef, selectionStartRef)
      onSelectionChange?.(selected)
      markDrawing(false)
      drawingPointerRef.current = null
      schedulePaint(true)
      return
    }
    if (tool === "select_lasso" && lassoPoints.length >= 3) {
      const selected = strokesInLasso(strokesRef.current, lassoPoints)
      clearSelectionOverlayRefs(selectionRectRef, lassoPointsRef, selectionStartRef)
      onSelectionChange?.(selected)
      markDrawing(false)
      drawingPointerRef.current = null
      schedulePaint(true)
      return
    }
    if (tool === "select_rect" || tool === "select_lasso") {
      markDrawing(false)
      drawingPointerRef.current = null
      selectionStartRef.current = null
      selectionRectRef.current = null
      lassoPointsRef.current = []
      schedulePaint()
      return
    }

    if (tool === "eraser") {
      markDrawing(false)
      drawingPointerRef.current = null
      commitEraser()
      return
    }

    if (tool === "pointer") {
      markDrawing(false)
      drawingPointerRef.current = null
      const active = activePointerTrailRef.current
      activePointerTrailRef.current = null
      if (active && active.points.length > 0) {
        ephemeralTrailsRef.current = [
          ...ephemeralTrailsRef.current,
          { ...active, releasedAt: performance.now() },
        ]
        startPointerAnimLoop()
      }
      schedulePaint(true)
      return
    }

    const stroke = currentStrokeRef.current
    markDrawing(false)
    drawingPointerRef.current = null
    currentStrokeRef.current = null
    previewStrokeRef.current = null
    schedulePaint(true)
    if (!stroke || stroke.points.length === 0) return
    const isShape = ["line", "rect", "ellipse"].includes(stroke.tool)
    if (isShape && stroke.points.length < 2) return
    const next = [...strokesRef.current, stroke]
    strokesRef.current = next
    onStrokesChange?.(next)
  }, [onStrokesChange, tool, onSelectionChange, commitEraser, schedulePaint, markDrawing, startPointerAnimLoop])

  const cancelStroke = useCallback(() => {
    if (resizeDragRef.current) {
      const drag = resizeDragRef.current
      strokesRef.current = strokesRef.current.map((s) =>
        s.id === drag.strokeId ? drag.originStroke : s,
      )
      resizeDragRef.current = null
    }
    if (moveDragRef.current) {
      strokesRef.current = moveDragRef.current.originStrokes
      moveDragRef.current = null
    }
    markDrawing(false)
    drawingPointerRef.current = null
    currentStrokeRef.current = null
    activePointerTrailRef.current = null
    eraserPathRef.current = []
    eraserPreviewStrokesRef.current = null
    previewStrokeRef.current = null
    selectionRectRef.current = null
    lassoPointsRef.current = []
    schedulePaint()
  }, [schedulePaint, markDrawing])

  const startStroke = useCallback(
    (point: WorkspacePoint) => {
      if (disabled || !interactive || gestureActiveRef.current) return

      if (tryStartMoveDrag(point)) return

      if (tool === "select_rect" || tool === "select_lasso") {
        markDrawing(true)
        selectionStartRef.current = point
        selectionRectRef.current = null
        lassoPointsRef.current = tool === "select_lasso" ? [point] : []
        onSelectionChange?.([])
        schedulePaint(true)
        return
      }

      if (tool === "eraser") {
        markDrawing(true)
        const path = [point]
        eraserPathRef.current = path
        updateEraserPreview(path)
        schedulePaint(true)
        return
      }

      if (tool === "pointer") {
        markDrawing(true)
        pointerHoverRef.current = null
        const drawWidth = pointerDrawWidth(strokeWidth)
        activePointerTrailRef.current = {
          id: newEphemeralPointerTrailId(),
          color,
          width: drawWidth,
          points: [{ x: point.x, y: point.y, t: performance.now() }],
        }
        startPointerAnimLoop()
        schedulePaint(true)
        return
      }

      markDrawing(true)
      const stroke: WorkspaceStroke = {
        id: newWorkspaceStrokeId(),
        tool,
        color,
        width: strokeWidth,
        points: [point],
      }
      currentStrokeRef.current = stroke
      previewStrokeRef.current = stroke
      schedulePaint(true)
    },
    [disabled, interactive, tool, color, strokeWidth, onSelectionChange, schedulePaint, markDrawing, updateEraserPreview, startPointerAnimLoop, tryStartMoveDrag],
  )

  const extendStroke = useCallback(
    (point: WorkspacePoint) => {
      if (!drawingRef.current) return

      const moveDrag = moveDragRef.current
      if (moveDrag) {
        const dx = point.x - moveDrag.startPoint.x
        const dy = point.y - moveDrag.startPoint.y
        strokesRef.current = translateStrokesByDelta(moveDrag.originStrokes, moveDrag.ids, dx, dy)
        schedulePaint(true)
        return
      }

      const resizeDrag = resizeDragRef.current
      if (resizeDrag) {
        strokesRef.current = strokesRef.current.map((s) =>
          s.id === resizeDrag.strokeId
            ? resizeImageStroke(resizeDrag.originStroke, resizeDrag.handle, point)
            : s,
        )
        schedulePaint(true)
        return
      }

      if (tool === "select_rect" && selectionStartRef.current) {
        selectionRectRef.current = normalizeSelectionRect(selectionStartRef.current, point)
        schedulePaint(true)
        return
      }
      if (tool === "select_lasso") {
        const prev = lassoPointsRef.current
        const last = prev[prev.length - 1]
        if (last) {
          const dx = point.x - last.x
          const dy = point.y - last.y
          if (dx * dx + dy * dy < 4) return
        }
        lassoPointsRef.current = [...prev, point]
        schedulePaint(true)
        return
      }

      if (tool === "eraser") {
        const path = eraserPathRef.current
        const last = path[path.length - 1]
        if (last) {
          const dx = point.x - last.x
          const dy = point.y - last.y
          if (dx * dx + dy * dy < 1) return
        }
        const nextPath = [...path, point]
        eraserPathRef.current = nextPath
        updateEraserPreview(nextPath)
        schedulePaint(true)
        return
      }

      if (tool === "pointer") {
        const trail = activePointerTrailRef.current
        if (!trail) return
        const last = trail.points[trail.points.length - 1]
        if (last) {
          const dx = point.x - last.x
          const dy = point.y - last.y
          if (dx * dx + dy * dy < 0.8) return
        }
        trail.points.push({ x: point.x, y: point.y, t: performance.now() })
        schedulePaint(true)
        return
      }

      if (!currentStrokeRef.current) return
      const stroke = currentStrokeRef.current
      const isShape = ["line", "rect", "ellipse"].includes(stroke.tool)
      if (isShape) {
        stroke.points = [stroke.points[0]!, point]
      } else {
        const last = stroke.points[stroke.points.length - 1]!
        const dx = point.x - last.x
        const dy = point.y - last.y
        if (dx * dx + dy * dy < 0.25) return
        stroke.points.push(point)
      }
      previewStrokeRef.current = stroke
      schedulePaint(true)
    },
    [tool, schedulePaint, updateEraserPreview],
  )

  const canDrawWithPointer = (type: string) => {
    if (type === "pen" || type === "mouse") return true
    if (type === "touch") return !penActiveRef.current
    return false
  }

  const relPoint = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: clientX, y: clientY }
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || disabled) return
    const sample: PointerSample = { x: e.clientX, y: e.clientY, type: e.pointerType }
    pointersRef.current.set(e.pointerId, sample)

    if (e.pointerType === "pen") penActiveRef.current = true

    if (pointersRef.current.size >= 2) {
      e.preventDefault()
      gestureActiveRef.current = true
      cancelStroke()
      const pts = [...pointersRef.current.values()].slice(0, 2)
      const a = relPoint(pts[0]!.x, pts[0]!.y)
      const b = relPoint(pts[1]!.x, pts[1]!.y)
      const mid = pointerMidpoint(a, b)
      pinchRef.current = {
        startDistance: pointerDistance(a, b),
        startMid: mid,
        startUserZoom: viewport.userZoom,
        startPanX: viewport.panX,
        startPanY: viewport.panY,
      }
      safeSetPointerCapture(e.currentTarget, e.pointerId)
      return
    }

    if (!canDrawWithPointer(e.pointerType)) return
    if (drawingPointerRef.current != null) return

    const canvas = canvasRef.current
    if (!canvas || !isPointOnCanvas(e.clientX, e.clientY, canvas)) return

    e.preventDefault()
    e.currentTarget.focus({ preventScroll: true })
    drawingPointerRef.current = e.pointerId
    safeSetPointerCapture(e.currentTarget, e.pointerId)
    const point = screenToCanvasPoint(
      e.clientX,
      e.clientY,
      canvas,
      e.pressure,
      e.tiltX,
      e.tiltY,
    )
    startStroke(point)
  }

  const updatePointerHover = useCallback(
    (clientX: number, clientY: number) => {
      if (tool !== "pointer" || drawingRef.current || !interactive || disabled) return
      const canvas = canvasRef.current
      if (!canvas || !isPointOnCanvas(clientX, clientY, canvas)) {
        if (pointerHoverRef.current) {
          pointerHoverRef.current = null
          schedulePaint(true)
        }
        return
      }
      const point = screenToCanvasPoint(clientX, clientY, canvas)
      const { color: hoverColor, width: hoverWidth } = pointerColorWidthRef.current
      pointerHoverRef.current = {
        x: point.x,
        y: point.y,
        t: performance.now(),
        color: hoverColor,
        width: pointerDrawWidth(hoverWidth),
      }
      startPointerAnimLoop()
      schedulePaint(true)
    },
    [tool, interactive, disabled, schedulePaint, startPointerAnimLoop],
  )

  const updateImageHandleHover = useCallback(
    (clientX: number, clientY: number) => {
      if (drawingRef.current || !interactive || disabled) return
      const canvas = canvasRef.current
      if (!canvas || !isPointOnCanvas(clientX, clientY, canvas)) {
        if (imageHandleHoverRef.current) {
          imageHandleHoverRef.current = null
          setImageHandleHover(null)
        }
        return
      }
      const point = screenToCanvasPoint(clientX, clientY, canvas)
      const selected = selectedStrokesRef.current
      let next: ImageResizeHandle | null = null
      if (selected.length === 1 && selected[0]?.tool === "image") {
        next = imageResizeHandleAtPoint(point, selected[0]!)
      }
      if (next !== imageHandleHoverRef.current) {
        imageHandleHoverRef.current = next
        setImageHandleHover(next)
      }
    },
    [interactive, disabled],
  )

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || disabled) return
    const prev = pointersRef.current.get(e.pointerId)
    if (prev) pointersRef.current.set(e.pointerId, { ...prev, x: e.clientX, y: e.clientY })

    if (tool === "pointer" && !drawingRef.current && e.pointerType !== "touch") {
      updatePointerHover(e.clientX, e.clientY)
    }

    if (!drawingRef.current && e.pointerType !== "touch") {
      updateImageHandleHover(e.clientX, e.clientY)
    }

    if (gestureActiveRef.current && pinchRef.current && pointersRef.current.size >= 2) {
      e.preventDefault()
      const pts = [...pointersRef.current.values()].slice(0, 2).map((p) => relPoint(p.x, p.y))
      if (pts.length < 2) return
      const dist = pointerDistance(pts[0]!, pts[1]!)
      const mid = pointerMidpoint(pts[0]!, pts[1]!)
      const pinch = pinchRef.current
      const nextUserZoom = clampUserZoom(
        pinch.startUserZoom * (dist / Math.max(pinch.startDistance, 1)),
      )
      const dragged: WorkspaceViewport = {
        userZoom: pinch.startUserZoom,
        panX: pinch.startPanX + (mid.x - pinch.startMid.x),
        panY: pinch.startPanY + (mid.y - pinch.startMid.y),
      }
      onViewportChange(
        clampWorkspacePan(
          zoomUserAt(dragged, nextUserZoom, mid.x, mid.y, layoutW, layoutH, paper),
          layoutW,
          layoutH,
          paper,
        ),
      )
      return
    }

    if (!drawingRef.current || drawingPointerRef.current !== e.pointerId) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const point = screenToCanvasPoint(
      e.clientX,
      e.clientY,
      canvas,
      e.pressure,
      e.tiltX,
      e.tiltY,
    )
    extendStroke(point)
  }

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId)
    if (e.pointerType === "pen" && pointersRef.current.size === 0) {
      penActiveRef.current = false
    }

    if (drawingPointerRef.current === e.pointerId) {
      finishStroke()
    }

    if (pointersRef.current.size < 2) {
      pinchRef.current = null
      if (pointersRef.current.size === 0) gestureActiveRef.current = false
    }

    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* released */
    }
  }

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!interactive || disabled) return
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const anchorX = e.clientX - rect.left
      const anchorY = e.clientY - rect.top
      const delta = e.deltaY > 0 ? -0.15 : 0.15
      onViewportChange(
        zoomUserAt(viewport, viewport.userZoom + delta, anchorX, anchorY, layoutW, layoutH, paper),
      )
      return
    }
    onViewportChange(
      panWorkspaceByDelta(viewport, e.deltaX, e.deltaY, layoutW, layoutH, paper),
    )
  }

  const scale =
    layoutW > 0 && layoutH > 0 ? totalViewportScale(layoutW, layoutH, viewport, paper) : 0
  const scaledW = paperWidth * scale
  const scaledH = paperHeight * scale
  const isPannable = scaledW > layoutW + 2 || scaledH > layoutH + 2
  const isEraser = tool === "eraser"
  const isPointer = tool === "pointer"
  const isInkTool = INK_DRAW_TOOLS.includes(tool)
  const isSelectTool = tool === "select_rect" || tool === "select_lasso"
  const activeResizeHandle = resizeDragRef.current?.handle ?? imageHandleHover
  const hasSelectedImage =
    selectedStrokes.length === 1 && selectedStrokes[0]?.tool === "image"
  const workspaceCursor =
    !interactive || disabled
      ? ""
      : activeResizeHandle === "nw" || activeResizeHandle === "se"
        ? "cursor-nwse-resize"
        : activeResizeHandle === "ne" || activeResizeHandle === "sw"
          ? "cursor-nesw-resize"
          : isPointer
            ? "cursor-none"
            : hasSelectedImage && !isDrawing
              ? "cursor-move"
              : isEraser || (isDrawing && tool === "eraser")
                ? "cursor-cell"
                : isInkTool || isSelectTool || isDrawing
                  ? "cursor-crosshair"
                  : isPannable
                    ? "cursor-grab active:cursor-grabbing"
                    : "cursor-default"

  return (
    <div
      ref={containerRef}
      tabIndex={interactive && !disabled ? 0 : undefined}
      className={cn(
        "absolute inset-0 overflow-hidden touch-none select-none bg-slate-200/50 dark:bg-slate-950/80 outline-none",
        workspaceCursor,
        className,
      )}
      style={{ touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onPointerLeave={(e) => {
        imageHandleHoverRef.current = null
        setImageHandleHover(null)
        if (toolRef.current !== "pointer") return
        pointerHoverRef.current = null
        schedulePaint(true)
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          try {
            e.currentTarget.releasePointerCapture(e.pointerId)
          } catch {
            /* released */
          }
        }
      }}
      onWheel={handleWheel}
      onPaste={handlePaste}
      onDragOver={(e) => {
        if (disabled || !interactive) return
        if ([...(e.dataTransfer?.types ?? [])].includes("Files")) e.preventDefault()
      }}
      onDrop={handleDrop}
    >
      {scale > 0 ? (
        <div
          className="absolute left-0 top-0"
          style={{
            width: paperWidth,
            height: paperHeight,
            transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          <canvas
            ref={attachCanvasRef}
            width={paperWidth}
            height={paperHeight}
            className={cn("block h-full w-full touch-none select-none", workspaceCursor)}
            style={{ touchAction: "none" }}
          />
        </div>
      ) : null}
    </div>
  )
}
