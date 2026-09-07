"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useMemo, useState } from "react"
import { usePersistedState } from "@/hooks/use-persisted-state"
import Link from "next/link"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { AssessmentBulkReevaluateModal } from "@/components/assessment-bulk-reevaluate-modal"
import type { AssessmentBulkReevaluateScope } from "@/hooks/use-bulk-reevaluate-attempts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type SessionRow = { id: number; code: string; description: string | null }

type QuizRow = {
  id: number
  title: string
  session_access?: Record<string, boolean | undefined>
}

function instructorHeaders(): Record<string, string> {
  const instructorId = typeof window !== "undefined" ? localStorage.getItem("instructorId") || "" : ""
  const sessionRaw =
    typeof window !== "undefined" ? localStorage.getItem("instructorSession") || "" : ""
  return {
    "x-instructor-id": instructorId,
    Authorization: sessionRaw,
  }
}

export default function InstructorReEvaluateQuizzesPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [allQuizzes, setAllQuizzes] = useState<QuizRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionCode, setSessionCode] = usePersistedState<string>("instructor-reevaluate-quizzes-session", "", "local")
  const [quizId, setQuizId] = usePersistedState<string>("instructor-reevaluate-quizzes-quizId", "", "local")
  const [scope, setScope] = usePersistedState<AssessmentBulkReevaluateScope>(
    "instructor-reevaluate-quizzes-scope",
    "pending",
    "local"
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [picked, setPicked] = useState<QuizRow | null>(null)

  const filteredQuizzes = useMemo(() => {
    if (!sessionCode) return []
    return allQuizzes.filter((q) => q.session_access?.[sessionCode] === true)
  }, [allQuizzes, sessionCode])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const instructorId = localStorage.getItem("instructorId")
      const sessionRaw = localStorage.getItem("instructorSession")
      if (!instructorId || !sessionRaw) {
        if (!cancelled) {
          setSessions([])
          setAllQuizzes([])
          setLoading(false)
        }
        return
      }
      const headers = instructorHeaders()
      setLoading(true)
      try {
        const [sessionsRes, quizzesRes] = await Promise.all([
          instructorApiFetch("/api/instructor/sessions", { headers }),
          fetch(`/api/quizzes/list?instructorId=${instructorId}`, { headers }),
        ])
        const sessionsData = await sessionsRes.json()
        const quizzesData = await quizzesRes.json()
        const sessList = (sessionsData.sessions || []) as SessionRow[]
        const quizList = (quizzesData.assessments || quizzesData.quizzes || []) as QuizRow[]
        if (!cancelled) {
          setSessions(sessList)
          setAllQuizzes(quizList)
          setSessionCode((prev) => {
            if (prev && sessList.some((s) => s.code === prev)) return prev
            return sessList[0]?.code ?? ""
          })
        }
      } catch {
        if (!cancelled) {
          setSessions([])
          setAllQuizzes([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!filteredQuizzes.length) {
      setQuizId("")
      return
    }
    setQuizId((prev) =>
      filteredQuizzes.some((q) => String(q.id) === prev) ? prev : String(filteredQuizzes[0].id)
    )
  }, [filteredQuizzes])

  const selectedQuiz = filteredQuizzes.find((q) => String(q.id) === quizId)

  const openModal = () => {
    if (!selectedQuiz || !sessionCode) return
    setPicked(selectedQuiz)
    setModalOpen(true)
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <Link
        href="/instructor/dashboard-v2/assessments/quizzes"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to quizzes
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-emerald-600" />
            Bulk re-evaluate quizzes
          </CardTitle>
          <CardDescription>
            Choose the class session and quiz, then whether to re-grade only pending review (PND%) or every
            completed attempt. Student answers stay in the database; scores and feedback are updated in place.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">No sessions found.</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="reeval-session">Session (class)</Label>
                <Select value={sessionCode} onValueChange={setSessionCode}>
                  <SelectTrigger id="reeval-session">
                    <SelectValue placeholder="Choose a session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((s) => (
                      <SelectItem key={s.id} value={s.code}>
                        {s.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reeval-quiz">Assessment (quiz)</Label>
                {filteredQuizzes.length === 0 ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
                    No quizzes are enabled for this session. Turn on session access for a quiz on the
                    assessments list, then return here.
                  </p>
                ) : (
                  <Select value={quizId} onValueChange={setQuizId}>
                    <SelectTrigger id="reeval-quiz">
                      <SelectValue placeholder="Choose a quiz" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredQuizzes.map((q) => (
                        <SelectItem key={q.id} value={String(q.id)}>
                          {q.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] p-3">
                <Label className="text-sm font-medium">Re-evaluate scope</Label>
                <RadioGroup
                  value={scope}
                  onValueChange={(v) => setScope(v as AssessmentBulkReevaluateScope)}
                  className="mt-2 gap-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pending" id="page-scope-pending" />
                    <Label htmlFor="page-scope-pending" className="font-normal cursor-pointer">
                      Pending review (PND%) only — attempts still showing pending grading
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="page-scope-all" />
                    <Label htmlFor="page-scope-all" className="font-normal cursor-pointer">
                      All completed attempts for this quiz
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Button
                className="w-full"
                onClick={openModal}
                disabled={!selectedQuiz || !sessionCode}
              >
                Open bulk re-evaluate
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {picked && (
        <AssessmentBulkReevaluateModal
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open)
            if (!open) setPicked(null)
          }}
          quizId={picked.id}
          quizTitle={picked.title}
          assessmentLabel="Quiz"
          initialScope={scope}
          hideScopePicker
          sessionCode={sessionCode}
        />
      )}
    </div>
  )
}
