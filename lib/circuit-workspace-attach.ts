import { loadPdfJsBrowser } from "@/lib/pdfjs-browser-loader"

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function renderPdfBytesToDataUrl(data: ArrayBuffer, scale = 1.5): Promise<string> {
  const pdfjs = await loadPdfJsBrowser()
  const doc = await pdfjs.getDocument({ data }).promise
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement("canvas")
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas unavailable")
  await page.render({ canvas, canvasContext: ctx, viewport }).promise
  return canvas.toDataURL("image/png")
}

export async function workspaceAttachFileToDataUrl(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf")
  if (isPdf) {
    return renderPdfBytesToDataUrl(await file.arrayBuffer())
  }
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif|bmp|svg)$/i.test(name)) {
    return readBlobAsDataUrl(file)
  }
  throw new Error("Choose an image or PDF file")
}

export async function workspaceAttachUrlToDataUrl(rawUrl: string): Promise<string> {
  const url = rawUrl.trim()
  if (!url) throw new Error("Enter a link")
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error("Invalid link")
  }
  if (!["http:", "https:", "data:"].includes(parsed.protocol)) {
    throw new Error("Link must use http, https, or data")
  }

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load link (${res.status})`)

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase()
  const pathLower = parsed.pathname.toLowerCase()

  if (contentType.includes("pdf") || pathLower.endsWith(".pdf")) {
    return renderPdfBytesToDataUrl(await res.arrayBuffer())
  }

  const blob = await res.blob()
  if (blob.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif|bmp|svg)$/i.test(pathLower)) {
    return readBlobAsDataUrl(blob)
  }

  throw new Error("Link must point to an image or PDF")
}
