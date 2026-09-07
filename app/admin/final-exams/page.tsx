"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { GraduationCap, ArrowLeft, Trophy, Calendar, TrendingUp, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminHeader } from "@/components/admin-header"

export default function AdminFinalExamsPage() {
  const router = useRouter()
  const [adminId, setAdminId] = useState<string | null>(null)
  const [adminUsername, setAdminUsername] = useState("")

  useEffect(() => {
    const id = sessionStorage.getItem("adminId")
    const username = sessionStorage.getItem("adminUsername")

    if (!id) {
      router.push("/admin/login")
      return
    }

    setAdminId(id)
    setAdminUsername(username || "")
  }, [router])

  if (!adminId) {
    return null
  }

  return (
    <div className="min-h-screen bg-secondary">
      <AdminHeader />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/dashboard")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-foreground">Manage Final Exams</h2>
              <p className="text-muted-foreground">Admin: {adminUsername}</p>
            </div>
          </div>
        </div>

        {/* Coming Soon Section */}
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Main Coming Soon Card */}
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Trophy className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Final Exam Results Dashboard Coming Soon</CardTitle>
              <CardDescription className="text-base mt-2">
                Comprehensive final exam management and analytics will be available here soon. Track student performance
                and generate detailed reports.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Placeholder Dashboard Cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="opacity-60">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Total Students</CardTitle>
                    <CardDescription className="text-sm">Enrolled in course</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-muted-foreground">--</p>
              </CardContent>
            </Card>

            <Card className="opacity-60">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Average Score</CardTitle>
                    <CardDescription className="text-sm">Class performance</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-muted-foreground">--%</p>
              </CardContent>
            </Card>

            <Card className="opacity-60">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Exam Date</CardTitle>
                    <CardDescription className="text-sm">Scheduled for</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-medium text-muted-foreground">Not scheduled</p>
              </CardContent>
            </Card>
          </div>

          {/* Placeholder Results Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Analytics</CardTitle>
              <CardDescription>Comprehensive view of student performance and grade distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">No exam results available</p>
                <p className="text-sm text-muted-foreground">
                  Detailed performance charts, grade distributions, and analytics will appear here after the final exam
                  is completed.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Feature Preview */}
          <Card className="bg-accent/5 border-accent/20">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                📈 <strong>Coming Features:</strong> Schedule comprehensive final exams, view detailed performance
                analytics, generate grade reports, export results to CSV, track individual student progress, and
                identify areas for improvement.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
