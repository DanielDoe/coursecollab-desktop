"use client"

import { studentApiFetch } from "@/lib/auth"
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ChevronLeft, Loader2, Mic, Upload } from "lucide-react"
import { toast } from "@/lib/app-toast"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { LiveSpeechCaptions } from "@/components/ai-notetaker/live-speech-captions"
import { NotetakerFloatingRecordBar } from "@/components/ai-notetaker/notetaker-floating-record-bar"
import { useDashboardV2 } from "@/components/student/dashboard-v2/DashboardV2Context"
import { createAudioMediaRecorder } from "@/lib/mediarecorder-audio-mime"
import { getNotetakerRecordingAudioConstraints } from "@/lib/notetaker-recording-audio"
import { createNotetakerMicGainBridge } from "@/lib/notetaker-mic-gain"
import { useMicLevelMeter } from "@/hooks/use-mic-level-meter"
import { useNotetakerStudent } from "@/hooks/use-notetaker-student"
import { notetakerAuthHeaders, notetakerListUrl } from "@/lib/notetaker-client"
import { notetakerTextMuted, notetakerTheme } from "@/lib/ai-notetaker-ui-theme"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type LimitsPayload = {
  tier: string
  maxNoteDurationMinutes: number
  transcriptionMinutes: number
  maxNotesPerMonth: number
  chatEnabled: boolean
  maxChatMessagesPerMonth: number
}

type PendingSave = {
  blob: Blob
  durationSec: number
  filename: string
}

function defaultLectureTitle() {
  const d = new Date()
  return `Lecture — ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
}

export function NotetakerNewSession({
  embedded = false,
  captureMode,
  onBack,
}: {
  embedded?: boolean
  captureMode?: "record" | "upload"
  onBack?: () => void
} = {}) {
  const searchParams = useSearchParams()
  const mode = captureMode ?? (searchParams.get("mode") === "upload" ? "upload" : "record")
  const { setAiNotetakerBreadcrumbTitle } = useDashboardV2()
  const { studentDbId, navPath, replaceTo } = useNotetakerStudent()
  const listHref = navPath("/student/dashboard-v2/ai-notetaker")

  const [limits, setLimits] = useState<LimitsPayload | null>(null)
  const [tierBlockedMessage, setTierBlockedMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [infoDialog, setInfoDialog] = useState<{ title: string; description: string } | null>(null)

  const [recording, setRecording] = useState(false)
  const [recordingMeterStream, setRecordingMeterStream] = useState<MediaStream | null>(null)
  const [paused, setPaused] = useState(false)
  const [supportsPause, setSupportsPause] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [, setLiveCaptionContext] = useState("")

  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null)
  const [saveTitleInput, setSaveTitleInput] = useState("")

  const recordingMeterStreamRef = useRef<MediaStream | null>(null)
  const rawMicStreamRef = useRef<MediaStream | null>(null)
  const micGainReleaseRef = useRef<(() => void) | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const maxRecordingSecondsRef = useRef(90 * 60)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const autoOpenedUploadRef = useRef(false)
  const stopRecordingRef = useRef<(durationOverride?: number) => Promise<void>>(async () => {})

  const resolvedRecordingMeterStream = recordingMeterStream ?? recordingMeterStreamRef.current
  const recordingMicLevel = useMicLevelMeter(
    resolvedRecordingMeterStream,
    recording && !paused && Boolean(resolvedRecordingMeterStream),
  )

  useEffect(() => {
    setAiNotetakerBreadcrumbTitle(mode === "upload" ? "Upload audio" : "Record lecture")
    return () => setAiNotetakerBreadcrumbTitle(null)
  }, [mode, setAiNotetakerBreadcrumbTitle])

  const loadLimits = useCallback(async () => {
    if (!studentDbId) return
    setLoading(true)
    try {
      const res = await fetch(notetakerListUrl(studentDbId), {
        headers: notetakerAuthHeaders(studentDbId),
      })
      const data = await res.json()
      if (res.status === 403 && data.code === "NOTETAKER_TIER") {
        setTierBlockedMessage(data.error || "This feature requires Explorer or Trailblazer.")
        setLimits(null)
        return
      }
      if (!res.ok) throw new Error(data.error || "Failed to load")
      setTierBlockedMessage(null)
      setLimits(data.limits as LimitsPayload)
    } catch {
      setLimits(null)
    } finally {
      setLoading(false)
    }
  }, [studentDbId])

  useEffect(() => {
    void loadLimits()
  }, [loadLimits])

  useEffect(() => {
    maxRecordingSecondsRef.current = (limits?.maxNoteDurationMinutes ?? 90) * 60
  }, [limits?.maxNoteDurationMinutes])

  useEffect(() => {
    if (typeof document === "undefined") return
    const previous = document.title
    document.title = mode === "upload" ? "Upload lecture · AI Notetaker" : "Record lecture · AI Notetaker"
    return () => {
      document.title = previous
    }
  }, [mode])

  useEffect(() => {
    if (embedded) return
    if (mode !== "upload" || !studentDbId || !limits || tierBlockedMessage) return
    if (autoOpenedUploadRef.current) return
    autoOpenedUploadRef.current = true
    requestAnimationFrame(() => fileInputRef.current?.click())
  }, [embedded, mode, studentDbId, limits, tierBlockedMessage])

  const createNoteAndUpload = useCallback(
    async (blob: Blob, durationSec: number, filename: string, lectureTitle: string) => {
      if (!studentDbId) return
      const trimmed = lectureTitle.trim().slice(0, 200)
      const title = trimmed || (mode === "upload" ? "Uploaded lecture" : "Voice lecture")

      setProcessing(true)
      try {
        const createRes = await studentApiFetch("/api/student/ai-notetaker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentDatabaseId: studentDbId,
            title,
          }),
        })
        const createData = await createRes.json()
        if (!createRes.ok) throw new Error(createData.error || "Could not save lecture")
        const id = createData.note?.id as number | undefined
        const slug = createData.note?.slug as string | undefined
        if (!id || !slug) throw new Error("Missing note id or slug")

        const fd = new FormData()
        fd.append("studentDatabaseId", studentDbId)
        fd.append("file", blob, filename)
        fd.append("durationSeconds", String(durationSec))
        const audioRes = await studentApiFetch(`/api/student/ai-notetaker/${encodeURIComponent(slug)}/audio`, {
          method: "POST",
          body: fd,
        })
        const audioData = await audioRes.json()
        if (!audioRes.ok) throw new Error(audioData.error || "Upload failed")

        toast.success("Lecture saved", {
          description: "Transcription and summary are running—you can leave this page.",
        })
        replaceTo(`/student/dashboard-v2/ai-notetaker/${encodeURIComponent(slug)}`)
      } catch (e: unknown) {
        setInfoDialog({
          title: "Could not save lecture",
          description: e instanceof Error ? e.message : "Something went wrong. Please try again.",
        })
      } finally {
        setProcessing(false)
        setPendingSave(null)
      }
    },
    [studentDbId, mode, replaceTo],
  )

  const openSaveDialog = (blob: Blob, durationSec: number, filename: string, suggestedTitle: string) => {
    setPendingSave({ blob, durationSec, filename })
    setSaveTitleInput(suggestedTitle.trim() || defaultLectureTitle())
  }

  const confirmSaveRecording = () => {
    if (!pendingSave) return
    const t = saveTitleInput.trim()
    if (!t) {
      toast.error("Enter a name for this lecture.")
      return
    }
    void createNoteAndUpload(pendingSave.blob, pendingSave.durationSec, pendingSave.filename, t)
  }

  const discardPendingSave = () => {
    setPendingSave(null)
    setSaveTitleInput("")
  }

  const stopRecording = useCallback(
    async (durationOverride?: number) => {
      const mr = mediaRecorderRef.current
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (!mr) return
      const dur = durationOverride ?? seconds
      setRecording(false)
      recordingMeterStreamRef.current = null
      setRecordingMeterStream(null)
      setPaused(false)
      setSupportsPause(false)
      setLiveCaptionContext("")
      const blob = await new Promise<Blob>((resolve) => {
        mr.onstop = () => {
          mr.stream.getTracks().forEach((t) => t.stop())
          micGainReleaseRef.current?.()
          micGainReleaseRef.current = null
          rawMicStreamRef.current?.getTracks().forEach((t) => {
            try {
              t.stop()
            } catch {
              /* ignore */
            }
          })
          rawMicStreamRef.current = null
          resolve(new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" }))
        }
        mr.stop()
      })
      mediaRecorderRef.current = null
      setSeconds(0)
      openSaveDialog(blob, dur, "lecture.webm", defaultLectureTitle())
    },
    [seconds],
  )

  stopRecordingRef.current = stopRecording

  useEffect(() => {
    if (!recording || paused) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        const next = s + 1
        const cap = maxRecordingSecondsRef.current
        if (next >= cap) {
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          queueMicrotask(() => void stopRecordingRef.current(cap))
          return cap
        }
        return next
      })
    }, 1000)
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [recording, paused])

  const togglePause = () => {
    const mr = mediaRecorderRef.current
    if (!mr || !supportsPause) return
    try {
      if (paused) {
        mr.resume()
        setPaused(false)
      } else {
        mr.pause()
        setPaused(true)
      }
    } catch {
      setInfoDialog({
        title: "Pause unavailable",
        description: "Your browser may not support pausing this recording format.",
      })
    }
  }

  const startRecording = async () => {
    let rawStream: MediaStream | null = null
    try {
      rawStream = await navigator.mediaDevices.getUserMedia(getNotetakerRecordingAudioConstraints())
      rawMicStreamRef.current = rawStream
      const { gainedStream, release } = await createNotetakerMicGainBridge(rawStream)
      micGainReleaseRef.current = release
      recordingMeterStreamRef.current = gainedStream
      setRecordingMeterStream(gainedStream)
      const mr = createAudioMediaRecorder(gainedStream)
      chunksRef.current = []
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.start(800)
      mediaRecorderRef.current = mr
      setSupportsPause(typeof mr.pause === "function")
      setPaused(false)
      setRecording(true)
      setSeconds(0)
    } catch (e: unknown) {
      micGainReleaseRef.current?.()
      micGainReleaseRef.current = null
      rawStream?.getTracks().forEach((t) => t.stop())
      rawMicStreamRef.current = null
      recordingMeterStreamRef.current = null
      setRecordingMeterStream(null)
      const name = e && typeof e === "object" && "name" in e ? String((e as Error).name) : ""
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setInfoDialog({
          title: "Microphone blocked",
          description:
            "Allow microphone access for this site in your browser settings, or use the upload option instead.",
        })
        return
      }
      if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setInfoDialog({
          title: "No microphone found",
          description: "Connect a microphone or upload an audio file instead.",
        })
        return
      }
      setInfoDialog({
        title: "Could not start recording",
        description:
          e instanceof Error
            ? e.message
            : "Your browser may not support this format. Try Chrome, Edge, or upload an audio file.",
      })
    }
  }

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (!f) return
    const base = (f.name || "lecture").replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim() || "Uploaded lecture"
    openSaveDialog(f, 0, f.name || "lecture.webm", base)
  }

  const backClassName =
    "inline-flex h-8 items-center gap-0.5 rounded-md px-1.5 text-[13px] font-medium text-[#374151] hover:bg-black/5 hover:text-[#111827] dark:text-[#d1d5db] dark:hover:bg-white/10 dark:hover:text-white"
  const backControl = onBack ? (
    <button type="button" className={backClassName} onClick={onBack} data-notetaker-native-back>
      <ChevronLeft className="size-4 shrink-0" strokeWidth={2.25} />
      Back to notes
    </button>
  ) : (
    <Link href={listHref} className={backClassName} data-notetaker-native-back>
      <ChevronLeft className="size-4 shrink-0" strokeWidth={2.25} />
      Back to notes
    </Link>
  )
  const panelBack = embedded ? (
    <div className="absolute left-3 top-3 z-10">{backControl}</div>
  ) : null

  if (!studentDbId || loading) {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        {embedded ? null : <div className="mb-3 shrink-0">{backControl}</div>}
        <div className="relative flex min-h-[240px] flex-1 items-center justify-center rounded-2xl bg-[var(--muted)]/40">
          {panelBack}
          <Loader2 className={cn("h-8 w-8 animate-spin", notetakerTheme.page.iconText)} />
        </div>
      </div>
    )
  }

  if (tierBlockedMessage) {
    return (
      <div className="flex min-h-full flex-1 flex-col gap-4">
        {embedded ? null : backControl}
        <div className="relative flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl px-6 py-10 text-center bg-[var(--muted)]/40">
          {panelBack}
          <h2 className="text-base font-semibold text-[var(--cc-text)]">Membership required</h2>
          <p className={cn("max-w-sm text-sm", PORTAL_TEXT_MUTED)}>{tierBlockedMessage}</p>
          <Button asChild className={cn("rounded-full", notetakerTheme.page.cta)}>
            <Link href={navPath("/student/dashboard-v2/membership")}>View membership options</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!limits) {
    return (
      <div className="flex min-h-full flex-1 flex-col gap-4">
        {embedded ? null : backControl}
        <div className="relative flex flex-1 items-center justify-center rounded-2xl bg-[var(--muted)]/40">
          {panelBack}
        <p className={cn("px-6 text-sm", notetakerTextMuted)}>
          Could not load your plan.{" "}
          <Link href={listHref} className="ml-1 font-medium text-[var(--cc-accent-dark)] underline">
            Return to notes
          </Link>
        </p>
        </div>
      </div>
    )
  }

  const maxSec = maxRecordingSecondsRef.current

  return (
    <div className="flex min-h-full min-w-0 flex-1 flex-col">
      {embedded ? null : <div className="mb-3 shrink-0">{backControl}</div>}

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-5 rounded-2xl bg-[var(--muted)]/40 px-6 py-10 text-center">
        {panelBack}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.webm,.mp3,.m4a,.wav"
          className="hidden"
          onChange={onPickFile}
        />

        {mode === "record" && !recording && !processing ? (
          <>
            <span
              className="flex size-14 items-center justify-center rounded-2xl text-white"
              style={{ backgroundColor: "var(--cc-accent)" }}
            >
              <Mic className="h-7 w-7" />
            </span>
            <div className="max-w-sm space-y-1.5">
              <h2 className="text-base font-semibold text-[var(--cc-text)]">Record lecture</h2>
              <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>
                Up to {limits.maxNoteDurationMinutes} min. Stop when you&apos;re done, then name it.
              </p>
            </div>
            <Button
              type="button"
              className="h-10 gap-2 rounded-full px-5 text-white hover:opacity-90"
              style={{ backgroundColor: "var(--cc-accent)" }}
              onClick={() => void startRecording()}
              disabled={processing || !!pendingSave}
            >
              <Mic className="h-4 w-4" />
              Start recording
            </Button>
          </>
        ) : null}

        {mode === "upload" && !processing && !pendingSave ? (
          <>
            <span
              className="flex size-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: "var(--cc-accent-soft)", color: "var(--cc-accent)" }}
            >
              <Upload className="h-7 w-7" />
            </span>
            <div className="max-w-sm space-y-1.5">
              <h2 className="text-base font-semibold text-[var(--cc-text)]">Upload audio</h2>
              <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>
                MP3, M4A, WAV, or WebM. We&apos;ll transcribe after you name it.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-2 rounded-full px-5"
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
            >
              <Upload className="h-4 w-4" />
              Choose file
            </Button>
          </>
        ) : null}

        {processing ? (
          <p className="flex items-center gap-2 text-sm text-[var(--cc-text)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </p>
        ) : null}

        {mode === "record" && recording ? (
          <div className="flex w-full max-w-xl flex-1 flex-col">
            <LiveSpeechCaptions
              active={recording && !paused}
              className="w-full min-h-0 flex-1"
              meterStream={recordingMeterStream}
              meterStreamRef={recordingMeterStreamRef}
              studentDatabaseId={studentDbId}
              onTranscriptChange={setLiveCaptionContext}
            />
          </div>
        ) : null}
      </div>

      <NotetakerFloatingRecordBar
        recording={recording}
        paused={paused}
        seconds={seconds}
        maxSeconds={maxSec}
        supportsPause={supportsPause}
        onPauseToggle={togglePause}
        onStop={() => void stopRecording()}
        stopLabel="Stop and save"
        micLevel={recording ? recordingMicLevel : undefined}
      />

      <Dialog
        open={!!pendingSave}
        onOpenChange={(open) => {
          if (!open) discardPendingSave()
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Name this lecture</DialogTitle>
            <DialogDescription>
              This is how it will appear in your notes. You can edit details later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label htmlFor="notetaker-save-title" className="text-sm font-medium text-[var(--cc-text)]">
              Lecture title
            </label>
            <Input
              id="notetaker-save-title"
              value={saveTitleInput}
              onChange={(e) => setSaveTitleInput(e.target.value)}
              placeholder="e.g. ELEG 4031 — Exam review"
              className="rounded-xl"
              maxLength={200}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  confirmSaveRecording()
                }
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="rounded-full" onClick={discardPendingSave} disabled={processing}>
              Discard
            </Button>
            <Button type="button" className="rounded-full" onClick={confirmSaveRecording} disabled={processing || !saveTitleInput.trim()}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & transcribe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!infoDialog} onOpenChange={(open) => !open && setInfoDialog(null)}>
        <DialogContent className="rounded-xl sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>{infoDialog?.title ?? "Notice"}</DialogTitle>
            <DialogDescription>{infoDialog?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" className="rounded-full" onClick={() => setInfoDialog(null)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
