"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentHeader } from "@/components/student-header";
import { StudentClassroomPoints } from "@/components/student-classroom-points";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

export default function StudentClassroomPointsPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentDatabaseId, setStudentDatabaseId] = useState<number | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentSection, setStudentSection] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const dbId = sessionStorage.getItem("studentDatabaseId");
    const id = sessionStorage.getItem("studentId");
    const name = sessionStorage.getItem("studentName");
    const section = sessionStorage.getItem("studentSection");

    console.log("[Student Page] Session data:", { dbId, id, name, section });

    if (!id || !dbId) {
      router.push("/student/login");
      return;
    }

    setStudentDatabaseId(Number.parseInt(dbId));
    setStudentId(id);
    setStudentName(name || "");
    setStudentSection(section || "");
  }, [router]);

  const handleRefresh = () => {
    console.log("[Student Page] Manual refresh triggered");
    setRefreshKey(prev => prev + 1);
  };

  if (!studentId || !studentDatabaseId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <StudentHeader />
      
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-10 max-w-7xl">
        {/* Page Header - Matching CourseCollab Style */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between flex-wrap gap-3 sm:gap-4 mb-6 sm:mb-8 md:mb-10 relative"
        >
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
            <div className="p-2 sm:p-2.5 md:p-3 rounded-xl sm:rounded-2xl bg-indigo-600 dark:bg-indigo-700 shadow-lg shrink-0">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 break-words">
                <span className="sm:hidden">Points</span>
                <span className="hidden sm:inline md:hidden">Classroom Points</span>
                <span className="hidden md:inline">Classroom Points</span>
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mt-0.5 sm:mt-1 text-xs sm:text-sm break-words">
                {studentName ? (
                  <>
                    <span className="sm:hidden">Achievements • <span className="font-semibold text-slate-800 dark:text-slate-200">{studentName}</span> • S{studentSection}</span>
                    <span className="hidden sm:inline md:hidden">Track achievements • <span className="font-semibold text-slate-800 dark:text-slate-200">{studentName}</span> • S{studentSection}</span>
                    <span className="hidden md:inline">Track your achievements, <span className="font-semibold text-slate-800 dark:text-slate-200">{studentName}</span> • Section {studentSection}</span>
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">View points & rank</span>
                    <span className="hidden sm:inline">View your earned classroom points and class rank</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0 w-full sm:w-auto justify-end sm:justify-start">
            <Button 
              onClick={handleRefresh}
              variant="outline" 
              size="sm"
              className="gap-1.5 sm:gap-2 rounded-lg sm:rounded-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-100 text-xs sm:text-sm h-8 sm:h-9 md:h-10 px-2 sm:px-3 md:px-4"
            >
              <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button 
              onClick={() => router.push("/student/dashboard")} 
              variant="outline" 
              size="sm"
              className="gap-1.5 sm:gap-2 rounded-lg sm:rounded-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-100 text-xs sm:text-sm h-8 sm:h-9 md:h-10 px-2 sm:px-3 md:px-4"
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="sm:hidden">Back</span>
              <span className="hidden sm:inline">Back to Dashboard</span>
            </Button>
          </div>
        </motion.div>

        <StudentClassroomPoints key={refreshKey} studentId={studentDatabaseId} studentSession={studentSection} />
      </main>
    </div>
  );
}

