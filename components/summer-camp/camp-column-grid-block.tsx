"use client"

import { useCallback, useRef } from "react"
import { GripVertical, ImageIcon, LayoutGrid, Plus, Trash2, Type } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CampRichMarkdown } from "@/components/summer-camp/CampRichMarkdown"
import { CampModernSurface } from "@/components/summer-camp/camp-modern-blocks"
import { useCampPresentation } from "@/components/summer-camp/camp-presentation-context"
import { cn } from "@/lib/utils"
import { CampZoomableImage } from "@/components/summer-camp/CampZoomableImage"
import { CampPositionableImage } from "@/components/summer-camp/camp-positionable-image"
import { defaultImageTransform, imageCellTransform } from "@/lib/summer-camp/image-layout"
import {
  CampImageUploadField,
  CampMarkdownToolbar,
} from "@/components/summer-camp/camp-content-editor-tools"
import {
  addColumnToRow,
  addGridRow,
  clampNumber,
  newColumnGridId,
  normalizeColumnGridContent,
  removeColumnFromRow,
  removeGridRow,
  resizeColumnPairInRow,
  type ColumnGridCell,
  type ColumnGridColumn,
  type ColumnGridContent,
  type ColumnGridRow,
} from "@/lib/summer-camp/column-grid"

type Props = {
  content: Record<string, unknown>
  readOnly?: boolean
  layoutEditable?: boolean
  trainingId?: number
  onChange?: (next: ColumnGridContent) => void
}

function ColumnGridCellView({
  cell,
  editable,
  onImageTransformChange,
  containerRef,
}: {
  cell: ColumnGridCell
  editable?: boolean
  onImageTransformChange?: (patch: Partial<ColumnGridCell>) => void
  containerRef?: React.RefObject<HTMLElement | null>
}) {
  const inPresentation = useCampPresentation()
  if (cell.type === "image") {
    const fillColumn = (cell.imageWidthPercent ?? 100) >= 90 && !editable
    if (fillColumn) {
      return (
        <CampModernSurface padding="compact" className="h-full flex flex-col min-h-[260px] lg:min-h-[320px]">
          <div
            className={cn(
              "flex-1 flex items-center justify-center rounded-xl p-4 ring-1 min-h-[220px]",
              inPresentation
                ? "bg-slate-50 ring-slate-200/60"
                : "bg-white dark:bg-slate-900 ring-slate-200/60 dark:ring-white/10",
            )}
          >
            <CampZoomableImage
              src={cell.imageUrl ?? ""}
              alt={cell.alt ?? cell.caption ?? "Module illustration"}
              className="w-full flex justify-center"
              imgClassName="max-h-[340px] w-full object-contain"
            />
          </div>
          {cell.caption?.trim() ? (
            <p
              className={cn(
                "mt-3 text-sm font-medium leading-relaxed",
                inPresentation ? "text-slate-700" : "text-slate-700 dark:text-slate-200",
              )}
            >
              {cell.caption}
            </p>
          ) : null}
        </CampModernSurface>
      )
    }

    const transform = imageCellTransform(cell as unknown as Record<string, unknown>)
    return (
      <div className="h-full flex flex-col min-h-[200px] lg:min-h-[280px]">
        <CampModernSurface padding="none" className="flex-1 flex flex-col overflow-hidden">
          <CampPositionableImage
            containerRef={containerRef}
            imageUrl={cell.imageUrl}
            caption={cell.caption}
            alt={cell.alt}
            transform={{
              ...transform,
              widthPercent: transform.widthPercent ?? cell.imageWidthPercent ?? 100,
            }}
            editable={editable}
            onTransformChange={
              onImageTransformChange
                ? (patch) =>
                    onImageTransformChange({
                      imageTransform: { ...transform, ...patch },
                      imageWidthPercent: patch.widthPercent ?? cell.imageWidthPercent,
                    })
                : undefined
            }
          />
        </CampModernSurface>
      </div>
    )
  }

  return (
    <CampModernSurface className="h-full">
      <CampRichMarkdown markdown={cell.markdown ?? ""} collapsibleSections={false} />
    </CampModernSurface>
  )
}

function ColumnGridRowView({
  row,
  gap,
  rowIndex = 0,
  layoutEditable,
  onPatchImageCell,
}: {
  row: ColumnGridRow
  gap: number
  rowIndex?: number
  layoutEditable?: boolean
  onPatchImageCell?: (colIndex: number, cellIndex: number, patch: Partial<ColumnGridCell>) => void
}) {
  return (
    <div
      className="flex flex-col md:flex-row w-full min-w-0 items-stretch"
      style={{ gap: `${gap}px` }}
    >
      {row.columns.map((col, colIndex) => (
        <ColumnGridColumnView
          key={col.id}
          col={col}
          colIndex={colIndex}
          layoutEditable={layoutEditable}
          onPatchImageCell={
            onPatchImageCell ? (cellIndex, patch) => onPatchImageCell(colIndex, cellIndex, patch) : undefined
          }
        />
      ))}
    </div>
  )
}

function ColumnGridColumnView({
  col,
  colIndex: _colIndex,
  layoutEditable,
  onPatchImageCell,
}: {
  col: ColumnGridColumn
  colIndex: number
  layoutEditable?: boolean
  onPatchImageCell?: (cellIndex: number, patch: Partial<ColumnGridCell>) => void
}) {
  const columnRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={columnRef}
      className="relative min-w-0 w-full md:w-auto space-y-4 min-h-[120px]"
      style={{ flex: `${col.widthFraction} 1 0%` }}
    >
      {col.cells.map((cell, cellIndex) => (
        <ColumnGridCellView
          key={cell.id}
          cell={cell}
          containerRef={columnRef}
          editable={layoutEditable && cell.type === "image"}
          onImageTransformChange={
            onPatchImageCell ? (patch) => onPatchImageCell(cellIndex, patch) : undefined
          }
        />
      ))}
    </div>
  )
}

function ColumnResizeHandle({ onDrag }: { onDrag: (deltaFraction: number) => void }) {
  const dragging = useRef(false)
  const startX = useRef(0)

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Drag to resize columns"
      onPointerDown={(e) => {
        dragging.current = true
        startX.current = e.clientX
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return
        const container = (e.currentTarget as HTMLElement).closest("[data-column-grid-row]")
        const width = container?.getBoundingClientRect().width ?? 800
        const deltaPx = e.clientX - startX.current
        startX.current = e.clientX
        onDrag(deltaPx / width)
      }}
      onPointerUp={(e) => {
        dragging.current = false
        try {
          ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
      }}
      onPointerCancel={() => {
        dragging.current = false
      }}
      className="hidden md:flex group relative z-10 w-3 shrink-0 cursor-col-resize items-center justify-center touch-none self-stretch"
    >
      <div className="absolute inset-y-2 w-px bg-violet-400/40 group-hover:bg-violet-500 group-active:bg-violet-600 transition-colors" />
      <GripVertical className="relative h-4 w-4 text-violet-400/70 group-hover:text-violet-600" />
    </div>
  )
}

function ImageCellEditor({
  cell,
  trainingId,
  onChange,
}: {
  cell: ColumnGridCell
  trainingId: number
  onChange: (patch: Partial<ColumnGridCell>) => void
}) {
  return (
    <>
      <CampImageUploadField
        trainingId={trainingId}
        label="Image"
        value={cell.imageUrl ?? ""}
        onChange={(url) => onChange({ imageUrl: url })}
      />
      <Input
        value={cell.caption ?? ""}
        onChange={(e) => onChange({ caption: e.target.value })}
        placeholder="Caption"
      />
      <Input
        value={cell.alt ?? ""}
        onChange={(e) => onChange({ alt: e.target.value })}
        placeholder="Alt text"
      />
    </>
  )
}

function TextCellEditor({
  cell,
  trainingId,
  onChange,
}: {
  cell: ColumnGridCell
  trainingId: number
  onChange: (patch: Partial<ColumnGridCell>) => void
}) {
  const textRef = useRef<HTMLTextAreaElement>(null)
  return (
    <>
      <CampMarkdownToolbar
        textareaRef={textRef}
        value={cell.markdown ?? ""}
        onChange={(markdown) => onChange({ markdown })}
        trainingId={trainingId}
      />
      <Textarea
        ref={textRef}
        rows={6}
        value={cell.markdown ?? ""}
        onChange={(e) => onChange({ markdown: e.target.value })}
        className="font-mono text-sm"
      />
    </>
  )
}

export function CampColumnGridBlock({
  content,
  readOnly = true,
  layoutEditable = false,
  trainingId = 0,
  onChange,
}: Props) {
  const grid = normalizeColumnGridContent(content)
  const gap = grid.gap ?? 20
  const rowGap = grid.rowGap ?? 24

  const update = useCallback(
    (next: ColumnGridContent) => {
      onChange?.(next)
    },
    [onChange],
  )

  const patchImageCell = useCallback(
    (rowIndex: number, colIndex: number, cellIndex: number, patch: Partial<ColumnGridCell>) => {
      const rows = grid.rows.map((row, ri) => {
        if (ri !== rowIndex) return row
        const columns = row.columns.map((col, ci) => {
          if (ci !== colIndex) return col
          const cells = col.cells.map((cell, ji) => (ji === cellIndex ? { ...cell, ...patch } : cell))
          return { ...col, cells }
        })
        return { ...row, columns }
      })
      update({ ...grid, rows })
    },
    [grid, update],
  )

  if (readOnly) {
    return (
      <div className="space-y-4" style={{ gap: `${rowGap}px` }}>
        {grid.rows.map((row, rowIndex) => (
          <ColumnGridRowView
            key={row.id}
            row={row}
            gap={gap}
            rowIndex={rowIndex}
            layoutEditable={layoutEditable}
            onPatchImageCell={
              layoutEditable && onChange
                ? (colIndex, cellIndex, patch) => patchImageCell(rowIndex, colIndex, cellIndex, patch)
                : undefined
            }
          />
        ))}
      </div>
    )
  }

  return (
    <ColumnGridEditor grid={grid} gap={gap} rowGap={rowGap} trainingId={trainingId} onChange={update} />
  )
}

function ColumnGridEditor({
  grid,
  gap,
  rowGap,
  trainingId,
  onChange,
}: {
  grid: ColumnGridContent
  gap: number
  rowGap: number
  trainingId: number
  onChange: (next: ColumnGridContent) => void
}) {
  const patchCell = (
    rowIndex: number,
    colIndex: number,
    cellIndex: number,
    patch: Partial<ColumnGridCell>,
  ) => {
    const rows = grid.rows.map((row, ri) => {
      if (ri !== rowIndex) return row
      const columns = row.columns.map((col, ci) => {
        if (ci !== colIndex) return col
        const cells = col.cells.map((cell, ji) => (ji === cellIndex ? { ...cell, ...patch } : cell))
        return { ...col, cells }
      })
      return { ...row, columns }
    })
    onChange({ ...grid, rows })
  }

  const patchColumn = (rowIndex: number, colIndex: number, patch: Partial<ColumnGridColumn>) => {
    const rows = grid.rows.map((row, ri) => {
      if (ri !== rowIndex) return row
      const columns = row.columns.map((col, ci) => (ci === colIndex ? { ...col, ...patch } : col))
      return { ...row, columns }
    })
    onChange({ ...grid, rows })
  }

  const addCell = (rowIndex: number, colIndex: number, type: ColumnGridCell["type"]) => {
    const cell: ColumnGridCell =
      type === "image"
        ? {
            id: newColumnGridId("cell"),
            type: "image",
            imageUrl: "",
            caption: "",
            alt: "",
            imageWidthPercent: 100,
            imageTransform: defaultImageTransform("free"),
          }
        : { id: newColumnGridId("cell"), type: "text", markdown: "" }
    patchColumn(rowIndex, colIndex, {
      cells: [...(grid.rows[rowIndex]?.columns[colIndex]?.cells ?? []), cell],
    })
  }

  const removeCell = (rowIndex: number, colIndex: number, cellIndex: number) => {
    const cells = grid.rows[rowIndex]?.columns[colIndex]?.cells.filter((_, j) => j !== cellIndex) ?? []
    if (cells.length === 0) return
    patchColumn(rowIndex, colIndex, { cells })
  }

  return (
    <div className="space-y-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-violet-800 dark:text-violet-200 flex items-center gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5" />
          Grid layout — {grid.rows.length} row{grid.rows.length === 1 ? "" : "s"}, drag dividers to resize
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[10px] uppercase tracking-wide text-slate-500">Col gap</label>
          <Input
            type="number"
            min={8}
            max={48}
            className="h-8 w-14 text-xs"
            value={gap}
            onChange={(e) => onChange({ ...grid, gap: clampNumber(Number(e.target.value), 8, 48) })}
          />
          <label className="text-[10px] uppercase tracking-wide text-slate-500">Row gap</label>
          <Input
            type="number"
            min={8}
            max={64}
            className="h-8 w-14 text-xs"
            value={rowGap}
            onChange={(e) => onChange({ ...grid, rowGap: clampNumber(Number(e.target.value), 8, 64) })}
          />
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => onChange(addGridRow(grid))}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Row
          </Button>
        </div>
      </div>

      <div className="space-y-4" style={{ gap: `${rowGap}px` }}>
        {grid.rows.map((row, rowIndex) => (
          <div key={row.id} className="rounded-xl border border-slate-200/70 dark:border-white/10 p-2 sm:p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Row {rowIndex + 1} · {row.columns.length} column{row.columns.length === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onChange(addColumnToRow(grid, rowIndex))}
                  disabled={row.columns.length >= 4}
                >
                  + Col
                </Button>
                {grid.rows.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-red-600"
                    onClick={() => onChange(removeGridRow(grid, rowIndex))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>

            <div
              className="flex flex-col md:flex-row w-full min-w-0 items-stretch"
              data-column-grid-row
              style={{ gap: `${gap}px` }}
            >
              {row.columns.flatMap((col, colIndex) => {
                const panel = (
                  <div
                    key={col.id}
                    className="min-w-0 rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/40 p-3 space-y-3"
                    style={{ flex: `${col.widthFraction} 1 0%` }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Col {colIndex + 1} · {Math.round(col.widthFraction * 100)}%
                      </span>
                      {row.columns.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-red-600"
                          onClick={() => onChange(removeColumnFromRow(grid, rowIndex, colIndex))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>

                    {col.cells.map((cell, cellIndex) => (
                      <div
                        key={cell.id}
                        className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-2 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                            {cell.type === "image" ? (
                              <ImageIcon className="h-3 w-3" />
                            ) : (
                              <Type className="h-3 w-3" />
                            )}
                            {cell.type}
                          </span>
                          {col.cells.length > 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1"
                              onClick={() => removeCell(rowIndex, colIndex, cellIndex)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          ) : null}
                        </div>

                        {cell.type === "text" ? (
                          <TextCellEditor
                            cell={cell}
                            trainingId={trainingId}
                            onChange={(patch) => patchCell(rowIndex, colIndex, cellIndex, patch)}
                          />
                        ) : (
                          <ImageCellEditor
                            cell={cell}
                            trainingId={trainingId}
                            onChange={(patch) => patchCell(rowIndex, colIndex, cellIndex, patch)}
                          />
                        )}
                      </div>
                    ))}

                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => addCell(rowIndex, colIndex, "text")}
                      >
                        + Text
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => addCell(rowIndex, colIndex, "image")}
                      >
                        + Image
                      </Button>
                    </div>
                  </div>
                )

                if (colIndex < row.columns.length - 1) {
                  return [
                    panel,
                    <ColumnResizeHandle
                      key={`handle-${col.id}`}
                      onDrag={(deltaFraction) => {
                        const left = row.columns[colIndex]
                        const nextLeft = clampNumber(left.widthFraction + deltaFraction, 0.12, 0.88)
                        onChange(resizeColumnPairInRow(grid, rowIndex, colIndex, nextLeft))
                      }}
                    />,
                  ]
                }
                return [panel]
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
