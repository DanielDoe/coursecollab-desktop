"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getStudentData } from "@/lib/auth";
import { AssessmentTakerShell } from "@/components/student/assessment-taker-shell";
import { QuizTaker } from "@/components/quiz-taker";

interface Homework {
  id: number;
  title: string;
  due_date?: string;
  available_until?: string;
  time_limit: number;
  total_questions: number;
  attempts_allowed?: number | null;
  attempts_used: number;
  can_retake?: boolean;
  can_continue?: boolean;
  retake_enabled?: boolean;
  is_active: boolean;
  rollover_active?: boolean;
}

/**
 * Single Start Quiz flow: no assignment-details screen.
 * Renders QuizTaker directly (one instructions screen + quiz), same as quiz page.
 */
export default function StudentHomeworkDetailPage() {
  const params = useParams();
  const homeworkId = typeof params?.id === "string" ? params.id : "";
  return <HomeworkDetailContent homeworkId={homeworkId} />;
}

function HomeworkDetailContent({ homeworkId }: { homeworkId: string }) {
  const router = useRouter();
  const [homework, setHomework] = useState<Homework | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    const data = getStudentData();
    if (!data) {
      router.push("/student/login");
      return;
    }
    fetchHomework(Number.parseInt(homeworkId, 10), data.section, data.databaseId);
  }, [homeworkId, router]);

  const fetchHomework = async (id: number, section: string, databaseId?: string) => {
    try {
      setLoading(true);
      setAccessError(null);
      const studentDatabaseId = databaseId ?? sessionStorage.getItem("studentDatabaseId");
      const studentId = sessionStorage.getItem("studentId");
      if (!studentId && !studentDatabaseId) {
        router.push("/student/login");
        return;
      }
      const studentParam = studentDatabaseId
        ? `studentDatabaseId=${studentDatabaseId}`
        : `studentId=${studentId}`;

      const response = await fetch(
        `/api/student/homework/${id}?session=${section}&${studentParam}`
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 403 && (data.access_restricted || data.error)) {
          throw new Error(data.error || "You must be in class to take this assessment. You cannot take it this way.");
        }
        throw new Error(data.error || "Failed to fetch homework");
      }
      if (!data?.success || !data?.homework) {
        throw new Error(data.error || "Failed to fetch homework");
      }
      setHomework(data.homework);

      const h = data.homework as Homework;
      // API sets is_active true when rollover/override extends the deadline (including after first submit).
      const pastDue = h.available_until ? new Date(h.available_until) <= new Date() : false;
      const isOverdueBlocked = pastDue && !h.is_active;
      // can_continue = resuming saved attempt (not a retake) — allow access even when no retakes left
      const noAttemptsLeft = !h.can_continue && !h.can_retake && h.attempts_used > 0;
      if (isOverdueBlocked) {
        setAccessError("This homework assignment is overdue and cannot be started.");
      } else if (noAttemptsLeft) {
        setAccessError(
          h.retake_enabled
            ? "You have used all available attempts for this homework."
            : "Retakes are not enabled for this homework assignment."
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch homework";
      if (message.includes("not found") || message.includes("404")) {
        router.push("/student/dashboard-v2/homework");
        return;
      }
      setAccessError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToHomework = () => {
    router.push("/student/dashboard-v2/homework");
  };

  if (loading) {
    return (
      <AssessmentTakerShell>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 py-8 sm:py-12">
          <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-purple-600/30 dark:border-purple-500/30 border-t-purple-600 dark:border-t-purple-500 rounded-full animate-spin" />
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base md:text-lg font-medium">
            Loading homework…
          </p>
        </div>
      </AssessmentTakerShell>
    );
  }

  if (!homework) {
    return (
      <AssessmentTakerShell>
        <div className="max-w-4xl mx-auto py-4 sm:py-6">
          <Card className="border-2 border-red-200 dark:border-red-800 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm shadow-lg rounded-xl sm:rounded-2xl">
            <CardContent className="p-4 sm:p-6 text-center">
              <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-red-500 dark:text-red-400 mx-auto mb-3 sm:mb-4" />
              <h2 className="text-lg sm:text-xl font-bold text-red-600 dark:text-red-400 mb-2">
                Homework Not Found
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground dark:text-slate-400 mb-4 break-words">
                The homework assignment doesn&apos;t exist or you don&apos;t have access to it.
              </p>
              <Button
                onClick={handleBackToHomework}
                variant="outline"
                className="rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 dark:border-slate-700 dark:text-slate-300"
              >
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                Back to Homework
              </Button>
            </CardContent>
          </Card>
        </div>
      </AssessmentTakerShell>
    );
  }

  if (accessError) {
    return (
      <AssessmentTakerShell>
        <div className="max-w-4xl mx-auto py-4 sm:py-6">
          <Card className="border-2 border-amber-200 dark:border-amber-800 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm shadow-lg rounded-xl sm:rounded-2xl">
            <CardContent className="p-4 sm:p-6 text-center">
              <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10 text-amber-500 dark:text-amber-400 mx-auto mb-3 sm:mb-4" />
              <h2 className="text-lg sm:text-xl font-bold text-amber-700 dark:text-amber-300 mb-2">
                Cannot Start Assignment
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground dark:text-slate-400 mb-4">
                {accessError}
              </p>
              <Button
                onClick={handleBackToHomework}
                variant="outline"
                className="rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10"
              >
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                Back to Homework
              </Button>
            </CardContent>
          </Card>
        </div>
      </AssessmentTakerShell>
    );
  }

  return (
    <AssessmentTakerShell>
      <QuizTaker quizId={homeworkId} assessmentType="homework" />
    </AssessmentTakerShell>
  );
}
