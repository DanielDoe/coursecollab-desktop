"use client"

import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Code2,
  Play,
  Sparkles,
  Upload,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useCoraOptional } from "@/components/cora/CoraProvider"
import { useCoraContentPalette } from "@/hooks/use-cora-content-palette"
import { coraContextFromQuestion } from "@/lib/cora/question-context"
import type { CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"
import type { MembershipTier } from "@/lib/membership-constants"
import { studentTierHasCodeBenchAccess } from "@/lib/codebench-entitlement-client"
import {
  acceptedCodeUpload,
  analyzeCode,
  buildCodeActionPrompt,
  CORA_CODE_ACTIONS,
  CORA_CODE_LANGUAGES,
  CORA_CODE_TEMPLATES,
  deriveCodeContinue,
  saveCodeSessionDraft,
  type CoraCodeActionId,
  type CoraCodeAnalysis,
  type CoraCodeAnalysisTab,
  type CoraCodeLanguage,
  type CoraCodePedagogicalIssue,
  type CoraCodeTemplateId,
} from "@/lib/cora/code-workspace"

type Props = {
  effectiveTier: MembershipTier | null
  studentDatabaseId?: number | null
  studentContext?: CoraStudentContextPayload | null
}

export function CoraCodePanel({
  effectiveTier,
  studentDatabaseId,
  studentContext = null,
}: Props) {
  const { cta, soft, mid, accent } = useCoraContentPalette()
  const cora = useCoraOptional()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [code, setCode] = useState("")
  const [filename, setFilename] = useState<string | undefined>()
  const [language, setLanguage] = useState<CoraCodeLanguage>("auto")
  const [dragOver, setDragOver] = useState(false)
  const [templateId, setTemplateId] = useState<CoraCodeTemplateId>("new_program")
  const [analysisTab, setAnalysisTab] = useState<CoraCodeAnalysisTab>("overview")
  const [execStep, setExecStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [issueReveal, setIssueReveal] = useState<Record<string, "hint" | "explain" | "fix" | null>>({})
  const [activeChallenge, setActiveChallenge] = useState<string | null>(null)

  const hasCodebench = studentTierHasCodeBenchAccess(effectiveTier)
  const cont = useMemo(() => deriveCodeContinue(studentContext), [studentContext])
  const analysis = useMemo(
    () => analyzeCode(code, filename, language),
    [code, filename, language],
  )
  const hasCode = Boolean(code.trim())

  const openCodeBench = () => {
    if (!hasCodebench) return
    router.push("/student/dashboard-v2/codebench")
  }

  const launchAction = (actionId: CoraCodeActionId) => {
    if (hasCode && analysis) {
      saveCodeSessionDraft({
        title: filename || "Untitled program",
        subtitle: analysis.topics.slice(0, 2).join(" · "),
        progressPct: analysis.quality.overall,
      })
    }
    const body = buildCodeActionPrompt(actionId, code)
    const label = CORA_CODE_ACTIONS.find((a) => a.id === actionId)?.label ?? "Code"
    if (cora) {
      cora.openCora(
        coraContextFromQuestion({
          source: "codebench",
          domain: "coding",
          title: `Code Studio · ${label}`,
          questionText: body,
          questionType: "code_problem",
          studentDatabaseId: studentDatabaseId ?? null,
        }),
      )
    }
    if (hasCode) {
      if (actionId === "visualize") setAnalysisTab("execution")
      else if (actionId === "find_bugs") setAnalysisTab("debug")
      else if (actionId === "improve" || actionId === "check_work") setAnalysisTab("quality")
      else setAnalysisTab("overview")
    }
  }

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter(acceptedCodeUpload).slice(0, 3)
    if (!list.length) return
    const first = list[0]!
    setFilename(first.name)
    if (first.name.toLowerCase().endsWith(".zip")) {
      setCode((prev) =>
        prev.trim()
          ? prev
          : `// Uploaded archive: ${first.name}\n// Open in CodeBench to unpack the project, or paste the main file here.\n`,
      )
      return
    }
    try {
      const text = await first.text()
      setCode(text.slice(0, 80_000))
    } catch {
      setCode(`// Could not read ${first.name}. Paste the source manually.`)
    }
  }, [])

  const applyTemplate = (id: CoraCodeTemplateId) => {
    const t = CORA_CODE_TEMPLATES.find((x) => x.id === id)
    if (!t) return
    setTemplateId(id)
    setCode(t.snippet)
    setFilename(`${id}.cpp`)
    setExecStep(0)
    setIssueReveal({})
    setActiveChallenge(null)
  }

  const playExecution = () => {
    if (!analysis) return
    setPlaying(true)
    setAnalysisTab("execution")
    let step = 0
    setExecStep(0)
    const id = window.setInterval(() => {
      step += 1
      if (step >= analysis.executionSteps.length) {
        window.clearInterval(id)
        setPlaying(false)
        setExecStep(analysis.executionSteps.length - 1)
        return
      }
      setExecStep(step)
    }, 700)
  }

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            backgroundImage: `radial-gradient(ellipse at 0% 0%, ${soft}40, transparent 55%), radial-gradient(ellipse at 100% 0%, ${mid}28, transparent 50%), radial-gradient(ellipse at 50% 100%, ${accent}16, transparent 45%)`,
          }}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cc-text-muted)]">
              Cora Code Studio
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--cc-text)] sm:text-3xl">
              {cont.hasSession ? cont.title : "Start Coding"}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-[var(--cc-text-secondary)]">{cont.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Upload file
            </Button>
            <Button
              type="button"
              className="rounded-2xl"
              style={{ backgroundColor: cta.fill, color: cta.icon }}
              disabled={!hasCodebench}
              onClick={openCodeBench}
              title={hasCodebench ? undefined : "Sign in to open CodeBench"}
            >
              Open CodeBench
            </Button>
          </div>
        </div>
      </header>

      {/* Workspace */}
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--cc-text)]">Coding workspace</h3>
            <p className="text-xs text-[var(--cc-text-muted)]">
              Paste · upload .cpp / .h / .m / .py / .zip · drag & drop
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CORA_CODE_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  templateId === t.id && code.includes(t.snippet.slice(0, 24))
                    ? "bg-[var(--cc-accent)] text-white"
                    : "bg-[var(--muted)]/60 text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
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
            if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files)
          }}
          className={cn(
            "rounded-2xl border border-dashed transition-colors",
            dragOver ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)]/30" : "border-transparent",
          )}
        >
          <Textarea
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setExecStep(0)
            }}
            placeholder="// Paste or write your code…"
            className="min-h-[220px] resize-y rounded-2xl border-[var(--border)] bg-[var(--cc-surface)] font-mono text-sm shadow-none"
            spellCheck={false}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Upload file
            </Button>
            <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2 text-xs font-semibold text-[var(--cc-text-secondary)]">
              Language
              <span className="relative inline-flex items-center">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as CoraCodeLanguage)}
                  className="appearance-none bg-transparent pr-5 text-[var(--cc-text)] outline-none"
                >
                  {CORA_CODE_LANGUAGES.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 h-3.5 w-3.5 opacity-60" />
              </span>
              {analysis ? (
                <span className="text-[var(--cc-text-muted)]">· {analysis.languageLabel}</span>
              ) : null}
            </label>
          </div>
          {filename ? (
            <p className="text-xs text-[var(--cc-text-muted)]">{filename}</p>
          ) : null}
        </div>

        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".cpp,.cc,.cxx,.c,.h,.hpp,.m,.py,.java,.js,.ts,.tsx,.jsx,.zip,.txt"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files)
            e.target.value = ""
          }}
        />
      </section>

      {/* What should Cora do? */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--cc-text)]">What should Cora do?</h3>
          <p className="text-xs text-[var(--cc-text-muted)]">
            Clear intentions — Cora handles the mentoring strategy.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {CORA_CODE_ACTIONS.map((action) => (
            <Button
              key={action.id}
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => launchAction(action.id)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </section>

      {/* Contextual analysis — only after code */}
      <AnimatePresence>
        {analysis ? (
          <motion.div
            key="analysis"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-5"
          >
            <AnalysisHeader analysis={analysis} ctaFill={cta.fill} ctaIcon={cta.icon} />

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["overview", "Overview"],
                  ["execution", "Execution"],
                  ["debug", "Debug"],
                  ["quality", "Quality"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAnalysisTab(id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    analysisTab === id
                      ? "text-white"
                      : "bg-[var(--muted)]/60 text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]",
                  )}
                  style={analysisTab === id ? { backgroundColor: cta.fill } : undefined}
                >
                  {label}
                </button>
              ))}
            </div>

            <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
              {analysisTab === "overview" ? (
                <OverviewTab
                  analysis={analysis}
                  onExplain={() => launchAction("explain")}
                  onAsk={() => launchAction("explain")}
                  onChallenge={() => {
                    setActiveChallenge(analysis.challenges[1]?.id ?? analysis.challenges[0]?.id ?? null)
                  }}
                />
              ) : null}
              {analysisTab === "execution" ? (
                <ExecutionTab
                  analysis={analysis}
                  step={execStep}
                  playing={playing}
                  onStep={(n) => setExecStep(n)}
                  onPlay={playExecution}
                  accent={cta.fill}
                />
              ) : null}
              {analysisTab === "debug" ? (
                <DebugTab
                  analysis={analysis}
                  reveal={issueReveal}
                  setReveal={setIssueReveal}
                  onAskCora={() => launchAction("find_bugs")}
                />
              ) : null}
              {analysisTab === "quality" ? (
                <QualityTab analysis={analysis} onImprove={() => launchAction("improve")} />
              ) : null}
            </section>

            <ChallengeBlock
              analysis={analysis}
              activeId={activeChallenge}
              onStart={(id) => {
                setActiveChallenge(id)
                const ch = analysis.challenges.find((c) => c.id === id)
                if (cora && ch) {
                  cora.openCora(
                    coraContextFromQuestion({
                      source: "codebench",
                      domain: "coding",
                      title: `Challenge · ${ch.level}`,
                      questionText: `${ch.prompt}\n\nBase program:\n\`\`\`\n${code.trim()}\n\`\`\`\n\nCoach me — don't write the full answer first.`,
                      questionType: "code_problem",
                      studentDatabaseId: studentDatabaseId ?? null,
                    }),
                  )
                }
              }}
              ctaFill={cta.fill}
              ctaIcon={cta.icon}
            />

            <p className="text-xs text-[var(--cc-text-muted)]">
              <span className="font-semibold text-[var(--cc-text-secondary)]">Keep learning:</span>{" "}
              {analysis.relatedConcepts.join(" · ")}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function AnalysisHeader({
  analysis,
  ctaFill,
  ctaIcon,
}: {
  analysis: CoraCodeAnalysis
  ctaFill: string
  ctaIcon: string
}) {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
            Cora Code Analysis
          </p>
          <h3 className="mt-1 text-lg font-bold text-[var(--cc-text)]">Your program</h3>
          <ul className="mt-3 flex flex-wrap gap-3 text-sm">
            <li className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              {analysis.compiles ? "Compiles" : "Needs compile review"}
            </li>
            <li className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              {analysis.runtimeOk ? "No runtime issues detected" : "Runtime risk detected"}
            </li>
            {analysis.improvementCount > 0 ? (
              <li className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                {analysis.improvementCount} improvement
                {analysis.improvementCount === 1 ? "" : "s"}
              </li>
            ) : null}
          </ul>
          <p className="mt-2 text-xs font-semibold text-[var(--cc-text-secondary)]">
            {analysis.complexity.time} time · {analysis.complexity.memory} memory
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
          style={{ backgroundColor: ctaFill, color: ctaIcon }}
        >
          <Code2 className="h-3.5 w-3.5" />
          {analysis.languageLabel}
        </span>
      </div>
    </section>
  )
}

function OverviewTab({
  analysis,
  onExplain,
  onAsk,
  onChallenge,
}: {
  analysis: CoraCodeAnalysis
  onExplain: () => void
  onAsk: () => void
  onChallenge: () => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
          What your code does
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--cc-text)]">{analysis.summary}</p>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
          Key concepts
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {analysis.keyConcepts.map((c) => (
            <span
              key={c}
              className="rounded-full bg-[var(--muted)]/50 px-2.5 py-1 text-[11px] font-semibold text-[var(--cc-text-secondary)]"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-[var(--muted)]/30 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
          Cora noticed
        </p>
        <p className="mt-1 text-sm text-[var(--cc-text-secondary)]">{analysis.notice}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="rounded-full" onClick={onExplain}>
          Explain deeper
        </Button>
        <Button type="button" variant="outline" className="rounded-full gap-1.5" onClick={onAsk}>
          <Sparkles className="h-3.5 w-3.5" />
          Ask Cora
        </Button>
        <Button type="button" variant="outline" className="rounded-full" onClick={onChallenge}>
          Try a challenge
        </Button>
      </div>
    </div>
  )
}

function ExecutionTab({
  analysis,
  step,
  playing,
  onStep,
  onPlay,
  accent,
}: {
  analysis: CoraCodeAnalysis
  step: number
  playing: boolean
  onStep: (n: number) => void
  onPlay: () => void
  accent: string
}) {
  const total = analysis.executionSteps.length
  const current = analysis.executionSteps[step] ?? analysis.executionSteps[0]!
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--cc-text)]">
          Execution visualizer · Step {step + 1} of {total}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={step <= 0 || playing}
            onClick={() => onStep(Math.max(0, step - 1))}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={step >= total - 1 || playing}
            onClick={() => onStep(Math.min(total - 1, step + 1))}
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            className="rounded-full gap-1.5"
            style={{ backgroundColor: accent, color: "#fff" }}
            disabled={playing}
            onClick={onPlay}
          >
            <Play className="h-3.5 w-3.5" />
            Play execution
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/20 p-4">
        <p className="font-mono text-sm text-[var(--cc-text)]">{current.label}</p>
        <p className="mt-1 text-xs text-[var(--cc-text-muted)]">{current.detail}</p>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
          Current step
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--cc-text-muted)]">
            Variables
          </p>
          <ul className="mt-2 space-y-1.5 font-mono text-xs">
            {analysis.variables.map((v) => (
              <li key={v.name} className="flex justify-between gap-2">
                <span className="text-[var(--cc-text)]">{v.name}</span>
                <span className="text-[var(--cc-text-muted)]">
                  {step === 0 ? "—" : v.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-[var(--border)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--cc-text-muted)]">
            Output
          </p>
          <p className="mt-2 font-mono text-xs text-[var(--cc-text-secondary)]">
            {step >= total - 1 ? "Ready" : analysis.outputPreview}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--cc-text-muted)]">
            Call stack
          </p>
          <ul className="mt-2 space-y-1 font-mono text-xs text-[var(--cc-text)]">
            {analysis.callStack.map((frame) => (
              <li key={frame}>{frame}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function DebugTab({
  analysis,
  reveal,
  setReveal,
  onAskCora,
}: {
  analysis: CoraCodeAnalysis
  reveal: Record<string, "hint" | "explain" | "fix" | null>
  setReveal: Dispatch<SetStateAction<Record<string, "hint" | "explain" | "fix" | null>>>
  onAskCora: () => void
}) {
  const issues = analysis.issues
  if (issues.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--cc-text)]">No pedagogical issues flagged in this snippet.</p>
        <Button type="button" variant="outline" className="rounded-full" onClick={onAskCora}>
          Ask Cora to double-check
        </Button>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-[var(--cc-text)]">
        Cora found {issues.length} issue{issues.length === 1 ? "" : "s"}
      </p>
      {issues.map((issue, idx) => (
        <IssueCard
          key={issue.id}
          index={idx + 1}
          issue={issue}
          mode={reveal[issue.id] ?? null}
          onReveal={(mode) => setReveal((prev) => ({ ...prev, [issue.id]: mode }))}
        />
      ))}
    </div>
  )
}

function IssueCard({
  index,
  issue,
  mode,
  onReveal,
}: {
  index: number
  issue: CoraCodePedagogicalIssue
  mode: "hint" | "explain" | "fix" | null
  onReveal: (mode: "hint" | "explain" | "fix") => void
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] p-4">
      <p className="text-sm font-bold text-[var(--cc-text)]">
        {index} — {issue.title}
        {issue.line != null ? (
          <span className="ml-2 text-xs font-medium text-[var(--cc-text-muted)]">Line {issue.line}</span>
        ) : null}
      </p>
      {issue.snippet ? (
        <pre className="mt-2 overflow-x-auto rounded-xl bg-[var(--muted)]/40 p-3 font-mono text-xs text-[var(--cc-text)]">
          {issue.snippet}
        </pre>
      ) : null}
      <p className="mt-3 text-sm text-[var(--cc-text-secondary)]">{issue.question}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => onReveal("hint")}>
          Give me a hint
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-full"
          onClick={() => onReveal("explain")}
        >
          Explain issue
        </Button>
        <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => onReveal("fix")}>
          Show fix idea
        </Button>
      </div>
      <AnimatePresence mode="wait">
        {mode ? (
          <motion.p
            key={mode}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-xl bg-[var(--muted)]/35 p-3 text-xs leading-relaxed text-[var(--cc-text-secondary)]"
          >
            {mode === "hint" ? issue.hint : mode === "explain" ? issue.explain : `${issue.explain} Try correcting it yourself before asking Cora for a full patch.`}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function QualityTab({
  analysis,
  onImprove,
}: {
  analysis: CoraCodeAnalysis
  onImprove: () => void
}) {
  const rows = [
    ["Correctness", analysis.quality.correctness],
    ["Readability", analysis.quality.readability],
    ["Efficiency", analysis.quality.efficiency],
    ["Maintainability", analysis.quality.maintainability],
  ] as const
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
            Code quality
          </p>
          <p className="text-3xl font-bold tabular-nums text-[var(--cc-text)]">
            {analysis.quality.overall}
            <span className="text-base font-semibold text-[var(--cc-text-muted)]"> / 100</span>
          </p>
        </div>
        <Button type="button" variant="outline" className="rounded-full" onClick={onImprove}>
          Improve with Cora
        </Button>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-t border-[var(--border)]">
              <td className="py-2 font-medium text-[var(--cc-text)]">{label}</td>
              <td
                className={cn(
                  "py-2 text-right font-semibold",
                  value === "Strong"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : value === "Good"
                      ? "text-[var(--cc-text-secondary)]"
                      : "text-amber-600 dark:text-amber-400",
                )}
              >
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
          Complexity
        </p>
        <p className="mt-1 text-sm text-[var(--cc-text)]">
          Time <span className="font-semibold">{analysis.complexity.time}</span>
          {" · "}
          Memory <span className="font-semibold">{analysis.complexity.memory}</span>
        </p>
        <p className="mt-1 text-xs text-[var(--cc-text-muted)]">{analysis.complexity.why}</p>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
          {analysis.suggestions.length} suggestion{analysis.suggestions.length === 1 ? "" : "s"}
        </p>
        <ul className="mt-2 space-y-2">
          {analysis.suggestions.map((s) => (
            <li
              key={s}
              className="rounded-xl bg-[var(--muted)]/30 px-3 py-2 text-sm text-[var(--cc-text-secondary)]"
            >
              {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ChallengeBlock({
  analysis,
  activeId,
  onStart,
  ctaFill,
  ctaIcon,
}: {
  analysis: CoraCodeAnalysis
  activeId: string | null
  onStart: (id: string) => void
  ctaFill: string
  ctaIcon: string
}) {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h3 className="text-sm font-semibold text-[var(--cc-text)]">Challenge yourself</h3>
      <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
        Generated from your program — not a generic list.
      </p>
      <ul className="mt-4 space-y-3">
        {analysis.challenges.map((ch) => (
          <li
            key={ch.id}
            className={cn(
              "rounded-2xl border p-3",
              activeId === ch.id ? "border-[var(--cc-accent)]" : "border-[var(--border)]",
            )}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--cc-text-muted)]">
              {ch.level}
            </p>
            <p className="mt-1 text-sm text-[var(--cc-text)]">{ch.prompt}</p>
            <Button
              type="button"
              size="sm"
              className="mt-2 rounded-full"
              style={{ backgroundColor: ctaFill, color: ctaIcon }}
              onClick={() => onStart(ch.id)}
            >
              Start challenge
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
