"use client"

import type React from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { universalToast } from "@/lib/toast-utils"
import { Plus, Trash2, ArrowLeft, GripVertical } from "lucide-react"
import Link from "next/link"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { AddQuestionModal } from "@/components/add-question-modal"
import { Switch } from "@/components/ui/switch"

interface Question {
  id?: number
  question_text: string
  time_limit?: number | null
  question_type?: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  option_e?: string
  correct_answer: string
}

interface Session {
  id: number
  code: string
  description: string
}

export function EditMidSemesterForm({ examId }: { examId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const isInstructorPath = pathname?.includes("/instructor") || false
  const userType = isInstructorPath ? "instructor" : "admin"
  const basePath = isInstructorPath ? "/instructor" : "/admin"
  
  usePreventBack(isInstructorPath ? "/instructor/login" : "/admin/login")
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState("details")
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [examData, setExamData] = useState({
    title: "",
    description: "",
    coverage: "Ch. 1-5",
    time_per_question: 60,
    is_public: false,
    available_from: "",
    available_until: "",
    retake_enabled: true,
    retake_limit: 0,
    session_access: {} as Record<string, boolean>,
  })
  const [questions, setQuestions] = useState<Question[]>([])

  useEffect(() => {
    const adminId = sessionStorage.getItem("adminId")
    const instructorSession = localStorage.getItem("instructorSession")
    
    if (!adminId && !instructorSession) {
      router.push(`${basePath}/login`)
      return
    }

    fetchSessions()
    fetchExam()
  }, [examId, router, basePath])

  const fetchSessions = async () => {
    try {
      const response = await fetch(`/api/${userType}/sessions`)
      const data = await response.json()
      setSessions(data.sessions || [])
    } catch (error) {
      console.error("Failed to fetch sessions:", error)
    }
  }

  const fetchExam = async () => {
    try {
      const response = await fetch(`/api/${userType}/mid-semesters/${examId}`)
      const data = await response.json()

      const formatDateTimeLocal = (dateString: string | null) => {
        if (!dateString) return ""
        const date = new Date(dateString)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, "0")
        const day = String(date.getDate()).padStart(2, "0")
        const hours = String(date.getHours()).padStart(2, "0")
        const minutes = String(date.getMinutes()).padStart(2, "0")
        return `${year}-${month}-${day}T${hours}:${minutes}`
      }

      setExamData({
        title: data.exam.title,
        description: data.exam.description,
        coverage: data.exam.coverage || "Ch. 1-5",
        time_per_question: data.exam.time_per_question,
        is_public: data.exam.is_public,
        available_from: formatDateTimeLocal(data.exam.available_from),
        available_until: formatDateTimeLocal(data.exam.available_until),
        retake_enabled: data.exam.retake_enabled ?? true,
        retake_limit: data.exam.retake_limit || 0,
        session_access: data.exam.session_access || {},
      })

      setQuestions(data.questions || [])
    } catch (error) {
      console.error("Failed to fetch exam:", error)
      toast({
        title: "Failed to load exam",
        description: "An error occurred while loading the exam. Redirecting...",
        variant: "destructive",
      })
      router.push(`${basePath}/mid-semester-exams`)
    } finally {
      setLoading(false)
    }
  }

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        question_text: "",
        time_limit: null,
        question_type: "mcq",
        option_a: "",
        option_b: "",
        option_c: "",
        option_d: "",
        option_e: "",
        correct_answer: "A",
      },
    ])
  }

  const addQuestionFromBank = (bankQuestion: any) => {
    const options = bankQuestion.options || []
    const newQuestion: Question = {
      question_text: bankQuestion.question_text,
      time_limit: null,
      question_type: bankQuestion.question_type,
      option_a: options[0] || "",
      option_b: options[1] || "",
      option_c: options[2] || "",
      option_d: options[3] || "",
      option_e: options[4] || "",
      correct_answer: Array.isArray(bankQuestion.correct_answer)
        ? JSON.stringify(bankQuestion.correct_answer)
        : bankQuestion.correct_answer,
    }
    setQuestions([...questions, newQuestion])
    toast({
      title: "Question added",
      description: "Question from bank has been added to the exam.",
    })
  }

  const removeQuestion = (index: number) => {
    if (questions.length === 1) {
      toast({
        title: "Cannot remove question",
        description: "Exam must have at least one question.",
        variant: "destructive",
      })
      return
    }
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const updateQuestion = (index: number, field: keyof Question, value: string | number | null) => {
    const updated = [...questions]
    if (
      field === "option_a" ||
      field === "option_b" ||
      field === "option_c" ||
      field === "option_d" ||
      field === "option_e" ||
      field === "question_text" ||
      field === "correct_answer"
    ) {
      updated[index] = { ...updated[index], [field]: value ?? "" }
    } else {
      updated[index] = { ...updated[index], [field]: value }
    }
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

  const handleToggleSession = (sessionCode: string) => {
    setExamData({
      ...examData,
      session_access: {
        ...examData.session_access,
        [sessionCode]: !examData.session_access[sessionCode],
      },
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const convertToUTC = (dateTimeLocal: string) => {
        if (!dateTimeLocal) return null
        const localDate = new Date(dateTimeLocal)
        return localDate.toISOString()
      }

      const response = await fetch(`/api/${userType}/mid-semesters/${examId}/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: examData.title,
          description: examData.description || null,
          coverage: examData.coverage,
          time_per_question: examData.time_per_question,
          is_public: examData.is_public,
          available_from: convertToUTC(examData.available_from),
          available_until: convertToUTC(examData.available_until),
          retake_enabled: examData.retake_enabled,
          retake_limit: examData.retake_limit,
          session_access: examData.session_access,
          questions,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update exam")
      }

      const activeSessions = Object.entries(examData.session_access).filter(([_, active]) => active).length

      universalToast({
        title: "✅ Mid-Semester Exam Updated Successfully",
        description: `"${examData.title}" has been updated with ${questions.length} question(s) across ${activeSessions} session(s).`,
      })

      // Delay redirect slightly to show toast
      setTimeout(() => {
        router.push(`${basePath}/mid-semester-exams`)
      }, 500)
    } catch (error) {
      console.error("Failed to update exam:", error)
      universalToast({
        title: "❌ Update Failed",
        description: `Failed to update "${examData.title}". ${error instanceof Error ? error.message : 'Please try again.'}`,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading exam...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Edit Mid-Semester Exam</h2>
          <p className="text-muted-foreground">Update exam details and questions</p>
        </div>
        <Link href={`${basePath}/mid-semester-exams`}>
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Exam Details</TabsTrigger>
            <TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger>
            <TabsTrigger value="time">Time Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            <Card className="border-2">
              <CardHeader>
                <CardTitle>Exam Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Exam Title</Label>
                  <Input
                    id="title"
                    value={examData.title}
                    onChange={(e) => setExamData({ ...examData, title: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={examData.description || ""}
                    onChange={(e) => setExamData({ ...examData, description: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="coverage">Coverage (e.g., Ch. 1-5, Lectures 1-10)</Label>
                  <Input
                    id="coverage"
                    value={examData.coverage}
                    onChange={(e) => setExamData({ ...examData, coverage: e.target.value })}
                    placeholder="Ch. 1-5"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Default Time per Question (seconds)</Label>
                  <Input
                    id="time"
                    type="number"
                    min="10"
                    max="300"
                    value={examData.time_per_question}
                    onChange={(e) => setExamData({ ...examData, time_per_question: Number.parseInt(e.target.value) })}
                    required
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="available_from">Available From (Optional)</Label>
                    <Input
                      id="available_from"
                      type="datetime-local"
                      value={examData.available_from}
                      onChange={(e) => setExamData({ ...examData, available_from: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="available_until">Available Until (Optional)</Label>
                    <Input
                      id="available_until"
                      type="datetime-local"
                      value={examData.available_until}
                      onChange={(e) => setExamData({ ...examData, available_until: e.target.value })}
                    />
                  </div>
                </div>

                {/* Session Access */}
                <div className="space-y-3 pt-3 border-t">
                  <p className="text-sm font-medium text-foreground">Session Access</p>
                  <div className="grid grid-cols-3 gap-4">
                    {sessions.map((session) => {
                      const isActive = examData.session_access?.[session.code] || false

                      return (
                        <div
                          key={session.code}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant={isActive ? "default" : "outline"} className={isActive ? "bg-success" : ""}>
                              {session.code}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch checked={isActive} onCheckedChange={() => handleToggleSession(session.code)} />
                            <span className="text-xs text-muted-foreground">{isActive ? "Active" : "Inactive"}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Retake Configuration */}
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <h4 className="font-semibold text-sm">Retake Configuration</h4>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="retake_enabled"
                      checked={examData.retake_enabled}
                      onChange={(e) => setExamData({ ...examData, retake_enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="retake_enabled" className="cursor-pointer font-normal">
                      Allow students to retake this exam
                    </Label>
                  </div>

                  {examData.retake_enabled && (
                    <div className="space-y-2">
                      <Label htmlFor="retake_limit">Maximum Retakes</Label>
                      <Input
                        id="retake_limit"
                        type="number"
                        min="0"
                        max="10"
                        value={examData.retake_limit}
                        onChange={(e) => setExamData({ ...examData, retake_limit: Number.parseInt(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">
                        0 = no retakes, 1 = one retake (2 total attempts), etc.
                      </p>
                    </div>
                  )}

                  {/* Attempt Override Manager */}
                  <div className="mt-4">
                    <AttemptOverrideManager quizId={examId} userType={userType} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-foreground">Questions</h3>
              <Button type="button" onClick={() => setShowAddQuestionModal(true)} variant="outline" size="sm">
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
                    <Label htmlFor={`type-${index}`}>Question Type</Label>
                    <Select
                      value={question.question_type || "mcq"}
                      onValueChange={(value) => updateQuestion(index, "question_type", value)}
                    >
                      <SelectTrigger id={`type-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mcq">Multiple Choice</SelectItem>
                        <SelectItem value="true_false">True/False</SelectItem>
                        <SelectItem value="select_all">Select All That Apply</SelectItem>
                        <SelectItem value="fill_blank">Fill in the Blank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Question Text</Label>
                    <Textarea
                      value={question.question_text || ""}
                      onChange={(e) => updateQuestion(index, "question_text", e.target.value)}
                      required
                    />
                  </div>

                  {/* Options and correct answer fields */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Option A</Label>
                      <Input
                        value={question.option_a}
                        onChange={(e) => updateQuestion(index, "option_a", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Option B</Label>
                      <Input
                        value={question.option_b}
                        onChange={(e) => updateQuestion(index, "option_b", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Option C</Label>
                      <Input
                        value={question.option_c}
                        onChange={(e) => updateQuestion(index, "option_c", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Option D</Label>
                      <Input
                        value={question.option_d}
                        onChange={(e) => updateQuestion(index, "option_d", e.target.value)}
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
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="time" className="space-y-4 mt-4">
            <Card className="border-2">
              <CardHeader>
                <CardTitle>Time Settings</CardTitle>
                <p className="text-sm text-muted-foreground mt-2">
                  Configure time limits for each question. Leave empty to use the default time (
                  {examData.time_per_question}s).
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {questions.map((question, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-medium line-clamp-2">
                        {question.question_text || "Untitled Question"}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {question.question_type || "mcq"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Label htmlFor={`time-${index}`} className="text-sm whitespace-nowrap">
                        Time Limit:
                      </Label>
                      <Input
                        id={`time-${index}`}
                        type="number"
                        min="10"
                        max="600"
                        placeholder={`${examData.time_per_question}`}
                        value={question.time_limit || ""}
                        onChange={(e) => {
                          const value = e.target.value
                          updateQuestion(index, "time_limit", value === "" ? null : Number.parseInt(value))
                        }}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">sec</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3">
          <Link href={`${basePath}/mid-semester-exams`}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" className="bg-accent hover:bg-accent/90" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>

      <AddQuestionModal
        open={showAddQuestionModal}
        onClose={() => setShowAddQuestionModal(false)}
        onAddNew={addQuestion}
        onAddFromBank={addQuestionFromBank}
      />
    </div>
  )
}
