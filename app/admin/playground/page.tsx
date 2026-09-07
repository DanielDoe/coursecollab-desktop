"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { GraduationCap, Play, Square, RotateCcw, Settings, Users, Trophy, TrendingUp, Target } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"

interface ActiveSession {
  id: number
  sessionCode: string
  durationSec: number
  topics: string[]
  questionCount: number
  createdAt: string
  participantCount: number
}

interface SessionSummary {
  totalParticipants: number
  avgScore: number
  topScore: number
  topPlayers: Array<{ name: string; score: number }>
}

interface Topic {
  name: string
  questionCount: number
}

export default function AdminPlayground() {
  const { toast } = useToast()
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [durationSec, setDurationSec] = useState(10)
  const [questionCount, setQuestionCount] = useState(10)
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null)
  const [showStopDialog, setShowStopDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showSummaryDialog, setShowSummaryDialog] = useState(false)

  useEffect(() => {
    fetchTopics()
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchTopics = async () => {
    try {
      const response = await fetch("/api/playground/admin/topics")
      const data = await response.json()
      if (response.ok) {
        setTopics(Array.isArray(data.topics) ? data.topics : [])
      }
    } catch (error) {
      console.error("[v0] Error fetching topics:", error)
      setTopics([])
    }
  }

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/playground/admin/status")
      if (!response.ok) throw new Error("Failed to fetch status")
      const data = await response.json()
      if (data.activeSession) {
        setActiveSession({
          ...data.activeSession,
          topics: Array.isArray(data.activeSession.topics) ? data.activeSession.topics : [],
        })
      } else {
        setActiveSession(null)
      }
    } catch (error) {
      console.error("[v0] Error fetching playground status:", error)
      setActiveSession(null)
    }
  }

  const handleTopicToggle = (topicName: string) => {
    setSelectedTopics((prev) => (prev.includes(topicName) ? prev.filter((t) => t !== topicName) : [...prev, topicName]))
  }

  const handleStartSession = async () => {
    if (durationSec < 5 || durationSec > 60) {
      toast({
        title: "Invalid Duration",
        description: "Duration must be between 5 and 60 seconds",
        variant: "destructive",
      })
      return
    }

    if (questionCount < 5 || questionCount > 50) {
      toast({
        title: "Invalid Question Count",
        description: "Question count must be between 5 and 50",
        variant: "destructive",
      })
      return
    }

    setIsStarting(true)
    try {
      const response = await fetch("/api/playground/admin/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationSec,
          topics: selectedTopics.length > 0 ? selectedTopics : null,
          questionCount,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to start session")
      }

      setActiveSession({
        id: data.sessionId,
        sessionCode: data.sessionCode,
        durationSec: data.durationSec,
        topics: data.topics || [],
        questionCount: data.questionCount,
        createdAt: data.createdAt,
        participantCount: 0,
      })

      toast({
        title: "Session Started",
        description: `Classroom session ${data.sessionCode} is now active with ${data.questionsAdded} questions`,
      })
    } catch (error: any) {
      console.error("[v0] Error starting session:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to start session",
        variant: "destructive",
      })
    } finally {
      setIsStarting(false)
    }
  }

  const handleStopSession = async () => {
    if (!activeSession) return

    setIsStopping(true)
    try {
      const response = await fetch("/api/playground/admin/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSession.id }),
      })

      if (!response.ok) throw new Error("Failed to stop session")

      const data = await response.json()
      setSessionSummary(data.summary)
      setActiveSession(null)
      setShowStopDialog(false)
      setShowSummaryDialog(true)

      toast({
        title: "Session Ended",
        description: "Classroom playground session has been stopped",
      })
    } catch (error) {
      console.error("[v0] Error stopping session:", error)
      toast({
        title: "Error",
        description: "Failed to stop session",
        variant: "destructive",
      })
    } finally {
      setIsStopping(false)
    }
  }

  const handleResetLeaderboard = async () => {
    if (!activeSession) return

    setIsResetting(true)
    try {
      const response = await fetch("/api/playground/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSession.id }),
      })

      if (!response.ok) throw new Error("Failed to reset leaderboard")

      setShowResetDialog(false)
      toast({
        title: "Leaderboard Reset",
        description: "All scores have been cleared for this session",
      })

      fetchStatus()
    } catch (error) {
      console.error("[v0] Error resetting leaderboard:", error)
      toast({
        title: "Error",
        description: "Failed to reset leaderboard",
        variant: "destructive",
      })
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="min-h-screen bg-secondary">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/admin/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <GraduationCap className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-primary">CourseCollab</h1>
            </Link>
            <Link href="/admin/dashboard">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Configuration Panel */}
            <div className="lg:col-span-2 space-y-6">
              {/* Topic Selection */}
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Question Topics
                  </CardTitle>
                  <CardDescription>Select topics from Question Bank (leave empty for all topics)</CardDescription>
                </CardHeader>
                <CardContent>
                  {!topics || topics.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No topics available in Question Bank</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {topics.map((topic) => (
                        <div
                          key={topic.name}
                          className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                          onClick={() => !activeSession && handleTopicToggle(topic.name)}
                        >
                          <Checkbox
                            id={topic.name}
                            checked={selectedTopics.includes(topic.name)}
                            onCheckedChange={() => handleTopicToggle(topic.name)}
                            disabled={!!activeSession}
                          />
                          <label htmlFor={topic.name} className="flex-1 cursor-pointer">
                            <div className="font-medium">{topic.name}</div>
                            <div className="text-xs text-muted-foreground">{topic.questionCount} questions</div>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Session Settings */}
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" />
                    Session Settings
                  </CardTitle>
                  <CardDescription>Configure timing and question count</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Duration Setting */}
                  <div className="space-y-2">
                    <Label htmlFor="duration">Time Per Question (seconds)</Label>
                    <Input
                      id="duration"
                      type="number"
                      min={5}
                      max={60}
                      value={durationSec}
                      onChange={(e) => setDurationSec(Number(e.target.value))}
                      disabled={!!activeSession}
                    />
                    <p className="text-xs text-muted-foreground">Range: 5-60 seconds</p>
                  </div>

                  {/* Question Count */}
                  <div className="space-y-2">
                    <Label htmlFor="questionCount">Number of Questions</Label>
                    <Input
                      id="questionCount"
                      type="number"
                      min={5}
                      max={50}
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value))}
                      disabled={!!activeSession}
                    />
                    <p className="text-xs text-muted-foreground">Range: 5-50 questions</p>
                  </div>

                  {/* Start/Stop Buttons */}
                  {!activeSession ? (
                    <Button onClick={handleStartSession} disabled={isStarting} className="w-full" size="lg">
                      <Play className="h-5 w-5 mr-2" />
                      {isStarting ? "Starting..." : "Start Classroom Session"}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <Button
                        onClick={() => setShowStopDialog(true)}
                        disabled={isStopping}
                        variant="destructive"
                        className="w-full"
                        size="lg"
                      >
                        <Square className="h-5 w-5 mr-2" />
                        {isStopping ? "Stopping..." : "Stop Session"}
                      </Button>
                      <Button
                        onClick={() => setShowResetDialog(true)}
                        disabled={isResetting}
                        variant="outline"
                        className="w-full"
                      >
                        <RotateCcw className="h-5 w-5 mr-2" />
                        {isResetting ? "Resetting..." : "Reset Leaderboard"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Session Status */}
            <div className="space-y-6">
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-accent" />
                    Current Session
                  </CardTitle>
                  <CardDescription>Live session information</CardDescription>
                </CardHeader>
                <CardContent>
                  {!activeSession ? (
                    <div className="text-center py-8">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                        <Play className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground">No active session</p>
                      <p className="text-sm text-muted-foreground mt-1">Configure and start a session</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/30">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Status</p>
                          <p className="text-lg font-bold text-success">Active</p>
                        </div>
                        <div className="h-3 w-3 rounded-full bg-success animate-pulse"></div>
                      </div>

                      <div className="p-4 rounded-lg bg-card border-2 border-primary/30">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Session Code</p>
                        <p className="text-3xl font-bold text-primary font-mono">{activeSession.sessionCode}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-card border border-border">
                          <p className="text-sm font-medium text-muted-foreground mb-1">Participants</p>
                          <p className="text-2xl font-bold text-foreground">{activeSession.participantCount}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-card border border-border">
                          <p className="text-sm font-medium text-muted-foreground mb-1">Duration</p>
                          <p className="text-2xl font-bold text-foreground">{activeSession.durationSec}s</p>
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-card border border-border">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Questions</p>
                        <p className="text-lg font-bold text-foreground mb-2">{activeSession.questionCount} total</p>
                        {activeSession.topics && activeSession.topics.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {activeSession.topics.map((topic) => (
                              <Badge key={topic} variant="secondary" className="text-xs">
                                {topic}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Info Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Session Codes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Each session gets a unique code (P01, P02, etc.). Students in the same session compete only with
                    each other on the leaderboard.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Stop Session Dialog */}
      <AlertDialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop Playground Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will end session {activeSession?.sessionCode}. All participant scores will be saved, and you'll see a
              summary of the session results.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleStopSession} disabled={isStopping} className="bg-destructive">
              {isStopping ? "Stopping..." : "Stop Session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Leaderboard Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Leaderboard?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all scores for session {activeSession?.sessionCode}. This action cannot be undone.
              Students will need to rejoin to start fresh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetLeaderboard} disabled={isResetting} className="bg-destructive">
              {isResetting ? "Resetting..." : "Reset Leaderboard"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Session Summary Dialog */}
      <AlertDialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-accent" />
              Session Summary
            </AlertDialogTitle>
            <AlertDialogDescription>Here's how the session went</AlertDialogDescription>
          </AlertDialogHeader>
          {sessionSummary && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-secondary">
                  <Users className="h-5 w-5 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold text-foreground">{sessionSummary.totalParticipants}</div>
                  <p className="text-xs text-muted-foreground">Participants</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-secondary">
                  <TrendingUp className="h-5 w-5 text-accent mx-auto mb-2" />
                  <div className="text-2xl font-bold text-foreground">{sessionSummary.avgScore}</div>
                  <p className="text-xs text-muted-foreground">Avg Score</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-secondary">
                  <Trophy className="h-5 w-5 text-success mx-auto mb-2" />
                  <div className="text-2xl font-bold text-foreground">{sessionSummary.topScore}</div>
                  <p className="text-xs text-muted-foreground">Top Score</p>
                </div>
              </div>

              {sessionSummary.topPlayers.length > 0 && (
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Top Players</h4>
                  <div className="space-y-2">
                    {sessionSummary.topPlayers.map((player, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-muted-foreground">#{index + 1}</span>
                          <span className="text-foreground">{player.name}</span>
                        </div>
                        <span className="font-bold text-primary">{player.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowSummaryDialog(false)}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
