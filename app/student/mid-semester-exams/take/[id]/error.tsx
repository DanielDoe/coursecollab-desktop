"use client"

import { useEffect } from "react"
import { reportClientError } from "@/lib/system-log-client"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export default function MidSemesterError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportClientError({
      severity: "error",
      category: "frontend",
      title: "Mid-semester exam page crash",
      errorMessage: error.message,
      stackTrace: error.stack,
      moduleName: "Exam Module",
      metadata: { digest: error.digest },
    })
  }, [error])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-6 py-10">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-6 max-w-md">
            <div className="flex justify-center">
              <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
                <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Something went wrong
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                We encountered an error while loading the exam. Please try again.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button onClick={reset} className="px-6">
                Try Again
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = "/student/mid-semester-exams"}
              >
                Back to Exams
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

