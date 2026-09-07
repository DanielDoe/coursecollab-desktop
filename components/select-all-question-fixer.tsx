"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

interface SelectAllQuestion {
  id: number
  table: "quiz_questions" | "question_bank"
  quiz_id?: number
  question_text: string
  correct_answer: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  option_e?: string | null
  status: "needs_fix" | "fixed" | "unknown"
}

export function SelectAllQuestionFixer() {
  const [questions, setQuestions] = useState<SelectAllQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string[]>>({})

  useEffect(() => {
    fetchProblematicQuestions()
  }, [])

  const fetchProblematicQuestions = async () => {
    try {
      const response = await fetch("/api/admin/select-all-audit")
      const data = await response.json()
      setQuestions(data.questions)

      // Initialize selected answers with current correct answer
      const initial: Record<number, string[]> = {}
      data.questions.forEach((q: SelectAllQuestion) => {
        if (q.correct_answer.match(/^[A-E]$/)) {
          initial[q.id] = [q.correct_answer]
        } else {
          try {
            initial[q.id] = JSON.parse(q.correct_answer)
          } catch {
            initial[q.id] = []
          }
        }
      })
      setSelectedAnswers(initial)
    } catch (error) {
      console.error("[v0] Failed to fetch select_all questions:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleOption = (questionId: number, option: string) => {
    setSelectedAnswers((prev) => {
      const current = prev[questionId] || []
      const updated = current.includes(option) ? current.filter((o) => o !== option) : [...current, option].sort()
      return { ...prev, [questionId]: updated }
    })
  }

  const saveQuestion = async (question: SelectAllQuestion) => {
    setSaving(question.id)
    try {
      const correctAnswer = JSON.stringify(selectedAnswers[question.id] || [])
      const response = await fetch("/api/admin/update-select-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: question.table,
          id: question.id,
          correct_answer: correctAnswer,
        }),
      })

      if (response.ok) {
        setQuestions((prev) =>
          prev.map((q) => (q.id === question.id ? { ...q, correct_answer: correctAnswer, status: "fixed" } : q)),
        )
      }
    } catch (error) {
      console.error("[v0] Failed to update question:", error)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const needsFixCount = questions.filter((q) => q.status === "needs_fix").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Select All Question Fixer</h2>
          <p className="text-muted-foreground">
            Review and fix select_all questions with single-letter correct answers
          </p>
        </div>
        <Badge variant={needsFixCount > 0 ? "destructive" : "default"}>{needsFixCount} questions need fixing</Badge>
      </div>

      <div className="space-y-4">
        {questions.map((question) => {
          const selected = selectedAnswers[question.id] || []
          const isFixed = question.status === "fixed"

          return (
            <Card key={`${question.table}-${question.id}`} className="p-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {isFixed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                      )}
                      <Badge variant="outline">
                        {question.table === "quiz_questions"
                          ? `Quiz ${question.quiz_id} - Q${question.id}`
                          : `Question Bank #${question.id}`}
                      </Badge>
                    </div>
                    <p className="font-medium mb-4">{question.question_text}</p>

                    <div className="space-y-2">
                      {["A", "B", "C", "D", "E"].map((letter) => {
                        const optionKey = `option_${letter.toLowerCase()}` as keyof SelectAllQuestion
                        const optionText = question[optionKey] as string
                        if (!optionText) return null

                        return (
                          <div key={letter} className="flex items-center gap-3">
                            <Checkbox
                              id={`${question.id}-${letter}`}
                              checked={selected.includes(letter)}
                              onCheckedChange={() => toggleOption(question.id, letter)}
                              disabled={saving === question.id}
                            />
                            <label htmlFor={`${question.id}-${letter}`} className="text-sm cursor-pointer flex-1">
                              <span className="font-semibold">{letter}.</span> {optionText}
                            </label>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <Button
                    onClick={() => saveQuestion(question)}
                    disabled={saving === question.id || selected.length === 0}
                    size="sm"
                  >
                    {saving === question.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground">
                  Current: <code className="bg-muted px-2 py-1 rounded">{question.correct_answer}</code>
                  {" → "}
                  New: <code className="bg-muted px-2 py-1 rounded">{JSON.stringify(selected)}</code>
                </div>
              </div>
            </Card>
          )
        })}

        {questions.length === 0 && (
          <Card className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <p className="text-lg font-medium">All select_all questions are properly formatted!</p>
            <p className="text-muted-foreground">No questions need fixing.</p>
          </Card>
        )}
      </div>
    </div>
  )
}
