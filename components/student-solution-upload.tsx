"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Camera, CheckCircle2, Loader2, Paperclip, Trash2, Upload } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import type { SolutionUploadAttachment } from "@/lib/solution-upload"
import { solutionImageDisplayUrl } from "@/lib/heic-image"
import { beginSolutionUploadAntiCheatSuspension } from "@/lib/solution-upload-anti-cheat"
import { SolutionCameraDialog } from "@/components/solution-camera-dialog"
import { prefersNativeCameraCapture } from "@/lib/solution-camera"
import { compressUploadImageFile } from "@/lib/media/compress-image-client"

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,application/pdf"
const MAX_FILES = 8
/** Wait for native picker to close before treating focus as cancel (selection can lag focus). */
const PICKER_CANCEL_GRACE_MS = 1200

export function StudentSolutionUpload({
  partId = "_",
  label = "Upload worked solution",
  bonusPercent = 10,
  attachment,
  attachments,
  onChange,
  onAttachmentsChange,
  multiple = false,
  disabled,
  locked,
  attemptId,
  questionId,
  studentDatabaseId,
  hint,
  onAntiCheatSuspendChange,
  uploadEndpoint,
  uploadHeaders,
  requireStudentDatabaseId = true,
}: {
  partId?: string
  label?: string
  bonusPercent?: number
  /** Single-file mode (legacy) */
  attachment?: SolutionUploadAttachment | null
  onChange?: (next: SolutionUploadAttachment | null) => void
  /** Multi-file mode */
  attachments?: SolutionUploadAttachment[]
  onAttachmentsChange?: (next: SolutionUploadAttachment[]) => void
  multiple?: boolean
  disabled?: boolean
  locked?: boolean
  attemptId?: number | null
  questionId?: number | null
  studentDatabaseId?: number | null
  hint?: string
  onAntiCheatSuspendChange?: (suspended: boolean) => void
  uploadEndpoint?: string
  uploadHeaders?: Record<string, string>
  requireStudentDatabaseId?: boolean
}) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const nativeCameraRef = useRef<HTMLInputElement>(null)
  const useNativeCamera = prefersNativeCameraCapture()
  const [cameraOpen, setCameraOpen] = useState(false)
  const cameraOpenRef = useRef(false)
  const [uploading, setUploading] = useState(false)
  const uploadingRef = useRef(false)
  const pickingRef = useRef(false)
  const endSuspensionRef = useRef<(() => void) | null>(null)
  const pickerFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileListRef = useRef<SolutionUploadAttachment[]>([])
  const uploadChainRef = useRef<Promise<boolean>>(Promise.resolve(true))
  const dl = disabled || locked

  const fileList: SolutionUploadAttachment[] = multiple
    ? (attachments ?? [])
    : attachment
      ? [attachment]
      : []

  useEffect(() => {
    fileListRef.current = fileList
  }, [fileList])

  useEffect(() => {
    cameraOpenRef.current = cameraOpen
  }, [cameraOpen])

  const emitFiles = (next: SolutionUploadAttachment[]) => {
    if (multiple) {
      onAttachmentsChange?.(next)
    } else {
      onChange?.(next[0] ?? null)
    }
  }

  const clearPickerFocusTimer = () => {
    if (pickerFocusTimerRef.current) {
      clearTimeout(pickerFocusTimerRef.current)
      pickerFocusTimerRef.current = null
    }
  }

  const endSuspension = () => {
    clearPickerFocusTimer()
    endSuspensionRef.current?.()
    endSuspensionRef.current = null
    pickingRef.current = false
  }

  const beginSuspensionForPicker = () => {
    endSuspension()
    pickingRef.current = true
    endSuspensionRef.current = beginSolutionUploadAntiCheatSuspension(onAntiCheatSuspendChange)

    const onWindowFocus = () => {
      window.removeEventListener("focus", onWindowFocus)
      clearPickerFocusTimer()
      pickerFocusTimerRef.current = setTimeout(() => {
        pickerFocusTimerRef.current = null
        if (!pickingRef.current || uploadingRef.current) return
        if (fileRef.current?.files?.length) return
        if (cameraOpen) return
        endSuspension()
      }, PICKER_CANCEL_GRACE_MS)
    }
    window.addEventListener("focus", onWindowFocus)
  }

  const openFilePicker = () => {
    if (!pickingRef.current && !uploadingRef.current) beginSuspensionForPicker()
    fileRef.current?.click()
  }

  const openCamera = () => {
    if (!pickingRef.current && !uploadingRef.current) beginSuspensionForPicker()
    if (useNativeCamera) {
      nativeCameraRef.current?.click()
      return
    }
    setCameraOpen(true)
  }

  const handleCameraDialogChange = (open: boolean) => {
    setCameraOpen(open)
    if (!open && !uploadingRef.current) endSuspension()
  }

  const handleFileInputChange = (files: FileList | null | undefined) => {
    const list = files ? Array.from(files) : []
    if (list.length === 0) {
      endSuspension()
      return
    }
    clearPickerFocusTimer()
    for (const f of list) {
      void queueUpload(f)
    }
  }

  /** Compress off the upload lock, then serialize network writes. */
  const queueUpload = (file: File): Promise<boolean> => {
    const compressed = compressUploadImageFile(file)
    const task = uploadChainRef.current.then(async () => uploadFile(await compressed))
    uploadChainRef.current = task.catch(() => false)
    return task
  }

  const uploadFile = async (file: File): Promise<boolean> => {
    if (!attemptId || !questionId || (requireStudentDatabaseId && !studentDatabaseId)) {
      endSuspension()
      toast({
        title: "Cannot upload yet",
        description: requireStudentDatabaseId
          ? "Start the quiz attempt before attaching files."
          : "Missing attempt or question context.",
        variant: "destructive",
      })
      return false
    }
    const current = fileListRef.current
    if (multiple && current.length >= MAX_FILES) {
      endSuspension()
      toast({
        title: "Upload limit reached",
        description: `You can attach up to ${MAX_FILES} files per solution.`,
        variant: "destructive",
      })
      return false
    }
    pickingRef.current = false
    uploadingRef.current = true
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("attemptId", String(attemptId))
      fd.append("questionId", String(questionId))
      fd.append("partId", partId)
      if (studentDatabaseId) fd.append("studentId", String(studentDatabaseId))
      const res = await fetch(uploadEndpoint ?? "/api/student/quiz-solution-upload", {
        method: "POST",
        body: fd,
        headers: uploadHeaders,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Upload failed")
      const uploaded: SolutionUploadAttachment = {
        url: data.url,
        name: data.name || file.name,
        mime: data.mime || file.type,
        uploaded_at: data.uploaded_at,
      }
      const next = multiple ? [...fileListRef.current, uploaded] : [uploaded]
      fileListRef.current = next
      emitFiles(next)
      toast({
        title: multiple && next.length > 1 ? "Image added" : "Solution attached",
        description: multiple
          ? `${next.length} file${next.length === 1 ? "" : "s"} attached.`
          : `+${bonusPercent}% attempt bonus when you submit this question.`,
      })
      return multiple ? next.length < MAX_FILES : false
    } catch (e) {
      toast({
        title: "Upload failed",
        description: e instanceof Error ? e.message : "Could not upload file",
        variant: "destructive",
      })
      return false
    } finally {
      uploadingRef.current = false
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
      if (!cameraOpenRef.current) endSuspension()
    }
  }

  const removeAt = (index: number) => {
    const next = fileListRef.current.filter((_, i) => i !== index)
    fileListRef.current = next
    emitFiles(next)
  }

  const canAddMore = !multiple || fileList.length < MAX_FILES

  return (
    <div
      className={cn(
        "rounded-lg border border-dashed p-3 space-y-3",
        fileList.length > 0
          ? "border-emerald-300/80 bg-emerald-50/40 dark:border-emerald-800/50 dark:bg-emerald-950/20"
          : "border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5 shrink-0" />
            {label}
          </Label>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
            {hint ??
              (multiple
                ? `Attach one or more images or PDFs of your worked solution (up to ${MAX_FILES} files).`
                : `Optional: attach your work to support your answer. Earn up to +${bonusPercent}% bonus on this question.`)}
          </p>
        </div>
      </div>

      {fileList.length > 0 ? (
        <div className="space-y-3">
          {fileList.map((att, index) => {
            const isPdf =
              att.mime === "application/pdf" || att.name?.toLowerCase().endsWith(".pdf")
            return (
              <div
                key={`${att.url}-${index}`}
                className="rounded-md border border-emerald-200/80 dark:border-emerald-800/50 bg-white dark:bg-slate-900 p-2 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200 min-w-0">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-medium truncate">
                      {multiple ? `${index + 1}. ` : ""}
                      {att.name}
                    </span>
                  </div>
                  {!dl && !uploading ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-red-600 hover:text-red-700"
                      onClick={() => removeAt(index)}
                      aria-label={`Remove ${att.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
                {isPdf ? (
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 dark:text-indigo-400 underline"
                  >
                    View PDF
                  </a>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={solutionImageDisplayUrl(att.url, att.mime, att.name)}
                    alt={att.name || "Uploaded solution"}
                    className="max-h-48 w-full object-contain rounded"
                  />
                )}
              </div>
            )
          })}
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          handleFileInputChange(e.target.files)
          if (fileRef.current) fileRef.current.value = ""
        }}
      />
      <input
        ref={nativeCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            clearPickerFocusTimer()
            void queueUpload(f).then((canMore) => {
              if (multiple && canMore && nativeCameraRef.current) {
                // Keep suspension while student may capture another page on mobile.
                pickingRef.current = true
              }
            })
          } else {
            endSuspension()
          }
          if (nativeCameraRef.current) nativeCameraRef.current.value = ""
        }}
      />
      {!useNativeCamera ? (
        <SolutionCameraDialog
          open={cameraOpen}
          onOpenChange={handleCameraDialogChange}
          allowMultiple={multiple}
          onCapture={async (file) => {
            clearPickerFocusTimer()
            return queueUpload(file)
          }}
        />
      ) : null}

      {!dl && canAddMore ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={uploading}
            onPointerDown={() => {
              if (!uploading) beginSuspensionForPicker()
            }}
            onClick={openFilePicker}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-1.5" />
            )}
            {uploading
              ? "Uploading…"
              : multiple && fileList.length > 0
                ? "Add another file"
                : "Choose file"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={uploading}
            onClick={openCamera}
          >
            <Camera className="h-3.5 w-3.5 mr-1.5" />
            {multiple && fileList.length > 0 ? "Add photo" : "Take photo"}
          </Button>
        </div>
      ) : null}
    </div>
  )
}











