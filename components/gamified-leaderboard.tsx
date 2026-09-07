"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Trophy, 
  Medal, 
  Award, 
  Star,
  Crown,
  Target,
  Clock,
  TrendingUp,
  Zap,
  Flame,
  RefreshCw,
  Filter
} from "lucide-react"
import { motion } from "framer-motion"

interface LeaderboardEntry {
  id?: number
  name?: string
  total_xp?: number
  current_level?: number
  accuracy_percentage?: number
  current_streak?: number
  total_questions_answered?: number
  last_active_date?: string
  current_badge?: string
  badge_icon?: string
  badge_color?: string
  rank: number
  weekly_xp?: number
  topic_xp?: number
  is_current_user?: boolean
}

interface CurrentStudent {
  total_xp: number
  current_level: number
  accuracy_percentage: number
  current_streak: number
  total_questions_answered: number
  weekly_xp: number
  current_badge: string
  badge_icon: string
  badge_color: string
}

interface LeaderboardStats {
  total_students: number
  average_xp: number
  max_xp: number
  average_accuracy: number
}

interface GamifiedLeaderboardProps {
  studentId: string
  className?: string
}

export function GamifiedLeaderboard({ studentId, className }: GamifiedLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [currentStudent, setCurrentStudent] = useState<CurrentStudent | null>(null)
  const [currentStudentRank, setCurrentStudentRank] = useState<number | null>(null)
  const [stats, setStats] = useState<LeaderboardStats>({ total_students: 0, average_xp: 0, max_xp: 0, average_accuracy: 0 })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("global")
  const [selectedTopic, setSelectedTopic] = useState("")

  useEffect(() => {
    fetchLeaderboard(activeTab, selectedTopic)
  }, [activeTab, selectedTopic, studentId])

  const fetchLeaderboard = async (type: string, topic?: string) => {
    try {
      const params = new URLSearchParams({ type })
      if (topic) params.append("topic", topic)

      const response = await studentApiFetch(`/api/student/progress/leaderboard?${params}`, {
        headers: {
          "x-student-id": studentId,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch leaderboard")
      }

      const data = await response.json()
      setLeaderboard(data.leaderboard || [])
      setCurrentStudent(data.currentStudent)
      setCurrentStudentRank(data.currentStudentRank)
      setStats(data.stats || { total_students: 0, average_xp: 0, max_xp: 0, average_accuracy: 0 })

    } catch (error) {
      console.error("Failed to fetch leaderboard:", error)
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-6 w-6 text-yellow-500" />
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />
      default:
        return <Star className="h-5 w-5 text-blue-500" />
    }
  }

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white"
      case 2:
        return "bg-gradient-to-r from-gray-300 to-gray-500 text-white"
      case 3:
        return "bg-gradient-to-r from-amber-500 to-amber-700 text-white"
      default:
        return "bg-gradient-to-r from-blue-500 to-blue-700 text-white"
    }
  }

  const getLevelProgress = (xp: number, level: number) => {
    // Calculate XP needed for next level
    const currentLevelXP = level <= 5 ? (level - 1) * 50 :
                          level <= 10 ? 200 + (level - 5) * 80 :
                          level <= 20 ? 600 + (level - 10) * 100 :
                          1500 + (level - 20) * 100
    
    const nextLevelXP = level <= 5 ? level * 50 :
                       level <= 10 ? 200 + (level - 4) * 80 :
                       level <= 20 ? 600 + (level - 9) * 100 :
                       1500 + (level - 19) * 100

    const progress = ((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100
    return Math.max(0, Math.min(100, progress))
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading leaderboard...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={className}>
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold">{stats.total_students}</p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Your Rank</p>
                <p className="text-2xl font-bold">
                  {currentStudentRank ? `#${currentStudentRank}` : "N/A"}
                </p>
              </div>
              <Trophy className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Your XP</p>
                <p className="text-2xl font-bold">{currentStudent?.total_xp || 0}</p>
              </div>
              <Zap className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Your Streak</p>
                <p className="text-2xl font-bold">{currentStudent?.current_streak || 0}</p>
              </div>
              <Flame className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Student Progress Card */}
      {currentStudent && (
        <Card className="mb-6 border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                style={{ backgroundColor: currentStudent.badge_color }}
              >
                {currentStudent.badge_icon}
              </div>
              Your Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  Level {currentStudent.current_level}
                </div>
                <div className="text-sm text-muted-foreground">
                  {currentStudent.current_badge}
                </div>
                <Progress 
                  value={getLevelProgress(currentStudent.total_xp, currentStudent.current_level)} 
                  className="mt-2" 
                />
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(currentStudent.accuracy_percentage)}%
                </div>
                <div className="text-sm text-muted-foreground">Accuracy</div>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {currentStudent.total_questions_answered}
                </div>
                <div className="text-sm text-muted-foreground">Questions</div>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {currentStudent.weekly_xp}
                </div>
                <div className="text-sm text-muted-foreground">Weekly XP</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="global">Global</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="topic">Topic</TabsTrigger>
        </TabsList>

        <TabsContent value="global">
          <LeaderboardList 
            leaderboard={leaderboard} 
            type="global"
            getRankIcon={getRankIcon}
            getRankBadgeColor={getRankBadgeColor}
            getLevelProgress={getLevelProgress}
          />
        </TabsContent>

        <TabsContent value="weekly">
          <LeaderboardList 
            leaderboard={leaderboard} 
            type="weekly"
            getRankIcon={getRankIcon}
            getRankBadgeColor={getRankBadgeColor}
            getLevelProgress={getLevelProgress}
          />
        </TabsContent>

        <TabsContent value="topic">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={selectedTopic === "" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTopic("")}
              >
                All Topics
              </Button>
              <Button
                variant={selectedTopic === "Variables" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTopic("Variables")}
              >
                Variables
              </Button>
              <Button
                variant={selectedTopic === "Loops" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTopic("Loops")}
              >
                Loops
              </Button>
              <Button
                variant={selectedTopic === "Functions" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTopic("Functions")}
              >
                Functions
              </Button>
            </div>
            <LeaderboardList 
              leaderboard={leaderboard} 
              type="topic"
              getRankIcon={getRankIcon}
              getRankBadgeColor={getRankBadgeColor}
              getLevelProgress={getLevelProgress}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface LeaderboardListProps {
  leaderboard: LeaderboardEntry[]
  type: string
  getRankIcon: (rank: number) => JSX.Element
  getRankBadgeColor: (rank: number) => string
  getLevelProgress: (xp: number, level: number) => number
}

function LeaderboardList({ leaderboard, type, getRankIcon, getRankBadgeColor, getLevelProgress }: LeaderboardListProps) {
  if (leaderboard.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Data Yet</h3>
            <p className="text-muted-foreground">
              Be the first to complete practice sessions and appear on the leaderboard!
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-yellow-500" />
          {type === "global" ? "Global Leaderboard" : 
           type === "weekly" ? "Weekly Leaderboard" : 
           "Topic Leaderboard"}
        </CardTitle>
        <CardDescription>
          {type === "global" ? "Top performers by total XP" :
           type === "weekly" ? "This week's top performers" :
           "Top performers by topic"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {leaderboard.map((entry, index) => {
            const isCurrentUser = entry.is_current_user || String(entry.id) === String(studentId)
            return (
            <motion.div
              key={`rank-${entry.rank}-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                index < 3 ? "border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50" : "border-border bg-background"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${getRankBadgeColor(entry.rank)}`}>
                  {entry.rank}
                </div>
                
                <div className={`flex items-center gap-3 ${!isCurrentUser ? "blur-[6px] select-none pointer-events-none" : ""}`}>
                  {getRankIcon(entry.rank)}
                  <div>
                    <div className="font-semibold text-lg">
                      {isCurrentUser ? (entry.name || "You") : "Student"}
                    </div>
                    {isCurrentUser ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span 
                        className="px-2 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: entry.badge_color, color: 'white' }}
                      >
                        {entry.badge_icon} {entry.current_badge}
                      </span>
                      <span>Level {entry.current_level}</span>
                    </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">Details hidden</div>
                    )}
                  </div>
                </div>
              </div>

              <div className={`flex items-center gap-6 ${!isCurrentUser ? "blur-[6px] select-none pointer-events-none" : ""}`}>
                {isCurrentUser ? (
                <>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">XP</div>
                  <div className="text-xl font-bold text-purple-600">
                    {type === "weekly" ? entry.weekly_xp : type === "topic" ? entry.topic_xp : entry.total_xp}
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Accuracy</div>
                  <div className="text-lg font-semibold text-green-600">
                    {Math.round(entry.accuracy_percentage || 0)}%
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Streak</div>
                  <div className="text-lg font-semibold text-red-600">
                    {entry.current_streak}
                  </div>
                </div>
                </>
                ) : (
                  <div className="text-slate-400">•••</div>
                )}
              </div>
            </motion.div>
          )})}
        </div>
      </CardContent>
    </Card>
  )
}
