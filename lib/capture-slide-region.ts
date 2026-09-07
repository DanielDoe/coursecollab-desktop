/** Capture a slide region for AI multimodal input (PDF.js via CDN). */

import {
  fetchLecturePdfDocumentForStudent,
  type LecturePdfDocument,
} from "@/lib/lecture-pdf-document"

export type SlideRegion = { x: number; y: number; width: number; height: number }

export type SlideCaptureContext = {
  lectureId: number
  studentRosterId: string
  slideNumber: number
}

export type SlideCaptureResult =
  | { ok: true; dataUrl: string }
  | { ok: false; reason: "too_small" | "blank" | "failed" }

async function loadLecturePdfDocument(ctx: SlideCaptureContext): Promise<LecturePdfDocument> {
  return fetchLecturePdfDocumentForStudent(ctx.lectureId, ctx.studentRosterId)
}

async function renderPdfPageToDataUrl(
  ctx: SlideCaptureContext,
  viewportWidth: number,
): Promise<{ dataUrl: string | null; slideText: string | null }> {
  const pdf = await loadLecturePdfDocument(ctx)
  const pageIndex = Math.min(Math.max(1, ctx.slideNumber), pdf.numPages)
  const page = await pdf.getPage(pageIndex)

  const textContent = await page.getTextContent()
  const slideText =
    textContent.items
      .map((item) => ("str" in item ? String(item.str) : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12_000) || null

  const baseViewport = page.getViewport({ scale: 1 })
  const scale = Math.min(
    2.5,
    (viewportWidth / baseViewport.width) * Math.min(window.devicePixelRatio || 1, 2),
  )
  const renderViewport = page.getViewport({ scale })

  const canvas = document.createElement("canvas")
  canvas.width = Math.floor(renderViewport.width)
  canvas.height = Math.floor(renderViewport.height)
  const canvasCtx = canvas.getContext("2d")
  if (!canvasCtx || canvas.width < 1 || canvas.height < 1) {
    return { dataUrl: null, slideText }
  }

  await page.render({
    canvas,
    canvasContext: canvasCtx,
    viewport: renderViewport,
  }).promise

  return { dataUrl: canvas.toDataURL("image/jpeg", 0.9), slideText }
}

function canvasHasVisibleContent(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d")
  if (!ctx || canvas.width < 8 || canvas.height < 8) return false

  const points: Array<[number, number]> = [
    [0.15, 0.15],
    [0.5, 0.15],
    [0.85, 0.15],
    [0.15, 0.5],
    [0.5, 0.5],
    [0.85, 0.5],
    [0.15, 0.85],
    [0.5, 0.85],
    [0.85, 0.85],
  ]
  const patch = 28

  for (const [fx, fy] of points) {
    const x = Math.min(Math.floor(canvas.width * fx), Math.max(0, canvas.width - patch))
    const y = Math.min(Math.floor(canvas.height * fy), Math.max(0, canvas.height - patch))
    const w = Math.min(patch, canvas.width - x)
    const h = Math.min(patch, canvas.height - y)
    if (w < 4 || h < 4) continue

    const data = ctx.getImageData(x, y, w, h).data
    for (let i = 0; i < data.length; i += 4) {
      if (data[i]! < 245 || data[i + 1]! < 245 || data[i + 2]! < 245) return true
    }
  }
  return false
}

async function captureRegionFromDom(
  element: HTMLElement,
  region: SlideRegion,
): Promise<string | null> {
  if (region.width < 8 || region.height < 8) return null

  try {
    const { toCanvas } = await import("html-to-image")
    const canvas = await toCanvas(element, {
      cacheBust: true,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    })

    const scaleX = canvas.width / element.offsetWidth
    const scaleY = canvas.height / element.offsetHeight
    const sx = Math.max(0, Math.floor(region.x * scaleX))
    const sy = Math.max(0, Math.floor(region.y * scaleY))
    const sw = Math.min(canvas.width - sx, Math.floor(region.width * scaleX))
    const sh = Math.min(canvas.height - sy, Math.floor(region.height * scaleY))
    if (sw < 8 || sh < 8) return null

    const crop = document.createElement("canvas")
    crop.width = sw
    crop.height = sh
    const ctx = crop.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)
    if (!canvasHasVisibleContent(crop)) return null
    return crop.toDataURL("image/jpeg", 0.88)
  } catch (err) {
    console.warn("[captureRegionFromDom]", err)
    return null
  }
}

async function captureRegionFromPdfPage(
  ctx: SlideCaptureContext,
  region: SlideRegion,
  viewport: { width: number; height: number },
): Promise<string | null> {
  if (region.width < 8 || region.height < 8 || viewport.width < 8 || viewport.height < 8) {
    return null
  }

  try {
    const pdf = await loadLecturePdfDocument(ctx)
    const pageIndex = Math.min(Math.max(1, ctx.slideNumber), pdf.numPages)
    const page = await pdf.getPage(pageIndex)

    const baseViewport = page.getViewport({ scale: 1 })
    const scale = viewport.width / baseViewport.width
    const renderViewport = page.getViewport({ scale })

    const full = document.createElement("canvas")
    full.width = Math.floor(renderViewport.width)
    full.height = Math.floor(renderViewport.height)
    const fullCtx = full.getContext("2d")
    if (!fullCtx) return null

    await page.render({ canvas: full, canvasContext: fullCtx, viewport: renderViewport }).promise

    const scaleX = full.width / viewport.width
    const scaleY = full.height / viewport.height
    const sx = Math.max(0, Math.floor(region.x * scaleX))
    const sy = Math.max(0, Math.floor(region.y * scaleY))
    const sw = Math.min(full.width - sx, Math.floor(region.width * scaleX))
    const sh = Math.min(full.height - sy, Math.floor(region.height * scaleY))
    if (sw < 8 || sh < 8) return null

    const crop = document.createElement("canvas")
    crop.width = sw
    crop.height = sh
    const cropCtx = crop.getContext("2d")
    if (!cropCtx) return null
    cropCtx.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh)
    return crop.toDataURL("image/jpeg", 0.88)
  } catch (err) {
    console.warn("[captureRegionFromPdfPage]", err)
    return null
  }
}

export async function captureSlideRegion(
  element: HTMLElement,
  region: SlideRegion,
  ctx: SlideCaptureContext,
): Promise<SlideCaptureResult> {
  if (region.width < 8 || region.height < 8) {
    return { ok: false, reason: "too_small" }
  }

  const domCapture = await captureRegionFromDom(element, region)
  if (domCapture) return { ok: true, dataUrl: domCapture }

  const pdfCapture = await captureRegionFromPdfPage(ctx, region, {
    width: element.offsetWidth,
    height: element.offsetHeight,
  })
  if (pdfCapture) return { ok: true, dataUrl: pdfCapture }

  return { ok: false, reason: "blank" }
}

/** Render full PDF page + extract text for AI slide actions (explain / summarize). */
export async function captureFullSlideForAi(
  element: HTMLElement | null,
  ctx: SlideCaptureContext,
): Promise<{ dataUrl: string | null; slideText: string | null }> {
  const viewportWidth =
    element?.offsetWidth && element.offsetWidth > 100 ? element.offsetWidth : 960

  try {
    return await renderPdfPageToDataUrl(ctx, viewportWidth)
  } catch (err) {
    console.warn("[captureFullSlideForAi] pdf.js render failed:", err)
  }

  if (element && element.offsetWidth > 8 && element.offsetHeight > 8) {
    const result = await captureSlideRegion(
      element,
      { x: 0, y: 0, width: element.offsetWidth, height: element.offsetHeight },
      ctx,
    )
    if (result.ok) return { dataUrl: result.dataUrl, slideText: null }
  }

  return { dataUrl: null, slideText: null }
}

const SLIDE_CONTEXT_ACTIONS = new Set(["explain_slide", "summarize_slide", "explain_selection"])

export function actionNeedsSlideCapture(action: string, conversationLength = 0): boolean {
  if (SLIDE_CONTEXT_ACTIONS.has(action)) return true
  if (action === "custom") return conversationLength === 0
  return false
}
