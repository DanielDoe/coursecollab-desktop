"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type SyllabusTableEditorProps = {
  columns: string[]
  rows: string[][]
  onChange: (columns: string[], rows: string[][]) => void
}

export function SyllabusTableEditor({ columns, rows, onChange }: SyllabusTableEditorProps) {
  const safeColumns = columns.length > 0 ? columns : ["Column 1"]
  const safeRows = rows.length > 0 ? rows : [safeColumns.map(() => "")]

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    const nextRows = safeRows.map((row, ri) =>
      ri === rowIndex ? row.map((cell, ci) => (ci === colIndex ? value : cell)) : row,
    )
    onChange(safeColumns, nextRows)
  }

  const updateColumn = (colIndex: number, value: string) => {
    const nextColumns = safeColumns.map((col, i) => (i === colIndex ? value : col))
    onChange(nextColumns, safeRows)
  }

  const addRow = () => {
    onChange(safeColumns, [...safeRows, safeColumns.map(() => "")])
  }

  const removeRow = (rowIndex: number) => {
    if (safeRows.length <= 1) return
    onChange(
      safeColumns,
      safeRows.filter((_, i) => i !== rowIndex),
    )
  }

  const addColumn = () => {
    onChange([...safeColumns, `Column ${safeColumns.length + 1}`], safeRows.map((row) => [...row, ""]))
  }

  const removeColumn = (colIndex: number) => {
    if (safeColumns.length <= 1) return
    onChange(
      safeColumns.filter((_, i) => i !== colIndex),
      safeRows.map((row) => row.filter((_, i) => i !== colIndex)),
    )
  }

  return (
    <div className="space-y-3 overflow-x-auto">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="mr-1 h-4 w-4" /> Add row
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={addColumn}>
          <Plus className="mr-1 h-4 w-4" /> Add column
        </Button>
      </div>
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr>
            {safeColumns.map((col, colIndex) => (
              <th key={colIndex} className="border p-2 align-top">
                <div className="flex items-start gap-1">
                  <Input
                    value={col}
                    onChange={(e) => updateColumn(colIndex, e.target.value)}
                    className="h-8 rounded-md"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 shrink-0 p-0 text-destructive"
                    onClick={() => removeColumn(colIndex)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </th>
            ))}
            <th className="w-10 border p-2" />
          </tr>
        </thead>
        <tbody>
          {safeRows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {safeColumns.map((_, colIndex) => (
                <td key={colIndex} className="border p-2 align-top">
                  <Input
                    value={row[colIndex] ?? ""}
                    onChange={(e) => updateCell(rowIndex, colIndex, e.target.value)}
                    className="h-8 rounded-md"
                  />
                </td>
              ))}
              <td className="border p-2 align-top">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive"
                  onClick={() => removeRow(rowIndex)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
