"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Shuffle, ListChecks, CheckCircle2, Clock, FileText, Settings, Eye, ChevronRight, ChevronLeft, Check } from "lucide-react"
import { useAssessment } from "@/context/assessment-context"

interface Question {
  id: number
  question_text: string
  question_type: string
  difficulty: string
  topic: string | null
}

interface CreateQuizFromBankProps {
  onSuccess?: () => void
  assessmentType?: "quiz" | "mid_semester" | "final"
}

const DEFAULT_TIME_LIMITS: Record<string, number> = {
  true_false: 30,
  mcq: 50,
  select_all: 60,
  fill_blank: 45,
  code_output: 75,
  code_debug: 90,
  fill_code: 60,
  trace_logic: 80,
  scenario_match: 70,
  multi_output: 80,
  code_reorder: 100,
  code_problem: 150,
  trace_output: 90,
  debug_code: 120,
  code_write: 180,
  code_explain: 120,
}

export function CreateQuizFromBank({ onSuccess, assessmentType = "quiz" }: CreateQuizFromBankProps = {}) {
  const router = useRouter()
  const { toast } = useToast()
  const assessment = useAssessment()
  const [currentStep, setCurrentStep] = useState(1)
  const [creating, setCreating] = useState(false)
  const [lastCreatedQuiz, setLastCreatedQuiz] = useState<{ id: number; title: string } | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([])
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([])
  const [selectionMode, setSelectionMode] = useState<"random" | "manual">("random")
  const [customTimeLimits, setCustomTimeLimits] = useState<Record<number, number>>({})
  const [randomConfig, setRandomConfig] = useState({
    count: 10,
    difficulty: "all",
    topic: "all",
    question_types: [] as string[],
  })
  const [quizData, setQuizData] = useState({
    title: "",
    description: "",
    time_limit: 0,
    available_from: "",
    available_until: "",
  })
  const [manualFilters, setManualFilters] = useState({
    difficulty: "all",
    topic: "all",
    question_types: [] as string[],
  })

  useEffect(() => {
    fetchQuestions()
  }, [])

  useEffect(() => {
    if (selectionMode === "manual") applyFilters()
  }, [manualFilters, questions, selectionMode])

  useEffect(() => {
    if (selectedQuestions.length > 0) {
      const totalSeconds = selectedQuestions.reduce((sum, qid) => {
        const question = questions.find((q) => q.id === qid)
        if (!question) return sum
        const timeLimit = customTimeLimits[qid] ?? DEFAULT_TIME_LIMITS[question.question_type] ?? 60
        return sum + timeLimit
      }, 0)
      setQuizData((prev) => ({ ...prev, time_limit: Math.ceil(totalSeconds / 60) }))
    } else {
      setQuizData((prev) => ({ ...prev, time_limit: 0 }))
    }
  }, [selectedQuestions, customTimeLimits, questions])

  const fetchQuestions = async () => {
    try {
      const response = await fetch("/api/admin/question-bank")
      const data = await response.json()
      setQuestions(data.questions || [])
      setFilteredQuestions(data.questions || [])
    } catch (error) {
      toast({
        title: "Failed to load questions",
        description: "An error occurred while loading the question bank.",
        variant: "destructive",
      })
    }
  }

  const applyFilters = () => {
    let filtered = [...questions]
    if (manualFilters.difficulty !== "all") filtered = filtered.filter((q) => q.difficulty === manualFilters.difficulty)
    if (manualFilters.topic !== "all") filtered = filtered.filter((q) => q.topic === manualFilters.topic)
    if (manualFilters.question_types.length > 0)
      filtered = filtered.filter((q) => manualFilters.question_types.includes(q.question_type))
    setFilteredQuestions(filtered)
  }

  const handleRandomSelection = () => {
    let pool = [...questions]
    if (randomConfig.difficulty !== "all") pool = pool.filter((q) => q.difficulty === randomConfig.difficulty)
    if (randomConfig.topic !== "all") pool = pool.filter((q) => q.topic === randomConfig.topic)
    if (randomConfig.question_types.length > 0)
      pool = pool.filter((q) => randomConfig.question_types.includes(q.question_type))

    if (pool.length === 0) {
      toast({
        title: "No questions available",
        description: "No questions match your filter criteria.",
        variant: "destructive",
      })
      return
    }

    const count = Math.min(randomConfig.count, pool.length)
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    setSelectedQuestions(shuffled.slice(0, count).map((q) => q.id))
    toast({
      title: "Questions selected",
      description: `Randomly selected ${count} questions from ${pool.length}.`,
    })
  }

  const toggleQuestion = (id: number) =>
    setSelectedQuestions((prev) => (prev.includes(id) ? prev.filter((qid) => qid !== id) : [...prev, id]))

  const selectByTopic = (topic: string) => {
    const topicQuestions = questions.filter((q) => q.topic === topic).map((q) => q.id)
    setSelectedQuestions((prev) => Array.from(new Set([...prev, ...topicQuestions])))
    toast({
      title: "Topic added",
      description: `Added ${topicQuestions.length} questions from ${topic}.`,
    })
  }

  const selectAll = () => setSelectedQuestions(filteredQuestions.map((q) => q.id))
  const clearSelection = () => {
    setSelectedQuestions([])
    setCustomTimeLimits({})
  }

  const updateQuestionTime = (id: number, seconds: number) =>
    setCustomTimeLimits((prev) => ({ ...prev, [id]: seconds }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quizData.title.trim()) {
      toast({ title: "Validation error", description: "Quiz title is required.", variant: "destructive" })
      return
    }
    if (selectedQuestions.length === 0) {
      toast({
        title: "No questions selected",
        description: "Please select at least one question.",
        variant: "destructive",
      })
      return
    }

    setCreating(true)
    setLastCreatedQuiz(null)
    const loadingToast = toast({
      title: "Creating quiz...",
      description: `Adding ${selectedQuestions.length} questions...`,
      duration: Number.POSITIVE_INFINITY,
    })

    try {
      // Normalize assessment type for API route
      const typeMap: Record<string, string> = {
        'quiz': 'quiz',
        'homework': 'homework',
        'mid_semester': 'midsem',
        'midsem': 'midsem',
        'final': 'final',
        'finals': 'final'
      }
      const normalizedType = typeMap[assessmentType] || 'quiz'

      // Get instructor/admin ID
      const instructorId = sessionStorage.getItem('adminId') || localStorage.getItem('instructorId') || '1'

      // Fetch question details from bank
      const questionDetails = await Promise.all(
        selectedQuestions.map(async (qid) => {
          const qResponse = await instructorApiFetch(`/api/instructor/question-bank?id=${qid}`)
          const qData = await qResponse.json()
          return qData.question
        })
      )

      const response = await fetch(`/api/${normalizedType}/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...quizData,
          questions: questionDetails.map((q, idx) => ({
            question_text: q.question_text,
            question_type: q.question_type,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            option_e: q.option_e,
            correct_answer: q.correct_answer,
            time_limit: customTimeLimits[q.id] || q.time_limit || null,
            points: q.points || q.max_points || 1,
            max_points: q.max_points || q.points || 1
          })),
          instructorId: Number(instructorId)
        }),
      })
      const result = await response.json()
      loadingToast.dismiss()
      if (!response.ok) throw new Error(result.error || "Failed to create quiz")
      setLastCreatedQuiz({ id: result.quiz_id, title: quizData.title })
      toast({
        title: "Quiz created successfully!",
        description: `"${quizData.title}" with ${result.questions_added} questions.`,
      })
      setQuizData({ title: "", description: "", time_limit: 0, available_from: "", available_until: "" })
      setSelectedQuestions([])
      setCustomTimeLimits({})

      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      loadingToast.dismiss()
      toast({
        title: "Failed to create quiz",
        description: error instanceof Error ? error.message : "An error occurred.",
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  const uniqueTopics = Array.from(new Set(questions.map((q) => q.topic).filter(Boolean)))
  const allQuestionTypes = [
    { value: "true_false", label: "True/False" },
    { value: "mcq", label: "Multiple Choice" },
    { value: "select_all", label: "Select All" },
    { value: "fill_blank", label: "Fill in Blank" },
    { value: "scenario_match", label: "Scenario Match" },
    { value: "code_output", label: "Code Output" },
    { value: "trace_logic", label: "Trace Logic" },
    { value: "trace_output", label: "Trace Output" },
    { value: "multi_output", label: "Multi Output" },
    { value: "fill_code", label: "Fill Code" },
    { value: "code_reorder", label: "Code Reorder" },
    { value: "code_problem", label: "Code Problem" },
    { value: "code_debug", label: "Code Debug" },
    { value: "debug_code", label: "Debug Code" },
    { value: "code_write", label: "Code Write" },
    { value: "code_explain", label: "Code Explain" },
  ]

  return (
    <div className="min-h-screen bg-secondary">
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {lastCreatedQuiz && (
            <Card className="border-2 border-green-500 bg-green-50/70 dark:bg-green-950/30 shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-3">
                    <h3 className="font-semibold text-green-900 dark:text-green-100">Quiz Created Successfully!</h3>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      "{lastCreatedQuiz.title}" is now available in the Quizzes tab.
                    </p>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setLastCreatedQuiz(null)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quiz Details */}
          <Card className="border border-slate-200/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <Clock className="h-4 w-4 text-blue-600" />
                Quiz Details
              </CardTitle>
              <p className="text-sm text-slate-600">Configure the basic information and timing for your quiz</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-medium text-slate-700">Quiz Title</Label>
                  <Input
                    id="title"
                    value={quizData.title}
                    onChange={(e) => setQuizData({ ...quizData, title: e.target.value })}
                    placeholder="Enter quiz title..."
                    required
                    className="h-11 border-slate-200 focus:border-blue-300 focus:ring-blue-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time_limit" className="text-sm font-medium text-slate-700">Total Time Limit (auto)</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      id="time_limit" 
                      type="number" 
                      readOnly 
                      value={quizData.time_limit} 
                      className="bg-slate-50 border-slate-200 text-slate-600 h-11" 
                    />
                    <span className="text-sm text-slate-500">minutes</span>
                  </div>
                  <p className="text-xs text-slate-500">Automatically calculated based on selected questions</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium text-slate-700">Description</Label>
                <Textarea
                  id="description"
                  value={quizData.description}
                  onChange={(e) => setQuizData({ ...quizData, description: e.target.value })}
                  placeholder="Optional quiz description..."
                  className="border-slate-200 focus:border-blue-300 focus:ring-blue-200"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="available_from" className="text-sm font-medium text-slate-700">Available From</Label>
                  <Input
                    id="available_from"
                    type="datetime-local"
                    value={quizData.available_from}
                    onChange={(e) => setQuizData({ ...quizData, available_from: e.target.value })}
                    className="h-11 border-slate-200 focus:border-blue-300 focus:ring-blue-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="available_until" className="text-sm font-medium text-slate-700">Available Until</Label>
                  <Input
                    id="available_until"
                    type="datetime-local"
                    value={quizData.available_until}
                    onChange={(e) => setQuizData({ ...quizData, available_until: e.target.value })}
                    className="h-11 border-slate-200 focus:border-blue-300 focus:ring-blue-200"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selection Tabs */}
          <Card className="border border-slate-200/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-green-600" />
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-800">
                      Select Questions ({selectedQuestions.length} selected)
                    </CardTitle>
                    <p className="text-sm text-slate-600">Choose questions from your question bank using random or manual selection</p>
                  </div>
                </div>
                {selectedQuestions.length > 0 && (
                  <Button type="button" variant="outline" size="sm" onClick={clearSelection} className="text-slate-600 border-slate-200 hover:bg-slate-50">
                    Clear Selection
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={selectionMode} onValueChange={(v) => setSelectionMode(v as any)}>
                <TabsList className="grid w-full grid-cols-2 rounded-xl bg-slate-100 h-12">
                  <TabsTrigger value="random" className="flex items-center justify-center gap-2 text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    <Shuffle className="h-4 w-4" /> Random Selection
                  </TabsTrigger>
                  <TabsTrigger value="manual" className="flex items-center justify-center gap-2 text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    <ListChecks className="h-4 w-4" /> Manual Selection
                  </TabsTrigger>
                </TabsList>

                {/* --- RANDOM SELECTION TAB --- */}
                <TabsContent value="random" className="space-y-6 mt-6">
                  <div className="space-y-6">
                    <div className="flex items-start gap-3">
                      <Shuffle className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">Random Selection</p>
                        <p className="text-sm text-slate-600">
                          Automatically select a random set of questions based on your filters below.
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Number of Questions */}
                      <div className="space-y-2">
                        <Label htmlFor="random-count" className="text-sm font-medium text-slate-700">Number of Questions</Label>
                        <Input
                          id="random-count"
                          type="number"
                          min="1"
                          max={questions.length}
                          value={randomConfig.count}
                          onChange={(e) =>
                            setRandomConfig({ ...randomConfig, count: Number.parseInt(e.target.value) || 1 })
                          }
                          className="h-11 border-slate-200 focus:border-blue-300 focus:ring-blue-200"
                        />
                        <p className="text-xs text-slate-500">Available: {questions.length} questions</p>
                      </div>

                      {/* Difficulty */}
                      <div className="space-y-2">
                        <Label htmlFor="random-difficulty" className="text-sm font-medium text-slate-700">Difficulty</Label>
                        <Select
                          value={randomConfig.difficulty}
                          onValueChange={(value) => setRandomConfig({ ...randomConfig, difficulty: value })}
                        >
                          <SelectTrigger id="random-difficulty" className="h-11 border-slate-200 focus:border-blue-300 focus:ring-blue-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Difficulties</SelectItem>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Topic */}
                      <div className="space-y-2">
                        <Label htmlFor="random-topic" className="text-sm font-medium text-slate-700">Topic</Label>
                        <Select
                          value={randomConfig.topic}
                          onValueChange={(value) => setRandomConfig({ ...randomConfig, topic: value })}
                        >
                          <SelectTrigger id="random-topic" className="h-11 border-slate-200 focus:border-blue-300 focus:ring-blue-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Topics</SelectItem>
                            {uniqueTopics.map((topic) => (
                              <SelectItem key={topic} value={topic!}>
                                {topic}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Question Types */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700">Question Types (Select Multiple)</Label>
                        <div className="border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto bg-white space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={randomConfig.question_types.length === 0}
                              onCheckedChange={(checked) =>
                                checked && setRandomConfig({ ...randomConfig, question_types: [] })
                              }
                            />
                            <span className="text-sm text-slate-700">All Types</span>
                          </label>
                          {allQuestionTypes.map((type) => (
                            <label key={type.value} className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={randomConfig.question_types.includes(type.value)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setRandomConfig({
                                      ...randomConfig,
                                      question_types: [...randomConfig.question_types, type.value],
                                    })
                                  } else {
                                    setRandomConfig({
                                      ...randomConfig,
                                      question_types: randomConfig.question_types.filter((t) => t !== type.value),
                                    })
                                  }
                                }}
                              />
                              <span className="text-sm text-slate-700">{type.label}</span>
                            </label>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500">
                          {randomConfig.question_types.length === 0
                            ? "All question types selected"
                            : `${randomConfig.question_types.length} type(s) selected`}
                        </p>
                      </div>
                    </div>

                    <Button type="button" onClick={handleRandomSelection} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                      <Shuffle className="h-4 w-4 mr-2" />
                      Generate Random Selection
                    </Button>
                  </div>

                  {/* Selected Questions Display */}
                  {selectedQuestions.length > 0 && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-slate-700">Selected Questions & Time Limits</Label>
                      <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                        {questions
                          .filter((q) => selectedQuestions.includes(q.id))
                          .map((question, idx) => {
                            const defaultTime = DEFAULT_TIME_LIMITS[question.question_type] ?? 60
                            const currentTime = customTimeLimits[question.id] ?? defaultTime
                            return (
                              <div
                                key={question.id}
                                className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                              >
                                <span className="font-medium text-slate-600 mt-1">{idx + 1}.</span>
                                <div className="flex-1 space-y-2">
                                  <p className="text-sm line-clamp-2 text-slate-800">{question.question_text}</p>
                                  <div className="flex gap-2 flex-wrap">
                                    <Badge variant="outline" className="text-xs border-blue-200 text-blue-700">
                                      {question.difficulty}
                                    </Badge>
                                    {question.topic && (
                                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                        {question.topic}
                                      </Badge>
                                    )}
                                    <Badge variant="outline" className="text-xs border-purple-200 text-purple-700">
                                      {question.question_type}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <Clock className="h-4 w-4 text-slate-500" />
                                  <Input
                                    type="number"
                                    min="10"
                                    max="600"
                                    value={currentTime}
                                    onChange={(e) =>
                                      updateQuestionTime(question.id, Number.parseInt(e.target.value) || defaultTime)
                                    }
                                    className="w-16 h-8 text-xs border-slate-200 focus:border-blue-300"
                                  />
                                  <span className="text-xs text-slate-500">sec</span>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* --- MANUAL SELECTION TAB --- */}
                <TabsContent value="manual" className="space-y-6 mt-6">
                    {uniqueTopics.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700">Quick Select by Topic</Label>
                        <div className="flex flex-wrap gap-2">
                          {uniqueTopics.map((topic) => {
                            const topicCount = questions.filter((q) => q.topic === topic).length
                            return (
                              <Button
                                key={topic}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-full bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                                onClick={() => selectByTopic(topic!)}
                              >
                                {topic} ({topicCount})
                              </Button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="filter-difficulty" className="text-sm font-medium text-slate-700">Filter by Difficulty</Label>
                      <Select
                        value={manualFilters.difficulty}
                        onValueChange={(value) => setManualFilters({ ...manualFilters, difficulty: value })}
                      >
                        <SelectTrigger id="filter-difficulty" className="h-11 border-slate-200 focus:border-blue-300 focus:ring-blue-200">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="filter-topic" className="text-sm font-medium text-slate-700">Filter by Topic</Label>
                      <Select
                        value={manualFilters.topic}
                        onValueChange={(value) => setManualFilters({ ...manualFilters, topic: value })}
                      >
                        <SelectTrigger id="filter-topic" className="h-11 border-slate-200 focus:border-blue-300 focus:ring-blue-200">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {uniqueTopics.map((topic) => (
                            <SelectItem key={topic} value={topic!}>
                              {topic}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Filter by Types (Multiple)</Label>
                      <div className="border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto bg-white space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={manualFilters.question_types.length === 0}
                            onCheckedChange={(checked) =>
                              checked && setManualFilters({ ...manualFilters, question_types: [] })
                            }
                          />
                          <span className="text-sm text-slate-700">All Types</span>
                        </label>
                        {allQuestionTypes.map((type) => (
                          <label key={type.value} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={manualFilters.question_types.includes(type.value)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setManualFilters({
                                    ...manualFilters,
                                    question_types: [...manualFilters.question_types, type.value],
                                  })
                                } else {
                                  setManualFilters({
                                    ...manualFilters,
                                    question_types: manualFilters.question_types.filter((t) => t !== type.value),
                                  })
                                }
                              }}
                            />
                            <span className="text-sm text-slate-700">{type.label}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500">
                        {manualFilters.question_types.length === 0
                          ? "All question types selected"
                          : `${manualFilters.question_types.length} type(s) selected`}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectAll}
                      className="rounded-full bg-transparent"
                    >
                      Select All Filtered
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto border rounded-xl p-3 bg-background/70 backdrop-blur-sm">
                    {filteredQuestions.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No questions found matching filters.</p>
                    ) : (
                      filteredQuestions.map((question) => (
                        <div
                          key={question.id}
                          className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                            selectedQuestions.includes(question.id)
                              ? "border-accent bg-accent/5"
                              : "hover:border-muted-foreground/30"
                          }`}
                          onClick={() => toggleQuestion(question.id)}
                        >
                          <Checkbox checked={selectedQuestions.includes(question.id)} className="mt-1" />
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium line-clamp-2">{question.question_text}</p>
                            <div className="flex gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {question.difficulty}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {question.question_type}
                              </Badge>
                              {question.topic && (
                                <Badge variant="secondary" className="text-xs">
                                  {question.topic}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              className="bg-accent hover:bg-accent/90 rounded-full px-6 py-2"
              disabled={creating || selectedQuestions.length === 0}
            >
              {creating
                ? "Creating..."
                : `Create Quiz (${selectedQuestions.length} questions, ${quizData.time_limit} min)`}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
