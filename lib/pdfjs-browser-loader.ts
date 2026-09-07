/** Load pdf.js in the browser via CDN — avoids Next.js webpack/pdfjs-dist bundling failures. */

const PDFJS_VERSION = "5.4.296"
const PDFJS_CDN_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}`
/** Must match worker build — mixing `+esm` main with `/public/pdf.worker.min.mjs` breaks render (blank slides). */
const PDFJS_MODULE_URL = `${PDFJS_CDN_BASE}/build/pdf.min.mjs`
const PDFJS_WORKER_URL = `${PDFJS_CDN_BASE}/build/pdf.worker.min.mjs`

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

export async function loadPdfJsBrowser(): Promise<PdfJsBrowserModule> {
  if (typeof window === "undefined") {
    throw new Error("loadPdfJsBrowser is client-only")
  }
  if (!pdfjsPromise) {
    pdfjsPromise = import(/* webpackIgnore: true */ PDFJS_MODULE_URL).then((mod) => {
      const pdfjs = mod as PdfJsBrowserModule
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL
      return pdfjs
    })
  }
  return pdfjsPromise
}
