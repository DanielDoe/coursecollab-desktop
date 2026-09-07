"use client"

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Shuffle, ListChecks, CheckCircle2, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Question {
  id: number
  question_text: string
  question_type: string
  difficulty: string
  topic: string | null
}

interface CreateMidSemesterFromBankProps {
  onSuccess?: () => void
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

export function CreateMidSemesterFromBank({ onSuccess }: CreateMidSemesterFromBankProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [creating, setCreating] = useState(false)
  const [lastCreatedExam, setLastCreatedExam] = useState<{ id: number; title: string } | null>(null)
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
  const [examData, setExamData] = useState({
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
      setExamData((prev) => ({ ...prev, time_limit: Math.ceil(totalSeconds / 60) }))
    } else {
      setExamData((prev) => ({ ...prev, time_limit: 0 }))
    }
  }, [selectedQuestions, customTimeLimits, questions])

  const fetchQuestions = async () => {
    try {
      const response = await fetch("/api/admin/question-bank")
      const data = await response.json()
      console.log("[v0] Fetched questions data:", data)
      setQuestions(data.questions || [])
      setFilteredQuestions(data.questions || [])
    } catch (error) {
      console.error("[v0] Failed to fetch questions:", error)
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
    if (!examData.title.trim()) {
      toast({ title: "Validation error", description: "Mid-semester title is required.", variant: "destructive" })
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
    setLastCreatedExam(null)
    const loadingToast = toast({
      title: "Creating mid-semester exam...",
      description: `Adding ${selectedQuestions.length} questions...`,
      duration: Number.POSITIVE_INFINITY,
    })

    try {
      const response = await fetch("/api/admin/mid-semesters/create-from-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...examData,
          question_ids: selectedQuestions,
          custom_time_limits: customTimeLimits,
        }),
      })
      const result = await response.json()
      loadingToast.dismiss()
      if (!response.ok) throw new Error(result.error || "Failed to create mid-semester exam")
      setLastCreatedExam({ id: result.mid_semester_id, title: examData.title })
      toast({
        title: "Mid-semester exam created successfully!",
        description: `"${examData.title}" with ${result.questions_added} questions.`,
      })
      setExamData({ title: "", description: "", time_limit: 0, available_from: "", available_until: "" })
      setSelectedQuestions([])
      setCustomTimeLimits({})
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      loadingToast.dismiss()
      toast({
        title: "Failed to create mid-semester exam",
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
          {lastCreatedExam && (
            <Card className="border-2 border-green-500 bg-green-50/70 dark:bg-green-950/30 shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-3">
                    <h3 className="font-semibold text-green-900 dark:text-green-100">
                      Mid-Semester Exam Created Successfully!
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      "{lastCreatedExam.title}" is now available.
                    </p>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setLastCreatedExam(null)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Exam Details */}
          <Card className="border border-border/50 shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Mid-Semester Exam Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Exam Title</Label>
                  <Input
                    id="title"
                    value={examData.title}
                    onChange={(e) => setExamData({ ...examData, title: e.target.value })}
                    placeholder="Enter mid-semester exam title..."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time_limit">Total Time Limit (auto)</Label>
                  <div className="flex items-center gap-2">
                    <Input id="time_limit" type="number" readOnly value={examData.time_limit} className="bg-muted" />
                    <span className="text-sm text-muted-foreground">minutes</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={examData.description}
                  onChange={(e) => setExamData({ ...examData, description: e.target.value })}
                  placeholder="Optional exam description..."
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="available_from">Available From</Label>
                  <Input
                    id="available_from"
                    type="datetime-local"
                    value={examData.available_from}
                    onChange={(e) => setExamData({ ...examData, available_from: e.target.value })}
                    className="rounded-lg h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="available_until">Available Until</Label>
                  <Input
                    id="available_until"
                    type="datetime-local"
                    value={examData.available_until}
                    onChange={(e) => setExamData({ ...examData, available_until: e.target.value })}
                    className="rounded-lg h-11"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selection Tabs */}
          <Card className="border border-border/50 shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Select Questions ({selectedQuestions.length} selected)</CardTitle>
                {selectedQuestions.length > 0 && (
                  <Button type="button" variant="outline" size="sm" onClick={clearSelection}>
                    Clear Selection
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={selectionMode} onValueChange={(v) => setSelectionMode(v as any)}>
                <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/50 h-12">
                  <TabsTrigger value="random" className="flex items-center justify-center gap-2 text-sm">
                    <Shuffle className="h-4 w-4" /> Random Selection
                  </TabsTrigger>
                  <TabsTrigger value="manual" className="flex items-center justify-center gap-2 text-sm">
                    <ListChecks className="h-4 w-4" /> Manual Selection
                  </TabsTrigger>
                </TabsList>

                {/* Random Selection Tab */}
                <TabsContent value="random" className="space-y-6 mt-6">
                  <div className="p-6 bg-muted/50 rounded-xl shadow-inner space-y-6">
                    <p className="text-sm text-muted-foreground">
                      Automatically select a random set of questions based on your filters below.
                    </p>

                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Number of Questions */}
                      <div className="space-y-2">
                        <Label htmlFor="random-count">Number of Questions</Label>
                        <Input
                          id="random-count"
                          type="number"
                          min="1"
                          max={questions.length}
                          value={randomConfig.count}
                          onChange={(e) =>
                            setRandomConfig({ ...randomConfig, count: Number.parseInt(e.target.value) || 1 })
                          }
                          className="h-11 rounded-lg"
                        />
                        <p className="text-xs text-muted-foreground">Available: {questions.length} questions</p>
                      </div>

                      {/* Difficulty */}
                      <div className="space-y-2">
                        <Label htmlFor="random-difficulty">Difficulty</Label>
                        <Select
                          value={randomConfig.difficulty}
                          onValueChange={(value) => setRandomConfig({ ...randomConfig, difficulty: value })}
                        >
                          <SelectTrigger id="random-difficulty" className="h-11 rounded-lg">
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
                        <Label htmlFor="random-topic">Topic</Label>
                        <Select
                          value={randomConfig.topic}
                          onValueChange={(value) => setRandomConfig({ ...randomConfig, topic: value })}
                        >
                          <SelectTrigger id="random-topic" className="h-11 rounded-lg">
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
                        <Label>Question Types (Select Multiple)</Label>
                        <div className="border rounded-xl p-3 max-h-48 overflow-y-auto bg-background space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={randomConfig.question_types.length === 0}
                              onCheckedChange={(checked) =>
                                checked && setRandomConfig({ ...randomConfig, question_types: [] })
                              }
                            />
                            <span className="text-sm">All Types</span>
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
                              <span className="text-sm">{type.label}</span>
                            </label>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {randomConfig.question_types.length === 0
                            ? "All question types selected"
                            : `${randomConfig.question_types.length} type(s) selected`}
                        </p>
                      </div>
                    </div>

                    <Button type="button" onClick={handleRandomSelection} className="w-full h-11 rounded-full">
                      <Shuffle className="h-4 w-4 mr-2" />
                      Generate Random Selection
                    </Button>
                  </div>

                  {/* Selected Questions Display */}
                  {selectedQuestions.length > 0 && (
                    <div className="space-y-3">
                      <Label>Selected Questions & Time Limits</Label>
                      <div className="max-h-96 overflow-y-auto border rounded-xl p-4 bg-background/70 backdrop-blur-sm space-y-3">
                        {questions
                          .filter((q) => selectedQuestions.includes(q.id))
                          .map((question, idx) => {
                            const defaultTime = DEFAULT_TIME_LIMITS[question.question_type] ?? 60
                            const currentTime = customTimeLimits[question.id] ?? defaultTime
                            return (
                              <div
                                key={question.id}
                                className="flex items-start gap-3 p-3 border rounded-lg bg-card/60 hover:bg-accent/5 transition-colors"
                              >
                                <span className="font-medium text-muted-foreground mt-1">{idx + 1}.</span>
                                <div className="flex-1 space-y-2">
                                  <p className="text-sm line-clamp-2">{question.question_text}</p>
                                  <div className="flex gap-2 flex-wrap">
                                    <Badge variant="outline" className="text-xs">
                                      {question.difficulty}
                                    </Badge>
                                    {question.topic && (
                                      <Badge variant="secondary" className="text-xs">
                                        {question.topic}
                                      </Badge>
                                    )}
                                    <Badge variant="outline" className="text-xs">
                                      {question.question_type}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <Input
                                    type="number"
                                    min="10"
                                    max="600"
                                    value={currentTime}
                                    onChange={(e) =>
                                      updateQuestionTime(question.id, Number.parseInt(e.target.value) || defaultTime)
                                    }
                                    className="w-16 h-8 text-xs"
                                  />
                                  <span className="text-xs text-muted-foreground">sec</span>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Manual Selection Tab */}
                <TabsContent value="manual" className="space-y-6 mt-6">
                  {/* Quick Select by Topic */}
                  {uniqueTopics.length > 0 && (
                    <div className="space-y-2">
                      <Label>Quick Select by Topic</Label>
                      <div className="flex flex-wrap gap-2">
                        {uniqueTopics.map((topic) => {
                          const topicCount = questions.filter((q) => q.topic === topic).length
                          return (
                            <Button
                              key={topic}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-full bg-transparent"
                              onClick={() => selectByTopic(topic!)}
                            >
                              {topic} ({topicCount})
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="grid md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-xl">
                    <div className="space-y-2">
                      <Label htmlFor="filter-difficulty">Filter by Difficulty</Label>
                      <Select
                        value={manualFilters.difficulty}
                        onValueChange={(value) => setManualFilters({ ...manualFilters, difficulty: value })}
                      >
                        <SelectTrigger id="filter-difficulty" className="h-11 rounded-lg">
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
                      <Label htmlFor="filter-topic">Filter by Topic</Label>
                      <Select
                        value={manualFilters.topic}
                        onValueChange={(value) => setManualFilters({ ...manualFilters, topic: value })}
                      >
                        <SelectTrigger id="filter-topic" className="h-11 rounded-lg">
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

                    {/* Filter by Types (Multiple) */}
                    <div className="space-y-2">
                      <Label>Filter by Types (Multiple)</Label>
                      <div className="border rounded-xl p-3 max-h-48 overflow-y-auto bg-background space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={manualFilters.question_types.length === 0}
                            onCheckedChange={(checked) =>
                              checked && setManualFilters({ ...manualFilters, question_types: [] })
                            }
                          />
                          <span className="text-sm">All Types</span>
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
                            <span className="text-sm">{type.label}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {manualFilters.question_types.length === 0
                          ? "All types shown"
                          : `Showing ${manualFilters.question_types.length} type(s)`}
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

                  {/* Manual Selection List */}
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
                : `Create Mid-Semester Exam (${selectedQuestions.length} questions, ${examData.time_limit} min)`}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
