"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, BarChart3, Target, Calculator, Sparkles, ArrowLeft, RefreshCw } from "lucide-react";
import { StudentHeader } from "@/components/student-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { GradesOverview } from "@/components/grades-overview";
import { GradeSimulator } from "@/components/grade-simulator";
import { EngagementCreditsTracker } from "@/components/engagement-credits-tracker";
import { GradeBreakdown } from "@/components/grade-breakdown";
import { AttendanceLeaderboard } from "@/components/attendance-leaderboard";

type MenuTab = "overview" | "breakdown" | "simulator" | "engagement";

export default function StudentGradesPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState<number | null>(null);
  const [studentSession, setStudentSession] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState<MenuTab>("overview");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const studentSessionData = localStorage.getItem("studentSession");
    if (!studentSessionData) {
      router.push("/student/login");
      return;
    }

    try {
      const data = JSON.parse(studentSessionData);
      setStudentId(data.databaseId);
      setStudentSession(data.section || "");
    } catch (error) {
      console.error("Error parsing student session:", error);
      router.push("/student/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600 dark:border-indigo-400 mx-auto"></div>
          <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">
            <span className="sm:hidden">Loading grades...</span>
            <span className="hidden sm:inline">Loading your grades...</span>
          </p>
        </div>
      </div>
    );
  }

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    // Force a page reload to recalculate grades
    window.location.reload();
  };

  const menuItems = [
    {
      id: "overview" as MenuTab,
      label: "Overview",
      icon: BarChart3,
      description: "View your overall performance",
    },
    {
      id: "breakdown" as MenuTab,
      label: "Breakdown",
      icon: Target,
      description: "Detailed grade breakdown",
    },
    {
      id: "simulator" as MenuTab,
      label: "Grade Simulator",
      icon: Calculator,
      description: "Simulate future grades",
    },
    {
      id: "engagement" as MenuTab,
      label: "Engagement",
      icon: Sparkles,
      description: "Track engagement credits",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 overflow-x-hidden">
      <StudentHeader />

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-10 max-w-7xl overflow-x-hidden">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 sm:mb-8"
        >
          <div className="flex items-center justify-between mb-4 gap-3 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
              <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 dark:from-indigo-600 dark:via-purple-700 dark:to-pink-700 shadow-lg shrink-0">
                <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent break-words">
                  <span className="sm:hidden">Grades</span>
                  <span className="hidden sm:inline">My Grades</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5 sm:mt-1 break-words">
                  <span className="sm:hidden">Track performance</span>
                  <span className="hidden sm:inline md:hidden">Track your performance</span>
                  <span className="hidden md:inline">Track your performance across all assessments and activities</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 w-full sm:w-auto justify-end sm:justify-start">
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                className="gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 text-xs sm:text-sm h-8 sm:h-9 md:h-10 px-2 sm:px-3 md:px-4"
              >
                <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button
                onClick={() => router.push("/student/dashboard")}
                variant="outline"
                size="sm"
                className="gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 text-xs sm:text-sm h-8 sm:h-9 md:h-10 px-2 sm:px-3 md:px-4"
                title="Back to Dashboard"
              >
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="sm:hidden">Back</span>
                <span className="hidden sm:inline">Back to Dashboard</span>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Main Layout with Side Menu */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 sm:gap-6">
          {/* Side Menu */}
          <Card className="h-fit lg:sticky lg:top-4 border-slate-200/60 dark:border-slate-700/60 shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl sm:rounded-2xl order-2 lg:order-1">
            <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-200 break-words">
                <span className="sm:hidden">Menu</span>
                <span className="hidden sm:inline">Grades Menu</span>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">
                <span className="sm:hidden">Select module</span>
                <span className="hidden sm:inline">Select a module</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5 sm:space-y-2 p-4 sm:p-6 pt-0">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeMenu === item.id;
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? "default" : "ghost"}
                    className={`w-full justify-start gap-2 h-10 sm:h-12 rounded-lg sm:rounded-xl text-xs sm:text-sm ${
                      isActive
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-700 dark:to-purple-700 text-white shadow-lg"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
                    }`}
                    onClick={() => setActiveMenu(item.id)}
                  >
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          {/* Main Content Area */}
          <div className="space-y-4 sm:space-y-6 order-1 lg:order-2" key={refreshKey}>
            {activeMenu === "overview" && (
              <>
                <GradesOverview studentId={studentId!} session={studentSession} />
                <AttendanceLeaderboard session={studentSession} />
              </>
            )}
            {activeMenu === "breakdown" && (
              <GradeBreakdown studentId={studentId!} session={studentSession} />
            )}
            {activeMenu === "simulator" && (
              <GradeSimulator studentId={studentId!} session={studentSession} />
            )}
            {activeMenu === "engagement" && (
              <EngagementCreditsTracker studentId={studentId!} session={studentSession} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}


