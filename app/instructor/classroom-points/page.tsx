"use client";

import { InstructorClassroomPoints } from "@/components/instructor-classroom-points";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useRef, useState } from "react";

export default function InstructorClassroomPointsPage() {
  const router = useRouter();
  const refreshRef = useRef<() => void>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (refreshRef.current) {
      setIsRefreshing(true);
      try {
        await refreshRef.current();
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <main className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Page Header - Matching CourseCollab Style */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between flex-wrap gap-4 mb-10"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-indigo-600 dark:bg-indigo-700 shadow-lg">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Classroom Points
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
                Award and manage student classroom points
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              variant="outline" 
              className="gap-2 rounded-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-100"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /> 
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button 
              onClick={() => router.push("/instructor/dashboard")} 
              variant="outline" 
              className="gap-2 rounded-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-100"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Button>
          </div>
        </motion.div>

        <InstructorClassroomPoints onRefreshRef={refreshRef} />
      </main>
    </div>
  );
}

