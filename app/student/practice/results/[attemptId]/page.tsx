"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Trophy,
  Clock,
  Target,
  Brain, 
  TrendingUp,
  Award, 
  Star,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Share2,
  Download
} from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "@/hooks/use-toast"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { StudentHeader } from "@/components/student-header"

interface PracticeResult {
  id: number
  score: number
  correct_answers: number
  total_questions: number
  topics: string[]
  difficulty: string
  completed_at: string
  duration_minutes: number
}

interface AnswerResult {
  question_id: number
  question_text: string
  selected_answer: any
  correct_answer: string
  is_correct: boolean
  difficulty: string
  topic: string
  option_a: string | null
  option_b: string | null
  option_c: string | null
  option_d: string | null
  option_e: string | null
  question_type: string
}

interface LeaderboardEntry {
  rank: number
  student_name: string
  student_id?: number | string
  score: number
  total_questions: number
  duration_minutes: number
  completed_at: string
  topics: string[]
  is_current_user?: boolean
}

export default function PracticeResultsPage() {
  const params = useParams()
  const router = useRouter()
  const [result, setResult] = useState<PracticeResult | null>(null)
  const [answers, setAnswers] = useState<AnswerResult[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [studentStats, setStudentStats] = useState<any>(null)
  const [leaderboardStats, setLeaderboardStats] = useState<any>(null)
  const [recentAttempts, setRecentAttempts] = useState<any[]>([])
  const [topicPerformance, setTopicPerformance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showDetailedResults, setShowDetailedResults] = useState(false)
  const [viewerDatabaseId, setViewerDatabaseId] = useState<string | null>(null)

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const attemptId = params.attemptId as string
    const studentData = getStudentData()

        if (!studentData || !studentData.databaseId) {
      router.push("/student/login")
      return
    }

        const studentIdHeader = studentData.databaseId
        setViewerDatabaseId(studentIdHeader)

        // Fetch practice results
        const resultsResponse = await studentApiFetch(`/api/student/practice/results/${attemptId}`, {
          headers: {
            "x-student-id": studentIdHeader,
          },
        })

        if (!resultsResponse.ok) {
          throw new Error("Failed to fetch results")
        }

        const resultsData = await resultsResponse.json()
        setResult(resultsData.result)
        setAnswers(resultsData.answers)
        setStudentStats(resultsData.studentStats)
        setLeaderboardStats(resultsData.leaderboardStats)
        setRecentAttempts(resultsData.recentAttempts || [])
        setTopicPerformance(resultsData.topicPerformance || [])

        // Fetch leaderboard
        const leaderboardResponse = await studentApiFetch("/api/student/practice/leaderboard", {
          headers: {
            "x-student-id": studentIdHeader,
          },
        })

        if (leaderboardResponse.ok) {
          const leaderboardData = await leaderboardResponse.json()
          setLeaderboard(leaderboardData.leaderboard || [])
        }

    } catch (error) {
        console.error("Failed to fetch results:", error)
        toast({
          title: "Error",
          description: "Failed to load practice results",
          variant: "destructive",
        })
    } finally {
      setLoading(false)
    }
  }

    fetchResults()
  }, [params.attemptId, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your results...</p>
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">Results Not Found</CardTitle>
            <CardDescription>
              The practice results you're looking for could not be found.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/student/practice")} className="w-full">
              Back to Practice
        </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const scorePercentage = Math.round((result.correct_answers / result.total_questions) * 100)
  const correctAnswers = answers.filter(a => a.is_correct).length
  const incorrectAnswers = answers.filter(a => !a.is_correct).length

  // Performance insights
  const getPerformanceLevel = () => {
    if (scorePercentage >= 90) return { level: "Excellent", color: "text-green-600", bg: "bg-green-50" }
    if (scorePercentage >= 80) return { level: "Great", color: "text-blue-600", bg: "bg-blue-50" }
    if (scorePercentage >= 70) return { level: "Good", color: "text-yellow-600", bg: "bg-yellow-50" }
    if (scorePercentage >= 60) return { level: "Fair", color: "text-orange-600", bg: "bg-orange-50" }
    return { level: "Needs Improvement", color: "text-red-600", bg: "bg-red-50" }
  }

  const performance = getPerformanceLevel()

  // Topic analysis
  const topicStats = answers.reduce((acc, answer) => {
    if (!acc[answer.topic]) {
      acc[answer.topic] = { total: 0, correct: 0 }
    }
    acc[answer.topic].total++
    if (answer.is_correct) acc[answer.topic].correct++
    return acc
  }, {} as Record<string, { total: number; correct: number }>)

  // Difficulty analysis
  const difficultyStats = answers.reduce((acc, answer) => {
    if (!acc[answer.difficulty]) {
      acc[answer.difficulty] = { total: 0, correct: 0 }
    }
    acc[answer.difficulty].total++
    if (answer.is_correct) acc[answer.difficulty].correct++
    return acc
  }, {} as Record<string, { total: number; correct: number }>)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <StudentHeader />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/student/practice")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Practice
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Performance Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="border-2 border-gradient-to-r from-blue-500 to-purple-500">
                <CardHeader className="text-center pb-4">
                  <div className="flex justify-center mb-4">
                    <div className={`p-4 rounded-full ${performance.bg}`}>
                      {scorePercentage >= 90 ? (
                        <Trophy className="h-12 w-12 text-yellow-600" />
                      ) : scorePercentage >= 80 ? (
                        <Award className="h-12 w-12 text-blue-600" />
                      ) : scorePercentage >= 70 ? (
                        <Star className="h-12 w-12 text-green-600" />
                      ) : (
                        <Target className="h-12 w-12 text-orange-600" />
                      )}
                    </div>
                  </div>
                  <CardTitle className={`text-3xl ${performance.color}`}>
                    {scorePercentage}%
            </CardTitle>
                  <CardDescription className="text-lg">
                    {performance.level} Performance
            </CardDescription>
          </CardHeader>
          <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-600">{correctAnswers}</div>
                      <div className="text-sm text-muted-foreground">Correct</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">{incorrectAnswers}</div>
                      <div className="text-sm text-muted-foreground">Incorrect</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{result.duration_minutes}m</div>
                      <div className="text-sm text-muted-foreground">Duration</div>
                    </div>
                  </div>
                  <Progress value={scorePercentage} className="mt-4" />
                </CardContent>
              </Card>
            </motion.div>

            {/* Topic Performance */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Topic Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(topicStats).map(([topic, stats]) => {
                      const percentage = Math.round((stats.correct / stats.total) * 100)
                      return (
                        <div key={topic} className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{topic}</div>
                            <div className="text-sm text-muted-foreground">
                              {stats.correct}/{stats.total} correct
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Progress value={percentage} className="w-24" />
                            <span className="text-sm font-medium w-12 text-right">{percentage}%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
          </CardContent>
        </Card>
            </motion.div>

            {/* Difficulty Analysis */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Difficulty Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    {Object.entries(difficultyStats).map(([difficulty, stats]) => {
                      const percentage = Math.round((stats.correct / stats.total) * 100)
                      return (
                        <div key={difficulty} className="text-center">
                          <Badge variant={
                            difficulty === "easy" ? "default" :
                            difficulty === "medium" ? "secondary" : "destructive"
                          } className="mb-2">
                            {difficulty}
                  </Badge>
                          <div className="text-2xl font-bold">{percentage}%</div>
                          <div className="text-sm text-muted-foreground">
                            {stats.correct}/{stats.total}
                          </div>
                        </div>
                      )
                    })}
              </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Detailed Results Toggle */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card>
                <CardContent className="pt-6">
                  <Button
                    onClick={() => setShowDetailedResults(!showDetailedResults)}
                    variant="outline"
                    className="w-full"
                  >
                    {showDetailedResults ? "Hide" : "Show"} Detailed Question Results
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Detailed Results */}
            {showDetailedResults && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Question-by-Question Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {answers.map((answer, index) => (
                        <div key={answer.question_id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-medium">Question {index + 1}</span>
                                <Badge variant={
                                  answer.difficulty === "easy" ? "default" :
                                  answer.difficulty === "medium" ? "secondary" : "destructive"
                                }>
                                  {answer.difficulty}
              </Badge>
                                <Badge variant="outline">{answer.topic}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-3">
                                {answer.question_text}
                              </p>
                            </div>
                            <div className="ml-4">
                              {answer.is_correct ? (
                                <CheckCircle2 className="h-6 w-6 text-green-600" />
                              ) : (
                                <XCircle className="h-6 w-6 text-red-600" />
                              )}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="font-medium text-green-700">Your Answer:</div>
                              <div className="text-muted-foreground">
                                {Array.isArray(answer.selected_answer) 
                                  ? answer.selected_answer.join(", ")
                                  : String(answer.selected_answer)
                                }
                              </div>
                            </div>
                            <div>
                              <div className="font-medium text-blue-700">Correct Answer:</div>
                              <div className="text-muted-foreground">{answer.correct_answer}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
        </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Personal Statistics */}
            {studentStats && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-900">
                      <TrendingUp className="h-5 w-5" />
                      Your Practice Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-white rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{studentStats.total_attempts || 0}</div>
                        <div className="text-xs text-muted-foreground">Total Attempts</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{Number(studentStats.avg_score || 0).toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">Avg Score</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{studentStats.total_correct || 0}</div>
                        <div className="text-xs text-muted-foreground">Total Correct</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">{Number(studentStats.best_score || 0).toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">Best Score</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Leaderboard Position */}
            {leaderboardStats && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.05 }}
              >
                <Card className="border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-yellow-900">
                      <Trophy className="h-5 w-5" />
                      Leaderboard Position
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-center p-4 bg-white rounded-lg">
                      <div className="text-4xl font-bold text-yellow-600">#{leaderboardStats.rank || 'N/A'}</div>
                      <div className="text-sm text-muted-foreground">Your Rank</div>
                    </div>
                    <Separator />
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Points:</span>
                        <span className="font-bold">{leaderboardStats.total_practice_points || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Current Streak:</span>
                        <span className="font-bold">{leaderboardStats.current_streak_days || 0} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Longest Streak:</span>
                        <span className="font-bold">{leaderboardStats.longest_streak_days || 0} days</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Recent Practice Activity */}
            {recentAttempts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {recentAttempts.map((attempt, index) => (
                        <div key={attempt.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div className="flex-1">
                            <div className="text-sm font-medium">{attempt.topics?.[0] || 'Practice'}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(attempt.completed_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold ${
                              Number(attempt.score_percentage) >= 80 ? 'text-green-600' : 
                              Number(attempt.score_percentage) >= 60 ? 'text-yellow-600' : 
                              'text-red-600'
                            }`}>
                              {Number(attempt.score_percentage).toFixed(0)}%
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {attempt.correct_answers}/{attempt.total_questions}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Topic Performance Overview */}
            {topicPerformance.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      Overall Topic Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {topicPerformance.slice(0, 5).map((topic) => (
                        <div key={topic.topic} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium truncate">{topic.topic}</span>
                            <span className="text-muted-foreground">{Number(topic.accuracy).toFixed(0)}%</span>
                          </div>
                          <Progress value={Number(topic.accuracy)} className="h-2" />
                          <div className="text-xs text-muted-foreground">
                            {topic.correct_count}/{topic.questions_attempted} correct
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Leaderboard */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    Practice Leaderboard
                  </CardTitle>
                  <CardDescription>
                    Top performers in this topic
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {leaderboard.length > 0 ? (
                    <div className="space-y-3">
                      {leaderboard.slice(0, 5).map((entry, index) => {
                        const isMe = Boolean(
                          entry.is_current_user ||
                            (viewerDatabaseId && String(entry.student_id) === String(viewerDatabaseId))
                        )
                        return (
                        <div key={entry.rank} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              index === 0 ? "bg-yellow-500 text-white" :
                              index === 1 ? "bg-gray-400 text-white" :
                              index === 2 ? "bg-amber-600 text-white" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {entry.rank}
                            </div>
                            <div>
                              <div className="font-medium text-sm">
                                {isMe ? (entry.student_name || "You") : "Student"}
                                {isMe && <span className="ml-1 text-xs text-[var(--cc-accent-dark)]">(You)</span>}
                              </div>
                              {isMe && (
                              <div className="text-xs text-muted-foreground">
                                {Math.round(entry.duration_minutes)}m
                              </div>
                              )}
                            </div>
                          </div>
                          {isMe ? (
                          <div className="text-right">
                            <div className="font-bold text-lg">
                              {Math.round((entry.score / entry.total_questions) * 100)}%
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {entry.score}/{entry.total_questions}
                            </div>
                          </div>
                          ) : (
                            <div className="text-right blur-[6px] select-none text-slate-400">
                              <div className="font-bold text-lg">•••</div>
                              <div className="text-xs">hidden</div>
                            </div>
                          )}
                        </div>
                      )})}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <Trophy className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No leaderboard data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
          <Button
            onClick={() => router.push("/student/practice")}
                    className="w-full"
          >
            Practice Again
          </Button>
          <Button
            variant="outline"
                    onClick={() => router.push("/student/dashboard")} 
                    className="w-full"
                  >
                    Back to Dashboard
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => router.push("/student/practice/leaderboard")} 
                    className="w-full"
                  >
                    View Full Leaderboard
          </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Performance Tips */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Performance Tips
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    {scorePercentage >= 90 && (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="font-medium text-green-800">🎉 Excellent Work!</div>
                        <div className="text-green-700">Keep up the great performance!</div>
                      </div>
                    )}
                    
                    {scorePercentage < 90 && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="font-medium text-blue-800">💡 Study Tips</div>
                        <div className="text-blue-700">
                          Review the incorrect answers and practice more questions on weak topics.
                        </div>
                      </div>
                    )}

                    {Object.entries(topicStats).some(([_, stats]) => 
                      Math.round((stats.correct / stats.total) * 100) < 70
                    ) && (
                      <div className="p-3 bg-orange-50 rounded-lg">
                        <div className="font-medium text-orange-800">⚠️ Focus Areas</div>
                        <div className="text-orange-700">
                          Consider reviewing topics with lower scores.
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}