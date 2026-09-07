"use client"

import { useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Loader2, Presentation, Upload, FileText, X } from "lucide-react"
import { cn } from "@/lib/utils"

export const LECTURE_DECK_FILE_ACCEPT =
  ".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function deckStatusLabel(pdfUrl?: string | null, contentMode?: string | null): string {
  if (!pdfUrl) return "No slide deck"
  if (contentMode === "ppt_converted_pdf") return "PDF (converted from PowerPoint)"
  return "PDF attached"
}

export type LectureDeckFormSectionProps = {
  week?: number
  lectureTitle?: string
  pdfUrl?: string | null
  contentMode?: string | null
  selectedFile: File | null
  onSelectedFileChange: (file: File | null) => void
  fileInputKey?: number
  allowDownload: boolean
  onAllowDownloadChange: (value: boolean) => void
  published: boolean
  onPublishedChange: (value: boolean) => void
  uploading?: boolean
  onRemoveExisting?: () => void
  canRemoveExisting?: boolean
  showVisibilityControls?: boolean
  compact?: boolean
  className?: string
}

export function LectureDeckFormSection({
  week,
  lectureTitle,
  pdfUrl,
  contentMode,
  selectedFile,
  onSelectedFileChange,
  fileInputKey = 0,
  allowDownload,
  onAllowDownloadChange,
  published,
  onPublishedChange,
  uploading = false,
  onRemoveExisting,
  canRemoveExisting = false,
  showVisibilityControls = true,
  compact = false,
  className,
}: LectureDeckFormSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const hasDeck = Boolean(pdfUrl)
  const status = deckStatusLabel(pdfUrl, contentMode)

  const pickFile = (file: File | undefined) => {
    if (!file) return
    onSelectedFileChange(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    pickFile(file)
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.02] overflow-hidden",
        className,
      )}
    >
      <div className="flex items-start gap-3 border-b border-slate-200/60 dark:border-white/[0.08] px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 dark:bg-teal-500/25">
          <Presentation className="h-4 w-4 text-teal-600 dark:text-teal-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Slide deck</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Upload PDF or PowerPoint — students view the canonical PDF in the app.
          </p>
        </div>
        <Badge
          variant={hasDeck ? "default" : "secondary"}
          className={cn(
            "shrink-0 text-[11px]",
            hasDeck
              ? "bg-teal-600 hover:bg-teal-600 text-white"
              : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
          )}
        >
          {status}
        </Badge>
      </div>

      <div className={cn("space-y-4 p-4", compact && "p-3 space-y-3")}>
        {(lectureTitle || week != null) && (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {week != null ? <span className="font-medium text-slate-700 dark:text-slate-300">Week {week}</span> : null}
            {week != null && lectureTitle ? " · " : null}
            {lectureTitle ? <span className="truncate">{lectureTitle}</span> : null}
          </div>
        )}

        {selectedFile ? (
          <div className="flex items-center gap-3 rounded-lg border border-teal-200/80 dark:border-teal-500/30 bg-teal-50/50 dark:bg-teal-950/20 px-3 py-2.5">
            <FileText className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{selectedFile.name}</p>
              <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)} · ready to upload</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={uploading}
              onClick={() => onSelectedFileChange(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click()
            }}
            onDragEnter={(e) => {
              e.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              setDragActive(false)
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => !uploading && inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
              dragActive
                ? "border-teal-500 bg-teal-50/60 dark:bg-teal-950/30"
                : "border-slate-300/80 dark:border-white/15 hover:border-teal-400/70 hover:bg-white/60 dark:hover:bg-white/[0.04]",
              compact ? "py-5" : "py-8",
              uploading && "pointer-events-none opacity-60",
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Uploading…</p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    Drop PDF or PowerPoint here
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">or click to browse</p>
                </div>
              </>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          key={fileInputKey}
          type="file"
          accept={LECTURE_DECK_FILE_ACCEPT}
          className="sr-only"
          disabled={uploading}
          onChange={(e) => {
            pickFile(e.target.files?.[0])
            e.target.value = ""
          }}
        />

        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          Accepted: PDF, PPT, PPTX. PowerPoint files are converted to PDF on the server when LibreOffice is available.
        </p>

        {showVisibilityControls ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="deck-form-published"
                checked={published}
                disabled={uploading}
                onCheckedChange={(c) => onPublishedChange(c === true)}
              />
              <Label htmlFor="deck-form-published" className="text-sm font-normal cursor-pointer">
                Published (visible to students)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="deck-form-dl"
                checked={allowDownload}
                disabled={uploading}
                onCheckedChange={(c) => onAllowDownloadChange(c === true)}
              />
              <Label htmlFor="deck-form-dl" className="text-sm font-normal cursor-pointer">
                Allow students to download PDF
              </Label>
            </div>
          </div>
        ) : null}

        {canRemoveExisting && onRemoveExisting ? (
          <div className="flex justify-end border-t border-slate-200/60 dark:border-white/[0.08] pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              disabled={uploading}
              onClick={onRemoveExisting}
            >
              Remove current deck
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
