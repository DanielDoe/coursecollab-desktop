/**
 * Server-side workspace page PNG export (@napi-rs/canvas).
 * Used for grading recovery when workspace ink was saved but PNG export never ran.
 */

import {
  getWorkspacePaperDimensions,
  workspaceExportPartKey,
  workspacePagesWithContent,
  WORKSPACE_CANVAS_HEIGHT,
  WORKSPACE_CANVAS_WIDTH,
  WORKSPACE_EXPORT_SCALE,
  type CircuitWorkspace,
  type WorkspacePage,
} from "@/lib/circuit-workspace"
import {
  clearServerWorkspaceImages,
  registerServerWorkspaceImage,
  renderWorkspacePage,
} from "@/lib/circuit-workspace-render"
import type { SolutionUploadsMap } from "@/lib/solution-upload"
import { saveQuizSolutionFile } from "@/lib/quiz-solution-storage"

async function ensureServerWorkspaceImagesLoaded(
  page: WorkspacePage,
  loadImage: (src: string) => Promise<{ width: number; height: number }>,
): Promise<void> {
  for (const stroke of page.strokes) {
    if (stroke.tool !== "image" || !stroke.imageDataUrl) continue
    if (!stroke.imageDataUrl.startsWith("data:")) continue
    try {
      const img = await loadImage(stroke.imageDataUrl)
      registerServerWorkspaceImage(stroke.imageDataUrl, img as unknown as CanvasImageSource)
    } catch {
      /* skip broken image strokes */
    }
  }
}

export async function workspacePageToPngBuffer(
  page: WorkspacePage,
  options?: {
    pageIndex?: number
    totalPages?: number
    title?: string
    paperPattern?: CircuitWorkspace["paperPattern"]
    width?: number
    height?: number
  },
): Promise<Buffer> {
  const { createCanvas, loadImage } = await import("@napi-rs/canvas")
  clearServerWorkspaceImages()
  await ensureServerWorkspaceImagesLoaded(page, loadImage)

  const logicalW = options?.width ?? WORKSPACE_CANVAS_WIDTH
  const logicalH = options?.height ?? WORKSPACE_CANVAS_HEIGHT
  const scale = WORKSPACE_EXPORT_SCALE
  const canvas = createCanvas(logicalW * scale, logicalH * scale)
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not create workspace export canvas")

  const pageNum = (options?.pageIndex ?? 0) + 1
  const total = options?.totalPages ?? 1
  const label = options?.title
    ? `${options.title} — Page ${pageNum} of ${total}`
    : `Worked solution — Page ${pageNum} of ${total}`

  renderWorkspacePage(ctx as unknown as CanvasRenderingContext2D, page, {
    theme: "export",
    scale,
    exportLabel: label,
    paperPattern: options?.paperPattern ?? "ruled",
    width: logicalW,
    height: logicalH,
    directInk: true,
  })

  clearServerWorkspaceImages()
  return canvas.toBuffer("image/jpeg", 78)
}

export async function exportCircuitWorkspaceUploadsServer(params: {
  workspace: CircuitWorkspace
  attemptId: number
  questionId: number
  studentDatabaseId: number
  title?: string
}): Promise<SolutionUploadsMap> {
  const pages = workspacePagesWithContent(params.workspace)
  if (pages.length === 0) return {}

  const paper = getWorkspacePaperDimensions(params.workspace)
  const uploads: SolutionUploadsMap = {}

  for (let i = 0; i < pages.length; i++) {
    const jpeg = await workspacePageToPngBuffer(pages[i], {
      pageIndex: i,
      totalPages: pages.length,
      title: params.title,
      paperPattern: params.workspace.paperPattern ?? "ruled",
      width: paper.width,
      height: paper.height,
    })
    const partKey = workspaceExportPartKey(i)
    const file = new File([jpeg], `workspace-page-${i + 1}.jpg`, { type: "image/jpeg" })
    const att = await saveQuizSolutionFile(
      params.studentDatabaseId,
      params.attemptId,
      params.questionId,
      partKey,
      file,
    )
    uploads[partKey] = {
      ...att,
      uploaded_at: new Date().toISOString(),
    }
  }

  return uploads
}
