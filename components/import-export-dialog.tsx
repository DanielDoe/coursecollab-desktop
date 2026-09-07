"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Download, Upload, Loader2, X } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { JSX } from "react"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"

// ---------------- Notification ----------------
function Notification({
  title,
  message,
  stats,
  onClose,
  loading = false,
  duration,
  type = "info", // "success" | "error" | "warning" | "info"
}: {
  title: string
  message?: string
  stats?: { imported: number; skipped: number; failed: number }
  onClose: () => void
  loading?: boolean
  duration?: number
  type?: "success" | "error" | "warning" | "info"
}) {
  useEffect(() => {
    if (!loading && duration) {
      const timer = setTimeout(onClose, duration)
      return () => clearTimeout(timer)
    }
  }, [loading, duration, onClose])

  const icons: Record<string, JSX.Element> = {
    success: <div className="flex items-center justify-center bg-green-500 text-white rounded-full w-8 h-8">✓</div>,
    error: <div className="flex items-center justify-center bg-red-500 text-white rounded-full w-8 h-8">✕</div>,
    warning: <div className="flex items-center justify-center bg-yellow-500 text-white rounded-full w-8 h-8">!</div>,
    info: <div className="flex items-center justify-center bg-blue-500 text-white rounded-full w-8 h-8">i</div>,
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 animate-slideIn
                 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700
                 shadow-xl rounded-lg p-6 w-[28rem] max-w-[95vw]"
    >
      <div className="flex items-start gap-4">
        {/* Icon or spinner */}
        {loading ? <Loader2 className="h-8 w-8 animate-spin text-blue-500" /> : icons[type]}

        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>

          {/* Plain message */}
          {message && (
            <p className="mt-2 text-base leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-line">
              {message}
            </p>
          )}

          {/* Modern stats layout */}
          {stats && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/40 p-3">
                <span className="text-xl font-bold text-green-600 dark:text-green-400">{stats.imported}</span>
                <span className="text-sm text-gray-600 dark:text-gray-300">Imported</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/40 p-3">
                <span className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{stats.skipped}</span>
                <span className="text-sm text-gray-600 dark:text-gray-300">Skipped</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40 p-3">
                <span className="text-xl font-bold text-red-600 dark:text-red-400">{stats.failed}</span>
                <span className="text-sm text-gray-600 dark:text-gray-300">Failed</span>
              </div>
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
        >
          <X className="h-6 w-6" />
        </button>
      </div>
    </div>
  )
}

const styles = `
@keyframes slideIn {
  from { opacity: 0; transform: translateY(20px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.animate-slideIn { animation: slideIn 0.3s ease-out forwards; }
`

// ---------------- Main Dialog ----------------
interface ImportExportDialogProps {
  userType?: "admin" | "instructor"
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onImportSuccess?: () => void
  showTrigger?: boolean
  /** Toolbar-style trigger (faculty integrated bar). */
  triggerClassName?: string
  triggerSize?: "sm" | "default"
}

export function ImportExportDialog({ 
  userType = "admin", 
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  onImportSuccess,
  showTrigger = true,
  triggerClassName,
  triggerSize = "default",
}: ImportExportDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  
  // Use external open state if provided, otherwise use internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalOnOpenChange || setInternalOpen
  const [exporting, setExporting] = useState(false)
  const [jsonInput, setJsonInput] = useState("")
  const [topic, setTopic] = useState("")
  const [notification, setNotification] = useState<{
    title: string
    message?: string
    stats?: { imported: number; skipped: number; failed: number }
    type?: "success" | "error" | "warning" | "info"
    loading?: boolean
    duration?: number
  } | null>(null)

  // ---------------- Export ----------------
  const handleExport = async (format: "json" | "csv") => {
    setExporting(true)
    try {
      const response = await fetch(
        `${userType === "admin" ? "/api/admin" : "/api/instructor"}/question-bank/export?format=${format}`,
        userType === "instructor" ? { headers: buildInstructorApiHeaders() } : undefined,
      )
      if (!response.ok) throw new Error("Failed to export questions")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `question-bank-${Date.now()}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setNotification({
        title: "Export Complete",
        message: `Exported as ${format.toUpperCase()}`,
        type: "success",
        duration: 5000,
      })
    } catch (error) {
      setNotification({
        title: "Export Failed",
        message: "An error occurred while exporting.",
        type: "error",
        duration: 5000,
      })
    } finally {
      setExporting(false)
    }
  }

  // ---------------- Import ----------------
  const startBackgroundImport = async (questionsToImport: any[], topicName: string | null) => {
    const batchSize = 10
    const total = questionsToImport.length
    let imported = 0
    let skipped = 0
    let failed = 0

    // Step 1: show loading notification
    setNotification({
      title: "Importing...",
      message: `Processing ${total} questions in batches of ${batchSize}.`,
      loading: true,
      type: "info",
    })

    try {
      for (let i = 0; i < total; i += batchSize) {
        const batch = questionsToImport.slice(i, i + batchSize)

        // Update progress notification
        setNotification({
          title: "Importing...",
          message: `Batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(total / batchSize)}\nProcessing ${batch.length} questions...`,
          loading: true,
          type: "info",
        })

        const response = await fetch(`${userType === "admin" ? "/api/admin" : "/api/instructor"}/question-bank/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questions: batch, topic: topicName }),
        })

        let result: any
        const contentType = response.headers.get("content-type")
        if (contentType && contentType.includes("application/json")) {
          result = await response.json()
        } else {
          const text = await response.text()
          throw new Error(text || "Server returned a non-JSON error")
        }

        if (!response.ok) throw new Error(result.error || "Batch import failed")

        imported += result.imported || 0
        skipped += result.skipped || 0
        failed += result.failed || 0
      }

      // Step 2: replace with success notification
      setNotification({
        title: "Import Complete",
        stats: { imported, skipped, failed },
        type: failed > 0 ? "warning" : "success",
        duration: 6000,
      })

      // Call the external success callback if provided
      if (onImportSuccess) {
        onImportSuccess()
      }

      window.dispatchEvent(new CustomEvent("questionsImported"))
    } catch (error) {
      setNotification({
        title: "Import Failed",
        message: error instanceof Error ? error.message : "An error occurred during import.",
        type: "error",
        duration: 6000,
      })
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const questionsToImport = data.questions || data
      startBackgroundImport(questionsToImport, topic.trim() || null)
      setOpen(false)
      setTopic("")
      e.target.value = ""
    } catch (error) {
      setNotification({
        title: "Import Failed",
        message: error instanceof Error ? error.message : "Please check the file format and try again.",
        type: "error",
        duration: 5000,
      })
    }
  }

  const handleImportJson = async () => {
    if (!jsonInput.trim()) {
      setNotification({
        title: "No Data Provided",
        message: "Please paste JSON data to import.",
        type: "error",
        duration: 5000,
      })
      return
    }

    try {
      const data = JSON.parse(jsonInput)
      const questionsToImport = data.questions || data
      startBackgroundImport(questionsToImport, topic.trim() || null)
      setOpen(false)
      setJsonInput("")
      setTopic("")
    } catch (error) {
      setNotification({
        title: "Import Failed",
        message: error instanceof Error ? error.message : "Please check the JSON format and try again.",
        type: "error",
        duration: 5000,
      })
    }
  }

  // ---------------- Render ----------------
  return (
    <>
      <style>{styles}</style>

      <Dialog open={open} onOpenChange={setOpen}>
        {showTrigger && (
          <DialogTrigger asChild>
            <Button
              variant={triggerClassName ? "ghost" : "outline"}
              size={triggerSize}
              className={
                triggerClassName ??
                "border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 hover:border-slate-300 dark:hover:border-white/20 transition-all"
              }
            >
              <Upload className="h-3.5 w-3.5 sm:mr-2" />
              <span className={triggerClassName ? "hidden sm:inline" : undefined}>Import/Export</span>
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="max-w-2xl bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950/80 border-slate-200 dark:border-white/10">
          <DialogHeader className="space-y-3 pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
                <Upload className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800 dark:text-slate-100">Import/Export Question Bank</DialogTitle>
                <DialogDescription className="text-slate-600 dark:text-slate-400">Manage your question bank data efficiently</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="import" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-white/5 p-1 rounded-xl h-12">
              <TabsTrigger 
                value="import" 
                className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm transition-all"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import
              </TabsTrigger>
              <TabsTrigger 
                value="export"
                className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm transition-all"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </TabsTrigger>
            </TabsList>

            {/* --- Import Tab --- */}
            <TabsContent value="import" className="space-y-5 mt-4">
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="topic-input" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Topic/Title (Optional)</Label>
                  <Input
                    id="topic-input"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., Introduction to Programming"
                    className="h-11 border-slate-200 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-100 rounded-xl focus:border-blue-500 focus:ring-blue-200"
                  />
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                    Categorize all imported questions under this topic
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="file-upload" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Upload JSON File</Label>
                  <div className="relative">
                    <input
                      id="file-upload"
                      type="file"
                      accept=".json"
                      onChange={handleImportFile}
                      className="flex h-12 w-full rounded-xl border-2 border-dashed border-slate-300 dark:border-white/20 bg-slate-50 dark:bg-white/5 px-4 py-2 text-sm text-slate-900 dark:text-slate-100
                                 file:mr-4 file:h-8 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:text-sm file:font-medium
                                 hover:border-blue-400 dark:hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all cursor-pointer
                                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                    Import runs in the background - continue working while it processes
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or paste JSON</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="json-input" className="text-sm font-semibold text-slate-700">Paste JSON Data</Label>
                  <Textarea
                    id="json-input"
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    rows={10}
                    className="font-mono text-sm overflow-y-auto border-slate-200 rounded-xl focus:border-blue-500 focus:ring-blue-200 bg-slate-50"
                    placeholder='{"questions": [...]}'
                  />
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                    Supports "type", "question_text", "options", "correct_answer", and "hint"
                  </p>
                </div>

                <Button 
                  onClick={handleImportJson} 
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25 rounded-xl text-base font-medium"
                >
                  <Upload className="h-5 w-5 mr-2" />
                  Import Questions
                </Button>
              </div>
            </TabsContent>

            {/* --- Export Tab --- */}
            <TabsContent value="export" className="space-y-5 mt-4">
              <div className="space-y-5">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-blue-800 font-medium flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export your question bank
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Download all questions in JSON or CSV format for backup or sharing
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    onClick={() => handleExport("json")} 
                    disabled={exporting} 
                    className="h-24 flex-col bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25 rounded-xl"
                  >
                    {exporting ? (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin mb-2" />
                        <span className="text-sm">Exporting...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-6 w-6 mb-2" />
                        <span className="font-semibold">Export as JSON</span>
                        <span className="text-xs text-blue-100 mt-1">Structured data format</span>
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={() => handleExport("csv")} 
                    disabled={exporting} 
                    variant="outline" 
                    className="h-24 flex-col border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl"
                  >
                    {exporting ? (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin mb-2 text-slate-600" />
                        <span className="text-sm text-slate-600">Exporting...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-6 w-6 mb-2 text-slate-700" />
                        <span className="font-semibold text-slate-800">Export as CSV</span>
                        <span className="text-xs text-slate-500 mt-1">Spreadsheet format</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {notification && (
        <Notification
          title={notification.title}
          message={notification.message}
          stats={notification.stats}
          type={notification.type}
          loading={notification.loading}
          duration={notification.duration}
          onClose={() => setNotification(null)}
        />
      )}
    </>
  )
}
