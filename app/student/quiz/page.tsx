"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, AlertCircle } from "lucide-react"

export default function StudentQuizPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to dashboard after a short delay
    const timer = setTimeout(() => {
      router.push("/student/dashboard")
    }, 3000)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-x-hidden">
      <Card className="w-full max-w-md bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 shadow-lg rounded-xl sm:rounded-2xl overflow-hidden">
        <CardHeader className="text-center pb-3 sm:pb-4 p-4 sm:p-6">
          <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-3 sm:mb-4">
            <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-slate-200 break-words">
            No Quiz Available
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">
            There are no quizzes available at this time. You will be redirected to your dashboard shortly.
          </p>
          
          <div className="flex flex-col gap-2 sm:gap-3">
            <Button 
              onClick={() => router.push("/student/dashboard")}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm h-10 sm:h-11 min-h-[44px] sm:min-h-0"
            >
              Go to Dashboard
            </Button>
            
            <Button 
              onClick={() => router.back()}
              variant="outline"
              size="sm"
              className="w-full border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0"
            >
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              Go Back
            </Button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-500 break-words">
            Redirecting automatically in 3 seconds...
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
