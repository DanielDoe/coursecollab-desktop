/**
 * Client helpers for instructor Trade Center PDF downloads.
 */

export type TradeCenterPdfReport = "analytics" | "trade-log" | "rollovers" | "donations"

export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim())
    } catch {
      return star[1].trim()
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(header)
  if (quoted?.[1]) return quoted[1].trim()
  const bare = /filename=([^;\s]+)/i.exec(header)
  return bare?.[1]?.replace(/^["']|["']$/g, "").trim() ?? null
}

export function tradeCenterExportUrl(
  report: TradeCenterPdfReport,
  opts?: { session?: string; search?: string },
): string {
  const params = new URLSearchParams()
  params.set("report", report)
  const sess = opts?.session?.trim()
  if (sess) params.set("session", sess)
  const q = opts?.search?.trim()
  if (q) params.set("search", q)
  return `/api/trade-center/export?${params}`
}

/** Returns the downloaded filename (for toasts). */
export async function downloadTradeCenterPdf(
  report: TradeCenterPdfReport,
  headers: HeadersInit,
  opts?: { session?: string; search?: string },
  fallbackName?: string,
): Promise<string> {
  const url = tradeCenterExportUrl(report, opts)
  const response = await fetch(url, { headers })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || (err as { details?: string }).details || "Export failed")
  }
  const blob = await response.blob()
  const blobUrl = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  const fromHeader = filenameFromContentDisposition(response.headers.get("content-disposition"))
  const fileName =
    fromHeader && /\.pdf$/i.test(fromHeader)
      ? fromHeader
      : fallbackName || `trade-center-${report}-${Date.now()}.pdf`
  a.href = blobUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(blobUrl)
  document.body.removeChild(a)
  return fileName
}
