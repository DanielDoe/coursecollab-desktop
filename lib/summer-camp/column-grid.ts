/** Column / grid layout for camp module blocks. */

import { defaultImageTransform, normalizeImageTransform, type ImageTransform } from "@/lib/summer-camp/image-layout"

export type ColumnGridCellType = "text" | "image"

export type ColumnGridCell = {
  id: string
  type: ColumnGridCellType
  markdown?: string
  imageUrl?: string
  caption?: string
  alt?: string
  /** Image width within its column (25–100). */
  imageWidthPercent?: number
  imageTransform?: ImageTransform
}

export type ColumnGridColumn = {
  id: string
  /** Share of row width; columns in a row should sum to ~1. */
  widthFraction: number
  cells: ColumnGridCell[]
}

export type ColumnGridRow = {
  id: string
  columns: ColumnGridColumn[]
}

export type ColumnGridContent = {
  rows: ColumnGridRow[]
  /** Gap between columns in px (8–48). */
  gap?: number
  /** Gap between rows in px (8–64). */
  rowGap?: number
}

export function newColumnGridId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

export function defaultTextImageColumnPair(): ColumnGridColumn[] {
  return [
    {
      id: newColumnGridId("col"),
      widthFraction: 0.58,
      cells: [
        {
          id: newColumnGridId("cell"),
          type: "text",
          markdown:
            "### Subsection Title\n\nExplain the concept in one or two sentences.\n\n- Bullet point\n- Bullet point",
        },
      ],
    },
    {
      id: newColumnGridId("col"),
      widthFraction: 0.42,
      cells: [
        {
          id: newColumnGridId("cell"),
          type: "image",
          imageUrl: "",
          caption: "",
          alt: "Supporting visual",
          imageWidthPercent: 100,
          imageTransform: defaultImageTransform("free"),
        },
      ],
    },
  ]
}

export function defaultColumnGridContent(): ColumnGridContent {
  return {
    gap: 20,
    rowGap: 24,
    rows: [{ id: newColumnGridId("row"), columns: defaultTextImageColumnPair() }],
  }
}

function normalizeColumn(c: Record<string, unknown>, colIndex: number): ColumnGridColumn {
  const cellsRaw = Array.isArray(c.cells) ? c.cells : []
  const cells: ColumnGridCell[] = cellsRaw.map((cell, j) => {
    const cellObj = cell as Record<string, unknown>
    const type = cellObj.type === "image" ? "image" : "text"
    return {
      id: String(cellObj.id ?? `cell-${colIndex}-${j}`),
      type,
      markdown: type === "text" ? String(cellObj.markdown ?? "") : undefined,
      imageUrl: type === "image" ? String(cellObj.imageUrl ?? "") : undefined,
      caption: type === "image" ? String(cellObj.caption ?? "") : undefined,
      alt: type === "image" ? String(cellObj.alt ?? "") : undefined,
      imageWidthPercent:
        type === "image" ? clampNumber(Number(cellObj.imageWidthPercent) || 100, 25, 100) : undefined,
      imageTransform:
        type === "image"
          ? normalizeImageTransform(
              (cellObj.imageTransform as ImageTransform | undefined) ?? defaultImageTransform("columns"),
            )
          : undefined,
    }
  })
  return {
    id: String(c.id ?? `col-${colIndex}`),
    widthFraction: clampNumber(Number(c.widthFraction) || 0.5, 0.12, 0.88),
    cells: cells.length > 0 ? cells : [{ id: newColumnGridId("cell"), type: "text", markdown: "" }],
  }
}

function normalizeRowColumns(columns: ColumnGridColumn[]): ColumnGridColumn[] {
  if (columns.length === 0) return defaultTextImageColumnPair()
  const sum = columns.reduce((s, c) => s + c.widthFraction, 0) || 1
  return columns.map((c) => ({ ...c, widthFraction: c.widthFraction / sum }))
}

export function normalizeColumnGridContent(raw: Record<string, unknown>): ColumnGridContent {
  const gap = clampNumber(Number(raw.gap) || 20, 8, 48)
  const rowGap = clampNumber(Number(raw.rowGap) || 24, 8, 64)

  let rows: ColumnGridRow[] = []

  if (Array.isArray(raw.rows) && raw.rows.length > 0) {
    rows = (raw.rows as Record<string, unknown>[]).map((row, rowIndex) => {
      const colsRaw = Array.isArray(row.columns) ? row.columns : []
      const columns = normalizeRowColumns(
        colsRaw.map((col, i) => normalizeColumn(col as Record<string, unknown>, i)),
      )
      return { id: String(row.id ?? `row-${rowIndex}`), columns }
    })
  } else if (Array.isArray(raw.columns) && raw.columns.length > 0) {
    rows = [
      {
        id: newColumnGridId("row"),
        columns: normalizeRowColumns(
          (raw.columns as Record<string, unknown>[]).map((col, i) =>
            normalizeColumn(col, i),
          ),
        ),
      },
    ]
  } else {
    rows = defaultColumnGridContent().rows
  }

  return { gap, rowGap, rows }
}

/** Legacy single-row accessor for callers that only use one row. */
export function columnGridFirstRow(content: ColumnGridContent): ColumnGridColumn[] {
  return content.rows[0]?.columns ?? defaultTextImageColumnPair()
}

export function clampNumber(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

export function resizeColumnPairInRow(
  content: ColumnGridContent,
  rowIndex: number,
  leftIndex: number,
  leftFraction: number,
): ColumnGridContent {
  const rows = content.rows.map((row, ri) => {
    if (ri !== rowIndex) return row
    const columns = [...row.columns]
    if (leftIndex < 0 || leftIndex >= columns.length - 1) return row

    const min = 0.12
    const pairSum = columns[leftIndex].widthFraction + columns[leftIndex + 1].widthFraction
    const left = clampNumber(leftFraction, min, pairSum - min)
    const right = pairSum - left

    columns[leftIndex] = { ...columns[leftIndex], widthFraction: left }
    columns[leftIndex + 1] = { ...columns[leftIndex + 1], widthFraction: right }
    return { ...row, columns }
  })
  return { ...content, rows }
}

export function addGridRow(content: ColumnGridContent): ColumnGridContent {
  if (content.rows.length >= 6) return content
  return {
    ...content,
    rows: [
      ...content.rows,
      { id: newColumnGridId("row"), columns: defaultTextImageColumnPair() },
    ],
  }
}

export function removeGridRow(content: ColumnGridContent, rowIndex: number): ColumnGridContent {
  if (content.rows.length <= 1) return content
  return { ...content, rows: content.rows.filter((_, i) => i !== rowIndex) }
}

export function addColumnToRow(content: ColumnGridContent, rowIndex: number): ColumnGridContent {
  const rows = content.rows.map((row, ri) => {
    if (ri !== rowIndex || row.columns.length >= 4) return row
    const n = row.columns.length + 1
    const fraction = 1 / n
    const columns = row.columns.map((c) => ({ ...c, widthFraction: fraction }))
    columns.push({
      id: newColumnGridId("col"),
      widthFraction: fraction,
      cells: [{ id: newColumnGridId("cell"), type: "text", markdown: "" }],
    })
    return { ...row, columns }
  })
  return { ...content, rows }
}

export function removeColumnFromRow(
  content: ColumnGridContent,
  rowIndex: number,
  colIndex: number,
): ColumnGridContent {
  const rows = content.rows.map((row, ri) => {
    if (ri !== rowIndex || row.columns.length <= 1) return row
    const columns = row.columns.filter((_, i) => i !== colIndex)
    const sum = columns.reduce((s, c) => s + c.widthFraction, 0) || 1
    return { ...row, columns: columns.map((c) => ({ ...c, widthFraction: c.widthFraction / sum })) }
  })
  return { ...content, rows }
}
