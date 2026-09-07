"use client"

import { useMemo, useCallback, useRef, useEffect, type MutableRefObject } from "react"
import { useDebouncedCallback } from "@/lib/use-debounced-callback"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { QuestionMediaDisplay } from "@/components/question-media-display"
import { CircuitSubmissionSolution } from "@/components/circuit-submission-solution"
import {
  buildCircuitSubmissionAnswerJson,
  listCircuitSubmissionFiles,
  parseCircuitSubmissionAnswer,
  parseCircuitSubmissionConfig,
  type CircuitSubmissionAnswer,
} from "@/lib/circuit-submission"
import {
  createEmptyWorkspace,
  mapInkColorToPaperTheme,
  workspaceHasContent,
  WORKSPACE_INK_COLORS,
  type CircuitSubmissionMode,
  type WorkspacePaperTheme,
} from "@/lib/circuit-workspace"
import { prefersNativeCameraCapture } from "@/lib/solution-camera"
import type { SolutionUploadsMap } from "@/lib/solution-upload"
import {
  createWorkspaceReplayRecorder,
  type WorkspaceReplayRecorder,
} from "@/lib/workspace-replay"
import {
  clearWorkspaceDraft,
  loadWorkspaceDraft,
  saveWorkspaceDraft,
  workspaceDraftStorageKey,
} from "@/lib/circuit-workspace-draft"

export function CircuitSubmissionFields({
  question,
  selectedAnswer,
  onAnswerChange,
  disabled,
  locked,
  attemptId,
  questionId,
  studentDatabaseId,
  onAntiCheatSuspendChange,
  answerSnapshotRef,
  prepareSubmitRef,
  uploadEndpoint,
  uploadExtraFields,
  requireStudentDatabaseId,
  hideQuestionHeader,
  workspaceOnly = false,
}: {
  question: {
    id: number
    question_text: string
    question_type?: string
    question_media?: unknown
    circuit_spec?: unknown
    solution_upload_config?: unknown
    hint?: string | null
  }
  selectedAnswer: string
  onAnswerChange: (json: string) => void
  disabled?: boolean
  locked?: boolean
  attemptId?: number | null
  questionId?: number | null
  studentDatabaseId?: number | null
  onAntiCheatSuspendChange?: (suspended: boolean) => void
  /** Latest answer JSON (bypasses debounced parent state) — used on submit from quiz-taker. */
  answerSnapshotRef?: MutableRefObject<(() => string) | null>
  /** Flush workspace + debounced answer before submit (iPad / fast tap). May await PNG export. */
  prepareSubmitRef?: MutableRefObject<(() => void | Promise<void>) | null>
  uploadEndpoint?: string
  uploadExtraFields?: Record<string, string>
  requireStudentDatabaseId?: boolean
  /** Hide title/media/text wrapper — caller renders question chrome. */
  hideQuestionHeader?: boolean
  /** In-lecture workspace: ink canvas only. */
  workspaceOnly?: boolean
}) {
  const config = useMemo(
    () => parseCircuitSubmissionConfig(question.solution_upload_config),
    [question.solution_upload_config],
  )

  const merged = useMemo(() => parseCircuitSubmissionAnswer(selectedAnswer || "{}"), [selectedAnswer])
  const mergedRef = useRef(merged)
  mergedRef.current = merged

  const replayRecorderRef = useRef<WorkspaceReplayRecorder>(
    createWorkspaceReplayRecorder(merged.workspace ?? undefined),
  )
  const workspaceFlushRef = useRef<(() => void) | null>(null)
  const workspaceExportRef = useRef<(() => Promise<boolean>) | null>(null)

  const debouncedAnswerChange = useDebouncedCallback((json: string) => {
    onAnswerChange(json)
  }, 350)

  const sync = useCallback(
    (patch: Partial<CircuitSubmissionAnswer>, flush = false, includeReplay = false) => {
      const base = mergedRef.current
      const next: CircuitSubmissionAnswer = {
        ...base,
        ...patch,
        solution_uploads: patch.solution_uploads ?? base.solution_uploads,
        workspace: patch.workspace !== undefined ? patch.workspace : base.workspace,
        submission_mode: patch.submission_mode ?? base.submission_mode,
      }
      mergedRef.current = next
      const json = buildCircuitSubmissionAnswerJson(next, {
        includeReplay,
        replay: includeReplay ? replayRecorderRef.current.getReplay() : null,
      })
      if (flush) {
        debouncedAnswerChange.flush()
        onAnswerChange(json)
      } else {
        debouncedAnswerChange(json)
      }
    },
    [onAnswerChange, debouncedAnswerChange],
  )

  useEffect(() => {
    return () => debouncedAnswerChange.flush()
  }, [debouncedAnswerChange])

  useEffect(() => {
    if (!answerSnapshotRef) return
    answerSnapshotRef.current = () =>
      buildCircuitSubmissionAnswerJson(mergedRef.current, {
        includeReplay: true,
        replay: replayRecorderRef.current.getReplay(),
      })
    return () => {
      answerSnapshotRef.current = null
    }
  }, [answerSnapshotRef])

  useEffect(() => {
    if (!prepareSubmitRef) return
    prepareSubmitRef.current = async () => {
      workspaceFlushRef.current?.()
      const snapshot = mergedRef.current
      if (
        snapshot.submission_mode === "workspace" &&
        workspaceHasContent(snapshot.workspace) &&
        !listCircuitSubmissionFiles(snapshot.solution_uploads ?? {}).some((file) =>
          file.name?.startsWith("workspace-page"),
        )
      ) {
        await workspaceExportRef.current?.()
      }
      debouncedAnswerChange.flush()
      onAnswerChange(
        buildCircuitSubmissionAnswerJson(mergedRef.current, {
          includeReplay: false,
          replay: null,
        }),
      )
    }
    return () => {
      prepareSubmitRef.current = null
    }
  }, [prepareSubmitRef, debouncedAnswerChange, onAnswerChange])

  const setUploads = (uploads: SolutionUploadsMap) => {
    sync(
      {
        solution_uploads: uploads,
        submission_status: Object.keys(uploads).length > 0 ? "draft" : merged.submission_status,
      },
      true,
    )
  }

  const setMode = (mode: CircuitSubmissionMode) => {
    const paperTheme: WorkspacePaperTheme =
      typeof document !== "undefined" && document.documentElement.classList.contains("dark")
        ? "dark"
        : "light"
    sync({
      submission_mode: mode,
      workspace:
        mode === "workspace" && !merged.workspace
          ? {
              ...createEmptyWorkspace(),
              color: mapInkColorToPaperTheme(WORKSPACE_INK_COLORS[0].value, paperTheme),
            }
          : merged.workspace,
    })
  }

  const setWorkspace = (
    workspace: ReturnType<typeof createEmptyWorkspace> | null,
    options?: { flush?: boolean },
  ) => {
    sync(
      {
        workspace,
        submission_status: "draft",
      },
      options?.flush ?? false,
    )
  }

  const title = config.title || question.hint?.trim() || null
  const defaultMode: CircuitSubmissionMode = workspaceOnly
    ? "workspace"
    : typeof window !== "undefined" && !prefersNativeCameraCapture()
      ? "photo"
      : "upload"
  const submissionMode = merged.submission_mode ?? defaultMode
  const workspace = merged.workspace ?? null
  const draftKey = workspaceDraftStorageKey({
    studentDatabaseId: studentDatabaseId ?? null,
    attemptId: attemptId ?? null,
    questionId: questionId ?? null,
  })

  useEffect(() => {
    if (!draftKey || locked || disabled) return
    const parsed = parseCircuitSubmissionAnswer(selectedAnswer)
    if (workspaceHasContent(parsed.workspace)) return
    const draft = loadWorkspaceDraft(draftKey)
    if (!draft) return
    sync(
      {
        workspace: draft,
        submission_mode: "workspace",
        submission_status: "draft",
      },
      true,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once per question mount
  }, [draftKey, questionId, locked, disabled])

  useEffect(() => {
    if (!draftKey || locked) return
    saveWorkspaceDraft(draftKey, workspace)
  }, [draftKey, workspace, locked])

  useEffect(() => {
    if (!draftKey || locked) return
    const parsed = parseCircuitSubmissionAnswer(selectedAnswer)
    if (
      parsed.submission_status === "submitted" ||
      parsed.submission_status === "graded"
    ) {
      clearWorkspaceDraft(draftKey)
    }
  }, [draftKey, selectedAnswer, locked])

  return (
    <div className="space-y-4">
      {!hideQuestionHeader && title ? (
        <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      ) : null}

      {!hideQuestionHeader ? (
        <>
          <QuestionMediaDisplay question={question} size="default" />

          <div className="rounded-xl border border-slate-200/80 dark:border-slate-600/80 bg-white dark:bg-slate-800/90 p-4 sm:p-5">
            <QuestionTextRenderer
              text={question.question_text}
              className="text-sm sm:text-base leading-relaxed text-slate-900 dark:text-slate-50"
            />
          </div>
        </>
      ) : null}

      <CircuitSubmissionSolution
        config={config}
        uploads={merged.solution_uploads ?? {}}
        onUploadsChange={setUploads}
        submissionMode={submissionMode}
        onSubmissionModeChange={setMode}
        workspace={workspace}
        onWorkspaceChange={setWorkspace}
        replayRecorderRef={replayRecorderRef}
        disabled={disabled}
        locked={locked}
        attemptId={attemptId}
        questionId={questionId ?? question.id}
        studentDatabaseId={studentDatabaseId}
        onAntiCheatSuspendChange={onAntiCheatSuspendChange}
        onRegisterWorkspaceFlush={(flush) => {
          workspaceFlushRef.current = flush
        }}
        onRegisterWorkspaceExport={(exporter) => {
          workspaceExportRef.current = exporter
        }}
        question={{
          question_text: question.question_text,
          question_media: question.question_media,
          circuit_spec: question.circuit_spec,
          title,
        }}
        uploadEndpoint={uploadEndpoint}
        uploadHeaders={undefined}
        requireStudentDatabaseId={requireStudentDatabaseId}
        uploadExtraFields={uploadExtraFields}
        workspaceOnly={workspaceOnly}
      />
    </div>
  )
}
