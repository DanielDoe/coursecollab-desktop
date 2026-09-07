"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { ModernLectureViewer } from "@/components/modern-lecture-viewer"
import type { LecturePdfViewerHandle } from "@/components/lecture-pdf-viewer"
import { LectureSlideAiAssistant } from "@/components/lecture-slide-ai-assistant"
import {
  LectureSamplePracticePanel,
  LectureSamplePracticeTrigger,
} from "@/components/lecture-sample-practice-panel"
import { LectureWorkspacePanel } from "@/components/lecture-workspace-panel"
import { condenseLectureViewerTitle } from "@/lib/lecture-workspace"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { Layers, ArrowLeft, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNativeApp } from "@/hooks/use-native-app"
import { CC_TABS } from "@/lib/appearance/ui-primitives"

const LecturePdfViewer = dynamic(
  () => import("@/components/lecture-pdf-viewer").then((m) => m.LecturePdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center py-16 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    ),
  },
)

function getLectureStudentIdString(): string | null {
  if (typeof window === "undefined") return null
  const session = getStudentData()
  const fromSession = session?.id?.trim()
  if (fromSession) return fromSession
  return sessionStorage.getItem("studentId")
}

type StudentLectureShellProps = {
  lecture: Record<string, unknown> & {
    id: number
    week?: number
    title?: string
    description?: string
    slides?: unknown[]
    pdf_url?: string | null
    pdfUrl?: string | null
    allow_download?: boolean
    allowDownload?: boolean
  }
  studentId?: number
  lecturesBasePath?: string
  isInstructor?: boolean
  useInstructorPdfProxy?: boolean
}

function LectureViewerNav({
  week,
  title,
  lecturesBasePath,
  headerAction,
  hideBackLink = false,
  facultyChrome = false,
}: {
  week?: number
  title?: string
  lecturesBasePath: string
  headerAction?: ReactNode
  hideBackLink?: boolean
  facultyChrome?: boolean
}) {
  const fullTitle = title?.trim() || "Lecture"
  // Let CSS truncate to the space beside the action icon — avoid pre-shortening (creates a dead gap).
  const displayTitle = hideBackLink ? fullTitle : condenseLectureViewerTitle(fullTitle)

  return (
    <header
      data-lecture-viewer-nav
      className={cn(
        "shrink-0 border-b backdrop-blur-md",
        facultyChrome
          ? "border-[var(--border)] bg-[var(--card)]/95"
          : "border-slate-200/80 bg-white/95 dark:border-white/[0.08] dark:bg-[#0B1120]/95",
      )}
    >
      <div className="px-3 py-2 sm:px-5 sm:py-2.5">
        <div
          className={cn(
            "grid min-h-9 items-center gap-x-1.5 sm:min-h-10 sm:gap-x-2",
            hideBackLink ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-[auto_minmax(0,1fr)_auto]",
          )}
        >
          {!hideBackLink ? (
            <Link
              href={lecturesBasePath}
              data-lecture-native-back
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-lg px-1 py-0.5 text-xs transition-colors sm:gap-1.5 sm:px-2 sm:text-sm",
                facultyChrome
                  ? "text-[var(--cc-text-muted)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--cc-text)]"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white",
              )}
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
              <span className="font-medium whitespace-nowrap">Back</span>
              {week != null ? (
                <span
                  className={cn(
                    "hidden whitespace-nowrap font-normal sm:inline",
                    facultyChrome ? "text-[var(--cc-text-muted)]" : "text-slate-400 dark:text-slate-500",
                  )}
                >
                  · Week {week}
                </span>
              ) : null}
            </Link>
          ) : null}

          <h1
            className={cn(
              "min-w-0 truncate text-left text-[11px] font-semibold leading-snug sm:text-sm",
              facultyChrome ? "text-[var(--cc-text)]" : "text-slate-900 dark:text-white",
            )}
            title={fullTitle}
          >
            {displayTitle}
          </h1>

          {headerAction ? <div className="justify-self-end overflow-visible">{headerAction}</div> : null}
        </div>
      </div>
    </header>
  )
}

export function StudentLectureShell({
  lecture,
  studentId,
  lecturesBasePath = "/student/dashboard-v2/lectures",
  isInstructor = false,
  useInstructorPdfProxy = false,
}: StudentLectureShellProps) {
  const isNativeApp = useNativeApp()
  const pdfUrl = (lecture.pdf_url ?? lecture.pdfUrl ?? null) as string | null
  const allowDownload = Boolean(lecture.allow_download ?? lecture.allowDownload)
  const slides = (lecture.slides ?? []) as unknown[]
  const hasPdf = Boolean(pdfUrl)
  const hasLegacy = slides.length > 0
  const week = typeof lecture.week === "number" ? lecture.week : undefined

  const studentIdString = isInstructor ? null : getLectureStudentIdString()
  const studentDatabaseId = isInstructor
    ? null
    : (() => {
        const session = getStudentData()
        const db = session?.databaseId
        if (db == null || String(db).trim() === "") return null
        const n = Number(db)
        return Number.isFinite(n) ? n : null
      })()
  const viewerCaptureRef = useRef<HTMLDivElement>(null)
  const pdfViewerRef = useRef<LecturePdfViewerHandle>(null)
  const [slideNumber, setSlideNumber] = useState(1)
  const [practiceOpen, setPracticeOpen] = useState(false)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [practiceMeta, setPracticeMeta] = useState<{
    enabled: boolean
    button_label: string
    count: number
    configured: boolean
  }>({ enabled: false, button_label: "Sample Practice", count: 0, configured: false })
  const [workspaceMeta, setWorkspaceMeta] = useState<{
    enabled: boolean
    button_label: string
    title: string
    count: number
  }>({ enabled: true, button_label: "Workspace", title: "In-Class Workspace", count: 0 })

  const resolveActiveSlideNumber = useCallback(() => {
    const fromPdf = pdfViewerRef.current?.getActivePage()
    if (fromPdf && fromPdf >= 1) return fromPdf
    return slideNumber
  }, [slideNumber])

  const aiAssistant =
    !isInstructor && studentIdString ? (
      <LectureSlideAiAssistant
        lectureId={lecture.id}
        lectureTitle={lecture.title}
        studentRosterId={studentIdString}
        captureTargetRef={viewerCaptureRef}
        slideNumber={slideNumber}
        onSlideNumberChange={setSlideNumber}
        resolveActiveSlideNumber={resolveActiveSlideNumber}
        onRequestViewerPage={(page) => pdfViewerRef.current?.scrollToPage(page)}
      />
    ) : null

  useEffect(() => {
    if (isInstructor || !studentIdString) return
    studentApiFetch(`/api/lectures/${lecture.id}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentIdString }),
    }).catch(() => {})
  }, [lecture.id, studentIdString, isInstructor])

  const refreshPracticeMeta = useCallback(() => {
    if (isInstructor) {
      instructorApiFetch(`/api/instructor/lectures/${lecture.id}/sample-practice`, {
        headers: buildInstructorApiHeaders(),
        cache: "no-store",
      })
        .then((r) => r.json())
        .then((data: { config?: { enabled?: boolean; button_label?: string; questions?: unknown[] } }) => {
          const count = Array.isArray(data.config?.questions) ? data.config!.questions!.length : 0
          setPracticeMeta({
            enabled: count > 0 && data.config?.enabled !== false,
            button_label: data.config?.button_label?.trim() || "Sample Practice",
            count,
            configured: count > 0,
          })
        })
        .catch(() =>
          setPracticeMeta({ enabled: false, button_label: "Sample Practice", count: 0, configured: false }),
        )
      return
    }

    if (!studentIdString) return
    fetch(
      `/api/student/lectures/${lecture.id}/sample-practice?studentId=${encodeURIComponent(studentIdString)}`,
      { cache: "no-store" },
    )
      .then((r) => r.json())
      .then((data: { enabled?: boolean; button_label?: string; questions?: unknown[] }) => {
        const count = Array.isArray(data.questions) ? data.questions.length : 0
        setPracticeMeta({
          enabled: count > 0 && data.enabled !== false,
          button_label: data.button_label?.trim() || "Sample Practice",
          count,
          configured: count > 0,
        })
      })
      .catch(() =>
        setPracticeMeta({ enabled: false, button_label: "Sample Practice", count: 0, configured: false }),
      )
  }, [lecture.id, studentIdString, isInstructor])

  const refreshWorkspaceMeta = useCallback(() => {
    if (isInstructor) {
      instructorApiFetch(`/api/instructor/lectures/${lecture.id}/workspace`, {
        headers: buildInstructorApiHeaders(),
        cache: "no-store",
      })
        .then((r) => r.json())
        .then((data: { config?: { enabled?: boolean; button_label?: string; title?: string; questions?: unknown[] } }) => {
          const count = Array.isArray(data.config?.questions) ? data.config!.questions!.length : 0
          setWorkspaceMeta({
            enabled: data.config?.enabled !== false,
            button_label: data.config?.button_label?.trim() || "Workspace",
            title: data.config?.title?.trim() || "In-Class Workspace",
            count,
          })
        })
        .catch(() =>
          setWorkspaceMeta({
            enabled: true,
            button_label: "Workspace",
            title: "In-Class Workspace",
            count: 0,
          }),
        )
      return
    }

    if (!studentIdString) return
    fetch(
      `/api/student/lectures/${lecture.id}/workspace?studentId=${encodeURIComponent(studentIdString)}`,
      { cache: "no-store" },
    )
      .then((r) => r.json())
      .then((data: { enabled?: boolean; button_label?: string; title?: string; questions?: unknown[] }) => {
        const count = Array.isArray(data.questions) ? data.questions.length : 0
        setWorkspaceMeta({
          enabled: data.enabled !== false,
          button_label: data.button_label?.trim() || "Workspace",
          title: data.title?.trim() || "In-Class Workspace",
          count,
        })
      })
      .catch(() =>
        setWorkspaceMeta({
          enabled: false,
          button_label: "Workspace",
          title: "In-Class Workspace",
          count: 0,
        }),
      )
  }, [lecture.id, studentIdString, isInstructor])

  useEffect(() => {
    refreshPracticeMeta()
    refreshWorkspaceMeta()
  }, [refreshPracticeMeta, refreshWorkspaceMeta])

  const practiceHeaderActions = isInstructor ? (
    practiceMeta.count > 0 || practiceMeta.configured ? (
      <LectureSamplePracticeTrigger
        label="Sample practice"
        questionCount={practiceMeta.count > 0 ? practiceMeta.count : undefined}
        onClick={() => setPracticeOpen(true)}
      />
    ) : null
  ) : studentIdString && practiceMeta.enabled ? (
    <LectureSamplePracticeTrigger
      label={practiceMeta.button_label}
      questionCount={practiceMeta.count}
      onClick={() => setPracticeOpen(true)}
    />
  ) : null

  const practicePanel =
    isInstructor ? (
      <LectureSamplePracticePanel
        lectureId={lecture.id}
        open={practiceOpen}
        onOpenChange={setPracticeOpen}
        buttonLabel={practiceMeta.button_label}
        mode="instructor"
        onConfigSaved={refreshPracticeMeta}
      />
    ) : !isInstructor && studentIdString && practiceMeta.enabled ? (
      <LectureSamplePracticePanel
        lectureId={lecture.id}
        studentRosterId={studentIdString}
        studentDatabaseId={studentDatabaseId}
        open={practiceOpen}
        onOpenChange={setPracticeOpen}
        buttonLabel={practiceMeta.button_label}
        mode="student"
      />
    ) : null

  const workspacePanel =
    isInstructor && workspaceMeta.enabled ? (
      <LectureWorkspacePanel
        lectureId={lecture.id}
        open={workspaceOpen}
        onOpenChange={setWorkspaceOpen}
        buttonLabel={workspaceMeta.button_label}
        workspaceTitle={workspaceMeta.title}
        mode="instructor"
        onConfigSaved={refreshWorkspaceMeta}
        lectureTitle={lecture.title}
      />
    ) : !isInstructor && studentIdString && workspaceMeta.enabled ? (
      <LectureWorkspacePanel
        lectureId={lecture.id}
        studentRosterId={studentIdString}
        studentDatabaseId={studentDatabaseId}
        open={workspaceOpen}
        onOpenChange={setWorkspaceOpen}
        buttonLabel={workspaceMeta.button_label}
        workspaceTitle={workspaceMeta.title}
        mode="student"
        lectureTitle={lecture.title}
      />
    ) : null

  const workspacePdfProps = {
    workspaceEnabled: workspaceMeta.enabled,
    workspaceLabel: workspaceMeta.button_label,
    workspaceQuestionCount: workspaceMeta.count > 0 ? workspaceMeta.count : undefined,
    onOpenWorkspace: () => setWorkspaceOpen(true),
  }

  if (!hasPdf && !hasLegacy) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <p
          className={cn(
            "text-lg font-medium",
            isInstructor ? "text-[var(--cc-text)]" : "text-slate-800 dark:text-slate-200",
          )}
        >
          This lecture does not have any materials yet.
        </p>
        <p
          className={cn(
            "text-sm",
            isInstructor ? "text-[var(--cc-text-muted)]" : "text-slate-500 dark:text-slate-400",
          )}
        >
          Check back later or contact your instructor.
        </p>
        <Link
          href={lecturesBasePath}
          data-native-hide
          className={cn(
            "mt-2 inline-flex items-center gap-2 text-sm font-medium",
            isInstructor
              ? "text-[var(--cc-accent-dark)] hover:text-[var(--cc-accent)]"
              : "text-primary hover:text-primary/80",
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to lectures
        </Link>
      </div>
    )
  }

  if (!hasPdf && hasLegacy) {
    return (
      <div className="relative flex h-0 min-h-0 flex-1 flex-col">
        <LectureViewerNav
          week={week}
          title={lecture.title}
          lecturesBasePath={lecturesBasePath}
          headerAction={practiceHeaderActions}
          hideBackLink={isNativeApp}
          facultyChrome={isInstructor}
        />
        <div ref={viewerCaptureRef} className="min-h-0 flex-1 overflow-auto">
          <ModernLectureViewer
            lecture={lecture as Parameters<typeof ModernLectureViewer>[0]["lecture"]}
            studentId={studentId}
            lecturesBasePath={lecturesBasePath}
            isInstructor={isInstructor}
            onActiveSlideChange={setSlideNumber}
          />
        </div>
        {aiAssistant}
        {practicePanel}
        {workspacePanel}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative flex h-0 min-h-0 flex-1 flex-col",
        isInstructor ? "bg-[var(--muted)]/40" : "bg-slate-100/80 dark:bg-[#070b14]",
      )}
    >
      <LectureViewerNav
        week={week}
        title={lecture.title}
        lecturesBasePath={lecturesBasePath}
        headerAction={practiceHeaderActions}
        hideBackLink={isNativeApp}
        facultyChrome={isInstructor}
      />

      <div className="flex h-0 min-h-0 flex-1 flex-col px-1 py-1.5 sm:p-4">
        {hasLegacy ? (
          <Tabs defaultValue="pdf" className="flex h-0 min-h-0 flex-1 flex-col">
            <TabsList
              className={cn(
                "mb-2 h-8 w-full shrink-0 gap-1 p-1 shadow-sm sm:mb-3 sm:h-9 sm:w-fit",
                isInstructor
                  ? cn(CC_TABS.list, "bg-[var(--sidebar-accent)]/50")
                  : "bg-white dark:bg-slate-900",
              )}
            >
              <TabsTrigger
                value="pdf"
                className={cn(
                  "flex-1 gap-1.5 px-2 text-xs sm:flex-none sm:px-3 sm:text-sm",
                  isInstructor && CC_TABS.trigger,
                )}
              >
                Slide deck
              </TabsTrigger>
              <TabsTrigger
                value="legacy"
                className={cn(
                  "flex-1 gap-1.5 px-2 text-xs sm:flex-none sm:px-3 sm:text-sm",
                  isInstructor && CC_TABS.trigger,
                )}
              >
                <Layers className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Interactive
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pdf" className="mt-0 flex h-0 min-h-0 flex-1 flex-col outline-none data-[state=inactive]:hidden">
              <LecturePdfViewer
                ref={pdfViewerRef}
                pdfUrl={pdfUrl as string}
                title={lecture.title}
                allowDownload={allowDownload}
                lectureId={lecture.id}
                studentIdString={studentIdString}
                useInstructorPdfProxy={useInstructorPdfProxy}
                facultyChrome={isInstructor}
                fillHeight
                viewerCaptureRef={viewerCaptureRef}
                onActivePageChange={setSlideNumber}
                {...workspacePdfProps}
              />
            </TabsContent>

            <TabsContent value="legacy" className="mt-0 min-h-0 flex-1 overflow-auto outline-none data-[state=inactive]:hidden">
              <p className="mb-3 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100/90">
                Optional HTML slides — the PDF deck above is your primary reading assignment.
              </p>
              <ModernLectureViewer
                lecture={lecture as Parameters<typeof ModernLectureViewer>[0]["lecture"]}
                studentId={studentId}
                lecturesBasePath={lecturesBasePath}
                isInstructor={isInstructor}
                onActiveSlideChange={setSlideNumber}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex h-0 min-h-0 flex-1 flex-col">
            <LecturePdfViewer
              ref={pdfViewerRef}
              pdfUrl={pdfUrl as string}
              title={lecture.title}
              allowDownload={allowDownload}
              lectureId={lecture.id}
              studentIdString={studentIdString}
              useInstructorPdfProxy={useInstructorPdfProxy}
              facultyChrome={isInstructor}
              fillHeight
              viewerCaptureRef={viewerCaptureRef}
              onActivePageChange={setSlideNumber}
              {...workspacePdfProps}
            />
          </div>
        )}
      </div>
      {aiAssistant}
      {practicePanel}
      {workspacePanel}
    </div>
  )
}
