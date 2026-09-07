"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import {
  ChevronLeft,
  Copy,
  Download,
  Loader2,
  Mic,
  NotebookPen,
  Upload,
  Send,
  Lock,
  Save,
  Share2,
  Trash2,
  MessageCircle,
  ListOrdered,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ClassmateShareDialog } from "@/components/student/digital-notes/classmate-share-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { NotetakerKeyPoints } from "@/lib/ai-notetaker-process"
import { notetakerNavigationTitle } from "@/lib/ai-notetaker-auto-title"
import { createAudioMediaRecorder } from "@/lib/mediarecorder-audio-mime"
import { getNotetakerRecordingAudioConstraints } from "@/lib/notetaker-recording-audio"
import { createNotetakerMicGainBridge } from "@/lib/notetaker-mic-gain"
import { useMicLevelMeter } from "@/hooks/use-mic-level-meter"
import { LiveSpeechCaptions } from "@/components/ai-notetaker/live-speech-captions"
import { NotetakerFloatingRecordBar } from "@/components/ai-notetaker/notetaker-floating-record-bar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useNotetakerStudent } from "@/hooks/use-notetaker-student"
import { notetakerAuthHeaders } from "@/lib/notetaker-client"
import {
  formatNotetakerNoteBody,
  formatNotetakerShareText,
} from "@/lib/notetaker-export"
import { getStudentAuthHeaders, resolveStudentSection, studentApiFetch } from "@/lib/auth"
import { buildStudentScopedSearchParams, getStudentDatabaseId } from "@/lib/student-session-ids"
import {
  notetakerBorder,
  notetakerCardBg,
  notetakerText,
  notetakerTextMuted,
  notetakerTheme,
} from "@/lib/ai-notetaker-ui-theme"
import { cn } from "@/lib/utils"
import { toast } from "@/lib/app-toast"
import { useDashboardV2 } from "@/components/student/dashboard-v2/DashboardV2Context"

type RosterStudent = {
  id: number
  full_name: string
}

type Note = {
  id: number
  slug: string
  title: string
  course_name: string | null
  lecture_date: string | null
  audio_storage_key: string | null
  audio_mime: string | null
  duration_seconds: number | null
  transcript: string | null
  summary: string | null
  key_points: unknown
  processing_status: string
  failure_reason: string | null
  created_at: string
}

type Limits = {
  tier: string
  maxNoteDurationMinutes: number
  chatEnabled: boolean
  transcriptionMinutes: number
  maxNotesPerMonth: number
}

export function NotetakerNoteDetail({ noteRef }: { noteRef: string }) {
  const router = useRouter()
  const { setAiNotetakerBreadcrumbTitle } = useDashboardV2()
  const { studentDbId, isNativeApp, navPath, goTo, replaceTo } = useNotetakerStudent()
  const searchParams = useSearchParams()
  const mode = searchParams.get("mode") || "record"
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recordingMeterStreamRef = useRef<MediaStream | null>(null)
  const rawMicStreamRef = useRef<MediaStream | null>(null)
  const micGainReleaseRef = useRef<(() => void) | null>(null)
  const pathNoteRef = useRef<Note | null>(null)

  const [note, setNote] = useState<Note | null>(null)
  const [limits, setLimits] = useState<Limits | null>(null)
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingMeta, setSavingMeta] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [title, setTitle] = useState("")
  const [course, setCourse] = useState("")
  const [lectureDate, setLectureDate] = useState("")

  const [recording, setRecording] = useState(false)
  const [recordingMeterStream, setRecordingMeterStream] = useState<MediaStream | null>(null)
  const [paused, setPaused] = useState(false)
  const [supportsPause, setSupportsPause] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const maxRecordingSecondsRef = useRef(90 * 60)
  const stopRecordingRef = useRef<(durationOverride?: number) => Promise<void>>(async () => {})

  const resolvedRecordingMeterStream = recordingMeterStream ?? recordingMeterStreamRef.current
  const recordingMicLevel = useMicLevelMeter(
    resolvedRecordingMeterStream,
    recording && !paused && Boolean(resolvedRecordingMeterStream),
  )

  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatSending, setChatSending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [infoDialog, setInfoDialog] = useState<{ title: string; description: string } | null>(null)
  const [pendingAudioSave, setPendingAudioSave] = useState<{ blob: Blob; durationSec: number; fileName: string } | null>(null)
  const [audioSaveTitle, setAudioSaveTitle] = useState("")
  const [movedDigitalNoteId, setMovedDigitalNoteId] = useState<number | null>(null)
  const [moving, setMoving] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareSaving, setShareSaving] = useState(false)
  const [roster, setRoster] = useState<RosterStudent[]>([])
  const [selectedShareIds, setSelectedShareIds] = useState<number[]>([])
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const allowLeaveRef = useRef(false)

  pathNoteRef.current = note

  const pathSegmentEncoded = () =>
    encodeURIComponent((pathNoteRef.current?.slug as string | undefined) ?? noteRef)

  const fetchNote = useCallback(async (): Promise<boolean> => {
    if (!studentDbId) return false
    const res = await fetch(
      `/api/student/ai-notetaker/${pathSegmentEncoded()}?studentDatabaseId=${encodeURIComponent(studentDbId)}`,
      { headers: notetakerAuthHeaders(studentDbId) },
    )
    const data = await res.json()
    if (res.status === 403 && (data.code === "NOTETAKER_TIER" || data.error)) {
      setAccessDeniedMessage(data.error || "This feature requires Explorer or Trailblazer.")
      return false
    }
    if (!res.ok) throw new Error(data.error || "Failed")
    setAccessDeniedMessage(null)
    const n = data.note as Note
    setNote(n)
    setLimits(data.limits as Limits)
    setTitle(n.title || "")
    setCourse(n.course_name || "")
    setLectureDate(n.lecture_date ? String(n.lecture_date).slice(0, 10) : "")
    if (n.slug && n.slug !== noteRef) {
      replaceTo(`/student/dashboard-v2/ai-notetaker/${encodeURIComponent(n.slug)}`)
    }
    return true
  }, [noteRef, studentDbId, replaceTo])

  useEffect(() => {
    if (!studentDbId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const ok = await fetchNote()
        if (!ok && !cancelled) return
      } catch {
        if (!cancelled) goTo("/student/dashboard-v2/ai-notetaker")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [studentDbId, fetchNote, router])

  useEffect(() => {
    if (!note || !studentDbId) return
    if (note.processing_status !== "transcribing" && note.processing_status !== "summarizing") return
    const t = setInterval(() => {
      void fetchNote().catch(() => {})
    }, 3000)
    return () => clearInterval(t)
  }, [note?.processing_status, studentDbId, fetchNote, note, noteRef])

  useEffect(() => {
    maxRecordingSecondsRef.current = (limits?.maxNoteDurationMinutes ?? 90) * 60
  }, [limits?.maxNoteDurationMinutes])

  useEffect(() => {
    if (accessDeniedMessage) {
      setAiNotetakerBreadcrumbTitle(null)
      return
    }
    if (!note) return
    setAiNotetakerBreadcrumbTitle(notetakerNavigationTitle(note.id, title, note.title))
    return () => setAiNotetakerBreadcrumbTitle(null)
  }, [accessDeniedMessage, note, title, setAiNotetakerBreadcrumbTitle])

  useEffect(() => {
    if (typeof document === "undefined" || !note || accessDeniedMessage) return
    document.title = `${notetakerNavigationTitle(note.id, title, note.title)} · AI Notetaker`
  }, [note, title, accessDeniedMessage])

  useEffect(() => {
    if (!studentDbId || !note) return
    if (note.processing_status !== "draft") return
    if (mode === "upload") {
      fileInputRef.current?.click()
    }
  }, [mode, note?.processing_status, studentDbId, note])

  const isMetaDirty = useMemo(() => {
    if (!note) return false
    return (
      title.trim() !== (note.title || "").trim() ||
      course.trim() !== (note.course_name || "").trim() ||
      lectureDate !== (note.lecture_date || "")
    )
  }, [note, title, course, lectureDate])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isMetaDirty || allowLeaveRef.current) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [isMetaDirty])

  const saveMeta = async (): Promise<boolean> => {
    if (!studentDbId) return false
    setSavingMeta(true)
    try {
      const res = await fetch(
        `/api/student/ai-notetaker/${pathSegmentEncoded()}?studentDatabaseId=${encodeURIComponent(studentDbId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim() || "Untitled lecture",
            course_name: course.trim() || null,
            lecture_date: lectureDate || null,
          }),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not save details")
      }
      if (data.note?.slug && data.note.slug !== noteRef) {
        replaceTo(`/student/dashboard-v2/ai-notetaker/${encodeURIComponent(data.note.slug)}`)
      }
      await fetchNote()
      toast.success("Details saved")
      return true
    } catch (e: unknown) {
      setInfoDialog({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Something went wrong while saving.",
      })
      return false
    } finally {
      setSavingMeta(false)
    }
  }

  const leaveToHome = useCallback(() => {
    allowLeaveRef.current = true
    goTo("/student/dashboard-v2/ai-notetaker")
  }, [goTo])

  const requestLeaveHome = useCallback(() => {
    if (!isMetaDirty || allowLeaveRef.current) {
      leaveToHome()
      return
    }
    setUnsavedDialogOpen(true)
  }, [isMetaDirty, leaveToHome])

  const ensureDigitalNote = useCallback(async (): Promise<number> => {
    if (!note) throw new Error("Note not loaded")
    if (movedDigitalNoteId) return movedDigitalNoteId
    const bodyText = formatNotetakerNoteBody({
      ...note,
      course_name: course.trim() || note.course_name,
      lecture_date: lectureDate || note.lecture_date,
      summary: note.summary,
      transcript: note.transcript,
      key_points: note.key_points,
    })
    const res = await studentApiFetch("/api/student/digital-notes", {
      method: "POST",
      headers: {
        ...getStudentAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: title.trim() || note.title,
        bodyText,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Could not save to My Notes")
    const digitalId = Number(data.note?.id)
    if (!Number.isFinite(digitalId)) throw new Error("Could not save to My Notes")
    setMovedDigitalNoteId(digitalId)
    return digitalId
  }, [note, movedDigitalNoteId, title, course, lectureDate])

  const moveToMyNotes = useCallback(async () => {
    if (!note) return
    if (note.processing_status !== "completed") {
      toast.error("Still processing", {
        description: "Wait until transcription and summarization finish.",
      })
      return
    }
    setMoving(true)
    try {
      const digitalId = await ensureDigitalNote()
      toast.success("Moved to My Notes")
      goTo(`/student/dashboard-v2/notes?noteId=${digitalId}`)
    } catch (err: unknown) {
      toast.error("Move failed", {
        description: err instanceof Error ? err.message : "Could not save to My Notes.",
      })
    } finally {
      setMoving(false)
    }
  }, [note, ensureDigitalNote, goTo])

  const exportNoteText = useCallback(
    async (mode: "copy" | "download") => {
      if (!note || note.processing_status !== "completed") {
        toast.error("Still processing", { description: "Notes aren't ready to export yet." })
        return
      }
      setExporting(true)
      try {
        const text = formatNotetakerShareText(title.trim() || note.title, {
          ...note,
          course_name: course.trim() || note.course_name,
          lecture_date: lectureDate || note.lecture_date,
        })
        if (mode === "copy") {
          await navigator.clipboard.writeText(text)
          toast.success("Copied to clipboard")
          return
        }
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${(title.trim() || note.title || "lecture-note").replace(/[^\w\-]+/g, "_").slice(0, 80)}.txt`
        a.click()
        URL.revokeObjectURL(url)
        toast.success("Download started")
      } catch (err: unknown) {
        toast.error("Export failed", {
          description: err instanceof Error ? err.message : undefined,
        })
      } finally {
        setExporting(false)
      }
    },
    [note, title, course, lectureDate],
  )

  const openClassmateShare = useCallback(async () => {
    if (!note) return
    if (note.processing_status !== "completed") {
      toast.error("Still processing", { description: "Notes aren't ready to share yet." })
      return
    }
    setShareOpen(true)
    setShareLoading(true)
    try {
      const digitalId = await ensureDigitalNote()
      const studentDatabaseId = Number(getStudentDatabaseId() ?? 0)
      const rosterParams = buildStudentScopedSearchParams({
        section: resolveStudentSection(),
      })
      const [rosterRes, sharesRes] = await Promise.all([
        studentApiFetch(`/api/student/roster?${rosterParams}`),
        studentApiFetch(`/api/student/digital-notes/${digitalId}/share`, {
          headers: getStudentAuthHeaders(),
        }),
      ])
      const rosterData = await rosterRes.json()
      const sharesData = await sharesRes.json()
      if (!rosterRes.ok) throw new Error(rosterData.error || "Failed to load classmates")
      if (!sharesRes.ok) throw new Error(sharesData.error || "Failed to load shares")
      setRoster(
        ((rosterData.students || []) as RosterStudent[]).filter(
          (student) => student.id !== studentDatabaseId,
        ),
      )
      setSelectedShareIds(
        ((sharesData.shares || []) as Array<{ studentDatabaseId: number }>).map(
          (share) => share.studentDatabaseId,
        ),
      )
    } catch (err: unknown) {
      setShareOpen(false)
      toast.error("Share failed", {
        description: err instanceof Error ? err.message : "Could not load classmates.",
      })
    } finally {
      setShareLoading(false)
    }
  }, [note, ensureDigitalNote])

  const saveClassmateShares = useCallback(async () => {
    if (!movedDigitalNoteId) return
    setShareSaving(true)
    try {
      const res = await studentApiFetch(`/api/student/digital-notes/${movedDigitalNoteId}/share`, {
        method: "PUT",
        headers: {
          ...getStudentAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studentDatabaseIds: selectedShareIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Share update failed")
      toast.success(
        selectedShareIds.length > 0
          ? `Shared with ${selectedShareIds.length} classmate${selectedShareIds.length === 1 ? "" : "s"}`
          : "Sharing removed",
      )
      setShareOpen(false)
    } catch (err: unknown) {
      toast.error("Share failed", {
        description: err instanceof Error ? err.message : "Try again.",
      })
    } finally {
      setShareSaving(false)
    }
  }, [movedDigitalNoteId, selectedShareIds])

  const deleteNote = async () => {
    if (!studentDbId) return
    setDeleteDialogOpen(false)
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/student/ai-notetaker/${pathSegmentEncoded()}?studentDatabaseId=${encodeURIComponent(studentDbId)}`,
        { method: "DELETE" },
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Delete failed")
      }
      goTo("/student/dashboard-v2/ai-notetaker")
    } catch (e: unknown) {
      setInfoDialog({
        title: "Could not delete",
        description: e instanceof Error ? e.message : "Delete failed",
      })
    } finally {
      setDeleting(false)
    }
  }

  const uploadBlob = useCallback(
    async (blob: Blob, durationSec: number, fileName = "lecture.webm", displayTitle?: string) => {
      if (!studentDbId) return
      setProcessing(true)
      const trimmedTitle = displayTitle?.trim()
      try {
        const fd = new FormData()
        fd.append("studentDatabaseId", studentDbId)
        fd.append("file", blob, fileName)
        fd.append("durationSeconds", String(durationSec))
        if (trimmedTitle) fd.append("displayTitle", trimmedTitle.slice(0, 200))
        const res = await studentApiFetch(`/api/student/ai-notetaker/${pathSegmentEncoded()}/audio`, {
          method: "POST",
          body: fd,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Upload failed")
        setNote(data.note as Note)
        const saved = data.note as Note
        if (trimmedTitle) setTitle(String((saved as Note).title ?? trimmedTitle))
        toast.success("Audio saved", {
          description: "We’re transcribing and summarizing—this can take a few minutes.",
        })
        if (saved?.slug && saved.slug !== noteRef) {
          replaceTo(`/student/dashboard-v2/ai-notetaker/${encodeURIComponent(saved.slug)}`)
        }
      } catch (e: unknown) {
        setInfoDialog({
          title: "Upload failed",
          description: e instanceof Error ? e.message : "We could not upload your audio. Please try again.",
        })
        await fetchNote()
      } finally {
        setProcessing(false)
        setPendingAudioSave(null)
      }
    },
    [studentDbId, noteRef, fetchNote, router],
  )

  const confirmAudioSave = async () => {
    const p = pendingAudioSave
    if (!p || !studentDbId) return
    const t = audioSaveTitle.trim()
    if (!t) {
      toast.error("Enter a name for this lecture.")
      return
    }
    try {
      await uploadBlob(p.blob, p.durationSec, p.fileName, t)
    } catch (e: unknown) {
      setInfoDialog({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Something went wrong.",
      })
    }
  }

  const discardAudioSave = () => {
    setPendingAudioSave(null)
    setAudioSaveTitle("")
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
      setPendingAudioSave({ blob, durationSec: dur, fileName: "lecture.webm" })
      setAudioSaveTitle(title.trim() || "Lecture")
    },
    [seconds, title],
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
            "Allow microphone access for this site in your browser settings, use HTTPS, or try uploading a file instead.",
        })
        return
      }
      if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setInfoDialog({
          title: "No microphone found",
          description: "Connect a microphone or use the upload option to add a recording file.",
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
    setPendingAudioSave({ blob: f, durationSec: 0, fileName: f.name || "lecture.webm" })
    setAudioSaveTitle(base)
  }

  const sendChat = async () => {
    if (!studentDbId || !chatInput.trim() || !limits?.chatEnabled) return
    const text = chatInput.trim()
    setChatInput("")
    setChatMessages((m) => [...m, { role: "user", text }])
    setChatSending(true)
    try {
      const res = await studentApiFetch(`/api/student/ai-notetaker/${pathSegmentEncoded()}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-student-database-id": studentDbId,
        },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      if (!res.ok) {
        setChatMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: data.upgrade
              ? "Upgrade to Trailblazer to use AI chat with your lecture notes."
              : data.error || "Something went wrong.",
          },
        ])
        return
      }
      setChatMessages((m) => [...m, { role: "assistant", text: data.reply || "" }])
    } finally {
      setChatSending(false)
    }
  }

  const audioSrc =
    studentDbId && note?.processing_status === "completed" && note.audio_storage_key
      ? `/api/student/ai-notetaker/${pathSegmentEncoded()}/audio?studentDatabaseId=${encodeURIComponent(studentDbId)}`
      : null

  const kp = useMemo((): NotetakerKeyPoints | null => {
    const raw = note?.key_points
    if (raw == null) return null
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as NotetakerKeyPoints
      } catch {
        return null
      }
    }
    return raw as NotetakerKeyPoints
  }, [note?.key_points])

  if (accessDeniedMessage) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-12">
        <Button variant="ghost" size="sm" className="gap-2 rounded-full" asChild data-notetaker-native-back>
          <Link href={navPath("/student/dashboard-v2/ai-notetaker")}>
            <ChevronLeft className="h-4 w-4" />
            Back to Learning Center
          </Link>
        </Button>
        <Card className={cn(notetakerTheme.page.border, notetakerTheme.page.softBg)}>
          <CardHeader>
            <CardTitle className={cn("text-lg", notetakerText)}>AI Notetaker</CardTitle>
            <CardDescription className={notetakerTextMuted}>{accessDeniedMessage}</CardDescription>
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

  if (loading || !note) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className={cn("h-10 w-10 animate-spin", notetakerTheme.page.iconText)} />
      </div>
    )
  }

  const maxRecordingSec = maxRecordingSecondsRef.current

  return (
    <>
    <div
      className={cn(
        "mx-auto grid min-h-[360px] w-full max-w-[1400px] grid-cols-1 gap-0 overflow-hidden pb-2",
        isNativeApp
          ? "h-[calc(100dvh-1.25rem)] max-h-[calc(100dvh-1.25rem)]"
          : "h-[calc(100dvh-10.5rem)] max-h-[calc(100dvh-10.5rem)] sm:h-[calc(100dvh-9.75rem)] sm:max-h-[calc(100dvh-9.75rem)]",
        "min-[880px]:grid-cols-[minmax(0,1fr)_400px] min-[880px]:divide-x min-[880px]:divide-[var(--border)] min-[880px]:rounded-2xl min-[880px]:border min-[880px]:border-[var(--border)] min-[880px]:bg-[var(--card)] min-[880px]:shadow-sm",
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-[var(--border)] min-[880px]:border-b-0">
        <ScrollArea className="min-h-0 flex-1" type="hover">
          <div className="space-y-6 px-3 py-3 min-[880px]:px-5 min-[880px]:py-4 pr-2">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-3 sm:gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("gap-1.5 rounded-full", notetakerTextMuted)}
            data-notetaker-native-back
            onClick={requestLeaveHome}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">All notes</span>
          </Button>
          <Badge variant="outline" className="capitalize">
            {note.processing_status.replace(/_/g, " ")}
          </Badge>
          {isMetaDirty ? (
            <Badge variant="secondary" className="text-[10px]">
              Unsaved
            </Badge>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto gap-2 rounded-full border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            disabled={deleting}
            onClick={() => setDeleteDialogOpen(true)}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </Button>
        </div>

        <Card className={cn(notetakerBorder, notetakerCardBg)}>
        <CardHeader>
          <CardTitle className="text-xl">Lecture details</CardTitle>
          <CardDescription>Title, course, and date are saved to your personal knowledge base.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Course</label>
            <Input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g. CS 4343" className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Lecture date</label>
            <Input type="date" value={lectureDate} onChange={(e) => setLectureDate(e.target.value)} className="rounded-lg" />
          </div>
          <div className="sm:col-span-2">
            <Button type="button" variant="secondary" className="rounded-full gap-2" onClick={() => void saveMeta()} disabled={savingMeta}>
              {savingMeta ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save details
            </Button>
          </div>
        </CardContent>
      </Card>

      {note.processing_status === "completed" ? (
        <Card className={cn(notetakerBorder, notetakerCardBg)}>
          <CardHeader>
            <CardTitle className="text-lg">Actions</CardTitle>
            <CardDescription>
              Move into My Notes to edit and organize, share with classmates, or export the text.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              className={cn("rounded-full gap-2", notetakerTheme.page.cta)}
              disabled={moving}
              onClick={() => void moveToMyNotes()}
            >
              {moving ? <Loader2 className="h-4 w-4 animate-spin" /> : <NotebookPen className="h-4 w-4" />}
              Move to My Notes
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full gap-2"
              onClick={() => void openClassmateShare()}
            >
              <Users className="h-4 w-4" />
              Share with classmates
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full gap-2"
              disabled={exporting}
              onClick={() => void exportNoteText("copy")}
            >
              <Copy className="h-4 w-4" />
              Copy text
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full gap-2"
              disabled={exporting}
              onClick={() => void exportNoteText("download")}
            >
              <Download className="h-4 w-4" />
              Download .txt
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full gap-2"
              disabled={exporting}
              onClick={() => {
                void (async () => {
                  const text = formatNotetakerShareText(title.trim() || note.title, {
                    ...note,
                    course_name: course.trim() || note.course_name,
                    lecture_date: lectureDate || note.lecture_date,
                  })
                  try {
                    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
                      await navigator.share({
                        title: title.trim() || note.title,
                        text,
                      })
                      return
                    }
                    await navigator.clipboard.writeText(text)
                    toast.success("Copied to clipboard")
                  } catch {
                    /* dismissed / unsupported */
                  }
                })()
              }}
            >
              <Share2 className="h-4 w-4" />
              Share…
            </Button>
          </CardContent>
        </Card>
      ) : null}

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
        className="rounded-2xl"
      >
        <Card className={cn(notetakerTheme.page.border, notetakerTheme.page.softBg)}>
          <CardHeader>
            <CardTitle className="text-lg">Audio</CardTitle>
            <CardDescription className="space-y-2">
              <span className="block">
                Record in the browser or upload a file (WebM, M4A, MP3). Your plan allows up to{" "}
                {limits?.maxNoteDurationMinutes ?? "—"} minutes per lecture.
              </span>
              <span className="block text-slate-600 dark:text-slate-400">
                Use the floating bar to pause or stop. Optional live captions work in Chrome or Edge on a computer (not
                Safari). After you stop we always run a full AI transcript and summary on the server.
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <input ref={fileInputRef} type="file" accept="audio/*,.webm,.mp3,.m4a,.wav" className="hidden" onChange={onPickFile} />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {!recording ? (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    type="button"
                    className={cn("rounded-full gap-2 shadow-md", notetakerTheme.page.cta)}
                    onClick={() => void startRecording()}
                    disabled={
                      processing || note.processing_status === "transcribing" || note.processing_status === "summarizing"
                    }
                  >
                    <Mic className="h-4 w-4" />
                    Start recording
                  </Button>
                </motion.div>
              ) : null}
              <Button
                variant="outline"
                className="rounded-full gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={
                  processing || recording || note.processing_status === "transcribing" || note.processing_status === "summarizing"
                }
              >
                <Upload className="h-4 w-4" />
                Upload file
              </Button>
              {processing && (
                <motion.span
                  className="flex items-center gap-2 text-sm text-indigo-800 dark:text-indigo-200"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Transcribing &amp; summarizing… this can take a few minutes.
                </motion.span>
              )}
            </div>
            {recording ? (
              <LiveSpeechCaptions
                active={recording && !paused}
                className="w-full"
                meterStream={recordingMeterStream}
                meterStreamRef={recordingMeterStreamRef}
                studentDatabaseId={studentDbId}
              />
            ) : null}
          </CardContent>
          {audioSrc && (
            <CardContent className="border-t border-indigo-100 pt-4 dark:border-indigo-900/40">
              <div className="w-full min-w-0 rounded-xl border border-slate-200/80 bg-slate-100/80 p-2 dark:border-slate-600/80 dark:bg-slate-800/50">
                <audio controls className="block h-10 w-full min-w-0" src={audioSrc} preload="metadata">
                  <track kind="captions" />
                </audio>
              </div>
            </CardContent>
          )}
        </Card>
      </motion.div>

      <NotetakerFloatingRecordBar
        recording={recording}
        paused={paused}
        seconds={seconds}
        maxSeconds={maxRecordingSec}
        supportsPause={supportsPause}
        onPauseToggle={togglePause}
        onStop={() => void stopRecording()}
        stopLabel="Stop and transcribe"
        micLevel={recording ? recordingMicLevel : undefined}
      />

      {note.processing_status === "failed" && note.failure_reason && (
        <Card className="border-red-200 bg-red-50/80 dark:border-red-900 dark:bg-red-950/30">
          <CardHeader>
            <CardTitle className="text-base text-red-900 dark:text-red-200">Processing failed</CardTitle>
            <CardDescription className="text-red-800 dark:text-red-300">{note.failure_reason}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {note.transcript && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-slate-200 bg-white/50 p-4 text-sm leading-relaxed dark:border-slate-700 dark:bg-slate-900/40">
                {note.transcript}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {note.summary && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Summary &amp; study guide</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50/80 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/60">
              {note.summary}
            </pre>
            {kp && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Key concepts</h4>
                  <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300">
                    {kp.keyConcepts?.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Definitions</h4>
                  <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300">
                    {kp.importantDefinitions?.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Review / action items</h4>
                  <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300">
                    {kp.actionItems?.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Possible quiz questions</h4>
                  <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300">
                    {kp.possibleQuizQuestions?.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </motion.div>
      )}

          </div>
        </ScrollArea>
      </div>

      <aside className="flex min-h-0 flex-col overflow-hidden border-t border-slate-200/90 bg-slate-50/90 dark:border-slate-700 dark:bg-slate-950/50 min-[880px]:h-full min-[880px]:border-t-0 min-[880px]:bg-slate-50/80 min-[880px]:px-1 min-[880px]:py-2 dark:min-[880px]:bg-slate-950/60">
        <Tabs defaultValue="chat" className="flex h-full min-h-0 flex-1 flex-col gap-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-3 pt-3 dark:border-slate-700">
            <TabsList className="h-auto flex-1 justify-start gap-1 rounded-xl bg-slate-100/90 p-1 dark:bg-slate-800/80">
              <TabsTrigger
                value="chat"
                className="flex-1 gap-1.5 rounded-lg text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900"
              >
                <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                Chat
              </TabsTrigger>
              <TabsTrigger
                value="outline"
                className="flex-1 gap-1.5 rounded-lg text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900"
              >
                <ListOrdered className="h-3.5 w-3.5 shrink-0" />
                Outline
              </TabsTrigger>
            </TabsList>
            {!limits?.chatEnabled && (
              <Badge variant="secondary" className="hidden shrink-0 gap-1 sm:inline-flex">
                <Lock className="h-3 w-3" />
                Trailblazer
              </Badge>
            )}
          </div>

          <TabsContent
            value="chat"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-2 pt-2 data-[state=inactive]:hidden"
          >
            {!limits?.chatEnabled ? (
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Upgrade to Trailblazer to chat with your lecture notes.{" "}
                <Link href={navPath("/student/dashboard-v2/membership")} className="font-medium text-[var(--cc-accent-dark)] underline">
                  View plans
                </Link>
              </p>
            ) : note.processing_status !== "completed" ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Available when transcription and summary are complete. You can still use <strong>Outline</strong> for
                auto-generated points when they appear.
              </p>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                <ScrollArea className="min-h-0 flex-1 rounded-xl border border-slate-200/80 bg-white/80 dark:border-slate-700 dark:bg-slate-900/80">
                  <div className="space-y-3 p-3">
                    {chatMessages.length === 0 && (
                      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        Ask anything about this transcript—e.g. &quot;What were the three main ideas about memory?&quot;
                      </p>
                    )}
                    {chatMessages.map((m, i) => (
                      <div
                        key={i}
                        className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                          m.role === "user"
                            ? cn("ml-3 text-white", notetakerTheme.page.cta)
                            : cn("mr-3", notetakerTheme.page.softBg, notetakerText)
                        }`}
                      >
                        {m.text}
                      </div>
                    ))}
                    {chatSending && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
                      </div>
                    )}
                  </div>
                </ScrollArea>
                <div className="shrink-0 rounded-xl border border-slate-200/90 bg-slate-50/90 p-2 dark:border-slate-600 dark:bg-slate-950/50">
                  <Textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about this lecture…"
                    rows={2}
                    className="min-h-0 resize-none border-0 bg-transparent p-2 text-sm shadow-none focus-visible:ring-0"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        void sendChat()
                      }
                    }}
                  />
                  <div className="flex justify-end border-t border-slate-200/60 pt-2 dark:border-slate-700">
                    <Button
                      type="button"
                      size="icon"
                      className={cn("h-9 w-9 rounded-full", notetakerTheme.page.cta)}
                      onClick={() => void sendChat()}
                      disabled={chatSending || !chatInput.trim()}
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent
            value="outline"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-2 data-[state=inactive]:hidden"
          >
            {kp ? (
              <ScrollArea className="min-h-0 flex-1 rounded-xl border border-slate-200/80 dark:border-slate-700">
                <div className="space-y-4 p-3 text-sm text-slate-700 dark:text-slate-300">
                  {kp.keyConcepts?.length ? (
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Key concepts
                      </h4>
                      <ul className="list-disc space-y-1 pl-4">
                        {kp.keyConcepts.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {kp.importantDefinitions?.length ? (
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Definitions
                      </h4>
                      <ul className="list-disc space-y-1 pl-4">
                        {kp.importantDefinitions.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {kp.actionItems?.length ? (
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Action items
                      </h4>
                      <ul className="list-disc space-y-1 pl-4">
                        {kp.actionItems.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {kp.possibleQuizQuestions?.length ? (
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Quiz-style questions
                      </h4>
                      <ul className="list-disc space-y-1 pl-4">
                        {kp.possibleQuizQuestions.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </ScrollArea>
            ) : note.summary ? (
              <ScrollArea className="min-h-0 flex-1 rounded-xl border border-slate-200/80 p-3 text-sm leading-relaxed text-slate-600 dark:border-slate-700 dark:text-slate-300">
                {note.summary.slice(0, 4000)}
                {note.summary.length > 4000 ? "…" : ""}
              </ScrollArea>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Outline and study-guide bullets appear after processing finishes.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </aside>
    </div>

      <Dialog
        open={!!pendingAudioSave}
        onOpenChange={(open) => {
          if (!open) discardAudioSave()
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Name this lecture</DialogTitle>
            <DialogDescription>
              This is how it appears in your list. You can edit course and date below after saving.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label htmlFor="notetaker-detail-save-title" className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Lecture title
            </label>
            <Input
              id="notetaker-detail-save-title"
              value={audioSaveTitle}
              onChange={(e) => setAudioSaveTitle(e.target.value)}
              placeholder="e.g. ELEG 4031 — Week 6"
              className="rounded-xl"
              maxLength={200}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void confirmAudioSave()
                }
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="rounded-full" onClick={discardAudioSave} disabled={processing}>
              Discard
            </Button>
            <Button
              type="button"
              className="rounded-full"
              onClick={() => void confirmAudioSave()}
              disabled={processing || !audioSaveTitle.trim()}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & transcribe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lecture note?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the note and its audio from your account. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <Button
              type="button"
              className="rounded-full bg-red-600 text-white hover:bg-red-700"
              disabled={deleting}
              onClick={() => void deleteNote()}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <ClassmateShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Share with classmates"
        description="Copies this lecture into My Notes (if needed) and shares a read-only copy with selected classmates."
        subjectLabel={title || note?.title || "Lecture note"}
        roster={roster}
        selectedIds={selectedShareIds}
        onSelectedIdsChange={setSelectedShareIds}
        loading={shareLoading}
        saving={shareSaving}
        onSave={saveClassmateShares}
        saveDisabled={!movedDigitalNoteId}
      />

      <AlertDialog open={unsavedDialogOpen} onOpenChange={setUnsavedDialogOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              Title, course, or date have not been saved. Save before leaving, or discard your edits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="rounded-full">Keep editing</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setUnsavedDialogOpen(false)
                leaveToHome()
              }}
            >
              Discard
            </Button>
            <Button
              type="button"
              className="rounded-full"
              disabled={savingMeta}
              onClick={() => {
                void (async () => {
                  const ok = await saveMeta()
                  if (!ok) return
                  setUnsavedDialogOpen(false)
                  leaveToHome()
                })()
              }}
            >
              {savingMeta ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & leave"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
