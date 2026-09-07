"use client"

import { useCallback, useEffect, useRef, useState, startTransition } from "react"
import { useDebouncedCallback } from "@/lib/use-debounced-callback"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
import {
  Camera,
  Circle,
  CircleDot,
  Copy,
  Eraser,
  FileText,
  Grid3x3,
  ImageIcon,
  Link2,
  Loader2,
  Paperclip,
  MousePointer2,
  Scissors,
  CircleSlash2,
  Highlighter,
  Lasso,
  Minus,
  Pencil,
  Plus,
  Redo2,
  Shapes,
  Square,
  SquareDashed,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlignJustify,
} from "lucide-react"
import { CircuitWorkspaceCanvas } from "@/components/circuit-workspace-canvas"
import { SolutionCameraDialog } from "@/components/solution-camera-dialog"
import { prefersNativeCameraCapture } from "@/lib/solution-camera"
import {
  workspaceAttachFileToDataUrl,
  workspaceAttachUrlToDataUrl,
} from "@/lib/circuit-workspace-attach"
import {
  WORKSPACE_ERASER_WIDTHS,
  WORKSPACE_INK_COLORS,
  WORKSPACE_MAX_PAGES,
  WORKSPACE_PAPER_PATTERNS,
  WORKSPACE_PAPER_SIZES,
  WORKSPACE_WIDTHS,
  createEmptyWorkspacePage,
  defaultWorkspaceColorForTool,
  getWorkspacePaperDimensions,
  getWorkspacePaperSize,
  mapInkColorToPaperTheme,
  newWorkspaceStrokeId,
  resolveWorkspaceColorForTool,
  scaleWorkspaceToPaperSize,
  workspaceColorsForTool,
  workspaceToolUsesColor,
  type CircuitWorkspace,
  type WorkspaceEraserMode,
  type WorkspacePaperSizeId,
  type WorkspacePaperTheme,
  type WorkspaceStroke,
  type WorkspaceTool,
} from "@/lib/circuit-workspace"
import { removeStrokesById } from "@/lib/circuit-workspace-selection"
import {
  DEFAULT_WORKSPACE_VIEWPORT,
  WORKSPACE_USER_ZOOM_STEP,
  fitWorkspaceViewport,
  formatZoomPercent,
  zoomUserAt,
  type WorkspaceViewport,
} from "@/lib/circuit-workspace-viewport"
import type { WorkspaceReplayRecorder } from "@/lib/workspace-replay"

type Props = {
  workspace: CircuitWorkspace
  onChange: (next: CircuitWorkspace, options?: { flush?: boolean }) => void
  onRegisterFlush?: (flush: () => void) => void
  replayRecorderRef?: React.MutableRefObject<WorkspaceReplayRecorder>
  disabled?: boolean
  compact?: boolean
}

function workspaceParentKey(w: CircuitWorkspace): string {
  return JSON.stringify({
    ai: w.activePageIndex,
    pages: w.pages.map((p) => ({
      id: p.id,
      strokes: p.strokes.map((s) => `${s.id}:${s.points.length}`),
    })),
  })
}

type HistoryEntry = { pages: CircuitWorkspace["pages"]; activePageIndex: number }

const PRIMARY_TOOLS = [
  { id: "pen" as const, icon: Pencil, label: "Pen" },
  { id: "highlighter" as const, icon: Highlighter, label: "Highlighter" },
  { id: "pointer" as const, icon: MousePointer2, label: "Pointer" },
  { id: "eraser" as const, icon: Eraser, label: "Eraser" },
  { id: "select_rect" as const, icon: SquareDashed, label: "Box select" },
  { id: "select_lasso" as const, icon: Lasso, label: "Lasso select" },
] as const

const SHAPE_TOOLS = [
  { id: "line" as const, icon: Minus, label: "Line" },
  { id: "rect" as const, icon: Square, label: "Rectangle" },
  { id: "ellipse" as const, icon: Circle, label: "Ellipse" },
] as const

const SHAPE_TOOL_IDS = new Set<WorkspaceTool>(SHAPE_TOOLS.map((t) => t.id))

const WORKSPACE_PHOTO_ACCEPT = "image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
const WORKSPACE_FILE_ACCEPT = `${WORKSPACE_PHOTO_ACCEPT},application/pdf,.pdf`

export function CircuitWorkspaceEditor({
  workspace,
  onChange,
  onRegisterFlush,
  replayRecorderRef,
  disabled,
  compact,
}: Props) {
  const { toast } = useToast()
  const { theme: appTheme } = useTheme()
  const localRef = useRef(workspace)
  const insertImageRef = useRef<((dataUrl: string) => Promise<void>) | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nativeCameraRef = useRef<HTMLInputElement>(null)
  const lastShapeToolRef = useRef<WorkspaceTool>("line")
  const useNativeCamera = prefersNativeCameraCapture()
  const [attachOpen, setAttachOpen] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [attachLoading, setAttachLoading] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [localWorkspace, setLocalWorkspace] = useState(workspace)
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([])
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([])
  const [selectedStrokes, setSelectedStrokes] = useState<WorkspaceStroke[]>([])
  const [clipboardStrokes, setClipboardStrokes] = useState<WorkspaceStroke[]>([])
  const [viewport, setViewport] = useState<WorkspaceViewport>(DEFAULT_WORKSPACE_VIEWPORT)
  const viewportZoomRef = useRef(viewport.userZoom)
  const canvasHostRef = useRef<HTMLDivElement>(null)
  const clearSelectionOverlayRef = useRef<(() => void) | null>(null)
  const [hostSize, setHostSize] = useState({ w: 0, h: 0 })

  viewportZoomRef.current = viewport.userZoom

  const debouncedParentChange = useDebouncedCallback(
    (next: CircuitWorkspace) => onChange(next),
    200,
  )

  const commitWorkspace = useCallback(
    (next: CircuitWorkspace, flush = false) => {
      localRef.current = next
      const applyLocal = () => setLocalWorkspace(next)
      if (flush) {
        applyLocal()
      } else {
        startTransition(applyLocal)
      }
      if (flush) {
        debouncedParentChange.flush()
        onChange(next, { flush: true })
      } else {
        debouncedParentChange(next)
      }
    },
    [onChange, debouncedParentChange],
  )

  useEffect(() => {
    if (workspaceParentKey(workspace) === workspaceParentKey(localRef.current)) return
    localRef.current = workspace
    setLocalWorkspace(workspace)
  }, [workspace])

  useEffect(() => {
    onRegisterFlush?.(() => {
      debouncedParentChange.flush()
      onChange(localRef.current, { flush: true })
    })
  }, [onRegisterFlush, onChange, debouncedParentChange])

  const [paperTheme, setPaperTheme] = useState<WorkspacePaperTheme>(() => {
    if (typeof document === "undefined") return "light"
    return document.documentElement.classList.contains("dark") ? "dark" : "light"
  })

  useEffect(() => {
    setPaperTheme(appTheme === "dark" ? "dark" : "light")
  }, [appTheme])

  useEffect(() => {
    const syncPaperTheme = () => {
      setPaperTheme(document.documentElement.classList.contains("dark") ? "dark" : "light")
    }
    window.addEventListener("theme-change", syncPaperTheme as EventListener)
    return () => window.removeEventListener("theme-change", syncPaperTheme as EventListener)
  }, [])

  const activePage = localWorkspace.pages[localWorkspace.activePageIndex] ?? localWorkspace.pages[0]
  const tool = localWorkspace.tool ?? "pen"
  const color = localWorkspace.color ?? WORKSPACE_INK_COLORS[0].value
  const width = localWorkspace.width ?? WORKSPACE_WIDTHS[1].value
  const eraserMode = localWorkspace.eraserMode ?? "pixel"
  const eraserWidth = localWorkspace.eraserWidth ?? WORKSPACE_ERASER_WIDTHS[1].value
  const palette = workspaceColorsForTool(tool, paperTheme)
  const paperPattern = localWorkspace.paperPattern ?? "ruled"
  const paperSizeId = localWorkspace.paperSize ?? "notebook"
  const paperDimensions = getWorkspacePaperDimensions(localWorkspace)
  const activePaperSize = getWorkspacePaperSize(paperSizeId)

  const PAPER_PATTERN_ICONS = {
    ruled: AlignJustify,
    plain: Square,
    dotted: CircleDot,
    grid: Grid3x3,
  } as const

  const pushHistory = useCallback(() => {
    const w = localRef.current
    const idx = w.activePageIndex
    setUndoStack((prev) => [
      ...prev.slice(-29),
      {
        pages: w.pages.map((p, i) =>
          i === idx
            ? { ...p, strokes: p.strokes.map((s) => ({ ...s, points: [...s.points] })) }
            : p,
        ),
        activePageIndex: idx,
      },
    ])
    setRedoStack([])
  }, [])

  const applyWorkspace = useCallback(
    (patch: Partial<CircuitWorkspace>, flush = false) => {
      const base = localRef.current
      const activeTool = patch.tool ?? base.tool ?? "pen"
      let merged: CircuitWorkspace = { ...base, ...patch }
      if (patch.color != null && workspaceToolUsesColor(activeTool)) {
        merged = {
          ...merged,
          colorsByTool: {
            ...base.colorsByTool,
            ...patch.colorsByTool,
            [activeTool]: patch.color,
          },
        }
      } else if (patch.colorsByTool) {
        merged = {
          ...merged,
          colorsByTool: { ...base.colorsByTool, ...patch.colorsByTool },
        }
      }
      replayRecorderRef?.current.recordMetaChange(patch)
      commitWorkspace(merged, flush)
    },
    [commitWorkspace, replayRecorderRef],
  )

  useEffect(() => {
    const host = canvasHostRef.current
    if (!host) return
    const applyFit = () => {
      const rect = host.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setHostSize({ w: rect.width, h: rect.height })
        setViewport(fitWorkspaceViewport(rect.width, rect.height, paperDimensions))
      }
    }
    applyFit()
    requestAnimationFrame(applyFit)
    const ro = new ResizeObserver(() => {
      if (viewportZoomRef.current !== 1) return
      applyFit()
    })
    ro.observe(host)
    return () => ro.disconnect()
  }, [activePage.id, paperDimensions.width, paperDimensions.height])

  useEffect(() => {
    const host = canvasHostRef.current
    if (!host) return
    const rect = host.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      setViewport(fitWorkspaceViewport(rect.width, rect.height, paperDimensions))
    }
  }, [paperSizeId, paperDimensions.width, paperDimensions.height])

  useEffect(() => {
    if (!workspaceToolUsesColor(tool)) return
    const colors = workspaceColorsForTool(tool, paperTheme)
    if (colors.some((c) => c.value.toLowerCase() === color.toLowerCase())) return
    const remembered = localRef.current.colorsByTool?.[tool]
    if (remembered && colors.some((c) => c.value.toLowerCase() === remembered.toLowerCase())) {
      applyWorkspace({ color: remembered })
      return
    }
    applyWorkspace({
      color:
        tool === "pen" || tool === "line" || tool === "rect" || tool === "ellipse"
          ? mapInkColorToPaperTheme(color, paperTheme)
          : defaultWorkspaceColorForTool(tool, paperTheme),
    })
  }, [paperTheme, tool, color, applyWorkspace])

  const setStrokes = useCallback(
    (strokes: typeof activePage.strokes, prevCount?: number) => {
      const w = localRef.current
      const pageIndex = w.activePageIndex
      if (replayRecorderRef) {
        if (
          prevCount != null &&
          strokes.length === prevCount + 1 &&
          strokes[strokes.length - 1]
        ) {
          replayRecorderRef.current.recordStrokeAdd(pageIndex, strokes[strokes.length - 1]!)
        } else {
          replayRecorderRef.current.recordStrokesReplace(pageIndex, strokes)
        }
      }
      const pages = w.pages.map((p, i) => (i === pageIndex ? { ...p, strokes } : p))
      // Debounce parent sync while drawing — flush on navigation/submit via onRegisterFlush.
      commitWorkspace({ ...w, pages }, false)
    },
    [commitWorkspace, replayRecorderRef],
  )

  const undo = () => {
    const prev = undoStack[undoStack.length - 1]
    if (!prev) return
    setRedoStack((r) => [
      ...r,
      {
        pages: localRef.current.pages.map((p) => ({ ...p, strokes: [...p.strokes] })),
        activePageIndex: localRef.current.activePageIndex,
      },
    ])
    setUndoStack((s) => s.slice(0, -1))
    applyWorkspace({ pages: prev.pages, activePageIndex: prev.activePageIndex }, true)
  }

  const redo = () => {
    const next = redoStack[redoStack.length - 1]
    if (!next) return
    setUndoStack((s) => [
      ...s,
      {
        pages: localRef.current.pages.map((p) => ({ ...p, strokes: [...p.strokes] })),
        activePageIndex: localRef.current.activePageIndex,
      },
    ])
    setRedoStack((r) => r.slice(0, -1))
    applyWorkspace({ pages: next.pages, activePageIndex: next.activePageIndex }, true)
  }

  const clearPage = () => {
    if (activePage.strokes.length === 0) return
    pushHistory()
    setStrokes([])
  }

  const addPage = () => {
    const w = localRef.current
    if (w.pages.length >= WORKSPACE_MAX_PAGES) return
    pushHistory()
    applyWorkspace(
      {
        pages: [...w.pages, createEmptyWorkspacePage()],
        activePageIndex: w.pages.length,
      },
      true,
    )
  }

  const removePage = () => {
    const w = localRef.current
    if (w.pages.length <= 1) {
      clearPage()
      return
    }
    pushHistory()
    const pages = w.pages.filter((_, i) => i !== w.activePageIndex)
    applyWorkspace(
      {
        pages,
        activePageIndex: Math.min(w.activePageIndex, pages.length - 1),
      },
      true,
    )
  }

  const zoomAroundCenter = (delta: number) => {
    const host = canvasHostRef.current
    if (!host) return
    const rect = host.getBoundingClientRect()
    setViewport((v) =>
      zoomUserAt(
        v,
        v.userZoom + delta,
        rect.width / 2,
        rect.height / 2,
        rect.width,
        rect.height,
        paperDimensions,
      ),
    )
  }

  const resetViewport = () => {
    const host = canvasHostRef.current
    if (!host) return
    const rect = host.getBoundingClientRect()
    setViewport(fitWorkspaceViewport(rect.width, rect.height, paperDimensions))
  }

  const setPaperSize = (nextId: WorkspacePaperSizeId) => {
    if (nextId === paperSizeId) return
    pushHistory()
    applyWorkspace(scaleWorkspaceToPaperSize(localRef.current, nextId), true)
  }

  const dismissSelection = useCallback(() => {
    setSelectedStrokes([])
    clearSelectionOverlayRef.current?.()
  }, [])

  const setTool = (t: WorkspaceTool) => {
    const current = localRef.current
    const toolColors = workspaceToolUsesColor(tool)
      ? { ...current.colorsByTool, [tool]: color }
      : { ...current.colorsByTool }
    const nextColor = resolveWorkspaceColorForTool(
      t,
      { color, colorsByTool: toolColors },
      paperTheme,
    )
    const nextWidth =
      t === "pointer" && width < WORKSPACE_WIDTHS[2]!.value
        ? WORKSPACE_WIDTHS[2]!.value
        : width
    if (SHAPE_TOOL_IDS.has(t)) lastShapeToolRef.current = t
    dismissSelection()
    applyWorkspace({ tool: t, color: nextColor, colorsByTool: toolColors, width: nextWidth })
  }

  const insertAttachment = async (dataUrl: string, label: string) => {
    const insert = insertImageRef.current
    if (!insert) {
      toast({
        title: "Workspace not ready",
        description: "Wait for the canvas to load, then try again.",
        variant: "destructive",
      })
      return
    }
    setAttachLoading(true)
    try {
      await insert(dataUrl)
      setAttachOpen(false)
      setLinkUrl("")
      toast({ title: "Attached to workspace", description: label })
    } catch (e) {
      toast({
        title: "Could not attach",
        description: e instanceof Error ? e.message : "Try another file or link",
        variant: "destructive",
      })
    } finally {
      setAttachLoading(false)
    }
  }

  const handleAttachFile = async (file: File) => {
    const dataUrl = await workspaceAttachFileToDataUrl(file)
    await insertAttachment(dataUrl, file.name)
  }

  const handleAttachLink = async () => {
    const dataUrl = await workspaceAttachUrlToDataUrl(linkUrl)
    await insertAttachment(dataUrl, "Linked image")
  }

  const openPhotoPicker = () => {
    photoInputRef.current?.click()
    setAttachOpen(false)
  }

  const openFilePicker = () => {
    fileInputRef.current?.click()
    setAttachOpen(false)
  }

  const openCamera = () => {
    if (useNativeCamera) {
      nativeCameraRef.current?.click()
      setAttachOpen(false)
      return
    }
    setAttachOpen(false)
    setCameraOpen(true)
  }

  const onAttachInputChange = async (files: FileList | null, kind: "photo" | "file") => {
    const file = files?.[0]
    if (!file) return
    try {
      await handleAttachFile(file)
    } catch (e) {
      toast({
        title: kind === "photo" ? "Could not add photo" : "Could not add file",
        description: e instanceof Error ? e.message : "Unsupported file",
        variant: "destructive",
      })
    } finally {
      if (photoInputRef.current) photoInputRef.current.value = ""
      if (fileInputRef.current) fileInputRef.current.value = ""
      if (nativeCameraRef.current) nativeCameraRef.current.value = ""
    }
  }

  const strokesChanged = (next: WorkspaceStroke[], prev: WorkspaceStroke[]) => {
    if (next.length !== prev.length) return true
    for (let i = 0; i < next.length; i++) {
      if (next[i]!.id !== prev[i]!.id) return true
      if (next[i]!.points.length !== prev[i]!.points.length) return true
    }
    return false
  }

  const isInkTool = workspaceToolUsesColor(tool)
  const isEraserTool = tool === "eraser"
  const isPointerTool = tool === "pointer"
  const isSelectTool = tool === "select_rect" || tool === "select_lasso"
  const isShapeTool = SHAPE_TOOL_IDS.has(tool)
  const ActiveShapeIcon = (SHAPE_TOOLS.find((t) => t.id === tool) ?? SHAPE_TOOLS[0]).icon

  const canvasHintExpanded = isPointerTool
    ? "Presentation marker — move to aim · drag for a soft highlighter trail · marks fade on their own and are not saved"
    : isEraserTool
      ? eraserMode === "pixel"
        ? "Partial eraser — drag to rub out ink in real time · indigo ring shows brush size"
        : "Whole stroke eraser — drag over strokes to remove them · red ring marks the brush"
      : isSelectTool
        ? "Drag to select · tap attachment · drag to move · corner handles to resize"
        : "Scroll to pan · Pinch to zoom · Attach or paste images · Ctrl+scroll to zoom"

  const canvasHintCompact = isPointerTool
    ? "Marker — drag to highlight · fades automatically"
    : isEraserTool
    ? eraserMode === "pixel"
      ? "Partial erase — drag to rub out ink live"
      : "Whole stroke — drag over strokes to remove"
    : isSelectTool
      ? "Select · tap attachment · drag · resize corners"
      : "Scroll to pan · Attach · tap image to move/resize"

  const cloneStrokesWithOffset = (strokes: WorkspaceStroke[], offset = 24): WorkspaceStroke[] =>
    strokes.map((s) => ({
      ...s,
      id: newWorkspaceStrokeId(),
      points: s.points.map((p) => ({ ...p, x: p.x + offset, y: p.y + offset })),
    }))

  const deleteSelected = () => {
    if (selectedStrokes.length === 0) return
    pushHistory()
    const ids = new Set(selectedStrokes.map((s) => s.id))
    setStrokes(removeStrokesById(activePage.strokes, ids))
    dismissSelection()
  }

  const copySelected = () => {
    if (selectedStrokes.length === 0) return
    setClipboardStrokes(selectedStrokes.map((s) => ({ ...s, id: newWorkspaceStrokeId() })))
    dismissSelection()
  }

  const cutSelected = () => {
    if (selectedStrokes.length === 0) return
    setClipboardStrokes(selectedStrokes.map((s) => ({ ...s, id: newWorkspaceStrokeId() })))
    pushHistory()
    const ids = new Set(selectedStrokes.map((s) => s.id))
    setStrokes(removeStrokesById(activePage.strokes, ids))
    dismissSelection()
  }

  const pasteClipboard = () => {
    if (clipboardStrokes.length === 0) return
    pushHistory()
    dismissSelection()
    const pasted = cloneStrokesWithOffset(clipboardStrokes)
    setStrokes([...activePage.strokes, ...pasted])
    setSelectedStrokes(pasted)
    setClipboardStrokes(pasted)
  }

  const toolBtnClass = (active: boolean) =>
    cn(
      "flex shrink-0 items-center justify-center rounded-lg transition-all",
      compact ? "h-8 w-8" : "h-9 w-9 sm:h-10 sm:w-10",
      active
        ? "bg-slate-800 text-white shadow-md dark:bg-indigo-600"
        : "text-slate-600 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-slate-700/60",
    )

  const toolbarDivider = (
    <div className="w-px h-7 bg-slate-200 dark:bg-slate-700 shrink-0 hidden sm:block" />
  )

  const consolidatedToolbar = (
      <div className="shrink-0 w-full min-w-0 max-w-full rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 shadow-sm backdrop-blur-sm overflow-hidden">
        <div className="w-full max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch] scrollbar-thin">
          <div className="flex w-max min-w-full items-center gap-1.5 p-1.5 sm:p-2">
          {/* Drawing tools */}
          <div className="flex items-center gap-0.5 shrink-0">
            {PRIMARY_TOOLS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                title={label}
                disabled={disabled}
                onClick={() => setTool(id)}
                className={toolBtnClass(tool === id)}
              >
                <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
              </button>
            ))}
            <button
              type="button"
              title="Shapes"
              disabled={disabled}
              onClick={() => setTool(isShapeTool ? tool : lastShapeToolRef.current)}
              className={toolBtnClass(isShapeTool)}
            >
              {isShapeTool ? (
                <ActiveShapeIcon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
              ) : (
                <Shapes className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
              )}
            </button>
            <Popover open={attachOpen} onOpenChange={setAttachOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title="Attach image, photo, file, or link"
                  disabled={disabled || attachLoading}
                  className={toolBtnClass(attachOpen)}
                >
                  {attachLoading ? (
                    <Loader2 className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4", "animate-spin")} />
                  ) : (
                    <Paperclip className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-2 z-[70]">
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    disabled={disabled || attachLoading}
                    onClick={openPhotoPicker}
                    className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ImageIcon className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                    Choose photo
                  </button>
                  <button
                    type="button"
                    disabled={disabled || attachLoading}
                    onClick={openCamera}
                    className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Camera className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                    Take photo
                  </button>
                  <button
                    type="button"
                    disabled={disabled || attachLoading}
                    onClick={openFilePicker}
                    className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                    Choose file
                  </button>
                  <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
                  <div className="px-1 py-1">
                    <p className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5 px-1.5">
                      <Link2 className="h-3.5 w-3.5" />
                      Add link
                    </p>
                    <div className="flex gap-1">
                      <Input
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://…"
                        className="h-8 text-xs"
                        disabled={disabled || attachLoading}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            void handleAttachLink()
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 shrink-0 px-2.5"
                        disabled={disabled || attachLoading || !linkUrl.trim()}
                        onClick={() => void handleAttachLink()}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {toolbarDivider}

          {/* Shape options — visible when a shape tool is active */}
          {isShapeTool ? (
            <div className="flex items-center gap-1.5 shrink-0 rounded-lg border border-indigo-200/70 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-950/25 px-1.5 py-1">
              <Shapes className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 hidden sm:block" />
              {SHAPE_TOOLS.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  title={label}
                  disabled={disabled}
                  onClick={() => setTool(id)}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] sm:text-[11px] font-medium border transition-colors shrink-0",
                    tool === id
                      ? "border-indigo-500 bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200"
                      : "border-transparent text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60",
                  )}
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          ) : null}

          {isShapeTool ? toolbarDivider : null}

          {/* Eraser options — visible when eraser active */}
          {isEraserTool ? (
            <div className="flex items-center gap-1.5 shrink-0 rounded-lg border border-rose-200/70 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/25 px-1.5 py-1">
              <Eraser className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0 hidden sm:block" />
              {(["pixel", "stroke"] as const).map((mode) => {
                const Icon = mode === "pixel" ? Scissors : CircleSlash2
                const label = mode === "pixel" ? "Partial" : "Whole stroke"
                return (
                  <button
                    key={mode}
                    type="button"
                    title={mode === "pixel" ? "Erase ink along the brush path" : "Remove entire strokes you touch"}
                    disabled={disabled}
                    onClick={() => applyWorkspace({ eraserMode: mode })}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] sm:text-[11px] font-medium border transition-colors shrink-0",
                      eraserMode === mode
                        ? mode === "pixel"
                          ? "border-indigo-500 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200"
                          : "border-rose-500 bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                        : "border-transparent text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60",
                    )}
                  >
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                )
              })}
              <div className="w-px h-5 bg-rose-200/80 dark:bg-rose-800/60 shrink-0" />
              {WORKSPACE_ERASER_WIDTHS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  title={`${w.label} eraser (${w.value}px)`}
                  disabled={disabled}
                  onClick={() => applyWorkspace({ eraserWidth: w.value })}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all shrink-0",
                    eraserWidth === w.value
                      ? "border-rose-500 bg-white dark:bg-slate-900 shadow-sm scale-105"
                      : "border-slate-300/80 dark:border-slate-600 hover:border-rose-300 dark:hover:border-rose-700",
                  )}
                >
                  <span
                    className={cn(
                      "rounded-full",
                      eraserWidth === w.value
                        ? "bg-rose-500 dark:bg-rose-400"
                        : "bg-slate-400 dark:bg-slate-500",
                    )}
                    style={{ width: w.dot * 0.5, height: w.dot * 0.5 }}
                  />
                </button>
              ))}
            </div>
          ) : null}

          {/* Ink color + width — hidden for eraser / selection */}
          {isInkTool ? (
            <>
              {toolbarDivider}
              <div className="flex items-center gap-1 shrink-0">
                {palette.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={disabled}
                    title={c.label}
                    onClick={() => applyWorkspace({ color: c.value })}
                    className={cn(
                      "rounded-full border-2 transition-all hover:scale-105 shrink-0",
                      compact ? "h-5 w-5" : "h-6 w-6",
                      color === c.value
                        ? "border-slate-800 dark:border-white ring-2 ring-slate-400/40 scale-110"
                        : "border-slate-300/80 dark:border-slate-600",
                      tool === "highlighter" && "opacity-90",
                      tool === "pointer" && c.id === "red" && "opacity-95",
                    )}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
              {toolbarDivider}
              <div className="flex items-center gap-0.5 shrink-0">
                {WORKSPACE_WIDTHS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    title={w.label}
                    disabled={disabled}
                    onClick={() => applyWorkspace({ width: w.value })}
                    className={cn(
                      "flex items-center justify-center rounded-md transition-colors shrink-0",
                      compact ? "h-7 w-7" : "h-8 w-8",
                      width === w.value
                        ? "bg-slate-200 dark:bg-slate-700"
                        : "hover:bg-slate-100 dark:hover:bg-slate-800",
                    )}
                  >
                    <span
                      className="rounded-full bg-slate-800 dark:bg-slate-200"
                      style={{ width: w.dot * 0.55, height: w.dot * 0.55 }}
                    />
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {isSelectTool ? (
            <>
              {toolbarDivider}
              <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0 px-1">
                Drag to select · Cut / Copy / Delete
              </span>
            </>
          ) : null}

          {toolbarDivider}

          {/* Paper */}
          <div className="flex items-center gap-0.5 shrink-0" title="Paper style">
            {WORKSPACE_PAPER_PATTERNS.map((pattern) => {
              const Icon = PAPER_PATTERN_ICONS[pattern.id]
              return (
                <button
                  key={pattern.id}
                  type="button"
                  title={pattern.label}
                  disabled={disabled}
                  onClick={() => applyWorkspace({ paperPattern: pattern.id })}
                  className={cn(
                    "flex items-center justify-center rounded-md transition-colors shrink-0",
                    compact ? "h-7 w-7" : "h-8 w-8",
                    paperPattern === pattern.id
                      ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              )
            })}
          </div>

          {toolbarDivider}

          {/* Paper size */}
          <div className="flex items-center gap-0.5 shrink-0" title="Paper size">
            {WORKSPACE_PAPER_SIZES.map((size) => (
              <button
                key={size.id}
                type="button"
                title={size.label}
                disabled={disabled}
                onClick={() => setPaperSize(size.id)}
                className={cn(
                  "rounded-md px-1.5 py-1 text-[10px] sm:text-[11px] font-medium border transition-colors shrink-0",
                  paperSizeId === size.id
                    ? "border-indigo-500 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
                )}
              >
                {size.shortLabel}
              </button>
            ))}
          </div>

          {toolbarDivider}

          {/* Zoom */}
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={disabled}
              onClick={() => zoomAroundCenter(-WORKSPACE_USER_ZOOM_STEP)}
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-[10px] tabular-nums text-slate-600 dark:text-slate-300 min-w-[2.5rem] text-center shrink-0">
              {formatZoomPercent(viewport.userZoom)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={disabled}
              onClick={() => zoomAroundCenter(WORKSPACE_USER_ZOOM_STEP)}
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={disabled}
              onClick={resetViewport}
              title="Fit page"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {toolbarDivider}

          {/* History */}
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={disabled || undoStack.length === 0}
              onClick={undo}
              title="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={disabled || redoStack.length === 0}
              onClick={redo}
              title="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-600"
              disabled={disabled}
              onClick={clearPage}
              title="Clear page"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          </div>
        </div>
      </div>
  )

  return (
    <div className={cn("flex w-full min-w-0 flex-col min-h-0 gap-2", compact ? "" : "h-full flex-1")}>
      <input
        ref={photoInputRef}
        type="file"
        accept={WORKSPACE_PHOTO_ACCEPT}
        className="hidden"
        onChange={(e) => void onAttachInputChange(e.target.files, "photo")}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={WORKSPACE_FILE_ACCEPT}
        className="hidden"
        onChange={(e) => void onAttachInputChange(e.target.files, "file")}
      />
      <input
        ref={nativeCameraRef}
        type="file"
        accept={WORKSPACE_PHOTO_ACCEPT}
        capture="environment"
        className="hidden"
        onChange={(e) => void onAttachInputChange(e.target.files, "photo")}
      />
      <SolutionCameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={async (file) => {
          try {
            await handleAttachFile(file)
          } catch (e) {
            toast({
              title: "Could not add photo",
              description: e instanceof Error ? e.message : "Camera capture failed",
              variant: "destructive",
            })
            return false
          }
          return false
        }}
      />
      {consolidatedToolbar}

        {/* Page strip */}
        <div className="shrink-0 w-full min-w-0 max-w-full flex items-center gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch] pb-0.5 scrollbar-thin">
          {localWorkspace.pages.map((p, i) => (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                replayRecorderRef?.current.recordPageSwitch(i)
                applyWorkspace({ activePageIndex: i }, true)
              }}
              className={cn(
                "relative flex items-center justify-center rounded-lg border text-xs font-medium transition-all shrink-0",
                compact ? "h-7 min-w-[2rem] px-2" : "h-8 min-w-[2.5rem] px-2.5",
                i === localWorkspace.activePageIndex
                  ? "border-indigo-500 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-500 shadow-sm"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300",
              )}
            >
              {i + 1}
              {p.strokes.length > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
              ) : null}
            </button>
          ))}
          {localWorkspace.pages.length < WORKSPACE_MAX_PAGES ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn("shrink-0", compact ? "h-7 w-7" : "h-8 w-8")}
              disabled={disabled}
              onClick={addPage}
              title="Add page"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {localWorkspace.pages.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-red-500 shrink-0"
              disabled={disabled}
              onClick={removePage}
            >
              Delete page
            </Button>
          ) : null}
        </div>

        {/* Canvas — pan/zoom viewport (two-finger pinch on iPad; Ctrl+wheel on desktop) */}
        <div
          ref={canvasHostRef}
          className={cn(
            "relative overflow-hidden rounded-2xl shadow-lg",
            "ring-1 ring-slate-200/80 dark:ring-slate-700/80",
            compact
              ? "h-[min(360px,42vh)] min-h-[260px] shrink-0"
              : "flex-1 min-h-0",
          )}
        >
          <CircuitWorkspaceCanvas
            page={activePage}
            tool={tool}
            color={color}
            width={width}
            eraserMode={eraserMode}
            eraserWidth={eraserWidth}
            paperTheme={paperTheme}
            paperPattern={paperPattern}
            paperWidth={paperDimensions.width}
            paperHeight={paperDimensions.height}
            hostSize={hostSize}
            disabled={disabled}
            interactive={!disabled}
            viewport={viewport}
            onViewportChange={setViewport}
            className="rounded-2xl"
            onSelectionChange={setSelectedStrokes}
            selectedStrokes={selectedStrokes}
            clearSelectionOverlayRef={clearSelectionOverlayRef}
            onStrokesChange={(strokes) => {
              const prev = activePage.strokes
              if (strokesChanged(strokes, prev)) pushHistory()
              setStrokes(strokes, prev.length)
            }}
            onRegisterImageInsert={(insert) => {
              insertImageRef.current = insert
            }}
          />
          {selectedStrokes.length > 0 ? (
            <div className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 p-1 shadow-lg backdrop-blur-sm">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                disabled={disabled}
                onClick={cutSelected}
                title="Cut"
              >
                <Scissors className="h-3.5 w-3.5 mr-1" />
                Cut
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                disabled={disabled}
                onClick={copySelected}
                title="Copy"
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copy
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                disabled={disabled || clipboardStrokes.length === 0}
                onClick={pasteClipboard}
                title="Paste"
              >
                Paste
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-red-500 hover:text-red-600"
                disabled={disabled}
                onClick={deleteSelected}
                title="Delete selection"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete
              </Button>
            </div>
          ) : null}
          {!compact ? (
            <p className="absolute bottom-2 left-3 right-3 pointer-events-none text-[10px] text-slate-500 dark:text-slate-400 text-center">
              {canvasHintExpanded}
            </p>
          ) : (
            <p className="absolute bottom-1.5 left-2 right-2 pointer-events-none text-[9px] text-slate-500 dark:text-slate-400 text-center">
              {canvasHintCompact}
            </p>
          )}
        </div>
    </div>
  )
}
