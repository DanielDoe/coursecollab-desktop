"use client"

import { useMemo, useState } from "react"
import { ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useCoraContentPalette } from "@/hooks/use-cora-content-palette"
import type { CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"
import {
  deriveVisibleMemoryFacts,
  type CoraDefaultBehavior,
  type CoraExplanationFormat,
  type CoraExplanationLevel,
  type CoraLearningMemory,
  type CoraTechnicalLevel,
  type CoraTeachingPrefs,
  type CoraTutorPreferences,
} from "@/lib/cora/preferences-storage"

import type { CoraPrivacySettings } from "@/lib/cora/privacy/cora-privacy-settings"

type Props = {
  studentId: string
  preferences: CoraTutorPreferences
  onPreferencesChange: (next: CoraTutorPreferences) => void
  serverPrivacy: CoraPrivacySettings
  onServerPrivacyChange: (patch: Partial<CoraPrivacySettings>) => void
  studentContext?: CoraStudentContextPayload | null
}

const FORMAT_OPTIONS: Array<{ id: CoraExplanationFormat; label: string; description: string }> = [
  {
    id: "visual",
    label: "Visual",
    description: "Diagrams, graphs, flows, annotated examples",
  },
  {
    id: "worked_examples",
    label: "Worked Examples",
    description: "Learn by seeing problems solved",
  },
  {
    id: "conceptual",
    label: "Conceptual",
    description: "Intuition and plain-language explanations",
  },
  {
    id: "practice_first",
    label: "Practice First",
    description: "Attempt something before the full explanation",
  },
]

const DEPTH_OPTIONS: Array<{ id: CoraExplanationLevel; label: string; description: string }> = [
  { id: "quick", label: "Quick", description: "Answer the key idea" },
  { id: "guided", label: "Guided", description: "Explain enough to understand" },
  { id: "deep", label: "Deep", description: "Thorough with supporting detail" },
]

const TECH_OPTIONS: Array<{ id: CoraTechnicalLevel; label: string }> = [
  { id: "introductory", label: "Introductory" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
]

const BEHAVIOR_OPTIONS: Array<{ id: CoraDefaultBehavior; label: string }> = [
  { id: "guide", label: "Guide me" },
  { id: "explain", label: "Explain it" },
  { id: "practice", label: "Practice with me" },
]

const TEACHING_TOGGLES: Array<{ id: keyof CoraTeachingPrefs; label: string; description: string }> = [
  { id: "stepByStep", label: "Step-by-step guidance", description: "Break complex topics into steps when needed" },
  { id: "visualExplanations", label: "Visual explanations", description: "Diagrams and flows when they clarify" },
  { id: "realWorldExamples", label: "Real-world examples", description: "Everyday analogies when helpful" },
  { id: "checkUnderstanding", label: "Check my understanding", description: "Short checks before moving on" },
  { id: "showFormulas", label: "Show formulas & equations", description: "When the subject needs them" },
  { id: "codeWhenRelevant", label: "Code examples when relevant", description: "Only for coding-related help" },
  { id: "hintsBeforeSolutions", label: "Hints before solutions", description: "Teach first — don’t just answer homework" },
]

const MEMORY_TOGGLES: Array<{ id: keyof CoraLearningMemory; label: string; description: string }> = [
  {
    id: "remember-gaps",
    label: "Remember learning gaps",
    description: "Remember concepts I repeatedly struggle with.",
  },
  {
    id: "detect-confusion",
    label: "Detect confusion",
    description: "Adjust explanations when I appear stuck.",
  },
  {
    id: "remember-strengths",
    label: "Remember strengths",
    description: "Avoid over-explaining concepts I’ve mastered.",
  },
  {
    id: "use-course-progress",
    label: "Use my course progress",
    description: "Personalize using lectures, practice, and performance.",
  },
  {
    id: "remember-preferences",
    label: "Remember my preferences",
    description: "Keep teaching preferences across sessions.",
  },
]

export function CoraPreferencesPanel({
  preferences,
  onPreferencesChange,
  serverPrivacy,
  onServerPrivacyChange,
  studentContext = null,
}: Props) {
  const { cta, soft, accent, tone } = useCoraContentPalette()
  const [memoryOpen, setMemoryOpen] = useState(false)

  const patch = (partial: Partial<CoraTutorPreferences>) => {
    onPreferencesChange({ ...preferences, ...partial })
  }

  const toggleFormat = (id: CoraExplanationFormat) => {
    const has = preferences.explanationFormats.includes(id)
    const next = has
      ? preferences.explanationFormats.filter((f) => f !== id)
      : [...preferences.explanationFormats, id]
    patch({ explanationFormats: next.length ? next : [id] })
  }

  const memoryFacts = useMemo(
    () => deriveVisibleMemoryFacts(preferences, studentContext),
    [preferences, studentContext],
  )

  const localLearningMemoryOn = useMemo(
    () => Object.values(preferences.memory).some(Boolean),
    [preferences.memory],
  )

  const setLocalLearningMemory = (enabled: boolean) => {
    const nextMemory = { ...preferences.memory }
    for (const key of Object.keys(nextMemory) as Array<keyof CoraLearningMemory>) {
      nextMemory[key] = enabled
    }
    patch({ memory: nextMemory })
  }

  const clearLocalLearningMemory = () => {
    const ids = memoryFacts.map((fact) => fact.id)
    patch({
      clearedMemoryIds: [...new Set([...preferences.clearedMemoryIds, ...ids])],
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--cc-text-muted)]">
          Preferences
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-[var(--cc-text)]">
          How Cora should teach me
        </h2>
        <p className="text-sm text-[var(--cc-text-secondary)]">
          Pedagogy settings — not app chrome. These shape every tutoring session.
        </p>
      </header>

      {/* Default behavior */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--cc-text)]">When I ask Cora for help, usually</h3>
          <p className="text-xs text-[var(--cc-text-muted)]">Cora still adapts to context; this is your default stance.</p>
        </div>
        <Segmented
          options={BEHAVIOR_OPTIONS}
          value={preferences.defaultBehavior}
          onChange={(id) => patch({ defaultBehavior: id })}
          accent={cta.fill}
        />
      </section>

      <Divider />

      {/* How Cora teaches */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--cc-text)]">How Cora teaches me</h3>
          <p className="text-xs text-[var(--cc-text-muted)]">
            Preferred explanation formats — select all that help you.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {FORMAT_OPTIONS.map((opt, i) => {
            const active = preferences.explanationFormats.includes(opt.id)
            const swatch = tone(i)
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleFormat(opt.id)}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-transparent shadow-sm"
                    : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--cc-accent)]/30",
                )}
                style={
                  active
                    ? { backgroundColor: soft, borderColor: swatch.fill, borderWidth: 1 }
                    : undefined
                }
              >
                <p className="text-sm font-semibold text-[var(--cc-text)]">{opt.label}</p>
                <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">{opt.description}</p>
              </button>
            )
          })}
        </div>
      </section>

      <Divider />

      {/* Explanation level */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--cc-text)]">Explanation level</h3>
          <p className="text-xs text-[var(--cc-text-muted)]">How deep Cora goes by default.</p>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--cc-text-muted)]">Depth</p>
          <Segmented
            options={DEPTH_OPTIONS.map((d) => ({ id: d.id, label: d.label }))}
            value={preferences.explanationLevel}
            onChange={(id) => patch({ explanationLevel: id })}
            accent={cta.fill}
          />
          <p className="text-xs text-[var(--cc-text-muted)]">
            {DEPTH_OPTIONS.find((d) => d.id === preferences.explanationLevel)?.description}
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--cc-text-muted)]">
            Technical level
          </p>
          <Segmented
            options={TECH_OPTIONS}
            value={preferences.technicalLevel}
            onChange={(id) => patch({ technicalLevel: id })}
            accent={cta.fill}
          />
        </div>
      </section>

      <Divider />

      {/* Teaching preferences */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--cc-text)]">Teaching preferences</h3>
          <p className="text-xs text-[var(--cc-text-muted)]">
            Applied when relevant to the subject — not forced into every reply.
          </p>
        </div>
        <div className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          {TEACHING_TOGGLES.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--cc-text)]">{item.label}</p>
                <p className="text-xs text-[var(--cc-text-muted)]">{item.description}</p>
              </div>
              <Switch
                checked={preferences.teaching[item.id]}
                onCheckedChange={(checked) =>
                  patch({ teaching: { ...preferences.teaching, [item.id]: checked } })
                }
              />
            </div>
          ))}
        </div>
      </section>

      <Divider />

      <Divider />

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--cc-text)]">Privacy &amp; personalization</h3>
          <p className="text-xs text-[var(--cc-text-muted)]">
            Server-synced controls shape what CourseCollab may include when Cora calls an external AI provider.
            Teaching-style memory below is stored on this device only.
          </p>
        </div>
        <div className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-start justify-between gap-4 px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--cc-text)]">Personalized learning</p>
              <p className="text-xs text-[var(--cc-text-muted)]">
                Allow Cora to use performance summaries and topic mastery when answering.
              </p>
            </div>
            <Switch
              checked={serverPrivacy.personalizedLearning}
              onCheckedChange={(checked) => onServerPrivacyChange({ personalizedLearning: checked })}
            />
          </div>
          <div className="flex items-start justify-between gap-4 px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--cc-text)]">Use learning context</p>
              <p className="text-xs text-[var(--cc-text-muted)]">
                Include course progress, calendar, notes titles, and similar authorized context in AI requests.
              </p>
            </div>
            <Switch
              checked={serverPrivacy.useLearningContext}
              onCheckedChange={(checked) => onServerPrivacyChange({ useLearningContext: checked })}
            />
          </div>
          <div className="flex items-start justify-between gap-4 px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--cc-text)]">Local learning memory</p>
              <p className="text-xs text-[var(--cc-text-muted)]">
                Device-only teaching memory toggles (gaps, strengths, preferences). Not the same as server chat history.
              </p>
            </div>
            <Switch checked={localLearningMemoryOn} onCheckedChange={setLocalLearningMemory} />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" size="sm" onClick={clearLocalLearningMemory}>
            Clear Cora learning memory
          </Button>
          <a
            href="/ai-and-data"
            className="inline-flex items-center text-xs font-medium text-[var(--cc-accent-dark)] underline-offset-4 hover:underline"
          >
            AI data &amp; privacy — learn more
          </a>
        </div>
      </section>

      <Divider />

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--cc-text)]">AI &amp; Data</h3>
          <p className="text-xs text-[var(--cc-text-muted)]">
            Cora sends only task-relevant context to OpenAI or Anthropic — not your name, email, or student ID for
            personalization alone. Conversations are stored on CourseCollab servers so you can resume them.
          </p>
          <a href="/ai-and-data" className="text-xs font-medium text-[var(--cc-accent-dark)] underline-offset-4 hover:underline">
            Read the AI &amp; Data policy
          </a>
        </div>
      </section>

      <Divider />

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--cc-text)]">Instructor sharing</h3>
          <p className="text-xs text-[var(--cc-text-muted)]">
            Off by default. If you decline, your instructor never sees your chats — only anonymous class themes.
          </p>
        </div>
        <div className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-start justify-between gap-4 px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--cc-text)]">Share Cora summaries with my instructor</p>
              <p className="text-xs text-[var(--cc-text-muted)]">
                Lets your instructor see a short topic summary (not the full conversation) to help teach the class.
              </p>
            </div>
            <Switch
              checked={preferences.shareWithInstructor === true}
              onCheckedChange={(checked) => patch({ shareWithInstructor: checked })}
            />
          </div>
        </div>
      </section>

      <Divider />

      {/* Memory */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--cc-text)]">Cora memory & personalization (this device)</h3>
          <p className="text-xs text-[var(--cc-text-muted)]">
            Fine-grained local teaching memory. Stored in your browser — not synced to other devices.
          </p>
        </div>
        <div className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          {MEMORY_TOGGLES.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--cc-text)]">{item.label}</p>
                <p className="text-xs text-[var(--cc-text-muted)]">{item.description}</p>
              </div>
              <Switch
                checked={preferences.memory[item.id]}
                onCheckedChange={(checked) =>
                  patch({ memory: { ...preferences.memory, [item.id]: checked } })
                }
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setMemoryOpen(true)}
          className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-left transition-colors hover:border-[var(--cc-accent)]/30"
        >
          <div>
            <p className="text-sm font-medium text-[var(--cc-text)]">Manage Cora Memory</p>
            <p className="text-xs text-[var(--cc-text-muted)]">See and remove what Cora remembers about you</p>
          </div>
          <ChevronRight className="h-4 w-4 text-[var(--cc-text-muted)]" />
        </button>
      </section>

      <Dialog open={memoryOpen} onOpenChange={setMemoryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cora remembers</DialogTitle>
            <DialogDescription>
              Remove anything you don’t want used for personalization.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
            {memoryFacts.length === 0 ? (
              <li className="rounded-xl bg-[var(--muted)]/40 px-3 py-4 text-center text-sm text-[var(--cc-text-muted)]">
                No active memories yet. Keep learning with Cora.
              </li>
            ) : (
              memoryFacts.map((fact) => (
                <li
                  key={fact.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5"
                >
                  <p className="text-sm text-[var(--cc-text)]">{fact.label}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 text-xs"
                    onClick={() =>
                      patch({
                        clearedMemoryIds: [...preferences.clearedMemoryIds, fact.id],
                      })
                    }
                  >
                    Remove
                  </Button>
                </li>
              ))
            )}
          </ul>
          {preferences.clearedMemoryIds.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => patch({ clearedMemoryIds: [] })}
            >
              Restore removed memories
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Divider() {
  return <div className="h-px w-full bg-[var(--border)]" />
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: T; label: string }>
  value: T
  onChange: (id: T) => void
  accent?: string
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/25 p-1">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "flex-1 rounded-xl px-3 py-2 text-center text-xs font-semibold transition-colors sm:text-sm",
            value === opt.id
              ? "bg-[var(--card)] text-[var(--cc-text)] shadow-sm ring-1 ring-[var(--cc-accent)]/40"
              : "text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
