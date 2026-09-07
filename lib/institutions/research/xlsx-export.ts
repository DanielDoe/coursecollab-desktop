import * as XLSX from "xlsx"

export function csvStringToXlsxBuffer(csv: string, sheetName = "Export"): Buffer {
  const rows = csv
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const cells: string[] = []
      let current = ""
      let inQuotes = false
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i]!
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"'
            i += 1
          } else {
            inQuotes = !inQuotes
          }
        } else if (ch === "," && !inQuotes) {
          cells.push(current)
          current = ""
        } else {
          current += ch
        }
      }
      cells.push(current)
      return cells
    })

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31))
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }))
}

export function jsonRowsToXlsxBuffer(rows: Array<Record<string, unknown>>, sheetName = "Export"): Buffer {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31))
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }))
}
