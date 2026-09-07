"use client"

import { QuizResults } from "@/components/quiz-results"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { use, useEffect, useState } from "react"
import { usePreventBack } from "@/hooks/use-prevent-back"

export default function InstructorViewResultPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [backPath, setBackPath] = useState("/instructor/results")
  const [backLabel, setBackLabel] = useState("Results")

  // Prevent accidental navigation to login
  usePreventBack("/instructor/login")

  useEffect(() => {
    // Check instructor session
    const instructorSession = localStorage.getItem("instructorSession")
    const instructorId = localStorage.getItem("instructorId")
    
    if (!instructorSession || !instructorId) {
      console.log("[Instructor Results] No session found, redirecting to login")
      router.push("/instructor/login")
      return
    }
    
    console.log("[Instructor Results] Session verified, viewing attempt:", id)

    // Determine the correct back path based on referrer
    const referrer = document.referrer
    console.log("[Instructor Results] Referrer:", referrer)
    
    if (referrer.includes("/instructor/mid-semester-exams")) {
      setBackPath("/instructor/mid-semester-exams")
      setBackLabel("Mid-Semester Exams")
    } else if (referrer.includes("/instructor/quizzes")) {
      setBackPath("/instructor/quizzes")
      setBackLabel("Quizzes")
    } else if (referrer.includes("/instructor/homeworks")) {
      setBackPath("/instructor/homeworks")
      setBackLabel("Homeworks")
    } else if (referrer.includes("/instructor/final-exams")) {
      setBackPath("/instructor/final-exams")
      setBackLabel("Final Exams")
    } else {
      // Default to results page
      setBackPath("/instructor/results")
      setBackLabel("Results")
    }
  }, [router, id])

  const handleBack = () => {
    router.push(backPath)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
            <ArrowLeft className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Student Assessment Report
            </h2>
            <p className="text-sm text-slate-600 mt-1">Viewing detailed student results</p>
          </div>
        </div>
        <Button 
          onClick={handleBack}
          variant="outline"
          className="border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all rounded-xl"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to {backLabel}
        </Button>
      </div>
      <QuizResults attemptId={id} isAdminView={true} userType="instructor" />
    </div>
  )
}

