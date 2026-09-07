"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Clock, Users, Zap, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { logoutStudent, getStudentData, studentApiFetch } from "@/lib/auth";
import { StudentHeader } from "@/components/student-header";
import { QuizResults } from "@/components/quiz-results";
import { motion } from "framer-motion";

interface Homework {
  id: number;
  title: string;
  description: string;
  due_date: string;
  time_limit: number;
  total_questions: number;
  status: string;
  attempts_allowed: number | null;
  attempts_used: number;
  attempts_remaining?: number | null;
  can_retake?: boolean;
  is_active: boolean;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Client page: cannot use async default export — unwrap `params` with `use()` (Next.js 15). */
export default function StudentHomeworkResultsPage({ params }: PageProps) {
  const { id: homeworkId } = use(params);
  return <HomeworkResultsContent homeworkId={homeworkId} />;
}

function HomeworkResultsContent({ homeworkId }: { homeworkId: string }) {
  const router = useRouter();
  const [studentData, setStudentData] = useState<any>(null);
  const [homework, setHomework] = useState<Homework | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const data = getStudentData();
    if (!data) {
      router.push("/student/login");
      return;
    }
    setStudentData(data);
    // Use databaseId for quiz_attempts lookup; data.id = external student_id for homework API
    const studentDbId = data.databaseId ?? data.id;
    fetchHomeworkAndAttempt(Number.parseInt(homeworkId), studentDbId, data.section, data.id);
  }, [homeworkId, router]);

  const fetchHomeworkAndAttempt = async (id: number, studentDatabaseId: string, section: string, studentExternalId: string) => {
    try {
      setLoading(true);
      
      // Fetch homework details (studentExternalId = external student_id for homework API)
      const homeworkResponse = await studentApiFetch(`/api/student/homework/${id}?session=${section}&studentId=${studentExternalId}`);
      if (!homeworkResponse.ok) throw new Error("Failed to fetch homework");
      
      const homeworkData = await homeworkResponse.json();
      setHomework(homeworkData.homework);
      
      // Fetch latest attempt for this homework (studentDatabaseId = students.id for quiz_attempts)
      const attemptResponse = await studentApiFetch(`/api/student/latest-attempt?quizId=${id}&studentId=${studentDatabaseId}`);
      if (attemptResponse.ok) {
        const attemptData = await attemptResponse.json();
        if (attemptData.attemptId) {
          setAttemptId(attemptData.attemptId.toString());
        }
      }
    } catch (error) {
      router.push("/student/homework");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logoutStudent();
  };

  const handleBackToHomework = () => {
    router.push("/student/homework");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <StudentHeader onLogout={handleLogout} />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 border-2 border-purple-600/30 border-t-purple-600 rounded-full animate-spin"></div>
              <p className="text-slate-600 dark:text-slate-400 text-lg font-medium">Loading homework results...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!homework) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <StudentHeader onLogout={handleLogout} />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Card className="border-2 border-red-200 dark:border-red-800 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm shadow-lg">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
                Homework Not Found
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                The homework assignment you're looking for doesn't exist or you don't have access to it.
              </p>
              <Button onClick={handleBackToHomework} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Homework Hub
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <StudentHeader onLogout={handleLogout} />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg">
                <BookOpen className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  {homework.title} - Results
                </h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 mt-1">
                  Homework Assignment Results
                </p>
              </div>
            </div>
            <Button
              onClick={handleBackToHomework}
              variant="outline"
              className="rounded-xl border-2 hover:border-purple-500 hover:text-purple-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Homework Hub
            </Button>
          </div>
        </motion.div>

        {/* Homework Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <Card className="border-2 border-purple-200 dark:border-purple-800 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-slate-900 dark:text-slate-100">
                <BookOpen className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                Assignment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">Time Limit</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{homework.time_limit} minutes</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">Questions</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{homework.total_questions} questions</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">Attempts</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {homework.attempts_used}/{homework.attempts_allowed ?? "∞"} used
                      {homework.attempts_remaining != null && homework.attempts_remaining > 0 && (
                        <span className="ml-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                          · {homework.attempts_remaining} retake{homework.attempts_remaining !== 1 ? "s" : ""} left
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">Due Date</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{new Date(homework.due_date).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
              
              {homework.description && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <p className="font-semibold mb-2 text-slate-900 dark:text-slate-100">Description</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{homework.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quiz Results Component */}
        {attemptId ? (
          <QuizResults
            attemptId={attemptId}
            assessmentType="homework"
            userType="student"
            preferDashboardV2
          />
        ) : (
          <Card className="border-2 border-yellow-200 dark:border-yellow-800 bg-white dark:bg-slate-800">
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 dark:text-yellow-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-slate-100">No Attempts Found</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                You haven't completed this homework yet.
              </p>
              <Button onClick={() => router.push(`/student/homework/${homeworkId}`)}>
                Start Homework
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

