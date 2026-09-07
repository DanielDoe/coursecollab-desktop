"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, GraduationCap, Clock, Trophy, Star, Target, CheckCircle2, AlertCircle, BookOpen, Zap, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AssessmentActionButtons } from "@/components/assessment-action-buttons";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StudentHeader } from "@/components/student-header";
import { getStudentData, logoutStudent, getStudentAuthHeaders, studentApiFetch } from "@/lib/auth";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { QuizIssuesPanel } from "@/components/quiz-issues-panel";
import { studentResultsPdfGateSatisfied } from "@/lib/student-results-pdf-gate";
import { formatCentralDateTime } from "@/lib/timezone";

interface Final {
  id: number;
  title: string;
  description: string;
  time_per_question: number;
  total_duration_seconds?: number;
  available_from: string;
  available_until: string;
  retake_limit: number;
  created_at: string;
  updated_at: string;
  attempts_used: number;
  attempt_id?: number | null; // Latest completed attempt ID for viewing results
  status: 'pending' | 'completed' | 'overdue' | 'locked';
  is_active?: boolean; // Added to track if final is active (accounts for beta users)
}

export default function StudentFinalExamsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [studentData, setStudentData] = useState<any>(null);
  const [final, setFinal] = useState<Final | null>(null);

  useEffect(() => {
    const data = getStudentData();
    if (!data) {
      router.push("/student/login");
      return;
    }
    setStudentData(data);
    fetchFinal(data.section, data);
  }, [router]);

  const fetchFinal = async (section: string, studentData: any) => {
    try {
      setLoading(true);
      if (!studentData) {
        router.push("/student/login");
        return;
      }
      
      const response = await studentApiFetch(`/api/student/finals?session=${section}&studentId=${studentData.id}`, {
        method: 'GET'
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch final: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      // Take the first (and should be only) final exam
      setFinal(data.finals?.[0] || null);
    } catch (error) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (final: Final) => {
    const isCompleted = final.status === 'completed';
    const isOverdue = final.status === 'overdue';
    const isLocked = final.status === 'locked';
    
    if (isCompleted) {
      return (
        <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 dark:from-emerald-600 dark:to-green-600 text-white border-0 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold shadow-lg w-full sm:w-auto justify-center sm:justify-start">
          <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" />
          Completed
        </Badge>
      );
    } else if (isOverdue) {
      return (
        <Badge className="bg-gradient-to-r from-red-500 to-pink-500 dark:from-red-600 dark:to-pink-600 text-white border-0 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold shadow-lg w-full sm:w-auto justify-center sm:justify-start">
          <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" />
          <span className="sm:hidden">Closed</span>
          <span className="hidden sm:inline">Exam Closed</span>
        </Badge>
      );
    } else if (isLocked) {
      return (
        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 dark:from-amber-600 dark:to-orange-600 text-white border-0 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold shadow-lg w-full sm:w-auto justify-center sm:justify-start">
          <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" />
          <span className="sm:hidden">Not Available</span>
          <span className="hidden sm:inline">Not Available Yet</span>
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 dark:from-amber-600 dark:to-yellow-600 text-white border-0 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold shadow-lg w-full sm:w-auto justify-center sm:justify-start">
          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" />
          Available
        </Badge>
      );
    }
  };

  const getTimeRemaining = (availableUntil: string) => {
    const now = new Date();
    const due = new Date(availableUntil);
    const diff = due.getTime() - now.getTime();
    
    if (diff <= 0) return "Exam Closed";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days} days ${hours} hours remaining`;
    if (hours > 0) return `${hours} hours remaining`;
    return "Due soon";
  };

  const handleStartFinal = () => {
    if (final) {
      router.push(`/student/final/${final.id}`);
    }
  };

  const handleViewReport = async () => {
    if (final && final.attempt_id) {
      const attemptId = final.attempt_id
      
      // Check PDF download status before navigating
      try {
        const response = await studentApiFetch(`/api/student/results/${attemptId}`, {
          headers: getStudentAuthHeaders(),
        })
        if (response.ok) {
          const data = await response.json()
          const hasDownloaded = studentResultsPdfGateSatisfied(data)
          
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log('🔍 [PDF Download] View Report Button Clicked (Final Exams)')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log('📄 Attempt ID:', attemptId)
          console.log('📥 PDF Downloaded:', hasDownloaded ? '✅ YES' : '❌ NO')
          
          if (!hasDownloaded) {
            console.log('🚫 PDF not downloaded - storing navigation intent for immediate modal')
            // Store navigation intent so modal shows immediately on results page
            sessionStorage.setItem('pendingReportNavigation', `/student/results/${attemptId}`)
            sessionStorage.setItem('pendingReportAttemptId', attemptId.toString())
          } else {
            console.log('✅ PDF already downloaded - allowing navigation')
          }
        }
      } catch (error) {
        console.error('[PDF Download] Error checking download status:', error)
        // On error, still store navigation intent to be safe
        sessionStorage.setItem('pendingReportNavigation', `/student/results/${attemptId}`)
        sessionStorage.setItem('pendingReportAttemptId', attemptId.toString())
      }
      
      // Navigate to results page - modal will show there if PDF not downloaded
      router.push(`/student/results/${attemptId}`);
    } else {
      console.error("[Final Exams] No attempt ID available for viewing results");
      toast({
        title: "Results Not Available",
        description: "No completed attempt found. Please complete the final exam first.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    logoutStudent();
    router.push("/student/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <StudentHeader onLogout={handleLogout} />
        <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
          <div className="flex items-center justify-center py-8 sm:py-12">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
              <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-blue-600/30 dark:border-blue-500/30 border-t-blue-600 dark:border-t-blue-500 rounded-full animate-spin"></div>
              <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base md:text-lg font-medium">
                <span className="sm:hidden">Loading...</span>
                <span className="hidden sm:inline">Loading final exam...</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 overflow-x-hidden">
      <StudentHeader onLogout={handleLogout} />
      
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 overflow-x-hidden">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 sm:mb-8 relative"
        >
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
            <div className="relative shrink-0">
              <div className="p-2.5 sm:p-3 md:p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-600 to-slate-700 dark:from-slate-500 dark:to-slate-600 text-white shadow-xl">
                <GraduationCap className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-800 dark:text-slate-200 break-words">
                <span className="sm:hidden">Final Exam</span>
                <span className="hidden sm:inline md:hidden">Final Examination</span>
                <span className="hidden md:inline">Final Examination</span>
              </h1>
              <p className="text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground dark:text-slate-400 mt-1 sm:mt-2">
                <span className="sm:hidden">Course assessment</span>
                <span className="hidden sm:inline">Course Completion Assessment</span>
              </p>
            </div>
          </div>

          {/* Back Button - Floating to the right on mobile, full button on desktop */}
          <Button
            onClick={() => router.push("/student/dashboard")}
            variant="outline"
            size="sm"
            className="absolute top-0 right-0 sm:hidden h-9 px-3 rounded-lg border-2 border-slate-300/60 dark:border-slate-600/60 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100 dark:hover:from-slate-800/30 dark:hover:to-slate-700/30 hover:border-slate-400 dark:hover:border-slate-500 text-slate-700 dark:text-slate-300 shadow-md hover:shadow-lg transition-all duration-200 gap-1.5"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-medium">Back</span>
          </Button>
          
          <Button
            onClick={() => router.push("/student/dashboard")}
            variant="outline"
            size="lg"
            className="hidden sm:flex absolute top-0 right-0 rounded-xl border-2 border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors text-sm md:text-base px-3 md:px-4 shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 md:space-y-8 order-2 lg:order-1">
            {!final ? (
              /* No Final Available */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="border-2 border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm shadow-lg rounded-xl sm:rounded-2xl">
                  <CardContent className="py-8 sm:py-12 md:py-16 text-center px-4 sm:px-6">
                    <div className="p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 w-fit mx-auto mb-4 sm:mb-6">
                      <GraduationCap className="h-10 w-10 sm:h-12 sm:w-12 md:h-16 md:w-16 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-muted-foreground dark:text-slate-200 mb-3 sm:mb-4">
                      <span className="sm:hidden">Not Available</span>
                      <span className="hidden sm:inline">Final Exam Not Yet Available</span>
                    </h3>
                    <p className="text-sm sm:text-base md:text-lg text-muted-foreground dark:text-slate-400 mb-4 sm:mb-6 break-words">
                      <span className="sm:hidden">Will appear when scheduled by instructor</span>
                      <span className="hidden sm:inline">Your instructor will schedule the final examination when the course is ready for completion.</span>
                    </p>
                    <Button 
                      onClick={() => router.push("/student/dashboard")}
                      className="bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-700 text-white border-0 px-4 sm:px-6 md:px-8 py-2 sm:py-2.5 md:py-3 rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-xs sm:text-sm md:text-base w-full sm:w-auto"
                    >
                      <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                      <span className="sm:hidden">Dashboard</span>
                      <span className="hidden sm:inline">Return to Dashboard</span>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              /* Final Exam Available */
              <>
            {/* Status Banner */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-2 border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50 backdrop-blur-sm shadow-xl rounded-xl sm:rounded-2xl">
                <CardContent className="p-4 sm:p-6 md:p-8">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 sm:gap-4 md:gap-6 flex-1 min-w-0">
                      <div className="p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-slate-600 to-slate-700 dark:from-slate-500 dark:to-slate-600 text-white shadow-lg shrink-0">
                        <Trophy className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-200 mb-1 sm:mb-2 break-words">
                          {final.title}
                        </h2>
                        <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-400">
                          {getTimeRemaining(final.available_until)}
                        </p>
                      </div>
                    </div>
                    <div className="w-full sm:w-auto shrink-0">{getStatusBadge(final)}</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

                {/* Exam Details */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-4 sm:space-y-6"
                >
                {/* Exam Information */}
                <Card className="border-2 border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm shadow-lg rounded-xl sm:rounded-2xl">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 sm:gap-3">
                      <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-slate-600 dark:text-slate-400 shrink-0" />
                      <span>
                        <span className="sm:hidden">Info</span>
                        <span className="hidden sm:inline">Exam Information</span>
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0">
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2 sm:mb-3">
                        Description
                      </h3>
                      <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed break-words">
                        {final.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-3 sm:space-y-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 dark:from-blue-600 dark:to-cyan-600 text-white shrink-0">
                            <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200">
                              <span className="sm:hidden">Duration</span>
                              <span className="hidden sm:inline">Total Duration</span>
                            </p>
                            <p className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400">
                              {(() => {
                                // Calculate total duration from question time limits
                                const totalSeconds = final.total_duration_seconds || 0;
                                const totalMinutes = Math.round(totalSeconds / 60);
                                const hours = Math.floor(totalMinutes / 60);
                                const minutes = totalMinutes % 60;
                                
                                if (hours > 0) {
                                  return `${hours}h ${minutes}m`;
                                }
                                return `${totalMinutes} minutes`;
                              })()}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 dark:from-emerald-600 dark:to-green-600 text-white shrink-0">
                            <Target className="h-4 w-4 sm:h-5 sm:w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200">
                              <span className="sm:hidden">Attempts</span>
                              <span className="hidden sm:inline">Attempts Used</span>
                            </p>
                            <p className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
                              {final.attempts_used} / 1
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Single attempt — no retakes</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 sm:space-y-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 dark:from-amber-600 dark:to-orange-600 text-white shrink-0">
                            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200">Due Date</p>
                            <p className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400">
                              {formatCentralDateTime(final.available_until, "MMM d, yyyy • h:mm a")}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 dark:from-purple-600 dark:to-pink-600 text-white shrink-0">
                            <Star className="h-4 w-4 sm:h-5 sm:w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200">
                              <span className="sm:hidden">Type</span>
                              <span className="hidden sm:inline">Exam Type</span>
                            </p>
                            <p className="text-base sm:text-lg font-bold text-purple-600 dark:text-purple-400">
                              <span className="sm:hidden">Final</span>
                              <span className="hidden sm:inline">Comprehensive Final</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Progress Tracking */}
                <Card className="border-2 border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm shadow-lg rounded-xl sm:rounded-2xl">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 sm:gap-3">
                      <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-slate-600 dark:text-slate-400 shrink-0" />
                      <span>
                        <span className="sm:hidden">Progress</span>
                        <span className="hidden sm:inline">Progress Tracking</span>
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
                    <div>
                      <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground dark:text-slate-400 mb-2 sm:mb-3">
                        <span>
                          <span className="sm:hidden">Progress</span>
                          <span className="hidden sm:inline">Attempt Progress</span>
                        </span>
                        <span>
                          {(() => {
                            const attemptsUsed = final.attempts_used || 0;
                            const isLocked = final.status === 'locked';
                            
                            if (isLocked) {
                              return "0%";
                            }
                            
                            if (attemptsUsed === 0) return "0%";
                            if (final.status === 'completed') return "100%";
                            return "In progress";
                          })()}
                        </span>
                      </div>
                      <Progress 
                        value={(() => {
                          const attemptsUsed = final.attempts_used || 0;
                          const isLocked = final.status === 'locked';
                          
                          if (isLocked) return 0;
                          if (attemptsUsed === 0) return 0;
                          if (final.status === 'completed') return 100;
                          return 50;
                        })()} 
                        className="h-2.5 sm:h-3 md:h-4"
                      />
                    </div>
                    
                    <div className="text-center pt-2 sm:pt-3 md:pt-4">
                      <p className="text-xs sm:text-sm text-muted-foreground dark:text-slate-400 break-words px-2">
                        {(() => {
                          const attemptsUsed = final.attempts_used || 0;
                          const isLocked = final.status === 'locked';
                          
                          if (isLocked) {
                            const now = new Date();
                            const availableFrom = final.available_from ? new Date(final.available_from) : null;
                            if (availableFrom) {
                              const timeUntilAvailable = availableFrom.getTime() - now.getTime();
                              const days = Math.floor(timeUntilAvailable / (1000 * 60 * 60 * 24));
                              const hours = Math.floor((timeUntilAvailable % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                              
                              if (days > 0) {
                                return `Exam will be available in ${days} day${days > 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''}`;
                              } else if (hours > 0) {
                                return `Exam will be available in ${hours} hour${hours > 1 ? 's' : ''}`;
                              } else {
                                return "Exam will be available soon";
                              }
                            }
                            return "Exam is not available yet";
                          }
                          
                          if (attemptsUsed === 0) {
                            return "Ready to begin your final examination (one attempt only)";
                          } else if (final.status === 'completed') {
                            return "Final examination completed successfully";
                          }
                          return "Final examination in progress";
                        })()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

                {/* Action Panel */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Card className="border-2 border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50 backdrop-blur-sm shadow-xl sticky top-4 sm:top-8 rounded-xl sm:rounded-2xl">
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-slate-800 dark:text-slate-200 text-center">
                        <span className="sm:hidden">Actions</span>
                        <span className="hidden sm:inline">Exam Actions</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
                      {/* Study Guide Button - Always visible */}
                      <Button
                        onClick={() => router.push("/student/final-exams/study-guide")}
                        variant="outline"
                        className="w-full border-2 border-sky-300 dark:border-sky-600 text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl transition-all duration-200 font-semibold text-xs sm:text-sm md:text-base h-10 sm:h-11 md:h-auto flex items-center justify-center gap-2"
                      >
                        <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                        <span className="sm:hidden">Study Guide</span>
                        <span className="hidden sm:inline">View Study Guide</span>
                      </Button>

                      {(() => {
                        const isNotYetAvailable = final.is_active === false || final.status === 'locked';
                        let lockedLabel: string | undefined;
                        if (isNotYetAvailable) {
                          const now = new Date();
                          const availableFrom = final.available_from ? new Date(final.available_from) : null;
                          const timeUntilAvailable = availableFrom ? availableFrom.getTime() - now.getTime() : 0;
                          const days = Math.floor(timeUntilAvailable / (1000 * 60 * 60 * 24));
                          const hours = Math.floor((timeUntilAvailable % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                          const minutes = Math.floor((timeUntilAvailable % (1000 * 60 * 60)) / (1000 * 60));
                          lockedLabel = days > 0 ? `Available in ${days}d ${hours}h` : hours > 0 ? `Available in ${hours}h ${minutes}m` : `Available in ${minutes}m`;
                        }
                        return (
                          <AssessmentActionButtons
                            layout="horizontal"
                            align="right"
                            assessmentLabel="Final Exam"
                            startGradient="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 dark:from-slate-500 dark:to-slate-600 dark:hover:from-slate-600 dark:hover:to-slate-700"
                            onViewReport={final.attempt_id ? handleViewReport : undefined}
                            onStart={!isNotYetAvailable && final.status !== 'completed' && final.status !== 'overdue' ? handleStartFinal : undefined}
                            show={{
                              report: final.status === 'completed',
                              closed: final.status === 'overdue',
                              locked: isNotYetAvailable,
                              start: !isNotYetAvailable && final.status !== 'completed' && final.status !== 'overdue',
                            }}
                            lockedLabel={lockedLabel}
                            closedLabel="Exam Closed"
                            fullWidthMobile
                          />
                        );
                      })()}
                      
                      <div className="pt-3 sm:pt-4 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 text-center break-words">
                          <span className="sm:hidden">Final exam for the course. Be prepared.</span>
                          <span className="hidden sm:inline">This is your comprehensive final examination for the course. Make sure you're prepared and have sufficient time to complete it.</span>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </>
            )}
          </div>

          {/* Right Column - Issues Panel - Always visible */}
          <div className="lg:col-span-1 order-1 lg:order-2">
            <QuizIssuesPanel assessmentType="final" />
          </div>
        </div>
      </div>
    </div>
  );
}
