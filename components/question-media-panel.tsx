"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useRef, useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown, Crop, FileImage, ImageIcon, Loader2, Trash2, Upload } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import {
  questionBankSectionClass,
  questionBankSectionHeaderClass,
} from "@/lib/question-bank-ui"
import {
  DEFAULT_QUESTION_MEDIA,
  hasActiveQuestionMedia,
  inferQuestionMediaType,
  isPublicMediaUrl,
  parseQuestionMedia,
  type QuestionMedia,
  type QuestionMediaPlacement,
  type QuestionMediaType,
} from "@/lib/question-media"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"
import { QuestionMediaCropDialog } from "@/components/question-media-crop-dialog"
import { questionMediaDisplayUrl } from "@/lib/question-media-proxy"

interface Props {
  media: QuestionMedia | null | undefined
  onChange: (next: QuestionMedia) => void
  /** Admin routes have no upload API yet — URL paste only */
  allowUpload?: boolean
  /** Force single-column fields + preview (use inside narrow modals) */
  layout?: "default" | "stacked"
  /** Reduce outer chrome when nested inside another form */
  embedded?: boolean
  /** Persist media to the server immediately after upload/crop (quiz edit). */
  onPersist?: (media: QuestionMedia) => Promise<boolean>
}

const ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,application/pdf"

export function QuestionMediaPanel({
  media,
  onChange,
  allowUpload = true,
  layout = "default",
  embedded = false,
  onPersist,
}: Props) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [cropOpen, setCropOpen] = useState(false)

  const m = { ...DEFAULT_QUESTION_MEDIA, ...parseQuestionMedia(media) }
  const patch = (p: Partial<QuestionMedia>) => onChange({ ...m, ...p })

  const handleUpload = async (file: File) => {
    if (!allowUpload) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await instructorApiFetch("/api/instructor/question-media/upload", {
        method: "POST",
        headers: getInstructorScopeHeaders() as Record<string, string>,
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Upload failed")
      const nextMedia: QuestionMedia = {
        ...m,
        media_enabled: true,
        media_url: data.url,
        media_type:
          (data.media_type as QuestionMediaType) ||
          inferQuestionMediaType(data.url, file.type),
      }
      onChange(nextMedia)
      if (onPersist) {
        const saved = await onPersist(nextMedia)
        toast({
          title: saved ? "Diagram saved" : "Upload complete — save needed",
          description: saved
            ? "The figure is stored on this question."
            : "Could not auto-save. Click Save Changes to keep it.",
          variant: saved ? "default" : "destructive",
        })
      } else {
        toast({ title: "Media uploaded", description: "Diagram attached to this question." })
      }
    } catch (e) {
      toast({
        title: "Upload failed",
        description: e instanceof Error ? e.message : "Could not upload file",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const onFiles = (files: FileList | null) => {
    const f = files?.[0]
    if (!f) return
    if (!m.media_enabled) patch({ media_enabled: true })
    void handleUpload(f)
  }

  const clearMedia = () => {
    onChange({ ...DEFAULT_QUESTION_MEDIA })
  }

  const previewUrl = hasActiveQuestionMedia(m) ? (m.media_url || "").trim() : ""
  const previewDisplayUrl = previewUrl ? questionMediaDisplayUrl(previewUrl) : ""
  const canCrop =
    allowUpload &&
    Boolean(previewUrl) &&
    isPublicMediaUrl(previewUrl) &&
    m.media_type !== "pdf" &&
    m.media_type !== "svg" &&
    !previewUrl.toLowerCase().endsWith(".pdf")

  return (
    <section
      className={cn(
        embedded ? "rounded-xl border border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-900/30" : questionBankSectionClass,
        embedded ? "" : "mt-1",
      )}
    >
      <div
        className={cn(
          embedded
            ? "flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3 dark:border-slate-700"
            : cn(questionBankSectionHeaderClass, "flex flex-wrap items-center justify-between gap-3"),
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
            <ImageIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Diagram & media</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Circuit figures, schematics, or reference PDFs
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Switch
            id="media-enabled"
            checked={!!m.media_enabled}
            onCheckedChange={(v) => patch({ media_enabled: v })}
          />
          <Label htmlFor="media-enabled" className="cursor-pointer text-xs text-slate-600 dark:text-slate-400">
            Enabled
          </Label>
        </div>
      </div>

      <div className={cn(embedded ? "p-4" : "p-4 sm:p-5")}>
        <div className="space-y-4">
          {allowUpload ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => onFiles(e.target.files)}
              />
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileRef.current?.click()
                }}
                onDragEnter={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  onFiles(e.dataTransfer.files)
                }}
                onClick={() => !uploading && fileRef.current?.click()}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors cursor-pointer",
                  dragOver
                    ? "border-indigo-400 bg-indigo-50/80 dark:border-indigo-500 dark:bg-indigo-950/30"
                    : "border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-slate-600 dark:bg-slate-900/30 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/20",
                  uploading && "pointer-events-none opacity-70",
                )}
              >
                {uploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <Upload className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {uploading ? "Uploading…" : "Drop image or PDF here"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    PNG, JPEG, WebP, GIF, SVG, or PDF · click to browse
                    {!m.media_enabled ? " · enables diagram automatically" : ""}
                  </p>
                </div>
              </div>
            </>
          ) : null}

          {!m.media_enabled ? (
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Upload a figure above or turn on <strong>Enabled</strong> to paste a media URL.
              Students see the diagram above or beside the stem during quizzes.
            </p>
          ) : null}

          {m.media_enabled ? (
            <div
              className={cn(
                "grid gap-5",
                layout === "stacked" ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-2",
              )}
            >
              <div className="min-w-0 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Media URL
                  </Label>
                  <Input
                    value={m.media_url ?? ""}
                    onChange={(e) => {
                      const url = e.target.value.trim()
                      patch({
                        media_url: url || null,
                        media_type: url ? inferQuestionMediaType(url) : m.media_type,
                      })
                    }}
                    placeholder="https://… or /uploads/question-media/…"
                    className="text-sm h-9"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Type</Label>
                    <Select
                      value={m.media_type || "image"}
                      onValueChange={(v) => patch({ media_type: v as QuestionMediaType })}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="svg">SVG</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Placement
                    </Label>
                    <Select
                      value={m.media_placement || "above_question"}
                      onValueChange={(v) => patch({ media_placement: v as QuestionMediaPlacement })}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="above_question">Above question</SelectItem>
                        <SelectItem value="below_question">Below question</SelectItem>
                        <SelectItem value="side_by_side">Side by side</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Caption</Label>
                  <Input
                    value={m.media_caption ?? ""}
                    onChange={(e) => patch({ media_caption: e.target.value || null })}
                    placeholder="e.g. Figure P1.5"
                    className="text-sm h-9"
                  />
                </div>

                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1">
                      <ChevronDown
                        className={cn("h-3.5 w-3.5 transition-transform", advancedOpen && "rotate-180")}
                      />
                      Accessibility & zoom
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Alt text
                      </Label>
                      <Textarea
                        value={m.media_alt_text ?? ""}
                        onChange={(e) => patch({ media_alt_text: e.target.value || null })}
                        rows={2}
                        className="text-sm resize-none"
                        placeholder="Describe the diagram for screen readers"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="media-zoom"
                        checked={m.media_allow_zoom !== false}
                        onCheckedChange={(v) => patch({ media_allow_zoom: v })}
                      />
                      <Label htmlFor="media-zoom" className="text-xs cursor-pointer text-slate-600 dark:text-slate-400">
                        Allow students to zoom / fullscreen
                      </Label>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {hasActiveQuestionMedia(m) ? (
                  <div className="flex flex-wrap gap-2">
                    {canCrop ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        onClick={() => setCropOpen(true)}
                      >
                        <Crop className="h-3.5 w-3.5 mr-1.5" />
                        Crop diagram
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                      onClick={clearMedia}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Remove media
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="flex min-h-[14rem] min-w-0 flex-col rounded-xl border border-slate-200/80 bg-slate-50/50 dark:border-slate-600 dark:bg-slate-900/40">
                <div className="flex items-center gap-2 border-b border-slate-200/70 px-3 py-2 dark:border-slate-600">
                  <FileImage className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Live preview
                  </span>
                </div>
                <div className="flex min-h-[12rem] flex-1 items-center justify-center p-4">
                  {previewUrl && isPublicMediaUrl(previewUrl) ? (
                    m.media_type === "pdf" ? (
                      <iframe
                        src={`${previewDisplayUrl}#toolbar=0`}
                        title="Preview"
                        className="h-52 w-full rounded-lg border-0 bg-white dark:bg-slate-900"
                      />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        key={previewDisplayUrl}
                        src={previewDisplayUrl}
                        alt={m.media_alt_text || "Preview"}
                        className="max-h-56 w-full object-contain"
                      />
                    )
                  ) : (
                    <p className="px-4 text-center text-xs text-slate-500 dark:text-slate-400">
                      {previewUrl
                        ? "URL must be public to preview"
                        : "Upload or paste a URL to preview how students will see the diagram"}
                    </p>
                  )}
                </div>
                {m.media_caption ? (
                  <p className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200/70 dark:border-slate-600 italic">
                    {m.media_caption}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {canCrop && previewDisplayUrl ? (
        <QuestionMediaCropDialog
          open={cropOpen}
          onOpenChange={setCropOpen}
          imageUrl={previewDisplayUrl}
          onCropped={handleUpload}
        />
      ) : null}
    </section>
  )
}

export function readQuestionMediaFromRow(q: { question_media?: unknown }): QuestionMedia {
  return parseQuestionMedia(q.question_media)
}
