"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Users, User, Zap, ArrowLeft, Gamepad2, Trophy, Clock, Star, Target, Sparkles, TrendingUp, Award, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSmartHomeLink } from "@/hooks/useSmartHomeLink";
import { StudentHeader } from "@/components/student-header";
import { getStudentData, logoutStudent, studentApiFetch } from "@/lib/auth";
import { motion } from "framer-motion";
import { PlaygroundAccessModal } from "@/components/playground-access-modal";
import { resolvePlaygroundJoinError } from "@/lib/playground-join-client"
import { PLAYGROUND_WEEKLY_CREDITS } from "@/lib/membership-constants";
import {
  getPlaygroundSessionLock,
  playgroundLockStillActive,
  resumePlaygroundWebSession,
  upsertPlaygroundSessionLock,
} from "@/lib/playground-session-lock";

export default function PlaygroundLobby() {
  const router = useRouter();
  const { toast } = useToast();
  const homeLink = useSmartHomeLink();
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [nickname, setNickname] = useState("");
  const [classPasscode, setClassPasscode] = useState("");
  const [mode, setMode] = useState<"CLASSROOM" | "PERSONAL">("CLASSROOM");
  const [isJoining, setIsJoining] = useState(false);
  const [studentData, setStudentData] = useState<any>(null);
  const [accumulatedPoints, setAccumulatedPoints] = useState<number | null>(null);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [averageScore, setAverageScore] = useState<number | null>(null);
  const [playgroundCredits, setPlaygroundCredits] = useState<number | null>(null);
  const [creditsLimit, setCreditsLimit] = useState<number | "unlimited" | null>(null);
  const [isUnlimited, setIsUnlimited] = useState<boolean>(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessModalData, setAccessModalData] = useState<{
    errorType?: "insufficient_credits" | "no_access" | "upgrade_required" | "wait_for_reset";
    errorMessage?: string;
    currentCredits?: number;
    creditsLimit?: number | "unlimited";
    tier?: string;
    daysUntilReset?: number;
  }>({});

  useEffect(() => {
    const data = getStudentData();
    if (!data) {
      router.push("/student/login");
      return;
    }
    setStudentData(data);
    setStudentName(data.name || "");
    setStudentId(data.id || "");
  }, [router]);

  useEffect(() => {
    void (async () => {
      const lock = getPlaygroundSessionLock()
      if (!lock || lock.completed) return
      const stillActive = await playgroundLockStillActive(lock.sessionId, lock.resultId)
      if (!stillActive) return
      const resumePath = await resumePlaygroundWebSession(lock, false)
      if (resumePath) {
        toast({
          title: "Session in progress",
          description: "Resuming your active playground session.",
        })
        router.replace(resumePath)
      }
    })()
  }, [router, toast])

  // Fetch accumulated points and scores from trade center
  useEffect(() => {
    const fetchStudentStats = async () => {
      try {
        // Get student database ID from localStorage
        const studentSessionData = localStorage.getItem("studentSession");
        if (!studentSessionData) return;
        
        const sessionData = JSON.parse(studentSessionData);
        const studentDbId = sessionData.databaseId;
        // sessionData.section contains the session code (e.g., "ELEG1301P01")
        const sessionCode = sessionData.section || "ALL";
        
        if (!studentDbId) return;
        
        await studentApiFetch(`/api/student/membership/refresh?studentId=${studentDbId}`).catch(() => {});

        // Fetch accumulated points
        const pointsResponse = await fetch(`/api/trade-center/points?studentId=${studentDbId}&session=${sessionCode}`);
        if (pointsResponse.ok) {
          const pointsData = await pointsResponse.json();
          if (pointsData.points) {
            setAccumulatedPoints(pointsData.points.playground_points || 0);
          }
        }

        // Fetch playground scores (best and average)
        const scoresResponse = await fetch(`/api/playground/scores?studentId=${studentDbId}`);
        if (scoresResponse.ok) {
          const scoresData = await scoresResponse.json();
          // Show scores if student has played games (totalGames > 0), even if scores are 0
          if (scoresData.totalGames > 0) {
            setBestScore(scoresData.bestScore || 0);
            setAverageScore(scoresData.averageScore || 0);
          } else {
            // No games played yet, keep as null to hide the cards
            setBestScore(null);
            setAverageScore(null);
          }
        }

        // Fetch playground credits
        const creditsResponse = await fetch(`/api/playground/credits?studentId=${studentDbId}`);
        if (creditsResponse.ok) {
          const creditsData = await creditsResponse.json();
          setPlaygroundCredits(creditsData.credits || 0);
          setCreditsLimit(creditsData.creditsLimit || 0);
          setIsUnlimited(creditsData.isUnlimited || false);
        }
      } catch (error) {
        // Error fetching student stats
      }
    };
    
    if (studentData) {
      fetchStudentStats();
    }
  }, [studentData]);

  const handleJoin = async () => {
    if (!studentName.trim() || !studentId.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both your name and student ID",
        variant: "destructive",
      });
      return;
    }

    if (mode === "CLASSROOM" && classPasscode.trim().length !== 5) {
      toast({
        title: "Passcode Required",
        description: "Enter the 5-character passcode from your instructor",
        variant: "destructive",
      });
      return;
    }

    setIsJoining(true);

    const existingLock = getPlaygroundSessionLock()
    if (existingLock && !existingLock.completed) {
      const stillActive = await playgroundLockStillActive(existingLock.sessionId, existingLock.resultId)
      if (stillActive) {
        toast({
          title: "Session in progress",
          description: "Leave and rejoin is disabled during active games.",
          variant: "destructive",
        })
        const resumePath = await resumePlaygroundWebSession(existingLock, false)
        if (resumePath) router.replace(resumePath)
        setIsJoining(false)
        return
      }
    }

    const goToPlayground = (data: Record<string, unknown>) => {
      if (typeof data.sessionId === "number" && typeof data.resultId === "number") {
        upsertPlaygroundSessionLock({
          sessionId: data.sessionId,
          resultId: data.resultId,
          mode,
          startedAt: Date.now(),
          answeredQuestionIds: [],
          lockedIndex: 0,
        })
      }
      sessionStorage.setItem("playgroundSession", JSON.stringify(data));
      sessionStorage.setItem(
        "playgroundStudent",
        JSON.stringify({ studentName, studentId, nickname: nickname.trim() || null }),
      );
      if (data.waitingRoom && !data.gameStarted) {
        router.push("/student/playground/waiting");
      } else {
        router.push("/student/playground/game");
      }
    };

    try {
      const response = await fetch("/api/playground/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName,
          studentId,
          mode,
          nickname: nickname.trim() || null,
          passcode: mode === "CLASSROOM" ? classPasscode.trim().toUpperCase() : undefined,
        }),
      });

      if (!response.ok) {
        let errorData: Record<string, unknown> = {};
        try {
          errorData = await response.json();
        } catch {}

        const resolved = resolvePlaygroundJoinError({
          error: typeof errorData.error === "string" ? errorData.error : undefined,
          insufficientCredits: Boolean(errorData.insufficientCredits),
          creditsRemaining:
            typeof errorData.creditsRemaining === "number" ? errorData.creditsRemaining : undefined,
        });

        if (!resolved.showAccessModal) {
          toast({
            title: "Could not join",
            description: resolved.errorMessage,
            variant: "destructive",
          });
          setIsJoining(false);
          return;
        }

        const now = new Date();
        const dayOfWeek = now.getDay();
        const daysUntilReset = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;

        const studentSessionData = localStorage.getItem("studentSession");
        let studentDbId: string | null = null;
        let currentTier = "Scholar";
        if (studentSessionData) {
          const sessionData = JSON.parse(studentSessionData);
          studentDbId = sessionData.databaseId;
          currentTier = sessionStorage.getItem("studentMembershipTier") || "Scholar";
        }

        try {
          const refreshResponse = await studentApiFetch(`/api/student/membership/refresh?studentId=${studentDbId}`);
          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            if (refreshData.tier) {
              sessionStorage.setItem("studentMembershipTier", refreshData.tier);
              localStorage.setItem("studentMembershipTier", refreshData.tier);
            }
            if (refreshData.hasDonationAccess) {
              const retryResponse = await fetch("/api/playground/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  studentName,
                  studentId,
                  mode,
                  nickname: nickname.trim() || null,
                  passcode: mode === "CLASSROOM" ? classPasscode.trim().toUpperCase() : undefined,
                }),
              });
              if (retryResponse.ok) {
                const retryData = await retryResponse.json();
                goToPlayground(retryData);
                return;
              }
            }
          }
        } catch {}

        setAccessModalData({
          errorType: resolved.errorType,
          errorMessage: resolved.errorMessage,
          currentCredits: resolved.creditsRemaining ?? playgroundCredits ?? 0,
          creditsLimit: creditsLimit || PLAYGROUND_WEEKLY_CREDITS,
          tier: currentTier,
          daysUntilReset,
        });
        setShowAccessModal(true);
        setIsJoining(false);
        return;
      }

      const data = await response.json();
      goToPlayground(data);
    } catch (error: any) {
      // Only show toast for unexpected errors (not handled by modal)
      if (!showAccessModal) {
        toast({
          title: "Error",
          description: error?.message || "Failed to join playground. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleLogout = () => {
    logoutStudent();
    router.push("/student/login");
  };

  if (!studentData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-blue-900/20">
      {/* Header */}
      <StudentHeader />

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        <div className="mx-auto max-w-4xl">
          {/* Header Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 sm:mb-8"
          >
            <div className="mb-6 sm:mb-8 relative">
              {/* Title Row */}
              <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                <motion.div
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  className="relative p-2.5 sm:p-3 md:p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 text-white shadow-2xl shrink-0"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-2xl sm:rounded-3xl" />
                  <Gamepad2 className="h-6 w-6 sm:h-8 sm:w-8 md:h-12 md:w-12 relative z-10" />
                </motion.div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 bg-clip-text text-transparent">
                    Playground
                  </h1>
                  <p className="text-sm sm:text-base md:text-xl lg:text-2xl text-muted-foreground dark:text-slate-400 mt-0.5 sm:mt-1 font-medium">
                    Interactive Quiz Gaming
                  </p>
                </div>
              </div>
              
              {/* Back Button - Floating to the right on mobile, full button on desktop */}
              <Button
                onClick={() => router.push(homeLink)}
                variant="outline"
                size="sm"
                className="absolute top-0 right-0 sm:hidden h-9 px-3 rounded-lg border-2 border-purple-200/60 dark:border-purple-700/60 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/30 dark:hover:to-pink-900/30 hover:border-purple-400 dark:hover:border-purple-500 text-purple-700 dark:text-purple-300 shadow-md hover:shadow-lg transition-all duration-200 gap-1.5"
                title="Back to Dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-xs font-medium">Back</span>
              </Button>
              
              <Button
                onClick={() => router.push(homeLink)}
                variant="outline"
                size="lg"
                className="hidden sm:flex absolute top-0 right-0 rounded-xl border-2 border-purple-200/60 dark:border-purple-700/60 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/30 dark:hover:to-pink-900/30 hover:border-purple-400 dark:hover:border-purple-500 text-purple-700 dark:text-purple-300 transition-all duration-200 shadow-sm hover:shadow-md text-sm md:text-base px-3 md:px-4 shrink-0"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>

            {/* Student Stats Display - Modern Design */}
            {(accumulatedPoints !== null || bestScore !== null || averageScore !== null) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="relative"
              >
                {/* Background glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-blue-500/10 rounded-3xl blur-3xl -z-10" />
                
                <div className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-purple-200/50 dark:border-purple-800/50 shadow-2xl p-4 sm:p-5 md:p-6">
                  <div className="flex items-center gap-2 mb-4 sm:mb-5 md:mb-6">
                    <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                      <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200">Your Performance</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {/* Accumulated Points */}
                    {accumulatedPoints !== null && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.25 }}
                        className="group relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-rose-500/10 dark:from-purple-500/20 dark:via-pink-500/20 dark:to-rose-500/20 border border-purple-300/50 dark:border-purple-700/50 p-3 sm:p-4 md:p-5 hover:border-purple-400 dark:hover:border-purple-600 transition-all duration-300"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-transparent rounded-full blur-2xl" />
                        <div className="relative z-10">
                          <div className="flex items-center justify-between mb-2 sm:mb-3">
                            <div className="p-1.5 sm:p-2 md:p-2.5 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg group-hover:scale-110 transition-transform duration-300">
                              <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                            </div>
                            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full">
                              Total
                            </span>
                          </div>
                          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-0.5 sm:mb-1">
                            {accumulatedPoints.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground font-medium">Accumulated Points</p>
                        </div>
                      </motion.div>
                    )}

                    {/* Best Score */}
                    {bestScore !== null && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="group relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-yellow-500/10 via-orange-500/10 to-amber-500/10 dark:from-yellow-500/20 dark:via-orange-500/20 dark:to-amber-500/20 border border-yellow-300/50 dark:border-yellow-700/50 p-3 sm:p-4 md:p-5 hover:border-yellow-400 dark:hover:border-yellow-600 transition-all duration-300"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-400/20 to-transparent rounded-full blur-2xl" />
                        <div className="relative z-10">
                          <div className="flex items-center justify-between mb-3">
                            <div className="p-1.5 sm:p-2 md:p-2.5 rounded-lg sm:rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 shadow-lg group-hover:scale-110 transition-transform duration-300">
                              <Award className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                            </div>
                            <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2.5 py-1 rounded-full">
                              Peak
                            </span>
                          </div>
                          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-0.5 sm:mb-1">
                            {bestScore.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground font-medium">Your Best Score</p>
                        </div>
                      </motion.div>
                    )}

                    {/* Average Score */}
                    {averageScore !== null && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.35 }}
                        className="group relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500/10 via-cyan-500/10 to-teal-500/10 dark:from-blue-500/20 dark:via-cyan-500/20 dark:to-teal-500/20 border border-blue-300/50 dark:border-blue-700/50 p-3 sm:p-4 md:p-5 hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-300"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-transparent rounded-full blur-2xl" />
                        <div className="relative z-10">
                          <div className="flex items-center justify-between mb-3">
                            <div className="p-1.5 sm:p-2 md:p-2.5 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg group-hover:scale-110 transition-transform duration-300">
                              <Target className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                            </div>
                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2.5 py-1 rounded-full">
                              Avg
                            </span>
                          </div>
                          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-0.5 sm:mb-1">
                            {averageScore.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground font-medium">Your Average Score</p>
                        </div>
                      </motion.div>
                    )}

                    {/* Playground Credits */}
                    {playgroundCredits !== null && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 }}
                        className="group relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500/10 via-green-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:via-green-500/20 dark:to-teal-500/20 border border-emerald-300/50 dark:border-emerald-700/50 p-3 sm:p-4 md:p-5 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all duration-300"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-400/20 to-transparent rounded-full blur-2xl" />
                        <div className="relative z-10">
                          <div className="flex items-center justify-between mb-3">
                            <div className="p-1.5 sm:p-2 md:p-2.5 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 shadow-lg group-hover:scale-110 transition-transform duration-300">
                              <Coins className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                            </div>
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full">
                              {isUnlimited ? "∞" : `${playgroundCredits}/${creditsLimit || 0}`}
                            </span>
                          </div>
                          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-0.5 sm:mb-1">
                            {isUnlimited ? "∞" : playgroundCredits}
                          </p>
                          <p className="text-xs text-muted-foreground font-medium break-words">
                            {isUnlimited ? "Unlimited Credits" : creditsLimit ? `Credits (${creditsLimit}/week)` : "Credits Available"}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Game Rules & Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-10"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-blue-500/5 rounded-3xl blur-2xl" />
              <div className="relative bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-purple-200/30 dark:border-purple-800/30 p-4 sm:p-5 md:p-6 shadow-xl">
                <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200 mb-4 sm:mb-5 md:mb-6 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
                  How It Works
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <motion.div
                    whileHover={{ scale: 1.05, y: -2 }}
                    className="text-center p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200/50 dark:border-purple-800/50"
                  >
                    <div className="inline-flex p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white mb-2 sm:mb-3 shadow-lg">
                      <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400 mb-0.5 sm:mb-1">10s</p>
                    <p className="text-xs text-muted-foreground font-medium">Per Question</p>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.05, y: -2 }}
                    className="text-center p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200/50 dark:border-green-800/50"
                  >
                    <div className="inline-flex p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 text-white mb-2 sm:mb-3 shadow-lg">
                      <Target className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400 mb-0.5 sm:mb-1">+100</p>
                    <p className="text-xs text-muted-foreground font-medium">Correct</p>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.05, y: -2 }}
                    className="text-center p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200/50 dark:border-yellow-800/50"
                  >
                    <div className="inline-flex p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 text-white mb-2 sm:mb-3 shadow-lg">
                      <Zap className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400 mb-0.5 sm:mb-1">+10</p>
                    <p className="text-xs text-muted-foreground font-medium">Speed Bonus</p>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.05, y: -2 }}
                    className="text-center p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200/50 dark:border-blue-800/50"
                  >
                    <div className="inline-flex p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white mb-2 sm:mb-3 shadow-lg">
                      <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 mb-0.5 sm:mb-1">∞</p>
                    <p className="text-xs text-muted-foreground font-medium">Unlimited</p>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Lobby Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-rose-500/10 rounded-3xl blur-3xl" />
              <Card className="relative border-2 border-purple-200/50 dark:border-purple-800/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl">
                <CardHeader className="text-center pb-4 sm:pb-5 md:pb-6 pt-6 sm:pt-7 md:pt-8 px-4 sm:px-6 md:px-8">
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4, type: "spring" }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4"
                  >
                    <div className="relative p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 text-white shadow-xl dark:shadow-purple-900/50">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl sm:rounded-2xl" />
                      <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 relative z-10" />
                    </div>
                    <CardTitle className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                      Join the Game
                    </CardTitle>
                  </motion.div>
                  <CardDescription className="text-sm sm:text-base text-muted-foreground dark:text-slate-400 font-medium">
                    Enter your details and select a game mode to start playing
                  </CardDescription>
                </CardHeader>
              
              <CardContent className="space-y-6 sm:space-y-7 md:space-y-8 px-4 sm:px-6 md:px-8 pb-6 sm:pb-7 md:pb-8">
                {/* Student Info */}
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm sm:text-base font-semibold text-slate-700 dark:text-slate-300">
                        Full Name
                      </Label>
                      <Input
                        id="name"
                        placeholder="Enter your full name"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        disabled={true}
                        className="h-10 sm:h-12 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 cursor-not-allowed text-sm sm:text-base rounded-lg sm:rounded-xl border-2 border-slate-200 dark:border-slate-700 focus-visible:ring-0"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="studentId" className="text-sm sm:text-base font-semibold text-slate-700 dark:text-slate-300">
                        Student ID
                      </Label>
                      <Input
                        id="studentId"
                        placeholder="Enter your student ID"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        disabled={true}
                        className="h-10 sm:h-12 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 cursor-not-allowed text-sm sm:text-base rounded-lg sm:rounded-xl border-2 border-slate-200 dark:border-slate-700 focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nickname" className="text-sm sm:text-base font-semibold text-slate-700 dark:text-slate-300">
                      Gaming Nickname <span className="text-xs font-normal text-muted-foreground dark:text-slate-500">(Optional)</span>
                    </Label>
                    <Input
                      id="nickname"
                      placeholder="Enter a cool nickname for the leaderboard"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      disabled={isJoining}
                      maxLength={50}
                      className="h-10 sm:h-12 text-sm sm:text-base rounded-lg sm:rounded-xl border-2 border-slate-200 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:placeholder:text-slate-500 focus:border-purple-500 dark:focus:border-purple-500 focus-visible:ring-2 focus-visible:ring-purple-500/20 transition-all"
                    />
                    <p className="text-xs text-muted-foreground dark:text-slate-400">
                      Leave blank to use your full name on the leaderboard
                    </p>
                  </div>

                  {mode === "CLASSROOM" && (
                    <div className="space-y-2">
                      <Label htmlFor="passcode" className="text-sm sm:text-base font-semibold text-slate-700 dark:text-slate-300">
                        Session Passcode <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="passcode"
                        placeholder="5-character code from instructor"
                        value={classPasscode}
                        onChange={(e) =>
                          setClassPasscode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))
                        }
                        disabled={isJoining}
                        maxLength={5}
                        className="h-12 font-mono text-lg tracking-[0.35em] text-center uppercase rounded-lg sm:rounded-xl border-2"
                      />
                    </div>
                  )}
                </div>

                {/* Mode Selection */}
                <div className="space-y-3 sm:space-y-4">
                  <Label className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200">
                    Choose Your Game Mode
                  </Label>
                  <RadioGroup value={mode} onValueChange={(value) => setMode(value as "CLASSROOM" | "PERSONAL")}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {/* Classroom Mode */}
                      <motion.div
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className={`relative overflow-hidden rounded-xl sm:rounded-2xl border-2 transition-all duration-300 cursor-pointer ${
                          mode === "CLASSROOM"
                            ? "border-purple-500 bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-900/40 dark:to-pink-900/40 shadow-lg shadow-purple-500/20"
                            : "border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/30 dark:hover:bg-purple-900/10 bg-white/50 dark:bg-slate-800/50"
                        }`}
                        onClick={() => setMode("CLASSROOM")}
                      >
                        <div className="p-4 sm:p-5">
                          <div className="flex items-start gap-3 sm:gap-4">
                            <RadioGroupItem value="CLASSROOM" id="classroom" className="mt-1 scale-110 sm:scale-125 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                                <div className={`p-1.5 sm:p-2 md:p-2.5 rounded-lg sm:rounded-xl transition-all shrink-0 ${
                                  mode === "CLASSROOM"
                                    ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg"
                                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                }`}>
                                  <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                                </div>
                                <Label htmlFor="classroom" className="text-base sm:text-lg font-bold cursor-pointer text-slate-800 dark:text-slate-200">
                                  Classroom Battle
                                </Label>
                              </div>
                              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-2 sm:mb-3 break-words">
                                Compete with other students in real-time! Join a shared session and climb the leaderboard with live rankings.
                              </p>
                              <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-purple-600 dark:text-purple-300 font-semibold">
                                <Trophy className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                                Live Leaderboard
                              </div>
                            </div>
                          </div>
                        </div>
                        {mode === "CLASSROOM" && (
                          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 pointer-events-none" />
                        )}
                      </motion.div>

                      {/* Personal Mode */}
                      <motion.div
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className={`relative overflow-hidden rounded-xl sm:rounded-2xl border-2 transition-all duration-300 cursor-pointer ${
                          mode === "PERSONAL"
                            ? "border-blue-500 bg-gradient-to-br from-blue-50/80 to-cyan-50/80 dark:from-blue-900/40 dark:to-cyan-900/40 shadow-lg shadow-blue-500/20"
                            : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 bg-white/50 dark:bg-slate-800/50"
                        }`}
                        onClick={() => setMode("PERSONAL")}
                      >
                        <div className="p-4 sm:p-5">
                          <div className="flex items-start gap-3 sm:gap-4">
                            <RadioGroupItem value="PERSONAL" id="personal" className="mt-1 scale-110 sm:scale-125 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                                <div className={`p-1.5 sm:p-2 md:p-2.5 rounded-lg sm:rounded-xl transition-all shrink-0 ${
                                  mode === "PERSONAL"
                                    ? "bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg"
                                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                }`}>
                                  <User className="h-4 w-4 sm:h-5 sm:w-5" />
                                </div>
                                <Label htmlFor="personal" className="text-base sm:text-lg font-bold cursor-pointer text-slate-800 dark:text-slate-200">
                                  Solo Practice
                                </Label>
                              </div>
                              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-2 sm:mb-3 break-words">
                                Practice at your own pace! Track your personal best scores and improve over time without pressure.
                              </p>
                              <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-blue-600 dark:text-blue-300 font-semibold">
                                <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                                Personal Records
                              </div>
                            </div>
                          </div>
                        </div>
                        {mode === "PERSONAL" && (
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-cyan-500/5 pointer-events-none" />
                        )}
                      </motion.div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Join Button */}
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="pt-4"
                >
                  <Button 
                    onClick={handleJoin} 
                    disabled={isJoining} 
                    className="w-full h-12 sm:h-14 text-sm sm:text-base md:text-lg font-bold bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 hover:from-purple-600 hover:via-pink-600 hover:to-rose-600 text-white border-0 rounded-lg sm:rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden group"
                    size="lg"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    {isJoining ? (
                      <div className="flex items-center gap-2 sm:gap-3 relative z-10">
                        <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Joining Game...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 sm:gap-3 relative z-10">
                        <Gamepad2 className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span>Start Playing!</span>
                      </div>
                    )}
                  </Button>
                  {/* Go to Leaderboard Button */}
                  {(() => {
                    const lastSession = sessionStorage.getItem("playgroundSession");
                    if (lastSession) {
                      try {
                        const sessionData = JSON.parse(lastSession);
                        if (sessionData.sessionId && sessionData.mode === "CLASSROOM") {
                          return (
                            <Button
                              onClick={() => router.push(`/student/playground/leaderboard?sessionId=${sessionData.sessionId}&mode=${sessionData.mode}`)}
                              variant="outline"
                              className="w-full mt-2 sm:mt-3 h-10 sm:h-12 text-xs sm:text-sm md:text-base font-semibold border-2 rounded-lg sm:rounded-xl"
                              size="lg"
                            >
                              <Trophy className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2" />
                              <span className="hidden sm:inline">Go to Leaderboard</span>
                              <span className="sm:hidden">Leaderboard</span>
                            </Button>
                          );
                        }
                      } catch (e) {
                        // Ignore parse errors
                      }
                    }
                    return null;
                  })()}
                </motion.div>
              </CardContent>
            </Card>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Playground Access Modal */}
      <PlaygroundAccessModal
        open={showAccessModal}
        onClose={() => setShowAccessModal(false)}
        errorType={accessModalData.errorType}
        errorMessage={accessModalData.errorMessage}
        currentCredits={accessModalData.currentCredits}
        creditsLimit={accessModalData.creditsLimit || 0}
        tier={accessModalData.tier}
        daysUntilReset={accessModalData.daysUntilReset}
      />
    </div>
  );
}
