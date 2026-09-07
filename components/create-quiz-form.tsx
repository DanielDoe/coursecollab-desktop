"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Trash2, ArrowLeft, GripVertical, Shield, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { useAssessment } from "@/context/assessment-context"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

interface Question {
  question_text: string
  question_type: string
  time_limit?: number | null
  option_a?: string
  option_b?: string
  option_c?: string
  option_d?: string
  option_e?: string
  correct_answer?: string
}

export function CreateQuizForm() {
  const router = useRouter()
  const pathname = usePathname()
  const assessmentContext = useAssessment()
  const isInstructorPath = pathname?.includes("/instructor") || false
  const userType = isInstructorPath ? "instructor" : "admin"
  const basePath = isInstructorPath ? "/instructor" : "/admin"
  
  // Get assessment type from URL or context
  const rawAssessmentType = pathname.split('/')[2] || assessmentContext?.type || "quiz"
  // Normalize assessment type for API routes
  const assessmentTypeMap: Record<string, string> = {
    'quiz': 'quiz',
    'homeworks': 'homework',
    'homework': 'homework',
    'mid-semester-exams': 'midsem',
    'midsem': 'midsem',
    'final-exams': 'final',
    'finals': 'final',
    'final': 'final'
  }
  const normalizedType = assessmentTypeMap[rawAssessmentType] || 'quiz'
  const assessmentType = rawAssessmentType
  const assessmentLabel = assessmentContext?.label || "Quiz"
  const assessmentPluralLabel = assessmentContext?.pluralLabel || "Quizzes"
  
  usePreventBack(isInstructorPath ? "/instructor/login" : "/admin/login")
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [quizData, setQuizData] = useState({
    title: "",
    description: "",
    time_per_question: 60,
    is_active: false,
    retake_enabled: true,
    retake_limit: 0,
    retake_policy: "best",
    review_before_retake: false,
    strict_mode_enabled: false,
    block_copy_paste: false,
    track_tab_switches: false,
    track_mouse_movement: false,
    warn_on_tab_switch: false,
    max_tab_switches: 5,
    auto_submit_on_violations: false,
  })
  const [questions, setQuestions] = useState<Question[]>([
    {
      question_text: "",
      question_type: "MCQ",
      time_limit: null,
      option_a: "",
      option_b: "",
      option_c: "",
      option_d: "",
      option_e: "",
      correct_answer: "A",
    },
  ])
  const [sendNotifications, setSendNotifications] = useState(true)

  useEffect(() => {
    const adminId = sessionStorage.getItem("adminId")
    const instructorSession = localStorage.getItem("instructorSession")
    
    if (!adminId && !instructorSession) {
      router.push(`${basePath}/login`)
      return
    }
  }, [router, basePath])

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        question_text: "",
        question_type: "MCQ",
        time_limit: null,
        option_a: "",
        option_b: "",
        option_c: "",
        option_d: "",
        option_e: "",
        correct_answer: "A",
      },
    ])
  }

  const removeQuestion = (index: number) => {
    if (questions.length === 1) {
      toast({
        title: "Cannot remove question",
        description: "Quiz must have at least one question.",
        variant: "destructive",
      })
      return
    }
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    setQuestions(updated)
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newQuestions = [...questions]
    const draggedQuestion = newQuestions[draggedIndex]
    newQuestions.splice(draggedIndex, 1)
    newQuestions.splice(index, 0, draggedQuestion)

    setQuestions(newQuestions)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleQuestionTypeChange = (index: number, type: string) => {
    const updated = [...questions]
    if (type === "TRUE_FALSE") {
      updated[index] = {
        question_text: updated[index].question_text,
        question_type: type,
        time_limit: updated[index].time_limit,
        option_a: "True",
        option_b: "False",
        option_c: "",
        option_d: "",
        option_e: "",
        correct_answer: "A",
      }
    } else if (type === "MULTI") {
      updated[index] = {
        question_text: updated[index].question_text,
        question_type: type,
        time_limit: updated[index].time_limit,
        option_a: "",
        option_b: "",
        option_c: "",
        option_d: "",
        option_e: "",
        correct_answer: JSON.stringify(["A"]),
      }
    } else {
      // MCQ
      updated[index] = {
        question_text: updated[index].question_text,
        question_type: type,
        time_limit: updated[index].time_limit,
        option_a: "",
        option_b: "",
        option_c: "",
        option_d: "",
        option_e: "",
        correct_answer: "A",
      }
    }
    setQuestions(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (!quizData.title || !quizData.description) {
      toast({
        title: "Missing information",
        description: "Please fill in all quiz details.",
        variant: "destructive",
      })
      setLoading(false)
      return
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.question_text) {
        toast({
          title: "Missing question text",
          description: `Please fill in question text for question ${i + 1}.`,
          variant: "destructive",
        })
        setLoading(false)
        return
      }

      if (q.question_type === "MCQ" && (!q.option_a || !q.option_b || !q.option_c || !q.option_d)) {
        toast({
          title: "Missing options",
          description: `Please fill in all options for question ${i + 1}.`,
          variant: "destructive",
        })
        setLoading(false)
        return
      }

      if (q.question_type === "TRUE_FALSE" && (!q.option_a || !q.option_b)) {
        toast({
          title: "Missing options",
          description: `Please fill in True/False options for question ${i + 1}.`,
          variant: "destructive",
        })
        setLoading(false)
        return
      }

      if (q.question_type === "MULTI" && (!q.option_a || !q.option_b)) {
        toast({
          title: "Missing options",
          description: `Please fill in at least two options for question ${i + 1}.`,
          variant: "destructive",
        })
        setLoading(false)
        return
      }
    }

    try {
      // Get instructor ID
      const instructorId = userType === 'instructor' 
        ? localStorage.getItem('instructorId') || sessionStorage.getItem('instructorId')
        : sessionStorage.getItem('adminId')

      const response = await fetch(`/api/${normalizedType}/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...quizData,
          questions,
          sendNotifications,
          retake_enabled: quizData.retake_enabled,
          retake_limit: quizData.retake_limit,
          retake_policy: quizData.retake_policy,
          review_before_retake: quizData.review_before_retake,
          instructorId: instructorId ? Number(instructorId) : 1
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create quiz")
      }

      const result = await response.json()

      toast({
        title: `✅ ${assessmentLabel} Created Successfully`,
        description: `"${quizData.title}" has been created with ${questions.length} question(s). ${sendNotifications ? 'Students have been notified.' : 'No notifications sent.'}`,
      })

      // Delay redirect slightly to show toast
      setTimeout(() => {
        router.push(`${basePath}/${assessmentType}`)
      }, 500)
    } catch (error) {
      console.error("[v0] Failed to create quiz:", error)
      toast({
        title: "❌ Creation Failed",
        description: `Failed to create "${quizData.title}". ${error instanceof Error ? error.message : 'Please try again.'}`,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Create New Quiz</h2>
          <p className="text-muted-foreground">Add quiz details and questions</p>
        </div>
        <Link href={`${basePath}/${assessmentType}`}>
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Quiz Details */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Quiz Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Quiz Title</Label>
              <Input
                id="title"
                placeholder="e.g., Quiz 1: Basic Circuits"
                value={quizData.title}
                onChange={(e) => setQuizData({ ...quizData, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the quiz topics"
                value={quizData.description}
                onChange={(e) => setQuizData({ ...quizData, description: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Time per Question (seconds)</Label>
              <Input
                id="time"
                type="number"
                min="10"
                max="300"
                value={quizData.time_per_question}
                onChange={(e) => setQuizData({ ...quizData, time_per_question: Number.parseInt(e.target.value) })}
                required
              />
            </div>

            <div className="flex items-center space-x-2 p-4 bg-muted/30 rounded-lg border">
              <input
                type="checkbox"
                id="sendNotifications"
                checked={sendNotifications}
                onChange={(e) => setSendNotifications(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="sendNotifications" className="cursor-pointer font-normal">
                <span className="font-semibold">Send notifications to students</span>
                <p className="text-sm text-muted-foreground mt-1">
                  Notify all students when this quiz is published. You can disable this to avoid notification overload.
                </p>
              </Label>
            </div>

            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h4 className="font-semibold text-sm">Retake Configuration</h4>
              <p className="text-xs text-muted-foreground">
                When enabled, the assessment allows multiple attempts for students who have Explorer, Trailblazer, or donation retake access
                (or an instructor/rollover extra-attempt grant). Turning this on does not give Scholar-tier students extra attempts.
              </p>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="retake_enabled"
                  checked={quizData.retake_enabled}
                  onChange={(e) => setQuizData({ ...quizData, retake_enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="retake_enabled" className="cursor-pointer font-normal">
                  Allow retakes for eligible students (membership perks apply)
                </Label>
              </div>

              {quizData.retake_enabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="retake_limit">Maximum Retakes</Label>
                    <Input
                      id="retake_limit"
                      type="number"
                      min="0"
                      max="10"
                      value={quizData.retake_limit}
                      onChange={(e) => setQuizData({ ...quizData, retake_limit: Number.parseInt(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      0 = no retakes (1 attempt total), 1 = one retake (2 attempts total), 2 = two retakes (3 attempts total), etc.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="retake_policy">Grading Policy</Label>
                    <Select
                      value={quizData.retake_policy}
                      onValueChange={(value) => setQuizData({ ...quizData, retake_policy: value })}
                    >
                      <SelectTrigger id="retake_policy">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="best">Best Score (Highest attempt counts)</SelectItem>
                        <SelectItem value="latest">Latest Score (Most recent attempt counts)</SelectItem>
                        <SelectItem value="average">Average Score (Average of all attempts)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choose how the final grade is calculated when students retake the quiz
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="review_before_retake"
                      checked={quizData.review_before_retake}
                      onChange={(e) => setQuizData({ ...quizData, review_before_retake: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="review_before_retake" className="cursor-pointer font-normal">
                      Require students to review incorrect answers before retaking
                    </Label>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Questions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-foreground">Questions</h3>
            <Button type="button" onClick={addQuestion} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Question
            </Button>
          </div>

          {questions.map((question, index) => (
            <Card
              key={index}
              className={`border-2 transition-all ${draggedIndex === index ? "opacity-50 scale-95" : ""}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="cursor-grab active:cursor-grabbing">
                      <GripVertical className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-lg">Question {index + 1}</CardTitle>
                  </div>
                  {questions.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeQuestion(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Question Type</Label>
                  <Select
                    value={question.question_type}
                    onValueChange={(value) => handleQuestionTypeChange(index, value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MCQ">Multiple Choice (Single Answer)</SelectItem>
                      <SelectItem value="TRUE_FALSE">True/False</SelectItem>
                      <SelectItem value="MULTI">Multiple Choice (Multiple Answers)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`time-${index}`}>
                    Time Limit (seconds)
                    <span className="text-sm text-muted-foreground ml-2">
                      Leave empty to use quiz default ({quizData.time_per_question}s)
                    </span>
                  </Label>
                  <Input
                    id={`time-${index}`}
                    type="number"
                    min="10"
                    max="300"
                    placeholder={`Default: ${quizData.time_per_question}s`}
                    value={question.time_limit || ""}
                    onChange={(e) => {
                      const value = e.target.value
                      updateQuestion(index, "time_limit", value === "" ? null : Number.parseInt(value))
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Question Text</Label>
                  <Textarea
                    placeholder="Enter the question"
                    value={question.question_text}
                    onChange={(e) => updateQuestion(index, "question_text", e.target.value)}
                    required
                  />
                </div>

                {question.question_type === "MCQ" && (
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Option A</Label>
                        <Input
                          placeholder="First option"
                          value={question.option_a}
                          onChange={(e) => updateQuestion(index, "option_a", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Option B</Label>
                        <Input
                          placeholder="Second option"
                          value={question.option_b}
                          onChange={(e) => updateQuestion(index, "option_b", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Option C</Label>
                        <Input
                          placeholder="Third option"
                          value={question.option_c}
                          onChange={(e) => updateQuestion(index, "option_c", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Option D</Label>
                        <Input
                          placeholder="Fourth option"
                          value={question.option_d}
                          onChange={(e) => updateQuestion(index, "option_d", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Option E (Optional)</Label>
                        <Input
                          placeholder="Fifth option (leave empty if only 4 options needed)"
                          value={question.option_e}
                          onChange={(e) => updateQuestion(index, "option_e", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Correct Answer</Label>
                      <Select
                        value={question.correct_answer}
                        onValueChange={(value) => updateQuestion(index, "correct_answer", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">A</SelectItem>
                          <SelectItem value="B">B</SelectItem>
                          <SelectItem value="C">C</SelectItem>
                          <SelectItem value="D">D</SelectItem>
                          {question.option_e && <SelectItem value="E">E</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {question.question_type === "TRUE_FALSE" && (
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Option A (True)</Label>
                        <Input value="True" disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>Option B (False)</Label>
                        <Input value="False" disabled />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Correct Answer</Label>
                      <Select
                        value={question.correct_answer}
                        onValueChange={(value) => updateQuestion(index, "correct_answer", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">True</SelectItem>
                          <SelectItem value="B">False</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {question.question_type === "MULTI" && (
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Option A</Label>
                        <Input
                          placeholder="First option"
                          value={question.option_a}
                          onChange={(e) => updateQuestion(index, "option_a", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Option B</Label>
                        <Input
                          placeholder="Second option"
                          value={question.option_b}
                          onChange={(e) => updateQuestion(index, "option_b", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Option C</Label>
                        <Input
                          placeholder="Third option (optional)"
                          value={question.option_c}
                          onChange={(e) => updateQuestion(index, "option_c", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Option D</Label>
                        <Input
                          placeholder="Fourth option (optional)"
                          value={question.option_d}
                          onChange={(e) => updateQuestion(index, "option_d", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Option E (Optional)</Label>
                        <Input
                          placeholder="Fifth option (optional)"
                          value={question.option_e}
                          onChange={(e) => updateQuestion(index, "option_e", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Correct Answers (Select all that apply)</Label>
                      <div className="space-y-2">
                        {["A", "B", "C", "D", "E"].map((option) => {
                          const optionKey = `option_${option.toLowerCase()}` as keyof Question
                          const optionValue = question[optionKey] as string
                          if (!optionValue) return null

                          const correctAnswers = question.correct_answer ? JSON.parse(question.correct_answer) : []
                          const isChecked = correctAnswers.includes(option)

                          return (
                            <label key={option} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  let newCorrectAnswers = [...correctAnswers]
                                  if (e.target.checked) {
                                    if (!newCorrectAnswers.includes(option)) {
                                      newCorrectAnswers.push(option)
                                    }
                                  } else {
                                    newCorrectAnswers = newCorrectAnswers.filter((a) => a !== option)
                                  }
                                  updateQuestion(index, "correct_answer", JSON.stringify(newCorrectAnswers.sort()))
                                }}
                                className="w-4 h-4"
                              />
                              <span>
                                {option}: {optionValue}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link href={`${basePath}/${assessmentType}`}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" className="bg-accent hover:bg-accent/90" disabled={loading}>
            {loading ? "Creating..." : "Create Quiz"}
          </Button>
        </div>
      </form>
    </div>
  )
}
