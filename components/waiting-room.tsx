"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Users, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface WaitingRoomProps {
  quizId: string
  studentId: string
  onAdmitted?: () => void
}

export function WaitingRoom({ quizId, studentId, onAdmitted }: WaitingRoomProps) {
  const router = useRouter()
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const checkStatus = async () => {
    try {
      const response = await studentApiFetch(`/api/student/waiting-list-status?quizId=${quizId}&studentId=${studentId}`)
      if (!response.ok) throw new Error("Failed to check status")
      
      const data = await response.json()
      setStatus(data)
      setLoading(false)
      
      // If admitted, trigger callback
      if (data.shouldBeAdmitted || !data.inWaitingList) {
        if (onAdmitted) {
          onAdmitted()
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check waiting list status")
      setLoading(false)
    }
  }

  useEffect(() => {
    // Check immediately
    checkStatus()
    
    // Poll every 3 seconds
    const interval = setInterval(checkStatus, 3000)
    
    return () => clearInterval(interval)
  }, [quizId, studentId])

  if (loading) {
    return (
      <Card className="max-w-2xl mx-auto border-2">
        <CardContent className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600 dark:text-slate-400">Checking waiting list status...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="max-w-2xl mx-auto border-2 border-red-200 dark:border-red-800">
        <CardContent className="p-8 text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Button onClick={checkStatus} variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!status?.inWaitingList) {
    // Not in waiting list - can start
    return null
  }

  const estimatedWaitTime = status.studentsAhead > 0 
    ? Math.max(5, status.studentsAhead * 2) // Rough estimate: 2 minutes per student ahead
    : 0

  return (
    <Card className="max-w-2xl mx-auto border-2 border-blue-200 dark:border-blue-800">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          <CardTitle className="text-2xl">Waiting Room</CardTitle>
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          The assessment is currently at capacity. You will be admitted automatically when a spot opens.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Position Display */}
        <div className="text-center">
          <div className="text-6xl font-bold text-blue-600 dark:text-blue-400 mb-2">
            #{status.position}
          </div>
          <p className="text-lg text-slate-700 dark:text-slate-300">
            {status.position === 1 
              ? "You're next in line!" 
              : status.studentsAhead === 0
              ? "You're at the front of the line!"
              : `${status.studentsAhead} student${status.studentsAhead === 1 ? '' : 's'} ahead of you`}
          </p>
        </div>

        {/* Status Info */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {status.activeStudents}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Active Students
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {status.maxConcurrent}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Max Capacity
            </div>
          </div>
        </div>

        {/* Estimated Wait Time */}
        {estimatedWaitTime > 0 && (
          <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400">
            <Clock className="h-4 w-4" />
            <span className="text-sm">
              Estimated wait time: ~{estimatedWaitTime} minutes
            </span>
          </div>
        )}

        {/* Auto-refresh indicator */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Checking for available spots every 3 seconds...</span>
        </div>

        {/* Cancel button */}
        <div className="text-center pt-4">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="text-slate-600 dark:text-slate-400"
          >
            Cancel and Go Back
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

