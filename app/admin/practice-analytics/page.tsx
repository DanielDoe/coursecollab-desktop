"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GraduationCap, LogOut, ArrowLeft, Download, TrendingUp, Users, Target, Clock } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getAdminData, logoutAdmin } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"

interface PracticeAnalytics {
  totalAttempts: number
  totalStudents: number
  avgScore: number
  avgTimeSpent: number
  topicStats: {
    topic: string
    attempts: number
    avg_score: number
    total_students: number
  }[]
  recentAttempts: {
    student_name: string
    student_id: string
    topics: string[]
    score_percentage: number
    completed_at: string
  }[]
}

export default function PracticeAnalyticsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [analytics, setAnalytics] = useState<PracticeAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const adminData = getAdminData()
    if (!adminData) {
      router.push("/admin/login")
      return
    }
    fetchAnalytics()
  }, [router])

  const fetchAnalytics = async () => {
    try {
      const response = await fetch("/api/admin/practice/analytics")
      const data = await response.json()

      if (response.ok) {
        setAnalytics(data)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch analytics:", error)
      toast({
        title: "Error",
        description: "Failed to load analytics",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const response = await fetch("/api/admin/practice/export")
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `practice-analytics-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Export successful",
        description: "Practice analytics have been exported",
      })
    } catch (error) {
      console.error("[v0] Failed to export:", error)
      toast({
        title: "Error",
        description: "Failed to export analytics",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const handleLogout = () => {
    logoutAdmin()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Failed to load analytics</p>
          <Button onClick={() => router.push("/admin/dashboard")}>Back to Dashboard</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b border-border bg-background">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <GraduationCap className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-primary">CourseCollab</h1>
            </Link>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button variant="ghost" size="sm" onClick={() => router.push("/admin/dashboard")} className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h2 className="text-3xl font-bold">Practice Hub Analytics</h2>
            <p className="text-muted-foreground">Monitor student practice activity and performance</p>
          </div>
          <Button onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? "Exporting..." : "Export Data"}
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-accent" />
                <CardDescription>Total Attempts</CardDescription>
              </div>
              <CardTitle className="text-3xl">{analytics.totalAttempts}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-accent" />
                <CardDescription>Active Students</CardDescription>
              </div>
              <CardTitle className="text-3xl">{analytics.totalStudents}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-accent" />
                <CardDescription>Average Score</CardDescription>
              </div>
              <CardTitle className="text-3xl">{analytics.avgScore.toFixed(1)}%</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-accent" />
                <CardDescription>Avg Time/Session</CardDescription>
              </div>
              <CardTitle className="text-3xl">{Math.round(analytics.avgTimeSpent / 60)}m</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Topic Performance */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Topic Performance</CardTitle>
            <CardDescription>Student performance breakdown by topic</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.topicStats.map((topic) => (
                <div key={topic.topic} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">{topic.topic}</h4>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{topic.attempts} attempts</span>
                      <span>{topic.total_students} students</span>
                    </div>
                  </div>
                  <Badge variant={topic.avg_score >= 70 ? "default" : "secondary"} className="text-lg px-3 py-1">
                    {topic.avg_score.toFixed(0)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Practice Sessions</CardTitle>
            <CardDescription>Latest student practice attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.recentAttempts.map((attempt, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{attempt.student_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {attempt.student_id} • {attempt.topics.join(", ")}
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(attempt.completed_at).toLocaleString()}</p>
                  </div>
                  <Badge variant="outline">{attempt.score_percentage.toFixed(0)}%</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
