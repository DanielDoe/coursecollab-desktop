"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, BookOpen, Clock, CheckCircle2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { logoutStudent } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { StudentHeader } from "@/components/student-header"

export default function StudentHomeworksPage() {
  const router = useRouter()
  const [studentId, setStudentId] = useState<string | null>(null)
  const [studentName, setStudentName] = useState("")
  const [studentSection, setStudentSection] = useState("")

  useEffect(() => {
    const id = sessionStorage.getItem("studentId")
    const name = sessionStorage.getItem("studentName")
    const section = sessionStorage.getItem("studentSection")

    if (!id) {
      router.push("/student/login")
      return
    }

    setStudentId(id)
    setStudentName(name || "")
    setStudentSection(section || "")
  }, [router])

  const handleLogout = () => {
    logoutStudent()
  }

  if (!studentId) {
    return null
  }

  return (
    <div className="min-h-screen bg-secondary">
      {/* Header */}
      <StudentHeader />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Homeworks</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {studentName} • Section {studentSection}
            </p>
          </div>
          <Button onClick={() => router.push("/student/dashboard")} variant="outline" className="gap-2 rounded-full">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
        </div>

        <div className="rounded-2xl border border-border/50 shadow-sm bg-card/80 backdrop-blur-sm p-6 hover:shadow-md transition-all duration-300">
          {/* Coming Soon Section */}
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Main Coming Soon Card */}
            <Card className="border-2 border-[var(--cc-accent-soft-strong)] bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto h-16 w-16 rounded-full bg-[var(--cc-accent-soft)] flex items-center justify-center mb-4">
                  <BookOpen className="h-8 w-8 text-[var(--cc-accent-dark)]" />
                </div>
                <CardTitle className="text-2xl">Homework Practice Coming Soon!</CardTitle>
                <CardDescription className="text-base mt-2">
                  Stay tuned! Homework assignments will be released here soon to help you practice and master the course
                  material.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Placeholder Assignment Cards */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="opacity-60">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary" className="gap-1">
                      <Lock className="h-3 w-3" />
                      Locked
                    </Badge>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Not Available</span>
                    </div>
                  </div>
                  <CardTitle className="text-lg">Homework Assignment #1</CardTitle>
                  <CardDescription>Introduction to Circuit Analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>10 Practice Problems</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>Due: TBA</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="opacity-60">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary" className="gap-1">
                      <Lock className="h-3 w-3" />
                      Locked
                    </Badge>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Not Available</span>
                    </div>
                  </div>
                  <CardTitle className="text-lg">Homework Assignment #2</CardTitle>
                  <CardDescription>Ohm's Law and Series Circuits</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>12 Practice Problems</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>Due: TBA</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Motivational Message */}
            <Card className="bg-accent/5 border-accent/20">
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  💡 <strong>Pro Tip:</strong> Regular homework practice is key to mastering electrical engineering
                  concepts. Check back soon for assignments that will help reinforce your learning!
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
