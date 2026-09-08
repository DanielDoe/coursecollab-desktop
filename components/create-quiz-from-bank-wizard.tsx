"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { CheckCircle2, Eye, FileText, ListChecks } from "lucide-react"
import { useAssessment } from "@/context/assessment-context"
import { cn } from "@/lib/utils"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"
import { AM_PANEL, PORTAL_TEXT } from "@/lib/assessments/assessment-management-surface-classes"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { CreateFromBankWizardView } from "@/components/instructor/CreateFromBankWizardView"

interface Question {
  id: number
  question_text: string
  question_type: string
  difficulty: string
  topic: string | null
}

interface CreateQuizFromBankWizardProps {
  onSuccess?: () => void
  assessmentType?: "quiz" | "mid_semester" | "final" | "homework"
  variant?: "default" | "embedded"
}

const DEFAULT_TIME_LIMITS: Record<string, number> = {
  true_false: 30,
  mcq: 50,
  select_all: 60,
  fill_blank: 45,
  code_output: 75,
  code_debug: 90,
  fill_code: 60,
  trace_logic: 80,
  scenario_match: 70,
  multi_output: 80,
  code_reorder: 100,
  code_problem: 150,
  trace_output: 90,
  debug_code: 120,
  code_write: 180,
  code_explain: 120,
}

export function CreateQuizFromBankWizard({ onSuccess, assessmentType = "quiz", variant = "default" }: CreateQuizFromBankWizardProps = {}) {
  const isEmbedded = variant === "embedded"
  const facultyModuleId =
    assessmentType === "homework"
      ? "homeworks"
      : assessmentType === "mid_semester"
        ? "mid-semester"
        : assessmentType === "final"
          ? "final-exams"
          : "quizzes"
  const chrome = isEmbedded ? facultyEmbedChrome(facultyModuleId) : null
  const primaryBtn = isEmbedded
    ? cn(chrome!.solid, "h-9 rounded-lg sm:h-10")
    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 rounded-xl"
  const successBtn = isEmbedded
    ? cn(chrome!.success, "h-9 rounded-lg sm:h-10")
    : "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg shadow-green-500/25 rounded-xl"
  const quietBtn = isEmbedded ? cn(chrome!.quiet, "h-9 rounded-lg sm:h-10") : "rounded-xl border-slate-200"
  const stepCard = isEmbedded ? AM_PANEL : "border-slate-200/60 shadow-sm bg-white/80 backdrop-blur-sm rounded-2xl border"
  const eLabel = isEmbedded ? cn("text-sm font-medium", PORTAL_TEXT) : "text-sm font-semibold text-slate-700"
  const eInput = isEmbedded
    ? cn(
        "h-11 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)] shadow-none",
        "placeholder:text-[color-mix(in_srgb,var(--cc-text)_38%,var(--cc-text-muted))]",
        "[&::-webkit-datetime-edit-fields-wrapper]:text-[color-mix(in_srgb,var(--cc-text)_38%,var(--cc-text-muted))]",
        "[&::-webkit-datetime-edit]:text-[color-mix(in_srgb,var(--cc-text)_38%,var(--cc-text-muted))]",
        "[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-80",
        "focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]/25 focus-visible:border-[var(--cc-accent)]",
        "focus-visible:[&::-webkit-datetime-edit-fields-wrapper]:text-[var(--cc-text)]",
        "focus-visible:[&::-webkit-datetime-edit]:text-[var(--cc-text)]",
        "[:not([value=''])]:[&::-webkit-datetime-edit-fields-wrapper]:text-[var(--cc-text)]",
        "[:not([value=''])]:[&::-webkit-datetime-edit]:text-[var(--cc-text)]",
      )
    : "h-12 border-slate-200 focus:border-blue-300 focus:ring-blue-200 rounded-xl text-base"
  const eTextarea = isEmbedded
    ? cn(
        "min-h-[120px] rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)] shadow-none",
        "placeholder:text-[color-mix(in_srgb,var(--cc-text)_38%,var(--cc-text-muted))]",
        "focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]/25 focus-visible:border-[var(--cc-accent)]",
      )
    : "border-slate-200 focus:border-blue-300 focus:ring-blue-200 rounded-xl min-h-[100px]"
  const tabListClass = isEmbedded
    ? "grid h-11 w-full grid-cols-2 gap-1 rounded-xl border border-[var(--border)] bg-muted/30 p-1"
    : "grid w-full grid-cols-2 rounded-xl bg-slate-100 h-12"
  const tabTriggerClass = isEmbedded
    ? cn(
        chrome!.quiet,
        "flex items-center justify-center gap-2 rounded-lg text-sm data-[state=active]:border-[var(--cc-accent)] data-[state=active]:bg-[var(--cc-accent)] data-[state=active]:!text-white data-[state=active]:shadow-none",
      )
    : "flex items-center gap-2 rounded-xl"
  const { toast } = useToast()
  const assessment = useAssessment()
  const [currentStep, setCurrentStep] = useState(1)
  const [creating, setCreating] = useState(false)
  const [questionsLoading, setQuestionsLoading] = useState(true)
  const [questions, setQuestions] = useState<Question[]>([])
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([])
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([])
  const [selectionMode, setSelectionMode] = useState<"random" | "manual">("random")
  const [customTimeLimits, setCustomTimeLimits] = useState<Record<number, number>>({})
  const [randomConfig, setRandomConfig] = useState({
    count: 10,
    difficulty: "all",
    topic: "all",
    question_types: [] as string[],
  })
  const [quizData, setQuizData] = useState({
    title: "",
    description: "",
    time_limit: 0,
    available_from: "",
    available_until: "",
  })
  const [manualFilters, setManualFilters] = useState({
    difficulty: "all",
    topic: "all",
    question_types: [] as string[],
  })

  useEffect(() => {
    fetchQuestions()
    const onScope = () => fetchQuestions()
    window.addEventListener("instructor-course-scope-changed", onScope)
    return () => window.removeEventListener("instructor-course-scope-changed", onScope)
  }, [])

  useEffect(() => {
    if (selectionMode === "manual") applyFilters()
  }, [manualFilters, questions, selectionMode])

  useEffect(() => {
    if (selectedQuestions.length > 0) {
      const totalSeconds = selectedQuestions.reduce((sum, qid) => {
        const question = questions.find((q) => q.id === qid)
        if (!question) return sum
        const timeLimit = customTimeLimits[qid] ?? DEFAULT_TIME_LIMITS[question.question_type] ?? 60
        return sum + timeLimit
      }, 0)
      setQuizData((prev) => ({ ...prev, time_limit: Math.ceil(totalSeconds / 60) }))
    } else {
      setQuizData((prev) => ({ ...prev, time_limit: 0 }))
    }
  }, [selectedQuestions, customTimeLimits, questions])

  const fetchQuestions = async () => {
    setQuestionsLoading(true)
    try {
      const response = await instructorApiFetch("/api/instructor/question-bank", { headers: getInstructorScopeHeaders() })

      if (!response.ok) {
        throw new Error(`Failed to fetch questions: ${response.status}`)
      }

      const data = await response.json()
      setQuestions(data.questions || [])
      setFilteredQuestions(data.questions || [])
    } catch (error) {
      console.error("Failed to fetch questions:", error)
      toast({
        title: "Failed to load questions",
        description: "Could not retrieve questions from the question bank. Please refresh and try again.",
        variant: "destructive",
      })
    } finally {
      setQuestionsLoading(false)
    }
  }

  const applyFilters = () => {
    let result = [...questions]

    if (manualFilters.difficulty !== "all") {
      result = result.filter((q) => q.difficulty === manualFilters.difficulty)
    }

    if (manualFilters.topic !== "all") {
      result = result.filter((q) => q.topic === manualFilters.topic)
    }

    if (manualFilters.question_types.length > 0) {
      result = result.filter((q) => manualFilters.question_types.includes(q.question_type))
    }

    setFilteredQuestions(result)
  }

  const toggleQuestion = (qid: number) => {
    setSelectedQuestions((prev) => (prev.includes(qid) ? prev.filter((id) => id !== qid) : [...prev, qid]))
  }

  const selectAll = () => {
    setSelectedQuestions(filteredQuestions.map((q) => q.id))
  }

  const clearSelection = () => {
    setSelectedQuestions([])
  }

  const handleRandomSelect = () => {
    let pool = [...questions]

    if (randomConfig.difficulty !== "all") {
      pool = pool.filter((q) => q.difficulty === randomConfig.difficulty)
    }

    if (randomConfig.topic !== "all") {
      pool = pool.filter((q) => q.topic === randomConfig.topic)
    }

    if (randomConfig.question_types.length > 0) {
      pool = pool.filter((q) => randomConfig.question_types.includes(q.question_type))
    }

    const shuffled = pool.sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, Math.min(randomConfig.count, pool.length))

    setSelectedQuestions(selected.map((q) => q.id))
    toast({
      title: "Random selection complete",
      description: `${selected.length} questions selected`,
    })
  }

  const handleSubmit = async () => {
    if (!quizData.title.trim()) {
      toast({
        title: "Title required",
        description: `Enter a title for this ${assessment.label.toLowerCase()} before creating it.`,
        variant: "destructive",
      })
      return
    }

    if (selectedQuestions.length === 0) {
      toast({
        title: "No questions selected",
        description: "Select at least one question from the bank.",
        variant: "destructive",
      })
      return
    }

    setCreating(true)

    try {
      const instructorId = sessionStorage.getItem("adminId") || localStorage.getItem("instructorId") || "1"

      const assessmentTypeMap: Record<string, string> = {
        quiz: "quiz",
        homework: "homework",
        mid_semester: "mid_semester",
        midsem: "mid_semester",
        final: "final",
        finals: "final",
      }
      const apiAssessmentType = assessmentTypeMap[assessmentType] || "quiz"

      const response = await instructorApiFetch(`/api/instructor/assessments/create-from-bank`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getInstructorScopeHeaders(),
        },
        body: JSON.stringify({
          title: quizData.title,
          description: quizData.description || null,
          time_limit: quizData.time_limit || Math.ceil(selectedQuestions.length * 60),
          question_ids: selectedQuestions,
          custom_time_limits: customTimeLimits,
          available_from: quizData.available_from || null,
          available_until: quizData.available_until || null,
          assessment_type: apiAssessmentType,
          instructor_id: Number(instructorId),
          sendNotifications: false,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create assessment")
      }

      await response.json()

      toast({
        title: `${assessment.label} created`,
        description: `"${quizData.title}" has ${selectedQuestions.length} questions (${quizData.time_limit} min total).`,
      })

      setCurrentStep(4)

      setTimeout(() => {
        setQuizData({ title: "", description: "", time_limit: 0, available_from: "", available_until: "" })
        setSelectedQuestions([])
        setCurrentStep(1)
        onSuccess?.()
      }, 3000)
    } catch (error: unknown) {
      console.error("Failed to create assessment:", error)
      toast({
        title: `Failed to create ${assessment.label.toLowerCase()}`,
        description: error instanceof Error ? error.message : "Please check your inputs and try again.",
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  const uniqueTopics = Array.from(new Set(questions.map((q) => q.topic).filter(Boolean)))

  const steps = [
    {
      number: 1,
      title: `${assessment.label} details`,
      icon: FileText,
      description: "Title, schedule, notes",
    },
    {
      number: 2,
      title: "Pick questions",
      icon: ListChecks,
      description: "Random or manual",
    },
    {
      number: 3,
      title: "Review & create",
      icon: Eye,
      description: "Confirm and publish",
    },
    {
      number: 4,
      title: "Complete",
      icon: CheckCircle2,
      description: "Done",
    },
  ]

  return (
    <CreateFromBankWizardView
      isEmbedded={isEmbedded}
      chrome={chrome}
      assessmentLabel={assessment.label}
      steps={steps}
      currentStep={currentStep}
      setCurrentStep={setCurrentStep}
      quizData={quizData}
      setQuizData={setQuizData}
      questions={questions}
      filteredQuestions={filteredQuestions}
      questionsLoading={questionsLoading}
      selectedQuestions={selectedQuestions}
      selectionMode={selectionMode}
      setSelectionMode={setSelectionMode}
      randomConfig={randomConfig}
      setRandomConfig={setRandomConfig}
      manualFilters={manualFilters}
      setManualFilters={setManualFilters}
      uniqueTopics={uniqueTopics}
      creating={creating}
      canProceedToStep2={quizData.title.trim().length > 0}
      canProceedToStep3={selectedQuestions.length > 0}
      onRandomSelect={handleRandomSelect}
      onSubmit={handleSubmit}
      onToggleQuestion={toggleQuestion}
      onSelectAll={selectAll}
      onClearSelection={clearSelection}
      primaryBtn={primaryBtn}
      successBtn={successBtn}
      quietBtn={quietBtn}
      eLabel={eLabel}
      eInput={eInput}
      eTextarea={eTextarea}
      tabListClass={tabListClass}
      tabTriggerClass={tabTriggerClass}
      stepCard={stepCard}
    />
  )
}
