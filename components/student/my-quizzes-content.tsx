"use client"

import { studentApiFetch, getStudentAuthHeaders } from "@/lib/auth"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Plus,
  Edit,
  Trash2,
  Users,
  Lock,
  Library,
  Calendar,
  BarChart3,
  Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { motion } from "framer-motion"

interface UserQuiz {
  id: number
  title: string
  description: string
  is_public: boolean
  created_at: string
  question_count: number
  attempt_count: number
}

interface MyQuizzesContentProps {
  embedInDashboard?: boolean
}

export function MyQuizzesContent({ embedInDashboard = false }: MyQuizzesContentProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [quizzes, setQuizzes] = useState<UserQuiz[]>([])
  const [loading, setLoading] = useState(true)

  const createQuizHref = embedInDashboard ? "/student/dashboard-v2/create-quiz" : "/student/create-quiz"

  useEffect(() => {
    const studentId = sessionStorage.getItem("studentId")
    if (!studentId) {
      router.push("/student/login")
      return
    }
    fetchMyQuizzes()
  }, [router])

  const fetchMyQuizzes = async () => {
    try {
      const studentId = sessionStorage.getItem("studentId")
      const response = await studentApiFetch("/api/student/quizzes/my-quizzes", {
        headers: { "x-student-id": studentId || "" },
      })
      if (!response.ok) throw new Error("Failed to fetch quizzes")
      const data = await response.json()
      setQuizzes(data.quizzes || [])
    } catch (error) {
      console.error("[MyQuizzes] Failed to fetch:", error)
      toast({ title: "Error", description: "Failed to load your quizzes.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (quizId: number) => {
    if (!confirm("Are you sure you want to delete this quiz? This action cannot be undone.")) return
    try {
      const response = await studentApiFetch(`/api/student/quizzes/${quizId}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete quiz")
      toast({ title: "Quiz deleted", description: "Your quiz has been deleted successfully." })
      fetchMyQuizzes()
    } catch (error) {
      console.error("[MyQuizzes] Failed to delete:", error)
      toast({ title: "Error", description: "Failed to delete quiz.", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4">
        <Link href={createQuizHref} className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white rounded-xl gap-2 shadow-md hover:shadow-lg dark:shadow-teal-900/30 transition-all duration-200 px-4 sm:px-6 py-2.5 sm:py-3 font-semibold">
            <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
            Create New Quiz
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 sm:py-16">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-4">
            <div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-600 dark:border-t-teal-400 rounded-full animate-spin" />
            <p className="text-slate-600 dark:text-slate-400 font-medium text-sm sm:text-base">Loading your quizzes...</p>
          </div>
        </div>
      ) : quizzes.length === 0 ? (
        <Card className="border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm rounded-2xl text-center py-12 sm:py-16">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="p-4 rounded-2xl bg-teal-500/15 dark:bg-teal-500/25">
                <Library className="h-8 w-8 sm:h-10 sm:w-10 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200">No Quizzes Yet</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6 sm:mb-8 max-w-md mx-auto text-sm sm:text-base">
              You haven&apos;t created any quizzes yet. Start building your quiz collection and challenge your classmates!
            </p>
            <Link href={createQuizHref} className="inline-block">
              <Button className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl gap-2 shadow-md hover:shadow-lg dark:shadow-teal-900/30 transition-all duration-200 px-4 sm:px-6 py-2.5 sm:py-3 font-semibold w-full sm:w-auto">
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                Create Your First Quiz
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          {quizzes.map((quiz, index) => (
            <motion.div
              key={quiz.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card className="border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm rounded-2xl overflow-hidden shadow-sm hover:border-teal-300/50 dark:hover:border-teal-500/30 transition-all duration-200">
                <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-slate-800 dark:text-slate-200 break-words">
                          {quiz.title}
                        </CardTitle>
                        {quiz.is_public ? (
                          <Badge className="bg-teal-500/20 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-300/50 dark:border-teal-500/30 shrink-0">
                            <Users className="h-3 w-3 mr-1" />
                            Public
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-500/20 dark:bg-white/10 text-slate-700 dark:text-slate-300 border-slate-300/50 dark:border-white/10 shrink-0">
                            <Lock className="h-3 w-3 mr-1" />
                            Private
                          </Badge>
                        )}
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-2">
                        {quiz.description || "No description provided."}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl hover:bg-teal-500/10 dark:hover:bg-teal-500/20 hover:text-teal-600 dark:hover:text-teal-400 p-2 transition-colors"
                        onClick={() => router.push(`/student/edit-quiz/${quiz.id}`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl hover:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 p-2 transition-colors"
                        onClick={() => handleDelete(quiz.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
                  <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <BarChart3 className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                      <span className="font-medium">{quiz.question_count} questions</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Eye className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                      <span className="font-medium">{quiz.attempt_count} attempts</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Calendar className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                      <span className="font-medium">
                        Created {new Date(quiz.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
