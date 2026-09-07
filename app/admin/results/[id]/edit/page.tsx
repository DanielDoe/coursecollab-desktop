"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { GraduationCap, LogOut, ArrowLeft, Save, AlertCircle } from "lucide-react"
import Link from "next/link"
import { logoutAdmin } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"

interface QuestionAnswer {
  id: number
  question_id: number
  question_text: string
  selected_answer: string | null
  is_correct: boolean
  points_earned: number
  feedback: string | null
  override_points: number | null
  override_comment: string | null
}

interface AttemptData {
  attempt_id: number
  student_name: string
  student_id: string
  section: string
  quiz_title: string
  score: number
  total_questions: number
  percentage: number
  answers: QuestionAnswer[]
}

export default function EditResultPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [attemptData, setAttemptData] = useState<AttemptData | null>(null)
  const [editedAnswers, setEditedAnswers] = useState<Record<number, { points: number; comment: string }>>({})

  const handleLogout = () => {
    logoutAdmin()
  }

  useEffect(() => {
    const adminId = sessionStorage.getItem("adminId")
    if (!adminId) {
      router.push("/admin/login")
      return
    }
    fetchAttemptData()
  }, [params.id, router])

  const fetchAttemptData = async () => {
    try {
      const response = await fetch(`/api/admin/results/${params.id}/edit`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to load attempt data")
      }

      setAttemptData(data)

      // Initialize edited answers with current values
      const initialEdits: Record<number, { points: number; comment: string }> = {}
      data.answers.forEach((answer: QuestionAnswer) => {
        initialEdits[answer.id] = {
          points: answer.override_points ?? answer.points_earned,
          comment: answer.override_comment ?? "",
        }
      })
      setEditedAnswers(initialEdits)
    } catch (error) {
      console.error("[v0] Failed to fetch attempt data:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load attempt data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!attemptData) return

    setSaving(true)

    try {
      const updates = Object.entries(editedAnswers).map(([answerId, data]) => ({
        answerId: Number.parseInt(answerId),
        overridePoints: data.points,
        overrideComment: data.comment,
      }))

      const response = await fetch(`/api/admin/results/${params.id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save changes")
      }

      toast({
        title: "Changes saved",
        description: `Updated ${updates.length} answer(s). New total score: ${data.newScore}/${data.totalQuestions}`,
      })

      // Refresh data
      fetchAttemptData()
    } catch (error) {
      console.error("[v0] Failed to save changes:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save changes",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const updateAnswer = (answerId: number, field: "points" | "comment", value: string | number) => {
    setEditedAnswers((prev) => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        [field]: field === "points" ? Number(value) : value,
      },
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!attemptData) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Failed to Load Data</h3>
            <Button onClick={() => router.push("/admin/results")} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Results
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const calculatedScore = Object.values(editedAnswers).reduce((sum, answer) => sum + answer.points, 0)
  const calculatedPercentage = Math.round((calculatedScore / attemptData.total_questions) * 100)

  return (
    <div className="min-h-screen bg-secondary">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <GraduationCap className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-primary">CourseCollab</h1>
            </Link>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => router.push("/admin/results")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Results
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-foreground mb-2">Edit Student Quiz Report</h2>
          <p className="text-muted-foreground">Manually adjust scores and add comments for grading corrections</p>
        </div>

        {/* Student Info Card */}
        <Card className="mb-6 border-2">
          <CardHeader>
            <CardTitle>Student Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Student Name</div>
                <div className="font-semibold">{attemptData.student_name}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Student ID</div>
                <div className="font-semibold">{attemptData.student_id}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Section</div>
                <Badge>{attemptData.section}</Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Quiz</div>
                <div className="font-semibold">{attemptData.quiz_title}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Score Summary Card */}
        <Card className="mb-6 border-2 border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Current Score</div>
                <div className="text-2xl font-bold">
                  {calculatedScore} / {attemptData.total_questions} ({calculatedPercentage}%)
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Questions List */}
        <div className="space-y-4">
          {attemptData.answers.map((answer, index) => (
            <Card key={answer.id} className="border-2">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">
                      Question {index + 1}: {answer.question_text}
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      <Badge variant={answer.is_correct ? "default" : "destructive"}>
                        {answer.is_correct ? "Correct" : "Incorrect"}
                      </Badge>
                      {answer.selected_answer && (
                        <span className="text-sm text-muted-foreground">
                          Student Answer: <span className="font-semibold">{answer.selected_answer}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`points-${answer.id}`}>Points Earned</Label>
                    <Input
                      id={`points-${answer.id}`}
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={editedAnswers[answer.id]?.points ?? 0}
                      onChange={(e) => updateAnswer(answer.id, "points", e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Original: {answer.points_earned} point(s)
                      {answer.override_points !== null && ` • Previously overridden to: ${answer.override_points}`}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor={`comment-${answer.id}`}>Admin Comment (Optional)</Label>
                    <Textarea
                      id={`comment-${answer.id}`}
                      value={editedAnswers[answer.id]?.comment ?? ""}
                      onChange={(e) => updateAnswer(answer.id, "comment", e.target.value)}
                      placeholder="Add a comment explaining the grade adjustment..."
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                </div>
                {answer.feedback && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm font-semibold mb-1">System Feedback:</div>
                    <div className="text-sm text-muted-foreground">{answer.feedback}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Save Button at Bottom */}
        <div className="mt-6 flex justify-center">
          <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
            <Save className="h-5 w-5" />
            {saving ? "Saving Changes..." : "Save All Changes"}
          </Button>
        </div>
      </main>
    </div>
  )
}
