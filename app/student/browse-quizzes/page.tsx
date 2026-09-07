"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  LogOut,
  ArrowLeft,
  Users,
  Clock,
  BookOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { logoutStudent, studentApiFetch } from "@/lib/auth"
import { useToast } from "@/components/ui/use-toast"
import { StudentHeader } from "@/components/student-header"

interface PublicQuiz {
  id: number
  title: string
  description: string
  creator_name: string
  created_at: string
  question_count: number
  attempt_count: number
}

export default function BrowseQuizzesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [quizzes, setQuizzes] = useState<PublicQuiz[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const studentId = sessionStorage.getItem("studentId")
    if (!studentId) {
      router.push("/student/login")
      return
    }
    fetchPublicQuizzes()
  }, [router])

  const fetchPublicQuizzes = async () => {
    try {
      const response = await studentApiFetch("/api/student/quizzes/public")
      if (!response.ok) throw new Error("Failed to fetch quizzes")

      const data = await response.json()
      setQuizzes(data.quizzes)
    } catch (error) {
      console.error("[v0] Failed to fetch public quizzes:", error)
      toast({
        title: "Error",
        description: "Failed to load public quizzes.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logoutStudent()
  }

  const handleTakeQuiz = (quizId: number) => {
    router.push(`/student/user-quiz/${quizId}`)
  }

  return (
    <div className="min-h-screen bg-secondary">
      {/* Glass Header */}
      <StudentHeader />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Top Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Browse Student Quizzes</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Discover and take quizzes created by your classmates
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2 rounded-full"
            onClick={() => router.push("/student/dashboard")}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading quizzes...</p>
          </div>
        ) : quizzes.length === 0 ? (
          <Card className="border border-border/50 bg-card/80 backdrop-blur-sm rounded-2xl text-center py-12 shadow-sm">
            <CardContent>
              <p className="text-muted-foreground mb-4">
                No public quizzes available yet.
              </p>
              <p className="text-sm text-muted-foreground">
                Check back later for instructor-published quizzes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {quizzes.map((quiz) => (
              <Card
                key={quiz.id}
                className="border border-border/50 bg-card/80 backdrop-blur-sm rounded-2xl hover:border-accent/50 hover:shadow-md transition-all duration-300"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg font-semibold">
                          {quiz.title}
                        </CardTitle>
                        <Badge
                          variant="default"
                          className="bg-accent text-white rounded-full"
                        >
                          <Users className="h-3 w-3 mr-1" />
                          Public
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm mb-2">
                        {quiz.description}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Created by <span className="font-medium text-foreground">
                          {quiz.creator_name}
                        </span>
                      </p>
                    </div>
                    <Button
                      onClick={() => handleTakeQuiz(quiz.id)}
                      className="rounded-full bg-accent hover:bg-accent/90"
                    >
                      <BookOpen className="h-4 w-4 mr-2" />
                      Take Quiz
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                    <span>{quiz.question_count} questions</span>
                    <span>{quiz.attempt_count} attempts</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {new Date(quiz.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
