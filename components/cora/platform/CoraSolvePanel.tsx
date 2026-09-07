"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowRight,
  BookOpen,
  Brain,
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileUp,
  Flame,
  FolderOpen,
  Lightbulb,
  Loader2,
  Sparkles,
  Target,
  Trophy,
  Upload,
  Zap,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { CORA_MOTTO, CORA_NAME } from "@/lib/cora/constants"
import { coraContextFromQuestion } from "@/lib/cora/question-context"
import type { CoraMode, CoraSession } from "@/lib/cora/step-engine/types"
import type { CoraDomain, CoraProblemContext } from "@/lib/cora/types"
import { useStepEngine } from "@/components/cora/use-step-engine"
import { CoraTimeline } from "@/components/cora/CoraTimeline"
import { CoraCanvas } from "@/components/cora/CoraCanvas"
import { CoraHintMenu } from "@/components/cora/CoraHintMenu"
import { CoraSummary } from "@/components/cora/CoraSummary"
import { CoraQuestionImportDialog } from "@/components/cora/CoraQuestionImportDialog"
import { useCoraContentPalette } from "@/hooks/use-cora-content-palette"
import {
  analyzeSolveProblem,
  CORA_SOLVE_LEARNING_MODES,
  learningModeToCoraMode,
  loadSolveLearningMode,
  saveSolveLearningMode,
  sourceLabelFor,
  VISUALIZATION_LABEL,
  type CoraSolveAnalysis,
  type CoraSolveAssessmentState,
  type CoraSolveLearningMode,
} from "@/lib/cora/solve-workspace"
import {
  consumeSolveHandoff,
  handoffToProblemContext,
  type CoraSolveHandoff,
} from "@/lib/cora/solve-handoff"
import type { CoraImportableItem } from "@/lib/cora/question-import-types"

type Props = {
  studentDatabaseId?: number | null
  studentId?: string
  initialDomain?: CoraDomain
  /** Bump to re-consume session handoff (Ask Cora). */
  handoffNonce?: number
  courseLabel?: string | null
}

type Stage = "compose" | "session" | "complete"

type ReflectionTag =
  | "formula"
  | "concept"
  | "algebra"
  | "careless"
  | "didnt_understand"

const DOMAIN_ACCENT: Record<CoraDomain, string> = {
  circuit: "from-emerald-500 to-teal-400",
  coding: "from-violet-500 to-indigo-500",
  math: "from-sky-500 to-cyan-400",
  generic: "from-[var(--cc-accent)] to-[var(--cc-accent-hover)]",
}

const REFLECTION_OPTIONS: Array<{ id: ReflectionTag; label: string }> = [
  { id: "formula", label: "Formula" },
  { id: "concept", label: "Concept" },
  { id: "algebra", label: "Algebra" },
  { id: "careless", label: "Careless mistake" },
  { id: "didnt_understand", label: "Didn't understand" },
]

type Provenance = {
  source: CoraProblemContext["source"] | "custom"
  sourceLabel: string
  courseLabel?: string
  assessmentState: CoraSolveAssessmentState
  allowWorkedSolution: boolean
  title?: string
}

export function CoraSolvePanel({
  studentDatabaseId,
  studentId,
  initialDomain = "generic",
  handoffNonce = 0,
  courseLabel,
}: Props) {
  const { cta, soft, mid, accent } = useCoraContentPalette()
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>("compose")
  const [problemText, setProblemText] = useState("")
  const [provenance, setProvenance] = useState<Provenance>({
    source: "custom",
    sourceLabel: "Your upload",
    assessmentState: "none",
    allowWorkedSolution: true,
  })
  const [learningMode, setLearningMode] = useState<CoraSolveLearningMode>("walkthrough")
  const [dragOver, setDragOver] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<CoraSession | null>(null)
  const [mode, setMode] = useState<CoraMode>("guided")
  const [reflectionTags, setReflectionTags] = useState<ReflectionTag[]>([])
  const [importedProblem, setImportedProblem] = useState<CoraProblemContext | null>(null)
  const [masteryBump] = useState(9)
  const [studentAnswerDraft, setStudentAnswerDraft] = useState("")
  const engine = useStepEngine(session)

  useEffect(() => {
    setLearningMode(loadSolveLearningMode(studentDatabaseId))
  }, [studentDatabaseId])

  const applyHandoff = useCallback((handoff: CoraSolveHandoff) => {
    setProblemText(handoff.questionText)
    setImportedProblem(handoffToProblemContext(handoff, studentDatabaseId))
    setProvenance({
      source: handoff.sourceModule,
      sourceLabel: handoff.sourceLabel ?? sourceLabelFor(handoff.sourceModule),
      courseLabel: handoff.courseLabel ?? handoff.courseCode ?? courseLabel ?? undefined,
      assessmentState: handoff.assessmentState ?? "practice",
      allowWorkedSolution: handoff.allowWorkedSolution !== false && handoff.assessmentState !== "active",
      title: handoff.title,
    })
    if (handoff.preferredMode) setLearningMode(handoff.preferredMode)
    setAttachments([])
    setStage("compose")
    setSession(null)
    setError(null)
  }, [courseLabel, studentDatabaseId])

  useEffect(() => {
    const handoff = consumeSolveHandoff()
    if (handoff) applyHandoff(handoff)
  }, [handoffNonce, applyHandoff])

  const analysis = useMemo(
    () =>
      analyzeSolveProblem(problemText, {
        source: provenance.source,
        assessmentState: provenance.assessmentState,
        courseLabel: provenance.courseLabel ?? courseLabel,
        sourceLabel: provenance.sourceLabel,
      }),
    [problemText, provenance, courseLabel],
  )

  const allowWorked =
    (analysis?.integrity.allowWorkedSolution ?? provenance.allowWorkedSolution) !== false

  useEffect(() => {
    if (!allowWorked && learningMode === "worked_solution") {
      setLearningMode("walkthrough")
      saveSolveLearningMode("walkthrough", studentDatabaseId)
    }
  }, [allowWorked, learningMode, studentDatabaseId])

  const domainAccent = DOMAIN_ACCENT[session?.domain ?? analysis?.domain ?? initialDomain]
  const hasProblem = Boolean(problemText.trim() || attachments.length > 0)

  const onLearningMode = (next: CoraSolveLearningMode) => {
    if (next === "worked_solution" && !allowWorked) return
    setLearningMode(next)
    saveSolveLearningMode(next, studentDatabaseId)
  }

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || f.type === "application/pdf",
    )
    if (!list.length) return
    setAttachments((prev) => [...prev, ...list].slice(0, 4))
    setProvenance((p) =>
      p.source === "custom"
        ? p
        : {
            source: "custom",
            sourceLabel: "Your upload",
            assessmentState: "none",
            allowWorkedSolution: true,
          },
    )
    setImportedProblem(null)
  }, [])

  const onCourseImport = (problem: CoraProblemContext, item: CoraImportableItem) => {
    setProblemText(problem.questionText)
    setImportedProblem(problem)
    setAttachments([])
    setProvenance({
      source: problem.source,
      sourceLabel: item.group || sourceLabelFor(problem.source),
      courseLabel: problem.courseCode ?? courseLabel ?? undefined,
      assessmentState: "review",
      allowWorkedSolution: true,
      title: problem.title ?? item.label,
    })
    setPickerOpen(false)
  }

  const startSession = async () => {
    const text = problemText.trim()
    if (!text && attachments.length === 0) return
    let selectedMode = learningMode
    if (selectedMode === "worked_solution" && !allowWorked) selectedMode = "walkthrough"
    const coraMode = learningModeToCoraMode(selectedMode)
    setMode(coraMode)
    setLoading(true)
    setError(null)
    setSession(null)
    engine.reset()
    try {
      const domain = analysis?.domain ?? importedProblem?.domain ?? initialDomain
      const ctx =
        importedProblem ??
        coraContextFromQuestion({
          source: "custom",
          domain,
          title: analysis?.topic ?? provenance.title ?? "Custom problem",
          questionText:
            text ||
            `[Uploaded ${attachments.map((f) => f.name).join(", ")}] Please solve from the attached file(s).`,
          questionType:
            domain === "circuit"
              ? "circuit_worked_solution"
              : domain === "coding"
                ? "code_problem"
                : undefined,
          studentDatabaseId: studentDatabaseId ?? null,
          courseCode: provenance.courseLabel,
          topic: analysis?.topic,
        })
      const res = await fetch("/api/cora/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...ctx,
          mode: coraMode,
          studentAnswer: learningMode === "check_work" ? studentAnswerDraft || undefined : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not start Cora")
      setSession(data.session as CoraSession)
      setStage("session")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Cora")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (engine.finished && stage === "session") setStage("complete")
  }, [engine.finished, stage])

  const resetWorkspace = () => {
    setStage("compose")
    setSession(null)
    setError(null)
    setReflectionTags([])
    setStudentAnswerDraft("")
    engine.reset()
  }

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage: `radial-gradient(ellipse at 0% 0%, ${soft}40, transparent 55%), radial-gradient(ellipse at 100% 0%, ${mid}28, transparent 50%), radial-gradient(ellipse at 50% 100%, ${accent}16, transparent 45%)`,
          }}
        />
        <div className="relative flex flex-wrap items-start gap-4">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg"
            style={{ backgroundColor: cta.fill, color: cta.icon }}
          >
            <Brain className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cc-text-muted)]">
              {stage === "session" ? "Interactive Step Engine" : "Solve"}
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--cc-text)] sm:text-3xl">
              {stage === "session"
                ? "Learn every step, not just the answer"
                : "Give Cora any problem. Choose how you want to learn."}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--cc-text-secondary)]">
              {stage === "compose"
                ? `${CORA_NAME} turns the solution into an interactive lesson.`
                : CORA_MOTTO}
            </p>
          </div>
          {stage !== "compose" ? (
            <Button type="button" variant="outline" className="rounded-full" onClick={resetWorkspace}>
              New problem
            </Button>
          ) : null}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {stage === "compose" ? (
          <motion.div
            key="compose"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12, transition: { duration: 0.2 } }}
            className="space-y-5"
          >
            <ComposeInput
              problemText={problemText}
              setProblemText={(v) => {
                setProblemText(v)
                if (importedProblem) setImportedProblem(null)
              }}
              dragOver={dragOver}
              setDragOver={setDragOver}
              attachments={attachments}
              setAttachments={setAttachments}
              addFiles={addFiles}
              fileRef={fileRef}
              cameraRef={cameraRef}
              onChooseCourse={() => setPickerOpen(true)}
              provenance={analysis ? provenance : null}
              analysis={analysis}
            />

            <AnimatePresence>
              {analysis ? (
                <motion.div
                  key="analysis"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <AnalysisCard analysis={analysis} accentFill={cta.fill} />
                </motion.div>
              ) : null}
            </AnimatePresence>

            <LearningModePicker
              value={learningMode}
              onChange={onLearningMode}
              allowWorkedSolution={allowWorked}
              workedLockReason={analysis?.integrity.reason}
            />

            {learningMode === "check_work" ? (
              <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-[var(--cc-text)]">Your work</h3>
                <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
                  Paste your approach or final answer — {CORA_NAME} will verify it step by step.
                </p>
                <Textarea
                  value={studentAnswerDraft}
                  onChange={(e) => setStudentAnswerDraft(e.target.value)}
                  placeholder="Your solution or key steps…"
                  className="mt-3 min-h-[100px] rounded-2xl border-[var(--border)] bg-[var(--cc-surface)] text-sm"
                />
              </section>
            ) : null}

            <div className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <p className="text-sm font-semibold text-[var(--cc-text)]">
                  {analysis ? "Ready when you are" : `Add a problem to begin with ${CORA_NAME}`}
                </p>
                <p className="text-xs text-[var(--cc-text-muted)]">
                  {analysis
                    ? `${VISUALIZATION_LABEL[analysis.visualization]} · ~${analysis.estimatedMinutes} min`
                    : "Paste, upload, photograph, or pick a course problem."}
                </p>
              </div>
              <Button
                type="button"
                size="lg"
                disabled={loading || !hasProblem}
                className="rounded-2xl px-6 shadow-md"
                style={{ backgroundColor: cta.fill, color: cta.icon }}
                onClick={() => void startSession()}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Start with Cora
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          </motion.div>
        ) : null}

        {stage === "session" && session && engine.current ? (
          <motion.div
            key="session"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                  Step {engine.stepIndex + 1} of {session.steps.length}
                </p>
                <p className="truncate text-sm font-semibold text-[var(--cc-text)]">
                  {engine.current.title || session.problem.title || analysis?.topic || "Solving"}
                </p>
                {analysis ? (
                  <p className="mt-0.5 text-[11px] text-[var(--cc-text-muted)]">
                    {[analysis.courseLabel, analysis.topic, analysis.difficulty]
                      .filter(Boolean)
                      .join(" · ")}
                    {analysis.sourceLabel ? ` · From: ${analysis.sourceLabel}` : null}
                    {" · "}
                    {VISUALIZATION_LABEL[analysis.visualization]}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <CoraHintMenu
                  step={engine.current}
                  onHint={(level, text) => engine.useHint(level, text)}
                />
                <Button
                  type="button"
                  size="sm"
                  className={cn("rounded-full bg-gradient-to-r text-white", domainAccent)}
                  disabled={!engine.canAdvance}
                  onClick={engine.next}
                >
                  {engine.stepIndex >= session.steps.length - 1 ? "Finish" : "Next step"}
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="grid min-h-[520px] lg:grid-cols-[220px_minmax(0,1fr)_240px]">
              <CoraTimeline
                steps={session.steps}
                stepIndex={engine.stepIndex}
                completedIds={engine.completedIds}
                accent={domainAccent}
                onSelect={engine.goTo}
              />
              <CoraCanvas
                session={session}
                step={engine.current}
                mode={mode}
                accent={domainAccent}
                activeHint={engine.activeHint}
                reflection={engine.reflections[engine.current.id] ?? ""}
                onReflectionChange={(v) =>
                  engine.setReflections((r) => ({ ...r, [engine.current!.id]: v }))
                }
                confidence={engine.confidence}
                onConfidenceChange={engine.setConfidence}
                checkpointResults={engine.checkpointResults}
                onCheckpoint={engine.submitCheckpoint}
              />
              <SolveSideRail analysis={analysis} session={session} />
            </div>
          </motion.div>
        ) : null}

        {stage === "complete" && session ? (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            <CoraSummary session={session} onRestart={resetWorkspace} onClose={resetWorkspace} />
            <ReflectionCard
              selected={reflectionTags}
              onToggle={(tag) =>
                setReflectionTags((prev) =>
                  prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
                )
              }
            />
            <MasteryCard
              topic={analysis?.topic ?? session.problem.title ?? "Topic"}
              bump={masteryBump}
              fill={cta.fill}
            />
            <RelatedLearning />
            <ContinueLearning onNew={resetWorkspace} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <CoraQuestionImportDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        studentId={studentId}
        onImport={onCourseImport}
      />
    </div>
  )
}

function ComposeInput({
  problemText,
  setProblemText,
  dragOver,
  setDragOver,
  attachments,
  setAttachments,
  addFiles,
  fileRef,
  cameraRef,
  onChooseCourse,
  provenance,
  analysis,
}: {
  problemText: string
  setProblemText: (v: string) => void
  dragOver: boolean
  setDragOver: (v: boolean) => void
  attachments: File[]
  setAttachments: Dispatch<SetStateAction<File[]>>
  addFiles: (files: FileList | File[]) => void
  fileRef: RefObject<HTMLInputElement | null>
  cameraRef: RefObject<HTMLInputElement | null>
  onChooseCourse: () => void
  provenance: Provenance | null
  analysis: CoraSolveAnalysis | null
}) {
  return (
    <section className="space-y-3 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--cc-text)]">Problem</h3>
        {analysis ? (
          <p className="text-xs text-[var(--cc-text-secondary)]">
            <span className="font-semibold text-[var(--cc-text)]">
              {[analysis.courseLabel, analysis.topic, analysis.difficulty].filter(Boolean).join(" · ")}
            </span>
            {analysis.sourceLabel ? (
              <span className="text-[var(--cc-text-muted)]"> · From: {analysis.sourceLabel}</span>
            ) : null}
          </p>
        ) : provenance?.sourceLabel && provenance.source !== "custom" ? (
          <p className="text-xs text-[var(--cc-text-muted)]">From: {provenance.sourceLabel}</p>
        ) : null}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
        }}
        className={cn(
          "rounded-2xl border border-dashed transition-colors",
          dragOver ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)]/40" : "border-transparent",
        )}
      >
        <Textarea
          value={problemText}
          onChange={(e) => setProblemText(e.target.value)}
          placeholder="Paste or type your problem — or choose one from your courses…"
          className="min-h-[160px] resize-y rounded-2xl border-[var(--border)] bg-[var(--cc-surface)] text-sm shadow-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl gap-2"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Upload image or PDF
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl gap-2"
          onClick={() => cameraRef.current?.click()}
        >
          <Camera className="h-4 w-4" />
          Take photo
        </Button>
        <Button type="button" variant="outline" className="rounded-xl gap-2" onClick={onChooseCourse}>
          <FolderOpen className="h-4 w-4" />
          Choose course problem
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          multiple
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files)
            e.target.value = ""
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files)
            e.target.value = ""
          }}
        />
      </div>

      {attachments.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {attachments.map((file) => (
            <li
              key={`${file.name}-${file.size}`}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-1 text-xs text-[var(--cc-text-secondary)]"
            >
              <FileUp className="h-3.5 w-3.5" />
              <span className="max-w-[160px] truncate">{file.name}</span>
              <button
                type="button"
                className="text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]"
                onClick={() => setAttachments((prev) => prev.filter((f) => f !== file))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function AnalysisCard({
  analysis,
  accentFill,
}: {
  analysis: CoraSolveAnalysis
  accentFill: string
}) {
  const need = analysis.prerequisites.filter((p) => p.met).slice(0, 4)
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4" style={{ color: accentFill }} />
        <h3 className="text-sm font-semibold text-[var(--cc-text)]">
          {CORA_NAME} understands this problem
        </h3>
      </div>
      <motion.div
        key={`${analysis.domain}-${analysis.topic}-${analysis.learningGoal}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <dl className="grid gap-3 sm:grid-cols-2">
          <Row label="Topic" value={analysis.topic} />
          <Row
            label="Concepts"
            value={analysis.concepts.join(" · ") || analysis.domainLabel}
          />
          <Row label="Difficulty" value={analysis.difficulty} />
          <Row
            label="You'll need"
            value={need.map((p) => p.label).join(" · ") || "Core foundations"}
          />
        </dl>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
            Goal
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--cc-text)]">{analysis.learningGoal}</p>
        </div>
        <p className="text-xs text-[var(--cc-text-muted)]">
          Visualization: {VISUALIZATION_LABEL[analysis.visualization]}
        </p>
      </motion.div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold text-[var(--cc-text)]">{value}</dd>
    </div>
  )
}

function LearningModePicker({
  value,
  onChange,
  allowWorkedSolution,
  workedLockReason,
}: {
  value: CoraSolveLearningMode
  onChange: (mode: CoraSolveLearningMode) => void
  allowWorkedSolution: boolean
  workedLockReason?: string
}) {
  const { soft, tone } = useCoraContentPalette()
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-[var(--cc-text)]">How should {CORA_NAME} help?</h3>
        <p className="text-xs text-[var(--cc-text-muted)]">Pick a learning mode, then start.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {CORA_SOLVE_LEARNING_MODES.map((mode, i) => {
          const locked = mode.id === "worked_solution" && !allowWorkedSolution
          const active = value === mode.id
          const swatch = tone(i)
          const Icon =
            mode.id === "walkthrough"
              ? Lightbulb
              : mode.id === "hint"
                ? Zap
                : mode.id === "check_work"
                  ? ClipboardCheck
                  : mode.id === "challenge"
                    ? Flame
                    : Target
          return (
            <button
              key={mode.id}
              type="button"
              disabled={locked}
              title={locked ? workedLockReason : undefined}
              onClick={() => onChange(mode.id)}
              className={cn(
                "rounded-2xl border p-4 text-left transition-all",
                locked && "cursor-not-allowed opacity-45",
                active && !locked ? "shadow-sm" : "border-[var(--border)] bg-[var(--card)] hover:opacity-95",
              )}
              style={
                active && !locked
                  ? { borderColor: swatch.fill, backgroundColor: soft, borderWidth: 1 }
                  : undefined
              }
            >
              <Icon className="mb-2 h-4 w-4" style={{ color: swatch.fill }} />
              <p className="text-sm font-semibold text-[var(--cc-text)]">{mode.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--cc-text-muted)]">{mode.description}</p>
              {mode.default ? (
                <span
                  className="mt-2 inline-block text-[10px] font-bold uppercase tracking-wide"
                  style={{ color: swatch.fill }}
                >
                  Default
                </span>
              ) : null}
              {locked ? (
                <span className="mt-2 inline-block text-[10px] font-bold uppercase tracking-wide text-[var(--cc-text-muted)]">
                  Locked for this assessment
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function SolveSideRail({
  analysis,
  session,
}: {
  analysis: CoraSolveAnalysis | null
  session: CoraSession
}) {
  const formulas = analysis?.formulas ?? []
  const known = analysis?.known ?? []
  const unknown = analysis?.unknown ?? []

  return (
    <aside className="hidden min-h-0 flex-col gap-4 overflow-y-auto border-l border-[var(--border)] bg-[var(--muted)]/15 p-4 lg:flex">
      {analysis ? (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--cc-text-muted)]">
            Visualization
          </p>
          <p className="rounded-xl bg-[var(--card)] px-2.5 py-2 text-xs font-medium text-[var(--cc-text)]">
            {VISUALIZATION_LABEL[analysis.visualization]}
          </p>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--cc-text-muted)]">
          Relevant formulas
        </p>
        <ul className="space-y-1.5">
          {(formulas.length ? formulas : [{ id: "plan", label: "Plan → Solve → Check", active: true }]).map(
            (f) => (
              <li
                key={f.id}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium",
                  f.active
                    ? "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                    : "text-[var(--cc-text-secondary)]",
                )}
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                {f.label}
              </li>
            ),
          )}
        </ul>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--cc-text-muted)]">
          Known
        </p>
        {known.length === 0 ? (
          <p className="text-xs text-[var(--cc-text-muted)]">Extracting as you go…</p>
        ) : (
          <ul className="space-y-1">
            {known.map((k) => (
              <li key={k.symbol} className="flex justify-between rounded-lg bg-[var(--card)] px-2.5 py-1.5 text-xs">
                <span className="font-semibold text-[var(--cc-text)]">{k.symbol}</span>
                <span className="text-[var(--cc-text-muted)]">{k.value}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--cc-text-muted)]">
          Unknown
        </p>
        {unknown.length === 0 ? (
          <p className="text-xs text-[var(--cc-text-muted)]">Will appear when asked</p>
        ) : (
          <ul className="space-y-1">
            {unknown.map((u) => (
              <li
                key={u.symbol}
                className="rounded-lg border border-dashed border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--cc-text)]"
              >
                {u.symbol}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--cc-text-muted)]">
          Sources used
        </p>
        <ul className="space-y-1.5 text-xs text-[var(--cc-text-secondary)]">
          {[
            ["Instructor Solution", session.dataSource === "reference"],
            ["Question Bank", session.dataSource === "reference"],
            ["Lecture Notes", true],
            ["Practice Problems", true],
            ["AI Reasoning", session.dataSource === "ai" || true],
          ].map(([label, on]) => (
            <li key={String(label)} className="flex items-center justify-between">
              <span>{label}</span>
              {on ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <span className="text-[var(--cc-text-muted)]">—</span>}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

function ReflectionCard({
  selected,
  onToggle,
}: {
  selected: ReflectionTag[]
  onToggle: (tag: ReflectionTag) => void
}) {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h3 className="text-sm font-semibold text-[var(--cc-text)]">Reflection</h3>
      <p className="mt-1 text-xs text-[var(--cc-text-muted)]">What was most difficult?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {REFLECTION_OPTIONS.map((opt) => {
          const active = selected.includes(opt.id)
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onToggle(opt.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "bg-[var(--cc-accent)] text-white"
                  : "bg-[var(--muted)]/60 text-[var(--cc-text-secondary)] hover:text-[var(--cc-text)]",
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function MasteryCard({ topic, bump, fill }: { topic: string; bump: number; fill: string }) {
  const score = Math.min(99, 63 + bump)
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
            Mastery update
          </p>
          <h3 className="text-lg font-bold text-[var(--cc-text)]">{topic}</h3>
        </div>
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold"
          style={{ backgroundColor: fill, color: "#fff" }}
        >
          <Trophy className="h-4 w-4" />
          {score}% · ↑ +{bump}%
        </div>
      </div>
      <Progress value={score} className="mt-4 h-2" />
      <p className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-[var(--cc-text-secondary)]">
        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
        Achievement unlocked: Problem Solver I
      </p>
    </section>
  )
}

function RelatedLearning() {
  const items = [
    { href: "/student/dashboard-v2/lectures", label: "Lecture", meta: "Week 5", icon: BookOpen },
    { href: "/student/dashboard-v2/flashcards", label: "Flashcards", meta: "12 cards", icon: Zap },
    { href: "/student/dashboard-v2/practice", label: "Practice Hub", meta: "8 problems", icon: Target },
    { href: "/student/dashboard-v2/homework", label: "Homework", meta: "Question 7", icon: ClipboardCheck },
  ]
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h3 className="text-sm font-semibold text-[var(--cc-text)]">Related learning</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <Link
            key={item.href + item.label}
            href={item.href}
            className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/25 px-3 py-3 transition-colors hover:border-[var(--cc-accent)]/40"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]">
              <item.icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-[var(--cc-text)]">{item.label}</span>
              <span className="text-xs text-[var(--cc-text-muted)]">{item.meta}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function ContinueLearning({ onNew }: { onNew: () => void }) {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h3 className="text-sm font-semibold text-[var(--cc-text)]">Continue learning</h3>
      <p className="mt-1 text-xs text-[var(--cc-text-muted)]">Practice a similar problem — no dead ends.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {["Easy", "Medium", "Hard", "Exam", "AI Generated"].map((label) => (
          <Button key={label} type="button" variant="outline" className="rounded-full" onClick={onNew}>
            {label}
          </Button>
        ))}
      </div>
    </section>
  )
}
