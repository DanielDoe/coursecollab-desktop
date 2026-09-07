"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import { getStudentData, logoutStudent } from "@/lib/auth";
import { StudentHeader } from "@/components/student-header";
import { StudentAttendanceContent } from "@/components/attendance/student-attendance-content";

export default function StudentAttendancePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const student = getStudentData();
    if (!student) {
      router.push("/student/login");
      return;
    }
    setMounted(true);
  }, [router]);

  if (!mounted) {
    return null;
  }

  const handleLogout = () => {
    logoutStudent();
  };

  return (
    <>
      <StudentHeader onLogout={handleLogout} />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-950 dark:via-blue-950 dark:to-purple-950 px-4 py-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg sm:shadow-xl flex-shrink-0">
                <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  Attendance
                </h1>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
                  Track your attendance and earn rewards
                </p>
              </div>
            </div>
          </motion.div>
          <StudentAttendanceContent embedInDashboard={false} />
        </div>
      </div>
    </>
  );
}

