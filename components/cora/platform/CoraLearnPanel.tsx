"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowRight,
  BookOpen,
  FileText,
  FolderOpen,
  Map,
  Presentation,
  Sparkles,
  Target,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useCoraOptional } from "@/components/cora/CoraProvider"
import { useCoraContentPalette } from "@/hooks/use-cora-content-palette"
import { coraContextFromQuestion } from "@/lib/cora/question-context"
import type { CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"
import {
  assembleLearnSequence,
  buildLearnLaunchPrompt,
  CONCEPT_EXPLORER_EDGES,
  CONCEPT_EXPLORER_NODES,
  CORA_LEARN_ACTIONS,
  deriveKnowledgeBars,
  deriveLearnContinue,
  deriveLearnRecommendation,
  deriveSuggestedTopics,
  type CoraConceptNode,
  type CoraKnowledgeBar,
  type CoraLearnActionId,
} from "@/lib/cora/learn-workspace"

type Props = {
  studentDatabaseId?: number | null
  studentContext?: CoraStudentContextPayload | null
  onOpenWorkspace?: () => void
}

type LearnFocus =
  | { kind: "idle" }
  | { kind: "topic"; topic: string; masteryPct?: number | null }
  | { kind: "material"; label: string; text: string }

export function CoraLearnPanel({
  studentDatabaseId,
  studentContext = null,
  onOpenWorkspace,
}: Props) {
  const { cta, soft, mid, accent } = useCoraContentPalette()
  const cora = useCoraOptional()
  const fileRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [focus, setFocus] = useState<LearnFocus>({ kind: "idle" })
  const [selectedConcept, setSelectedConcept] = useState<CoraConceptNode | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState("")
  const [materialNote, setMaterialNote] = useState("")

  const cont = useMemo(() => deriveLearnContinue(studentContext), [studentContext])
  const knowledge = useMemo(() => deriveKnowledgeBars(studentContext), [studentContext])
  const recommendation = useMemo(() => deriveLearnRecommendation(studentContext), [studentContext])
  const suggestions = useMemo(() => deriveSuggestedTopics(studentContext), [studentContext])

  const needsAttention = knowledge.filter((k) => k.status === "weak").slice(0, 2)
  const strongest = knowledge.filter((k) => k.status === "strong").slice(0, 1)

  const launch = (opts: {
    topic: string
    action?: CoraLearnActionId
    material?: string
    masteryPct?: number | null
  }) => {
    const prompt = buildLearnLaunchPrompt(opts)
    if (cora) {
      cora.openCora(
        coraContextFromQuestion({
          source: "custom",
          domain: "generic",
          title: `Learn · ${opts.topic}`,
          questionText: prompt,
          studentDatabaseId: studentDatabaseId ?? null,
        }),
      )
      return
    }
    onOpenWorkspace?.()
  }

  const beginTopic = (topic: string, masteryPct?: number | null) => {
    const trimmed = topic.trim()
    if (!trimmed) return
    setFocus({ kind: "topic", topic: trimmed, masteryPct })
    setQuery(trimmed)
    setSelectedConcept(
      CONCEPT_EXPLORER_NODES.find((n) => n.label.toLowerCase().includes(trimmed.toLowerCase())) ??
        null,
    )
  }

  const beginMaterial = (label: string, text: string) => {
    setFocus({ kind: "material", label, text })
    setPasteOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Continue Learning */}
      <header className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            backgroundImage: `radial-gradient(ellipse at 0% 0%, ${soft}40, transparent 55%), radial-gradient(ellipse at 100% 0%, ${mid}28, transparent 50%), radial-gradient(ellipse at 50% 100%, ${accent}16, transparent 45%)`,
          }}
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cc-text-muted)]">
              Learn with Cora
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--cc-text)] sm:text-3xl">
              {cont.title}
            </h2>
            <p className="max-w-xl text-sm text-[var(--cc-text-secondary)]">{cont.subtitle}</p>
            {cont.hasActivity ? (
              <div className="pt-2">
                <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--cc-text-muted)]">
                  <span>{cont.masteryPct}% mastered</span>
                  <span>{cont.minutesRemaining} min remaining</span>
                </div>
                <Progress value={cont.masteryPct} className="h-2 max-w-md" />
              </div>
            ) : null}
          </div>
          <Button asChild className="rounded-2xl" style={{ backgroundColor: cta.fill, color: cta.icon }}>
            <Link href={cont.href}>
              {cont.hasActivity ? "Continue" : "Open lectures"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      {/* What would you like to learn? */}
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-[var(--cc-text)]">What would you like to learn?</h3>
        <form
          className="mt-3 flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            beginTopic(query)
          }}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about a concept, lecture, topic, or course material…"
            className="h-12 flex-1 rounded-2xl border-[var(--border)] bg-[var(--cc-surface)] text-sm"
          />
          <Button
            type="submit"
            className="h-12 rounded-2xl px-5"
            style={{ backgroundColor: cta.fill, color: cta.icon }}
            disabled={!query.trim()}
          >
            Learn
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild type="button" variant="outline" className="rounded-full gap-1.5">
            <Link href="/student/dashboard-v2/lectures">
              <Presentation className="h-3.5 w-3.5" />
              Choose lecture
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full gap-1.5"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload material
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full gap-1.5"
            onClick={() => {
              const first = suggestions[0]
              if (first) beginTopic(first)
            }}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Pick a topic
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,image/*,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              beginMaterial(file.name, `Student uploaded: ${file.name}. Teach from this material.`)
              setMaterialNote(file.name)
              e.target.value = ""
            }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
            Suggested
          </span>
          {suggestions.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => beginTopic(topic)}
              className="rounded-full border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-1 text-xs font-semibold text-[var(--cc-text-secondary)] transition-colors hover:border-[var(--cc-accent)]/40 hover:text-[var(--cc-text)]"
            >
              {topic}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {focus.kind === "topic" || focus.kind === "material" ? (
            <motion.div
              key="how"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/25 p-4"
            >
              <p className="text-sm font-semibold text-[var(--cc-text)]">
                {focus.kind === "topic"
                  ? `How do you want to learn ${focus.topic}?`
                  : `How do you want to learn from ${focus.label}?`}
              </p>
              <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
                Cora will assemble{" "}
                {assembleLearnSequence(focus.kind === "topic" ? focus.masteryPct : null)
                  .map((p) => p.replaceAll("_", " "))
                  .join(" → ")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(focus.kind === "material"
                  ? CORA_LEARN_ACTIONS.filter((a) =>
                      ["explain", "summarize", "quiz", "flashcards", "example"].includes(a.id),
                    )
                  : CORA_LEARN_ACTIONS.filter((a) =>
                      ["explain", "visualize", "example", "quiz", "teach_back"].includes(a.id),
                    )
                ).map((action) => (
                  <Button
                    key={action.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() =>
                      launch({
                        topic: focus.kind === "topic" ? focus.topic : focus.label,
                        action: action.id,
                        material: focus.kind === "material" ? focus.text : undefined,
                        masteryPct: focus.kind === "topic" ? focus.masteryPct : null,
                      })
                    }
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                className="mt-3 rounded-full"
                style={{ backgroundColor: cta.fill, color: cta.icon }}
                onClick={() =>
                  launch({
                    topic: focus.kind === "topic" ? focus.topic : focus.label,
                    action: "explain",
                    material: focus.kind === "material" ? focus.text : undefined,
                    masteryPct: focus.kind === "topic" ? focus.masteryPct : null,
                  })
                }
              >
                Start learning
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>

      {/* Cora recommends */}
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--cc-text-muted)]">
              Cora recommends
            </p>
            <h3 className="mt-1 text-lg font-bold text-[var(--cc-text)]">{recommendation.topic}</h3>
            <p className="mt-1 text-sm text-[var(--cc-text-secondary)]">{recommendation.reason}</p>
            <p className="mt-3 text-sm text-[var(--cc-text)]">
              {recommendation.blocks.map((b) => `${b.mins} min ${b.label.toLowerCase()}`).join(" → ")}
            </p>
            <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
              About {recommendation.totalMinutes} minutes
            </p>
          </div>
          <Button
            type="button"
            className="rounded-2xl"
            style={{ backgroundColor: cta.fill, color: cta.icon }}
            onClick={() => {
              beginTopic(
                recommendation.topic,
                knowledge.find((k) => k.label === recommendation.topic)?.mastery ?? 30,
              )
              launch({
                topic: recommendation.topic,
                action: "explain",
                masteryPct: knowledge.find((k) => k.label === recommendation.topic)?.mastery ?? 30,
              })
            }}
          >
            Start learning
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Explore: Concept Explorer + Knowledge Map */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="mb-3 flex items-center gap-2">
            <Map className="h-4 w-4" style={{ color: cta.fill }} />
            <h3 className="text-sm font-semibold text-[var(--cc-text)]">Concept explorer</h3>
          </div>
          <div className="relative h-56 overflow-hidden rounded-2xl bg-[var(--muted)]/30">
            <svg className="absolute inset-0 h-full w-full" aria-hidden>
              {CONCEPT_EXPLORER_EDGES.map(([a, b]) => {
                const na = CONCEPT_EXPLORER_NODES.find((n) => n.id === a)!
                const nb = CONCEPT_EXPLORER_NODES.find((n) => n.id === b)!
                const active =
                  selectedConcept &&
                  (selectedConcept.id === a ||
                    selectedConcept.id === b ||
                    selectedConcept.related.some(
                      (r) => r.toLowerCase() === na.label.toLowerCase() || r.toLowerCase() === nb.label.toLowerCase(),
                    ))
                return (
                  <line
                    key={`${a}-${b}`}
                    x1={`${na.x}%`}
                    y1={`${na.y}%`}
                    x2={`${nb.x}%`}
                    y2={`${nb.y}%`}
                    stroke={active ? cta.fill : "var(--border)"}
                    strokeWidth={active ? 2.5 : 2}
                    opacity={selectedConcept && !active ? 0.35 : 1}
                  />
                )
              })}
            </svg>
            {CONCEPT_EXPLORER_NODES.map((node) => {
              const active = selectedConcept?.id === node.id
              const related =
                selectedConcept &&
                selectedConcept.id !== node.id &&
                selectedConcept.related.some((r) => r.toLowerCase().includes(node.label.toLowerCase().split(" ")[0]!))
              return (
                <button
                  key={node.id}
                  type="button"
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all",
                    active
                      ? "scale-110 border-transparent text-white"
                      : related
                        ? "border-[var(--cc-accent)]/50 bg-[var(--cc-accent-soft)] text-[var(--cc-text)]"
                        : "border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)]",
                    selectedConcept && !active && !related && "opacity-40",
                  )}
                  style={{
                    left: `${node.x}%`,
                    top: `${node.y}%`,
                    ...(active ? { backgroundColor: cta.fill, color: cta.icon } : {}),
                  }}
                  onClick={() => setSelectedConcept(node)}
                >
                  {node.label}
                </button>
              )
            })}
          </div>

          <AnimatePresence mode="wait">
            {selectedConcept ? (
              <motion.div
                key={selectedConcept.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 space-y-3"
              >
                <div>
                  <p className="text-sm font-bold text-[var(--cc-text)]">{selectedConcept.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--cc-text-secondary)]">
                    {selectedConcept.blurb}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedConcept.related.map((r) => (
                    <span
                      key={r}
                      className="rounded-full bg-[var(--muted)]/50 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--cc-text-muted)]"
                    >
                      {r}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["explain", "example", "visualize", "practice"] as CoraLearnActionId[]).map((id) => {
                    const action = CORA_LEARN_ACTIONS.find((a) => a.id === id)!
                    return (
                      <Button
                        key={id}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => {
                          beginTopic(selectedConcept.label)
                          launch({ topic: selectedConcept.label, action: id })
                        }}
                      >
                        {action.label}
                      </Button>
                    )
                  })}
                </div>
              </motion.div>
            ) : (
              <p className="mt-3 text-xs text-[var(--cc-text-muted)]">
                Click a concept to focus the graph and learn from it.
              </p>
            )}
          </AnimatePresence>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-4 w-4" style={{ color: cta.fill }} />
            <h3 className="text-sm font-semibold text-[var(--cc-text)]">Knowledge map</h3>
          </div>
          <div className="space-y-4">
            {needsAttention.length > 0 ? (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-rose-500">
                  Needs attention
                </p>
                <ul className="space-y-2">
                  {needsAttention.map((bar) => (
                    <KnowledgeCard
                      key={bar.id}
                      bar={bar}
                      ctaFill={cta.fill}
                      ctaIcon={cta.icon}
                      onContinue={() => {
                        beginTopic(bar.label, bar.mastery)
                        const node = CONCEPT_EXPLORER_NODES.find((n) =>
                          bar.label.toLowerCase().includes(n.label.toLowerCase().split(" ")[0]!),
                        )
                        if (node) setSelectedConcept(node)
                      }}
                    />
                  ))}
                </ul>
              </div>
            ) : null}
            {strongest.length > 0 ? (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                  Strongest
                </p>
                <ul className="space-y-2">
                  {strongest.map((bar) => (
                    <KnowledgeCard
                      key={bar.id}
                      bar={bar}
                      ctaFill={cta.fill}
                      ctaIcon={cta.icon}
                      onContinue={() => {
                        beginTopic(bar.label, bar.mastery)
                        const node = CONCEPT_EXPLORER_NODES.find((n) =>
                          bar.label.toLowerCase().includes(n.label.toLowerCase().split(" ")[0]!),
                        )
                        if (node) setSelectedConcept(node)
                      }}
                    />
                  ))}
                </ul>
              </div>
            ) : null}
            {needsAttention.length === 0 && strongest.length === 0
              ? knowledge.slice(0, 3).map((bar) => (
                  <KnowledgeCard
                    key={bar.id}
                    bar={bar}
                    ctaFill={cta.fill}
                    ctaIcon={cta.icon}
                    onContinue={() => beginTopic(bar.label, bar.mastery)}
                  />
                ))
              : null}
          </div>
        </section>
      </div>

      {/* Learn from anything */}
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: soft, color: cta.fill }}
          >
            <BookOpen className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-[var(--cc-text)]">Learn from anything</h3>
            <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
              Give Cora course material and turn it into an interactive lesson.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full gap-1.5"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload PDF
              </Button>
              <Button asChild variant="outline" className="rounded-full gap-1.5">
                <Link href="/student/dashboard-v2/digital-notes">
                  <FileText className="h-3.5 w-3.5" />
                  Course notes
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full gap-1.5">
                <Link href="/student/dashboard-v2/lectures">
                  <Presentation className="h-3.5 w-3.5" />
                  Lecture
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full gap-1.5"
                onClick={() => setPasteOpen((v) => !v)}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Paste text
              </Button>
            </div>

            {materialNote ? (
              <p className="mt-3 text-xs font-medium text-[var(--cc-text-secondary)]">
                Ready: {materialNote}
              </p>
            ) : null}

            <AnimatePresence>
              {pasteOpen ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 space-y-2 overflow-hidden"
                >
                  <Textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Paste a passage, slide notes, or textbook excerpt…"
                    className="min-h-[100px] rounded-2xl"
                  />
                  <Button
                    type="button"
                    className="rounded-full"
                    style={{ backgroundColor: cta.fill, color: cta.icon }}
                    disabled={pasteText.trim().length < 20}
                    onClick={() => beginMaterial("Pasted material", pasteText)}
                  >
                    Teach this
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </section>
    </div>
  )
}

function KnowledgeCard({
  bar,
  ctaFill,
  ctaIcon,
  onContinue,
}: {
  bar: CoraKnowledgeBar
  ctaFill: string
  ctaIcon: string
  onContinue: () => void
}) {
  return (
    <li className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--cc-text)]">{bar.label}</p>
          <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">
            {bar.mastery}% mastery
            {bar.status === "weak" && bar.conceptsNeedingReview > 0
              ? ` · ${bar.conceptsNeedingReview} concepts need review`
              : bar.status === "strong"
                ? " · Nearly mastered"
                : null}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${bar.mastery}%`,
                backgroundColor:
                  bar.status === "weak" ? "#F43F5E" : bar.status === "strong" ? "#10B981" : ctaFill,
              }}
            />
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0 rounded-full"
          style={{ backgroundColor: ctaFill, color: ctaIcon }}
          onClick={onContinue}
        >
          Continue
        </Button>
      </div>
    </li>
  )
}
