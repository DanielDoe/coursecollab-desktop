export type ChartExportRow = { name: string; value: number | string | null }

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function chartDataToCsv(rows: ChartExportRow[], valueHeader = "value"): string {
  const header = ["name", valueHeader].map(escapeCsvCell).join(",")
  const body = rows
    .map((row) => [row.name, row.value == null ? "" : String(row.value)].map(escapeCsvCell).join(","))
    .join("\n")
  return `${header}\n${body}\n`
}

/** Trigger a browser download of chart series as CSV. */
export function downloadChartCsv(filename: string, rows: ChartExportRow[], valueHeader = "value"): void {
  if (typeof window === "undefined" || rows.length === 0) return
  const csv = chartDataToCsv(rows, valueHeader)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function namedCountsToExportRows(
  data: Array<{ name?: string; key?: string; value?: number | null }>,
): ChartExportRow[] {
  return data.map((row) => ({
    name: row.name ?? row.key ?? "—",
    value: row.value ?? null,
  }))
}

/** Export the first SVG inside a chart container as PNG (publication snapshots). */
export async function downloadChartPng(container: HTMLElement | null, filename: string): Promise<void> {
  if (typeof window === "undefined" || !container) return
  const svg = container.querySelector("svg")
  if (!svg) return

  const clone = svg.cloneNode(true) as SVGSVGElement
  const bbox = svg.getBoundingClientRect()
  const width = Math.max(640, Math.round(bbox.width || 640))
  const height = Math.max(320, Math.round(bbox.height || 320))
  clone.setAttribute("width", String(width))
  clone.setAttribute("height", String(height))
  if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")

  const svgData = new XMLSerializer().serializeToString(clone)
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" })
  const url = URL.createObjectURL(svgBlob)

  await new Promise<void>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = width * 2
      canvas.height = height * 2
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error("Canvas unavailable"))
        return
      }
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(2, 2)
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("PNG export failed"))
          return
        }
        const anchor = document.createElement("a")
        anchor.href = URL.createObjectURL(blob)
        anchor.download = filename.endsWith(".png") ? filename : `${filename}.png`
        anchor.click()
        resolve()
      }, "image/png")
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("SVG render failed"))
    }
    img.src = url
  }).catch(() => undefined)
}
