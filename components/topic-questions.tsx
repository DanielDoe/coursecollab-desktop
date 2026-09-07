"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { Loader2 } from "lucide-react"

interface BankQuestion {
  id: number
  question_text: string
  question_type: string
  difficulty: string
  topic: string | null
  hint: string | null
  option_count: number
  quiz_usage_count: number
  options: Array<{
    id: number
    option_text: string
    is_correct: boolean
    option_order: number
  }>
  created_at: string
}

interface TopicQuestionsProps {
  topicName: string
}

export function TopicQuestions({ topicName }: TopicQuestionsProps) {
  const [questions, setQuestions] = useState<BankQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/admin/question-bank?topic=${encodeURIComponent(topicName)}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch questions")
        }

        setQuestions(data.questions || [])
      } catch (err) {
        console.error("[v0] Failed to fetch topic questions:", err)
        setError(err instanceof Error ? err.message : "Failed to load questions")
      } finally {
        setLoading(false)
      }
    }

    fetchQuestions()
  }, [topicName])

  const getQuestionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      mcq: "Multiple Choice",
      true_false: "True/False",
      select_all: "Select All",
      fill_blank: "Fill in the Blank",
      code_problem: "Code Problem",
      trace_output: "Trace Output",
      debug_code: "Debug Code",
      code_write: "Code Write",
      code_explain: "Code Explain",
    }
    return labels[type] || type
  }

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      easy: "bg-green-500",
      medium: "bg-yellow-500",
      hard: "bg-red-500",
    }
    return colors[difficulty] || "bg-gray-500"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading questions...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">No questions found in this topic.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {questions.map((question, index) => (
        <Card key={question.id} className="border">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0">
                #{index + 1}
              </Badge>
              <div className="flex-1 min-w-0">
                <QuestionTextRenderer text={question.question_text} className="text-sm leading-relaxed" />
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {getQuestionTypeLabel(question.question_type)}
                  </Badge>
                  <Badge className={`${getDifficultyColor(question.difficulty)} text-xs`}>
                    {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
                  </Badge>
                  {question.hint && (
                    <Badge variant="outline" className="text-yellow-600 text-xs">
                      Has Hint
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{question.option_count} options</span>
              <span>Used in {question.quiz_usage_count} quiz(zes)</span>
              <span>Created {new Date(question.created_at).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
