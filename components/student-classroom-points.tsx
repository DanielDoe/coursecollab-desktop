"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Award,
  TrendingUp,
  Trophy,
  Star,
  Calendar,
  Gift,
  Medal,
  Crown,
  Sparkles,
  Zap,
  Code,
  Send,
  Loader2,
  CheckCircle2,
  FileCode,
  ChevronDown,
  ChevronUp,
  Target,
  BarChart3,
  Flame,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Lightbulb,
  AlertTriangle
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QuestionTextRenderer } from "@/components/question-text-renderer";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import dynamic from "next/dynamic";
import { PointBoosterModal } from "@/components/point-booster-modal";
import { PlotUpload } from "@/components/plot-upload";
import {
  CLASSROOM_POINTS_FOR_FULL_GRADE,
  classroomRawPointsToGradePoints10,
} from "@/lib/classroom-points-grade-scale";
import { ClassroomPointHistoryCard } from "@/components/classroom-point-history-card";
import { ClassroomPointBoosterBadge } from "@/components/classroom-point-booster-badge";
import { ClassroomProvisionalScoreBadge } from "@/components/classroom-provisional-score-badge";
import { resolveClassroomDisplayPoints } from "@/lib/classroom-point-booster";
import { classroomPointsLeaderboardForCurrentOffering } from "@/lib/classroom-points-leaderboard-scope";
import type { ClassroomPointHistoryRow } from "@/components/classroom-point-history-detail";
import { ClassroomAssignmentAccessNotice } from "@/components/classroom-assignment-access-notice";
import {
  buildClassroomSubmissionsSnapshot,
  getClassroomAccessLockExplanation,
  isClassroomAssignmentPastDue,
  resolveActiveAssignmentId,
} from "@/lib/classroom-assignment-access";
import { useClassroomSubmissionAccessMonitor } from "@/hooks/use-classroom-submission-access-monitor";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

function assignmentSuggestsPlot(title: string, description: string): boolean {
  const t = `${title || ""} ${description || ""}`.toLowerCase()
  return (
    /\b(plot|plotting|fplot|figure|figures|graph|graphs|subplot|legend|mesh|surf|contour|stem|stairs|histogram|fft|bode|nyquist|visualize|visualization|gnuplot|matplotlib|matlab|array\s*plot|discrete)\b/.test(
      t,
    ) ||
    /\b(code\s*write\s*plot|writeplot|code\s*\+\s*plot|plot\s*upload)\b/.test(t) ||
    t.includes("chapter 13")
  )
}

interface ClassroomPoint extends ClassroomPointHistoryRow {
  id: number;
  points: number;
  reason: string;
  category: string;
  awarded_at: string;
  instructor_name: string;
}

interface LeaderboardEntry {
  rank: number;
  student_id?: number;
  student_number?: string;
  full_name?: string;
  session?: string;
  total_points?: number;
  award_count?: number;
  is_current_user?: boolean;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string; gradient: string; bgGradient: string }> = {
  code_submission: { 
    label: "Code assignment", 
    icon: "💻", 
    gradient: "from-blue-500 to-cyan-500",
    bgGradient: "from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30"
  },
  presentation: { 
    label: "Presentation", 
    icon: "🎤", 
    gradient: "from-purple-500 to-pink-500",
    bgGradient: "from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30"
  },
  participation: { 
    label: "Participation", 
    icon: "🙋", 
    gradient: "from-green-500 to-emerald-500",
    bgGradient: "from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30"
  },
  quiz_bonus: { 
    label: "Quiz Bonus", 
    icon: "📝", 
    gradient: "from-orange-500 to-amber-500",
    bgGradient: "from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30"
  },
  extra_credit: { 
    label: "Extra Credit", 
    icon: "⭐", 
    gradient: "from-yellow-500 to-orange-500",
    bgGradient: "from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30"
  },
  other: { 
    label: "Other", 
    icon: "🎁", 
    gradient: "from-pink-500 to-rose-500",
    bgGradient: "from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/30"
  }
};

const DEFAULT_CODE = `#include <iostream>

using namespace std;

int main() {
    // Your code goes here...
    
    return 0;
}`;

export function StudentClassroomPoints({ studentId, studentSession }: { studentId: number; studentSession?: string }) {
  const { toast } = useToast();
  const [points, setPoints] = useState<ClassroomPoint[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [awardCount, setAwardCount] = useState(0);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Get session from props or sessionStorage as fallback
  const session = studentSession || (typeof window !== 'undefined' ? sessionStorage.getItem("studentSection") : null);
  
  // Code submission state
  const [showCodeSubmission, setShowCodeSubmission] = useState(false);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [plotImage, setPlotImage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>("");
  const [availableSubmissions, setAvailableSubmissions] = useState<any[]>([]);
  const [missingSubmissions, setMissingSubmissions] = useState<any[]>([]);
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [selectedMissingId, setSelectedMissingId] = useState<string>("");
  const [selectedPendingId, setSelectedPendingId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{
    pointBooster?: number;
    pointsAwarded?: number;
    boosterLabel?: string;
  }>({});
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [pointsHistoryPage, setPointsHistoryPage] = useState(1);
  const pointsPerPage = 5;
  const [blurLeaderboardPeers, setBlurLeaderboardPeers] = useState(true);
  const [pointsForFullGrade, setPointsForFullGrade] = useState(CLASSROOM_POINTS_FOR_FULL_GRADE);

  const getClassroomSelection = useCallback(
    () => ({
      codeActiveId: selectedSubmissionId,
      codeMissingId: selectedMissingId,
      solutionActiveId: "",
      solutionMissingId: "",
    }),
    [selectedSubmissionId, selectedMissingId],
  );

  const {
    codeNotice,
    clearCodeNotice,
    markChannelSubmittable,
    handleSubmissionsRefresh,
  } = useClassroomSubmissionAccessMonitor(toast, getClassroomSelection, {
    setCodeActiveId: setSelectedSubmissionId,
    setCodeMissingId: setSelectedMissingId,
    setCodePendingId: setSelectedPendingId,
    setSolutionActiveId: () => {},
    setSolutionMissingId: () => {},
    setSolutionPendingId: () => {},
  });

  const submissionsSnapshot = useMemo(
    () =>
      buildClassroomSubmissionsSnapshot({
        submissions: availableSubmissions,
        pendingSubmissions,
        missingSubmissions,
      }),
    [availableSubmissions, pendingSubmissions, missingSubmissions],
  );

  const effectiveCodeNotice =
    codeNotice ??
    (() => {
      const id = resolveActiveAssignmentId(selectedSubmissionId, selectedMissingId);
      if (!id || selectedSubmissionId) return null;
      const row =
        missingSubmissions.find((s) => s.id === id) ||
        availableSubmissions.find((s) => s.id === id);
      if (!row || !isClassroomAssignmentPastDue(row)) return null;
      return getClassroomAccessLockExplanation(id, submissionsSnapshot, "code");
    })();

  useEffect(() => {
    console.log("[Student Classroom Points] Component mounted with studentId:", studentId);
    fetchData();
    fetchSubmissions();
    
    // Poll for submission updates every 10 seconds to catch instructor edits
    // Pause polling when modal is open to prevent interference
    const interval = setInterval(() => {
      if (!showSuccessModal) {
        fetchSubmissions();
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [studentId, session, showSuccessModal]);

  const fetchSubmissions = async () => {
    try {
      console.log("[Student Classroom Points] Fetching submissions for studentId:", studentId, "session:", session);
      const response = await studentApiFetch(`/api/classroom-points/submissions?session=${session || ''}&studentId=${studentId}`);
      const data = await response.json();
      console.log("[Student Classroom Points] Submissions data received:", data);

      const snapshot = handleSubmissionsRefresh(data);
      setAvailableSubmissions(snapshot.available);
      setPendingSubmissions(snapshot.pending);
      setMissingSubmissions(snapshot.missing);

      console.log("[Student Classroom Points] Updated submissions - Available:", snapshot.available.length, "Pending:", snapshot.pending.length, "Missing:", snapshot.missing.length);
    } catch (error) {
      console.error("[Student Classroom Points] Error fetching submissions:", error);
    }
  };

  const fetchData = async (showLoading = true) => {
    try {
      if (showLoading) {
      setLoading(true);
      }

      console.log("[Student Classroom Points] Fetching for studentId:", studentId);

      // Fetch student's points (scope to current section so totals match leaderboard + app bar)
      const pointsUrl =
        session && session !== "ALL"
          ? `/api/classroom-points?studentId=${encodeURIComponent(String(studentId))}&session=${encodeURIComponent(session)}`
          : `/api/classroom-points?studentId=${encodeURIComponent(String(studentId))}`
      const pointsResponse = await fetch(pointsUrl);
      const pointsData = await pointsResponse.json();
      
      console.log("[Student Classroom Points] Points data received:", pointsData);
      console.log("[Student Classroom Points] Summary:", pointsData.summary);
      console.log("[Student Classroom Points] Total points (raw):", pointsData.summary?.total_points);
      console.log("[Student Classroom Points] Total points (type):", typeof pointsData.summary?.total_points);
      
      const pointsArray = pointsData.points || [];
      const rawTotal = pointsData.summary?.total_points;
      const rawCount = pointsData.summary?.award_count;
      
      // Safely derive totals:
      // 1) Prefer summary totals from API when present
      // 2) Fallback to summing the points array if summary is missing (backwards compatible)
      let parsedTotal = 0;
      let parsedCount = 0;

      if (rawTotal !== undefined && rawTotal !== null) {
        parsedTotal = parseFloat(String(rawTotal));
      } else {
        parsedTotal = pointsArray.reduce((sum: number, point: ClassroomPoint) => {
          const value = Number(point.points);
          return sum + (Number.isFinite(value) ? value : 0);
        }, 0);
      }

      if (rawCount !== undefined && rawCount !== null) {
        parsedCount = parseInt(String(rawCount), 10);
      } else {
        parsedCount = pointsArray.length;
      }
      
      console.log("[Student Classroom Points] Parsed total:", parsedTotal);
      console.log("[Student Classroom Points] Parsed count:", parsedCount);
      
      setPoints(pointsArray);
      setTotalPoints(parsedTotal);
      setAwardCount(parsedCount);

      const policyCap = Number(pointsData.rewardsPolicy?.points_for_full_grade);
      if (Number.isFinite(policyCap) && policyCap > 0) {
        setPointsForFullGrade(policyCap);
      }

      console.log("[Student Classroom Points] State updated - Total:", parsedTotal, "Count:", parsedCount);

      // Fetch leaderboard - filtered by session if available
      const leaderboardUrl = session 
        ? `/api/classroom-points/leaderboard?session=${session}&studentId=${studentId}`
        : `/api/classroom-points/leaderboard?studentId=${studentId}`;
      
      console.log("[Student Classroom Points] Fetching leaderboard from:", leaderboardUrl);
      const leaderboardResponse = await fetch(leaderboardUrl);
      const leaderboardData = await leaderboardResponse.json();
      const leaderboardArray = classroomPointsLeaderboardForCurrentOffering(
        leaderboardData.leaderboard || [],
        { section: session },
      );
      setLeaderboard(leaderboardArray);
      setBlurLeaderboardPeers(
        leaderboardData.leaderboardPrivacy?.blurPeerNames ??
          leaderboardData.privacyMode ??
          true,
      );

      console.log("[Student Classroom Points] Leaderboard data:", {
        count: leaderboardArray.length,
        session: session || "all",
        sample: leaderboardArray[0]
      });

      // Find my rank
      const myEntry = leaderboardArray.find((entry: LeaderboardEntry) => entry.student_id === studentId);
      if (myEntry) {
        console.log("[Student Classroom Points] My leaderboard entry:", myEntry);
        setMyRank(myEntry.rank);
      } else {
        console.log("[Student Classroom Points] Student not found in leaderboard");
        setMyRank(null);
      }

    } catch (error) {
      console.error("[Student Classroom Points] Error fetching data:", error);
    } finally {
      if (showLoading) {
      setLoading(false);
      }
    }
  };

  const formatTimeRemaining = (expiresAt: string | null | undefined) => {
    if (!expiresAt) return "Open — no deadline set";
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''} left`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    } else {
      return `${minutes}m left`;
    }
  };

  const isAssignmentPastDue = isClassroomAssignmentPastDue;

  const formatMissingAssignmentLabel = (submission: { is_active?: boolean; expires_at?: string | null }) =>
    isAssignmentPastDue(submission)
      ? "Past due — not submitted"
      : `Expires: ${formatTimeRemaining(submission.expires_at ?? "")}`;

  const getRankBadge = (rank: number) => {
    if (rank === 1) return (
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Badge className="bg-amber-500 dark:bg-amber-600 text-white text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
          <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 shrink-0" />
          <span className="sm:hidden">1st</span>
          <span className="hidden sm:inline">1st Place</span>
        </Badge>
      </motion.div>
    );
    if (rank === 2) return (
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Badge className="bg-slate-500 dark:bg-slate-600 text-white text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
          <Medal className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 shrink-0" />
          <span className="sm:hidden">2nd</span>
          <span className="hidden sm:inline">2nd Place</span>
        </Badge>
      </motion.div>
    );
    if (rank === 3) return (
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Badge className="bg-amber-500 dark:bg-amber-600 text-white text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
          <Medal className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 shrink-0" />
          <span className="sm:hidden">3rd</span>
          <span className="hidden sm:inline">3rd Place</span>
        </Badge>
      </motion.div>
    );
    return (
      <Badge variant="outline" className="text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 dark:border-slate-600 dark:text-slate-300 border-2">
        #{rank}
      </Badge>
    );
  };

  // Normalize code for comparison (remove extra whitespace, normalize line endings)
  const normalizeCode = (code: string): string => {
    return code
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Check if code is the default template
  const isDefaultTemplate = (submittedCode: string): boolean => {
    if (!submittedCode || !submittedCode.trim()) {
      return true;
    }

    // Remove all comments (single-line and multi-line)
    const removeComments = (code: string): string => {
      return code
        .replace(/\/\/.*$/gm, '') // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .trim();
    };

    const codeWithoutComments = removeComments(submittedCode);
    const templateWithoutComments = removeComments(DEFAULT_CODE);
    
    // Normalize both for comparison
    const normalizedSubmitted = normalizeCode(codeWithoutComments);
    const normalizedTemplate = normalizeCode(templateWithoutComments);
    
    // Check if they're essentially the same (allowing for minor whitespace differences)
    if (normalizedSubmitted === normalizedTemplate) {
      return true;
    }
    
    // Check if the code has meaningful content beyond the template structure
    // Template keywords that should be present in any valid C++ program
    const templateKeywords = [
      '#include <iostream>',
      'using namespace std',
      'int main()',
      'int main(void)',
      'return 0',
      'return0',
      '{',
      '}'
    ];
    
    // Get all lines from the code
    const lines = codeWithoutComments
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
    
    // Count lines that are NOT template keywords or empty braces
    const nonTemplateLines = lines.filter(line => {
      const lowerLine = line.toLowerCase().replace(/\s+/g, '');
      
      // Skip empty lines, braces-only lines, and template keywords
      if (lowerLine === '' || lowerLine === '{' || lowerLine === '}') {
        return false;
      }
      
      const isTemplateLine = templateKeywords.some(keyword => {
        const normalizedKeyword = keyword.toLowerCase().replace(/\s+/g, '');
        // Check if the line is exactly the template keyword or contains only template keywords
        return lowerLine === normalizedKeyword || 
               (lowerLine.includes(normalizedKeyword) && lowerLine.length <= normalizedKeyword.length + 2);
      });
      
      return !isTemplateLine;
    });
    
    // If there are no meaningful lines beyond the template structure, it's the template
    // We require at least 1 non-template line to consider it a valid submission
    if (nonTemplateLines.length < 1) {
      return true;
    }
    
    // Additional check: if the code is too short (just template + minimal changes)
    // Require at least 15 characters of actual code beyond template structure
    // This allows for simple statements like "cout << "Hello World!" << endl;"
    const meaningfulCode = nonTemplateLines.join(' ').trim();
    if (meaningfulCode.length < 15) {
      return true;
    }
    
    // Check if the meaningful code contains actual executable statements
    // Look for common C++ statements/operators that indicate real code
    const executablePatterns = [
      /cout/i,
      /cin/i,
      /printf/i,
      /scanf/i,
      /if\s*\(/i,
      /for\s*\(/i,
      /while\s*\(/i,
      /=\s*[^=]/,  // Assignment operator
      /\+|\-|\*|\//,  // Arithmetic operators
      /<<|>>/,  // Stream operators
      /[a-zA-Z_][a-zA-Z0-9_]*\s*\(/,  // Function calls
    ];
    
    const hasExecutableCode = executablePatterns.some(pattern => pattern.test(meaningfulCode));
    
    // If there's executable code, it's not a template
    if (hasExecutableCode) {
      return false;
    }
    
    return false;
  };

  const handleCodeSubmit = async () => {
    if (!code || code.trim().length < 10) {
      toast({
        title: "Invalid Code",
        description: "Please write some code before submitting",
        variant: "destructive",
      });
      return;
    }

    // Check if student is submitting the default template
    if (isDefaultTemplate(code)) {
      setShowTemplateModal(true);
      return;
    }

    if (!selectedSubmissionId) {
      toast({
        title: "Assignment Required",
        description: "Please select an assignment from the dropdown",
        variant: "destructive",
      });
      return;
    }

    // Check if already attempted
    const selectedSubmission = availableSubmissions.find(s => s.id.toString() === selectedSubmissionId);
    if (selectedSubmission?.attempted) {
      toast({
        title: "Already Submitted",
        description: "You have already submitted code for this assignment",
        variant: "destructive",
      });
      return;
    }

    // Check if expired
    if (selectedSubmission && new Date(selectedSubmission.expires_at) < new Date()) {
      toast({
        title: "Deadline passed — submission closed",
        description:
          "This assignment's deadline has passed. Unsaved code in the editor was not submitted. Contact your instructor if you need an extension.",
        variant: "destructive",
        duration: 12000,
      });
      return;
    }

    setIsSubmitting(true);
    setSubmissionSuccess(false);

    try {
      const response = await studentApiFetch("/api/classroom-points/submit-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          studentId,
          description: description.trim() || undefined,
          submissionId: parseInt(selectedSubmissionId),
          plotImage: plotImage || undefined,
        }),
      });

      if (!response.ok) {
        let errorData;
        try {
          const text = await response.text();
          console.error("[Student Classroom Points] Error response text:", text);
          errorData = text ? JSON.parse(text) : { error: `HTTP ${response.status}: ${response.statusText}` };
        } catch (parseError) {
          console.error("[Student Classroom Points] Failed to parse error response:", parseError);
          errorData = { error: `HTTP ${response.status}: ${response.statusText || "Unknown error"}` };
        }
        
        console.error("[Student Classroom Points] Submission failed:", {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        
        toast({
          title: "Submission Failed",
          description: errorData.error || `Failed to submit code (${response.status}). Please try again.`,
          variant: "destructive",
        });
        return;
      }

      const data = await response.json();
      console.log("[Student Classroom Points] Submission response:", data);

      if (data.success) {
        setSubmissionSuccess(true);
        setCode(DEFAULT_CODE);
        setPlotImage(null);
        setDescription("");
        setSelectedSubmissionId("");
        setSelectedMissingId("");
        setSelectedPendingId("");
        setSuccessModalData({
          pointBooster: data.pointBooster ?? 1,
          pointsAwarded: data.pointsAwarded ?? 2.5,
          boosterLabel: data.boosterLabel ?? "x1",
        });
        setShowSuccessModal(true);
        
        // Immediately refresh submissions to update pending list
        // This ensures the newly submitted assignment appears in the pending dropdown
        await fetchSubmissions();
        
        // Don't refresh data immediately - wait until modal is dismissed
        // This prevents the modal from disappearing due to page reload
      } else {
        console.error("[Student Classroom Points] Submission not successful:", data);
        toast({
          title: "Submission Failed",
          description: data.error || "Failed to submit code",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("[Student Classroom Points] Error submitting code:", error);
      toast({
        title: "Error",
        description: "Failed to submit code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSubmissionSuccess(false), 3000);
    }
  };

  const maxClassroomPoints = pointsForFullGrade;
  const progressPercentage = totalPoints > 0 ? Math.min((totalPoints / maxClassroomPoints) * 100, 100) : 0;
  const classroomGradePoints = classroomRawPointsToGradePoints10(totalPoints, pointsForFullGrade).toFixed(1);

  // Pagination for points history
  const totalPages = Math.ceil(points.length / pointsPerPage);
  const startIndex = (pointsHistoryPage - 1) * pointsPerPage;
  const endIndex = startIndex + pointsPerPage;
  const paginatedPoints = points.slice(startIndex, endIndex);

  console.log("[Student Classroom Points] Display values - Total:", totalPoints, "Max:", maxClassroomPoints, "Progress:", progressPercentage, "Grade Points:", classroomGradePoints);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full blur-2xl opacity-20 animate-pulse" />
            <div className="relative h-16 w-16 border-4 border-purple-200 dark:border-purple-800 border-t-purple-600 dark:border-t-purple-400 rounded-full animate-spin mx-auto" />
          </div>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-6 font-medium">
            <span className="sm:hidden">Loading...</span>
          <span className="hidden sm:inline">Loading your classroom points...</span>
        </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-8">
      {/* Hero Section - Stunning Gradient Card */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <Card className="relative overflow-hidden border-0 shadow-2xl rounded-2xl sm:rounded-3xl">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-indigo-600 to-pink-600 dark:from-purple-700 dark:via-indigo-700 dark:to-pink-700" />
          
          {/* Animated orbs */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
          
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
          
          <CardContent className="relative p-6 sm:p-8 md:p-10 lg:p-12 text-white">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 lg:gap-8">
              {/* Left Side - Title and Info */}
              <div className="flex-1 space-y-4">
                  <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center gap-4"
                >
                  <motion.div 
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-4 rounded-2xl bg-white/20 backdrop-blur-md shadow-xl"
                  >
                    <Sparkles className="h-8 w-8 sm:h-10 sm:w-10" />
                  </motion.div>
                  <div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-2 text-white">
                      Classroom Points
                    </h1>
                    <p className="text-white/90 text-sm sm:text-base md:text-lg flex items-center gap-2">
                      <Zap className="h-4 w-4 sm:h-5 sm:w-5" />
                      Keep up the great work!
                    </p>
                  </div>
                </motion.div>

                {/* Progress Bar */}
                {myRank && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm sm:text-base font-semibold">Your Progress</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="text-white/80 hover:text-white transition-colors">
                                <HelpCircle className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-sm p-4 bg-slate-900 text-white">
                              <div className="space-y-2">
                                <div className="font-semibold mb-2 flex items-center gap-2">
                                  <Lightbulb className="h-4 w-4" />
                                  How to Max Out Classroom Points ({maxClassroomPoints} pts = 10/10):
                                </div>
                                <ol className="list-decimal list-inside space-y-1 text-sm">
                                  <li>Submit all classroom codes</li>
                                  <li>Give presentations in class</li>
                                  <li>Submit classroom codes from CodeBench (worth 5pts, not 2.5pts)</li>
                                  <li>Use practice problems on CodeBench for extra points</li>
                                  <li>Answer questions in class</li>
                                </ol>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="text-right">
                        <span className="text-xl sm:text-2xl font-bold">{totalPoints.toFixed(1)}/{maxClassroomPoints}</span>
                        <span className="text-xs sm:text-sm text-white/80 ml-2">
                          ({classroomGradePoints}/10 in grades)
                        </span>
                      </div>
                    </div>
                    <div className="h-3 sm:h-4 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                      <motion.div
                        className="h-full bg-amber-400 dark:bg-amber-500 rounded-full"
                        key={totalPoints} // Re-animate when totalPoints changes
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(progressPercentage, 100)}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                      />
                    </div>
                  </motion.div>
                )}
                </div>
                
              {/* Right Side - Points Display */}
                <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="text-center"
              >
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  className="bg-white/10 backdrop-blur-md rounded-3xl p-6 sm:p-8 md:p-10 shadow-2xl border border-white/20"
                >
                  <div className="flex items-baseline justify-center gap-3 mb-2">
                    <Star className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 fill-white" />
                    <span className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold">{totalPoints.toFixed(1)}</span>
                    <span className="text-2xl sm:text-3xl md:text-4xl opacity-80">pts</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-white/90">
                    <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="text-sm sm:text-base">{awardCount} awards earned</span>
                  </div>
                  {myRank && (
                    <div className="mt-4">
                      {getRankBadge(myRank)}
                    </div>
                  )}
                </motion.div>
                </motion.div>
              </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Code assignments */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card className="group relative overflow-hidden border-0 shadow-xl rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600">
          
          <CardHeader className="relative p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-indigo-600 dark:bg-indigo-700 shadow-lg"
                >
                  <Code className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                </motion.div>
                <div>
                  <CardTitle className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
                    Submit Assignment
                  </CardTitle>
                  <CardDescription className="text-sm sm:text-base mt-1 text-slate-600 dark:text-slate-300">
                    Submit classroom assignments for instructor review and earn points
                  </CardDescription>
                      </div>
                    </div>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setShowCodeSubmission(!showCodeSubmission)}
                className="shrink-0 border-2"
              >
                {showCodeSubmission ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Hide
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Show
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          
          <AnimatePresence>
            {showCodeSubmission && (
                        <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <CardContent className="relative p-6 sm:p-8 space-y-6">
                  {/* Instructions */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                  >
                    <Alert className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600">
                      <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <AlertDescription className="text-sm sm:text-base text-slate-700 dark:text-slate-200">
                        <div className="space-y-2">
                          <p className="font-semibold">How Code Assignments Work:</p>
                          <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>Select an assignment from the dropdown below</li>
                            <li>Write your code solution in the editor</li>
                            <li>If the assignment asks for a plot or figure, upload a screenshot below (optional otherwise)</li>
                            <li>Submit for instructor review</li>
                            <li><strong>Each submission is worth 2.5 points</strong> (default) - your instructor may adjust this</li>
                            <li>You can only submit <strong>once per assignment</strong></li>
                            <li><strong>Assignments have limited time</strong> - check the expiration time shown for each assignment</li>
                            <li>Your code will be reviewed and points will be awarded after approval</li>
                          </ul>
                      </div>
                      </AlertDescription>
                    </Alert>
                  </motion.div>

                  {/* Three Column Select Fields - Modernized */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                  >
                    {/* Column 1: Assignment Select (for new submissions) */}
                    <div className="space-y-3">
                      <label className="text-lg font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-indigo-600 dark:bg-indigo-700 text-white">
                          <FileCode className="h-5 w-5" />
                    </div>
                        Assignment <span className="text-red-500 font-bold">*</span>
                      </label>
                      <Select
                        value={selectedSubmissionId}
                        onValueChange={(value) => {
                          setSelectedSubmissionId(value);
                          setSelectedMissingId("");
                          setSelectedPendingId("");
                          clearCodeNotice();
                          markChannelSubmittable("code", Number.parseInt(value, 10));
                          const selected = availableSubmissions.find(s => s.id.toString() === value);
                          setDescription(selected?.title || "");
                        }}
                      >
                        <SelectTrigger className="w-full min-h-[80px] h-auto py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 text-lg font-semibold text-slate-700 dark:text-slate-200">
                          <SelectValue placeholder="Select an assignment..." className="text-base text-slate-500 dark:text-slate-400">
                            {selectedSubmissionId && (() => {
                              const selected = availableSubmissions.find(s => s.id.toString() === selectedSubmissionId);
                              return selected ? (
                                <div className="flex flex-col items-start justify-center w-full py-1">
                                  <span className="font-semibold text-slate-700 dark:text-slate-200">{selected.title}</span>
                                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Expires: {formatTimeRemaining(selected.expires_at)}
                                  </span>
                    </div>
                              ) : null;
                            })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-2 border-indigo-200 dark:border-indigo-700 dark:bg-slate-900 shadow-xl">
                          {availableSubmissions.length === 0 ? (
                            <SelectItem value="none" disabled className="text-slate-400">
                              No active assignments available
                            </SelectItem>
                          ) : (
                            availableSubmissions
                              .filter(submission => {
                                const isExpired = isAssignmentPastDue(submission);
                                const isAttempted = submission.attempted;
                                return !isExpired && !isAttempted;
                              })
                              .map((submission) => (
                                <SelectItem 
                                  key={submission.id} 
                                  value={submission.id.toString()}
                                  className="text-base font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 py-3 focus:bg-slate-100 dark:focus:bg-slate-700"
                                >
                                  <div className="flex flex-col items-start justify-center w-full">
                                    <span className="font-semibold text-slate-900 dark:text-slate-100">{submission.title}</span>
                                    <span className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                      Expires: {formatTimeRemaining(submission.expires_at)}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Column 2: Pending Submissions */}
                    <div className="space-y-3">
                      <label className="text-lg font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-amber-500 dark:bg-amber-600 text-white">
                          <FileCode className="h-5 w-5" />
                        </div>
                        Pending Submissions
                      </label>
                      <Select
                        value={selectedPendingId}
                        onValueChange={(value) => {
                          setSelectedPendingId(value);
                          setSelectedSubmissionId("");
                          setSelectedMissingId("");
                          const selected = pendingSubmissions.find(s => s.id.toString() === value);
                          setDescription(selected?.title || "");
                        }}
                      >
                        <SelectTrigger className="w-full min-h-[80px] h-auto py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-400 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 text-lg font-semibold text-slate-700 dark:text-slate-200">
                          <SelectValue placeholder="Awaiting review..." className="text-base text-slate-500 dark:text-slate-400">
                            {selectedPendingId && (() => {
                              const selected = pendingSubmissions.find(s => s.id.toString() === selectedPendingId);
                              return selected ? (
                                <div className="flex flex-col items-start justify-center w-full py-1">
                                  <span className="font-semibold text-slate-700 dark:text-slate-200">{selected.title}</span>
                                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Expires: {formatTimeRemaining(selected.expires_at)}
                                  </span>
                                </div>
                              ) : null;
                            })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-2 border-amber-200 dark:border-amber-700 dark:bg-slate-900 shadow-xl">
                          {pendingSubmissions.length === 0 ? (
                            <SelectItem value="none" disabled className="text-slate-400">
                              No pending submissions
                            </SelectItem>
                          ) : (
                            pendingSubmissions.map((submission) => (
                                <SelectItem 
                                  key={submission.id} 
                                  value={submission.id.toString()}
                                  className="text-base font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 py-3 focus:bg-slate-100 dark:focus:bg-slate-700"
                                >
                                  <div className="flex flex-col items-start justify-center w-full">
                                    <span className="font-semibold text-slate-900 dark:text-slate-100">{submission.title}</span>
                                    <span className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                      {isAssignmentPastDue(submission)
                                        ? "Closed — awaiting review"
                                        : formatTimeRemaining(submission.expires_at)}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Column 3: Missing Submissions */}
                    <div className="space-y-3">
                      <label className="text-lg font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-red-500 dark:bg-red-600 text-white">
                          <FileCode className="h-5 w-5" />
                        </div>
                        Missing Submissions
                      </label>
                      <Select
                        value={selectedMissingId}
                        onValueChange={(value) => {
                          setSelectedMissingId(value);
                          setSelectedSubmissionId("");
                          setSelectedPendingId("");
                          clearCodeNotice();
                          const selected = missingSubmissions.find(s => s.id.toString() === value);
                          setDescription(selected?.title || "");
                        }}
                      >
                        <SelectTrigger className="w-full min-h-[80px] h-auto py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-red-500 dark:focus:border-red-400 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 text-lg font-semibold text-slate-700 dark:text-slate-200">
                          <SelectValue placeholder="Not submitted..." className="text-base text-slate-500 dark:text-slate-400">
                            {selectedMissingId && (() => {
                              const selected = missingSubmissions.find(s => s.id.toString() === selectedMissingId);
                              return selected ? (
                                <div className="flex flex-col items-start justify-center w-full py-1">
                                  <span className="font-semibold text-slate-700 dark:text-slate-200">{selected.title}</span>
                                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Expires: {formatTimeRemaining(selected.expires_at)}
                                  </span>
                                </div>
                              ) : null;
                            })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-2 border-red-200 dark:border-red-700 dark:bg-slate-900 shadow-xl">
                          {missingSubmissions.length === 0 ? (
                            <SelectItem value="none" disabled className="text-slate-400">
                              All assignments submitted
                            </SelectItem>
                          ) : (
                            missingSubmissions.map((submission) => (
                                <SelectItem 
                                  key={submission.id} 
                                  value={submission.id.toString()}
                                  className="text-base font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 py-3 focus:bg-slate-100 dark:focus:bg-slate-700"
                                >
                                  <div className="flex flex-col items-start justify-center w-full">
                                    <span className="font-semibold text-slate-900 dark:text-slate-100">{submission.title}</span>
                                    <span className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                      {formatMissingAssignmentLabel(submission)}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))
                          )}
                        </SelectContent>
                      </Select>
                  </div>
                </motion.div>

                  <ClassroomAssignmentAccessNotice notice={effectiveCodeNotice} />
                  
                  {(selectedSubmissionId || selectedMissingId || selectedPendingId) && (() => {
                    const selectedSubmission = availableSubmissions.find(s => s.id.toString() === (selectedSubmissionId || selectedMissingId)) ||
                                             pendingSubmissions.find(s => s.id.toString() === selectedPendingId) ||
                                             missingSubmissions.find(s => s.id.toString() === selectedMissingId);
                    const isPendingSelection =
                      Boolean(selectedPendingId) ||
                      pendingSubmissions.some((s) => s.id.toString() === selectedMissingId);
                    const pendingPoint = selectedSubmission?.classroomPoint;
                    return (
                      <>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                        >
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            <span className="font-semibold">Selected:</span> {description}
                            {isPendingSelection ? (
                              <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
                                (Pending Review)
                              </span>
                            ) : null}
                            {selectedMissingId && !pendingSubmissions.some((s) => s.id.toString() === selectedMissingId) ? (
                              <span className="ml-2 text-red-600 dark:text-red-400 font-medium">
                                (Not Submitted)
                              </span>
                            ) : null}
                          </p>
                          {isPendingSelection ? (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <ClassroomProvisionalScoreBadge />
                              {pendingPoint?.points != null ? (
                                <ClassroomPointBoosterBadge
                                  points={resolveClassroomDisplayPoints(
                                    pendingPoint.points,
                                    pendingPoint.pointBooster,
                                  )}
                                  pointBooster={pendingPoint.pointBooster ?? 1}
                                />
                              ) : null}
                            </div>
                          ) : null}
                        </motion.div>
                        
                        {selectedSubmission?.description && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                            className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600"
                          >
                            <div className="flex items-start gap-3">
                              <FileCode className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                              <div className="flex-1">
                                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Assignment Description:</h4>
                                <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed [&_.prose]:text-sm">
                                  <QuestionTextRenderer text={selectedSubmission.description} />
                                </div>
          </div>
                            </div>
                          </motion.div>
                        )}
                      </>
                    );
                  })()}

                  {/* Plot upload — same idea as code_write_plot on quizzes; visible as soon as this panel is open */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18 }}
                    className="space-y-3 rounded-xl border-2 border-indigo-200/80 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 sm:p-5"
                  >
                    {(() => {
                      const sel =
                        selectedSubmissionId || selectedMissingId || selectedPendingId
                          ? availableSubmissions.find((s) => s.id.toString() === (selectedSubmissionId || selectedMissingId)) ||
                            pendingSubmissions.find((s) => s.id.toString() === selectedPendingId) ||
                            missingSubmissions.find((s) => s.id.toString() === selectedMissingId)
                          : null
                      const suggestPlot = sel ? assignmentSuggestsPlot(sel.title || "", sel.description || "") : false
                      return (
                        <>
                          {!sel && (
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              <strong className="text-slate-800 dark:text-slate-200">Plot with your code:</strong> Select an
                              assignment above, then attach a screenshot here when the task asks for a figure or graph
                              (same workflow as code + plot questions on quizzes).
                            </p>
                          )}
                          {suggestPlot && !plotImage && (
                            <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/20">
                              <AlertTriangle className="h-4 w-4 text-amber-600" />
                              <AlertDescription className="text-sm text-amber-900 dark:text-amber-100">
                                This assignment looks like it expects a <strong>plot or figure</strong>. Upload a
                                screenshot of your figure so your instructor can review it with your code.
                              </AlertDescription>
                            </Alert>
                          )}
                        </>
                      )
                    })()}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        Upload plot or figure (optional unless the assignment requires it)
                      </label>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        PNG or JPEG, max 5MB. Stored with your code submission for instructor review.
                      </p>
                      <PlotUpload
                        variant="classroom"
                        uploadedImage={plotImage}
                        onUpload={(_file, base64) => setPlotImage(base64)}
                        onRemove={() => setPlotImage(null)}
                        disabled={isSubmitting}
                      />
                    </div>
                  </motion.div>

                  {/* Code Editor */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-2"
                  >
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      Your Solution Code
                    </label>
                    <div className="border-2 border-slate-300 dark:border-slate-600 rounded-xl overflow-hidden shadow-lg">
                      <MonacoEditor
                        height="450px"
                        language="cpp"
                        value={code}
                        onChange={(value) => setCode(value || "")}
                        theme="vs-dark"
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                          lineNumbers: "on",
                          wordWrap: "on",
                          bracketPairColorization: { enabled: true },
                          cursorBlinking: "smooth",
                          padding: { top: 16, bottom: 16 },
                        }}
                      />
          </div>
                  </motion.div>

                  {/* Submit Button */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Button
                      onClick={handleCodeSubmit}
                      disabled={isSubmitting || !code.trim() || code.trim().length < 10}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white font-bold py-8 sm:py-10 text-xl sm:text-2xl"
                      size="lg"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Submitting Code...
                        </>
                      ) : submissionSuccess ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 mr-2" />
                          Code Submitted Successfully!
                        </>
                      ) : (
                        <>
                          <Send className="h-5 w-5 mr-2" />
                          Submit Assignment
                        </>
                      )}
                    </Button>
                  </motion.div>

                  {/* Info Alert */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <Alert className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600">
                      <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <AlertDescription className="text-sm text-slate-700 dark:text-slate-200">
                        Your code will be reviewed by your instructor. Points will be awarded after grading and approval.
                      </AlertDescription>
                    </Alert>
                  </motion.div>
                </CardContent>
                </motion.div>
              )}
          </AnimatePresence>
        </Card>
      </motion.div>

      {/* Stats Grid - Enhanced Cards */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
      >
        {/* Total Points Card */}
        <motion.div
          whileHover={{ y: -8, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Card className="relative overflow-hidden border-0 shadow-xl rounded-2xl bg-indigo-600 dark:bg-indigo-700 text-white h-full">
            <CardContent className="relative p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-white/90 text-sm sm:text-base font-medium">Total Points</p>
                  <p className="text-4xl sm:text-5xl font-bold">{totalPoints.toFixed(1)}</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/20 backdrop-blur-sm">
                  <Trophy className="h-8 w-8 sm:h-10 sm:w-10" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Awards Card */}
        <motion.div
          whileHover={{ y: -8, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Card className="relative overflow-hidden border-0 shadow-xl rounded-2xl bg-teal-600 dark:bg-teal-700 text-white h-full">
            <CardContent className="relative p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-white/90 text-sm sm:text-base font-medium">Awards</p>
                  <p className="text-4xl sm:text-5xl font-bold">{awardCount}</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/20 backdrop-blur-sm">
                  <Gift className="h-8 w-8 sm:h-10 sm:w-10" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Rank Card */}
        <motion.div
          whileHover={{ y: -8, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="sm:col-span-2 lg:col-span-1"
        >
          <Card className="relative overflow-hidden border-0 shadow-xl rounded-2xl bg-emerald-600 dark:bg-emerald-700 text-white h-full">
            <CardContent className="relative p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-white/90 text-sm sm:text-base font-medium">Class Rank</p>
                  <p className="text-4xl sm:text-5xl font-bold">
                    {myRank ? `#${myRank}` : 'N/A'}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-white/20 backdrop-blur-sm">
                  <TrendingUp className="h-8 w-8 sm:h-10 sm:w-10" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Points History - Beautiful Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card className="border-0 shadow-xl rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader className="p-6 sm:p-8 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-600 dark:bg-indigo-700">
                  <Award className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">Points History</CardTitle>
                  <CardDescription className="text-sm sm:text-base mt-1 text-slate-600 dark:text-slate-300">
                    Recent points you've earned (sorted by most recent)
          </CardDescription>
                </div>
              </div>
              {session && (
                <Badge variant="outline" className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600">
                  Section {session}
                </Badge>
              )}
            </div>
        </CardHeader>
          <CardContent className="p-6 sm:p-8">
          {points.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <div className="inline-flex p-4 rounded-full bg-slate-200 dark:bg-slate-700 mb-4">
                  <Gift className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-slate-600 dark:text-slate-400 font-medium">
                  No points awarded yet. Keep participating in class to earn points!
                </p>
              </motion.div>
            ) : (
              <>
              <div className="space-y-4">
              {paginatedPoints.map((point, idx) => {
                const categoryInfo = CATEGORY_LABELS[point.category] || CATEGORY_LABELS.other;
                return (
                  <ClassroomPointHistoryCard
                    key={point.id}
                    point={point}
                    categoryInfo={categoryInfo}
                    animationDelay={idx * 0.05}
                  />
                );
              })}
            </div>
            
            {/* Pagination Controls */}
            {points.length > pointsPerPage && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Showing {startIndex + 1}-{Math.min(endIndex, points.length)} of {points.length} points
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPointsHistoryPage(prev => Math.max(1, prev - 1))}
                    disabled={pointsHistoryPage === 1}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (pointsHistoryPage <= 3) {
                        pageNum = i + 1;
                      } else if (pointsHistoryPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = pointsHistoryPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={pointsHistoryPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPointsHistoryPage(pageNum)}
                          className="min-w-[2.5rem]"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPointsHistoryPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={pointsHistoryPage === totalPages}
                    className="gap-1"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
            </div>
            )}
          </>
          )}
        </CardContent>
      </Card>
      </motion.div>

      {/* Leaderboard - Enhanced Design */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card className="border-0 shadow-xl rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader className="p-6 sm:p-8 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500 dark:bg-amber-600">
                  <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {session ? `Section ${session} Leaderboard` : "Class Leaderboard"}
          </CardTitle>
                  <CardDescription className="text-sm sm:text-base mt-1 text-slate-600 dark:text-slate-300">
                    {blurLeaderboardPeers
                      ? session
                        ? `Your rank in section ${session} — other students hidden for privacy`
                        : "Your rank — other students hidden for privacy"
                      : session
                        ? `Section ${session} rankings — names and points visible to the class`
                        : "Class rankings — names and points visible to the class"}
          </CardDescription>
                </div>
              </div>
              {session && (
                <Badge variant="outline" className="text-xs sm:text-sm bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300 dark:border-yellow-700 text-slate-700 dark:text-slate-200">
                  Section {session}
                </Badge>
              )}
            </div>
        </CardHeader>
          <CardContent className="p-6 sm:p-8">
            <div className="space-y-3">
            {leaderboard.slice(0, 10).map((entry, idx) => {
              const isMe = entry.is_current_user || entry.student_id === studentId;
                const isTopThree = entry.rank <= 3;
              return (
                <motion.div
                  key={`rank-${entry.rank}-${idx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                    whileHover={{ x: 4 }}
                  >
                    <Card className={`border-0 shadow-md hover:shadow-xl transition-all duration-300 rounded-xl overflow-hidden ${
                      isMe
                        ? 'bg-indigo-100 dark:bg-indigo-900/40 ring-2 ring-indigo-400 dark:ring-indigo-500'
                        : 'bg-slate-50 dark:bg-slate-700/50'
                    }`}>
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            {/* Rank Badge */}
                            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center font-bold text-lg sm:text-xl shrink-0 shadow-lg ${
                              entry.rank === 1
                                ? 'bg-amber-500 dark:bg-amber-600 text-white'
                                : entry.rank === 2
                                ? 'bg-slate-500 dark:bg-slate-600 text-white'
                                : entry.rank === 3
                                ? 'bg-amber-500 dark:bg-amber-600 text-white'
                                : 'bg-indigo-500 dark:bg-indigo-600 text-white'
                            }`}>
                              {isTopThree && entry.rank === 1 && <Crown className="h-6 w-6 sm:h-7 sm:w-7" />}
                              {isTopThree && entry.rank !== 1 && <Medal className="h-6 w-6 sm:h-7 sm:w-7" />}
                              {!isTopThree && entry.rank}
                    </div>
                            
                    <div className="flex-1 min-w-0">
                              <p className={`font-bold text-base sm:text-lg break-words ${
                                isMe
                                  ? 'text-purple-900 dark:text-purple-200'
                                  : 'text-slate-800 dark:text-slate-200'
                              }`}>
                                {blurLeaderboardPeers && !isMe
                                  ? "Student"
                                  : entry.full_name || (isMe ? "You" : "Student")}{" "}
                                {isMe && <span className="text-sm text-purple-600 dark:text-purple-400">(You)</span>}
                              </p>
                              <p className={`text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5 ${blurLeaderboardPeers && !isMe ? "blur-[6px] select-none" : ""}`}>
                                {blurLeaderboardPeers && !isMe
                                  ? "Details hidden"
                                  : `Section ${entry.session} • ${entry.award_count} awards`}
                      </p>
                    </div>
                  </div>
                          
                          <div className="text-right shrink-0">
                            {isMe || !blurLeaderboardPeers ? (
                            <div className="inline-flex items-center gap-1.5 bg-white/60 dark:bg-slate-800/60 px-4 py-2 rounded-xl shadow-md">
                              <Star className="h-5 w-5 sm:h-6 sm:w-6 fill-yellow-500 text-yellow-500" />
                              <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {Number(entry.total_points).toFixed(1)}
                              </span>
                            </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 bg-slate-200/80 dark:bg-slate-700/80 px-4 py-2 rounded-xl blur-[6px] select-none">
                                <span className="text-xl sm:text-2xl font-bold text-slate-400">•••</span>
                              </div>
                            )}
                  </div>
                  </div>
                      </CardContent>
                    </Card>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      </motion.div>

      {/* Template Warning Modal */}
      <AnimatePresence>
        {showTemplateModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
              onClick={() => setShowTemplateModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
            >
              <div 
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 border-2 border-amber-200 dark:border-amber-800 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-500 dark:bg-amber-600 flex items-center justify-center shadow-lg"
                  >
                    <AlertTriangle className="h-8 w-8 sm:h-12 sm:w-12 text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
                      ⚠️ Template Code Detected
                    </h3>
                    <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 mb-2">
                      You cannot submit the default template code.
                    </p>
                    <p className="text-sm sm:text-base text-slate-500 dark:text-slate-500">
                      Please <strong>edit and write your own code solution</strong> in the editor. Make sure to implement the required functionality for this assignment before submitting.
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowTemplateModal(false)}
                    className="w-full bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white"
                  >
                    I Understand
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Point Booster Success Modal */}
      <PointBoosterModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          setTimeout(() => {
            fetchData(false);
            fetchSubmissions();
            setPointsHistoryPage(1);
          }, 300);
        }}
        pointBooster={successModalData.pointBooster}
        pointsAwarded={successModalData.pointsAwarded}
        boosterLabel={successModalData.boosterLabel}
      />
    </div>
  );
}
