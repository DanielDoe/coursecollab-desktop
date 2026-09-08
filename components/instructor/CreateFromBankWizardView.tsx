"use client"

import type { Dispatch, SetStateAction } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  ListChecks,
  Shuffle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  AM_LIST_ROW,
  AM_PANEL,
  AM_STAT_BOX,
  PORTAL_CARD,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/assessments/assessment-management-surface-classes"
import type { FacultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalListStripe } from "@/lib/portal-module-themes"

type Question = {
  id: number
  question_text: string
  question_type: string
  difficulty: string
  topic: string | null
}

type StepDef = {
  number: number
  title: string
  icon: LucideIcon
  description: string
}

export type CreateFromBankWizardViewProps = {
  isEmbedded: boolean
  chrome: FacultyEmbedChrome | null
  assessmentLabel: string
  steps: StepDef[]
  currentStep: number
  setCurrentStep: (step: number) => void
  quizData: {
    title: string
    description: string
    time_limit: number
    available_from: string
    available_until: string
  }
  setQuizData: Dispatch<
    SetStateAction<{
      title: string
      description: string
      time_limit: number
      available_from: string
      available_until: string
    }>
  >
  questions: Question[]
  filteredQuestions: Question[]
  questionsLoading: boolean
  selectedQuestions: number[]
  selectionMode: "random" | "manual"
  setSelectionMode: (mode: "random" | "manual") => void
  randomConfig: { count: number; difficulty: string; topic: string; question_types: string[] }
  setRandomConfig: Dispatch<
    SetStateAction<{ count: number; difficulty: string; topic: string; question_types: string[] }>
  >
  manualFilters: { difficulty: string; topic: string; question_types: string[] }
  setManualFilters: Dispatch<
    SetStateAction<{ difficulty: string; topic: string; question_types: string[] }>
  >
  uniqueTopics: (string | null)[]
  creating: boolean
  canProceedToStep2: boolean
  canProceedToStep3: boolean
  onRandomSelect: () => void
  onSubmit: () => void
  onToggleQuestion: (id: number) => void
  onSelectAll: () => void
  onClearSelection: () => void
  primaryBtn: string
  successBtn: string
  quietBtn: string
  eLabel: string
  eInput: string
  eTextarea: string
  tabListClass: string
  tabTriggerClass: string
  stepCard: string
}

function SummaryStat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: LucideIcon
}) {
  return (
    <div className={AM_STAT_BOX}>
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--cc-accent)]/10 text-[var(--cc-accent)]")}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className={cn("text-[10px] font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>{label}</p>
        <p className={cn("text-lg font-semibold tabular-nums", PORTAL_TEXT)}>{value}</p>
      </div>
    </div>
  )
}

export function CreateFromBankWizardView(props: CreateFromBankWizardViewProps) {
  const {
    isEmbedded,
    chrome,
    assessmentLabel,
    steps,
    currentStep,
    setCurrentStep,
    quizData,
    setQuizData,
    questions,
    filteredQuestions,
    questionsLoading,
    selectedQuestions,
    selectionMode,
    setSelectionMode,
    randomConfig,
    setRandomConfig,
    manualFilters,
    setManualFilters,
    uniqueTopics,
    creating,
    canProceedToStep2,
    canProceedToStep3,
    onRandomSelect,
    onSubmit,
    onToggleQuestion,
    onSelectAll,
    onClearSelection,
    primaryBtn,
    successBtn,
    quietBtn,
    eLabel,
    eInput,
    eTextarea,
    tabListClass,
    tabTriggerClass,
    stepCard,
  } = props

  const workflowSteps = steps.slice(0, 3)
  const activeStep = steps[currentStep - 1]

  const renderQuestionPicker = (embeddedList: boolean) => (
    <>
      {selectionMode === "random" ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label className={eLabel}>Count</Label>
              <Input
                type="number"
                min="1"
                max={questions.length}
                value={randomConfig.count}
                onChange={(e) => setRandomConfig({ ...randomConfig, count: Number.parseInt(e.target.value) || 1 })}
                className={embeddedList ? cn(eInput, "h-11") : "h-11 border-slate-200 rounded-xl"}
              />
            </div>
            <div className="space-y-2">
              <Label className={eLabel}>Difficulty</Label>
              <Select value={randomConfig.difficulty} onValueChange={(value) => setRandomConfig({ ...randomConfig, difficulty: value })}>
                <SelectTrigger className={embeddedList ? cn(eInput, "h-11 w-full") : "h-11 border-slate-200 rounded-xl"}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label className={eLabel}>Topic</Label>
              <Select value={randomConfig.topic} onValueChange={(value) => setRandomConfig({ ...randomConfig, topic: value })}>
                <SelectTrigger className={embeddedList ? cn(eInput, "h-11 w-full") : "h-11 border-slate-200 rounded-xl"}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All topics</SelectItem>
                  {uniqueTopics.map((topic) => (
                    <SelectItem key={topic} value={topic!}>
                      {topic}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={onRandomSelect} className={cn("w-full sm:w-auto", primaryBtn)}>
            <Shuffle className="mr-2 h-4 w-4" />
            Generate random set
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={cn(embeddedList ? AM_PANEL : "rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-6")}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label className={eLabel}>Difficulty</Label>
                <Select value={manualFilters.difficulty} onValueChange={(value) => setManualFilters({ ...manualFilters, difficulty: value })}>
                  <SelectTrigger className={embeddedList ? cn(eInput, "h-10 w-full") : "h-11 rounded-xl border-slate-200 bg-white"}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className={eLabel}>Topic</Label>
                <Select value={manualFilters.topic} onValueChange={(value) => setManualFilters({ ...manualFilters, topic: value })}>
                  <SelectTrigger className={embeddedList ? cn(eInput, "h-10 w-full") : "h-11 rounded-xl border-slate-200 bg-white"}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All topics</SelectItem>
                    {uniqueTopics.map((topic) => (
                      <SelectItem key={topic} value={topic!}>
                        {topic}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end sm:col-span-2 lg:col-span-1">
                <Button onClick={onSelectAll} className={cn("h-10 w-full", primaryBtn)}>
                  Select all filtered
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-1 lg:items-end">
                <Badge variant="outline">{filteredQuestions.length} match</Badge>
                {selectedQuestions.length > 0 ? (
                  <Badge className={embeddedList && chrome ? cn(chrome.solid, "border-0") : ""}>{selectedQuestions.length} picked</Badge>
                ) : null}
              </div>
            </div>
          </div>

          {embeddedList && chrome ? (
            <div className={cn(PORTAL_CARD, "overflow-hidden")}>
              <div className="max-h-[min(420px,50vh)] divide-y divide-[var(--border)] overflow-y-auto">
                {filteredQuestions.length === 0 ? (
                  <div className="py-12 text-center">
                    <ListChecks className="mx-auto mb-2 h-8 w-8 opacity-40 text-[var(--cc-text-muted)]" />
                    <p className={cn("text-sm font-medium", PORTAL_TEXT)}>No questions match</p>
                  </div>
                ) : (
                  filteredQuestions.map((question, index) => {
                    const selected = selectedQuestions.includes(question.id)
                    const stripe = portalListStripe(index, chrome.theme.family)
                    return (
                      <div
                        key={question.id}
                        className={cn(AM_LIST_ROW, "cursor-pointer gap-3", selected && "bg-[var(--cc-accent)]/5")}
                        onClick={() => onToggleQuestion(question.id)}
                      >
                        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold", stripe.iconBg, stripe.iconText)}>
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <p className={cn("line-clamp-2 text-sm font-medium", PORTAL_TEXT)}>{question.question_text}</p>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {question.difficulty}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {question.question_type}
                            </Badge>
                          </div>
                        </div>
                        <Checkbox checked={selected} className="shrink-0" />
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="max-h-[450px] space-y-3 overflow-y-auto pr-1">
              {filteredQuestions.map((question, index) => (
                <Card
                  key={question.id}
                  className={cn(
                    "cursor-pointer border-2 transition-all",
                    selectedQuestions.includes(question.id)
                      ? "border-blue-400 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-blue-200",
                  )}
                  onClick={() => onToggleQuestion(question.id)}
                >
                  <CardContent className="flex items-start gap-3 p-4">
                    <Checkbox checked={selectedQuestions.includes(question.id)} />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium text-slate-800">
                        <span className="mr-2 text-slate-500">#{index + 1}</span>
                        {question.question_text}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )

  const renderStep1Fields = () => (
    <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-stretch">
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="bank-title" className={eLabel}>
            {assessmentLabel} title *
          </Label>
          <Input
            id="bank-title"
            value={quizData.title}
            onChange={(e) => setQuizData({ ...quizData, title: e.target.value })}
            placeholder={`Name this ${assessmentLabel.toLowerCase()}…`}
            className={eInput}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col space-y-2">
          <Label htmlFor="bank-description" className={eLabel}>
            Description
          </Label>
          <Textarea
            id="bank-description"
            value={quizData.description}
            onChange={(e) => setQuizData({ ...quizData, description: e.target.value })}
            placeholder="Optional instructions for students"
            className={cn(eTextarea, "min-h-[120px] flex-1 resize-none lg:min-h-[160px]")}
          />
        </div>
      </div>
      <div className="flex flex-col gap-4 lg:min-h-0">
        <div className="space-y-2">
          <Label htmlFor="bank-from" className={eLabel}>
            Available from
          </Label>
          <Input
            id="bank-from"
            type="datetime-local"
            value={quizData.available_from}
            onChange={(e) => setQuizData({ ...quizData, available_from: e.target.value })}
            className={eInput}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bank-until" className={eLabel}>
            Available until
          </Label>
          <Input
            id="bank-until"
            type="datetime-local"
            value={quizData.available_until}
            onChange={(e) => setQuizData({ ...quizData, available_until: e.target.value })}
            className={eInput}
          />
        </div>
        {isEmbedded ? (
          <p className={cn("text-sm leading-relaxed text-[color-mix(in_srgb,var(--cc-text)_55%,var(--cc-text-muted))]")}>
            Leave dates empty to open immediately with no end date. You can adjust session access after creation.
          </p>
        ) : null}
      </div>
    </div>
  )

  const renderStep3Review = (embeddedList: boolean) => (
    <div className="space-y-5">
      <div className={embeddedList ? AM_STAT_BOX : "space-y-3 rounded-xl bg-slate-50 p-4"}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className={cn("text-[10px] font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>Title</p>
            <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>{quizData.title}</p>
          </div>
          <div>
            <p className={cn("text-[10px] font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>Questions</p>
            <p className={cn("text-sm font-semibold tabular-nums", PORTAL_TEXT)}>{selectedQuestions.length}</p>
          </div>
          <div>
            <p className={cn("text-[10px] font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>Duration</p>
            <p className={cn("text-sm font-semibold tabular-nums", PORTAL_TEXT)}>{quizData.time_limit} min</p>
          </div>
          <div>
            <p className={cn("text-[10px] font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>Per question</p>
            <p className={cn("text-sm font-semibold tabular-nums", PORTAL_TEXT)}>
              {selectedQuestions.length ? Math.ceil(quizData.time_limit / selectedQuestions.length) : 0} min
            </p>
          </div>
        </div>
        {quizData.description ? (
          <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>{quizData.description}</p>
        ) : null}
      </div>

      <div>
        <h4 className={cn("mb-3 text-sm font-semibold", embeddedList ? PORTAL_TEXT : "text-slate-700")}>Question preview</h4>
        {embeddedList && chrome ? (
          <div className={cn(PORTAL_CARD, "overflow-hidden")}>
            <div className="max-h-[min(320px,40vh)] divide-y divide-[var(--border)] overflow-y-auto">
              {questions
                .filter((q) => selectedQuestions.includes(q.id))
                .map((question, idx) => (
                  <div key={question.id} className={AM_LIST_ROW}>
                    <span className={cn("w-6 shrink-0 text-xs font-semibold tabular-nums", PORTAL_TEXT_MUTED)}>{idx + 1}.</span>
                    <p className={cn("line-clamp-2 flex-1 text-sm", PORTAL_TEXT)}>{question.question_text}</p>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <div className="max-h-[300px] space-y-2 overflow-y-auto">
            {questions
              .filter((q) => selectedQuestions.includes(q.id))
              .map((question, idx) => (
                <div key={question.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  {idx + 1}. {question.question_text}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )

  const renderSuccess = () => (
    <div className="mx-auto max-w-lg space-y-6 py-6 text-center">
      <div className={cn("mx-auto flex h-16 w-16 items-center justify-center rounded-full", isEmbedded && chrome ? chrome.success : "bg-green-600")}>
        <CheckCircle2 className="h-8 w-8 text-white" />
      </div>
      <div className="space-y-1">
        <h3 className={cn("text-xl font-bold", isEmbedded ? PORTAL_TEXT : "text-green-800")}>{assessmentLabel} created</h3>
        <p className={cn("text-sm", isEmbedded ? PORTAL_TEXT_MUTED : "text-green-700")}>&ldquo;{quizData.title}&rdquo; is ready for students</p>
      </div>
      <div className={cn(isEmbedded ? AM_STAT_BOX : "rounded-xl bg-white/80 p-6")}>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className={cn("text-xl font-bold tabular-nums", isEmbedded ? "text-[var(--cc-accent)]" : "text-green-600")}>{selectedQuestions.length}</p>
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Questions</p>
          </div>
          <div>
            <p className={cn("text-xl font-bold tabular-nums", isEmbedded ? "text-[var(--cc-accent)]" : "text-green-600")}>{quizData.time_limit}</p>
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Minutes</p>
          </div>
          <div>
            <p className={cn("text-xl font-bold tabular-nums", isEmbedded ? "text-[var(--cc-accent)]" : "text-green-600")}>
              {selectedQuestions.length ? Math.ceil(quizData.time_limit / selectedQuestions.length) : 0}
            </p>
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Avg / Q</p>
          </div>
        </div>
      </div>
      <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
        <Clock className="mr-1 inline h-3.5 w-3.5 animate-spin" />
        Returning to list…
      </p>
    </div>
  )

  if (isEmbedded && chrome) {
    if (currentStep === 4) {
      return (
        <div className={cn(PORTAL_CARD, "overflow-hidden")}>
          <div className="border-b border-[var(--border)] px-4 py-3 sm:px-5">
            <h2 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Create from question bank</h2>
          </div>
          {renderSuccess()}
        </div>
      )
    }

    return (
      <div className={cn(PORTAL_CARD, "flex min-h-0 flex-1 flex-col overflow-hidden")}>
        <div className="flex shrink-0 flex-col gap-2 border-b border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <h2 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Create from question bank</h2>
            <p className={cn("text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
              Build a new {assessmentLabel.toLowerCase()} from your course bank
            </p>
          </div>
          <Badge variant="outline" className="w-fit shrink-0 border-[var(--cc-accent)]/30 text-[var(--cc-accent-dark)] dark:text-[var(--cc-accent)]">
            Step {currentStep} of 3
          </Badge>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch">
          <nav className="shrink-0 border-b border-[var(--border)] p-3 lg:w-56 lg:border-b-0 lg:border-r lg:p-4">
            <ol className="flex gap-2 overflow-x-auto pb-0.5 lg:flex-col lg:gap-1 lg:overflow-visible">
              {workflowSteps.map((step) => {
                const done = currentStep > step.number
                const active = currentStep === step.number
                const Icon = step.icon
                return (
                  <li key={step.number} className="shrink-0 lg:shrink">
                    <button
                      type="button"
                      disabled={!done && !active}
                      onClick={() => done && setCurrentStep(step.number)}
                      className={cn(
                        "flex w-full min-w-[148px] items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors lg:min-w-0",
                        active && "bg-[var(--cc-accent)]/10",
                        !active && !done && "cursor-default",
                        done && "cursor-pointer hover:bg-[var(--cc-accent-soft)]/45",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                          done || active ? chrome.solid : "bg-muted/80 text-[color-mix(in_srgb,var(--cc-text)_45%,var(--cc-text-muted))]",
                        )}
                      >
                        {done ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0">
                        <p className={cn("text-xs font-semibold leading-snug lg:line-clamp-2", active || done ? PORTAL_TEXT : "text-[color-mix(in_srgb,var(--cc-text)_62%,var(--cc-text-muted))]")}>
                          {step.title}
                        </p>
                        <p className={cn("text-xs leading-snug lg:line-clamp-2", active ? PORTAL_TEXT_MUTED : "text-[color-mix(in_srgb,var(--cc-text)_48%,var(--cc-text-muted))]")}>{step.description}</p>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-4 sm:p-5">
              {questionsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-48 rounded-lg" />
                  <Skeleton className="h-11 w-full rounded-lg" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <Skeleton className="h-11 w-full rounded-lg" />
                </div>
              ) : (
                <>
                  {currentStep === 1 && (
                    <div className="flex min-h-0 flex-1 flex-col">
                      {renderStep1Fields()}
                    </div>
                  )}
                  {currentStep === 2 && (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className={cn(chrome.viewOrganizer.container, "w-full sm:w-auto")}>
                          <button
                            type="button"
                            onClick={() => setSelectionMode("random")}
                            className={cn(
                              "inline-flex h-9 flex-1 items-center justify-center gap-1.5 px-3 text-sm sm:flex-none",
                              selectionMode === "random" ? chrome.viewOrganizer.active : chrome.viewOrganizer.inactive,
                            )}
                          >
                            <Shuffle className="h-3.5 w-3.5" />
                            Random
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectionMode("manual")}
                            className={cn(
                              "inline-flex h-9 flex-1 items-center justify-center gap-1.5 px-3 text-sm sm:flex-none",
                              selectionMode === "manual" ? chrome.viewOrganizer.active : chrome.viewOrganizer.inactive,
                            )}
                          >
                            <ListChecks className="h-3.5 w-3.5" />
                            Manual
                          </button>
                        </div>
                        {selectedQuestions.length > 0 ? (
                          <Button variant="outline" size="sm" onClick={onClearSelection} className={quietBtn}>
                            Clear ({selectedQuestions.length})
                          </Button>
                        ) : null}
                      </div>
                      {renderQuestionPicker(true)}
                    </div>
                  )}
                  {currentStep === 3 && renderStep3Review(true)}
                </>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--muted)]/35 px-4 py-3 sm:px-5">
              {currentStep > 1 ? (
                <Button variant="outline" onClick={() => setCurrentStep(currentStep - 1)} className={quietBtn}>
                  <ChevronLeft className="mr-1.5 h-4 w-4" />
                  Back
                </Button>
              ) : (
                <span />
              )}
              {currentStep === 1 ? (
                <Button onClick={() => setCurrentStep(2)} disabled={!canProceedToStep2} className={primaryBtn}>
                  Select questions
                  <ChevronRight className="ml-1.5 h-4 w-4" />
                </Button>
              ) : null}
              {currentStep === 2 ? (
                <Button onClick={() => setCurrentStep(3)} disabled={!canProceedToStep3} className={primaryBtn}>
                  Review
                  <ChevronRight className="ml-1.5 h-4 w-4" />
                </Button>
              ) : null}
              {currentStep === 3 ? (
                <Button onClick={onSubmit} disabled={creating} className={successBtn}>
                  {creating ? (
                    <>
                      <Clock className="mr-1.5 h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      Create {assessmentLabel.toLowerCase()}
                    </>
                  )}
                </Button>
              ) : null}
            </div>
          </div>

          <aside className="hidden shrink-0 border-t border-[var(--border)] p-4 xl:flex xl:w-56 xl:flex-col xl:border-t-0 xl:border-l">
            <p className={cn("mb-3 text-[10px] font-semibold uppercase tracking-[0.14em]", PORTAL_TEXT_MUTED)}>At a glance</p>
            <div className="space-y-2">
              <SummaryStat label="Bank size" value={questions.length} icon={Database} />
              <SummaryStat label="Selected" value={selectedQuestions.length} icon={ListChecks} />
              <SummaryStat label="Est. minutes" value={quizData.time_limit || "—"} icon={Clock} />
            </div>
          </aside>
        </div>
      </div>
    )
  }

  // Legacy non-embedded layout
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex justify-center px-4">
        <div className="flex w-full max-w-3xl items-center gap-2">
          {workflowSteps.map((step, index) => (
            <div key={step.number} className="flex flex-1 items-center">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full",
                  currentStep >= step.number ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500",
                )}
              >
                {currentStep > step.number ? <Check className="h-4 w-4" /> : step.number}
              </div>
              {index < workflowSteps.length - 1 ? (
                <div className={cn("mx-2 h-0.5 flex-1", currentStep > step.number ? "bg-blue-600" : "bg-slate-200")} />
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {currentStep === 4 ? (
        <Card className={stepCard}>
          <CardContent>{renderSuccess()}</CardContent>
        </Card>
      ) : (
        <Card className={stepCard}>
          <CardContent className="space-y-6 pt-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">{activeStep?.title}</h3>
              <p className="text-sm text-slate-600">{activeStep?.description}</p>
            </div>
            {currentStep === 1 && renderStep1Fields()}
            {currentStep === 2 && (
              <Tabs value={selectionMode} onValueChange={(v) => setSelectionMode(v as "random" | "manual")}>
                <TabsList className={tabListClass}>
                  <TabsTrigger value="random" className={tabTriggerClass}>
                    Random
                  </TabsTrigger>
                  <TabsTrigger value="manual" className={tabTriggerClass}>
                    Manual
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="random" className="mt-5">
                  {renderQuestionPicker(false)}
                </TabsContent>
                <TabsContent value="manual" className="mt-5">
                  {renderQuestionPicker(false)}
                </TabsContent>
              </Tabs>
            )}
            {currentStep === 3 && renderStep3Review(false)}
            <div className="flex justify-between pt-2">
              {currentStep > 1 ? (
                <Button variant="outline" onClick={() => setCurrentStep(currentStep - 1)} className={quietBtn}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              ) : (
                <span />
              )}
              {currentStep === 1 ? (
                <Button onClick={() => setCurrentStep(2)} disabled={!canProceedToStep2} className={primaryBtn}>
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : null}
              {currentStep === 2 ? (
                <Button onClick={() => setCurrentStep(3)} disabled={!canProceedToStep3} className={primaryBtn}>
                  Review
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : null}
              {currentStep === 3 ? (
                <Button onClick={onSubmit} disabled={creating} className={successBtn}>
                  {creating ? "Creating…" : `Create ${assessmentLabel}`}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
