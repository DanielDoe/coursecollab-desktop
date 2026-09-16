"use client"


import { studentApiFetch } from "@/lib/auth"
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import {
  Loader2,
  Mic,
  Send,
  Upload,
  X,
  MessageCircle,
  Sparkles,
  ListOrdered,
  Square,
  FileText,
  Chrome,
} from "lucide-react"
import { toast } from "@/lib/app-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { LiveSpeechCaptions } from "@/components/ai-notetaker/live-speech-captions"
import { NotetakerFloatingRecordBar } from "@/components/ai-notetaker/notetaker-floating-record-bar"
import { useDashboardV2 } from "@/components/student/dashboard-v2/DashboardV2Context"
import { createAudioMediaRecorder } from "@/lib/mediarecorder-audio-mime"
import { getNotetakerRecordingAudioConstraints } from "@/lib/notetaker-recording-audio"
import { createNotetakerMicGainBridge } from "@/lib/notetaker-mic-gain"
import { useMicLevelMeter } from "@/hooks/use-mic-level-meter"
import { useNotetakerStudent } from "@/hooks/use-notetaker-student"
import { notetakerAuthHeaders, notetakerListUrl } from "@/lib/notetaker-client"
import {
  notetakerText,
  notetakerTextMuted,
  notetakerTheme,
} from "@/lib/ai-notetaker-ui-theme"
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

export function NotetakerNewSession() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get("mode") === "upload" ? "upload" : "record"
  const { setAiNotetakerBreadcrumbTitle } = useDashboardV2()
  const { studentDbId, isNativeApp, navPath, replaceTo } = useNotetakerStudent()

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
  const [liveCaptionContext, setLiveCaptionContext] = useState("")
  const [liveChatMessages, setLiveChatMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([])
  const [liveChatInput, setLiveChatInput] = useState("")
  const [liveChatSending, setLiveChatSending] = useState(false)
  /** Narrow layout only (<880px). Wide uses a single grid row so we must not mount two workspace trees (breaks Web Speech). */
  const [mobileNotetakerPanel, setMobileNotetakerPanel] = useState<"workspace" | "chat">("workspace")

  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null)
  const [saveTitleInput, setSaveTitleInput] = useState("")

  const recordingMeterStreamRef = useRef<MediaStream | null>(null)
  /** Raw `getUserMedia` stream; stopped after recording so the mic is released. */
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
    document.title = mode === "upload" ? "Upload lecture · AI Notetaker" : "Record lecture · AI Notetaker"
  }, [mode])

  useEffect(() => {
    if (mode !== "upload" || !studentDbId || !limits || tierBlockedMessage) return
    if (autoOpenedUploadRef.current) return
    autoOpenedUploadRef.current = true
    requestAnimationFrame(() => fileInputRef.current?.click())
  }, [mode, studentDbId, limits, tierBlockedMessage])

  const createNoteAndUpload = useCallback(
    async (blob: Blob, durationSec: number, filename: string, lectureTitle: string) => {
      if (!studentDbId) return
      const trimmed = lectureTitle.trim().slice(0, 200)
      const title =
        trimmed ||
        (mode === "upload" ? "Uploaded lecture" : "Voice lecture")

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
    [studentDbId, mode, router],
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
      setLiveChatMessages([])
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

  const sendLiveChat = async () => {
    if (!studentDbId || !limits?.chatEnabled || !liveChatInput.trim()) return
    const text = liveChatInput.trim()
    setLiveChatInput("")
    setLiveChatMessages((m) => [...m, { role: "user", text }])
    setLiveChatSending(true)
    try {
      const res = await studentApiFetch("/api/student/ai-notetaker/live-caption-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-student-database-id": studentDbId,
        },
        body: JSON.stringify({ message: text, context: liveCaptionContext }),
      })
      const data = await res.json()
      if (!res.ok) {
        setLiveChatMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: data.upgrade
              ? "Upgrade to Trailblazer to ask questions during recording."
              : data.error || "Something went wrong.",
          },
        ])
        return
      }
      setLiveChatMessages((m) => [...m, { role: "assistant", text: data.reply || "" }])
    } finally {
      setLiveChatSending(false)
    }
  }

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (!f) return
    const base = (f.name || "lecture").replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim() || "Uploaded lecture"
    openSaveDialog(f, 0, f.name || "lecture.webm", base)
  }

  if (!studentDbId || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className={cn("h-10 w-10 animate-spin", notetakerTheme.page.iconText)} />
      </div>
    )
  }

  if (tierBlockedMessage) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8">
        <Button variant="ghost" size="sm" className="gap-2 rounded-full" asChild data-notetaker-native-back>
          <Link href={navPath("/student/dashboard-v2/ai-notetaker")}>
            <X className="h-4 w-4" />
            Close
          </Link>
        </Button>
        <Card className={cn(notetakerTheme.page.border, notetakerTheme.page.softBg)}>
          <CardHeader>
            <CardTitle className={cn("text-lg", notetakerText)}>AI Notetaker</CardTitle>
            <CardDescription className={notetakerTextMuted}>{tierBlockedMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className={cn("rounded-full", notetakerTheme.page.cta)}>
                <Link href={navPath("/student/dashboard-v2/membership")}>View membership options</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!limits) {
    return (
      <div className={cn("mx-auto max-w-lg py-12 text-center", notetakerTextMuted)}>
        Could not load your plan.{" "}
        <Link href={navPath("/student/dashboard-v2/ai-notetaker")} className="font-medium text-[var(--cc-accent-dark)] underline">
          Return to AI Notetaker
        </Link>
      </div>
    )
  }

  const maxSec = maxRecordingSecondsRef.current

  const workspaceColumn = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className={cn("text-xl font-bold tracking-tight sm:text-2xl", notetakerText)}>
            {mode === "upload" ? "Upload lecture" : "Record lecture"}
          </h1>
          <p className={cn("text-sm", notetakerTextMuted)}>
            Up to <strong>{limits.maxNoteDurationMinutes} min</strong> · name it when you save
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-full text-[var(--cc-text-muted)] hover:bg-[var(--sidebar-accent)]/40 hover:text-[var(--cc-text)]"
          asChild
          aria-label="Close and return to notes"
          data-notetaker-native-back
        >
          <Link href={navPath("/student/dashboard-v2/ai-notetaker")}>
            <X className="h-5 w-5" />
          </Link>
        </Button>
      </div>

      <motion.div
        animate={
          recording && !paused
            ? {
                boxShadow: [
                  "0 0 0 1px rgba(139, 92, 246, 0.35)",
                  "0 0 0 6px rgba(99, 102, 241, 0.12)",
                  "0 0 0 1px rgba(139, 92, 246, 0.35)",
                ],
              }
            : { boxShadow: "0 0 0 0px transparent" }
        }
        transition={{ duration: 2.2, repeat: recording && !paused ? Infinity : 0, ease: "easeInOut" }}
        className="flex min-h-0 flex-1 flex-col rounded-2xl"
      >
        <Card className="flex min-h-0 flex-1 flex-col border-slate-200/90 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg sm:text-xl">
              {mode === "upload" ? "Upload audio" : recording ? "Recording" : "Workspace"}
            </CardTitle>
            <CardDescription className="text-pretty">
              {mode === "record" ? (
                <>
                  Stop when you&apos;re done—we&apos;ll ask for a title, then transcribe on the server. Live captions
                  (Chrome or Edge) power the Ask live column; other browsers still get a full transcript after you stop.
                </>
              ) : (
                <>Choose a file, then name the lecture before we upload and transcribe.</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4 pb-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.webm,.mp3,.m4a,.wav"
              className="hidden"
              onChange={onPickFile}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {mode === "record" && (
                <>
                  {!recording ? (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        type="button"
                        className={cn("rounded-full gap-2 shadow-md", notetakerTheme.page.cta)}
                        onClick={() => void startRecording()}
                        disabled={processing || !!pendingSave}
                      >
                        <Mic className="h-4 w-4" />
                        Start recording
                      </Button>
                    </motion.div>
                  ) : null}
                </>
              )}
              {mode === "upload" && (
                <Button
                  variant="outline"
                  className="rounded-full gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={processing || !!pendingSave}
                >
                  <Upload className="h-4 w-4" />
                  Choose file
                </Button>
              )}
              {processing && (
                <motion.span
                  className="flex items-center gap-2 text-sm text-indigo-800 dark:text-indigo-200"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </motion.span>
              )}
            </div>

            {mode === "record" && !recording && !processing && !pendingSave && (
              <div className="relative mt-1 flex min-h-[11rem] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white via-slate-50/90 to-indigo-50/50 p-4 shadow-inner dark:border-slate-700/80 dark:from-slate-950 dark:via-slate-900/90 dark:to-indigo-950/40 sm:min-h-[12.5rem] sm:p-5">
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20"
                  style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.45) 1px, transparent 0)`,
                    backgroundSize: "20px 20px",
                  }}
                />
                <p className="relative text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  How it works
                </p>
                <div className="relative mt-3 flex flex-1 flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-0">
                  <div className="flex flex-1 gap-3 rounded-xl bg-white/80 p-3 ring-1 ring-slate-200/60 dark:bg-slate-900/70 dark:ring-slate-700/80 sm:flex-col sm:items-center sm:text-center">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/80 dark:text-violet-200">
                      <Mic className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Capture</p>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        We record from your mic. Optional live text streams here in Chrome or Edge.
                      </p>
                    </div>
                  </div>
                  <Separator className="sm:hidden" />
                  <Separator orientation="vertical" className="mx-2 hidden min-h-[5rem] self-stretch sm:block" />
                  <div className="flex flex-1 gap-3 rounded-xl bg-white/80 p-3 ring-1 ring-slate-200/60 dark:bg-slate-900/70 dark:ring-slate-700/80 sm:flex-col sm:items-center sm:text-center">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-200">
                      <Square className="h-4 w-4 fill-current" aria-hidden />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Finish</p>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        Tap stop, name the lecture, then we upload audio for transcription.
                      </p>
                    </div>
                  </div>
                  <Separator className="sm:hidden" />
                  <Separator orientation="vertical" className="mx-2 hidden min-h-[5rem] self-stretch sm:block" />
                  <div className="flex flex-1 gap-3 rounded-xl bg-white/80 p-3 ring-1 ring-slate-200/60 dark:bg-slate-900/70 dark:ring-slate-700/80 sm:flex-col sm:items-center sm:text-center">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/80 dark:text-fuchsia-200">
                      <FileText className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Your note</p>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        Open the saved note for the full transcript, summary, and Trailblazer chat.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="relative mt-3 flex flex-wrap items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/90 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-300">
                    <Chrome className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                    Live captions: desktop Chrome / Edge
                  </span>
                  <span className="rounded-full border border-slate-200/90 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-300">
                    Up to {limits.maxNoteDurationMinutes} min per lecture
                  </span>
                </div>
                <p className="relative mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
                  <Link
                    href="/student/dashboard-v2/ai-notetaker/new?mode=upload"
                    className="font-medium text-indigo-600 underline decoration-indigo-600/30 underline-offset-2 hover:text-indigo-500 dark:text-indigo-400 dark:decoration-indigo-400/30"
                  >
                    Prefer to upload a file instead?
                  </Link>
                </p>
              </div>
            )}

            {mode === "upload" && !processing && !pendingSave && (
              <div className="relative mt-1 flex min-h-[9rem] flex-1 flex-col justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/80 p-4 text-center dark:border-slate-600 dark:bg-slate-900/50 sm:min-h-[10rem]">
                <Upload className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500" aria-hidden />
                <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-100">Drop a lecture recording</p>
                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  MP3, M4A, WAV, or WebM work well. After you pick a file, you&apos;ll name it—same transcription pipeline
                  as recording.
                </p>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  <Link
                    href="/student/dashboard-v2/ai-notetaker/new?mode=record"
                    className="font-medium text-indigo-600 underline decoration-indigo-600/30 underline-offset-2 hover:text-indigo-500 dark:text-indigo-400"
                  >
                    Switch to microphone recording
                  </Link>
                </p>
              </div>
            )}

            {mode === "record" && recording && (
              <LiveSpeechCaptions
                active={recording && !paused}
                className="w-full shrink-0"
                meterStream={recordingMeterStream}
                meterStreamRef={recordingMeterStreamRef}
                studentDatabaseId={studentDbId}
                onTranscriptChange={setLiveCaptionContext}
              />
            )}
          </CardContent>
        </Card>
      </motion.div>

      <NotetakerFloatingRecordBar
        recording={recording}
        paused={paused}
        seconds={seconds}
        maxSeconds={maxSec}
        supportsPause={supportsPause}
        onPauseToggle={togglePause}
        onStop={() => void stopRecording()}
        stopLabel="Stop and save lecture"
        micLevel={recording ? recordingMicLevel : undefined}
      />
    </div>
  )

  const chatColumn = (
    <div className="flex min-h-0 min-w-0 flex-col border-t border-slate-200/90 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-950/60 min-[880px]:border-t-0 min-[880px]:border-l">
      <Tabs defaultValue="chat" className="flex h-full min-h-0 flex-1 flex-col gap-0">
        <div className="border-b border-slate-200/80 px-3 pt-3 dark:border-slate-700">
          <TabsList className="h-auto w-full justify-stretch gap-1 rounded-xl bg-white/90 p-1 shadow-sm dark:bg-slate-900/90">
            <TabsTrigger
              value="chat"
              className="flex-1 gap-1.5 rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white dark:data-[state=active]:bg-indigo-600"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Ask live
            </TabsTrigger>
            <TabsTrigger
              value="tips"
              className="flex-1 gap-1.5 rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white dark:data-[state=active]:bg-indigo-600"
            >
              <ListOrdered className="h-3.5 w-3.5" />
              Tips
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className="mt-0 flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2 data-[state=inactive]:hidden">
          {!limits.chatEnabled ? (
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Trailblazer can ask questions about live captions while recording.{" "}
              <Link href="/student/dashboard-v2/membership" className="font-medium text-indigo-600 underline dark:text-indigo-400">
                View plans
              </Link>
            </p>
          ) : mode !== "record" ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              After upload, open your note to chat with the full AI transcript.
            </p>
          ) : !recording ? (
            <div className="flex min-h-[14rem] flex-1 flex-col gap-4 py-4">
              <div className="rounded-xl border border-indigo-200/70 bg-gradient-to-b from-indigo-50/90 to-white px-3 py-3 dark:border-indigo-900/50 dark:from-indigo-950/40 dark:to-slate-900/80">
                <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-indigo-800 dark:text-indigo-200">
                  Example prompts
                </p>
                <ul className="mt-2 space-y-2 text-left text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  <li className="flex gap-2 rounded-lg bg-white/70 px-2 py-1.5 dark:bg-slate-950/50">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden />
                    <span>&quot;What definition did they just give?&quot;</span>
                  </li>
                  <li className="flex gap-2 rounded-lg bg-white/70 px-2 py-1.5 dark:bg-slate-950/50">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden />
                    <span>&quot;Summarize the last few minutes in bullet points.&quot;</span>
                  </li>
                  <li className="flex gap-2 rounded-lg bg-white/70 px-2 py-1.5 dark:bg-slate-950/50">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden />
                    <span>&quot;What should I review before the exam based on this?&quot;</span>
                  </li>
                </ul>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white/60 px-3 py-5 text-center dark:border-slate-700 dark:bg-slate-900/40">
                <Sparkles className="h-8 w-8 text-indigo-400" aria-hidden />
                <p className="max-w-[240px] text-sm text-slate-600 dark:text-slate-400">
                  Start recording on the left—live captions fill in here, then you can ask in plain English.
                </p>
              </div>
            </div>
          ) : (
            <>
              <ScrollArea className="min-h-[12rem] flex-1 rounded-xl border border-slate-200/90 bg-white dark:border-slate-700 dark:bg-slate-900/80">
                <div className="space-y-3 p-3">
                  {liveChatMessages.length === 0 && (
                    <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      e.g. &quot;What definition did they just give?&quot;
                    </p>
                  )}
                  {liveChatMessages.map((m, i) => (
                    <div
                      key={i}
                      className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "ml-2 bg-indigo-600 text-white"
                          : "mr-2 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                      }`}
                    >
                      {m.text}
                    </div>
                  ))}
                  {liveChatSending && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="mt-2 shrink-0 rounded-xl border border-slate-200/90 bg-white p-2 dark:border-slate-600 dark:bg-slate-900/80">
                <Textarea
                  value={liveChatInput}
                  onChange={(e) => setLiveChatInput(e.target.value)}
                  placeholder="Ask about this lecture…"
                  rows={2}
                  className="min-h-0 resize-none border-0 bg-transparent p-2 text-sm shadow-none focus-visible:ring-0"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      void sendLiveChat()
                    }
                  }}
                />
                <div className="flex items-center justify-end border-t border-slate-100 pt-2 dark:border-slate-800">
                  <Button
                    type="button"
                    size="icon"
                    className="h-9 w-9 rounded-full bg-indigo-600 hover:bg-indigo-700"
                    disabled={liveChatSending || !liveChatInput.trim()}
                    onClick={() => void sendLiveChat()}
                    aria-label="Send"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="tips" className="mt-0 flex-1 px-3 pb-4 pt-2 text-sm leading-relaxed text-slate-600 data-[state=inactive]:hidden dark:text-slate-400">
          <ul className="list-disc space-y-2 pl-4">
            <li>Quiet room or headset helps live captions.</li>
            <li>Pause when supported—timer holds while paused.</li>
            <li>Stop when finished; you&apos;ll name the lecture, then we upload and transcribe.</li>
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  )

  return (
    <div className={cn("mx-auto w-full max-w-[1400px] px-0", isNativeApp && "min-h-[calc(100dvh-1rem)]")}>
      {/*
        One workspace + one chat in the tree. Do not render workspaceColumn twice: both were in the DOM
        before (CSS hid one), so two LiveSpeechCaptions fought over Web Speech and captions looked “replaced”.
      */}
      <div
        className={cn(
          "flex min-h-[calc(100dvh-6rem)] flex-col",
          isNativeApp && "min-h-[calc(100dvh-1.5rem)]",
          "min-[880px]:grid min-[880px]:min-h-[calc(100dvh-5.75rem)] min-[880px]:grid-cols-[minmax(0,1fr)_400px] min-[880px]:divide-x min-[880px]:divide-[var(--border)] min-[880px]:rounded-2xl min-[880px]:border min-[880px]:border-[var(--border)] min-[880px]:bg-[var(--card)] min-[880px]:shadow-sm",
        )}
      >
        <div
          className="mx-3 mt-2 grid h-11 shrink-0 grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 min-[880px]:hidden"
          role="tablist"
          aria-label="Workspace or live chat"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mobileNotetakerPanel === "workspace"}
            className={cn(
              "inline-flex h-9 items-center justify-center rounded-lg text-sm font-medium transition-colors",
              mobileNotetakerPanel === "workspace"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
            )}
            onClick={() => setMobileNotetakerPanel("workspace")}
          >
            Workspace
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileNotetakerPanel === "chat"}
            className={cn(
              "inline-flex h-9 items-center justify-center rounded-lg text-sm font-medium transition-colors",
              mobileNotetakerPanel === "chat"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
            )}
            onClick={() => setMobileNotetakerPanel("chat")}
          >
            Ask live
          </button>
        </div>

        <div
          className={cn(
            "min-h-0 min-w-0 overflow-y-auto overflow-x-hidden",
            mobileNotetakerPanel === "workspace" ? "flex min-h-0 flex-1 flex-col" : "hidden",
            "min-[880px]:flex min-[880px]:min-h-0 min-[880px]:min-w-0 min-[880px]:overflow-y-auto",
          )}
        >
          {workspaceColumn}
        </div>
        <div
          className={cn(
            "min-h-0 min-w-0 overflow-hidden",
            mobileNotetakerPanel === "chat" ? "flex min-h-0 flex-1 flex-col" : "hidden",
            "min-[880px]:flex min-[880px]:min-h-0 min-[880px]:min-w-0",
          )}
        >
          {chatColumn}
        </div>
      </div>

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
              This is how it will appear in your notes. You can edit details later on the note page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label htmlFor="notetaker-save-title" className="text-sm font-medium text-slate-800 dark:text-slate-200">
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
            <DialogDescription className="text-slate-600 dark:text-slate-300">
              {infoDialog?.description}
            </DialogDescription>
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
