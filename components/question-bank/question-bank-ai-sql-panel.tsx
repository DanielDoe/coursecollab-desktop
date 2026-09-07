"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"
import { getQuestionBankSqlTemplate } from "@/lib/question-bank-sql-templates"
import {
  defaultAiGenerationSpec,
  validateAiGenerationSpec,
  type QuestionBankAiGenerationSpec,
} from "@/lib/question-bank-ai-generation-spec"
import {
  resolveQuestionBankTypeMeta,
  type CustomQuestionTypeDraft,
} from "@/lib/custom-question-types"
import type { QuestionBankTypeId } from "@/lib/question-bank-type-config"
import { Loader2, Play, Sparkles } from "lucide-react"
import {
  questionBankSectionClass,
  questionBankSectionHeaderClass,
} from "@/lib/question-bank-ui"

export function QuestionBankAiSqlPanel({
  questionType,
  customTypes = [],
  userType,
  onSuccess,
}: {
  questionType: QuestionBankTypeId | string
  customTypes?: CustomQuestionTypeDraft[]
  userType: "admin" | "instructor"
  onSuccess: (questionId: number) => void
}) {
  const { toast } = useToast()
  const meta = resolveQuestionBankTypeMeta(questionType, customTypes)
  const [spec, setSpec] = useState<QuestionBankAiGenerationSpec>(() =>
    defaultAiGenerationSpec(questionType, customTypes),
  )
  const [generatedSql, setGeneratedSql] = useState("")
  const [generating, setGenerating] = useState(false)
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    setSpec(defaultAiGenerationSpec(questionType, customTypes))
    setGeneratedSql("")
  }, [questionType, customTypes])

  const patch = (partial: Partial<QuestionBankAiGenerationSpec>) => {
    setSpec((prev) => ({ ...prev, ...partial }))
  }

  const apiBase = userType === "admin" ? "/api/admin" : "/api/instructor"
  const headers = () => ({
    "Content-Type": "application/json",
    ...(userType === "instructor" ? (getInstructorScopeHeaders() as Record<string, string>) : {}),
  })

  const showOptionsFields = meta?.requiresOptions ?? false
  const showCodingFields = meta?.usesGradingGuidelines ?? false
  const isMultiPart = questionType === "multi_part"
  const isTrueFalse = questionType === "true_false"

  const contentPlaceholder = useMemo(() => {
    if (isMultiPart) {
      return "Shared introduction, figure description, or scenario for all parts…"
    }
    if (showCodingFields) {
      return "Problem statement: what students must implement, input/output, constraints…"
    }
    return "Question stem (what you are asking students)…"
  }, [isMultiPart, showCodingFields])

  const handleGenerate = async () => {
    const err = validateAiGenerationSpec(spec, customTypes)
    if (err) {
      toast({ title: "Complete required fields", description: err, variant: "destructive" })
      return
    }
    setGenerating(true)
    try {
      const res = await fetch(`${apiBase}/question-bank/generate-sql`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(spec),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Generation failed")
      setGeneratedSql(data.sql || "")
      toast({
        title: "SQL generated",
        description: "Review the query, then run it to add the question.",
      })
    } catch (e) {
      toast({
        title: "Generation failed",
        description: e instanceof Error ? e.message : "Could not generate SQL",
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleExecute = async () => {
    if (!generatedSql.trim()) {
      toast({ title: "No SQL", description: "Generate or paste SQL first.", variant: "destructive" })
      return
    }
    setExecuting(true)
    try {
      const res = await fetch(`${apiBase}/question-bank/execute-sql`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ sql: generatedSql }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Execute failed")
      toast({ title: "Question added", description: `Created question #${data.questionId}` })
      onSuccess(Number(data.questionId))
    } catch (e) {
      toast({
        title: "Could not run SQL",
        description: e instanceof Error ? e.message : "Execute failed",
        variant: "destructive",
      })
    } finally {
      setExecuting(false)
    }
  }

  const loadTemplate = () => {
    setGeneratedSql(getQuestionBankSqlTemplate(questionType))
  }

  if (userType === "admin") {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        AI SQL generation is available on the instructor question bank for the selected course.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <section className={questionBankSectionClass}>
        <div className={questionBankSectionHeaderClass}>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Step A — Fixed parameters
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
            These values are sent to AI as-is (type, difficulty, topic, …).
          </p>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Question type</Label>
              <Input
                value={meta?.label ?? questionType}
                readOnly
                className="h-9 bg-slate-50 dark:bg-slate-900/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Difficulty <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={spec.difficulty}
                onValueChange={(v) => patch({ difficulty: v as QuestionBankAiGenerationSpec["difficulty"] })}
              >
                <SelectTrigger className="h-9">
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
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Topic <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={spec.topic}
                onChange={(e) => patch({ topic: e.target.value })}
                placeholder="e.g. Circuit Fundamentals"
                className="h-9"
              />
            </div>
          </div>

          {showCodingFields ? (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Evaluation</Label>
                <Select
                  value={spec.evaluationMode}
                  onValueChange={(v) =>
                    patch({ evaluationMode: v as QuestionBankAiGenerationSpec["evaluationMode"] })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automated / AI</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Language</Label>
                <Select
                  value={spec.programmingLanguage}
                  onValueChange={(v) => patch({ programmingLanguage: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="C++">C++</SelectItem>
                    <SelectItem value="Python">Python</SelectItem>
                    <SelectItem value="MATLAB">MATLAB</SelectItem>
                    <SelectItem value="Java">Java</SelectItem>
                    <SelectItem value="Pseudocode">Pseudocode</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {showOptionsFields && !isTrueFalse ? (
            <div className="space-y-1.5 max-w-xs">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Number of options</Label>
              <Select
                value={String(spec.optionCount)}
                onValueChange={(v) => patch({ optionCount: Number.parseInt(v, 10) })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} options
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {isMultiPart ? (
            <div className="space-y-1.5 max-w-xs">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Number of sub-parts</Label>
              <Select
                value={String(spec.subPartCount)}
                onValueChange={(v) => patch({ subPartCount: Number.parseInt(v, 10) })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} parts
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Checkbox
                checked={spec.includeHint}
                onCheckedChange={(c) => patch({ includeHint: c === true })}
              />
              Include hint
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Checkbox
                checked={spec.includeExplanation}
                onCheckedChange={(c) => patch({ includeExplanation: c === true })}
              />
              Include explanation
            </label>
          </div>
        </div>
      </section>

      <section className={questionBankSectionClass}>
        <div className={questionBankSectionHeaderClass}>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Step B — Question content
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
            Describe only what varies per question; fixed fields above are already set.
          </p>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {isMultiPart ? "Shared stem" : "Question text"} <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              value={spec.contentDescription}
              onChange={(e) => patch({ contentDescription: e.target.value })}
              placeholder={contentPlaceholder}
              rows={4}
              className="text-sm resize-y"
            />
          </div>

          {showOptionsFields ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {isTrueFalse
                  ? "Statement & correct answer (True or False)"
                  : questionType === "select_all"
                    ? "Options & all correct choices"
                    : "Options & correct answer"}{" "}
                <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                value={spec.optionsDescription}
                onChange={(e) => patch({ optionsDescription: e.target.value })}
                placeholder={
                  isTrueFalse
                    ? "e.g. Statement: Ohm's law is I = V/R. Correct answer: True"
                    : questionType === "select_all"
                      ? "e.g. A) Resistor (correct), B) Battery, C) Capacitor (correct), D) Wire"
                      : "e.g. A) 10Ω (correct), B) 20Ω, C) 30Ω, D) 40Ω — include distractors and mark correct letter(s)"
                }
                rows={3}
                className="text-sm resize-y"
              />
            </div>
          ) : null}

          {showCodingFields ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Grading rubric <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                value={spec.rubricDescription}
                onChange={(e) => patch({ rubricDescription: e.target.value })}
                placeholder="e.g. Uses required loop; correct output format; handles edge case N=0; naming conventions"
                rows={3}
                className="text-sm resize-y"
              />
            </div>
          ) : null}

          {isMultiPart ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Sub-parts outline <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                value={spec.subPartsDescription}
                onChange={(e) => patch({ subPartsDescription: e.target.value })}
                placeholder="e.g. (a) MCQ: find R_eq … (b) T/F: current splits … (c) Numeric: calculate power …"
                rows={4}
                className="text-sm resize-y"
              />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" size="sm" onClick={handleGenerate} disabled={generating} className="h-9">
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate SQL
                </>
              )}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={loadTemplate}>
              Load type template
            </Button>
          </div>
        </div>
      </section>

      <section className={questionBankSectionClass}>
        <div className={questionBankSectionHeaderClass}>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            Step C — Review & run SQL
          </h3>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="generated-sql" className="text-xs font-medium text-slate-600 dark:text-slate-400">
              SQL (editable)
            </Label>
            <Textarea
              id="generated-sql"
              value={generatedSql}
              onChange={(e) => setGeneratedSql(e.target.value)}
              placeholder="Generate SQL after completing steps A and B…"
              rows={14}
              className="font-mono text-xs resize-y min-h-[12rem]"
              spellCheck={false}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Uses <code className="text-[11px]">{"{{COURSE_ID}}"}</code> for the selected course. Must end with{" "}
              <code className="text-[11px]">RETURNING id</code>.
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            className="h-9 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600"
            onClick={handleExecute}
            disabled={executing || !generatedSql.trim()}
          >
            {executing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run SQL & add question
              </>
            )}
          </Button>
        </div>
      </section>
    </div>
  )
}
