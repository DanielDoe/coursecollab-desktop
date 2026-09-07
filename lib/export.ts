export async function handleExport() {
  try {
    const response = await fetch("/api/admin/practice/export")

    if (!response.ok) {
      throw new Error("Failed to export data")
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `practice-hub-data-${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  } catch (error) {
    console.error("Export failed:", error)
    throw error
  }
}
