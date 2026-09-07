"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, BookOpen } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"

interface QuestionBankItem {
  id: number
  question_text: string
  question_type: string
  difficulty: string
  topic: string
  options: string[]
  correct_answer: unknown
  hint: string | null
  evaluation_mode: string
  answer_guidelines: unknown[]
  sample_answer: string | null
  explanation: string | null
  question_media?: unknown
  subquestions?: unknown
  solution_upload_config?: unknown
}

interface AddQuestionModalProps {
  open: boolean
  onClose: () => void
  onAddNew: () => void
  onAddFromBank: (question: QuestionBankItem) => void
  /** When true, load from scoped instructor question bank (ECE2202 course). */
  useInstructorBank?: boolean
}

const QUESTION_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "mcq", label: "Multiple Choice" },
  { value: "true_false", label: "True/False" },
  { value: "select_all", label: "Select All" },
  { value: "fill_blank", label: "Fill in the Blank" },
  { value: "multi_part", label: "Multi-Part (Circuit)" },
  { value: "circuit_submission", label: "Circuit Submission" },
  { value: "code_write", label: "Code Write" },
  { value: "code_problem", label: "Code Problem" },
  { value: "debug_code", label: "Debug Code" },
  { value: "code_explain", label: "Code Explain" },
]

export function AddQuestionModal({
  open,
  onClose,
  onAddNew,
  onAddFromBank,
  useInstructorBank = true,
}: AddQuestionModalProps) {
  const [mode, setMode] = useState<"select" | "browse">("select")
  const [questions, setQuestions] = useState<QuestionBankItem[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string>("all")
  const [selectedQuestionType, setSelectedQuestionType] = useState<string>("all")
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [addingQuestion, setAddingQuestion] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open && mode === "browse") {
      void fetchQuestions()
    }
  }, [open, mode, useInstructorBank])

  const filteredQuestions = useMemo(() => {
    let filtered = questions

    if (selectedTopic !== "all") {
      filtered = filtered.filter((q) => q.topic === selectedTopic)
    }

    if (selectedQuestionType !== "all") {
      filtered = filtered.filter((q) => q.question_type === selectedQuestionType)
    }

    if (selectedDifficulty !== "all") {
      filtered = filtered.filter((q) => q.difficulty === selectedDifficulty)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(
        (q) =>
          q.question_text.toLowerCase().includes(query) ||
          q.topic?.toLowerCase().includes(query) ||
          q.difficulty?.toLowerCase().includes(query),
      )
    }

    return filtered
  }, [questions, selectedTopic, selectedQuestionType, selectedDifficulty, searchQuery])

  const fetchQuestions = async () => {
    setLoading(true)
    try {
      const apiUrl = useInstructorBank ? "/api/instructor/question-bank" : "/api/admin/question-bank"
      const headers = useInstructorBank ? getInstructorScopeHeaders() : undefined
      const response = await fetch(apiUrl, headers ? { headers } : undefined)
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || `Failed to load question bank (${response.status})`)
      }
      const data = await response.json()
      const list = (data.questions || []) as QuestionBankItem[]
      setQuestions(list)
      const apiTopics = (data.topics || []) as string[]
      const derivedTopics = Array.from(new Set(list.map((q) => q.topic).filter(Boolean)))
      setTopics(apiTopics.length > 0 ? apiTopics : derivedTopics)
    } catch (error) {
      console.error("[AddQuestionModal] Failed to fetch questions:", error)
      toast({
        title: "Failed to load questions",
        description:
          error instanceof Error ? error.message : "Could not fetch questions from the question bank.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddQuestion = async (question: QuestionBankItem) => {
    if (addingQuestion) return

    setAddingQuestion(true)
    try {
      await onAddFromBank(question)
      resetBrowseState()
      onClose()
    } catch (error) {
      console.error("Failed to add question:", error)
      toast({
        title: "Error",
        description: "Failed to add question. Please try again.",
        variant: "destructive",
      })
    } finally {
      setAddingQuestion(false)
    }
  }

  const resetBrowseState = () => {
    setMode("select")
    setSearchQuery("")
    setSelectedTopic("all")
    setSelectedQuestionType("all")
    setSelectedDifficulty("all")
  }

  const handleCreateNew = () => {
    onAddNew()
    resetBrowseState()
    onClose()
  }

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetBrowseState()
      onClose()
    }
  }

  const selectContentClass = "z-[200] max-h-72"

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{mode === "select" ? "Add Question" : "Choose from Question Bank"}</DialogTitle>
        </DialogHeader>

        {mode === "select" ? (
          <div className="grid gap-4 py-4">
            <Button
              onClick={handleCreateNew}
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-accent/50 bg-transparent"
            >
              <Plus className="h-8 w-8" />
              <div className="text-center">
                <div className="font-semibold">Create New Question</div>
                <div className="text-sm text-muted-foreground">Start with an empty question template</div>
              </div>
            </Button>

            <Button
              onClick={() => setMode("browse")}
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-accent/50"
            >
              <BookOpen className="h-8 w-8" />
              <div className="text-center">
                <div className="font-semibold">Choose from Question Bank</div>
                <div className="text-sm text-muted-foreground">Select an existing question from your library</div>
              </div>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 flex-1 overflow-hidden">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Topic</Label>
                <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Topics" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <SelectItem value="all">All Topics</SelectItem>
                    {topics.map((topic) => (
                      <SelectItem key={topic} value={topic}>
                        {topic}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Question Type</Label>
                <Select value={selectedQuestionType} onValueChange={setSelectedQuestionType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {QUESTION_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search questions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-lg">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-muted-foreground">Loading questions...</div>
                </div>
              ) : filteredQuestions.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center text-muted-foreground">
                    <p>No questions found</p>
                    <p className="text-sm mt-1">Try adjusting your filters</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredQuestions.map((question) => (
                    <div key={question.id} className="p-4 hover:bg-accent/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <p className="font-medium line-clamp-2">{question.question_text}</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="text-xs">
                              {question.question_type}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className={`text-xs ${
                                question.difficulty === "easy"
                                  ? "bg-green-100 text-green-800"
                                  : question.difficulty === "medium"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                              }`}
                            >
                              {question.difficulty}
                            </Badge>
                            {question.topic ? (
                              <Badge variant="default" className="text-xs">
                                {question.topic}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleAddQuestion(question)}
                          disabled={addingQuestion}
                        >
                          {addingQuestion ? "Adding..." : "Add"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <Button variant="outline" onClick={() => setMode("select")}>
                Back
              </Button>
              <p className="text-sm text-muted-foreground">
                {filteredQuestions.length} question{filteredQuestions.length !== 1 ? "s" : ""} found
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
