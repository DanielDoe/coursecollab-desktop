/** Load pdf.js for browser/Electron lecture viewers. */

export type PdfJsBrowserModule = {
  getDocument: (src: unknown) => { promise: Promise<PdfDocument> }
  GlobalWorkerOptions: { workerSrc: string }
  version: string
}

type PdfDocument = {
  numPages: number
  getPage: (n: number) => Promise<PdfPage>
}

type PdfPage = {
  getViewport: (opts: { scale: number }) => { width: number; height: number }
  getTextContent: () => Promise<{ items: Array<{ str?: string }> }>
  render: (opts: {
    canvas: HTMLCanvasElement
    canvasContext: CanvasRenderingContext2D
    viewport: { width: number; height: number }
  }) => { promise: Promise<void> }
}

let pdfjsPromise: Promise<PdfJsBrowserModule> | null = null

/**
 * Prefer the local `pdfjs-dist` package (works offline / in Electron).
 * Fall back to jsDelivr only if the local import fails (e.g. Next webpack quirks).
 */
export async function loadPdfJsBrowser(): Promise<PdfJsBrowserModule> {
  if (typeof window === "undefined") {
    throw new Error("loadPdfJsBrowser is client-only")
  }
  if (!pdfjsPromise) {
    pdfjsPromise = loadLocalPdfJs().catch((localError) => {
      console.warn("[pdfjs] local load failed, falling back to CDN", localError)
      return loadCdnPdfJs()
    })
  }
  return pdfjsPromise
}

async function loadLocalPdfJs(): Promise<PdfJsBrowserModule> {
  const pdfjs = (await import("pdfjs-dist")) as unknown as PdfJsBrowserModule
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
  const workerSrc = typeof worker === "string" ? worker : (worker as { default: string }).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
  return pdfjs
}

async function loadCdnPdfJs(): Promise<PdfJsBrowserModule> {
  // Keep CDN version aligned with package.json dependency when possible.
  const version = "5.7.284"
  const base = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}`
  const moduleUrl = `${base}/build/pdf.min.mjs`
  const workerUrl = `${base}/build/pdf.worker.min.mjs`
  const mod = await import(/* @vite-ignore */ /* webpackIgnore: true */ moduleUrl)
  const pdfjs = mod as PdfJsBrowserModule
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  return pdfjs
}
