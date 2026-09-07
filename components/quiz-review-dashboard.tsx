"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { CheckCircle2, AlertCircle, Clock } from "lucide-react"

interface ReviewItem {
  answer_id: number
  quiz_id: number
  question_id: number
  quiz_title: string
  question_text: string
  question_type: string
  student_id: string
  given_answer: string
  feedback: string | null
  is_correct: boolean | null
  override_points: number | null
  requires_review: boolean
  override_comment: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  attempt_id: number
  current_score: number
  total_questions: number
}

export function QuizReviewDashboard() {
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<number | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchReviews()
  }, [])

  const fetchReviews = async () => {
    try {
      const response = await fetch("/api/quiz/review")
      const data = await response.json()
      setReviews(data.pending || [])
    } catch (error) {
      console.error("[v0] Failed to fetch reviews:", error)
      toast({
        title: "Error",
        description: "Failed to load pending reviews",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOverride = async (answerId: number) => {
    const pointsInput = document.getElementById(`points-${answerId}`) as HTMLInputElement
    const commentInput = document.getElementById(`comment-${answerId}`) as HTMLTextAreaElement

    const overridePoints = Number.parseFloat(pointsInput.value)
    const overrideComment = commentInput.value.trim()

    if (isNaN(overridePoints) || overridePoints < 0 || overridePoints > 1) {
      toast({
        title: "Invalid points",
        description: "Points must be between 0 and 1",
        variant: "destructive",
      })
      return
    }

    if (!overrideComment) {
      toast({
        title: "Comment required",
        description: "Please add a comment explaining your decision",
        variant: "destructive",
      })
      return
    }

    setUpdating(answerId)

    try {
      const response = await fetch("/api/quiz/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answerId,
          overridePoints,
          overrideComment,
          reviewedBy: "Instructor",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update review")
      }

      toast({
        title: "Review completed",
        description: `Answer reviewed and score updated to ${data.newScore.score}/${data.newScore.total_questions}`,
      })

      setReviews((prev) => prev.filter((r) => r.answer_id !== answerId))
    } catch (error) {
      console.error("[v0] Failed to update review:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update review",
        variant: "destructive",
      })
    } finally {
      setUpdating(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading pending reviews...</div>
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <CheckCircle2 className="h-16 w-16 text-success" />
        <div className="text-xl font-semibold">No Pending Reviews</div>
        <p className="text-muted-foreground">All AI-graded answers have been reviewed</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI-Graded Answers Requiring Review</h2>
          <p className="text-muted-foreground mt-1">
            {reviews.length} answer{reviews.length !== 1 ? "s" : ""} pending instructor review
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <Clock className="h-4 w-4 mr-2" />
          {reviews.length} Pending
        </Badge>
      </div>

      <div className="space-y-4">
        {reviews.map((review) => (
          <Card key={review.answer_id} className="border-2">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{review.quiz_title}</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary">{review.question_type}</Badge>
                    <span>Student ID: {review.student_id}</span>
                    <span>
                      Current Score: {review.current_score}/{review.total_questions}
                    </span>
                  </div>
                </div>
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Question</label>
                <p className="mt-1">{review.question_text}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Student Answer</label>
                <p className="mt-1 font-mono text-sm bg-muted p-3 rounded-md">{review.given_answer}</p>
              </div>

              {review.feedback && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">AI Feedback</label>
                  <p className="mt-1 text-sm bg-blue-50 dark:bg-blue-950 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                    {review.feedback}
                  </p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <label htmlFor={`points-${review.answer_id}`} className="text-sm font-medium">
                    Override Points (0-1)
                  </label>
                  <Input
                    id={`points-${review.answer_id}`}
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    placeholder="0.0"
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor={`comment-${review.answer_id}`} className="text-sm font-medium">
                    Instructor Comment (Required)
                  </label>
                  <Textarea
                    id={`comment-${review.answer_id}`}
                    placeholder="Explain your grading decision..."
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </div>

              <Button
                onClick={() => handleOverride(review.answer_id)}
                disabled={updating === review.answer_id}
                className="w-full"
              >
                {updating === review.answer_id ? "Updating..." : "✅ Mark Reviewed & Update Score"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
