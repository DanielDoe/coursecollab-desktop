"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { TrendingUp, Target, Award, Flame, Zap, User, Code, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CodebenchAnalyticsSkeleton } from "@/components/codebench/CodebenchSkeletons"

interface ProfileTabProps {
  code: string
  studentId: string | null
  embedInDashboard?: boolean
  refreshKey?: number
}

interface CodingProfile {
  level: "Beginner" | "Intermediate" | "Advanced"
  mainWeakness: string
  mostImproved: string
  recommendedPractice: string
  proficiencyScore: number
  xp: number
  streak: number
  badges: number
}

export function ProfileTab({ code, studentId, embedInDashboard, refreshKey = 0 }: ProfileTabProps) {
  const [profile, setProfile] = useState<CodingProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [submissions, setSubmissions] = useState<any[]>([])
  const [practiceProblems, setPracticeProblems] = useState<any[]>([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)

  useEffect(() => {
    const loadProfile = async () => {
      // Try to load from localStorage first (standalone CodeBench more page only)
      if (typeof window !== "undefined" && !embedInDashboard) {
        const saved = localStorage.getItem("codebench_learning_profile")
        if (saved) {
          try {
            const parsed = JSON.parse(saved)
            setProfile(parsed.profile || null)
            setLoading(false)
            return
          } catch (e) {
            console.error("Failed to parse saved profile:", e)
          }
        }
      }

      // If no saved profile or code changed, analyze current code
      if (code && studentId) {
        try {
          const response = await fetch("/api/codebench/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, studentId }),
          })

          if (response.ok) {
            const data = await response.json()
            // Fetch streak from API
            let streakDays = 0
            try {
              const streakResponse = await fetch(`/api/codebench/streak?studentId=${studentId}`)
              if (streakResponse.ok) {
                const streakData = await streakResponse.json()
                streakDays = streakData.streakDays || 0
              }
            } catch (e) {
              // Fallback to localStorage
              streakDays = parseInt(localStorage.getItem("codebench_streak_days") || "0", 10)
            }

            const newProfile: CodingProfile = {
              level: data.level || "Beginner",
              mainWeakness: data.mainWeakness || "Loops",
              mostImproved: data.mostImproved || "Conditionals",
              recommendedPractice: data.recommendedPractice || "Arrays & Strings",
              proficiencyScore: data.proficiencyScore || 50,
              xp: parseInt(localStorage.getItem("codebench_xp") || "0", 10),
              streak: streakDays,
              badges: JSON.parse(localStorage.getItem("codebench_badges") || "[]").length,
            }
            setProfile(newProfile)
            
            // Save to localStorage
            localStorage.setItem(
              "codebench_learning_profile",
              JSON.stringify({ profile: newProfile, timestamp: Date.now() })
            )
          }
        } catch (error) {
          console.error("Failed to analyze profile:", error)
          // Set default profile
          setProfile({
            level: "Beginner",
            mainWeakness: "Loops",
            mostImproved: "Conditionals",
            recommendedPractice: "Arrays & Strings",
            proficiencyScore: 50,
            xp: parseInt(localStorage.getItem("codebench_xp") || "0", 10),
            streak: parseInt(localStorage.getItem("codebench_streak_days") || "0", 10),
            badges: JSON.parse(localStorage.getItem("codebench_badges") || "[]").length,
          })
        }
      }
      setLoading(false)
    }

    loadProfile()
  }, [code, studentId, embedInDashboard, refreshKey])

  // Load submissions and practice problems
  useEffect(() => {
    const loadSubmissions = async () => {
      if (!studentId) return
      
      setLoadingSubmissions(true)
      try {
        const response = await fetch(`/api/codebench/submissions?studentId=${studentId}`)
        if (response.ok) {
          const data = await response.json()
          setSubmissions(data.codeSubmissions || [])
          setPracticeProblems(data.practiceSubmissions || [])
        }
      } catch (error) {
        console.error("Failed to load submissions:", error)
      } finally {
        setLoadingSubmissions(false)
      }
    }

    loadSubmissions()
  }, [studentId])

  if (loading) {
    return <CodebenchAnalyticsSkeleton />
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4 p-8">
        <div className={cn("w-16 h-16 rounded-full flex items-center justify-center", embedInDashboard ? "bg-slate-200 dark:bg-white/10" : "bg-slate-700/50")}>
          <User className={cn("h-8 w-8", embedInDashboard ? "text-slate-500 dark:text-slate-400" : "text-slate-500")} />
        </div>
        <div className="text-center">
          <div className={cn("font-semibold text-lg mb-2", embedInDashboard ? "text-slate-900 dark:text-white" : "text-slate-200")}>No profile data available</div>
          <div className={cn("text-sm max-w-md", embedInDashboard ? "text-slate-500 dark:text-slate-400" : "text-slate-400")}>
            Write some code in CodeBench and use the AI features to generate your coding profile
          </div>
          {embedInDashboard && (
            <Button asChild className="mt-4 rounded-xl">
              <Link href="/student/dashboard-v2/codebench/ide">Open CodeBench IDE</Link>
            </Button>
          )}
        </div>
      </div>
    )
  }

  const levelColor =
    profile.level === "Advanced"
      ? "bg-slate-700 text-white dark:bg-slate-600"
      : profile.level === "Intermediate"
      ? "bg-blue-500/90 text-white"
      : "bg-emerald-500/90 text-white"

  const sectionBase = embedInDashboard
    ? "border border-slate-200/60 dark:border-white/[0.08] rounded-xl"
    : "bg-slate-900/50 border-slate-700/50 rounded-xl"
  const textLabel = embedInDashboard ? "text-slate-500 dark:text-slate-400" : "text-slate-400"
  const textMuted = embedInDashboard ? "text-slate-500 dark:text-slate-400" : "text-slate-400"
  const tabsListClass = embedInDashboard
    ? "grid w-full grid-cols-2 bg-slate-100 dark:bg-white/5 p-1 rounded-xl"
    : "grid w-full grid-cols-2 bg-slate-800/50 border border-slate-700/50"
  const tabsTriggerClass = embedInDashboard
    ? "rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-400 transition-all"
    : "rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-slate-300 data-[state=inactive]:hover:bg-slate-700/50 transition-all"

  return (
    <div className="space-y-6">
      {/* Main Profile Card */}
      <Card className={embedInDashboard ? "gap-0 border-0 bg-transparent p-0 shadow-none backdrop-blur-none dark:bg-transparent" : "bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-slate-700/50 shadow-xl backdrop-blur-sm"}>
        <CardHeader className={cn("pb-4", embedInDashboard && "px-0 pt-0")}>
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className={embedInDashboard ? "text-slate-900 dark:text-white" : "bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent"}>
              My Coding Profile
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className={cn("space-y-6", embedInDashboard && "px-0")}>
          <div className={cn("flex items-center justify-between p-4 rounded-xl border", sectionBase)}>
            <div>
              <div className={cn("text-xs font-medium uppercase tracking-wide mb-2", textLabel)}>Level</div>
              <Badge className={cn("mt-1 border-0 px-4 py-1.5 text-sm font-semibold", embedInDashboard ? "bg-blue-500/90 text-white" : levelColor)}>
                {profile.level}
              </Badge>
            </div>
            <div className="text-right">
              <div className={cn("text-xs font-medium uppercase tracking-wide mb-2", textLabel)}>Proficiency Score</div>
              <div className={cn("text-3xl font-bold", embedInDashboard ? "text-slate-900 dark:text-white" : "bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent")}>
                {profile.proficiencyScore}%
              </div>
            </div>
          </div>

          <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4", !embedInDashboard && "border-t border-slate-700/50")}>
            <div className={cn("p-4 rounded-xl border", embedInDashboard ? "border-slate-200/60 dark:border-white/[0.08]" : "bg-red-500/10 border-red-500/20")}>
              <div className={cn("flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-2", embedInDashboard ? "text-slate-500 dark:text-slate-400" : "text-red-400")}>
                <Target className="h-4 w-4" />
                Main Weakness
              </div>
              <div className={cn("text-xl font-bold", embedInDashboard ? "text-slate-900 dark:text-white" : "text-red-300")}>{profile.mainWeakness}</div>
            </div>
            <div className={cn("p-4 rounded-xl border", embedInDashboard ? "border-slate-200/60 dark:border-white/[0.08]" : "bg-green-500/10 border-green-500/20")}>
              <div className={cn("flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-2", embedInDashboard ? "text-slate-500 dark:text-slate-400" : "text-green-400")}>
                <TrendingUp className="h-4 w-4" />
                Most Improved
              </div>
              <div className={cn("text-xl font-bold", embedInDashboard ? "text-slate-900 dark:text-white" : "text-green-300")}>{profile.mostImproved}</div>
            </div>
          </div>

          <div className={cn("pt-4", !embedInDashboard && "border-t border-slate-700/50")}>
            <div className={cn("p-4 rounded-xl border", embedInDashboard ? "border-slate-200/60 dark:border-white/[0.08]" : "bg-blue-500/10 border-blue-500/20")}>
              <div className={cn("flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-2", embedInDashboard ? "text-slate-500 dark:text-slate-400" : "text-blue-400")}>
                <Award className="h-4 w-4" />
                Recommended Practice
              </div>
              <div className={cn("text-xl font-bold", embedInDashboard ? "text-slate-900 dark:text-white" : "text-blue-300")}>{profile.recommendedPractice}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats — streak & badges (XP shown in page header) */}
      <div className={cn("grid gap-4", embedInDashboard ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3")}>
        {!embedInDashboard && (
        <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/20 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <Zap className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="text-xs font-semibold uppercase tracking-wide text-yellow-400/80">XP</div>
            </div>
            <div className="text-3xl font-bold text-yellow-300">{profile.xp}</div>
            <div className={cn("text-xs mt-1", textMuted)}>Experience Points</div>
          </CardContent>
        </Card>
        )}

        <Card className={embedInDashboard ? "rounded-xl border border-slate-200/60 bg-transparent shadow-none backdrop-blur-none dark:border-white/[0.08] dark:bg-transparent" : "bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20 shadow-lg"}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("p-2 rounded-lg", embedInDashboard ? "bg-blue-500/10 dark:bg-blue-500/20" : "bg-orange-500/20")}>
                <Flame className={cn("h-5 w-5", embedInDashboard ? "text-blue-600 dark:text-blue-400" : "text-orange-400")} />
              </div>
              <div className={cn("text-xs font-semibold uppercase tracking-wide", embedInDashboard ? "text-slate-500 dark:text-slate-400" : "text-orange-400/80")}>Streak</div>
            </div>
            <div className={cn("text-3xl font-bold", embedInDashboard ? "text-slate-900 dark:text-white" : "text-orange-300")}>{profile.streak}</div>
            <div className={cn("text-xs mt-1", textMuted)}>Days in a row</div>
          </CardContent>
        </Card>

        <Card className={embedInDashboard ? "rounded-xl border border-slate-200/60 bg-transparent shadow-none backdrop-blur-none dark:border-white/[0.08] dark:bg-transparent" : "bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20 shadow-lg"}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("p-2 rounded-lg", embedInDashboard ? "bg-blue-500/10 dark:bg-blue-500/20" : "bg-purple-500/20")}>
                <Award className={cn("h-5 w-5", embedInDashboard ? "text-blue-600 dark:text-blue-400" : "text-purple-400")} />
              </div>
              <div className={cn("text-xs font-semibold uppercase tracking-wide", embedInDashboard ? "text-slate-500 dark:text-slate-400" : "text-purple-400/80")}>Badges</div>
            </div>
            <div className={cn("text-3xl font-bold", embedInDashboard ? "text-slate-900 dark:text-white" : "text-purple-300")}>{profile.badges}</div>
            <div className={cn("text-xs mt-1", textMuted)}>Achievements earned</div>
          </CardContent>
        </Card>
      </div>

      {/* Submissions and Practice Problems */}
      <Tabs defaultValue="submissions" className="w-full">
        <TabsList className={tabsListClass}>
          <TabsTrigger value="submissions" className={cn("flex items-center gap-2", tabsTriggerClass)}>
            <Code className="h-4 w-4" />
            Code Submissions ({submissions.length})
          </TabsTrigger>
          <TabsTrigger value="practice" className={cn("flex items-center gap-2", tabsTriggerClass)}>
            <FileText className="h-4 w-4" />
            Practice Problems ({practiceProblems.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="submissions" className="mt-4">
          <Card className={embedInDashboard ? "rounded-xl border border-slate-200/60 bg-transparent shadow-none backdrop-blur-none dark:border-white/[0.08] dark:bg-transparent" : "bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-slate-700/50"}>
            <CardContent className="pt-6">
              {loadingSubmissions ? (
                <div className="text-center py-8 text-slate-400">Loading submissions...</div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Code className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <div>No submissions yet</div>
                  <div className="text-sm mt-2">Submit code in CodeBench to see your submissions here</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {submissions.map((sub) => (
                    <div key={sub.id} className={cn("p-4 rounded-lg border", embedInDashboard ? "bg-slate-100/80 dark:bg-white/[0.06] border-slate-200/60 dark:border-white/[0.06]" : "bg-slate-700/30 border-slate-600/50")}>
                      <div className="flex items-center justify-between mb-2">
                        <div className={cn("text-sm font-semibold", embedInDashboard ? "text-slate-900 dark:text-white" : "text-slate-200")}>
                          {new Date(sub.submitted_at).toLocaleDateString()}
                        </div>
                        <Badge variant={sub.status === "approved" ? "default" : "secondary"}>
                          {sub.status}
                        </Badge>
                      </div>
                      {sub.score !== null && (
                        <div className={cn("text-sm mb-2", textMuted)}>
                          Score: {sub.score}/10 • Points: {sub.points_awarded || 0}
                        </div>
                      )}
                      <div className={cn("text-xs font-mono line-clamp-2", embedInDashboard ? "text-slate-600 dark:text-slate-400" : "text-slate-500")}>
                        {sub.code.substring(0, 100)}...
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="practice" className="mt-4">
          <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-slate-700/50">
            <CardContent className="pt-6">
              {loadingSubmissions ? (
                <div className="text-center py-8 text-slate-400">Loading practice problems...</div>
              ) : practiceProblems.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <div>No practice problems solved yet</div>
                  <div className="text-sm mt-2">Complete practice problems in CodeBench to see them here</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {practiceProblems.map((prob) => (
                    <div key={prob.id} className={cn("p-4 rounded-lg border", embedInDashboard ? "bg-slate-100/80 dark:bg-white/[0.06] border-slate-200/60 dark:border-white/[0.06]" : "bg-slate-700/30 border-slate-600/50")}>
                      <div className="flex items-center justify-between mb-2">
                        <div className={cn("text-sm font-semibold", embedInDashboard ? "text-slate-900 dark:text-white" : "text-slate-200")}>
                          {new Date(prob.submitted_at).toLocaleDateString()}
                        </div>
                        <Badge variant={prob.status === "approved" ? "default" : "secondary"}>
                          {prob.status}
                        </Badge>
                      </div>
                      {prob.score !== null && (
                        <div className={cn("text-sm mb-2", textMuted)}>
                          Score: {prob.score}/10 • Points: {prob.points_awarded || 0}
                        </div>
                      )}
                      <div className={cn("text-sm line-clamp-2", embedInDashboard ? "text-slate-600 dark:text-slate-400" : "text-slate-300")}>
                        {prob.problem_statement?.substring(0, 150)}...
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

