"use client"

import { useRef, useState } from "react"
import { FileText, Loader2, PenLine, Plus, Presentation, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import {
  createAllSessionAccess,
  type SessionAccessState,
} from "@/lib/instructor-section-presets"
import { cn } from "@/lib/utils"

type CreateMethod = "manual" | "deck" | "json"

type AccessRow = { code: string; label: string; dotClass: string }

export type DeckQuickForm = {
  week: string
  title: string
  description: string
  published: boolean
  allowDownload: boolean
}

type MethodOption = {
  id: CreateMethod
  title: string
  description: string
  icon: typeof PenLine
}

const METHODS: MethodOption[] = [
  {
    id: "manual",
    title: "Start blank",
    description: "Add title, week, and session access — attach a deck later.",
    icon: PenLine,
  },
  {
    id: "deck",
    title: "Upload slide deck",
    description: "Create the lecture and attach PDF or PowerPoint in one step.",
    icon: Presentation,
  },
  {
    id: "json",
    title: "Import JSON",
    description: "Bulk-import slides and images from a structured file.",
    icon: Upload,
  },
]

const DECK_ACCEPT =
  ".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function LectureFileDropzone({
  id,
  inputKey,
  label,
  hint,
  accept,
  file,
  fileSummary,
  onFileChange,
  multiple,
  chrome,
  fp,
  icon: Icon = Upload,
}: {
  id: string
  inputKey?: number
  label: string
  hint: string
  accept: string
  file?: File | null
  fileSummary?: string | null
  onFileChange?: (file: File | null) => void
  multiple?: boolean
  chrome: { p: { softBg: string; iconText: string } }
  fp: { cta: string }
  icon?: typeof Upload
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [localFile, setLocalFile] = useState<File | null>(null)
  const [localSummary, setLocalSummary] = useState<string | null>(null)

  const activeFile = file !== undefined ? file : localFile
  const summary =
    fileSummary ??
    (multiple ? localSummary : activeFile ? `${activeFile.name} · ${formatFileSize(activeFile.size)}` : null)

  const pickFiles = (files: FileList | null | undefined) => {
    if (!files?.length) return
    if (multiple) {
      setLocalSummary(`${files.length} file${files.length === 1 ? "" : "s"} selected`)
      onFileChange?.(null)
      return
    }
    const next = files[0] ?? null
    if (file !== undefined) onFileChange?.(next)
    else setLocalFile(next)
    setLocalSummary(null)
  }

  const clearFile = () => {
    if (file !== undefined) onFileChange?.(null)
    else setLocalFile(null)
    setLocalSummary(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div
        className={cn(
          "border border-dashed px-4 py-6 text-center transition-colors",
          dragActive
            ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)]/50"
            : "border-[var(--border)] bg-[var(--muted)]/15 hover:bg-[var(--muted)]/25",
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragActive(false)
          const files = e.dataTransfer.files
          if (inputRef.current && files.length) {
            const dt = new DataTransfer()
            if (multiple) {
              Array.from(files).forEach((f) => dt.items.add(f))
            } else {
              dt.items.add(files[0]!)
            }
            inputRef.current.files = dt.files
          }
          pickFiles(files)
        }}
      >
        <input
          key={inputKey}
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => pickFiles(e.target.files)}
        />
        <div className={cn("mx-auto mb-3 flex h-10 w-10 items-center justify-center", chrome.p.softBg)}>
          <Icon className={cn("h-5 w-5", chrome.p.iconText)} />
        </div>
        <p className={cn("text-sm font-medium", PORTAL_TEXT)}>
          {summary ? "Drop a file to replace" : "Drag and drop your file here"}
        </p>
        <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>{hint}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 border-[var(--border)] bg-[var(--card)]"
          onClick={() => inputRef.current?.click()}
        >
          {summary ? "Choose different file" : "Browse files"}
        </Button>
      </div>
      {summary ? (
        <div className="flex items-center gap-2 border border-[var(--border)] bg-[var(--card)] px-3 py-2">
          <FileText className={cn("h-4 w-4 shrink-0", chrome.p.iconText)} />
          <p className={cn("min-w-0 flex-1 truncate text-sm font-medium", PORTAL_TEXT)}>{summary}</p>
          <button
            type="button"
            onClick={clearFile}
            className="shrink-0 p-1 text-[var(--cc-text-muted)] transition-colors hover:text-[var(--cc-text)]"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

type LectureCreatePanelProps = {
  chrome: { p: { softBg: string; iconText: string }; cta: string }
  fp: { cta: string; iconText: string }
  showDeckUpload: boolean
  onManualCreate: () => void
  deckForm: DeckQuickForm
  setDeckForm: React.Dispatch<React.SetStateAction<DeckQuickForm>>
  deckFile: File | null
  setDeckFile: (file: File | null) => void
  deckFileInputKey: number
  deckUploading: boolean
  onCreateWithDeck: () => void
  sessionAccess: SessionAccessState
  setSessionAccess: React.Dispatch<React.SetStateAction<SessionAccessState>>
  accessRows: AccessRow[]
  codes: string[]
  onJsonUpload: () => void
}

export function LectureCreatePanel({
  chrome,
  fp,
  showDeckUpload,
  onManualCreate,
  deckForm,
  setDeckForm,
  deckFile,
  setDeckFile,
  deckFileInputKey,
  deckUploading,
  onCreateWithDeck,
  sessionAccess,
  setSessionAccess,
  accessRows,
  codes,
  onJsonUpload,
}: LectureCreatePanelProps) {
  const visibleMethods = METHODS.filter((m) => m.id !== "deck" || showDeckUpload)
  const [method, setMethod] = useState<CreateMethod>(showDeckUpload ? "deck" : "manual")

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className={cn("text-lg font-semibold tracking-tight", PORTAL_TEXT)}>New lecture</h2>
        <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
          Choose how to start — you can edit details, add slides, and publish anytime after.
        </p>
      </header>

      <div
        className={cn(
          "grid gap-2.5",
          visibleMethods.length === 3 ? "sm:grid-cols-3" : visibleMethods.length === 2 ? "sm:grid-cols-2" : "",
        )}
        role="tablist"
        aria-label="Lecture creation method"
      >
        {visibleMethods.map((option) => {
          const selected = method === option.id
          const Icon = option.icon
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setMethod(option.id)}
              className={cn(
                "rounded-xl border p-3.5 text-left transition-colors",
                selected
                  ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)]/40 shadow-sm"
                  : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/40",
              )}
            >
              <div
                className={cn(
                  "mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg",
                  selected ? chrome.p.softBg : "bg-[var(--muted)]",
                )}
              >
                <Icon className={cn("h-4 w-4", selected ? chrome.p.iconText : "text-[var(--cc-text-muted)]")} />
              </div>
              <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>{option.title}</p>
              <p className={cn("mt-0.5 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{option.description}</p>
            </button>
          )
        })}
      </div>

      <section className={cn(PORTAL_CARD, "p-4 sm:p-5")} role="tabpanel">
        {method === "manual" ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className={cn("text-sm font-medium", PORTAL_TEXT)}>Create an empty lecture shell</p>
              <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
                Opens a short form for week, title, sessions, and optional deck upload.
              </p>
            </div>
            <Button type="button" onClick={onManualCreate} className={cn("shrink-0 gap-2", fp.cta)}>
              <Plus className="h-4 w-4" />
              Create lecture
            </Button>
          </div>
        ) : null}

        {method === "deck" && showDeckUpload ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deck-quick-week">Week</Label>
                <Input
                  id="deck-quick-week"
                  type="number"
                  min={1}
                  max={16}
                  value={deckForm.week}
                  onChange={(e) => setDeckForm((f) => ({ ...f, week: e.target.value }))}
                  placeholder="1"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="deck-quick-title">Title</Label>
                <Input
                  id="deck-quick-title"
                  value={deckForm.title}
                  onChange={(e) => setDeckForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Week 3: Control flow"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="deck-quick-desc">Description (optional)</Label>
                <Textarea
                  id="deck-quick-desc"
                  rows={2}
                  value={deckForm.description}
                  onChange={(e) => setDeckForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Short summary for the lecture list"
                  className="min-h-[72px] resize-y"
                />
              </div>
            </div>

            <LectureFileDropzone
              id="deck-quick-file"
              inputKey={deckFileInputKey}
              label="Slide deck file"
              hint="PDF, PPTX, or PPT · PowerPoint converts to PDF on the server when possible"
              accept={DECK_ACCEPT}
              file={deckFile}
              onFileChange={setDeckFile}
              chrome={chrome}
              fp={fp}
              icon={Presentation}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={deckForm.published}
                  onCheckedChange={(c) => setDeckForm((f) => ({ ...f, published: c === true }))}
                />
                <span className="text-sm">Published (visible to students)</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={deckForm.allowDownload}
                  onCheckedChange={(c) => setDeckForm((f) => ({ ...f, allowDownload: c === true }))}
                />
                <span className="text-sm">Allow students to download PDF</span>
              </label>
            </div>

            <details className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-[var(--cc-text-secondary)]">
                Session access
              </summary>
              <div className="mt-3 space-y-2 pb-1">
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={sessionAccess.all}
                    onCheckedChange={(checked) => {
                      setSessionAccess(
                        codes.length
                          ? createAllSessionAccess(codes, checked === true)
                          : { all: checked === true },
                      )
                    }}
                  />
                  <span className="text-sm">All sessions</span>
                </label>
                {!sessionAccess.all ? (
                  <div className="ml-1 space-y-2 border-t border-[var(--border)]/70 pt-2">
                    {accessRows.map(({ code, label, dotClass }) => (
                      <label key={code} className="flex cursor-pointer items-center gap-2">
                        <Checkbox
                          checked={!!sessionAccess[code]}
                          onCheckedChange={(checked) =>
                            setSessionAccess({ ...sessionAccess, [code]: checked === true })
                          }
                        />
                        <span className="flex items-center gap-2 text-sm">
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClass)} />
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            </details>

            <Button
              type="button"
              onClick={onCreateWithDeck}
              disabled={deckUploading}
              className={cn("w-full gap-2 sm:w-auto", fp.cta)}
            >
              {deckUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating and uploading…
                </>
              ) : (
                <>
                  <Presentation className="h-4 w-4" />
                  Create with slide deck
                </>
              )}
            </Button>
          </div>
        ) : null}

        {method === "json" ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <LectureFileDropzone
                id="json-file"
                label="JSON file"
                hint="Structured lecture export with slides array"
                accept=".json,application/json"
                chrome={chrome}
                fp={fp}
                icon={FileText}
              />
              <LectureFileDropzone
                id="image-files"
                label="Slide images (optional)"
                hint="PNG, JPG, or other images referenced in the JSON"
                accept="image/*"
                multiple
                chrome={chrome}
                fp={fp}
              />
            </div>

            <Button type="button" onClick={onJsonUpload} className={cn("gap-2", fp.cta)}>
              <Upload className="h-4 w-4" />
              Import lecture
            </Button>

            <details className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--cc-text-secondary)]">
                <FileText className="h-3.5 w-3.5" />
                JSON format example
              </summary>
              <pre className="mt-2 overflow-x-auto pb-1 text-[11px] leading-relaxed text-[var(--cc-text-muted)]">
{`{
  "title": "Week 1: Introduction",
  "week": 1,
  "description": "Course introduction",
  "session_access": { "SESSION_CODE": true },
  "slides": [{ "title": "Welcome", "content": "…", "image": "slide1.png" }]
}`}
              </pre>
            </details>
          </div>
        ) : null}
      </section>
    </div>
  )
}
