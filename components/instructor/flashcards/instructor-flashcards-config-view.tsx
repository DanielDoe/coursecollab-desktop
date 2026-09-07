"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import {
  FacultyIntegratedToolbar,
  facultyToolbarSelectTriggerClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { PORTAL_CARD, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { Loader2, ListChecks, Users } from "lucide-react"
import { toast } from "@/lib/app-toast"
import {
  DEFAULT_FLASHCARD_BATCH_SIZE,
  MAX_FLASHCARD_BATCH_SIZE,
  MIN_FLASHCARD_BATCH_SIZE,
} from "@/lib/flashcard-batch-study"
import {
  DEFAULT_FLASHCARD_DAILY_GOAL,
  DEFAULT_FLASHCARD_STUDY_POLICY,
  DEFAULT_FLASHCARD_TIMED_MODE_SECONDS,
  MAX_FLASHCARD_DAILY_GOAL,
  MAX_FLASHCARD_TIMED_MODE_SECONDS,
  MIN_FLASHCARD_DAILY_GOAL,
  MIN_FLASHCARD_TIMED_MODE_SECONDS,
  type FlashcardStudyPolicy,
} from "@/lib/flashcard-study-policy"
import { Input } from "@/components/ui/input"
import { Timer, Target, Shield } from "lucide-react"

type ConfigSection = {
  code: string
  studentCount: number
}

type ConfigTopic = {
  name: string
  deck_count: number
  card_count: number
  availability: Record<string, { is_available: boolean; configured: boolean }>
}

export function InstructorFlashcardsConfigView() {
  const chrome = facultyEmbedChrome("flashcards")
  const [loading, setLoading] = useState(true)
  const [sections, setSections] = useState<ConfigSection[]>([])
  const [topics, setTopics] = useState<ConfigTopic[]>([])
  const [requireMcqValidation, setRequireMcqValidation] = useState(true)
  const [cardsBeforeQuiz, setCardsBeforeQuiz] = useState(DEFAULT_FLASHCARD_BATCH_SIZE)
  const [savingMcqDefault, setSavingMcqDefault] = useState(false)
  const [savingBatchSize, setSavingBatchSize] = useState(false)
  const [dailyGoal, setDailyGoal] = useState(DEFAULT_FLASHCARD_DAILY_GOAL)
  const [timedModeSeconds, setTimedModeSeconds] = useState(DEFAULT_FLASHCARD_TIMED_MODE_SECONDS)
  const [studyPolicy, setStudyPolicy] = useState<FlashcardStudyPolicy>({
    ...DEFAULT_FLASHCARD_STUDY_POLICY,
  })
  const [savingStudyDefaults, setSavingStudyDefaults] = useState(false)
  const [savingTierPolicy, setSavingTierPolicy] = useState(false)
  const [search, setSearch] = useState("")
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "visible" | "hidden">("all")

  const headers = () =>
    buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" })

  const loadConfiguration = useCallback(async () => {
    setLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/flashcards/configuration", { headers: headers() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load configuration")
      setSections(data.sections || [])
      setTopics(data.topics || [])
      setRequireMcqValidation(data.requireMcqValidation !== false)
      setCardsBeforeQuiz(Number(data.cardsBeforeQuiz) || DEFAULT_FLASHCARD_BATCH_SIZE)
      setDailyGoal(Number(data.dailyGoal) || DEFAULT_FLASHCARD_DAILY_GOAL)
      setTimedModeSeconds(Number(data.timedModeSeconds) || DEFAULT_FLASHCARD_TIMED_MODE_SECONDS)
      setStudyPolicy({ ...DEFAULT_FLASHCARD_STUDY_POLICY, ...(data.studyPolicy || {}) })
    } catch (err: unknown) {
      toast.error("Could not load card configuration", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConfiguration()
  }, [loadConfiguration])

  const toggleTopic = async (topicName: string, sessionCode: string, currentValue: boolean) => {
    try {
      const res = await instructorApiFetch("/api/instructor/flashcards/topics/toggle", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          topicName,
          session: sessionCode,
          isAvailable: !currentValue,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Toggle failed")
      }
      await loadConfiguration()
      const label = sessionCode === "ALL" ? "all sections" : sessionCode
      toast.success(
        !currentValue
          ? `"${topicName}" enabled for ${label}`
          : `"${topicName}" hidden from ${label}`,
      )
    } catch (err: unknown) {
      toast.error("Could not update availability", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  const toggleCourseMcqDefault = async (next: boolean) => {
    setSavingMcqDefault(true)
    try {
      const res = await instructorApiFetch("/api/instructor/flashcards/configuration", {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ requireMcqValidation: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Update failed")
      setRequireMcqValidation(Boolean(data.requireMcqValidation))
      toast.success(next ? "New decks will require quiz checks" : "New decks will use flip-only mode")
    } catch (err: unknown) {
      toast.error("Could not update quiz default", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSavingMcqDefault(false)
    }
  }

  const saveCourseBatchSize = async (next: number) => {
    setSavingBatchSize(true)
    try {
      const res = await instructorApiFetch("/api/instructor/flashcards/configuration", {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ cardsBeforeQuiz: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Update failed")
      setCardsBeforeQuiz(Number(data.cardsBeforeQuiz) || DEFAULT_FLASHCARD_BATCH_SIZE)
      toast.success("Default batch size updated for new decks")
    } catch (err: unknown) {
      toast.error("Could not update batch size", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSavingBatchSize(false)
    }
  }

  const saveStudyDefaults = async () => {
    setSavingStudyDefaults(true)
    try {
      const res = await instructorApiFetch("/api/instructor/flashcards/configuration", {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ dailyGoal, timedModeSeconds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Update failed")
      setDailyGoal(Number(data.dailyGoal) || dailyGoal)
      setTimedModeSeconds(Number(data.timedModeSeconds) || timedModeSeconds)
      toast.success("Study experience defaults updated")
    } catch (err: unknown) {
      toast.error("Could not save study defaults", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSavingStudyDefaults(false)
    }
  }

  const saveTierPolicy = async () => {
    setSavingTierPolicy(true)
    try {
      const res = await instructorApiFetch("/api/instructor/flashcards/configuration", {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ studyPolicy }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Update failed")
      setStudyPolicy({ ...DEFAULT_FLASHCARD_STUDY_POLICY, ...(data.studyPolicy || {}) })
      toast.success("Membership tier limits updated")
    } catch (err: unknown) {
      toast.error("Could not save tier limits", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSavingTierPolicy(false)
    }
  }

  const sectionKeys = useMemo(
    () => ["ALL", ...[...new Set(sections.map((s) => s.code))]],
    [sections],
  )

  const filteredTopics = useMemo(() => {
    const term = search.trim().toLowerCase()
    return topics.filter((topic) => {
      if (term && !topic.name.toLowerCase().includes(term)) return false
      if (visibilityFilter === "all") return true
      const allVisible = topic.availability.ALL?.is_available ?? true
      return visibilityFilter === "visible" ? allVisible : !allVisible
    })
  }, [topics, search, visibilityFilter])

  return (
    <div className="space-y-3 min-w-0">
      <div className={cn(PORTAL_CARD, "space-y-3 p-4 sm:p-5")}>
        <p className="text-xs text-muted-foreground">Defaults for newly created decks</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex h-9 items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3">
            <div className="flex min-w-0 items-center gap-2">
              <ListChecks className={cn("h-3.5 w-3.5 shrink-0", chrome.p.iconText)} />
              <span className="truncate text-sm">Require quiz check</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {savingMcqDefault ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
              <Switch
                checked={requireMcqValidation}
                disabled={savingMcqDefault}
                onCheckedChange={(v) => void toggleCourseMcqDefault(v)}
                aria-label="Course default require quiz check"
              />
            </div>
          </div>

          {requireMcqValidation ? (
            <div className="flex h-9 items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3">
              <Label htmlFor="course-cards-before-quiz" className="shrink-0 text-sm font-normal">
                Cards before quiz
              </Label>
              <div className="relative flex items-center">
                {savingBatchSize ? (
                  <Loader2 className="absolute -left-5 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : null}
                <Input
                  id="course-cards-before-quiz"
                  type="number"
                  min={MIN_FLASHCARD_BATCH_SIZE}
                  max={MAX_FLASHCARD_BATCH_SIZE}
                  value={cardsBeforeQuiz}
                  disabled={savingBatchSize}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10)
                    if (!Number.isFinite(n)) return
                    const clamped = Math.min(
                      MAX_FLASHCARD_BATCH_SIZE,
                      Math.max(MIN_FLASHCARD_BATCH_SIZE, n),
                    )
                    setCardsBeforeQuiz(clamped)
                  }}
                  onBlur={() => void saveCourseBatchSize(cardsBeforeQuiz)}
                  className="h-7 w-16 border-0 bg-transparent px-0 text-right tabular-nums shadow-none focus-visible:ring-0"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className={cn(PORTAL_CARD, "space-y-3 p-4 sm:p-5")}>
        <p className="text-xs text-muted-foreground">Student study experience</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex h-9 items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3">
            <div className="flex min-w-0 items-center gap-2">
              <Target className={cn("h-3.5 w-3.5 shrink-0", chrome.p.iconText)} />
              <Label htmlFor="daily-goal" className="truncate text-sm font-normal">
                Daily goal (cards)
              </Label>
            </div>
            <Input
              id="daily-goal"
              type="number"
              min={MIN_FLASHCARD_DAILY_GOAL}
              max={MAX_FLASHCARD_DAILY_GOAL}
              value={dailyGoal}
              disabled={savingStudyDefaults}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10)
                if (!Number.isFinite(n)) return
                setDailyGoal(Math.min(MAX_FLASHCARD_DAILY_GOAL, Math.max(MIN_FLASHCARD_DAILY_GOAL, n)))
              }}
              onBlur={() => void saveStudyDefaults()}
              className="h-7 w-16 border-0 bg-transparent px-0 text-right tabular-nums shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex h-9 items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3">
            <div className="flex min-w-0 items-center gap-2">
              <Timer className={cn("h-3.5 w-3.5 shrink-0", chrome.p.iconText)} />
              <Label htmlFor="timed-seconds" className="truncate text-sm font-normal">
                Timed mode (seconds)
              </Label>
            </div>
            <Input
              id="timed-seconds"
              type="number"
              min={MIN_FLASHCARD_TIMED_MODE_SECONDS}
              max={MAX_FLASHCARD_TIMED_MODE_SECONDS}
              value={timedModeSeconds}
              disabled={savingStudyDefaults}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10)
                if (!Number.isFinite(n)) return
                setTimedModeSeconds(
                  Math.min(MAX_FLASHCARD_TIMED_MODE_SECONDS, Math.max(MIN_FLASHCARD_TIMED_MODE_SECONDS, n)),
                )
              }}
              onBlur={() => void saveStudyDefaults()}
              className="h-7 w-16 border-0 bg-transparent px-0 text-right tabular-nums shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
      </div>

      <div className={cn(PORTAL_CARD, "space-y-3 p-4 sm:p-5")}>
        <div className="flex items-center gap-2">
          <Shield className={cn("h-3.5 w-3.5", chrome.p.iconText)} />
          <p className="text-xs text-muted-foreground">Membership tier limits (course decks)</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TierPolicyField
            label="Scholar deck access"
            hint="0 = blocked, 0.5 = half the deck"
            value={Math.round(studyPolicy.scholar_unlock_fraction * 100)}
            suffix="%"
            disabled={savingTierPolicy}
            onChange={(pct) =>
              setStudyPolicy((p) => ({ ...p, scholar_unlock_fraction: pct / 100 }))
            }
            onBlur={() => void saveTierPolicy()}
          />
          <TierPolicyField
            label="Explorer deck access"
            hint="Fraction of cards unlocked"
            value={Math.round(studyPolicy.explorer_unlock_fraction * 100)}
            suffix="%"
            disabled={savingTierPolicy}
            onChange={(pct) =>
              setStudyPolicy((p) => ({ ...p, explorer_unlock_fraction: pct / 100 }))
            }
            onBlur={() => void saveTierPolicy()}
          />
          <TierPolicyField
            label="Scholar daily cap"
            hint="-1 for unlimited"
            value={studyPolicy.scholar_daily_card_cap}
            disabled={savingTierPolicy}
            onChange={(n) => setStudyPolicy((p) => ({ ...p, scholar_daily_card_cap: n }))}
            onBlur={() => void saveTierPolicy()}
          />
          <TierPolicyField
            label="Explorer daily cap"
            hint="-1 for unlimited"
            value={studyPolicy.explorer_daily_card_cap}
            disabled={savingTierPolicy}
            onChange={(n) => setStudyPolicy((p) => ({ ...p, explorer_daily_card_cap: n }))}
            onBlur={() => void saveTierPolicy()}
          />
          <TierPolicyField
            label="Trailblazer daily cap"
            hint="-1 for unlimited"
            value={studyPolicy.trailblazer_daily_card_cap}
            disabled={savingTierPolicy}
            onChange={(n) => setStudyPolicy((p) => ({ ...p, trailblazer_daily_card_cap: n }))}
            onBlur={() => void saveTierPolicy()}
          />
        </div>
      </div>

      <FacultyIntegratedToolbar
        moduleId="flashcards"
        search={search}
        onSearchChange={setSearch}
        onSearchClear={() => setSearch("")}
        searchPlaceholder="Search topics…"
        filters={
          <Select
            value={visibilityFilter}
            onValueChange={(v) => setVisibilityFilter(v as typeof visibilityFilter)}
          >
            <SelectTrigger className={facultyToolbarSelectTriggerClass(visibilityFilter !== "all")}>
              <SelectValue placeholder="Visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All topics</SelectItem>
              <SelectItem value="visible">Visible</SelectItem>
              <SelectItem value="hidden">Hidden</SelectItem>
            </SelectContent>
          </Select>
        }
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {filteredTopics.length} topic{filteredTopics.length === 1 ? "" : "s"} · {sections.length} section
            {sections.length === 1 ? "" : "s"}
          </p>
        }
      />

      {loading ? (
        <div className={cn(PORTAL_CARD, "flex min-h-[200px] items-center justify-center")}>
          <Loader2 className={cn("h-6 w-6 animate-spin", chrome.p.iconText)} />
        </div>
      ) : filteredTopics.length === 0 ? (
        <div className={cn(PORTAL_CARD, "rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground")}>
          {topics.length === 0
            ? "Add decks with topics first — section access controls appear here once topics exist."
            : "No topics match your search."}
        </div>
      ) : sections.length === 0 ? (
        <div className="space-y-3">
          <div className={cn(PORTAL_CARD, "rounded-xl border border-dashed border-amber-200/80 bg-amber-50/40 px-4 py-4 text-sm text-amber-900 dark:border-amber-500/25 dark:bg-amber-950/20 dark:text-amber-200")}>
            No academic sections found. Add sections under Course → Academic Terms.
          </div>
          {filteredTopics.map((topic) => (
            <TopicSectionRow
              key={topic.name}
              topic={topic}
              sectionKeys={["ALL"]}
              sections={[]}
              onToggle={toggleTopic}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTopics.map((topic) => (
            <TopicSectionRow
              key={topic.name}
              topic={topic}
              sectionKeys={sectionKeys}
              sections={sections}
              onToggle={toggleTopic}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TierPolicyField({
  label,
  hint,
  value,
  suffix,
  disabled,
  onChange,
  onBlur,
}: {
  label: string
  hint: string
  value: number
  suffix?: string
  disabled?: boolean
  onChange: (value: number) => void
  onBlur: () => void
}) {
  return (
    <div className="space-y-1 rounded-md border border-[var(--border)] px-3 py-2.5">
      <Label className="text-sm font-normal">{label}</Label>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value, 10)
            if (!Number.isFinite(n)) return
            onChange(n)
          }}
          onBlur={onBlur}
          className="h-8"
        />
        {suffix ? <span className="text-xs text-muted-foreground shrink-0">{suffix}</span> : null}
      </div>
    </div>
  )
}

function TopicSectionRow({
  topic,
  sectionKeys,
  sections,
  onToggle,
}: {
  topic: ConfigTopic
  sectionKeys: string[]
  sections: ConfigSection[]
  onToggle: (topicName: string, sessionCode: string, currentValue: boolean) => void
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--sidebar-accent)]/20 px-3 py-2.5">
        <p className="font-medium text-sm flex-1 min-w-0">{topic.name}</p>
        <Badge variant="secondary" className="text-[10px] font-normal">
          {topic.deck_count} decks
        </Badge>
        <Badge variant="outline" className="text-[10px] font-normal">
          {topic.card_count} cards
        </Badge>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {sectionKeys.map((code, index) => {
          const avail = topic.availability[code]
          const isAvailable = avail?.is_available ?? true
          const sectionMeta = sections.find((s) => s.code === code)
          const isAll = code === "ALL"

          return (
            <div
              key={`${topic.name}-${code}-${index}`}
              className={cn(
                "flex flex-wrap items-center gap-3 px-3 py-2.5",
                !isAvailable && "bg-[var(--sidebar-accent)]/10",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{isAll ? "All sections" : code}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isAll
                    ? "Course-wide default for this topic"
                    : sectionMeta
                      ? `${sectionMeta.studentCount} student${sectionMeta.studentCount === 1 ? "" : "s"}`
                      : "Section cohort"}
                </p>
              </div>
              {!isAll && sectionMeta ? (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                  <Users className="h-3 w-3" />
                  {sectionMeta.studentCount}
                </span>
              ) : null}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground w-12 text-right">
                  {isAvailable ? "On" : "Off"}
                </span>
                <Switch
                  checked={isAvailable}
                  onCheckedChange={() => void onToggle(topic.name, code, isAvailable)}
                  aria-label={`${topic.name} for ${isAll ? "all sections" : code}`}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
