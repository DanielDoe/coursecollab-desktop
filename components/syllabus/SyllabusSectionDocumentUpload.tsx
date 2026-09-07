"use client"

import { useRef, useState } from "react"
import { FileText, Loader2, Upload, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import {
  SYLLABUS_DROPZONE,
  SYLLABUS_DROPZONE_ACTIVE,
  SYLLABUS_TILE,
  SYLLABUS_VALUE,
  PORTAL_TEXT_MUTED,
} from "@/lib/syllabus/syllabus-surface-classes"
import { cn } from "@/lib/utils"

export const SYLLABUS_SECTION_PDF_ACCEPT = ".pdf,application/pdf"

type SyllabusSectionDocumentUploadProps = {
  documentUrl?: string | null
  documentFileName?: string | null
  uploading?: boolean
  onUpload: (file: File) => Promise<void>
  onRemove?: () => Promise<void>
}

export function SyllabusSectionDocumentUpload({
  documentUrl,
  documentFileName,
  uploading = false,
  onUpload,
  onRemove,
}: SyllabusSectionDocumentUploadProps) {
  const chrome = facultyEmbedChrome("syllabus")
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const hasDocument = Boolean(documentUrl)

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    if (extFromName(file.name) !== "pdf" && file.type !== "application/pdf") return
    await onUpload(file)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className={cn(SYLLABUS_TILE, "space-y-4")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={chrome.iconBadge("sm")}>
            <FileText className="h-4 w-4 !text-white" />
          </div>
          <div>
            <p className={cn("text-sm font-semibold", SYLLABUS_VALUE)}>Curriculum vitae (PDF)</p>
            <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>
              Upload your CV or résumé. Students can open it from the Curriculum Vitae section.
            </p>
          </div>
        </div>
        <Badge
          variant="secondary"
          className={cn("rounded-lg text-[11px]", hasDocument ? chrome.success : chrome.quiet)}
        >
          {hasDocument ? "PDF attached" : "No CV"}
        </Badge>
      </div>

      {hasDocument ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--muted)] px-3 py-3">
          <FileText className="h-5 w-5 shrink-0 text-[var(--cc-accent-dark)]" />
          <div className="min-w-0 flex-1">
            <p className={cn("truncate text-sm font-medium", SYLLABUS_VALUE)}>
              {documentFileName || "curriculum-vitae.pdf"}
            </p>
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Visible to students once published</p>
          </div>
          {documentUrl ? (
            <Button type="button" size="sm" variant="outline" className="rounded-lg" asChild>
              <a href={documentUrl} target="_blank" rel="noopener noreferrer">
                Preview
              </a>
            </Button>
          ) : null}
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
          accept={SYLLABUS_SECTION_PDF_ACCEPT}
          className="hidden"
          onChange={(e) => void pickFile(e.target.files?.[0])}
        />
        {uploading ? (
          <div className={cn("flex flex-col items-center gap-2", PORTAL_TEXT_MUTED)}>
            <Loader2 className="h-7 w-7 animate-spin text-[var(--cc-accent)]" />
            <p className="text-sm">Uploading CV…</p>
          </div>
        ) : (
          <>
            <div className={cn("mx-auto mb-3", chrome.iconBadge("sm"))}>
              <Upload className="h-4 w-4 !text-white" />
            </div>
            <p className={cn("text-sm font-medium", SYLLABUS_VALUE)}>
              {hasDocument ? "Replace CV PDF" : "Upload CV PDF"}
            </p>
            <Button
              type="button"
              size="sm"
              className={cn("mt-3 rounded-lg", chrome.solid)}
              onClick={() => inputRef.current?.click()}
            >
              Choose PDF
            </Button>
            <p className={cn("mt-2 text-xs", PORTAL_TEXT_MUTED)}>PDF only · max 15 MB</p>
          </>
        )}
      </div>
    </div>
  )
}

function extFromName(name: string): string {
  const dot = name.lastIndexOf(".")
  if (dot === -1) return ""
  return name.slice(dot + 1).toLowerCase()
}
