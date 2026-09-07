"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { cn } from "@/lib/utils"
import { CheckCircle2, Eye, Loader2, Star } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export type InstructorSiblingAttempt = {
  id: number
  attemptNumber: number
  percentage: number
  score: number
  isFinalGrade: boolean
  shouldShowPnd: boolean
  resultsFinalized: boolean
  completedAt: string | null
}

type Props = {
  attempts: InstructorSiblingAttempt[]
  currentAttemptId: number
  studentName: string
  detailPath: (attemptId: number) => string
  onFinalChanged?: () => void
}

export function InstructorStudentAttemptPicker({
  attempts,
  currentAttemptId,
  studentName,
  detailPath,
  onFinalChanged,
}: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [busyId, setBusyId] = useState<number | null>(null)

  if (attempts.length <= 1) return null

  const finalAttempt = attempts.find((a) => a.isFinalGrade)

  const setAsGrade = async (attemptId: number) => {
    if (busyId != null) return
    setBusyId(attemptId)
    try {
      const res = await instructorApiFetch("/api/instructor/results/select-final-attempt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildInstructorAuthorizedApiHeaders(),
        },
        body: JSON.stringify({ attemptId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Failed to update grade attempt")
      }
      toast({
        title: "Grade attempt updated",
        description: `${studentName} will now be graded on attempt #${attempts.find((a) => a.id === attemptId)?.attemptNumber ?? attemptId}.`,
      })
      onFinalChanged?.()
      router.refresh()
    } catch (e) {
      toast({
        title: "Could not set grade attempt",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card className="border-amber-200/80 dark:border-amber-700/40 bg-amber-50/40 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">
          {attempts.length} attempts for {studentName}
        </CardTitle>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          The row marked{" "}
          <span className="font-medium text-emerald-700 dark:text-emerald-300">Counts for grade</span> is what
          Canvas and the gradebook use. PND% on other attempts does not affect the recorded score unless you
          select that attempt.
        </p>
        {finalAttempt?.shouldShowPnd ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Current grade attempt #{finalAttempt.attemptNumber} still has pending review (PND%). Grade code
            questions here or switch to a cleaner attempt below.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {attempts.map((a) => {
            const isViewing = a.id === currentAttemptId
            const busy = busyId === a.id
            const gradeLabel = a.shouldShowPnd
              ? "PND%"
              : `${a.percentage.toFixed(1)}%`
            return (
              <div
                key={a.id}
                className={cn(
                  "rounded-xl border p-3 flex flex-col gap-2",
                  a.isFinalGrade
                    ? "border-emerald-300/80 bg-emerald-50/80 dark:border-emerald-700/50 dark:bg-emerald-950/30"
                    : "border-slate-200/80 bg-white/90 dark:border-slate-600/60 dark:bg-slate-800/60",
                  isViewing && "ring-2 ring-teal-400/60 dark:ring-teal-500/50",
                )}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Attempt {a.attemptNumber}
                  </span>
                  {a.isFinalGrade ? (
                    <Badge className="border-0 bg-emerald-600 text-white text-[10px]">Counts for grade</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-slate-500">
                      Extra
                    </Badge>
                  )}
                  {isViewing ? (
                    <Badge variant="outline" className="text-[10px]">
                      Viewing
                    </Badge>
                  ) : null}
                </div>
                <div
                  className={cn(
                    "text-xl font-bold tabular-nums",
                    a.shouldShowPnd ? "text-amber-600 dark:text-amber-400" : "text-slate-800 dark:text-slate-100",
                  )}
                >
                  {gradeLabel}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-auto">
                  {!isViewing ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => router.push(detailPath(a.id))}
                    >
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      View
                    </Button>
                  ) : null}
                  {!a.isFinalGrade ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={busy}
                      onClick={() => void setAsGrade(a.id)}
                    >
                      {busy ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Star className="mr-1 h-3.5 w-3.5" />
                      )}
                      Use for grade
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300 py-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Grade attempt
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
