"use client"

import { useEffect, useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useCoraContentPalette } from "@/hooks/use-cora-content-palette"
import {
  DEFAULT_FACULTY_CORA_PREFERENCES,
  loadFacultyCoraPreferences,
  saveFacultyCoraPreferences,
  type FacultyCoraBloom,
  type FacultyCoraDifficulty,
  type FacultyCoraLength,
  type FacultyCoraPreferences,
  type FacultyCoraQuestionCount,
  type FacultyCoraQuestionTypes,
  type FacultyCoraStance,
  type FacultyCoraTone,
  type FacultyCoraWriteConfirm,
} from "@/lib/cora/faculty-preferences-storage"

const STANCE_OPTIONS: Array<{ id: FacultyCoraStance; label: string; description: string }> = [
  { id: "draft", label: "Draft first", description: "Prepare materials immediately" },
  { id: "confirm", label: "Confirm first", description: "Cards before anything publishes" },
  { id: "analyze", label: "Analyze first", description: "Inspect course data, then act" },
  { id: "explain", label: "Explain first", description: "Clarify, then offer a next step" },
]

const LENGTH_OPTIONS: Array<{ id: FacultyCoraLength; label: string }> = [
  { id: "concise", label: "Concise" },
  { id: "standard", label: "Standard" },
  { id: "thorough", label: "Thorough" },
]

const TONE_OPTIONS: Array<{ id: FacultyCoraTone; label: string }> = [
  { id: "professional", label: "Professional" },
  { id: "collegial", label: "Collegial" },
  { id: "direct", label: "Direct" },
]

const WRITE_OPTIONS: Array<{ id: FacultyCoraWriteConfirm; label: string; description: string }> = [
  { id: "always", label: "Always confirm", description: "Confirmation cards for every create, publish, or send" },
  { id: "publish_only", label: "Publishes only", description: "Confirm sends; drafts can be prepared quietly" },
  { id: "drafts_ok", label: "Drafts freely", description: "Author freely; still confirm anything students will see" },
]

const COUNT_OPTIONS: Array<{ id: FacultyCoraQuestionCount; label: string }> = [
  { id: 4, label: "4" },
  { id: 6, label: "6" },
  { id: 8, label: "8" },
  { id: 10, label: "10" },
  { id: 12, label: "12" },
]

const DIFFICULTY_OPTIONS: Array<{ id: FacultyCoraDifficulty; label: string }> = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
  { id: "mixed", label: "Mixed" },
]

const BLOOM_OPTIONS: Array<{ id: FacultyCoraBloom; label: string }> = [
  { id: "remember", label: "Remember" },
  { id: "apply", label: "Apply" },
  { id: "analyze", label: "Analyze" },
  { id: "mixed", label: "Mixed" },
]

const TYPE_OPTIONS: Array<{ id: keyof FacultyCoraQuestionTypes; label: string; description: string }> = [
  { id: "mcq", label: "Multiple choice", description: "Single-answer MCQ" },
  { id: "trueFalse", label: "True / false", description: "Binary checks" },
  { id: "selectAll", label: "Select all", description: "Multi-select" },
  { id: "fillBlank", label: "Fill in the blank", description: "Short completion" },
  { id: "freeResponse", label: "Free response", description: "Worked or written" },
  { id: "code", label: "Code problems", description: "When the course needs them" },
]

const AUTHORING_TOGGLES: Array<{
  id: keyof Pick<
    FacultyCoraPreferences,
    "suggestQuestionDrafts" | "includeSolutions" | "includeRubrics" | "preferCourseTopics"
  >
  label: string
  description: string
}> = [
  {
    id: "suggestQuestionDrafts",
    label: "Suggest question-bank drafts",
    description: "Show action chips when you ask Cora to generate assessments.",
  },
  {
    id: "includeSolutions",
    label: "Include solutions",
    description: "Attach expected answers to generated items.",
  },
  {
    id: "includeRubrics",
    label: "Include rubrics",
    description: "Add short scoring notes on free-response drafts.",
  },
  {
    id: "preferCourseTopics",
    label: "Prefer existing course topics",
    description: "Reuse question-bank and lecture topics instead of inventing new ones.",
  },
]

const CLASSROOM_TOGGLES: Array<{
  id: keyof Pick<
    FacultyCoraPreferences,
    | "suggestAutomations"
    | "autoProposeAnnouncements"
    | "mentionOfficeHours"
    | "suggestFlashcardsAfterLecture"
  >
  label: string
  description: string
}> = [
  {
    id: "suggestAutomations",
    label: "Suggest automations",
    description: "Offer weekly announcements or scheduled follow-ups.",
  },
  {
    id: "autoProposeAnnouncements",
    label: "Auto-propose announcements",
    description: "Prepare a confirmation card as soon as you ask to notify the class.",
  },
  {
    id: "mentionOfficeHours",
    label: "Mention office hours",
    description: "Include office hours in class communications when relevant.",
  },
  {
    id: "suggestFlashcardsAfterLecture",
    label: "Post-lecture flashcards",
    description: "Offer flashcards after lecture or notes work.",
  },
]

const CONTEXT_TOGGLES: Array<{
  id: keyof Pick<
    FacultyCoraPreferences,
    | "rememberCourseFocus"
    | "useStudentCoraChats"
    | "useAssessmentResults"
    | "useAttendance"
    | "anonymizeStudentNames"
    | "persistGlobalMemory"
    | "persistThreadMemory"
  >
  label: string
  description: string
}> = [
  {
    id: "rememberCourseFocus",
    label: "Remember course focus",
    description: "Keep recent teaching topics handy for follow-up chats.",
  },
  {
    id: "useStudentCoraChats",
    label: "Use student Cora chats",
    description: "Surface struggle topics from student AI questions.",
  },
  {
    id: "useAssessmentResults",
    label: "Use assessment results",
    description: "Personalize analysis from quizzes, homework, and exams.",
  },
  {
    id: "useAttendance",
    label: "Use attendance",
    description: "Factor attendance into engagement insights.",
  },
  {
    id: "anonymizeStudentNames",
    label: "Anonymize student names",
    description: "Refer to students as Student A/B unless you name someone.",
  },
  {
    id: "persistGlobalMemory",
    label: "Remember my preferences",
    description: "Save lasting facts Cora learns across chats.",
  },
  {
    id: "persistThreadMemory",
    label: "Remember this conversation",
    description: "Keep thread notes so follow-ups stay in context.",
  },
]

const WORKSPACE_TOGGLES: Array<{
  id: keyof Pick<
    FacultyCoraPreferences,
    "showActionChips" | "showRelatedModules" | "confirmExpensiveTasks" | "preferLiteLookups"
  >
  label: string
  description: string
}> = [
  {
    id: "showActionChips",
    label: "Show follow-up action chips",
    description: "Offer Question Bank, quiz editor, and import shortcuts after replies.",
  },
  {
    id: "showRelatedModules",
    label: "Show related modules",
    description: "List matching faculty pages on each capability.",
  },
  {
    id: "confirmExpensiveTasks",
    label: "Confirm large credit tasks",
    description: "Ask before running high-credit generation jobs.",
  },
  {
    id: "preferLiteLookups",
    label: "Prefer Cora Lite for lookups",
    description: "Use cheap tools for status questions; save credits for authoring.",
  },
]

export function FacultyCoraPreferencesPanel() {
  const { soft } = useCoraContentPalette()
  const [prefs, setPrefs] = useState<FacultyCoraPreferences>(DEFAULT_FACULTY_CORA_PREFERENCES)

  useEffect(() => {
    setPrefs(loadFacultyCoraPreferences())
  }, [])

  const commit = (next: FacultyCoraPreferences) => {
    setPrefs(next)
    saveFacultyCoraPreferences(next)
  }

  const patch = (partial: Partial<FacultyCoraPreferences>) => {
    commit({ ...prefs, ...partial })
  }

  const toggleType = (id: keyof FacultyCoraQuestionTypes) => {
    const next = { ...prefs.questionTypes, [id]: !prefs.questionTypes[id] }
    if (!Object.values(next).some(Boolean)) next[id] = true
    patch({ questionTypes: next })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--cc-text-muted)]">
          Preferences
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-[var(--cc-text)]">
          How Cora Copilot should work with you
        </h2>
        <p className="text-sm text-[var(--cc-text-secondary)]">
          These settings shape every chat, draft, and confirmation card — not just follow-up chips.
        </p>
      </header>

      <section className="space-y-3">
        <SectionTitle
          title="When I ask Cora for help"
          hint="Cora still adapts to the request; this is the default stance."
        />
        <div className="grid gap-2 sm:grid-cols-2">
          {STANCE_OPTIONS.map((opt) => {
            const active = prefs.defaultStance === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => patch({ defaultStance: opt.id })}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-[var(--cc-accent)]/50 shadow-sm"
                    : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--cc-accent)]/30",
                )}
                style={active ? { backgroundColor: soft } : undefined}
              >
                <p className="text-sm font-semibold text-[var(--cc-text)]">{opt.label}</p>
                <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">{opt.description}</p>
              </button>
            )
          })}
        </div>
      </section>

      <Divider />

      <section className="space-y-4">
        <SectionTitle title="How Cora replies" hint="Length and tone for teaching work, not casual chat." />
        <Field label="Length">
          <Segmented options={LENGTH_OPTIONS} value={prefs.responseLength} onChange={(id) => patch({ responseLength: id })} />
        </Field>
        <Field label="Tone">
          <Segmented options={TONE_OPTIONS} value={prefs.tone} onChange={(id) => patch({ tone: id })} />
        </Field>
      </section>

      <Divider />

      <section className="space-y-3">
        <SectionTitle
          title="Before Cora writes to the course"
          hint="Controls confirmation cards for announcements, quizzes, and question-bank items."
        />
        <div className="grid gap-2">
          {WRITE_OPTIONS.map((opt) => {
            const active = prefs.writeConfirm === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => patch({ writeConfirm: opt.id })}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-[var(--cc-accent)]/50 shadow-sm"
                    : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--cc-accent)]/30",
                )}
                style={active ? { backgroundColor: soft } : undefined}
              >
                <p className="text-sm font-semibold text-[var(--cc-text)]">{opt.label}</p>
                <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">{opt.description}</p>
              </button>
            )
          })}
        </div>
      </section>

      <Divider />

      <section className="space-y-4">
        <SectionTitle
          title="Assessment authoring"
          hint="Defaults for quizzes, homework, and question-bank drafts."
        />
        <Field label="Default question count">
          <Segmented
            options={COUNT_OPTIONS}
            value={prefs.defaultQuestionCount}
            onChange={(id) => patch({ defaultQuestionCount: id })}
          />
        </Field>
        <Field label="Default difficulty">
          <Segmented
            options={DIFFICULTY_OPTIONS}
            value={prefs.defaultDifficulty}
            onChange={(id) => patch({ defaultDifficulty: id })}
          />
        </Field>
        <Field label="Bloom focus">
          <Segmented options={BLOOM_OPTIONS} value={prefs.bloomFocus} onChange={(id) => patch({ bloomFocus: id })} />
        </Field>
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--cc-text-muted)]">
            Question types
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {TYPE_OPTIONS.map((opt) => {
              const active = prefs.questionTypes[opt.id]
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleType(opt.id)}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-left transition-colors",
                    active
                      ? "border-[var(--cc-accent)]/50 shadow-sm"
                      : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--cc-accent)]/30",
                  )}
                  style={active ? { backgroundColor: soft } : undefined}
                >
                  <p className="text-sm font-semibold text-[var(--cc-text)]">{opt.label}</p>
                  <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">{opt.description}</p>
                </button>
              )
            })}
          </div>
        </div>
        <ToggleGroup
          items={AUTHORING_TOGGLES}
          values={prefs}
          onToggle={(id, checked) => patch({ [id]: checked })}
        />
      </section>

      <Divider />

      <section className="space-y-3">
        <SectionTitle
          title="Classroom actions"
          hint="How Cora offers announcements, automations, and lecture follow-ups."
        />
        <ToggleGroup
          items={CLASSROOM_TOGGLES}
          values={prefs}
          onToggle={(id, checked) => patch({ [id]: checked })}
        />
      </section>

      <Divider />

      <section className="space-y-3">
        <SectionTitle
          title="Context & memory"
          hint="What Cora may use from this course when answering."
        />
        <ToggleGroup
          items={CONTEXT_TOGGLES}
          values={prefs}
          onToggle={(id, checked) => patch({ [id]: checked })}
        />
      </section>

      <Divider />

      <section className="space-y-3">
        <SectionTitle
          title="Workspace & credits"
          hint="Chrome around chat and when Cora spends credits."
        />
        <ToggleGroup
          items={WORKSPACE_TOGGLES}
          values={prefs}
          onToggle={(id, checked) => patch({ [id]: checked })}
        />
      </section>

      <Divider />

      <section className="space-y-3">
        <SectionTitle
          title="AI & data"
          hint="Faculty Cora uses the same data minimization layer as student Cora before external model calls."
        />
        <p className="text-xs text-[var(--cc-text-muted)]">
          Prompts and aggregated course context may be sent to OpenAI or Anthropic. Student names, emails, IDs, and
          rosters are not forwarded to external models when identity is unnecessary.{" "}
          <a href="/ai-and-data" className="font-medium text-[var(--cc-accent-dark)] underline-offset-4 hover:underline">
            Read AI &amp; Data
          </a>
        </p>
      </section>

      <Button
        type="button"
        variant="outline"
        className="rounded-xl"
        onClick={() => commit({ ...DEFAULT_FACULTY_CORA_PREFERENCES })}
      >
        Reset to defaults
      </Button>
    </div>
  )
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--cc-text)]">{title}</h3>
      <p className="text-xs text-[var(--cc-text-muted)]">{hint}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--cc-text-muted)]">{label}</p>
      {children}
    </div>
  )
}

function Divider() {
  return <div className="h-px w-full bg-[var(--border)]" />
}

function ToggleGroup<K extends string>({
  items,
  values,
  onToggle,
}: {
  items: Array<{ id: K; label: string; description: string }>
  values: Record<K, boolean>
  onToggle: (id: K, checked: boolean) => void
}) {
  return (
    <div className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      {items.map((item) => (
        <div key={item.id} className="flex items-start justify-between gap-4 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--cc-text)]">{item.label}</p>
            <p className="text-xs text-[var(--cc-text-muted)]">{item.description}</p>
          </div>
          <Switch checked={values[item.id]} onCheckedChange={(checked) => onToggle(item.id, checked)} />
        </div>
      ))}
    </div>
  )
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: T; label: string }>
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/25 p-1">
      {options.map((opt) => (
        <button
          key={String(opt.id)}
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
