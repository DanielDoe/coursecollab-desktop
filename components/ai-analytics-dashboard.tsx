"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Brain, TrendingUp } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface AnalyticsData {
  agreementRate: string
  totalGraded: number
  aiGraded: number
  manualReviews: number
  confidenceDistribution: Array<{ confidence_level: string; count: number }>
  typeStats: Array<{ question_type: string; total_graded: number; avg_score: number }>
}

export function AIAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      const response = await fetch("/api/ai-analytics")
      const analyticsData = await response.json()
      setData(analyticsData)
    } catch (error) {
      console.error("[v0] Failed to fetch analytics:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading analytics...</div>
  }

  if (!data) {
    return <div className="text-center py-8 text-muted-foreground">No analytics data available</div>
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10 border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              AI Agreement Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">{data.agreementRate}%</div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Instructor approval rate</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">AI Graded Answers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">{data.aiGraded}</div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Automatically evaluated</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10 border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">Manual Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">{data.manualReviews}</div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Instructor overrides</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10 border-green-200 dark:border-green-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">Total Graded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900 dark:text-green-100">{data.totalGraded}</div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">All evaluations</p>
          </CardContent>
        </Card>
      </div>

      {/* Confidence Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Confidence Distribution
          </CardTitle>
          <CardDescription>AI grading confidence levels across all evaluations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.confidenceDistribution.map((item) => {
            const percentage = data.totalGraded > 0 ? (item.count / data.totalGraded) * 100 : 0
            const color =
              item.confidence_level === "High"
                ? "bg-green-500"
                : item.confidence_level === "Medium"
                  ? "bg-yellow-500"
                  : "bg-red-500"

            return (
              <div key={item.confidence_level} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.confidence_level} Confidence</span>
                  <span className="text-muted-foreground">
                    {item.count} ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full ${color}`} style={{ width: `${percentage}%` }} />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Question Type Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Performance by Question Type
          </CardTitle>
          <CardDescription>Average scores across different question types</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.typeStats.map((stat) => (
            <div key={stat.question_type} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium capitalize">{stat.question_type.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">
                  {(stat.avg_score * 100).toFixed(1)}% ({stat.total_graded} graded)
                </span>
              </div>
              <Progress value={stat.avg_score * 100} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
