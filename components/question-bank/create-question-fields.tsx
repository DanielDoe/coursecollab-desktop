"use client"

import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2 } from "lucide-react"
import { QuestionMediaPanel } from "@/components/question-media-panel"
import { SolutionUploadConfigPanel } from "@/components/solution-upload-config-panel"
import { MultiPartSubquestionsEditor } from "@/components/multi-part-subquestions-editor"
import type { QuestionMedia } from "@/lib/question-media"
import type { QuestionSolutionUploadConfig } from "@/lib/solution-upload"
import type { EditableSubPart } from "@/lib/multi-part-question"
import { resolveQuestionBankTypeMeta, type CustomQuestionTypeDraft } from "@/lib/custom-question-types"
import type { QuestionBankTypeId } from "@/lib/question-bank-type-config"
import {
  buildCircuitSubmissionConfig,
  parseCircuitSubmissionConfig,
  CIRCUIT_SUBMISSION_DEFAULT_INSTRUCTIONS,
} from "@/lib/circuit-submission"
import {
  questionBankSectionClass,
  questionBankSectionHeaderClass,
} from "@/lib/question-bank-ui"

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false })

export type CreateQuestionOption = { option_text: string; is_correct: boolean }

export type CreateQuestionFormState = {
  question_text: string
  difficulty: string
  topic: string
  hint: string
  evaluation_mode: string
  sample_answer: string
  expected_answer: string
  answer_guidelines: string[]
}

type Props = {
  questionType: QuestionBankTypeId | string
  customTypes?: CustomQuestionTypeDraft[]
  questionData: CreateQuestionFormState
  onQuestionDataChange: (next: CreateQuestionFormState) => void
  options: CreateQuestionOption[]
  onOptionsChange: (next: CreateQuestionOption[]) => void
  questionMedia: QuestionMedia | null
  onQuestionMediaChange: (next: QuestionMedia | null) => void
  solutionUploadConfig: QuestionSolutionUploadConfig
  onSolutionUploadConfigChange: (next: QuestionSolutionUploadConfig) => void
  editableParts: EditableSubPart[]
  onEditablePartsChange: (next: EditableSubPart[]) => void
  newGuideline: string
  onNewGuidelineChange: (v: string) => void
  onAddGuideline: () => void
  onRemoveGuideline: (index: number) => void
  onToggleCorrect: (index: number) => void
  userType: "admin" | "instructor"
  uploadPointsMultiplier?: number
}

export function CreateQuestionFields({
  questionType,
  customTypes = [],
  questionData,
  onQuestionDataChange,
  options,
  onOptionsChange,
  questionMedia,
  onQuestionMediaChange,
  solutionUploadConfig,
  onSolutionUploadConfigChange,
  editableParts,
  onEditablePartsChange,
  newGuideline,
  onNewGuidelineChange,
  onAddGuideline,
  onRemoveGuideline,
  onToggleCorrect,
  userType,
  uploadPointsMultiplier,
}: Props) {
  const meta = resolveQuestionBankTypeMeta(questionType, customTypes)
  const requiresOptions = meta?.requiresOptions ?? false
  const usesGrading = meta?.usesGradingGuidelines ?? false
  const usesCodeEditor = meta?.usesCodeEditor ?? false
  const isMultiPart = questionType === "multi_part"
  const isCircuitSubmission = questionType === "circuit_submission"
  const circuitConfig = isCircuitSubmission
    ? parseCircuitSubmissionConfig(solutionUploadConfig)
    : null

  const addOption = () => {
    onOptionsChange([...options, { option_text: "", is_correct: false }])
  }

  const removeOption = (index: number) => {
    if (options.length <= 2) return
    onOptionsChange(options.filter((_, i) => i !== index))
  }

  const updateOption = (index: number, field: keyof CreateQuestionOption, value: string | boolean) => {
    const updated = [...options]
    updated[index] = { ...updated[index], [field]: value }
    onOptionsChange(updated)
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className={questionBankSectionClass}>
        <div className={questionBankSectionHeaderClass}>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {isMultiPart ? "Shared stem" : isCircuitSubmission ? "Circuit problem" : "Question prompt"}
          </h3>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="question_text" className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {isMultiPart
                ? "Introduction / diagram context"
                : isCircuitSubmission
                  ? "Problem statement"
                  : "Question text"}
            </Label>
            <Textarea
              id="question_text"
              value={questionData.question_text}
              onChange={(e) => onQuestionDataChange({ ...questionData, question_text: e.target.value })}
              placeholder={
                isMultiPart
                  ? "Describe the shared figure or scenario for all parts…"
                  : isCircuitSubmission
                    ? "e.g. Determine currents I₁, I₂, I₃, and I₄ in the circuit of Fig. P2.17."
                    : "Enter your question… (Markdown supported)"
              }
              rows={isMultiPart ? 4 : 5}
              className="text-sm resize-y"
              required
            />
          </div>

          <QuestionMediaPanel
            media={questionMedia}
            onChange={onQuestionMediaChange}
            allowUpload={userType === "instructor"}
          />

          {requiresOptions ? (
            <SolutionUploadConfigPanel config={solutionUploadConfig} onChange={onSolutionUploadConfigChange} />
          ) : null}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Type</Label>
              <Input value={meta?.label ?? questionType} readOnly className="h-9 bg-slate-50 dark:bg-slate-900/50" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="difficulty" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Difficulty
              </Label>
              <Select
                value={questionData.difficulty}
                onValueChange={(value) => onQuestionDataChange({ ...questionData, difficulty: value })}
              >
                <SelectTrigger id="difficulty" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="topic" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Topic
              </Label>
              <Input
                id="topic"
                value={questionData.topic}
                onChange={(e) => onQuestionDataChange({ ...questionData, topic: e.target.value })}
                placeholder="e.g. Circuit Fundamentals"
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hint" className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {isCircuitSubmission ? "Display title" : "Hint"}{" "}
              {!isCircuitSubmission ? (
                <span className="font-normal text-slate-400">(optional)</span>
              ) : null}
            </Label>
            <Textarea
              id="hint"
              value={questionData.hint}
              onChange={(e) => onQuestionDataChange({ ...questionData, hint: e.target.value })}
              placeholder={
                isCircuitSubmission ? "e.g. Problem 2.17 - Current Distribution" : undefined
              }
              rows={isCircuitSubmission ? 1 : 2}
              className="text-sm resize-y"
            />
          </div>

          {isCircuitSubmission ? (
            <>
            <div className="space-y-1.5">
              <Label htmlFor="submission_instructions" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Submission instructions
              </Label>
              <Textarea
                id="submission_instructions"
                value={circuitConfig?.submission_instructions ?? CIRCUIT_SUBMISSION_DEFAULT_INSTRUCTIONS}
                onChange={(e) =>
                  onSolutionUploadConfigChange(
                    buildCircuitSubmissionConfig({
                      ...circuitConfig,
                      title: questionData.hint.trim() || undefined,
                      submission_instructions: e.target.value,
                    }) as QuestionSolutionUploadConfig,
                  )
                }
                rows={3}
                className="text-sm resize-y"
                placeholder="Tell students what to include in their upload…"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manual grading only — students upload PDF or image files (up to 10, 25 MB each). Default rubric: 3+3+2+2
                = 10 pts (instructor-only).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expected_answer" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Expected answer <span className="text-slate-400 font-normal">(instructor / AI only)</span>
              </Label>
              <Textarea
                id="expected_answer"
                value={questionData.expected_answer}
                onChange={(e) => onQuestionDataChange({ ...questionData, expected_answer: e.target.value })}
                rows={2}
                className="text-sm resize-y font-mono"
                placeholder="e.g. \\(V_L = 2.32\\,V\\)"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Used by AI grading to verify the student&apos;s final result. Not shown to students.
              </p>
            </div>
            </>
          ) : null}
        </div>
      </section>

      {isMultiPart ? (
        <section className={questionBankSectionClass}>
          <div className={questionBankSectionHeaderClass}>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Sub-questions</h3>
          </div>
          <div className="p-4 sm:p-5">
            <MultiPartSubquestionsEditor
              parts={editableParts}
              onChange={onEditablePartsChange}
              uploadPointsMultiplier={uploadPointsMultiplier}
            />
          </div>
        </section>
      ) : null}

      {usesGrading ? (
        <section className={questionBankSectionClass}>
          <div className={questionBankSectionHeaderClass}>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Grading & reference</h3>
          </div>
          <div className="p-4 sm:p-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="evaluation_mode" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Evaluation mode
              </Label>
              <Select
                value={questionData.evaluation_mode}
                onValueChange={(value) => onQuestionDataChange({ ...questionData, evaluation_mode: value })}
              >
                <SelectTrigger id="evaluation_mode" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual (instructor grades)</SelectItem>
                  <SelectItem value="auto">Automated / AI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Grading guidelines</Label>
              <div className="flex gap-2">
                <Input
                  value={newGuideline}
                  onChange={(e) => onNewGuidelineChange(e.target.value)}
                  placeholder="Add a rubric item…"
                  className="h-9"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      onAddGuideline()
                    }
                  }}
                />
                <Button type="button" onClick={onAddGuideline} variant="outline" size="sm" className="h-9 shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {questionData.answer_guidelines.length > 0 ? (
                <ul className="space-y-2 mt-2">
                  {questionData.answer_guidelines.map((guideline, index) => (
                    <li
                      key={index}
                      className="flex items-center gap-2 rounded-lg border border-slate-200/80 px-3 py-2 text-sm dark:border-white/[0.08]"
                    >
                      <span className="flex-1">{guideline}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveGuideline(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Sample answer (instructor reference)
              </Label>
              {usesCodeEditor ? (
                <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-white/[0.08]">
                  <MonacoEditor
                    height="200px"
                    language="cpp"
                    theme="vs-dark"
                    value={questionData.sample_answer}
                    onChange={(value) => onQuestionDataChange({ ...questionData, sample_answer: value || "" })}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                    }}
                  />
                </div>
              ) : (
                <Textarea
                  value={questionData.sample_answer}
                  onChange={(e) => onQuestionDataChange({ ...questionData, sample_answer: e.target.value })}
                  rows={5}
                  className="text-sm font-mono resize-y"
                />
              )}
            </div>
          </div>
        </section>
      ) : null}

      {requiresOptions ? (
        <section className={questionBankSectionClass}>
          <div className={questionBankSectionHeaderClass + " flex items-center justify-between gap-2"}>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Answer options</h3>
            {questionType !== "true_false" ? (
              <Button type="button" onClick={addOption} variant="outline" size="sm" className="h-8">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add option
              </Button>
            ) : null}
          </div>
          <div className="p-4 sm:p-5 space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {questionType === "select_all"
                ? "Mark every correct option."
                : questionType === "true_false"
                  ? "True = option A, False = option B."
                  : "Mark the single correct option."}
            </p>
            {options.map((option, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-lg border border-slate-200/80 p-3 dark:border-white/[0.08]"
              >
                <Checkbox
                  checked={option.is_correct}
                  onCheckedChange={() => onToggleCorrect(index)}
                  className="mt-2"
                />
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-slate-500">Option {String.fromCharCode(65 + index)}</Label>
                  <Input
                    value={option.option_text}
                    onChange={(e) => updateOption(index, "option_text", e.target.value)}
                    readOnly={questionType === "true_false"}
                    className="h-9"
                  />
                </div>
                {options.length > 2 && questionType !== "true_false" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-6"
                    onClick={() => removeOption(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
