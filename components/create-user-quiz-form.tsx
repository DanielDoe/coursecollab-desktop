"use client"


import { studentApiFetch } from "@/lib/auth"
import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Trash2, GripVertical, Zap, Settings, FileText, Clock, Users } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { motion } from "framer-motion"

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

export function CreateUserQuizForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [quizData, setQuizData] = useState({
    title: "",
    description: "",
    time_per_question: 60,
    is_public: false,
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

  useEffect(() => {
    const studentId = sessionStorage.getItem("studentId")
    if (!studentId) router.push("/student/login")
  }, [router])

  const addQuestion = () =>
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

  const handleDragStart = (index: number) => setDraggedIndex(index)
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
  const handleDragEnd = () => setDraggedIndex(null)

  const handleQuestionTypeChange = (index: number, type: string) => {
    const updated = [...questions]
    if (type === "TRUE_FALSE") {
      updated[index] = {
        question_text: updated[index].question_text,
        question_type: type,
        time_limit: updated[index].time_limit,
        option_a: "True",
        option_b: "False",
        correct_answer: "A",
      }
    } else if (type === "MULTI") {
      updated[index] = {
        question_text: updated[index].question_text,
        question_type: type,
        time_limit: updated[index].time_limit,
        correct_answer: JSON.stringify(["A"]),
      }
    } else {
      updated[index] = {
        question_text: updated[index].question_text,
        question_type: "MCQ",
        time_limit: updated[index].time_limit,
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
    }

    try {
      const response = await studentApiFetch("/api/student/quizzes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...quizData, questions }),
      })

      if (!response.ok) throw new Error("Failed to create quiz")

      toast({
        title: "Quiz created",
        description: quizData.is_public
          ? "Your quiz has been created and is now public!"
          : "Your quiz has been created as private.",
      })

      router.push("/student/dashboard-v2/my-quizzes")
    } catch (error) {
      console.error("[v0] Failed to create quiz:", error)
      toast({
        title: "Failed to create quiz",
        description: "An error occurred while creating the quiz. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
      <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
        {/* Quiz Details */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <Card className="border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm rounded-2xl overflow-hidden shadow-sm">
            <CardHeader className="pb-4 sm:pb-6 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 rounded-xl bg-violet-500/15 dark:bg-violet-500/25 shrink-0">
                  <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Quiz Configuration</CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Set up your quiz details and preferences</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2 sm:space-y-3">
                  <Label htmlFor="title" className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
                    Quiz Title
                  </Label>
                  <Input
                    id="title"
                    placeholder="e.g., Practice Quiz: Ohm's Law"
                    value={quizData.title}
                    onChange={(e) => setQuizData({ ...quizData, title: e.target.value })}
                    className="rounded-xl border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 focus:ring-2 focus:ring-violet-500/50 dark:focus:ring-violet-400/30"
                    required
                  />
                </div>

                <div className="space-y-2 sm:space-y-3">
                  <Label htmlFor="time" className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
                    Time per Question (seconds)
                  </Label>
                  <Input
                    id="time"
                    type="number"
                    min="10"
                    max="300"
                    value={quizData.time_per_question}
                    onChange={(e) =>
                      setQuizData({ ...quizData, time_per_question: Number.parseInt(e.target.value) })
                    }
                    className="rounded-xl border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 focus:ring-2 focus:ring-violet-500/50 dark:focus:ring-violet-400/30"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2 sm:space-y-3">
                <Label htmlFor="description" className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
                  Description
                </Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of what this quiz covers"
                  value={quizData.description}
                  onChange={(e) => setQuizData({ ...quizData, description: e.target.value })}
                  className="rounded-xl border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 focus:ring-2 focus:ring-violet-500/50 dark:focus:ring-violet-400/30 min-h-[80px] sm:min-h-[100px]"
                  required
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-6 bg-violet-500/5 dark:bg-violet-500/10 rounded-2xl border border-violet-200/60 dark:border-violet-500/20">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2.5 sm:p-3 rounded-xl bg-violet-500/15 dark:bg-violet-500/25 shrink-0">
                    <Users className="h-5 w-5 sm:h-6 sm:w-6 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor="is_public" className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                      Make quiz public
                    </Label>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5 sm:mt-1">
                      Allow other students to discover and take your quiz
                    </p>
                  </div>
                </div>
                <Switch
                  id="is_public"
                  checked={quizData.is_public}
                  onCheckedChange={(checked) => setQuizData({ ...quizData, is_public: checked })}
                  className="data-[state=checked]:bg-violet-600 dark:data-[state=checked]:bg-violet-500 shrink-0"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Questions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="space-y-4 sm:space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-xl bg-violet-500/15 dark:bg-violet-500/25 shrink-0">
                <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-200">Questions</h3>
            </div>
            <Button 
              type="button" 
              onClick={addQuestion} 
              variant="outline" 
              className="rounded-xl bg-white/80 dark:bg-white/5 border-slate-200/80 dark:border-white/10 hover:bg-violet-500/10 dark:hover:bg-violet-500/20 hover:border-violet-300/60 dark:hover:border-violet-500/30 transition-all duration-200 shrink-0 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Question
            </Button>
          </div>

          {questions.map((question, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card
                className={`border bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm rounded-2xl shadow-sm transition-all duration-200 ${
                  draggedIndex === index 
                    ? "opacity-70 scale-[0.98] border-violet-400/60 dark:border-violet-500/40 shadow-lg" 
                    : "border-slate-200/80 dark:border-white/10 hover:border-violet-300/50 dark:hover:border-violet-500/30"
                }`}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
              >
                <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-violet-500/15 dark:bg-violet-500/25 shrink-0 cursor-grab active:cursor-grabbing">
                        <GripVertical className="h-4 w-4 sm:h-5 sm:w-5 text-violet-600 dark:text-violet-400" />
                      </div>
                      <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-slate-800 dark:text-slate-200 truncate">Question {index + 1}</CardTitle>
                    </div>
                    {questions.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQuestion(index)}
                        className="rounded-xl hover:bg-red-500/10 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0">
                  {/* Type and Time */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2 sm:space-y-3">
                      <Label className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">Question Type</Label>
                      <Select
                        value={question.question_type}
                        onValueChange={(value) => handleQuestionTypeChange(index, value)}
                      >
                        <SelectTrigger className="rounded-xl border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 focus:ring-2 focus:ring-violet-500/50 dark:focus:ring-violet-400/30">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MCQ">Multiple Choice (Single Answer)</SelectItem>
                          <SelectItem value="TRUE_FALSE">True / False</SelectItem>
                          <SelectItem value="MULTI">Multiple Choice (Multiple Answers)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 sm:space-y-3">
                      <Label htmlFor={`time-${index}`} className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">
                        Time Limit (seconds)
                        <span className="ml-1 sm:ml-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-normal">
                          Default: {quizData.time_per_question}s
                        </span>
                      </Label>
                      <Input
                        id={`time-${index}`}
                        type="number"
                        min="10"
                        max="300"
                        placeholder={`Default: ${quizData.time_per_question}s`}
                        value={question.time_limit || ""}
                        onChange={(e) =>
                          updateQuestion(
                            index,
                            "time_limit",
                            e.target.value === "" ? null : Number.parseInt(e.target.value)
                          )
                        }
                        className="rounded-xl border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 focus:ring-2 focus:ring-violet-500/50 dark:focus:ring-violet-400/30"
                      />
                    </div>
                  </div>

                  {/* Question Text */}
                  <div className="space-y-2 sm:space-y-3">
                    <Label className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">Question Text</Label>
                    <Textarea
                      placeholder="Enter the question"
                      value={question.question_text}
                      onChange={(e) => updateQuestion(index, "question_text", e.target.value)}
                      className="rounded-xl border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 focus:ring-2 focus:ring-violet-500/50 dark:focus:ring-violet-400/30 min-h-[100px] sm:min-h-[120px]"
                      required
                    />
                  </div>

                  {/* MCQ */}
                  {question.question_type === "MCQ" && (
                    <>
                      <div className="space-y-3 sm:space-y-4">
                        <Label className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">Answer Options</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          {["A", "B", "C", "D", "E"].map((opt) => (
                            <div
                              key={opt}
                              className={`space-y-2 sm:space-y-3 ${opt === "E" ? "sm:col-span-2" : ""}`}
                            >
                              <Label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
                                {`Option ${opt}${opt === "E" ? " (Optional)" : ""}`}
                              </Label>
                              <Input
                                placeholder={`Option ${opt}`}
                                value={question[`option_${opt.toLowerCase()}` as keyof Question] || ""}
                                onChange={(e) =>
                                  updateQuestion(index, `option_${opt.toLowerCase()}` as keyof Question, e.target.value)
                                }
                                className="rounded-xl border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 focus:ring-2 focus:ring-violet-500/50 dark:focus:ring-violet-400/30"
                                required={opt !== "E"}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2 sm:space-y-3">
                        <Label className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">Correct Answer</Label>
                        <Select
                          value={question.correct_answer}
                          onValueChange={(value) => updateQuestion(index, "correct_answer", value)}
                        >
                          <SelectTrigger className="rounded-xl border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 focus:ring-2 focus:ring-violet-500/50 dark:focus:ring-violet-400/30">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["A", "B", "C", "D", "E"].map(
                              (opt) =>
                                question[`option_${opt.toLowerCase()}` as keyof Question] && (
                                  <SelectItem key={opt} value={opt}>
                                    {opt}
                                  </SelectItem>
                                )
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {/* TRUE / FALSE */}
                  {question.question_type === "TRUE_FALSE" && (
                    <>
                      <div className="space-y-3 sm:space-y-4">
                        <Label className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">Answer Options</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <div className="space-y-2 sm:space-y-3">
                            <Label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">Option A (True)</Label>
                            <Input value="True" disabled className="rounded-xl bg-slate-100/80 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-white/10" />
                          </div>
                          <div className="space-y-2 sm:space-y-3">
                            <Label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">Option B (False)</Label>
                            <Input value="False" disabled className="rounded-xl bg-slate-100/80 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-white/10" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 sm:space-y-3">
                        <Label className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">Correct Answer</Label>
                        <Select
                          value={question.correct_answer}
                          onValueChange={(value) => updateQuestion(index, "correct_answer", value)}
                        >
                          <SelectTrigger className="rounded-xl border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 focus:ring-2 focus:ring-violet-500/50 dark:focus:ring-violet-400/30">
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

                  {/* MULTI */}
                  {question.question_type === "MULTI" && (
                    <>
                      <div className="space-y-3 sm:space-y-4">
                        <Label className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">Answer Options</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          {["A", "B", "C", "D", "E"].map((opt) => (
                            <div
                              key={opt}
                              className={`space-y-2 sm:space-y-3 ${opt === "E" ? "sm:col-span-2" : ""}`}
                            >
                              <Label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
                                {`Option ${opt}${opt === "E" ? " (Optional)" : ""}`}
                              </Label>
                              <Input
                                placeholder={`Option ${opt}`}
                                value={question[`option_${opt.toLowerCase()}` as keyof Question] || ""}
                                onChange={(e) =>
                                  updateQuestion(index, `option_${opt.toLowerCase()}` as keyof Question, e.target.value)
                                }
                                className="rounded-xl border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 focus:ring-2 focus:ring-violet-500/50 dark:focus:ring-violet-400/30"
                                required={opt === "A" || opt === "B"}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3 sm:space-y-4">
                        <Label className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">Correct Answers (Select all that apply)</Label>
                        <div className="space-y-2 sm:space-y-3 p-3 sm:p-4 bg-violet-500/5 dark:bg-violet-500/10 rounded-xl border border-violet-200/40 dark:border-violet-500/20">
                          {["A", "B", "C", "D", "E"].map((opt) => {
                            const key = `option_${opt.toLowerCase()}` as keyof Question
                            const value = question[key] as string
                            if (!value) return null
                            const correctAnswers = question.correct_answer
                              ? JSON.parse(question.correct_answer)
                              : []
                            const isChecked = correctAnswers.includes(opt)

                            return (
                              <label
                                key={opt}
                                className="flex items-center gap-3 cursor-pointer p-2.5 sm:p-3 rounded-lg hover:bg-white/60 dark:hover:bg-violet-500/10 transition-colors duration-200"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    let newAnswers = [...correctAnswers]
                                    if (e.target.checked) {
                                      if (!newAnswers.includes(opt)) newAnswers.push(opt)
                                    } else {
                                      newAnswers = newAnswers.filter((a) => a !== opt)
                                    }
                                    updateQuestion(
                                      index,
                                      "correct_answer",
                                      JSON.stringify(newAnswers.sort())
                                    )
                                  }}
                                  className="w-4 h-4 text-violet-600 dark:text-violet-400 rounded focus:ring-2 focus:ring-violet-500/50 dark:focus:ring-violet-400/30"
                                />
                                <span className="text-sm sm:text-base text-slate-700 dark:text-slate-300 font-medium">
                                  {opt}: {value}
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
          </motion.div>
          ))}
        </motion.div>

        {/* Submit */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 pt-4 sm:pt-6"
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/student/dashboard-v2")}
            className="rounded-xl bg-white/80 dark:bg-white/5 border-slate-200/80 dark:border-white/10 hover:bg-slate-100/80 dark:hover:bg-white/10 transition-all duration-200 px-6 sm:px-8 py-2.5 sm:py-3 w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl shadow-md hover:shadow-lg dark:shadow-violet-900/30 transition-all duration-200 px-6 sm:px-8 py-2.5 sm:py-3 font-semibold w-full sm:w-auto disabled:opacity-70"
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Creating...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Create Quiz
              </div>
            )}
          </Button>
        </motion.div>
      </form>
    </div>
  )
}
