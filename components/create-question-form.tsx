"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"
import { QuestionTypeSelector } from "@/components/question-bank/question-type-selector"
import {
  CreateQuestionFields,
  type CreateQuestionFormState,
  type CreateQuestionOption,
} from "@/components/question-bank/create-question-fields"
import { QuestionBankAiDescribePanel } from "@/components/question-bank/question-bank-ai-describe-panel"
import { QuestionBankAiFromPdfPanel } from "@/components/question-bank/question-bank-ai-from-pdf-panel"
import { QuestionBankCreateTypePanel } from "@/components/question-bank/question-bank-create-type-panel"
import type { CustomQuestionTypeDraft } from "@/lib/custom-question-types"
import { resolveQuestionBankTypeMeta } from "@/lib/custom-question-types"
import { DEFAULT_QUESTION_MEDIA, type QuestionMedia } from "@/lib/question-media"
import type { QuestionSolutionUploadConfig } from "@/lib/solution-upload"
import {
  editableSubquestionsToPayload,
  validateEditableSubquestions,
  defaultEditableSubPart,
  type EditableSubPart,
} from "@/lib/multi-part-question"
import {
  buildStandardSolutionUploadConfig,
  normalizeMultiPartSubquestionsForPolicy,
  DEFAULT_UPLOAD_POINTS_MULTIPLIER,
} from "@/lib/multi-part-grading-policy"
import {
  buildCircuitSubmissionConfig,
  CIRCUIT_SUBMISSION_DEFAULT_TOPIC,
  CIRCUIT_SUBMISSION_DEFAULT_INSTRUCTIONS,
  CIRCUIT_SUBMISSION_DEFAULT_RUBRIC,
} from "@/lib/circuit-submission"
import {
  questionBankSectionClass,
  questionBankSectionHeaderClass,
} from "@/lib/question-bank-ui"

function defaultBankListPath(userType: "admin" | "instructor") {
  return userType === "admin" ? "/admin/question-bank" : "/instructor/question-bank"
}

function defaultOptionsForType(type: string, customTypes: CustomQuestionTypeDraft[] = []): CreateQuestionOption[] {
  if (type === "true_false") {
    return [
      { option_text: "True", is_correct: false },
      { option_text: "False", is_correct: false },
    ]
  }
  const meta = resolveQuestionBankTypeMeta(type, customTypes)
  if (meta?.requiresOptions && type !== "true_false") {
    return [
      { option_text: "", is_correct: false },
      { option_text: "", is_correct: false },
      { option_text: "", is_correct: false },
      { option_text: "", is_correct: false },
    ]
  }
  return [
    { option_text: "", is_correct: false },
    { option_text: "", is_correct: false },
  ]
}

const INITIAL_FORM: CreateQuestionFormState = {
  question_text: "",
  difficulty: "medium",
  topic: "",
  hint: "",
  evaluation_mode: "auto",
  sample_answer: "",
  expected_answer: "",
  answer_guidelines: [],
}

export function CreateQuestionForm({
  userType = "admin",
  bankListPath,
  embedInDashboard = false,
}: {
  userType?: "admin" | "instructor"
  bankListPath?: string
  embedInDashboard?: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const listPath = bankListPath ?? defaultBankListPath(userType)
  const [saving, setSaving] = useState(false)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [typeStepMode, setTypeStepMode] = useState<"select" | "create">("select")
  const [customTypes, setCustomTypes] = useState<CustomQuestionTypeDraft[]>([])
  const [entryMode, setEntryMode] = useState<"manual" | "ai" | "pdf">("manual")
  const [questionData, setQuestionData] = useState<CreateQuestionFormState>(INITIAL_FORM)
  const [options, setOptions] = useState<CreateQuestionOption[]>(defaultOptionsForType("mcq"))
  const [questionMedia, setQuestionMedia] = useState<QuestionMedia | null>(null)
  const [solutionUploadConfig, setSolutionUploadConfig] = useState<QuestionSolutionUploadConfig>({
    enabled: false,
    bonus_percent: 10,
  })
  const [editableParts, setEditableParts] = useState<EditableSubPart[]>([])
  const [uploadMultiplier, setUploadMultiplier] = useState(DEFAULT_UPLOAD_POINTS_MULTIPLIER)
  const [newGuideline, setNewGuideline] = useState("")

  useEffect(() => {
    if (userType !== "instructor") return
    instructorApiFetch("/api/instructor/question-bank/custom-types", {
      headers: getInstructorScopeHeaders() as Record<string, string>,
    })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.types)) setCustomTypes(d.types)
      })
      .catch(() => {})
  }, [userType])

  useEffect(() => {
    if (userType !== "instructor") return
    instructorApiFetch("/api/instructor/courses/grading-policy", {
      headers: getInstructorScopeHeaders() as Record<string, string>,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.multi_part_upload_multiplier != null) {
          setUploadMultiplier(Number(d.multi_part_upload_multiplier))
        }
      })
      .catch(() => {})
  }, [userType])

  useEffect(() => {
    const topic = searchParams.get("topic")?.trim()
    if (topic) {
      setQuestionData((prev) => (prev.topic === topic ? prev : { ...prev, topic }))
    }
  }, [searchParams])

  const handleTypeSelect = useCallback(
    (type: string) => {
      setSelectedType(type)
      setTypeStepMode("select")
      setOptions(defaultOptionsForType(type, customTypes))
      if (type === "multi_part") {
        setQuestionMedia({ ...DEFAULT_QUESTION_MEDIA, media_enabled: true })
        setEditableParts([defaultEditableSubPart("a")])
        setSolutionUploadConfig(buildStandardSolutionUploadConfig())
        return
      }
      if (type === "circuit_submission") {
        setQuestionMedia({ ...DEFAULT_QUESTION_MEDIA, media_enabled: true })
        setQuestionData((prev) => ({
          ...prev,
          topic: prev.topic || CIRCUIT_SUBMISSION_DEFAULT_TOPIC,
          evaluation_mode: "manual",
        }))
        setSolutionUploadConfig(
          buildCircuitSubmissionConfig({
            require_solution_upload: true,
            submission_instructions: CIRCUIT_SUBMISSION_DEFAULT_INSTRUCTIONS,
            rubric: CIRCUIT_SUBMISSION_DEFAULT_RUBRIC,
          }) as QuestionSolutionUploadConfig,
        )
        return
      }
      setEditableParts([])
      setQuestionMedia(null)
    },
    [customTypes],
  )

  useEffect(() => {
    const type = searchParams.get("type")?.trim()
    if (!type || selectedType === type) return
    handleTypeSelect(type)
  }, [searchParams, selectedType, handleTypeSelect])

  const toggleCorrect = (index: number) => {
    if (!selectedType) return
    const updated = [...options]
    if (selectedType === "mcq" || selectedType === "true_false") {
      updated.forEach((opt, i) => {
        opt.is_correct = i === index
      })
    } else {
      updated[index].is_correct = !updated[index].is_correct
    }
    setOptions(updated)
  }

  const addGuideline = () => {
    if (newGuideline.trim()) {
      setQuestionData({
        ...questionData,
        answer_guidelines: [...questionData.answer_guidelines, newGuideline.trim()],
      })
      setNewGuideline("")
    }
  }

  const removeGuideline = (index: number) => {
    setQuestionData({
      ...questionData,
      answer_guidelines: questionData.answer_guidelines.filter((_, i) => i !== index),
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedType) {
      toast({ title: "Select a question type", variant: "destructive" })
      return
    }

    const meta = resolveQuestionBankTypeMeta(selectedType, customTypes)
    if (!questionData.question_text.trim()) {
      toast({ title: "Validation error", description: "Question text is required.", variant: "destructive" })
      return
    }

    if (selectedType === "multi_part") {
      const subErr = validateEditableSubquestions(editableParts)
      if (subErr) {
        toast({ title: "Validation error", description: subErr, variant: "destructive" })
        return
      }
    } else if (meta?.requiresOptions) {
      const filledOptions = options.filter((opt) => opt.option_text.trim())
      if (filledOptions.length < 2) {
        toast({ title: "Validation error", description: "At least 2 options are required.", variant: "destructive" })
        return
      }
      const correctOptions = filledOptions.filter((opt) => opt.is_correct)
      if (correctOptions.length === 0) {
        toast({
          title: "Validation error",
          description: "At least one correct answer must be selected.",
          variant: "destructive",
        })
        return
      }
      if (
        (selectedType === "mcq" || selectedType === "true_false") &&
        correctOptions.length > 1
      ) {
        toast({
          title: "Validation error",
          description: "Only one correct answer allowed for this question type.",
          variant: "destructive",
        })
        return
      }
    }

    setSaving(true)
    try {
      let body: Record<string, unknown>

      if (selectedType === "multi_part") {
        body = {
          question_text: questionData.question_text,
          question_type: selectedType,
          difficulty: questionData.difficulty,
          topic: questionData.topic || null,
          hint: questionData.hint || null,
          options: [],
          correct_answer: null,
          question_media: questionMedia,
          subquestions: normalizeMultiPartSubquestionsForPolicy(
            editableSubquestionsToPayload(editableParts),
          ),
          solution_upload_config: buildStandardSolutionUploadConfig({
            uploadPointsMultiplier: uploadMultiplier,
            partCount: editableParts.length,
          }),
        }
      } else if (selectedType === "circuit_submission") {
        body = {
          question_text: questionData.question_text,
          question_type: selectedType,
          difficulty: questionData.difficulty,
          topic: questionData.topic || CIRCUIT_SUBMISSION_DEFAULT_TOPIC,
          hint: questionData.hint || null,
          options: [],
          correct_answer: null,
          evaluation_mode: "manual",
          question_media: questionMedia,
          solution_upload_config: buildCircuitSubmissionConfig({
            title: questionData.hint.trim() || undefined,
            submission_instructions: CIRCUIT_SUBMISSION_DEFAULT_INSTRUCTIONS,
            ...(typeof solutionUploadConfig === "object" && solutionUploadConfig
              ? {
                  submission_instructions:
                    (solutionUploadConfig as { submission_instructions?: string }).submission_instructions ||
                    CIRCUIT_SUBMISSION_DEFAULT_INSTRUCTIONS,
                  rubric:
                    (solutionUploadConfig as { rubric?: typeof CIRCUIT_SUBMISSION_DEFAULT_RUBRIC }).rubric ||
                    CIRCUIT_SUBMISSION_DEFAULT_RUBRIC,
                }
              : { rubric: CIRCUIT_SUBMISSION_DEFAULT_RUBRIC }),
            require_solution_upload: true,
          }),
          solution_upload_required: true,
          grading_type: "manual",
          expected_answer: questionData.expected_answer.trim() || null,
        }
      } else {
        const filledOptions = options.filter((opt) => opt.option_text.trim())
        const formattedOptions = filledOptions.map((opt, index) => ({
          text: opt.option_text,
          isCorrect: opt.is_correct,
          order: index + 1,
        }))
        const correctAnswer =
          selectedType === "select_all"
            ? formattedOptions.filter((opt) => opt.isCorrect).map((opt) => opt.text)
            : formattedOptions.find((opt) => opt.isCorrect)?.text

        body = {
          question_text: questionData.question_text,
          question_type: selectedType,
          difficulty: questionData.difficulty,
          topic: questionData.topic || null,
          hint: questionData.hint || null,
          evaluation_mode: questionData.evaluation_mode,
          sample_answer: questionData.sample_answer || null,
          answer_guidelines: questionData.answer_guidelines,
          options: meta?.requiresOptions ? formattedOptions : [],
          correct_answer: meta?.requiresOptions ? correctAnswer : questionData.sample_answer || null,
          question_media: questionMedia,
          solution_upload_config: solutionUploadConfig,
        }
      }

      const response = await fetch(`${userType === "admin" ? "/api/admin" : "/api/instructor"}/question-bank`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(userType === "instructor" ? (getInstructorScopeHeaders() as Record<string, string>) : {}),
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to create question")
      }

      toast({ title: "Question created", description: "The question has been added to the bank." })
      router.push(listPath)
    } catch (error) {
      console.error("[CreateQuestionForm]", error)
      toast({
        title: "Failed to create question",
        description: error instanceof Error ? error.message : "An error occurred.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={embedInDashboard ? "w-full min-w-0 space-y-4 sm:space-y-6" : "max-w-4xl mx-auto space-y-6"}>
      <div>
        <h2
          className={
            embedInDashboard
              ? "text-lg sm:text-xl font-semibold text-slate-800 dark:text-slate-100 mb-1"
              : "text-3xl font-bold text-foreground mb-2"
          }
        >
          New question
        </h2>
        <p className={embedInDashboard ? "text-sm text-slate-500 dark:text-slate-400" : "text-muted-foreground"}>
          Pick or create a type, then build manually, describe to AI, or import from PDF slides
        </p>
      </div>

      <section className={questionBankSectionClass}>
        <div className={questionBankSectionHeaderClass}>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Step 1 — Question type</h3>
        </div>
        <div className="p-4 sm:p-5">
          {typeStepMode === "create" ? (
            <QuestionBankCreateTypePanel
              onCancel={() => setTypeStepMode("select")}
              onSaved={(type) => {
                setCustomTypes((prev) => {
                  const exists = prev.some((t) => t.typeId === type.typeId)
                  return exists
                    ? prev.map((t) => (t.typeId === type.typeId ? type : t))
                    : [...prev, type]
                })
                handleTypeSelect(type.typeId)
              }}
            />
          ) : (
            <QuestionTypeSelector
              value={selectedType}
              onChange={handleTypeSelect}
              customTypes={customTypes}
              onCreateNewType={userType === "instructor" ? () => setTypeStepMode("create") : undefined}
            />
          )}
        </div>
      </section>

      {selectedType && typeStepMode === "select" ? (
        <Tabs value={entryMode} onValueChange={(v) => setEntryMode(v as "manual" | "ai" | "pdf")} className="space-y-4">
          <TabsList className="w-full sm:w-auto h-9 flex-wrap">
            <TabsTrigger value="manual" className="text-xs sm:text-sm">
              Build manually
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-xs sm:text-sm">
              Describe to AI
            </TabsTrigger>
            <TabsTrigger value="pdf" className="text-xs sm:text-sm">
              From PDF slides
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="mt-0 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <CreateQuestionFields
                questionType={selectedType}
                customTypes={customTypes}
                questionData={questionData}
                onQuestionDataChange={setQuestionData}
                options={options}
                onOptionsChange={setOptions}
                questionMedia={questionMedia}
                onQuestionMediaChange={setQuestionMedia}
                solutionUploadConfig={solutionUploadConfig}
                onSolutionUploadConfigChange={setSolutionUploadConfig}
                editableParts={editableParts}
                onEditablePartsChange={setEditableParts}
                newGuideline={newGuideline}
                onNewGuidelineChange={setNewGuideline}
                onAddGuideline={addGuideline}
                onRemoveGuideline={removeGuideline}
                onToggleCorrect={toggleCorrect}
                userType={userType}
                uploadPointsMultiplier={uploadMultiplier}
              />

              <div className="sticky bottom-0 z-10 py-3 border-t border-slate-200/80 dark:border-white/[0.06] flex flex-wrap justify-end gap-2 bg-gradient-to-t from-white via-white/95 to-transparent dark:from-slate-950 dark:via-slate-950/95">
                <Link href={listPath}>
                  <Button type="button" variant="outline" size="sm" className="h-9">
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  size="sm"
                  className="h-9 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    "Create question"
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="ai" className="mt-0 space-y-4">
            <QuestionBankAiDescribePanel
              questionType={selectedType}
              customTypes={customTypes}
              userType={userType}
              onSuccess={() => router.push(listPath)}
            />
          </TabsContent>

          <TabsContent value="pdf" className="mt-0 space-y-4">
            <QuestionBankAiFromPdfPanel
              questionType={selectedType}
              userType={userType}
              onSuccess={() => router.push(listPath)}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
          Select a question type above to continue.
        </p>
      )}
    </div>
  )
}
