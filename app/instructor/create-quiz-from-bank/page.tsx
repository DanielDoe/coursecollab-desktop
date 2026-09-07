"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { 
  BookOpen, 
  Users, 
  BarChart3, 
  Database, 
  Brain, 
  Calendar,
  MessageSquare,
  Settings,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity,
  Target,
  Award,
  Zap,
  FileText,
  ClipboardList,
  HelpCircle,
  Shield,
  Monitor,
  LogOut,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Edit,
  Trash2,
  Eye,
  MoreHorizontal,
  Star,
  Crown,
  PieChart,
  LineChart,
  BarChart,
  Server,
  Database as DatabaseIcon,
  Cpu,
  HardDrive,
  FileSearch,
  Calendar as CalendarIcon,
  UserCheck,
  Mail,
  FileX,
  AlertTriangle,
  Info,
  Bug,
  Lightbulb,
  ExternalLink,
  ChevronRight,
  Phone,
  Video,
  MessageCircle,
  Play,
  Gamepad2,
  Code,
  Terminal,
  Bot,
  MessageSquare as MessageSquareIcon,
  Sparkles,
  Wand2,
  RefreshCw,
  RotateCcw,
  Trophy,
  TrendingDown,
  Target as TargetIcon,
  ArrowRight,
  Shuffle,
  Layers
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"

interface Question {
  id: string
  text: string
  type: string
  difficulty: string
  topic: string
  selected: boolean
}

export function InstructorCreateQuizFromBankPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const [quizConfig, setQuizConfig] = useState({
    title: "",
    description: "",
    assessmentType: "quiz",
    timePerQuestion: 60,
    difficulty: "mixed",
    topic: "all"
  })

  useEffect(() => {
    // Simulate loading questions
    const mockQuestions: Question[] = [
      {
        id: "1",
        text: "What is the time complexity of binary search?",
        type: "multiple_choice",
        difficulty: "medium",
        topic: "algorithms",
        selected: false
      },
      {
        id: "2",
        text: "Explain the difference between a stack and a queue.",
        type: "short_answer",
        difficulty: "easy",
        topic: "data_structures",
        selected: false
      },
      {
        id: "3",
        text: "Implement a function to reverse a linked list.",
        type: "coding",
        difficulty: "hard",
        topic: "data_structures",
        selected: false
      },
      {
        id: "4",
        text: "What is the purpose of normalization in databases?",
        type: "multiple_choice",
        difficulty: "medium",
        topic: "databases",
        selected: false
      },
      {
        id: "5",
        text: "Describe the CAP theorem and its implications.",
        type: "essay",
        difficulty: "hard",
        topic: "system_design",
        selected: false
      }
    ]
    setQuestions(mockQuestions)
    setTimeout(() => setIsLoading(false), 1000)
  }, [])

  const handleQuestionSelect = (questionId: string, selected: boolean) => {
    setQuestions(prev => 
      prev.map(q => q.id === questionId ? { ...q, selected } : q)
    )
    
    if (selected) {
      setSelectedQuestions(prev => [...prev, questionId])
    } else {
      setSelectedQuestions(prev => prev.filter(id => id !== questionId))
    }
  }

  const handleSelectAll = (selected: boolean) => {
    setQuestions(prev => prev.map(q => ({ ...q, selected })))
    if (selected) {
      setSelectedQuestions(questions.map(q => q.id))
    } else {
      setSelectedQuestions([])
    }
  }

  const handleCreateQuiz = () => {
    // Handle quiz creation logic
    console.log("Creating quiz with:", {
      config: quizConfig,
      selectedQuestions: selectedQuestions
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">Create Quiz from Question Bank</h1>
        <p className="text-blue-100">
          Select questions from your question bank to create a new assessment.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quiz Configuration */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5 text-blue-500" />
                <span>Quiz Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Quiz Title</Label>
                <Input
                  id="title"
                  value={quizConfig.title}
                  onChange={(e) => setQuizConfig(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter quiz title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={quizConfig.description}
                  onChange={(e) => setQuizConfig(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter quiz description"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assessment-type">Assessment Type</Label>
                <Select
                  value={quizConfig.assessmentType}
                  onValueChange={(value) => setQuizConfig(prev => ({ ...prev, assessmentType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="mid_semester">Mid-Semester Exam</SelectItem>
                    <SelectItem value="final">Final Exam</SelectItem>
                    <SelectItem value="homework">Homework</SelectItem>
                    <SelectItem value="practice">Practice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="time-per-question">Time per Question (seconds)</Label>
                <Input
                  id="time-per-question"
                  type="number"
                  value={quizConfig.timePerQuestion}
                  onChange={(e) => setQuizConfig(prev => ({ ...prev, timePerQuestion: parseInt(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty Filter</Label>
                <Select
                  value={quizConfig.difficulty}
                  onValueChange={(value) => setQuizConfig(prev => ({ ...prev, difficulty: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mixed">Mixed</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="topic">Topic Filter</Label>
                <Select
                  value={quizConfig.topic}
                  onValueChange={(value) => setQuizConfig(prev => ({ ...prev, topic: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Topics</SelectItem>
                    <SelectItem value="algorithms">Algorithms</SelectItem>
                    <SelectItem value="data_structures">Data Structures</SelectItem>
                    <SelectItem value="databases">Databases</SelectItem>
                    <SelectItem value="system_design">System Design</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Selected Questions Summary */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <ClipboardList className="h-5 w-5 text-green-500" />
                <span>Selected Questions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Total Selected</span>
                  <Badge variant="outline" className="text-blue-600 border-blue-600">
                    {selectedQuestions.length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Estimated Time</span>
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    {selectedQuestions.length * quizConfig.timePerQuestion / 60} min
                  </Badge>
                </div>
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={handleCreateQuiz}
                  disabled={selectedQuestions.length === 0}
                >
                  Create Quiz
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Question Bank */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Database className="h-5 w-5 text-purple-500" />
                  <span>Question Bank</span>
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectAll(true)}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectAll(false)}
                  >
                    Clear All
                  </Button>
                </div>
              </div>
              <CardDescription>
                Select questions to include in your quiz
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {questions.map((question) => (
                  <div
                    key={question.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      question.selected 
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        checked={question.selected}
                        onCheckedChange={(checked) => handleQuestionSelect(question.id, checked as boolean)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-slate-900 dark:text-white">
                            {question.text}
                          </h4>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {question.type.replace('_', ' ')}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                question.difficulty === 'easy' ? 'text-green-600 border-green-600' :
                                question.difficulty === 'medium' ? 'text-yellow-600 border-yellow-600' :
                                'text-red-600 border-red-600'
                              }`}
                            >
                              {question.difficulty}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {question.topic.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-slate-600 dark:text-slate-400">
                          <span className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{quizConfig.timePerQuestion}s</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <Layers className="h-3 w-3" />
                            <span>{question.type}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default InstructorCreateQuizFromBankPage
