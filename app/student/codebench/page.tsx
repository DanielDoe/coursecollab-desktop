"use client"


import { studentApiFetch } from "@/lib/auth"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Code, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { GraduationCap } from "lucide-react"
import { NotificationBell } from "@/components/notification-bell"
import { StudentProfileDropdown } from "@/components/student-profile-dropdown"
import { useToast } from "@/components/ui/use-toast"
import dynamic from "next/dynamic"
import { Toolbar } from "@/components/codebench/Toolbar"
import { CodebenchCoraBar } from "@/components/codebench/CodebenchCoraBar"
import { AIResponsePanel } from "@/components/codebench/AIResponsePanel"
import { AITutorChat } from "@/components/codebench/AITutorChat"
import { PracticeGenerator } from "@/components/codebench/PracticeGenerator"
import { EvaluationDialog } from "@/components/codebench/EvaluationDialog"
import { AIChatInterface } from "@/components/codebench/AIChatInterface"
import { MoreMenu } from "@/components/codebench/MoreMenu/MoreMenu"
import { CodeReplay } from "@/components/codebench/CodeReplay"
import { ErrorSpotting } from "@/components/codebench/ErrorSpotting"
import { CodeStyleReview } from "@/components/codebench/CodeStyleReview"
import { WhatIfExplorer } from "@/components/codebench/WhatIfExplorer"
import { awardXP } from "@/lib/codebench-xp"
import { useNativeApp, detectNativeAppClient } from "@/hooks/use-native-app"
import { useTheme } from "@/hooks/use-theme"
import { cn } from "@/lib/utils"
import { highlightLine, clearHighlights, addErrorMarkers, addHighlightStyles } from "@/lib/monaco-utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileCode, CheckCircle2, Clock, Award } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Codebench2xMultiplierModal } from "@/components/codebench/Codebench2xMultiplierModal"
import { CodebenchEditorChrome } from "@/components/codebench/CodebenchEditorChrome"
import { CodebenchEditorCoraSplit } from "@/components/codebench/CodebenchEditorCoraSplit"
import { CodebenchExplorer } from "@/components/codebench/CodebenchExplorer"
import { useCodebenchIde } from "@/hooks/use-codebench-ide"
import { useCodebenchLiveSnapshot } from "@/hooks/use-codebench-live-snapshot"
import { useCodebenchLiveInstructorPush } from "@/hooks/use-codebench-live-instructor-push"
import { useStudentLiveClassroomSessions } from "@/hooks/use-student-live-classroom-sessions"
import { StudentLiveClassroomBanner } from "@/components/codebench/StudentLiveClassroomBanner"
import {
  StudentClassroomQuestionDrawer,
  type StudentClassroomQuestionView,
} from "@/components/codebench/StudentClassroomQuestionDrawer"
import type { StudentLiveClassroomSession } from "@/lib/codebench-live-classroom-types"
import {
  assignmentHasOpenLiveSession,
  LIVE_JOIN_GRACE_MS,
  shouldReplaceLiveEditorBuffer,
  shouldRestoreLiveStudentCode,
  shouldTreatLiveSessionAsEnded,
  studentLiveSnapshotShouldRun,
} from "@/lib/codebench-live-student-ui"
import { applyLiveEditorText, monacoCodeFromChange, readLiveEditorValue } from "@/lib/codebench-live-editor-apply"
import { extractClassroomQuestionText } from "@/lib/codebench-instructor-classroom"
import { isFileDirty } from "@/lib/codebench-ide-workspace"
import { registerCodebenchMonacoThemes, codebenchEditorOptions } from "@/lib/codebench-monaco-themes"
import { useCora } from "@/components/cora/CoraProvider"
import { coraContextFromQuestion } from "@/lib/cora/question-context"
import type { CoraThinkingMode } from "@/lib/cora/thinking-process"
import { CODEBENCH_CPP_WALKTHROUGH_SAMPLE } from "@/lib/codebench-samples"
import {
  isCodebenchCoraMembershipError,
  parseCodebenchCoraJson,
  parseOptionalCodebenchCoraJson,
} from "@/lib/codebench-cora-client"
import { CodebenchCoraUpgradeModal } from "@/components/codebench/CodebenchCoraUpgradeModal"
import { useCodebenchCoraGate } from "@/hooks/use-codebench-cora-gate"
import type { MembershipTier } from "@/lib/membership-constants"
import { enrichReplaySteps, type CodeReplayStep } from "@/lib/codebench-replay"
import { loadCodebenchAiCache, persistCodebenchAiCacheEntry } from "@/lib/codebench-ai-cache"
import {
  type CodebenchLanguageId,
  CODEBENCH_LANGUAGE_STORAGE_KEY,
  DEFAULT_CODEBENCH_LANGUAGE_ID,
  normalizeCodebenchLanguageId,
  readStoredCodebenchLanguageId,
  resolveEffectiveCodebenchLanguage,
  writeStoredCodebenchCode,
} from "@/lib/codebench-languages"
import { isDesktopElectronShell } from "@/lib/desktop-notifications"
import type { StudioDiagnostic } from "@/lib/codebench-compiler-diagnostics"
import {
  classifyCompilerMessage,
  diagnosticsToFamilies,
  recordStudioEvent,
  studioContextForPrompts,
} from "@/lib/codebench-studio-analytics"
import {
  CodeBenchExecutionDock,
  type CodeBenchExecutionHandle,
  type CodeBenchExecutionMeta,
} from "@/src/features/codebench/components/CodeBenchExecutionDock"
import type { CodeBenchRunResult } from "@/src/features/codebench/hooks/useCodeRunner"

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false })

function isCodeClassroomAssignment(submission: { submission_kind?: string }) {
  return String(submission.submission_kind ?? "code").toLowerCase() !== "solution"
}

function isBareClassroomTemplate(source: string): boolean {
  const stripped = source
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .trim()
  if (stripped.length < 20) return true
  const boilerplateOnly =
    /#include\s*<iostream>.*using\s+namespace\s+std;.*int\s+main\s*\(\s*\)\s*\{(.*return\s+0;)?\s*\}/i.test(
      stripped,
    )
  return boilerplateOnly && !/\bcout\b|\bprintf\b|\bfor\s*\(|\bif\s*\(/i.test(stripped)
}

function readStudentDatabaseId(): string | null {
  if (typeof window === "undefined") return null
  const fromStorage =
    sessionStorage.getItem("studentDatabaseId") || localStorage.getItem("studentDatabaseId")
  if (fromStorage) return fromStorage
  const studentSession = localStorage.getItem("studentSession")
  if (!studentSession) return null
  try {
    const sessionData = JSON.parse(studentSession)
    return sessionData.databaseId || sessionData.id || null
  } catch {
    return null
  }
}

export default function CodeBenchPage({
  embedded,
  toolbarEnd,
  initialAssignmentId,
}: {
  embedded?: boolean
  toolbarEnd?: ReactNode
  initialAssignmentId?: string | null
}) {
  const router = useRouter()
  const isNativeApp = useNativeApp()
  const nativeEmbedded = Boolean(
    embedded && (typeof window !== "undefined" ? detectNativeAppClient() : isNativeApp),
  )
  const skipMembershipGate = Boolean(embedded)
  const homeHref = "/student/dashboard-v2"
  const cora = useCora()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [studentId, setStudentId] = useState<string | null>(() =>
    embedded ? readStudentDatabaseId() : null,
  )
  const [languageId, setLanguageId] = useState<CodebenchLanguageId>(() =>
    typeof window !== "undefined" ? readStoredCodebenchLanguageId() : DEFAULT_CODEBENCH_LANGUAGE_ID,
  )
  const ide = useCodebenchIde({ studentId })
  const code = ide.activeContent
  const setCode = ide.setActiveContent
  const [editorKey, setEditorKey] = useState(0)
  const [learningMode, setLearningMode] = useState<"beginner" | "intermediate" | "expert">("intermediate")
  // Classroom point assignment for Evaluate submissions (submit from CodeBench = one per assignment; cannot also submit same assignment from Classroom Points)
  const [classroomSubmissions, setClassroomSubmissions] = useState<any[]>([])
  const [classroomSubmissionId, setClassroomSubmissionId] = useState<string>(
    () => initialAssignmentId?.trim() || "",
  )
  const [pinnedAssignmentId, setPinnedAssignmentId] = useState<string>(
    () => initialAssignmentId?.trim() || "",
  )
  const pinnedAssignmentIdRef = useRef(pinnedAssignmentId)
  pinnedAssignmentIdRef.current = pinnedAssignmentId
  const submittedAssignmentIdsRef = useRef<Set<string>>(new Set())
  const [assignmentSelectionConfirmed, setAssignmentSelectionConfirmed] = useState(() =>
    Boolean(initialAssignmentId?.trim()),
  )
  const [liveSharing, setLiveSharing] = useState(() => Boolean(initialAssignmentId?.trim()))
  const [questionDrawerOpen, setQuestionDrawerOpen] = useState(false)
  const [classroomQuestion, setClassroomQuestion] = useState<StudentClassroomQuestionView | null>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [submissionSuccessData, setSubmissionSuccessData] = useState<{ score: number; pointsAwarded: number; isAssignment?: boolean } | null>(null)
  const [editorRef, setEditorRef] = useState<any>(null)
  const { sessions: liveSessions, listSupported, loading: liveSessionsLoading } = useStudentLiveClassroomSessions(studentId)
  const liveAssignmentIds = useMemo(
    () => new Set(liveSessions.map((session) => String(session.assignmentId))),
    [liveSessions],
  )
  const liveSessionsRef = useRef(liveSessions)
  liveSessionsRef.current = liveSessions

  const mergeLiveAssignments = useCallback((rows: any[]) => {
    const next = [...rows]
    for (const session of liveSessionsRef.current) {
      if (!next.some((row: { id: string | number }) => String(row.id) === String(session.assignmentId))) {
        next.unshift({ id: session.assignmentId, title: session.title, submission_kind: "code" })
      }
    }
    return next
  }, [])
  const liveJoinGraceUntilRef = useRef(0)
  const liveMissCountRef = useRef(0)
  const markLiveJoinGrace = useCallback(() => {
    liveJoinGraceUntilRef.current = Date.now() + LIVE_JOIN_GRACE_MS
    liveMissCountRef.current = 0
  }, [])
  const liveSnapshotEnabled = Boolean(
    liveSharing &&
      studentId &&
      classroomSubmissionId &&
      studentLiveSnapshotShouldRun({
        liveSharing,
        studentId,
        classroomSubmissionId,
        listSupported,
        sessions: liveSessions,
        joinGraceUntilMs: liveJoinGraceUntilRef.current,
      }),
  )
  const lastInstructorToastAtRef = useRef(0)
  const noteExternalApplyRef = useRef<(ms?: number, nextDocument?: string) => void>(() => {})
  const liveEditorCodeRef = useRef(code)
  liveEditorCodeRef.current = code
  const liveEditorOriginRef = useRef<"idle" | "editor" | "external">("idle")
  const applyInstructorCode = useCallback(
    (nextCode: string, meta?: { restore?: boolean }) => {
      const current = readLiveEditorValue(editorRef, liveEditorCodeRef.current)
      if (current === nextCode) return
      if (meta?.restore && !shouldRestoreLiveStudentCode(current, nextCode, languageId)) return
      if (!meta?.restore && !shouldReplaceLiveEditorBuffer(current, nextCode, languageId)) return

      liveEditorOriginRef.current = "external"
      noteExternalApplyRef.current(400, nextCode)
      applyLiveEditorText(editorRef, nextCode, setCode)
      if (!meta?.restore && Date.now() - lastInstructorToastAtRef.current > 8000) {
        lastInstructorToastAtRef.current = Date.now()
        toast({
          title: "Instructor updated your editor",
          description: "Review the changes, then Run to try the fix.",
        })
      }
    },
    [editorRef, languageId, setCode, toast],
  )
  useEffect(() => {
    if (!editorRef) return
    if (liveEditorOriginRef.current === "editor" || liveEditorOriginRef.current === "external") {
      liveEditorOriginRef.current = "idle"
      return
    }
    const current = readLiveEditorValue(editorRef, liveEditorCodeRef.current)
    if (current === code) return
    if (!shouldReplaceLiveEditorBuffer(current, code, languageId)) return
    noteExternalApplyRef.current(400, code)
    applyLiveEditorText(editorRef, code, () => {})
  }, [code, editorRef, languageId])
  const { noteExternalApply, restoreReady } = useCodebenchLiveSnapshot({
    studentId,
    assignmentId: classroomSubmissionId || null,
    code,
    language: languageId,
    fileName: ide.activeFile?.name ?? null,
    editorRef,
    enabled: liveSnapshotEnabled,
    onRestore: (saved) => applyInstructorCode(saved, { restore: true }),
  })
  useCodebenchLiveInstructorPush({
    studentId,
    assignmentId: classroomSubmissionId || null,
    enabled: liveSnapshotEnabled && restoreReady,
    onApply: applyInstructorCode,
  })
  noteExternalApplyRef.current = noteExternalApply
  const [replaySteps, setReplaySteps] = useState<CodeReplayStep[]>([])
  const [suspiciousLines, setSuspiciousLines] = useState<any[]>([])
  const [styleIssues, setStyleIssues] = useState<any[]>([])
  const [whatIfScenarios, setWhatIfScenarios] = useState<any[]>([])
  const executionRef = useRef<CodeBenchExecutionHandle | null>(null)
  const [desktopExecution, setDesktopExecution] = useState(
    () =>
      typeof window !== "undefined" &&
      (isDesktopElectronShell() || (import.meta.env.DEV && window.location.port === "5173")),
  )
  const [executionMeta, setExecutionMeta] = useState<CodeBenchExecutionMeta | null>(null)
  const handleExecutionMeta = useCallback((meta: CodeBenchExecutionMeta) => {
    setExecutionMeta(meta)
  }, [])

  const layoutMonacoEditor = useCallback(() => {
    try {
      if (!editorRef?.layout) return
      requestAnimationFrame(() => {
        editorRef.layout()
      })
    } catch {
      // Ignore layout errors while panels are settling.
    }
  }, [editorRef])

  useEffect(() => {
    if (!editorRef) return
    const container = editorRef.getDomNode()?.parentElement
    if (!container) return
    const observer = new ResizeObserver(() => {
      try {
        requestAnimationFrame(() => editorRef.layout())
      } catch {
        // Ignore layout errors while panels are settling.
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [editorRef])
  
  // Initialize Monaco highlight styles
  useEffect(() => {
    addHighlightStyles()
  }, [])

  useEffect(() => {
    setDesktopExecution(
      isDesktopElectronShell() || (import.meta.env.DEV && window.location.port === "5173"),
    )
  }, [])

  useEffect(() => {
    const fileLanguage = ide.activeFile?.languageId
    if (!fileLanguage) return
    const next = normalizeCodebenchLanguageId(fileLanguage)
    setLanguageId(next)
    localStorage.setItem(CODEBENCH_LANGUAGE_STORAGE_KEY, next)
  }, [ide.activeFile?.id, ide.activeFile?.languageId])

  const handleLanguageChange = (id: CodebenchLanguageId) => {
    const next = normalizeCodebenchLanguageId(id)
    setLanguageId(next)
    localStorage.setItem(CODEBENCH_LANGUAGE_STORAGE_KEY, next)
    ide.setFileLanguage(next)
  }

  const handleSaveWorkspace = useCallback(() => {
    ide.saveActive()
    void ide.nameWithCora()
    recordStudioEvent(studentId || "local", {
      type: "save",
      language: languageId,
      fileName: ide.activeFile?.name,
    })
    toast({
      title: "Saved",
      description: studentId
        ? ide.localRoot
          ? `${ide.activeFile?.name ?? "Project"} is on your account and in ${ide.localRoot}.`
          : `${ide.activeFile?.name ?? "Project"} is saved to your CourseCollab account.`
        : ide.activeFile?.name
          ? `${ide.activeFile.name} is stored in this project.`
          : "File saved.",
    })
  }, [ide, languageId, studentId, toast])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault()
        handleSaveWorkspace()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [handleSaveWorkspace])

  // Save code to localStorage when it changes (per concrete language when auto-detecting)
  useEffect(() => {
    if (typeof window === "undefined" || !code) return
    writeStoredCodebenchCode(languageId, code)
  }, [code, languageId])

  const loadClassroomAssignments = useCallback(async () => {
    if (!studentId) {
      setClassroomSubmissions([])
      return
    }
    const session = typeof window !== "undefined" ? sessionStorage.getItem("studentSection") : null
    try {
      const res = await studentApiFetch(
        `/api/classroom-points/submissions?session=${session || ""}&studentId=${studentId}`,
      )
      const data = await res.json()
      const subs = Array.isArray(data.submissions) ? data.submissions : []
      const available = subs.filter(
        (s: { attempted?: boolean; expires_at?: string; submission_kind?: string; id: string | number }) =>
          isCodeClassroomAssignment(s) &&
          !s.attempted &&
          !submittedAssignmentIdsRef.current.has(String(s.id)) &&
          (!s.expires_at || new Date(s.expires_at) > new Date()),
      )
      setClassroomSubmissions(mergeLiveAssignments(available))
      setClassroomSubmissionId((current) => {
        if (current && available.some((s: { id: string | number }) => String(s.id) === current)) return current
        if (current && pinnedAssignmentIdRef.current === current) return current
        return ""
      })
    } catch {
      setClassroomSubmissions([])
    }
  }, [mergeLiveAssignments, studentId])

  useEffect(() => {
    void loadClassroomAssignments()
  }, [loadClassroomAssignments])

  useEffect(() => {
    if (!studentId || !classroomSubmissionId || !liveSharing) {
      if (!liveSharing) setClassroomQuestion(null)
      return
    }

    const liveSession = liveSessions.find((session) => String(session.assignmentId) === classroomSubmissionId)
    let cancelled = false

    void (async () => {
      try {
        const res = await studentApiFetch(`/api/classroom-points/submissions/${classroomSubmissionId}`)
        if (cancelled) return
        if (res.ok) {
          const data = (await res.json()) as {
            submission?: {
              title?: string
              description?: string | null
              session?: string | null
              question_config?: unknown
              submission_kind?: string
            }
          }
          const row = data.submission
          if (row) {
            const questionText =
              extractClassroomQuestionText({
                id: Number(classroomSubmissionId),
                title: String(row.title ?? liveSession?.title ?? "Live classroom"),
                description: row.description ?? null,
                created_at: "",
                session: row.session ?? liveSession?.session ?? null,
                submission_kind: row.submission_kind ?? "code",
                question_config: row.question_config,
                due_at: null,
                expires_at: null,
                is_active: true,
              }) || liveSession?.questionText || row.description || row.title || ""
            if (cancelled) return
            setClassroomQuestion({
              title: String(row.title ?? liveSession?.title ?? "Live classroom"),
              questionText,
              description: row.description ?? null,
              session: row.session ?? liveSession?.session ?? null,
              isLive: Boolean(liveSession),
              questionConfig: row.question_config,
            })
            return
          }
        }
      } catch {
        // fall through to live session text
      }

      if (liveSession && !cancelled) {
        setClassroomQuestion({
          title: liveSession.title,
          questionText: liveSession.questionText,
          session: liveSession.session,
          isLive: true,
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [classroomSubmissionId, liveSessions, liveSharing, studentId])

  useEffect(() => {
    if (!liveSharing || !classroomQuestion || !classroomSubmissionId) return
    const key = `cc-codebench-auto-question:${classroomSubmissionId}`
    try {
      if (sessionStorage.getItem(key) === "1") return
      sessionStorage.setItem(key, "1")
    } catch {
      /* ignore */
    }
    setQuestionDrawerOpen(true)
  }, [classroomQuestion, classroomSubmissionId, liveSharing])

  const activeLiveSession = useMemo(
    () =>
      liveSharing && classroomSubmissionId
        ? liveSessions.find((session) => String(session.assignmentId) === classroomSubmissionId) ?? null
        : null,
    [classroomSubmissionId, liveSessions, liveSharing],
  )

  const bindLiveAssignment = useCallback((session: StudentLiveClassroomSession) => {
    const id = String(session.assignmentId)
    markLiveJoinGrace()
    setPinnedAssignmentId(id)
    setClassroomSubmissionId(id)
    setAssignmentSelectionConfirmed(true)
    setLiveSharing(true)
    setClassroomQuestion({
      title: session.title,
      questionText: session.questionText,
      session: session.session,
      isLive: true,
    })
    setQuestionDrawerOpen(true)
    setClassroomSubmissions((current) => {
      if (current.some((row: { id: string | number }) => String(row.id) === id)) return current
      return [{ id: session.assignmentId, title: session.title, submission_kind: "code" }, ...current]
    })
  }, [markLiveJoinGrace])

  const leaveLiveAssignment = useCallback(
    (session?: StudentLiveClassroomSession) => {
      setLiveSharing(false)
      const assignmentId = String(session?.assignmentId ?? classroomSubmissionId ?? "").trim()
      window.dispatchEvent(
        new CustomEvent("codebench-leave-live-session", { detail: { assignmentId } }),
      )
      toast({
        title: "Left live classroom",
        description: "Your instructor can no longer see this editor.",
      })
    },
    [classroomSubmissionId, toast],
  )

  const selectClassroomAssignment = useCallback(
    (submissionId: string, confirmed = Boolean(submissionId)) => {
      if (liveSharing && String(submissionId) !== String(classroomSubmissionId)) {
        setLiveSharing(false)
        window.dispatchEvent(
          new CustomEvent("codebench-leave-live-session", {
            detail: { assignmentId: classroomSubmissionId },
          }),
        )
      }
      setClassroomSubmissionId(submissionId)
      setAssignmentSelectionConfirmed(confirmed)
    },
    [classroomSubmissionId, liveSharing],
  )

  useEffect(() => {
    const fromUrl = searchParams.get("submissionId")?.trim()
    const fromProp = initialAssignmentId?.trim()
    const next = fromProp || fromUrl
    if (!next) return
    setPinnedAssignmentId(next)
    setClassroomSubmissionId(next)
    setAssignmentSelectionConfirmed(true)
    if (fromProp) {
      markLiveJoinGrace()
      // Only turn sharing ON from a listed session. Never clear it here — a
      // transient empty/alias-missed list poll used to drop joined students
      // off the faculty roster.
      if (listSupported === true) {
        if (assignmentHasOpenLiveSession(liveSessions, next)) {
          setLiveSharing(true)
        }
      } else if (listSupported !== false) {
        setLiveSharing(true)
      }
    }
  }, [initialAssignmentId, liveSessions, listSupported, markLiveJoinGrace, searchParams])

  useEffect(() => {
    const onJoin = (event: Event) => {
      const assignmentId = String(
        (event as CustomEvent<{ assignmentId?: string | number }>).detail?.assignmentId ?? "",
      ).trim()
      if (!assignmentId) return
      const match = liveSessions.find((session) => String(session.assignmentId) === assignmentId)
      if (match) {
        bindLiveAssignment(match)
        return
      }
      markLiveJoinGrace()
      setPinnedAssignmentId(assignmentId)
      setClassroomSubmissionId(assignmentId)
      setAssignmentSelectionConfirmed(true)
      setLiveSharing(true)
    }
    window.addEventListener("codebench-join-live-session", onJoin)
    return () => window.removeEventListener("codebench-join-live-session", onJoin)
  }, [bindLiveAssignment, liveSessions, markLiveJoinGrace])

  useEffect(() => {
    const onLeave = () => setLiveSharing(false)
    window.addEventListener("codebench-leave-live-session", onLeave)
    return () => window.removeEventListener("codebench-leave-live-session", onLeave)
  }, [])

  useEffect(() => {
    const result = shouldTreatLiveSessionAsEnded({
      isJoined: liveSharing,
      listSupported,
      loading: liveSessionsLoading,
      joinGraceUntilMs: liveJoinGraceUntilRef.current,
      assignmentId: classroomSubmissionId,
      sessions: liveSessions,
      missCount: liveMissCountRef.current,
    })
    liveMissCountRef.current = result.nextMissCount
    if (!result.ended) return
    setLiveSharing(false)
    setClassroomQuestion((current) =>
      current?.isLive ? null : current,
    )
    window.dispatchEvent(
      new CustomEvent("codebench-leave-live-session", {
        detail: { assignmentId: classroomSubmissionId },
      }),
    )
    toast({
      title: "Live classroom ended",
      description: "Your instructor closed this session.",
    })
  }, [classroomSubmissionId, listSupported, liveSessions, liveSessionsLoading, liveSharing, toast])

  useEffect(() => {
    setClassroomSubmissions((current) => mergeLiveAssignments(current))
    if (pinnedAssignmentId && liveAssignmentIds.has(pinnedAssignmentId)) {
      setClassroomSubmissionId(pinnedAssignmentId)
      setAssignmentSelectionConfirmed(true)
    }
  }, [liveAssignmentIds, mergeLiveAssignments, pinnedAssignmentId])


  const [hasAccess, setHasAccess] = useState<boolean | null>(embedded ? true : null)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [membershipTier, setMembershipTier] = useState<MembershipTier | null>(null)
  const coraGate = useCodebenchCoraGate(membershipTier)
  const showCoraUpgrade = (label: string) => {
    coraGate.requestCoraAction(label, () => {})
  }
  const toastUnlessCoraUpgrade = (error: unknown, label: string, fallback: string) => {
    if (isCodebenchCoraMembershipError(error)) {
      showCoraUpgrade(label)
      return
    }
    toast({
      title: "Cora",
      description: error instanceof Error ? error.message : fallback,
      variant: "destructive",
    })
  }

  // AI Response Cache - stores responses by code hash + action type
  const [responseCache, setResponseCache] = useState<Map<string, any>>(new Map())
  // Chat conversation cache - stores chat messages for each mode
  const [chatCache, setChatCache] = useState<Map<string, any[]>>(new Map())
  // Practice problem cache - stores generated practice problems
  const [practiceProblemCache, setPracticeProblemCache] = useState<any>(null)
  const [currentCodeHash, setCurrentCodeHash] = useState<string>("")

  // AI Response States
  const [explanation, setExplanation] = useState("")
  const [debugResult, setDebugResult] = useState<{
    errors: string[]
    fixes: string[]
    correctedCode: string
    explanation: string
  } | null>(null)
  const [improvedCode, setImprovedCode] = useState<{
    improvedCode: string
    diffSummary: string
    principles: string[]
  } | null>(null)
  const [pseudocode, setPseudocode] = useState<{
    pseudocode: string
    algorithm: string
    flowchart: string
  } | null>(null)

  // UI State - Start with no tab selected to prevent auto-initialization
  const [aiTab, setAITab] = useState<string | null>(null)
  const [debugThinkingMode, setDebugThinkingMode] = useState<CoraThinkingMode>("debug")
  const [isLoading, setIsLoading] = useState({
    explain: false,
    debug: false,
    improve: false,
    pseudocode: false,
    tutor: false,
    practice: false,
    evaluate: false,
    submit: false,
  })

  // Evaluation State
  const [showEvaluationDialog, setShowEvaluationDialog] = useState(false)
  const [evaluationQuestions, setEvaluationQuestions] = useState<any[]>([])
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false)
  const { theme } = useTheme()
  
  // Ensure evaluationQuestions is always an array
  const safeEvaluationQuestions = Array.isArray(evaluationQuestions) ? evaluationQuestions : []

  // Reset assignment confirmation when switching away from evaluate tab
  useEffect(() => {
    if (aiTab !== "evaluate") {
      setAssignmentSelectionConfirmed(false)
    }
  }, [aiTab])

  // Handle tab change - reset assignment confirmation when switching away from evaluate
  const handleTabChange = (tab: string | null) => {
    if (tab === "evaluate") {
      // When switching to evaluate tab, default to "Practice Problem" and enable submit
      if (!classroomSubmissionId) {
        setAssignmentSelectionConfirmed(true) // Practice Problem is default, so enable submit
      }
    } else {
      // When switching away from evaluate tab, reset assignment confirmation
      setAssignmentSelectionConfirmed(false)
    }
    setAITab(tab)
  }

  // Listen for submission success event (includes isAssignment for 2x multiplier modal)
  useEffect(() => {
    const handleSubmissionSuccess = (event: CustomEvent) => {
      console.log("[CodeBenchPage] 🎉 Submission success event received", event.detail)
      setSubmissionSuccessData({
        score: event.detail.score,
        pointsAwarded: event.detail.pointsAwarded,
        isAssignment: event.detail.isAssignment,
      })
      setShowSuccessModal(true)
    }

    window.addEventListener('codebench-submission-success', handleSubmissionSuccess as EventListener)
    return () => {
      window.removeEventListener('codebench-submission-success', handleSubmissionSuccess as EventListener)
    }
  }, [])

  // Simple hash function for code (for cache keys)
  const hashCode = (str: string): string => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }

  // Get cache key for a specific action
  const getCacheKey = (action: string, codeContent: string): string => {
    return `${action}:${hashCode(codeContent)}`
  }

  // Check cache and return cached response if available
  const getCachedResponse = (action: string, codeContent: string): any => {
    const key = getCacheKey(action, codeContent)
    return responseCache.get(key)
  }

  // Store response in cache (memory + localStorage)
  const setCachedResponse = (action: string, codeContent: string, response: any) => {
    const key = getCacheKey(action, codeContent)
    setResponseCache((prev) => {
      const newCache = new Map(prev)
      newCache.set(key, response)
      return newCache
    })
    persistCodebenchAiCacheEntry(studentId, key, response)
  }

  // Get cached chat messages for a mode
  const getCachedChat = (mode: string, codeContent: string): any[] | null => {
    const key = getCacheKey(mode, codeContent)
    return chatCache.get(key) || null
  }

  // Store chat messages in cache
  const setCachedChat = (mode: string, codeContent: string, messages: any[]) => {
    const key = getCacheKey(mode, codeContent)
    setChatCache((prev) => {
      const newCache = new Map(prev)
      newCache.set(key, messages)
      return newCache
    })
  }

  // Clear cache when code changes
  useEffect(() => {
    const codeHash = hashCode(code)
    if (codeHash !== currentCodeHash) {
      setCurrentCodeHash(codeHash)
      // Optionally clear cache when code changes significantly
      // For now, we keep cache and only use it if code matches exactly
    }
  }, [code, currentCodeHash])

  // Hydrate AI cache from localStorage when student session is ready
  useEffect(() => {
    if (!studentId) return
    setResponseCache(loadCodebenchAiCache(studentId))
  }, [studentId])

  // Restore explain + replay from cache when code matches (survives refresh)
  useEffect(() => {
    if (!code || !studentId) return
    const cached = responseCache.get(getCacheKey("explain", code))
    if (!cached) return
    if (cached.explanation) setExplanation(cached.explanation)
    if (cached.replaySteps?.length) {
      setReplaySteps(enrichReplaySteps(code, cached.replaySteps))
    }
  }, [code, studentId, responseCache])

  // Load cached response when switching tabs (if available)
  useEffect(() => {
    if (!code || !studentId) return

    const cached = aiTab ? getCachedResponse(aiTab, code || "") : null
    if (cached) {
      // Load cached data based on tab
      switch (aiTab) {
        case "explain":
          if (cached.explanation && !explanation) {
            setExplanation(cached.explanation)
          }
          if (cached.replaySteps?.length) {
            setReplaySteps(enrichReplaySteps(code, cached.replaySteps))
          }
          break
        case "debug":
          if (cached.debugResult && !debugResult) {
            setDebugResult(cached.debugResult)
          }
          break
        case "improve":
          if (cached.improvedCode && !improvedCode) {
            setImprovedCode(cached.improvedCode)
          }
          break
        case "pseudocode":
          if (cached.pseudocode && !pseudocode) {
            setPseudocode(cached.pseudocode)
          }
          break
      }
    }
  }, [aiTab, code, studentId, explanation, debugResult, improvedCode, pseudocode]) // Include state vars to prevent unnecessary updates

  // Resolve student session; membership gate only for standalone web (embedded/native trust app nav)
  useEffect(() => {
    const initAccess = async () => {
      try {
        let studentDatabaseId =
          sessionStorage.getItem("studentDatabaseId") || localStorage.getItem("studentDatabaseId")

        if (!studentDatabaseId) {
          const studentSession = localStorage.getItem("studentSession")
          if (studentSession) {
            try {
              const sessionData = JSON.parse(studentSession)
              studentDatabaseId = sessionData.databaseId || sessionData.id
            } catch (e) {
              console.error("[CodeBench] Failed to parse studentSession:", e)
            }
          }
        }

        if (!studentDatabaseId) {
          router.push("/student/login")
          return
        }

        if (!sessionStorage.getItem("studentDatabaseId")) {
          sessionStorage.setItem("studentDatabaseId", studentDatabaseId)
        }

        setStudentId(studentDatabaseId)

        setHasAccess(true)

        try {
          const response = await studentApiFetch(`/api/student/membership?studentId=${studentDatabaseId}`)
          if (response.ok) {
            const data = await response.json()
            setMembershipTier((data.membership?.tier || "Scholar") as MembershipTier)
          } else {
            setMembershipTier("Scholar")
          }
        } catch {
          setMembershipTier("Scholar")
        }

        if (typeof window !== "undefined") {
          const hasVisited = localStorage.getItem("codebench_welcome_bonus")
          if (!hasVisited) {
            const welcomeXP = awardXP("CODE_SUBMIT", 25)
            localStorage.setItem("codebench_welcome_bonus", "true")
            toast({
              title: "🎉 Welcome to CodeBench!",
              description: `You received ${welcomeXP} XP as a welcome bonus!`,
            })
          }
        }
      } catch (error) {
        console.error("Error checking CodeBench access:", error)
        setHasAccess(true)
      }
    }

    void initAccess()
  }, [router, toast, skipMembershipGate])

  // Native app / hub deep-link: ?tool=… or sessionStorage from CodeBench hub
  useEffect(() => {
    if (!hasAccess || !studentId) return
    let tool = searchParams.get("tool")
    if (!tool) {
      try {
        tool = sessionStorage.getItem("codebench_hub_tool")
        if (tool) sessionStorage.removeItem("codebench_hub_tool")
      } catch {
        tool = null
      }
    }
    if (!tool) return
    const allowed = new Set([
      "explain",
      "walkthrough",
      "debug",
      "improve",
      "pseudocode",
      "tutor",
      "practice",
      "evaluate",
    ])
    if (tool === "walkthrough") {
      void handleWalkWithCora()
      return
    }
    if (allowed.has(tool)) {
      handleTabChange(tool)
    }
  }, [hasAccess, studentId, searchParams])

  useEffect(() => {
    if (!studentId || hasAccess !== true) return
    const bridge = (window as Window & { ReactNativeWebView?: { postMessage: (msg: string) => void } })
      .ReactNativeWebView
    bridge?.postMessage(JSON.stringify({ type: "CODEBENCH_READY" }))
  }, [studentId, hasAccess, embedded])

  // Monaco Editor handlers
  const handleHighlightLine = (lineNumber: number) => {
    if (editorRef) {
      highlightLine(editorRef, lineNumber).catch(console.error)
    }
  }

  const handleClearHighlight = () => {
    if (editorRef) {
      clearHighlights(editorRef).catch(console.error)
    }
  }

  const handleHighlightLineWithError = (lineNumber: number, highlight: boolean) => {
    if (editorRef) {
      if (highlight) {
        highlightLine(editorRef, lineNumber, "error-line").catch(console.error)
      } else {
        clearHighlights(editorRef).catch(console.error)
      }
    }
  }

  // AI Action Handlers
  const handleExplain = async (codeOverride?: string) => {
    if (!coraGate.coraAccess) {
      coraGate.requestCoraAction("Explain with Cora", () => {})
      return
    }
    const codeToExplain = codeOverride ?? code
    if (!studentId) {
      toast({
        title: "Error",
        description: "Please ensure you're logged in.",
        variant: "destructive",
      })
      return
    }
    
    // If no code or just default code, show message
    if (!codeToExplain || codeToExplain.trim().length < 10) {
      setAITab("explain")
      toast({
        title: "No Code",
        description: "Please write some code in the editor first.",
        variant: "default",
      })
      return
    }

    const explainLanguage = resolveEffectiveCodebenchLanguage(
      codeOverride ? "cpp" : languageId,
      codeToExplain,
    ).apiLanguage

    // Check cache first — no API calls when walkthrough is already stored
    const cached = getCachedResponse("explain", codeToExplain)
    if (cached?.explanation || cached?.replaySteps?.length) {
      setAITab("explain")
      if (cached.explanation) setExplanation(cached.explanation)
      setReplaySteps(enrichReplaySteps(codeToExplain, cached.replaySteps || []))
      return
    }

    setIsLoading((prev) => ({ ...prev, explain: true }))
    setAITab("explain")
    setReplaySteps([])

    try {
      // Fetch both explanation and replay data
      const [explainResponse, replayResponse] = await Promise.all([
        fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: codeToExplain,
            language: explainLanguage,
            studentId,
            learningMode,
            studioContext: studioContextForPrompts(studentId || "local"),
          }),
        }),
        fetch("/api/codebench/replay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: codeToExplain,
            language: explainLanguage,
            studentId,
            learningMode,
            studioContext: studioContextForPrompts(studentId || "local"),
          }),
        }),
      ])

      const explainData = await parseCodebenchCoraJson<{
        explanation?: string
        error?: string
        accessDenied?: boolean
      }>(explainResponse, "Failed to generate explanation")
      const replayData = await parseOptionalCodebenchCoraJson<{ steps?: unknown[] }>(
        replayResponse,
        "Failed to generate walkthrough",
        { steps: [] },
      )

      if (explainData.accessDenied) {
        showCoraUpgrade("Explain with Cora")
      } else if (explainData.explanation) {
        setExplanation(explainData.explanation)
        const enriched = enrichReplaySteps(codeToExplain, replayData.steps || [])
        setReplaySteps(enriched)
        // Cache the response
        setCachedResponse("explain", codeToExplain, {
          explanation: explainData.explanation,
          replaySteps: enriched,
        })
        // Award XP for using Explain feature
        const earnedXP = awardXP("EXPLAIN")
        toast({
          title: "Explanation Generated",
          description: `+${earnedXP} XP for using Explain`,
        })
      } else {
        toast({
          title: "Error",
          description: explainData.error || "Failed to generate explanation",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Explain error:", error)
      toastUnlessCoraUpgrade(error, "Explain with Cora", "Failed to get AI explanation")
    } finally {
      setIsLoading((prev) => ({ ...prev, explain: false }))
    }
  }

  const handleTrySampleWalkthrough = async () => {
    setLanguageId("cpp")
    localStorage.setItem(CODEBENCH_LANGUAGE_STORAGE_KEY, "cpp")
    setCode(CODEBENCH_CPP_WALKTHROUGH_SAMPLE)
    setEditorKey((k) => k + 1)
    await handleExplain(CODEBENCH_CPP_WALKTHROUGH_SAMPLE)
  }

  const handleWalkWithCora = async () => {
    const codeToWalk = code.trim().length >= 10 ? code : CODEBENCH_CPP_WALKTHROUGH_SAMPLE
    if (codeToWalk === CODEBENCH_CPP_WALKTHROUGH_SAMPLE && code !== codeToWalk) {
      setLanguageId("cpp")
      localStorage.setItem(CODEBENCH_LANGUAGE_STORAGE_KEY, "cpp")
      setCode(codeToWalk)
      setEditorKey((k) => k + 1)
    }
    await handleExplain(codeToWalk)
  }

  const handleDebug = async (options?: { compilerOutput?: string; skipCache?: boolean }) => {
    if (!coraGate.coraAccess) {
      coraGate.requestCoraAction(options?.compilerOutput ? "Suggest Fix with Cora" : "Debug with Cora", () => {})
      return
    }
    if (!studentId) {
      toast({
        title: "Error",
        description: "Please ensure you're logged in.",
        variant: "destructive",
      })
      return
    }
    
    // If no code or just default code, show message
    if (!code || code.trim().length < 10) {
      setAITab("debug")
      toast({
        title: "No Code",
        description: "Please write some code in the editor first.",
        variant: "default",
      })
      return
    }

    // Check cache first
    const cached = options?.skipCache ? null : getCachedResponse("debug", code)
    if (cached) {
      setAITab("debug")
      setDebugResult(cached.debugResult)
      if (cached.suspiciousLines) {
        setSuspiciousLines(cached.suspiciousLines)
      }
      return
    }

    setDebugThinkingMode(options?.compilerOutput ? "suggest_fix" : "debug")
    setDebugResult(null)
    setIsLoading((prev) => ({ ...prev, debug: true }))
    setAITab("debug")

    try {
      // Fetch both debug and error spotting data
      const [debugResponse, errorSpottingResponse] = await Promise.all([
        fetch("/api/debug", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            language: currentLanguage.apiLanguage,
            studentId,
            learningMode,
            compilerOutput: options?.compilerOutput,
            studioContext: studioContextForPrompts(studentId),
          }),
        }),
        fetch("/api/codebench/error-spotting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            language: currentLanguage.apiLanguage,
            studentId,
            learningMode,
            studioContext: studioContextForPrompts(studentId),
          }),
        }),
      ])

      const debugData = await parseCodebenchCoraJson<{
        accessDenied?: boolean
        error?: string
        errors?: string[]
        fixes?: string[]
        correctedCode?: string
        explanation?: string
        lineNumbers?: number[]
        lineNumberCorrections?: Record<number, number>
      }>(debugResponse, "Failed to debug code")
      const errorSpottingData = await parseOptionalCodebenchCoraJson<{ suspiciousLines?: unknown[] }>(
        errorSpottingResponse,
        "Failed to analyze code",
        { suspiciousLines: [] },
      )

      if (debugData.accessDenied) {
        showCoraUpgrade(options?.compilerOutput ? "Suggest Fix with Cora" : "Debug with Cora")
      } else if (debugData.errors || debugData.correctedCode) {
        const debugResult = {
          errors: debugData.errors || [],
          fixes: debugData.fixes || [],
          correctedCode: debugData.correctedCode || code,
          explanation: debugData.explanation || "",
          lineNumbers: debugData.lineNumbers || [],
          lineNumberCorrections: debugData.lineNumberCorrections,
        }
        setDebugResult(debugResult)
        setSuspiciousLines(errorSpottingData.suspiciousLines || [])
        // Cache the response
        setCachedResponse("debug", code, {
          debugResult,
          suspiciousLines: errorSpottingData.suspiciousLines || [],
        })
        // Award XP for using Debug feature
        const earnedXP = awardXP("DEBUG")
        toast({
          title: "Code Debugged",
          description: `+${earnedXP} XP for using Debug`,
        })
      } else {
        toast({
          title: "Error",
          description: debugData.error || "Failed to debug code",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Debug error:", error)
      toastUnlessCoraUpgrade(
        error,
        options?.compilerOutput ? "Suggest Fix with Cora" : "Debug with Cora",
        "Failed to debug code",
      )
    } finally {
      setIsLoading((prev) => ({ ...prev, debug: false }))
    }
  }

  const handleImprove = async () => {
    if (!coraGate.coraAccess) {
      coraGate.requestCoraAction("Improve with Cora", () => {})
      return
    }
    if (!studentId) {
      toast({
        title: "Error",
        description: "Please ensure you're logged in.",
        variant: "destructive",
      })
      return
    }
    
    // If no code or just default code, show message
    if (!code || code.trim().length < 10) {
      setAITab("improve")
      toast({
        title: "No Code",
        description: "Please write some code in the editor first.",
        variant: "default",
      })
      return
    }

    // Check cache first
    const cached = getCachedResponse("improve", code)
    if (cached) {
      setAITab("improve")
      setImprovedCode(cached.improvedCode)
      if (cached.styleIssues) {
        setStyleIssues(cached.styleIssues)
      }
      return
    }

    setIsLoading((prev) => ({ ...prev, improve: true }))
    setAITab("improve")

    try {
      // Fetch both improve and style review data
      const [improveResponse, styleReviewResponse] = await Promise.all([
        fetch("/api/improve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            language: currentLanguage.apiLanguage,
            studentId,
            learningMode,
            studioContext: studioContextForPrompts(studentId || "local"),
          }),
        }),
        fetch("/api/codebench/style-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            language: currentLanguage.apiLanguage,
            studentId,
            learningMode,
            studioContext: studioContextForPrompts(studentId || "local"),
          }),
        }),
      ])

      const improveData = await parseCodebenchCoraJson<{
        accessDenied?: boolean
        error?: string
        improvedCode?: string
        diffSummary?: string
        principles?: string[]
      }>(improveResponse, "Failed to improve code")
      const styleReviewData = await parseOptionalCodebenchCoraJson<{ issues?: unknown[] }>(
        styleReviewResponse,
        "Failed to review code",
        { issues: [] },
      )

      if (improveData.accessDenied) {
        showCoraUpgrade("Improve with Cora")
      } else if (improveData.improvedCode) {
        const improvedCodeData = {
          improvedCode: improveData.improvedCode || code,
          diffSummary: improveData.diffSummary || "",
          principles: improveData.principles || [],
        }
        setImprovedCode(improvedCodeData)
        setStyleIssues(styleReviewData.issues || [])
        // Cache the response
        setCachedResponse("improve", code, {
          improvedCode: improvedCodeData,
          styleIssues: styleReviewData.issues || [],
        })
        // Award XP for using Improve feature
        const earnedXP = awardXP("IMPROVE")
        toast({
          title: "Code Improved",
          description: `+${earnedXP} XP for using Improve`,
        })
      } else {
        toast({
          title: "Error",
          description: improveData.error || "Failed to improve code",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Improve error:", error)
      toastUnlessCoraUpgrade(error, "Improve with Cora", "Failed to improve code")
    } finally {
      setIsLoading((prev) => ({ ...prev, improve: false }))
    }
  }

  const handlePseudocode = async () => {
    if (!coraGate.coraAccess) {
      coraGate.requestCoraAction("Pseudocode with Cora", () => {})
      return
    }
    if (!studentId) {
      toast({
        title: "Error",
        description: "Please ensure you're logged in.",
        variant: "destructive",
      })
      return
    }

    // If no code or code is just a description/question, use API to generate pseudocode
    const codeTrimmed = code ? code.trim() : ""
    const isDescription = !codeTrimmed || codeTrimmed.length < 10 || 
      codeTrimmed.toLowerCase().includes("write") || 
      codeTrimmed.toLowerCase().includes("create") || 
      codeTrimmed.toLowerCase().includes("make") ||
      codeTrimmed.toLowerCase().includes("how to") ||
      codeTrimmed.toLowerCase().includes("help me") ||
      codeTrimmed.toLowerCase().includes("help") ||
      (!codeTrimmed.includes("{") && !codeTrimmed.includes(";") && !codeTrimmed.includes("(") && !codeTrimmed.includes("="))

    if (isDescription) {
      // For descriptions, call the API to generate pseudocode
      // Ensure we have a valid description (not empty)
      if (!codeTrimmed) {
        toast({
          title: "No Input",
          description: "Please enter some code or describe what you want to code.",
          variant: "default",
        })
        return
      }

      setIsLoading((prev) => ({ ...prev, pseudocode: true }))
      setAITab("pseudocode")

      try {
        const response = await fetch("/api/pseudocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            description: codeTrimmed, // Use trimmed code, not empty string
            language: currentLanguage.apiLanguage, 
            studentId 
          }),
        })

        const data = await parseCodebenchCoraJson<{
          accessDenied?: boolean
          error?: string
          pseudocode?: string
          algorithm?: string
          flowchart?: string
        }>(response, "Failed to generate pseudocode")

        if (data.accessDenied) {
          showCoraUpgrade("Pseudocode with Cora")
        } else if (data.pseudocode) {
          // The API returns a combined formatted response in data.pseudocode
          const pseudocodeData = {
            pseudocode: data.pseudocode || "",
            algorithm: data.algorithm || "",
            flowchart: data.flowchart || "",
          }
          setPseudocode(pseudocodeData)
          // Cache the response
          setCachedResponse("pseudocode", code, { pseudocode: pseudocodeData })
          // Award XP for using Pseudocode feature
          const earnedXP = awardXP("PSEUDOCODE")
          toast({
            title: "Pseudocode Generated",
            description: `+${earnedXP} XP for using Pseudocode`,
          })
          // Force a small delay to ensure state is updated before component renders
          setTimeout(() => {
            // This ensures the pseudocode is available when the component renders
          }, 100)
        } else {
          toast({
            title: "Error",
            description: data.error || "Failed to generate pseudocode",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Pseudocode error:", error)
        toastUnlessCoraUpgrade(error, "Pseudocode with Cora", "Failed to generate pseudocode")
      } finally {
        setIsLoading((prev) => ({ ...prev, pseudocode: false }))
      }
      return
    }

    // For actual code, use the API endpoint
    // Ensure we have valid code
    if (!codeTrimmed) {
      toast({
        title: "No Code",
        description: "Please write some code in the editor first.",
        variant: "default",
      })
      return
    }

    // Check cache first
    const cached = getCachedResponse("pseudocode", codeTrimmed)
    if (cached) {
      setAITab("pseudocode")
      setPseudocode(cached.pseudocode)
      return
    }

    setIsLoading((prev) => ({ ...prev, pseudocode: true }))
    setAITab("pseudocode")

    try {
      const response = await fetch("/api/pseudocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          code: codeTrimmed, // Use trimmed code
          language: resolveEffectiveCodebenchLanguage(languageId, code).apiLanguage, 
          studentId 
        }),
      })

      const data = await parseCodebenchCoraJson<{
        accessDenied?: boolean
        error?: string
        pseudocode?: string
        algorithm?: string
        flowchart?: string
      }>(response, "Failed to generate pseudocode")

      if (data.accessDenied) {
        showCoraUpgrade("Pseudocode with Cora")
      } else if (data.pseudocode) {
        const pseudocodeData = {
          pseudocode: data.pseudocode || "",
          algorithm: data.algorithm || "",
          flowchart: data.flowchart || "",
        }
        setPseudocode(pseudocodeData)
        // Cache the response
        setCachedResponse("pseudocode", code, { pseudocode: pseudocodeData })
        // Award XP for using Pseudocode feature
        const earnedXP = awardXP("PSEUDOCODE")
        toast({
          title: "Pseudocode Generated",
          description: `+${earnedXP} XP for using Pseudocode`,
        })
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to generate pseudocode",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Pseudocode error:", error)
      toastUnlessCoraUpgrade(error, "Pseudocode with Cora", "Failed to generate pseudocode")
    } finally {
      setIsLoading((prev) => ({ ...prev, pseudocode: false }))
    }
  }

  const handleTutor = () => {
    // For toolbar: if code exists, analyze it; otherwise just open chat
    if (code && code.trim().length > 10) {
      // Code exists - could analyze it, but for tutor mode, just open chat
      setAITab("tutor")
    } else {
      // No code - just open chat for general questions
      setAITab("tutor")
    }
  }

  const handlePractice = () => {
    setAITab("practice")
    // Practice problem is cached, so it will load automatically
  }

  const handleEvaluate = () => {
    console.log("[CodeBenchPage] 📝 Evaluate button clicked")
    if (!code || !studentId) {
      toast({
        title: "Code Required",
        description: "Please write some code in the editor before evaluating.",
        variant: "destructive",
      })
      return
    }
    // Switch to evaluate tab - default to "Practice Problem" which enables submit
    handleTabChange("evaluate")
  }

  const handleCoraClear = () => {
    setAITab(null)
    setExplanation("")
    setDebugResult(null)
    setImprovedCode(null)
    setPseudocode(null)
    setReplaySteps([])
    setSuspiciousLines([])
    setStyleIssues([])
    setWhatIfScenarios([])
    if (editorRef) {
      void clearHighlights(editorRef)
    }
  }

  const handleRunResult = useCallback(
    (result: CodeBenchRunResult) => {
      const sid = studentId || "local"
      const fileName = ide.activeFile?.name
      recordStudioEvent(sid, { type: "run", language: "cpp", fileName })
      if (result.outcome === "compile-error") {
        const first =
          diagnosticsToFamilies(result.diagnostics)[0] ??
          {
            family: classifyCompilerMessage(result.stderr),
            message: result.stderr.split(/\r?\n/).find(Boolean) || "Compile failed",
          }
        recordStudioEvent(sid, {
          type: "compile_error",
          language: "cpp",
          fileName,
          errorFamily: first.family,
          errorMessage: first.message,
          line: result.diagnostics[0]?.line,
          success: false,
        })
        if (editorRef && result.diagnostics.length) {
          void addErrorMarkers(
            editorRef,
            result.diagnostics.map((item) => ({
              lineNumber: item.line,
              message: item.message,
              severity: item.severity === "warning" || item.severity === "note" ? "warning" : "error",
            })),
          )
        }
        return
      }
      recordStudioEvent(sid, { type: "compile_success", language: "cpp", fileName, success: true })
      if (result.outcome === "failed" || (result.exitCode != null && result.exitCode !== 0)) {
        recordStudioEvent(sid, {
          type: "runtime_exit",
          language: "cpp",
          fileName,
          errorFamily: "runtime",
          exitCode: result.exitCode,
          success: false,
        })
      }
      if (editorRef) {
        void addErrorMarkers(editorRef, [])
      }
    },
    [editorRef, ide.activeFile?.name, studentId],
  )

  const handleSuggestFix = (payload: { stderr: string; diagnostics: StudioDiagnostic[] }) => {
    const first = payload.diagnostics[0]
    const compilerOutput =
      payload.stderr.trim() ||
      (first ? `${first.file}:${first.line}:${first.column}: ${first.severity}: ${first.message}` : "")
    recordStudioEvent(studentId || "local", {
      type: "suggest_fix",
      language: "cpp",
      fileName: ide.activeFile?.name,
      tool: "debug",
      errorFamily: classifyCompilerMessage(compilerOutput),
      errorMessage: first?.message || compilerOutput.slice(0, 200),
    })
    void handleDebug({ compilerOutput, skipCache: true })
  }

  const handleCoraToolSelect = (tool: string) => {
    if (!coraGate.coraAccess) {
      coraGate.requestCoraAction("Cora in CodeBench", () => {})
      return
    }
    recordStudioEvent(studentId || "local", {
      type: "cora_tool",
      tool,
      language: languageId,
      fileName: ide.activeFile?.name,
    })
    setAITab(tool === "walkthrough" ? "explain" : tool)
    switch (tool) {
      case "explain":
        void handleExplain()
        break
      case "walkthrough":
        void handleWalkWithCora()
        break
      case "debug":
        void handleDebug()
        break
      case "improve":
        void handleImprove()
        break
      case "pseudocode":
        void handlePseudocode()
        break
      case "tutor":
        handleTutor()
        break
      case "practice":
        handlePractice()
        break
      case "evaluate":
        handleEvaluate()
        break
      default:
        handleTabChange(tool)
    }
  }

  const handlePracticeProblemGenerated = (problem: any) => {
    // Cache the practice problem
    setPracticeProblemCache(problem)
  }

  const handleClassroomCodeSubmit = async () => {
    const editorCode = editorRef?.getValue?.() ?? code
    if (!studentId) {
      toast({
        title: "Sign in required",
        description: "Sign in to submit code for classroom points.",
        variant: "destructive",
      })
      return
    }
    if (!classroomSubmissionId) {
      toast({
        title: "Assignment required",
        description: "Select a classroom assignment before submitting.",
        variant: "destructive",
      })
      return
    }
    if (!editorCode?.trim() || isBareClassroomTemplate(editorCode)) {
      toast({
        title: "Write some code first",
        description: "The editor still looks like the default template. Add your solution, then submit.",
        variant: "destructive",
      })
      return
    }

    const selected = classroomSubmissions.find(
      (s: { id: string | number }) => String(s.id) === classroomSubmissionId,
    )
    setIsLoading((prev) => ({ ...prev, submit: true }))
    try {
      const response = await studentApiFetch("/api/classroom-points/submit-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editorCode,
          studentId,
          description: selected?.title ? `Submitted from CodeBench: ${selected.title}` : "Submitted from CodeBench",
          submissionId: parseInt(classroomSubmissionId, 10),
        }),
      })
      const data = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
      if (!response.ok || !data.success) {
        toast({
          title: "Submission failed",
          description: data.error || "Could not submit this assignment. Try again.",
          variant: "destructive",
        })
        return
      }

      const submittedId = classroomSubmissionId
      submittedAssignmentIdsRef.current.add(submittedId)
      setClassroomSubmissions((prev) =>
        prev.filter((s: { id: string | number }) => String(s.id) !== submittedId),
      )
      setClassroomSubmissionId("")
      setAssignmentSelectionConfirmed(false)
      setLiveSharing(false)
      void loadClassroomAssignments()
      setSubmissionSuccessData({
        score: Number(data.score) || 0,
        pointsAwarded: Number(data.pointsAwarded) || 2.5,
        isAssignment: true,
      })
      setShowSuccessModal(true)
      toast({
        title: data.autoApproved ? "Submitted and scored" : "Submitted for classroom points",
        description: selected?.title
          ? `${selected.title} — ${Number(data.pointsAwarded ?? 2.5).toFixed(2)} points`
          : `${Number(data.pointsAwarded ?? 2.5).toFixed(2)} points pending review`,
      })
    } catch {
      toast({
        title: "Submission failed",
        description: "Could not reach classroom points. Try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading((prev) => ({ ...prev, submit: false }))
    }
  }

  const handleSubmit = async () => {
    console.log("[CodeBenchPage] 🚀 handleSubmit called", { 
      hasCode: !!code, 
      codeLength: code?.length, 
      studentId,
      assignmentSelectionConfirmed,
      classroomSubmissionId,
      currentTab: aiTab
    })
    
    if (!code || !studentId) {
      console.log("[CodeBenchPage] ❌ Cannot submit - missing code or studentId")
      toast({
        title: "Missing Information",
        description: "Please write some code before submitting.",
        variant: "destructive",
      })
      return
    }

    // If not already on evaluate tab, switch to it
    if (aiTab !== "evaluate") {
      console.log("[CodeBenchPage] 📝 Switching to evaluate tab")
      handleTabChange("evaluate")
      return
    }

    // Check if assignment is selected (assignment or "Practice Problem")
    if (!assignmentSelectionConfirmed) {
      toast({
        title: "Assignment Required",
        description: "Please select an assignment or 'Practice Problem' from the dropdown before submitting.",
        variant: "destructive",
      })
      return
    }

    // Already on evaluate tab with assignment selected - evaluation should start automatically
    // The AIChatInterface will handle starting the evaluation questions
    console.log("[CodeBenchPage] ✅ Ready to start evaluation", { 
      assignmentId: classroomSubmissionId || "practice-problem" 
    })
    setShowEvaluationDialog(false) // Ensure dialog is closed
    setIsLoading((prev) => ({ ...prev, submit: false })) // Reset loading since chat handles it
  }

  const handleEvaluationSubmit = async (answers: string[], score?: number, feedback?: string) => {
    if (!code || !studentId) return

    setIsLoading((prev) => ({ ...prev, submit: true }))

    try {
      const assignmentId = searchParams.get("assignmentId")
      
      // If score provided from chat, use it directly
      if (score !== undefined) {
        const assignmentId = searchParams.get("assignmentId")
        const response = await fetch("/api/codebench/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            assignmentId,
            studentId,
            score,
            feedback: feedback || "Comprehension evaluation completed",
          }),
        })

        const data = await response.json()

        if (data.success) {
          const evalData = data.evaluation || {}
          const finalScore = evalData.score ?? score
          const finalPoints = evalData.pointsAwarded ?? ((score / 10) * 5)
          // Award XP for code submission
          const earnedXP = awardXP("CODE_SUBMIT")
          
          // Record streak activity
          if (studentId) {
            try {
              await fetch("/api/codebench/streak", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ studentId }),
              })
            } catch (e) {
              console.error("Failed to record streak:", e)
            }
          }
          
          toast({
            title: "Submitted Successfully!",
            description: `Score: ${finalScore.toFixed(1)}/10 - ${finalPoints.toFixed(2)} points pending approval • +${earnedXP} XP`,
          })
        } else {
          toast({
            title: "Error",
            description: data.error || "Failed to submit evaluation",
            variant: "destructive",
          })
        }
      } else {
        // Legacy flow with answers array
        const response = await fetch("/api/codebench/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, assignmentId, studentId, answers }),
        })

        const data = await response.json()

        if (data.success) {
          if (data.evaluation) {
            toast({
              title: "Submitted Successfully!",
              description: `Score: ${data.evaluation.totalScore.toFixed(1)}% - ${data.evaluation.pointsAwarded.toFixed(2)} points pending approval`,
            })
          } else {
            toast({
              title: "Success",
              description: data.message || "Code submitted successfully!",
            })
          }
        } else {
          toast({
            title: "Error",
            description: data.error || "Failed to submit code",
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit code",
        variant: "destructive",
      })
    } finally {
      setIsLoading((prev) => ({ ...prev, submit: false }))
    }
  }

  // Show access denied message if no access
  if (hasAccess === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        {!embedded && (
        <header className="sticky top-0 z-50 border-b border-white/20 dark:border-gray-800/50 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80">
          <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
            <Link href={homeHref} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shrink-0">
                <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">CourseCollab</h1>
            </Link>
            <StudentProfileDropdown />
          </div>
        </header>
        )}
        <main className="container mx-auto px-3 sm:px-4 py-8 sm:py-12 md:py-16">
          <div className="max-w-2xl mx-auto text-center space-y-4 sm:space-y-6">
            <div className="p-6 sm:p-8 bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl shadow-xl">
              <Code className="h-12 w-12 sm:h-16 sm:w-16 text-purple-600 dark:text-purple-400 mx-auto mb-3 sm:mb-4" />
              <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 dark:text-slate-200">
                Couldn&apos;t open CodeBench
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mb-4 sm:mb-6 break-words">
                {accessError || "We couldn't open CodeBench. Sign in again and try once more."}
              </p>
              <div className="space-y-3 sm:space-y-4">
                <Link href="/student/login">
                  <button className="w-full px-4 py-2.5 text-sm sm:text-base bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-700 dark:to-purple-700 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 dark:hover:from-indigo-800 dark:hover:to-purple-800 transition-all">
                    Sign in
                  </button>
                </Link>
                <Link href={homeHref}>
                  <button className="w-full px-4 py-2.5 text-sm sm:text-base border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-300 transition-all">
                    <ArrowLeft className="inline h-4 w-4 mr-2" />
                    <span className="sm:hidden">Back</span>
                    <span className="hidden sm:inline">Back to Dashboard</span>
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (hasAccess === null && !skipMembershipGate) {
    return (
      <div className="min-h-[50dvh] flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-[#0B1120]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600 dark:text-purple-400" />
        <p className="text-sm text-slate-600 dark:text-slate-400">Loading CodeBench…</p>
      </div>
    )
  }

  if (!studentId) {
    if (embedded) {
      return <div className="min-h-0 flex-1 bg-slate-50 dark:bg-[#0c0f16]" aria-hidden />
    }
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-lg mb-4">Loading CodeBench...</div>
          <div className="text-slate-400 text-sm">Checking authentication...</div>
        </div>
      </div>
    )
  }

  const isDark = theme === "dark" || nativeEmbedded
  const editorTheme = isDark ? "codebench-dark" : "codebench-light"
  const panelTheme = nativeEmbedded ? "dark" : theme
  const currentLanguage = resolveEffectiveCodebenchLanguage(languageId, code)
  const detectedLabel = currentLanguage.label
  const lineCount = code.split("\n").length

  return (
    <div
      data-codebench-native-root={nativeEmbedded ? "" : undefined}
      className={cn(
      "transition-colors duration-300",
      embedded
        ? "flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden bg-[var(--cc-background)]"
        : "min-h-screen",
      !embedded && nativeEmbedded
        ? "bg-[#0b1120]"
        : !embedded && isDark
          ? "bg-[#0c0f16]"
          : !embedded
            ? "bg-slate-100 dark:bg-slate-900"
            : undefined,
    )}>
      {/* Header - hidden when embedded in dashboard-v2 */}
      {!embedded && (
      <header className="bg-gradient-to-r from-slate-800/95 to-slate-700/95 backdrop-blur-xl border-b border-slate-600/30 sticky top-0 z-10 shadow-2xl">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <Link href={homeHref} className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity group shrink-0">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg sm:rounded-xl group-hover:from-blue-500/30 group-hover:to-cyan-500/30 transition-all duration-300 shrink-0">
                <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
              </div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                CourseCollab
              </h1>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 shrink-0">
              <NotificationBell />
              <StudentProfileDropdown />
            </div>
          </div>
        </div>
      </header>
      )}

      {/* Main Content */}
      <div className={cn(
        "mx-auto w-full max-w-full min-w-0",
        embedded && "flex flex-col flex-1 min-h-0",
        nativeEmbedded
          ? "p-0"
          : embedded
            ? "p-0"
            : "container px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8"
      )}>
        {/* CodeBench Title - compact when embedded */}
        {!embedded && (
        <div className="mb-4 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl">
                <Code className="h-6 w-6 sm:h-8 sm:w-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  CodeBench
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 sm:mt-2">AI-Guided Coding Workspace</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <Link href={homeHref} className="flex-1 sm:flex-none">
                <button className="w-full sm:w-auto px-3 sm:px-4 py-2 text-xs sm:text-sm md:text-base border border-gray-500/60 dark:border-gray-600/60 text-gray-200 dark:text-gray-300 hover:bg-gray-600/40 dark:hover:bg-gray-700/40 hover:border-gray-400 dark:hover:border-gray-500 hover:text-white dark:hover:text-white transition-all duration-300 bg-gray-800/40 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg flex items-center justify-center gap-1.5 sm:gap-2">
                  <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span className="hidden sm:inline">Back to Dashboard</span>
                  <span className="sm:hidden">Back</span>
                </button>
              </Link>
            </div>
          </div>
        </div>
        )}

        {/* IDE Interface */}
        <div
          data-codebench-native-shell={nativeEmbedded ? "" : undefined}
          className={cn(
            "overflow-hidden transition-colors duration-300 min-w-0",
            embedded && "flex flex-col flex-1 min-h-0",
            nativeEmbedded || embedded
              ? "rounded-none border-0 bg-transparent shadow-none"
              : cn(
                  "rounded-2xl shadow-2xl shadow-purple-950/10",
                  isDark
                    ? "bg-[#0c0f16] border border-[#582c83]/20"
                    : "bg-white border border-slate-200/80",
                ),
          )}
        >
          <StudentLiveClassroomBanner
            compact
            sessions={liveSessions}
            activeAssignmentId={liveSharing ? classroomSubmissionId : null}
            onJoin={(session) => {
              bindLiveAssignment(session)
              window.dispatchEvent(
                new CustomEvent("codebench-join-live-session", {
                  detail: { assignmentId: String(session.assignmentId) },
                }),
              )
            }}
            onLeave={leaveLiveAssignment}
          />
          <Toolbar
            embedded={embedded}
            theme={panelTheme}
            languageId={languageId}
            detectedLanguageLabel={detectedLabel}
            onLanguageChange={handleLanguageChange}
            onExplain={handleExplain}
            onDebug={handleDebug}
            onImprove={handleImprove}
            onPseudocode={handlePseudocode}
            onTutor={handleTutor}
            onPractice={handlePractice}
            onWalkWithCora={handleWalkWithCora}
            activeTool={aiTab}
            onEvaluate={handleEvaluate}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            moreMenu={
              <div className="flex items-center gap-1">
                {toolbarEnd}
                <MoreMenu code={code} studentId={studentId} embedded={embedded} compact theme={panelTheme} />
              </div>
            }
            onLocalRun={
              currentLanguage.id === "cpp"
                ? () => {
                    void executionRef.current?.run(code)
                  }
                : undefined
            }
            onLocalStop={
              currentLanguage.id === "cpp"
                ? () => {
                    void executionRef.current?.stop()
                  }
                : undefined
            }
            localRunState={executionMeta?.runState}
            localRunEnabled={currentLanguage.id === "cpp"}
            explorerOpen={ide.explorerOpen}
            onToggleExplorer={() => ide.setExplorerOpen((open) => !open)}
            onSave={handleSaveWorkspace}
            canSave={ide.dirty || Boolean(ide.activeFile?.untitled)}
            projectName={ide.project.name}
            classroomSubmissions={classroomSubmissions}
            classroomSubmissionId={classroomSubmissionId}
            onAssignmentChange={(submissionId) => {
              selectClassroomAssignment(submissionId, Boolean(submissionId))
            }}
            onClassroomSubmit={handleClassroomCodeSubmit}
            classroomSubmitLoading={isLoading.submit}
            questionOpen={questionDrawerOpen}
            onToggleQuestion={
              liveSharing && classroomQuestion
                ? () => setQuestionDrawerOpen((open) => !open)
                : undefined
            }
            liveClassroomTitle={activeLiveSession?.title ?? null}
          />

          <div
            className={cn(
              "flex min-h-0 min-w-0 w-full flex-1",
              embedded ? "min-h-0" : "min-h-[280px] h-[clamp(320px,62dvh,720px)] lg:h-[min(720px,calc(100dvh-12rem))]",
            )}
          >
          {ide.explorerOpen ? (
            <CodebenchExplorer
              project={ide.project}
              projects={ide.projects}
              activeFileId={ide.activeFile?.id ?? null}
              onSwitchProject={ide.switchProject}
              onCreateProject={ide.createProject}
              onRenameProject={ide.renameProject}
              onOpenFile={ide.openFile}
              onCreateFile={(parentId, name) => ide.createFile({ parentId, name })}
              onCreateFolder={ide.createFolder}
              onRenameNode={ide.renameNode}
              onDeleteNode={ide.deleteNode}
              localRoot={ide.canUseLocalFiles ? ide.localRoot : null}
              onRevealLocalFolder={ide.canUseLocalFiles ? () => void ide.revealLocalFolder() : undefined}
              onChooseLocalFolder={ide.canUseLocalFiles ? () => void ide.chooseLocalFolder() : undefined}
            />
          ) : null}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <CodebenchEditorCoraSplit
            embedded={embedded}
            onPanelResize={layoutMonacoEditor}
            editor={
              <>
              <CodebenchEditorChrome
                lineCount={lineCount}
                language={currentLanguage.label}
                fileName={ide.activeFile?.name ?? currentLanguage.fileName}
                learningMode={learningMode}
                compact={Boolean(embedded || nativeEmbedded)}
                theme={panelTheme}
                dirty={ide.dirty}
                naming={ide.naming}
                activeFileId={ide.activeFile?.id}
                openFiles={ide.project.openFileIds
                  .map((id) => ide.project.nodes.find((node) => node.id === id && node.kind === "file"))
                  .filter((node): node is NonNullable<typeof node> => Boolean(node))
                  .map((node) => ({ id: node.id, name: node.name, dirty: isFileDirty(node) }))}
                onSelectFile={ide.openFile}
                onCloseFile={ide.closeFile}
              />
              <div className="flex min-h-0 flex-1 flex-col bg-[var(--card)]">
                <MonacoEditor
                  key={`${ide.activeFile?.id ?? "file"}-${editorKey}`}
                  height="100%"
                  language={currentLanguage.monacoLanguage}
                  defaultValue={code}
                  onChange={(value) => {
                    const next = monacoCodeFromChange(value)
                    if (next == null) return
                    liveEditorOriginRef.current = "editor"
                    setCode(next)
                  }}
                  theme={editorTheme}
                  beforeMount={(monaco) => {
                    registerCodebenchMonacoThemes(monaco)
                  }}
                  onMount={(editor, monaco) => {
                    setEditorRef(editor)
                    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                      handleSaveWorkspace()
                    })
                  }}
                  options={codebenchEditorOptions()}
                />
              </div>
              </>
            }
            cora={
              <>
              <CodebenchCoraBar
                activeTool={aiTab}
                onToolSelect={handleCoraToolSelect}
                toolLoading={
                  isLoading.explain ||
                  isLoading.debug ||
                  isLoading.improve ||
                  isLoading.pseudocode ||
                  isLoading.evaluate
                }
                learningMode={learningMode}
                onLearningModeChange={(mode) => {
                  setLearningMode(mode)
                  if (typeof window !== "undefined") {
                    localStorage.setItem("codebench_learning_mode", mode)
                  }
                }}
                classroomSubmissions={classroomSubmissions}
                classroomSubmissionId={classroomSubmissionId}
                onAssignmentChange={(submissionId) => {
                  selectClassroomAssignment(submissionId, Boolean(submissionId))
                }}
                theme={panelTheme}
                onClear={handleCoraClear}
              />
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {aiTab === "practice" ? (
                <PracticeGenerator 
                  code={code} 
                  studentId={studentId} 
                  language={currentLanguage.apiLanguage}
                  cachedProblem={practiceProblemCache}
                  onProblemGenerated={handlePracticeProblemGenerated}
                  getCacheKey={getCacheKey}
                  getCachedChat={getCachedChat}
                  setCachedChat={setCachedChat}
                  learningMode={learningMode}
                  coraAccess={coraGate.coraAccess}
                  onLockedCora={() => showCoraUpgrade("Practice with Cora")}
                />
              ) : aiTab === "evaluate" ? (
                <div className="flex flex-col h-full">
                  <AIChatInterface
                      code={code}
                      studentId={studentId}
                      language={currentLanguage.apiLanguage}
                      mode="evaluate"
                      isEvaluation={true}
                      classroomSubmissionId={classroomSubmissionId || null}
                      shouldStartEvaluation={
                        assignmentSelectionConfirmed && aiTab === "evaluate" && coraGate.coraAccess
                      }
                      coraAccess={coraGate.coraAccess}
                      onLockedCora={() => showCoraUpgrade("Evaluate with Cora")}
                      key={`evaluate-${assignmentSelectionConfirmed}-${classroomSubmissionId}`} // Force re-render when assignment changes
                      cachedMessages={getCachedChat("evaluate", code) || undefined}
                      theme={panelTheme}
                      hideHeader
                      onMessagesChange={(messages) => {
                        const cacheKey = getCacheKey("evaluate", code)
                        const existingMessages = chatCache.get(cacheKey)
                        const existingStr = JSON.stringify(existingMessages)
                        const newStr = JSON.stringify(messages)
                        if (existingStr !== newStr) {
                          setCachedChat("evaluate", code, messages)
                        }
                      }}
                      onComplete={async (score, feedback) => {
                        if (score !== undefined) {
                          // Score display will handle submission via its submit button
                          // After successful submission, show success modal
                          console.log("[CodeBenchPage] ✅ Evaluation completed", { score, feedback })
                        }
                      }}
                    />
                </div>
              ) : (
                <AIResponsePanel
                  explanation={explanation}
                  debugResult={debugResult || undefined}
                  improvedCode={improvedCode || undefined}
                  pseudocode={pseudocode || undefined}
                  activeTab={aiTab}
                  onTabChange={handleTabChange}
                  code={code}
                  studentId={studentId}
                  language={currentLanguage.apiLanguage}
                  learningMode={learningMode}
                  theme={panelTheme}
                  cachedChats={chatCache}
                  getCacheKey={getCacheKey}
                  onChatUpdate={(mode, messages) => {
                    // Only update cache if messages actually changed to prevent infinite loops
                    const cacheKey = getCacheKey(mode, code)
                    const existingMessages = chatCache.get(cacheKey)
                    const existingStr = JSON.stringify(existingMessages)
                    const newStr = JSON.stringify(messages)
                    if (existingStr !== newStr) {
                      setCachedChat(mode, code, messages)
                    }
                  }}
                  replaySteps={replaySteps}
                  isExplainLoading={isLoading.explain}
                  isDebugLoading={isLoading.debug}
                  isImproveLoading={isLoading.improve}
                  isPseudocodeLoading={isLoading.pseudocode}
                  debugThinkingMode={debugThinkingMode}
                  replayProgressKey={hashCode(code)}
                  suspiciousLines={suspiciousLines}
                  styleIssues={styleIssues}
                  onHighlightLine={(lineNumber) => {
                    if (editorRef) {
                      highlightLine(editorRef, lineNumber).catch(console.error)
                    }
                  }}
                  onClearHighlight={() => {
                    if (editorRef) {
                      clearHighlights(editorRef).catch(console.error)
                    }
                  }}
                  onHighlightLineWithError={(lineNumber, highlight) => {
                    if (editorRef) {
                      if (highlight) {
                        highlightLine(editorRef, lineNumber, "error-line").catch(console.error)
                      } else {
                        clearHighlights(editorRef).catch(console.error)
                      }
                    }
                  }}
                  onMarkResolved={(lineNumber) => {
                    setSuspiciousLines((prev) => prev.filter((line) => line.lineNumber !== lineNumber))
                  }}
                  onSimulateWhatIf={async (question: string) => {
                    try {
                      const response = await fetch("/api/codebench/what-if", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ code, language: currentLanguage.apiLanguage, studentId, question, learningMode }),
                      })
                      const data = await parseCodebenchCoraJson<{ scenarios?: unknown[] }>(
                        response,
                        "Failed to simulate scenario",
                      )
                      return data.scenarios || []
                    } catch (error) {
                      console.error("What-if simulation error:", error)
                      toastUnlessCoraUpgrade(error, "What-if with Cora", "Failed to simulate scenario")
                      return []
                    }
                  }}
                  onWalkWithCora={handleWalkWithCora}
                  onTrySampleWalkthrough={handleTrySampleWalkthrough}
                  coraAccess={coraGate.coraAccess}
                  onLockedCora={showCoraUpgrade}
                />
              )}
              </div>
              </>
            }
          />
          {currentLanguage.id === "cpp" ? (
            <CodeBenchExecutionDock
              ref={executionRef}
              theme={panelTheme}
              canExecute
              unsupportedMessage="Local run currently supports C++. Switch the language to C++ to compile and run here. C and Python runtimes are next."
              onMetaChange={handleExecutionMeta}
              onRunResult={handleRunResult}
              onSuggestFix={handleSuggestFix}
            />
          ) : null}
          </div>
          </div>
        </div>
      </div>

      {/* Evaluation Dialog - Only render if we have questions and dialog is open */}
      {showEvaluationDialog && safeEvaluationQuestions.length > 0 && (
        <EvaluationDialog
          open={showEvaluationDialog}
          onClose={() => {
            setShowEvaluationDialog(false)
            setEvaluationQuestions([])
          }}
          onSubmit={handleEvaluationSubmit}
          questions={safeEvaluationQuestions}
          isLoading={isLoading.submit || isGeneratingQuestions}
        />
      )}

      {/* Success Modal - Shows 2x multiplier animation for Trailblazer when submitting an assignment */}
      <Codebench2xMultiplierModal
        open={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        data={submissionSuccessData}
      />

      <CodebenchCoraUpgradeModal
        open={coraGate.upgradeOpen}
        onClose={coraGate.closeUpgrade}
        actionLabel={coraGate.actionLabel}
      />

      <StudentClassroomQuestionDrawer
        open={questionDrawerOpen}
        onClose={() => setQuestionDrawerOpen(false)}
        assignment={classroomQuestion}
      />

    </div>
  )
}
