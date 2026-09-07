"use client"

import { useCallback, useRef, useState } from "react"
import {
  CheckCircle2,
  FileImage,
  FileText,
  FileType2,
  Loader2,
  RefreshCw,
  Sparkles,
  UploadCloud,
} from "lucide-react"
import { getStudentData } from "@/lib/auth"
import { GUEST_RESUME_ACCEPT, isAllowedGuestResumeFile } from "@/lib/guest/career/resume-file"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { EMBED_MATERIAL_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
import { cn } from "@/lib/utils"

type Props = {
  resumeText: string
  onResumeTextChange: (value: string) => void
  opportunityText: string
  onOpportunityTextChange: (value: string) => void
  resumeFileName?: string | null
  /** Notified when a file is picked so parents can track the file name. */
  onResumeFileSelected?: (fileName: string | null) => void
  busy?: boolean
  onScan: () => void | Promise<void>
  scanLabel?: string
  footerNote?: string
}

function fileKindIcon(name: string) {
  if (/\.(png|jpe?g|webp|gif|heic|heif|bmp)$/i.test(name)) return FileImage
  if (/\.docx?$/i.test(name)) return FileType2
  return FileText
}

export function CareerNewScanForm({
  resumeText,
  onResumeTextChange,
  opportunityText,
  onOpportunityTextChange,
  resumeFileName,
  onResumeFileSelected,
  busy,
  onScan,
  scanLabel = "Scan",
  footerNote = "Cora uses evidence from your résumé only — it will not invent qualifications.",
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [showPaste, setShowPaste] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [savedToProfile, setSavedToProfile] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const onFile = useCallback(
    async (file: File | null) => {
      if (!file) return
      setUploadError(null)
      setSavedToProfile(false)

      const allowed = isAllowedGuestResumeFile({ name: file.name, type: file.type, size: file.size })
      if (!allowed.ok) {
        setUploadError(allowed.error)
        return
      }

      const studentDatabaseId = getStudentData()?.databaseId
      if (!studentDatabaseId) {
        setUploadError("Sign in again to upload a résumé.")
        return
      }

      onResumeFileSelected?.(file.name)
      setUploading(true)
      try {
        // Store the original document as the master résumé; the server extracts
        // text (PDF, Word, images) in the same request — no pasting required.
        const form = new FormData()
        form.set("studentDatabaseId", String(studentDatabaseId))
        form.set("file", file)
        const res = await fetch("/api/guest/career/resumes", { method: "POST", body: form })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Failed to save résumé")
        onResumeTextChange(String(json.resume?.parsedText ?? ""))
        setSavedToProfile(true)
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : "Failed to save résumé")
        onResumeFileSelected?.(null)
      } finally {
        setUploading(false)
      }
    },
    [onResumeTextChange, onResumeFileSelected],
  )

  const hasResume = Boolean(resumeText.trim()) || Boolean(resumeFileName)
  const SavedIcon = resumeFileName ? fileKindIcon(resumeFileName) : FileText

  return (
    <div className="space-y-4">
      <div className={cn(EMBED_MATERIAL_PANEL, "overflow-hidden")}>
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-gradient-to-r from-violet-50/80 to-transparent px-4 py-3 dark:from-violet-950/30">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--cc-text)]">
            <Sparkles className="size-4 text-violet-600" aria-hidden />
            New scan
          </h2>
          <p className="hidden text-xs text-[var(--cc-text-muted)] sm:block">
            Two inputs · results in ~30 seconds
          </p>
        </div>

        <div className="grid gap-0 lg:grid-cols-2">
          {/* Résumé column */}
          <div className="border-b border-[var(--border)] p-4 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-[var(--cc-text)]">
                <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white">
                  1
                </span>
                Your résumé
              </p>
              <button
                type="button"
                className="text-xs font-medium text-violet-600 hover:underline"
                onClick={() => setShowPaste((v) => !v)}
              >
                {showPaste ? "Upload a file instead" : "Paste text instead"}
              </button>
            </div>

            {!showPaste ? (
              <>
                <button
                  type="button"
                  disabled={busy || uploading}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    void onFile(e.dataTransfer.files?.[0] ?? null)
                  }}
                  className={cn(
                    "group flex min-h-[190px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-all",
                    dragOver
                      ? "border-violet-500 bg-violet-100/70 dark:bg-violet-950/40"
                      : "border-violet-200 bg-gradient-to-b from-violet-50/60 to-fuchsia-50/30 hover:border-violet-400 hover:from-violet-50 dark:border-violet-900/50 dark:from-violet-950/25 dark:to-fuchsia-950/10",
                  )}
                >
                  <div
                    className={cn(
                      "mb-3 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-600/25 transition-transform",
                      !uploading && "group-hover:scale-110",
                    )}
                  >
                    {uploading ? <Loader2 className="size-5 animate-spin" /> : <UploadCloud className="size-5" />}
                  </div>
                  {uploading ? (
                    <p className="text-sm font-medium text-[var(--cc-text)]">Saving your résumé…</p>
                  ) : (
                    <p className="text-sm text-[var(--cc-text)]">
                      Drop your résumé here or <span className="font-semibold text-violet-600">browse files</span>
                    </p>
                  )}
                  <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
                    {["PDF", "Word", "Image", ".txt"].map((kind) => (
                      <span
                        key={kind}
                        className="rounded-md border border-violet-200/80 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-300"
                      >
                        {kind}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--cc-text-muted)]">
                    Cora stores the original file and reads it automatically — no pasting needed
                  </p>
                </button>

                {resumeFileName && !uploading ? (
                  <div className="mt-2.5 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/25">
                    <SavedIcon className="size-4 shrink-0 text-emerald-600" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-[var(--cc-text)]">{resumeFileName}</p>
                      <p className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" aria-hidden />
                        {savedToProfile ? "Saved to your profile — ready to scan" : "On file — ready to scan"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] font-medium text-[var(--cc-text)] transition-colors hover:bg-[var(--muted)]"
                      onClick={() => fileRef.current?.click()}
                    >
                      <RefreshCw className="size-3" aria-hidden />
                      Replace
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div>
                <Textarea
                  value={resumeText}
                  onChange={(e) => onResumeTextChange(e.target.value)}
                  placeholder="Paste résumé text… (optional if you already uploaded a file)"
                  className="min-h-[190px] rounded-xl"
                />
                <p className="mt-1.5 text-[11px] text-[var(--cc-text-muted)]">
                  Optional — uploading a file is enough. Pasting text just overrides what Cora extracted.
                </p>
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept={GUEST_RESUME_ACCEPT}
              className="hidden"
              onChange={(e) => {
                void onFile(e.target.files?.[0] ?? null)
                e.target.value = ""
              }}
            />

            {uploadError ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{uploadError}</p>
            ) : null}
          </div>

          {/* Opportunity column */}
          <div className="p-4">
            <p className="mb-3 text-sm font-medium text-[var(--cc-text)]">
              <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white">
                2
              </span>
              The opportunity
            </p>
            <Textarea
              value={opportunityText}
              onChange={(e) => onOpportunityTextChange(e.target.value)}
              placeholder="Paste the job description, program requirements, or scholarship details. Skip benefits and legal disclaimers when you can."
              className="min-h-[190px] rounded-xl"
            />
            <p className="mt-1.5 text-[11px] text-[var(--cc-text-muted)]">
              Tip: include required skills and qualifications — that's what Cora scores against.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[var(--cc-text-muted)]">{footerNote}</p>
        <Button
          className="rounded-xl px-6"
          disabled={busy || uploading || !hasResume || !opportunityText.trim()}
          onClick={() => void onScan()}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {busy ? "Scanning…" : scanLabel}
        </Button>
      </div>
    </div>
  )
}
