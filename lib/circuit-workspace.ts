/**
 * Circuit submission workspace — multi-page handwriting notebook for iPad/stylus.
 */

export type WorkspaceTool =
  | "pen"
  | "highlighter"
  | "pointer"
  | "eraser"
  | "line"
  | "rect"
  | "ellipse"
  | "image"
  | "select_rect"
  | "select_lasso"

export type WorkspaceEraserMode = "pixel" | "stroke"

export type WorkspacePaperPattern = "ruled" | "plain" | "dotted" | "grid"

/** Standard page sizes at 150 DPI (width × height in canvas pixels). */
export type WorkspacePaperSizeId = "notebook" | "letter" | "a4" | "legal" | "tabloid"

export type WorkspacePaperSize = {
  id: WorkspacePaperSizeId
  label: string
  shortLabel: string
  width: number
  height: number
}

export type WorkspacePoint = { x: number; y: number; p?: number }

export type WorkspaceStroke = {
  id: string
  tool: WorkspaceTool
  color: string
  width: number
  points: WorkspacePoint[]
  /** Base64 data URL for pasted figures (tool === "image"). */
  imageDataUrl?: string
}

export type WorkspacePage = {
  id: string
  strokes: WorkspaceStroke[]
}

export type CircuitWorkspace = {
  version: 1
  pages: WorkspacePage[]
  activePageIndex: number
  tool?: WorkspaceTool
  color?: string
  /** Last selected color per tool (pen, pointer, highlighter, shapes, etc.). */
  colorsByTool?: Partial<Record<WorkspaceTool, string>>
  width?: number
  paperPattern?: WorkspacePaperPattern
  paperSize?: WorkspacePaperSizeId
  eraserMode?: WorkspaceEraserMode
  eraserWidth?: number
}

export type CircuitSubmissionMode = "upload" | "photo" | "workspace"

export type WorkspacePaperTheme = "light" | "dark" | "export"

/** Default notebook page (backward-compatible with legacy workspaces). */
export const WORKSPACE_CANVAS_WIDTH = 1200
export const WORKSPACE_CANVAS_HEIGHT = 1600

export const WORKSPACE_PAPER_SIZES: WorkspacePaperSize[] = [
  { id: "notebook", label: "Notebook", shortLabel: "NB", width: 1200, height: 1600 },
  { id: "letter", label: "US Letter", shortLabel: "Ltr", width: 1275, height: 1650 },
  { id: "a4", label: "A4", shortLabel: "A4", width: 1240, height: 1754 },
  { id: "legal", label: "US Legal", shortLabel: "Leg", width: 1275, height: 2100 },
  { id: "tabloid", label: "Tabloid", shortLabel: "Tab", width: 1650, height: 2100 },
]

export const DEFAULT_WORKSPACE_PAPER_SIZE_ID: WorkspacePaperSizeId = "notebook"

const VALID_PAPER_SIZE_IDS = new Set(WORKSPACE_PAPER_SIZES.map((s) => s.id))

export function getWorkspacePaperSize(id?: WorkspacePaperSizeId | null): WorkspacePaperSize {
  const match = WORKSPACE_PAPER_SIZES.find((s) => s.id === id)
  return match ?? WORKSPACE_PAPER_SIZES[0]!
}

export function getWorkspacePaperDimensions(
  ws?: Pick<CircuitWorkspace, "paperSize"> | null,
): { width: number; height: number } {
  const size = getWorkspacePaperSize(ws?.paperSize)
  return { width: size.width, height: size.height }
}

/** Scale stroke coordinates when switching page size so ink stays proportionally placed. */
export function scaleWorkspaceToPaperSize(
  workspace: CircuitWorkspace,
  nextSizeId: WorkspacePaperSizeId,
): CircuitWorkspace {
  const from = getWorkspacePaperSize(workspace.paperSize)
  const to = getWorkspacePaperSize(nextSizeId)
  if (from.id === to.id) return { ...workspace, paperSize: to.id }
  const sx = to.width / from.width
  const sy = to.height / from.height
  const strokeScale = (sx + sy) / 2
  const pages = workspace.pages.map((p) => ({
    ...p,
    strokes: p.strokes.map((s) => ({
      ...s,
      width: s.width * strokeScale,
      points: s.points.map((pt) => ({ ...pt, x: pt.x * sx, y: pt.y * sy })),
    })),
  }))
  return { ...workspace, paperSize: to.id, pages }
}
/** 2× export for crisp AI / instructor grading */
export const WORKSPACE_EXPORT_SCALE = 2
export const WORKSPACE_MAX_PAGES = 10
export const WORKSPACE_UPLOAD_TIMEOUT_MS = 90_000

/** Muted ink colors for light paper (GoodNotes / Notability style) */
export const WORKSPACE_INK_COLORS = [
  { id: "black", value: "#1c1c1e", label: "Black" },
  { id: "blue", value: "#2b5797", label: "Blue" },
  { id: "red", value: "#b44040", label: "Red" },
  { id: "green", value: "#2d6a4f", label: "Green" },
  { id: "purple", value: "#5c4d7a", label: "Purple" },
  { id: "brown", value: "#7a5c3a", label: "Brown" },
] as const

/** Light ink colors for dark paper */
export const WORKSPACE_INK_COLORS_DARK = [
  { id: "white", value: "#f2f2f7", label: "White" },
  { id: "sky", value: "#7eb0e8", label: "Blue" },
  { id: "coral", value: "#f08a8a", label: "Red" },
  { id: "mint", value: "#72c8a0", label: "Green" },
  { id: "lavender", value: "#b8a8e8", label: "Purple" },
  { id: "sand", value: "#d4b896", label: "Sand" },
] as const

const INK_COLOR_LIGHT_TO_DARK = Object.fromEntries(
  WORKSPACE_INK_COLORS.map((c, i) => [c.value.toLowerCase(), WORKSPACE_INK_COLORS_DARK[i]!.value]),
) as Record<string, string>

const INK_COLOR_DARK_TO_LIGHT = Object.fromEntries(
  WORKSPACE_INK_COLORS_DARK.map((c, i) => [c.value.toLowerCase(), WORKSPACE_INK_COLORS[i]!.value]),
) as Record<string, string>

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().toLowerCase()
  const match = /^#?([0-9a-f]{6})$/.exec(normalized)
  if (!match) return null
  const value = Number.parseInt(match[1]!, 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0.5
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

/** Map stored stroke color to a visible color for the active paper theme. */
export function resolveStrokeColorForTheme(color: string, theme: WorkspacePaperTheme): string {
  const key = color.toLowerCase()
  if (theme === "dark") {
    return INK_COLOR_LIGHT_TO_DARK[key] ?? (relativeLuminance(color) < 0.35 ? "#f2f2f7" : color)
  }
  // light + export always use dark ink on light paper for grading readability
  return INK_COLOR_DARK_TO_LIGHT[key] ?? color
}

/** Pick the matching ink from the other palette (e.g. when toggling app theme). */
export function mapInkColorToPaperTheme(color: string, paperTheme: WorkspacePaperTheme): string {
  const key = color.toLowerCase()
  if (paperTheme === "dark") {
    return INK_COLOR_LIGHT_TO_DARK[key] ?? WORKSPACE_INK_COLORS_DARK[0]!.value
  }
  return INK_COLOR_DARK_TO_LIGHT[key] ?? WORKSPACE_INK_COLORS[0]!.value
}

/** Student-selectable marker / highlighter / pointer colors (matte, not laser). */
export const WORKSPACE_MARKING_COLORS = [
  { id: "red", value: "#e63946", label: "Red" },
  { id: "yellow", value: "#e8d44d", label: "Yellow" },
  { id: "orange", value: "#f77f00", label: "Orange" },
  { id: "pink", value: "#e8a0b8", label: "Pink" },
  { id: "mint", value: "#7ec8a8", label: "Mint" },
  { id: "sky", value: "#7eb8e8", label: "Sky" },
  { id: "lavender", value: "#b8a8e8", label: "Lavender" },
  { id: "peach", value: "#e8b888", label: "Peach" },
] as const

/** @deprecated use WORKSPACE_MARKING_COLORS */
export const WORKSPACE_POINTER_COLORS = WORKSPACE_MARKING_COLORS

/** @deprecated use WORKSPACE_MARKING_COLORS */
export const WORKSPACE_HIGHLIGHTER_COLORS = WORKSPACE_MARKING_COLORS

/** @deprecated use WORKSPACE_INK_COLORS */
export const WORKSPACE_COLORS = WORKSPACE_INK_COLORS

export const WORKSPACE_PAPER_PATTERNS = [
  { id: "ruled" as const, label: "Ruled" },
  { id: "plain" as const, label: "Plain" },
  { id: "dotted" as const, label: "Dotted" },
  { id: "grid" as const, label: "Grid" },
] as const

export const WORKSPACE_WIDTHS = [
  { id: "thin", value: 2, label: "Thin", dot: 4 },
  { id: "medium", value: 4, label: "Medium", dot: 7 },
  { id: "thick", value: 8, label: "Thick", dot: 11 },
  { id: "bold", value: 14, label: "Bold", dot: 16 },
] as const

export const WORKSPACE_ERASER_WIDTHS = [
  { id: "small", value: 12, label: "Small", dot: 6 },
  { id: "medium", value: 24, label: "Medium", dot: 10 },
  { id: "large", value: 40, label: "Large", dot: 14 },
  { id: "xlarge", value: 64, label: "Extra large", dot: 18 },
] as const

export function workspaceColorsForTool(tool: WorkspaceTool, paperTheme: WorkspacePaperTheme = "light") {
  if (tool === "pointer" || tool === "highlighter") return WORKSPACE_MARKING_COLORS
  return paperTheme === "dark" ? WORKSPACE_INK_COLORS_DARK : WORKSPACE_INK_COLORS
}

const COLOR_USING_TOOLS: WorkspaceTool[] = [
  "pen",
  "highlighter",
  "pointer",
  "line",
  "rect",
  "ellipse",
]

export function workspaceToolUsesColor(tool: WorkspaceTool): boolean {
  return COLOR_USING_TOOLS.includes(tool)
}

function colorInPalette(value: string, tool: WorkspaceTool, paperTheme: WorkspacePaperTheme): boolean {
  return workspaceColorsForTool(tool, paperTheme).some(
    (c) => c.value.toLowerCase() === value.toLowerCase(),
  )
}

/** First-time default when a tool has no saved color yet. */
export function defaultWorkspaceColorForTool(
  tool: WorkspaceTool,
  paperTheme: WorkspacePaperTheme = "light",
): string {
  if (tool === "pointer") return WORKSPACE_MARKING_COLORS[0]!.value
  if (tool === "highlighter") {
    return WORKSPACE_MARKING_COLORS.find((c) => c.id === "yellow")!.value
  }
  return paperTheme === "dark" ? WORKSPACE_INK_COLORS_DARK[0]!.value : WORKSPACE_INK_COLORS[0]!.value
}

export function resolveWorkspaceColorForTool(
  tool: WorkspaceTool,
  workspace: Pick<CircuitWorkspace, "color" | "colorsByTool">,
  paperTheme: WorkspacePaperTheme = "light",
): string {
  const remembered = workspace.colorsByTool?.[tool]
  if (remembered && colorInPalette(remembered, tool, paperTheme)) return remembered
  const current = workspace.color
  if (current && colorInPalette(current, tool, paperTheme)) return current
  return defaultWorkspaceColorForTool(tool, paperTheme)
}

export function newWorkspaceStrokeId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function newWorkspacePageId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function createEmptyWorkspacePage(): WorkspacePage {
  return { id: newWorkspacePageId(), strokes: [] }
}

export function createEmptyWorkspace(): CircuitWorkspace {
  return {
    version: 1,
    pages: [createEmptyWorkspacePage()],
    activePageIndex: 0,
    tool: "pen",
    color: WORKSPACE_INK_COLORS[0].value,
    width: WORKSPACE_WIDTHS[1].value,
    paperPattern: "ruled",
    paperSize: DEFAULT_WORKSPACE_PAPER_SIZE_ID,
    eraserMode: "pixel",
    eraserWidth: WORKSPACE_ERASER_WIDTHS[1].value,
  }
}

const VALID_WORKSPACE_TOOLS: WorkspaceTool[] = [
  "pen",
  "highlighter",
  "pointer",
  "eraser",
  "line",
  "rect",
  "ellipse",
  "image",
  "select_rect",
  "select_lasso",
]

const VALID_ERASER_MODES: WorkspaceEraserMode[] = ["pixel", "stroke"]

const VALID_PAPER_PATTERNS: WorkspacePaperPattern[] = ["ruled", "plain", "dotted", "grid"]

export function parseCircuitWorkspace(raw: unknown): CircuitWorkspace | null {
  if (raw == null || raw === "") return null
  try {
    const obj =
      typeof raw === "string" ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown>)
    if (!obj || typeof obj !== "object" || obj.version !== 1) return null
    const pagesRaw = obj.pages
    if (!Array.isArray(pagesRaw) || pagesRaw.length === 0) return null
    const pages: WorkspacePage[] = pagesRaw
      .map((p) => {
        if (!p || typeof p !== "object") return null
        const pr = p as Record<string, unknown>
        const strokesRaw = pr.strokes
        const strokes: WorkspaceStroke[] = Array.isArray(strokesRaw)
          ? strokesRaw
              .map((s) => {
                if (!s || typeof s !== "object") return null
                const sr = s as Record<string, unknown>
                const tool = sr.tool as WorkspaceTool
                if (!VALID_WORKSPACE_TOOLS.includes(tool)) return null
                const pointsRaw = sr.points
                if (!Array.isArray(pointsRaw) || pointsRaw.length === 0) return null
                if (tool === "image" && typeof sr.imageDataUrl !== "string") return null
                const points: WorkspacePoint[] = pointsRaw
                  .map((pt) => {
                    if (!pt || typeof pt !== "object") return null
                    const pr2 = pt as Record<string, unknown>
                    const x = Number(pr2.x)
                    const y = Number(pr2.y)
                    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
                    const pressure = Number(pr2.p)
                    return {
                      x,
                      y,
                      ...(Number.isFinite(pressure) ? { p: pressure } : {}),
                    }
                  })
                  .filter((pt): pt is WorkspacePoint => pt != null)
                if (points.length === 0) return null
                return {
                  id: typeof sr.id === "string" ? sr.id : newWorkspaceStrokeId(),
                  tool,
                  color: typeof sr.color === "string" ? sr.color : WORKSPACE_INK_COLORS[0].value,
                  width: Number.isFinite(Number(sr.width)) ? Number(sr.width) : 4,
                  points,
                  ...(tool === "image" && typeof sr.imageDataUrl === "string"
                    ? { imageDataUrl: sr.imageDataUrl }
                    : {}),
                }
              })
              .filter((s): s is WorkspaceStroke => s != null)
          : []
        return {
          id: typeof pr.id === "string" ? pr.id : newWorkspacePageId(),
          strokes,
        }
      })
      .filter((p): p is WorkspacePage => p != null)
    if (pages.length === 0) return null
    const activePageIndex = Math.min(
      Math.max(0, Number(obj.activePageIndex) || 0),
      pages.length - 1,
    )
    const tool = obj.tool as WorkspaceTool | undefined
    const color = typeof obj.color === "string" ? obj.color : WORKSPACE_INK_COLORS[0].value
    const width = Number.isFinite(Number(obj.width)) ? Number(obj.width) : WORKSPACE_WIDTHS[1].value
    const paperPattern = obj.paperPattern as WorkspacePaperPattern | undefined
    const paperSize = obj.paperSize as WorkspacePaperSizeId | undefined
    const eraserMode = obj.eraserMode as WorkspaceEraserMode | undefined
    const eraserWidth = Number.isFinite(Number(obj.eraserWidth)) ? Number(obj.eraserWidth) : undefined
    const colorsByToolRaw = obj.colorsByTool
    const colorsByTool: Partial<Record<WorkspaceTool, string>> | undefined =
      colorsByToolRaw && typeof colorsByToolRaw === "object" && !Array.isArray(colorsByToolRaw)
        ? Object.fromEntries(
            Object.entries(colorsByToolRaw as Record<string, unknown>).flatMap(([key, val]) => {
              if (typeof val !== "string" || !val.trim()) return []
              const t = key as WorkspaceTool
              return VALID_WORKSPACE_TOOLS.includes(t) && workspaceToolUsesColor(t)
                ? [[t, val.trim()] as const]
                : []
            }),
          )
        : undefined
    const resolvedTool =
      tool && VALID_WORKSPACE_TOOLS.includes(tool) && tool !== "image" ? tool : "pen"
    return {
      version: 1,
      pages: pages.slice(0, WORKSPACE_MAX_PAGES),
      activePageIndex,
      tool: resolvedTool,
      color,
      ...(colorsByTool && Object.keys(colorsByTool).length > 0 ? { colorsByTool } : {}),
      width,
      paperPattern:
        paperPattern && VALID_PAPER_PATTERNS.includes(paperPattern) ? paperPattern : "ruled",
      paperSize:
        paperSize && VALID_PAPER_SIZE_IDS.has(paperSize) ? paperSize : DEFAULT_WORKSPACE_PAPER_SIZE_ID,
      eraserMode:
        eraserMode && VALID_ERASER_MODES.includes(eraserMode) ? eraserMode : "pixel",
      eraserWidth: eraserWidth ?? WORKSPACE_ERASER_WIDTHS[1].value,
    }
  } catch {
    return null
  }
}

export function workspaceHasContent(ws: CircuitWorkspace | null | undefined): boolean {
  if (!ws) return false
  return ws.pages.some((p) => p.strokes.length > 0)
}

export function workspaceStrokeCount(ws: CircuitWorkspace | null | undefined): number {
  if (!ws) return 0
  return ws.pages.reduce((sum, p) => sum + p.strokes.length, 0)
}

export function workspacePagesWithContent(ws: CircuitWorkspace): WorkspacePage[] {
  return ws.pages.filter((p) => p.strokes.length > 0)
}

export function workspaceExportPartKey(index: number): string {
  return index === 0 ? "w0" : `w${index}`
}
