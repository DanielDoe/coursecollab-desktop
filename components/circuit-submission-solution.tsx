"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Loader2,
  Paperclip,
  Trash2,
  Upload,
  FileText,
  ImageIcon,
  Camera,
  PenLine,
  Maximize2,
  CheckCircle2,
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import type { SolutionUploadAttachment, SolutionUploadsMap } from "@/lib/solution-upload"
import { solutionImageDisplayUrl } from "@/lib/heic-image"
import { beginSolutionUploadAntiCheatSuspension } from "@/lib/solution-upload-anti-cheat"
import { SolutionCameraDialog } from "@/components/solution-camera-dialog"
import { prefersNativeCameraCapture } from "@/lib/solution-camera"
import { compressUploadImageFile } from "@/lib/media/compress-image-client"
import { CircuitWorkspaceEditor } from "@/components/circuit-workspace-editor"
import { CircuitWorkspaceExpandedDialog } from "@/components/circuit-workspace-expanded-dialog"
import {
  CIRCUIT_SUBMISSION_ACCEPT,
  CIRCUIT_SUBMISSION_MAX_FILES,
  circuitSubmissionPartKey,
  listCircuitSubmissionFiles,
  type CircuitSubmissionConfig,
} from "@/lib/circuit-submission"
import {
  createEmptyWorkspace,
  parseCircuitWorkspace,
  workspaceHasContent,
  workspacePagesWithContent,
  type CircuitSubmissionMode,
  type CircuitWorkspace,
} from "@/lib/circuit-workspace"
import { exportCircuitWorkspaceUploads } from "@/lib/circuit-workspace-export"

const PICKER_CANCEL_GRACE_MS = 1200
const PHOTO_ACCEPT = "image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"

const MODE_OPTIONS: { id: CircuitSubmissionMode; label: string; icon: typeof Upload }[] = [
  { id: "upload", label: "Upload", icon: Upload },
  { id: "photo", label: "Add photo", icon: Camera },
  { id: "workspace", label: "Workspace", icon: PenLine },
]

export function CircuitSubmissionSolution({
  config,
  uploads,
  onUploadsChange,
  submissionMode,
  onSubmissionModeChange,
  workspace,
  onWorkspaceChange,
  replayRecorderRef,
  disabled,
  locked,
  attemptId,
  questionId,
  studentDatabaseId,
  onAntiCheatSuspendChange,
  onRegisterWorkspaceFlush,
  onRegisterWorkspaceExport,
  question,
  uploadEndpoint,
  uploadHeaders,
  requireStudentDatabaseId = true,
  uploadExtraFields,
  recoveryMode = false,
  workspaceOnly = false,
}: {
  config: CircuitSubmissionConfig
  uploads: SolutionUploadsMap
  onUploadsChange: (next: SolutionUploadsMap) => void
  submissionMode: CircuitSubmissionMode
  onSubmissionModeChange: (mode: CircuitSubmissionMode) => void
  workspace: CircuitWorkspace | null
  onWorkspaceChange: (next: CircuitWorkspace | null, options?: { flush?: boolean }) => void
  replayRecorderRef?: React.MutableRefObject<import("@/lib/workspace-replay").WorkspaceReplayRecorder>
  disabled?: boolean
  locked?: boolean
  attemptId?: number | null
  questionId?: number | null
  studentDatabaseId?: number | null
  onAntiCheatSuspendChange?: (suspended: boolean) => void
  onRegisterWorkspaceFlush?: (flush: () => void) => void
  /** Await in-flight or run workspace PNG export (quiz navigation / submit). */
  onRegisterWorkspaceExport?: (exporter: () => Promise<boolean>) => void
  question?: {
    question_text: string
    question_media?: unknown
    circuit_spec?: unknown
    title?: string | null
  }
  /** Override upload API (e.g. faculty on-behalf recovery). */
  uploadEndpoint?: string
  uploadHeaders?: Record<string, string>
  requireStudentDatabaseId?: boolean
  uploadExtraFields?: Record<string, string>
  /** Faculty recovery: upload-only, no workspace/photo modes. */
  recoveryMode?: boolean
  /** In-lecture workspace: ink canvas only — no upload, photo, or submission export. */
  workspaceOnly?: boolean
}) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const nativeCameraRef = useRef<HTMLInputElement>(null)
  const useNativeCamera = prefersNativeCameraCapture()
  const [cameraOpen, setCameraOpen] = useState(false)
  const cameraOpenRef = useRef(false)
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [expandedOpen, setExpandedOpen] = useState(false)
  const uploadingRef = useRef(false)
  const pickingRef = useRef(false)
  const endSuspensionRef = useRef<(() => void) | null>(null)
  const pickerFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dl = disabled || locked
  const maxFiles = config.max_files ?? CIRCUIT_SUBMISSION_MAX_FILES
  const files = listCircuitSubmissionFiles(uploads)
  const ws = workspace ?? createEmptyWorkspace()
  const workspaceRef = useRef(ws)
  const flushWorkspaceRef = useRef<(() => void) | null>(null)
  const exportInFlightRef = useRef<Promise<boolean> | null>(null)
  useEffect(() => {
    workspaceRef.current = ws
  }, [ws])

  useEffect(() => {
    if (!onRegisterWorkspaceFlush) return
    onRegisterWorkspaceFlush(() => {
      flushWorkspaceRef.current?.()
    })
  }, [onRegisterWorkspaceFlush])

  const handleWorkspaceChange = useCallback(
    (next: CircuitWorkspace, options?: { flush?: boolean }) => {
      workspaceRef.current = next
      onWorkspaceChange(next, options)
    },
    [onWorkspaceChange],
  )
  const hasWorkspaceContent = workspaceHasContent(ws)

  useEffect(() => {
    cameraOpenRef.current = cameraOpen
  }, [cameraOpen])

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
        if (photoRef.current?.files?.length) return
        if (nativeCameraRef.current?.files?.length) return
        if (cameraOpenRef.current) return
        endSuspension()
      }, PICKER_CANCEL_GRACE_MS)
    }
    window.addEventListener("focus", onWindowFocus)
  }

  const removeFile = (partKey: string) => {
    const next = { ...uploads }
    delete next[partKey]
    onUploadsChange(next)
  }

  const uploadFile = useCallback(
    async (file: File, partIdOverride?: string) => {
      if (!attemptId || !questionId || (requireStudentDatabaseId && !studentDatabaseId)) {
        endSuspension()
        toast({
          title: "Cannot upload yet",
          description: requireStudentDatabaseId
            ? "Start the assessment attempt before attaching files."
            : "Missing attempt or question context.",
          variant: "destructive",
        })
        return false
      }
      if (!partIdOverride && files.length >= maxFiles) {
        endSuspension()
        toast({
          title: "File limit reached",
          description: `Maximum ${maxFiles} files allowed.`,
          variant: "destructive",
        })
        return false
      }

      pickingRef.current = false
      const compressed = compressUploadImageFile(file)
      uploadingRef.current = true
      setUploading(true)
      try {
        const partId = partIdOverride ?? circuitSubmissionPartKey(files.length)
        const fd = new FormData()
        fd.append("file", await compressed)
        fd.append("attemptId", String(attemptId))
        fd.append("questionId", String(questionId))
        fd.append("partId", partId)
        if (studentDatabaseId) fd.append("studentId", String(studentDatabaseId))
        fd.append("uploadKind", "circuit_submission")
        if (uploadExtraFields) {
          for (const [key, value] of Object.entries(uploadExtraFields)) {
            fd.append(key, value)
          }
        }
        const res = await fetch(uploadEndpoint ?? "/api/student/quiz-solution-upload", {
          method: "POST",
          body: fd,
          headers: uploadHeaders,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Upload failed")
        const att: SolutionUploadAttachment = {
          url: data.url,
          name: data.name || file.name,
          mime: data.mime || file.type,
          uploaded_at: data.uploaded_at,
        }
        onUploadsChange({ ...uploads, [partId]: att })
        toast({ title: "File attached", description: file.name })
        return true
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
        if (photoRef.current) photoRef.current.value = ""
        if (nativeCameraRef.current) nativeCameraRef.current.value = ""
        if (!cameraOpenRef.current) endSuspension()
      }
    },
    [
      attemptId,
      questionId,
      studentDatabaseId,
      requireStudentDatabaseId,
      files.length,
      maxFiles,
      onUploadsChange,
      uploads,
      toast,
      uploadEndpoint,
      uploadHeaders,
      uploadExtraFields,
    ],
  )

  const exportWorkspace = useCallback(
    async (
      snapshot?: CircuitWorkspace,
      options?: { silent?: boolean },
    ): Promise<boolean> => {
      if (exportInFlightRef.current) return exportInFlightRef.current

      const run = async (): Promise<boolean> => {
        flushWorkspaceRef.current?.()
        const current = parseCircuitWorkspace(snapshot ?? workspaceRef.current) ?? workspaceRef.current
        const pages = workspacePagesWithContent(current)
        if (pages.length === 0) {
          if (!options?.silent) {
            toast({
              title: "Nothing to save",
              description: "Draw your solution in the workspace first.",
              variant: "destructive",
            })
          }
          return false
        }
        if (!attemptId || !questionId || (requireStudentDatabaseId && !studentDatabaseId)) {
          if (!options?.silent) {
            toast({
              title: "Cannot save yet",
              description: requireStudentDatabaseId
                ? "Start the assessment attempt before saving your workspace."
                : "Missing lecture or question context.",
              variant: "destructive",
            })
          }
          return false
        }

        setExporting(true)
        try {
          const nextUploads = await exportCircuitWorkspaceUploads({
            workspace: current,
            attemptId,
            questionId,
            studentDatabaseId: studentDatabaseId ?? 0,
            title: question?.title ?? undefined,
            uploadEndpoint,
            uploadExtraFields,
          })
          onUploadsChange(nextUploads)
          if (!options?.silent) {
            toast({
              title: "Workspace saved",
              description: `${pages.length} page${pages.length === 1 ? "" : "s"} exported as high-resolution images for grading.`,
            })
          }
          return true
        } catch (e) {
          if (!options?.silent) {
            toast({
              title: "Save failed",
              description: e instanceof Error ? e.message : "Could not save workspace",
              variant: "destructive",
            })
          }
          return false
        } finally {
          setExporting(false)
        }
      }

      const pending = run()
      exportInFlightRef.current = pending
      try {
        return await pending
      } finally {
        if (exportInFlightRef.current === pending) {
          exportInFlightRef.current = null
        }
      }
    },
    [attemptId, questionId, studentDatabaseId, requireStudentDatabaseId, question?.title, onUploadsChange, toast, uploadEndpoint, uploadExtraFields],
  )

  useEffect(() => {
    if (!onRegisterWorkspaceExport) return
    onRegisterWorkspaceExport(async () => exportWorkspace(undefined, { silent: true }))
  }, [onRegisterWorkspaceExport, exportWorkspace])

  const switchMode = (mode: CircuitSubmissionMode) => {
    if (dl || mode === submissionMode) return
    onSubmissionModeChange(mode)
  }

  const openFilePicker = () => {
    if (!pickingRef.current && !uploadingRef.current) beginSuspensionForPicker()
    fileRef.current?.click()
  }

  const openPhoto = () => {
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

  const handleFiles = (fileList: FileList | File[] | null | undefined) => {
    const arr = fileList ? Array.from(fileList) : []
    if (arr.length === 0) return
    void uploadFile(arr[0])
  }

  const workspaceExported =
    submissionMode === "workspace" &&
    files.length > 0 &&
    files.some((f) => f.name?.startsWith("workspace-page"))
  const hasSolution =
    submissionMode === "workspace"
      ? hasWorkspaceContent || files.length > 0
      : files.length > 0
  const showModeTabs = !recoveryMode && !workspaceOnly
  const activeMode = workspaceOnly ? "workspace" : submissionMode

  return (
    <div
      className={cn(
        workspaceOnly
          ? "space-y-3"
          : "rounded-xl border-2 border-dashed p-4 sm:p-5 space-y-4 transition-colors",
        !workspaceOnly &&
          (dragOver && submissionMode === "upload"
            ? "border-indigo-400 bg-indigo-50/60 dark:border-indigo-500 dark:bg-indigo-950/30"
            : "border-indigo-200/80 dark:border-indigo-800/60 bg-indigo-50/30 dark:bg-indigo-950/15"),
      )}
      onDragOver={(e) => {
        if (workspaceOnly || submissionMode !== "upload") return
        e.preventDefault()
        if (!dl) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (workspaceOnly || submissionMode !== "upload") return
        e.preventDefault()
        setDragOver(false)
        if (dl || uploading) return
        beginSuspensionForPicker()
        handleFiles(e.dataTransfer.files)
      }}
    >
      {!workspaceOnly ? (
        <div className="space-y-1">
          <Label className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <Paperclip className="h-4 w-4 shrink-0" />
            Your solution (required)
          </Label>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {config.submission_instructions ??
              "Upload, photograph, or write your complete worked solution. Include derivations, equations, and steps."}
          </p>
        </div>
      ) : null}

      {showModeTabs ? (
      <div className="flex items-center gap-1.5 sm:gap-2 w-full min-w-0 overflow-x-auto">
        {MODE_OPTIONS.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            variant={submissionMode === id ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-9 text-xs flex-1 sm:flex-none px-2.5 sm:px-3",
              submissionMode === id
                ? "shadow-sm"
                : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700",
            )}
            disabled={dl}
            onClick={() => switchMode(id)}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="ml-1.5 whitespace-nowrap">{label}</span>
          </Button>
        ))}
      </div>
      ) : null}

      {!workspaceOnly ? (
      <>
      <input
        ref={fileRef}
        type="file"
        accept={CIRCUIT_SUBMISSION_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          clearPickerFocusTimer()
          if (f) void uploadFile(f)
          else endSuspension()
        }}
      />
      <input
        ref={photoRef}
        type="file"
        accept={PHOTO_ACCEPT}
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          clearPickerFocusTimer()
          if (f) void uploadFile(f)
          else endSuspension()
        }}
      />
      <input
        ref={nativeCameraRef}
        type="file"
        accept={PHOTO_ACCEPT}
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          clearPickerFocusTimer()
          if (f) void uploadFile(f)
          else endSuspension()
        }}
      />
      </>
      ) : null}

      {!workspaceOnly && submissionMode === "upload" ? (
        <>
          {files.length > 0 ? (
            <ul className="space-y-2">
              {Object.entries(uploads)
                .filter(([, att]) => att?.url?.trim())
                .map(([partKey, att]) => (
                  <li
                    key={partKey}
                    className="flex items-center gap-2 rounded-lg border border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2 text-xs"
                  >
                    {att.mime === "application/pdf" ? (
                      <FileText className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                    ) : (
                      <ImageIcon className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                    )}
                    <span className="font-medium truncate flex-1 text-emerald-900 dark:text-emerald-100">{att.name}</span>
                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="underline shrink-0 text-emerald-800 dark:text-emerald-200">
                      Preview
                    </a>
                    {!dl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-red-600 hover:text-red-700"
                        disabled={uploading}
                        onClick={() => removeFile(partKey)}
                        aria-label="Remove file"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </li>
                ))}
            </ul>
          ) : null}

          {files.length < maxFiles ? (
            <div className="space-y-3">
              <button
                type="button"
                disabled={dl || uploading}
                onPointerDown={() => {
                  if (!uploading) beginSuspensionForPicker()
                }}
                onClick={openFilePicker}
                className={cn(
                  "w-full flex flex-col items-center justify-center gap-2 text-center transition-colors rounded-lg",
                  files.length > 0 ? "py-6 px-4" : "py-10 sm:py-12 px-4",
                  dragOver && "bg-indigo-50/70 dark:bg-indigo-950/40",
                  !dragOver && "hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20",
                  (dl || uploading) && "opacity-50 cursor-not-allowed",
                )}
              >
              <div
                className={cn(
                  "rounded-full p-3 transition-colors",
                  dragOver
                    ? "bg-indigo-100 dark:bg-indigo-900/50"
                    : "bg-indigo-50 dark:bg-indigo-950/40",
                )}
              >
                {uploading ? (
                  <Loader2 className="h-7 w-7 text-indigo-600 dark:text-indigo-400 animate-spin" />
                ) : (
                  <Upload
                    className={cn(
                      "h-7 w-7",
                      dragOver
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-indigo-500 dark:text-indigo-400",
                    )}
                  />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {uploading
                    ? "Uploading…"
                    : dragOver
                      ? "Drop files here"
                      : files.length > 0
                        ? "Add another file"
                        : "Drag & drop files here"}
                </p>
                {!uploading ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    or click to browse
                  </p>
                ) : null}
                <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-2">
                  Up to {maxFiles} files · 25 MB each · PDF, PNG, JPG, WEBP, HEIC
                </p>
              </div>
            </button>
            </div>
          ) : null}
        </>
      ) : null}

      {!workspaceOnly && submissionMode === "photo" ? (
        <>
          {files.length > 0 ? (
            <div className="space-y-2">
              {files.map((att, i) => (
                <div
                  key={`${att.url}-${i}`}
                  className="rounded-lg border border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-950/20 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-medium truncate">{att.name}</span>
                    </div>
                    {!dl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-red-600"
                        disabled={uploading}
                        onClick={() => {
                          const key = Object.entries(uploads).find(([, a]) => a.url === att.url)?.[0]
                          if (key) removeFile(key)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={solutionImageDisplayUrl(att.url, att.mime, att.name)}
                    alt={att.name || "Photo solution"}
                    className="max-h-48 w-full object-contain rounded-md border border-slate-200/80 dark:border-slate-600 bg-white"
                  />
                </div>
              ))}
            </div>
          ) : null}

          {files.length < maxFiles ? (
            <button
              type="button"
              disabled={dl || uploading}
              onPointerDown={() => {
                if (!uploading) beginSuspensionForPicker()
              }}
              onClick={openPhoto}
              className={cn(
                "w-full flex flex-col items-center justify-center gap-2 text-center transition-colors rounded-lg",
                files.length > 0 ? "py-6 px-4" : "py-10 sm:py-12 px-4",
                "hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20",
                (dl || uploading) && "opacity-50 cursor-not-allowed",
              )}
            >
              <div className="rounded-full p-3 bg-indigo-50 dark:bg-indigo-950/40">
                {uploading ? (
                  <Loader2 className="h-7 w-7 text-indigo-600 dark:text-indigo-400 animate-spin" />
                ) : (
                  <Camera className="h-7 w-7 text-indigo-500 dark:text-indigo-400" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {uploading ? "Uploading…" : files.length > 0 ? "Add another photo" : "Take a photo of your work"}
                </p>
                {!uploading ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {useNativeCamera ? "Tap to open your camera" : "Opens your webcam — not the file picker"}
                  </p>
                ) : null}
                <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-2">
                  Best for iPad — capture handwritten work. Up to {maxFiles} photos.
                </p>
              </div>
            </button>
          ) : null}
        </>
      ) : null}

      {!workspaceOnly && !useNativeCamera ? (
        <SolutionCameraDialog
          open={cameraOpen}
          onOpenChange={handleCameraDialogChange}
          onCapture={(file) => {
            clearPickerFocusTimer()
            return uploadFile(file)
          }}
        />
      ) : null}

      {activeMode === "workspace" ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-600/80 bg-white dark:bg-slate-900/80 p-3 sm:p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {workspaceOnly ? "In-class workspace" : "Handwriting workspace"}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Pen, highlighter, shapes &amp; eraser — works with any stylus or finger
                </p>
              </div>
              {!workspaceOnly && workspaceExported ? (
                <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1 shrink-0 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-full">
                  <CheckCircle2 className="h-3 w-3" />
                  Saved for grading
                </span>
              ) : !workspaceOnly && hasWorkspaceContent ? (
                <span className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-full">
                  Unsaved changes
                </span>
              ) : null}
            </div>

            <CircuitWorkspaceEditor
              workspace={ws}
              onChange={handleWorkspaceChange}
              onRegisterFlush={(flush) => {
                flushWorkspaceRef.current = flush
              }}
              replayRecorderRef={replayRecorderRef}
              disabled={dl || exporting}
              compact
            />

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-9 text-xs shadow-sm"
                disabled={dl || exporting}
                onClick={() => setExpandedOpen(true)}
              >
                <Maximize2 className="h-4 w-4 mr-1.5" />
                Expand workspace
              </Button>
              {!workspaceOnly ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs"
                  disabled={dl || exporting || !hasWorkspaceContent}
                  onClick={() => void exportWorkspace()}
                >
                  {exporting ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  )}
                  {exporting ? "Saving…" : "Save to submission"}
                </Button>
              ) : null}
            </div>
          </div>

          {!workspaceOnly && files.length > 0 && workspaceExported ? (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
              {files.length} high-resolution page{files.length === 1 ? "" : "s"} attached for AI and instructor grading.
            </p>
          ) : !workspaceOnly ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Add pages as needed. Save exports your notes as PNG images for grading.
            </p>
          ) : null}

          {question ? (
            <CircuitWorkspaceExpandedDialog
              open={expandedOpen}
              onOpenChange={setExpandedOpen}
              workspace={ws}
              onWorkspaceChange={handleWorkspaceChange}
              onRegisterFlush={(flush) => {
                flushWorkspaceRef.current = flush
              }}
              replayRecorderRef={replayRecorderRef}
              onSave={(snapshot) => exportWorkspace(snapshot)}
              saving={exporting}
              disabled={dl}
              question={question}
            />
          ) : null}
        </div>
      ) : null}

      {!workspaceOnly && !hasSolution ? (
        <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
          {submissionMode === "workspace"
            ? "Write your solution in the workspace — it auto-saves when you go to the next question."
            : "At least one file is required before you submit this question."}
        </p>
      ) : null}
    </div>
  )
}
