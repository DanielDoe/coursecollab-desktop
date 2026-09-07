"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  InstructorPolicySurfaceCard,
  InstructorPolicyToggleRow,
} from "@/components/instructor/InstructorPolicySurfaceCard"
import { facultyToolbarFilterButtonClass } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { FACULTY_CORA_CAPABILITIES } from "@/lib/cora/faculty-capabilities"
import { FACULTY_CORA_NAV_LABEL, FACULTY_CORA_TAGLINE } from "@/lib/cora/constants"
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
import { portalListStripe } from "@/lib/portal-module-themes"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { CoraSectionTools } from "@/components/instructor/administration/CoraSectionTools"

const STANCE: Array<{ id: FacultyCoraStance; label: string; hint: string }> = [
  { id: "draft", label: "Draft first", hint: "Prepare materials immediately" },
  { id: "confirm", label: "Confirm first", hint: "Cards before anything publishes" },
  { id: "analyze", label: "Analyze first", hint: "Inspect course data, then act" },
  { id: "explain", label: "Explain first", hint: "Clarify, then offer a next step" },
]

const LENGTH: Array<{ id: FacultyCoraLength; label: string }> = [
  { id: "concise", label: "Concise" },
  { id: "standard", label: "Standard" },
  { id: "thorough", label: "Thorough" },
]

const TONE: Array<{ id: FacultyCoraTone; label: string }> = [
  { id: "professional", label: "Professional" },
  { id: "collegial", label: "Collegial" },
  { id: "direct", label: "Direct" },
]

const WRITES: Array<{ id: FacultyCoraWriteConfirm; label: string; hint: string }> = [
  { id: "always", label: "Always confirm", hint: "Show a Confirm card before every create, publish, or send" },
  { id: "publish_only", label: "Publishes only", hint: "Prefer cards for publish/send. The server still requires Confirm for student-visible writes." },
  { id: "drafts_ok", label: "Drafts freely", hint: "Cora may draft quietly. Publish, send, and create still require Confirm." },
]

const COUNTS: FacultyCoraQuestionCount[] = [4, 6, 8, 10, 12]
const DIFFICULTY: FacultyCoraDifficulty[] = ["easy", "medium", "hard", "mixed"]
const BLOOM: FacultyCoraBloom[] = ["remember", "apply", "analyze", "mixed"]

const TYPES: Array<{ id: keyof FacultyCoraQuestionTypes; label: string; hint: string }> = [
  { id: "mcq", label: "Multiple choice", hint: "Single-answer MCQ" },
  { id: "trueFalse", label: "True / false", hint: "Binary checks" },
  { id: "selectAll", label: "Select all", hint: "Multi-select" },
  { id: "fillBlank", label: "Fill in the blank", hint: "Short completion" },
  { id: "freeResponse", label: "Free response", hint: "Worked or written" },
  { id: "code", label: "Code problems", hint: "Trace, debug, and write-code items" },
  { id: "codeWrite", label: "Write code", hint: "Students write a program" },
  { id: "multiPart", label: "Multi-part", hint: "Linked sub-questions" },
  { id: "circuit", label: "Circuit submission", hint: "Circuit analysis or schematic" },
]

const AUTHORING: Array<{
  id: keyof Pick<
    FacultyCoraPreferences,
    "suggestQuestionDrafts" | "includeSolutions" | "includeRubrics" | "preferCourseTopics"
  >
  label: string
  hint: string
}> = [
  { id: "suggestQuestionDrafts", label: "Suggest question-bank drafts", hint: "Action chips when you ask Cora to generate assessments." },
  { id: "includeSolutions", label: "Include solutions", hint: "Attach expected answers to generated items." },
  { id: "includeRubrics", label: "Include rubrics", hint: "Short scoring notes on free-response drafts." },
  { id: "preferCourseTopics", label: "Prefer existing course topics", hint: "Reuse bank and lecture topics instead of inventing new ones." },
]

const CLASSROOM: Array<{
  id: keyof Pick<
    FacultyCoraPreferences,
    "suggestAutomations" | "autoProposeAnnouncements" | "mentionOfficeHours" | "suggestFlashcardsAfterLecture"
  >
  label: string
  hint: string
}> = [
  { id: "suggestAutomations", label: "Suggest automations", hint: "Weekly announcements or scheduled follow-ups." },
  { id: "autoProposeAnnouncements", label: "Auto-propose announcements", hint: "Prepare a confirmation card as soon as you ask to notify the class." },
  { id: "mentionOfficeHours", label: "Mention office hours", hint: "Include office hours in class communications when relevant." },
  { id: "suggestFlashcardsAfterLecture", label: "Post-lecture flashcards", hint: "Offer flashcards after lecture or notes work." },
]

const CONTEXT: Array<{
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
  hint: string
}> = [
  { id: "rememberCourseFocus", label: "Remember course focus", hint: "Keep recent teaching topics handy for follow-up chats." },
  { id: "useStudentCoraChats", label: "Use student Cora chats", hint: "Surface struggle topics from Cora Assistant questions." },
  { id: "useAssessmentResults", label: "Use assessment results", hint: "Personalize analysis from quizzes, homework, and exams." },
  { id: "useAttendance", label: "Use attendance", hint: "Factor attendance into engagement insights." },
  { id: "anonymizeStudentNames", label: "Anonymize student names", hint: "Refer to students as Student A/B unless you name someone." },
  { id: "persistGlobalMemory", label: "Remember my preferences", hint: "Save lasting facts Cora learns across chats." },
  { id: "persistThreadMemory", label: "Remember this conversation", hint: "Keep thread notes so follow-ups stay in context." },
]

function ChipRow<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: T; label: string }>
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <Button
          key={String(option.id)}
          type="button"
          variant="ghost"
          className={cn(facultyToolbarFilterButtonClass(value === option.id), "h-8 px-3")}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

export function FacultyCoraCopilotSettings({ searchQuery = "" }: { searchQuery?: string }) {
  const chrome = facultyEmbedChrome("ai-assistant-settings")
  const [prefs, setPrefs] = useState<FacultyCoraPreferences>(DEFAULT_FACULTY_CORA_PREFERENCES)
  const [filter, setFilter] = useState(searchQuery)

  useEffect(() => {
    setPrefs(loadFacultyCoraPreferences())
  }, [])

  const commit = (next: FacultyCoraPreferences) => {
    setPrefs(next)
    saveFacultyCoraPreferences(next)
  }

  const q = filter.trim().toLowerCase()
  const match = (label: string, hint?: string) =>
    !q || label.toLowerCase().includes(q) || (hint?.toLowerCase().includes(q) ?? false)

  const authoring = AUTHORING.filter((item) => match(item.label, item.hint))
  const classroom = CLASSROOM.filter((item) => match(item.label, item.hint))
  const context = CONTEXT.filter((item) => match(item.label, item.hint))
  const types = TYPES.filter((item) => match(item.label, item.hint))
  const capabilities = useMemo(
    () =>
      FACULTY_CORA_CAPABILITIES.filter(
        (cap) =>
          !q ||
          cap.title.toLowerCase().includes(q) ||
          cap.tagline.toLowerCase().includes(q) ||
          cap.description.toLowerCase().includes(q),
      ),
    [q],
  )

  const showVoice =
    !q || ["stance", "tone", "length", "confirm", "draft", "voice", "copilot"].some((term) => q.includes(term))
  const showAuthoring =
    !q ||
    authoring.length > 0 ||
    types.length > 0 ||
    ["question", "bloom", "difficulty", "draft"].some((term) => q.includes(term))

  return (
    <div className="space-y-4">
      <CoraSectionTools
        search={filter}
        onSearchChange={setFilter}
        searchPlaceholder="Filter Cora Copilot settings…"
        meta="Changes save as you edit"
      />
      <InstructorPolicySurfaceCard
        variant="section"
        title={FACULTY_CORA_NAV_LABEL}
        description={`${FACULTY_CORA_TAGLINE}. These are the same preferences Cora Copilot uses when you chat.`}
      >
        {showVoice ? (
          <div className="divide-y divide-[var(--border)]">
            <div className="space-y-2 py-3 first:pt-0">
              <p className={cn("text-sm font-medium", PORTAL_TEXT)}>Default stance</p>
              <ChipRow
                options={STANCE.map((s) => ({ id: s.id, label: s.label }))}
                value={prefs.defaultStance}
                onChange={(defaultStance) => commit({ ...prefs, defaultStance })}
              />
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                {STANCE.find((s) => s.id === prefs.defaultStance)?.hint}
              </p>
            </div>
            <div className="space-y-2 py-3">
              <p className={cn("text-sm font-medium", PORTAL_TEXT)}>Response length</p>
              <ChipRow
                options={LENGTH}
                value={prefs.responseLength}
                onChange={(responseLength) => commit({ ...prefs, responseLength })}
              />
            </div>
            <div className="space-y-2 py-3">
              <p className={cn("text-sm font-medium", PORTAL_TEXT)}>Tone</p>
              <ChipRow options={TONE} value={prefs.tone} onChange={(tone) => commit({ ...prefs, tone })} />
            </div>
            <div className="space-y-2 py-3 last:pb-0">
              <p className={cn("text-sm font-medium", PORTAL_TEXT)}>Write confirmation</p>
              <ChipRow
                options={WRITES.map((w) => ({ id: w.id, label: w.label }))}
                value={prefs.writeConfirm}
                onChange={(writeConfirm) => commit({ ...prefs, writeConfirm })}
              />
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                {WRITES.find((w) => w.id === prefs.writeConfirm)?.hint}
              </p>
            </div>
          </div>
        ) : null}
      </InstructorPolicySurfaceCard>

      {showAuthoring ? (
        <InstructorPolicySurfaceCard
          variant="section"
          title="Assessment drafts"
          description="Defaults Cora Copilot uses when generating question-bank items."
        >
          <div className="space-y-3">
            <div className="space-y-2">
              <p className={cn("text-sm font-medium", PORTAL_TEXT)}>Question count</p>
              <ChipRow
                options={COUNTS.map((id) => ({ id, label: String(id) }))}
                value={prefs.defaultQuestionCount}
                onChange={(defaultQuestionCount) => commit({ ...prefs, defaultQuestionCount })}
              />
            </div>
            <div className="space-y-2">
              <p className={cn("text-sm font-medium", PORTAL_TEXT)}>Difficulty</p>
              <ChipRow
                options={DIFFICULTY.map((id) => ({ id, label: id[0]!.toUpperCase() + id.slice(1) }))}
                value={prefs.defaultDifficulty}
                onChange={(defaultDifficulty) => commit({ ...prefs, defaultDifficulty })}
              />
            </div>
            <div className="space-y-2">
              <p className={cn("text-sm font-medium", PORTAL_TEXT)}>Bloom focus</p>
              <ChipRow
                options={BLOOM.map((id) => ({ id, label: id[0]!.toUpperCase() + id.slice(1) }))}
                value={prefs.bloomFocus}
                onChange={(bloomFocus) => commit({ ...prefs, bloomFocus })}
              />
            </div>
          </div>
          {types.length > 0 ? (
            <div className="mt-3 divide-y divide-[var(--border)]">
              {types.map((item) => (
                <InstructorPolicyToggleRow
                  key={item.id}
                  label={item.label}
                  hint={item.hint}
                  checked={prefs.questionTypes[item.id]}
                  switchClass={chrome.switchChecked}
                  onCheckedChange={(checked) =>
                    commit({
                      ...prefs,
                      questionTypes: { ...prefs.questionTypes, [item.id]: checked },
                    })
                  }
                />
              ))}
            </div>
          ) : null}
          {authoring.length > 0 ? (
            <div className="mt-1 divide-y divide-[var(--border)]">
              {authoring.map((item) => (
                <InstructorPolicyToggleRow
                  key={item.id}
                  label={item.label}
                  hint={item.hint}
                  checked={prefs[item.id]}
                  switchClass={chrome.switchChecked}
                  onCheckedChange={(checked) => commit({ ...prefs, [item.id]: checked })}
                />
              ))}
            </div>
          ) : null}
        </InstructorPolicySurfaceCard>
      ) : null}

      {classroom.length > 0 ? (
        <InstructorPolicySurfaceCard
          variant="section"
          title="Classroom automations"
          description="What Cora Copilot offers after lectures, results, or a request to notify the class."
        >
          <div className="divide-y divide-[var(--border)]">
            {classroom.map((item) => (
              <InstructorPolicyToggleRow
                key={item.id}
                label={item.label}
                hint={item.hint}
                checked={prefs[item.id]}
                switchClass={chrome.switchChecked}
                onCheckedChange={(checked) => commit({ ...prefs, [item.id]: checked })}
              />
            ))}
          </div>
        </InstructorPolicySurfaceCard>
      ) : null}

      {context.length > 0 ? (
        <InstructorPolicySurfaceCard
          variant="section"
          title="Course context"
          description="Which student Cora and course signals the copilot may read."
        >
          <div className="divide-y divide-[var(--border)]">
            {context.map((item) => (
              <InstructorPolicyToggleRow
                key={item.id}
                label={item.label}
                hint={item.hint}
                checked={prefs[item.id]}
                switchClass={chrome.switchChecked}
                onCheckedChange={(checked) => commit({ ...prefs, [item.id]: checked })}
              />
            ))}
          </div>
        </InstructorPolicySurfaceCard>
      ) : null}

      {capabilities.length > 0 ? (
        <InstructorPolicySurfaceCard
          variant="section"
          title="What Cora Copilot can do"
          description="Teaching actions available in the faculty copilot — never billing, membership, or platform admin."
        >
          <div className="divide-y divide-[var(--border)]">
            {capabilities.map((cap, index) => {
              const stripe = portalListStripe(index, "amber")
              const Icon = cap.icon
              return (
                <div key={cap.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                      stripe.iconBg,
                      stripe.iconText,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{cap.title}</p>
                    <p className={cn("mt-0.5 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
                      {cap.tagline}. {cap.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </InstructorPolicySurfaceCard>
      ) : null}
    </div>
  )
}
