import { loadPdfJsBrowser } from "@/lib/pdfjs-browser-loader"

export type LecturePdfDocument = {
  numPages: number
  getPage: (pageNumber: number) => Promise<LecturePdfPage>
}

export type LecturePdfPage = {
  getViewport: (opts: { scale: number }) => { width: number; height: number }
  getTextContent: () => Promise<{ items: Array<{ str?: string }> }>
  render: (opts: {
    canvas: HTMLCanvasElement
    canvasContext: CanvasRenderingContext2D
    viewport: { width: number; height: number }
  }) => { promise: Promise<void>; cancel?: () => void }
}

export async function fetchLecturePdfDocument(
  url: string,
  options?: { headers?: Record<string, string> },
): Promise<LecturePdfDocument> {
  const pdfjs = await loadPdfJsBrowser()
  const res = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    headers: options?.headers,
  })
  const contentType = res.headers.get("content-type") ?? ""
  if (!res.ok) {
    let message = `PDF fetch failed (${res.status})`
    if (contentType.includes("json")) {
      try {
        const body = (await res.json()) as { error?: string }
        if (body.error?.trim()) message = body.error.trim()
      } catch {
        /* ignore parse errors */
      }
    }
    throw new Error(message)
  }
  if (!contentType.includes("pdf")) {
    let detail = contentType || "unknown type"
    if (contentType.includes("json")) {
      try {
        const body = (await res.json()) as { error?: string }
        if (body.error?.trim()) detail = body.error.trim()
      } catch {
        /* ignore parse errors */
      }
    }
    throw new Error(
      detail === "Forbidden"
        ? "You don’t have access to this PDF for the selected course."
        : `PDF fetch returned ${detail}`,
    )
  }
  const data = await res.arrayBuffer()
  return pdfjs.getDocument({ data }).promise as Promise<LecturePdfDocument>
}

export async function fetchLecturePdfDocumentForStudent(
  lectureId: number,
  studentRosterId: string,
): Promise<LecturePdfDocument> {
  const url = `/api/pdf-proxy/${lectureId}?studentId=${encodeURIComponent(studentRosterId)}`
  return fetchLecturePdfDocument(url)
}
