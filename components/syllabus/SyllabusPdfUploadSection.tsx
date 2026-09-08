"use client"

import { useRef, useState } from "react"
import { FileText, Loader2, Upload, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LecturePdfIframePreview } from "@/components/lecture-pdf-iframe-preview"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { SYLLABUS_DROPZONE, SYLLABUS_DROPZONE_ACTIVE } from "@/lib/syllabus/syllabus-surface-classes"
import { cn } from "@/lib/utils"

export const SYLLABUS_PDF_ACCEPT = ".pdf,application/pdf"

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type SyllabusPdfUploadSectionProps = {
  pdfUrl?: string | null
  pdfFileName?: string | null
  title?: string
  uploading?: boolean
  onUpload: (file: File) => Promise<void>
  onRemove?: () => Promise<void>
  fillHeight?: boolean
}

export function SyllabusPdfUploadSection({
  pdfUrl,
  pdfFileName,
  title,
  uploading = false,
  onUpload,
  onRemove,
  fillHeight = false,
}: SyllabusPdfUploadSectionProps) {
  const chrome = facultyEmbedChrome("syllabus")
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const hasPdf = Boolean(pdfUrl)
  const previewUrl = pdfUrl ?? null

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") return
    setSelectedFile(file)
    await onUpload(file)
    setSelectedFile(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className={cn(fillHeight && "flex min-h-0 flex-1 flex-col gap-4")}>
      <div className={cn(PORTAL_CARD, "space-y-4 p-4 sm:p-5", fillHeight && !hasPdf && "flex min-h-0 flex-1 flex-col")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={chrome.iconBadge("sm")}>
              <FileText className="h-4 w-4 !text-white" />
            </div>
            <div>
              <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Syllabus PDF</p>
              <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>
                Students open the uploaded file in the in-app reader instead of the structured sections.
              </p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={cn(
              "rounded-lg text-[11px]",
              hasPdf ? chrome.success : chrome.quiet,
            )}
          >
            {hasPdf ? "PDF attached" : "No PDF"}
          </Badge>
        </div>

        {hasPdf ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--muted)] px-3 py-3">
            <div className={chrome.iconBadge("sm")}>
              <FileText className="h-4 w-4 !text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-sm font-medium", PORTAL_TEXT)}>
                {pdfFileName || "syllabus.pdf"}
              </p>
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Ready for students once you publish</p>
            </div>
            {onRemove ? (
              <Button
                type="button"
                size="sm"
                className={cn("rounded-lg", chrome.danger)}
                onClick={() => void onRemove()}
              >
                <X className="h-4 w-4" />
                Remove
              </Button>
            ) : null}
          </div>
        ) : null}

        <div
          className={cn(
            SYLLABUS_DROPZONE,
            dragActive && SYLLABUS_DROPZONE_ACTIVE,
            uploading && "pointer-events-none opacity-60",
            fillHeight && !hasPdf && "flex min-h-0 flex-1 flex-col items-center justify-center",
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragActive(false)
            void pickFile(e.dataTransfer.files?.[0])
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={SYLLABUS_PDF_ACCEPT}
            className="hidden"
            onChange={(e) => void pickFile(e.target.files?.[0])}
          />
          {uploading ? (
            <div className={cn("flex flex-col items-center gap-2", PORTAL_TEXT_MUTED)}>
              <Loader2 className="h-8 w-8 animate-spin text-[var(--cc-accent)]" />
              <p className="text-sm">Uploading PDF…</p>
            </div>
          ) : (
            <>
              <div className={cn("mx-auto mb-3", chrome.iconBadge("sm"))}>
                <Upload className="h-4 w-4 !text-white" />
              </div>
              <p className={cn("text-sm font-medium", PORTAL_TEXT)}>
                {hasPdf ? "Drop a new PDF to replace the current file" : "Drag and drop a PDF here"}
              </p>
              <Button
                type="button"
                size="sm"
                className={cn("mt-3 rounded-lg", chrome.solid)}
                onClick={() => inputRef.current?.click()}
              >
                {hasPdf ? "Replace PDF" : "Choose PDF file"}
              </Button>
              <p className={cn("mt-2 text-xs", PORTAL_TEXT_MUTED)}>PDF only · max recommended 25 MB</p>
              {selectedFile ? (
                <p className={cn("mt-2 text-xs", PORTAL_TEXT_MUTED)}>
                  Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>

      {hasPdf && pdfUrl ? (
        <div className={cn(PORTAL_CARD, "space-y-3 overflow-hidden p-3 sm:p-4")}>
          <p className={cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
            In-app preview
          </p>
          <LecturePdfIframePreview
            pdfUrl={previewUrl ?? pdfUrl}
            title={title ?? "Syllabus"}
            className="h-[min(52vh,520px)] min-h-[min(52vh,520px)] w-full overflow-hidden rounded-xl"
          />
        </div>
      ) : null}
    </div>
  )
}
