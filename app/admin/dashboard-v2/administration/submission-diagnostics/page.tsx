"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { WifiOff, RefreshCw, AlertTriangle, BarChart3, Users, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface DiagnosticSummary {
  totalIssues: number
  days: number
}

interface ByErrorType {
  errorType: string
  count: number
}

interface ByAssessment {
  assessmentType: string
  count: number
}

interface ByStudent {
  studentId: number
  studentName: string
  studentIdDisplay: string
  issueCount: number
}

interface RecentItem {
  answerId: number
  attemptId: number
  questionId: number
  answeredAt: string
  studentName: string
  studentIdDisplay: string
  quizTitle: string
  assessmentType: string
  quizId: number
  requiresReview: boolean
  errorType: string
  retryCount: number | null
}

interface DiagnosticsData {
  summary: DiagnosticSummary
  byErrorType: ByErrorType[]
  byAssessment: ByAssessment[]
  byStudent: ByStudent[]
  recentItems: RecentItem[]
}

function getInstructorId(): string {
  if (typeof window === "undefined") return "1"
  const id = localStorage.getItem("instructorId")
  if (id) return id
  try {
    const session = localStorage.getItem("instructorSession")
    if (session) {
      const data = JSON.parse(session)
      return String(data.id ?? data.databaseId ?? "1")
    }
  } catch {
    /* ignore */
  }
  return "1"
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    })
  } catch {
    return dateStr
  }
}

function formatAssessmentType(type: string): string {
  const map: Record<string, string> = {
    quiz: "Quiz",
    homework: "Homework",
    mid_semester: "Mid-Semester",
    final: "Final Exam",
  }
  return map[type] ?? type
}

export default function SubmissionDiagnosticsPage() {
  const [data, setData] = useState<DiagnosticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(7)

  const load = async () => {
    setLoading(true)
    try {
      const instructorId = getInstructorId()
      const res = await fetch(
        `/api/instructor/submission-diagnostics?instructorId=${instructorId}&days=${days}`
      )
      if (res.ok) {
        const json = await res.json()
        setData(json)
      } else {
        setData(null)
      }
    } catch (e) {
      console.error("[SubmissionDiagnostics] Failed to load:", e)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [days])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full min-w-0"
    >
      <CardWrapper delay={0} hover={false}>
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 w-full min-w-0 overflow-x-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <WifiOff className="h-6 w-6 text-amber-500" />
                Submission Diagnostics
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Answers that experienced connection/timeout issues — helps distinguish student internet
                vs. system performance
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm"
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
              </select>
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-sm font-medium disabled:opacity-50"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !data ? (
            <p className="text-slate-500 dark:text-slate-400 py-8 text-center">
              Failed to load diagnostics
            </p>
          ) : (
            <div className="space-y-6">
              {/* Summary card */}
              <div
                className={cn(
                  "rounded-xl p-4 border",
                  data.summary.totalIssues > 0
                    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                    : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                )}
              >
                <div className="flex items-center gap-2">
                  {data.summary.totalIssues > 0 ? (
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {data.summary.totalIssues} submission{data.summary.totalIssues !== 1 ? "s" : ""}{" "}
                    with connection issues
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    in the last {data.summary.days} days
                  </span>
                </div>
                {data.summary.totalIssues > 0 && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    These answers were saved via fallback (timeout/network). Students were reassured
                    their work is recorded. Use the breakdown below to see if issues cluster by
                    student (likely their internet) or by assessment (may indicate system load).
                  </p>
                )}
              </div>

              {data.summary.totalIssues > 0 && (
                <>
                  {/* By error type */}
                  {data.byErrorType.length > 0 && (
                    <div>
                      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        By Error Type
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {data.byErrorType.map((r) => (
                          <span
                            key={r.errorType}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-sm"
                          >
                            {r.errorType}: {r.count}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        AbortError/TimeoutError often indicate slow connections; Server error may
                        indicate backend load.
                      </p>
                    </div>
                  )}

                  {/* By assessment */}
                  {data.byAssessment.length > 0 && (
                    <div>
                      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        By Assessment Type
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {data.byAssessment.map((r) => (
                          <span
                            key={r.assessmentType}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-sm"
                          >
                            {formatAssessmentType(r.assessmentType)}: {r.count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* By student */}
                  {data.byStudent.length > 0 && (
                    <div>
                      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Students with Most Issues
                      </h2>
                      <div className="rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-white/5">
                              <th className="text-left px-4 py-2 font-medium">Student</th>
                              <th className="text-right px-4 py-2 font-medium">Issues</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.byStudent.map((r) => (
                              <tr
                                key={r.studentId}
                                className="border-t border-slate-200 dark:border-white/10"
                              >
                                <td className="px-4 py-2">
                                  <Link
                                    href={`/admin/dashboard-v2/results?student=${r.studentId}`}
                                    className="text-emerald-600 dark:text-emerald-400 hover:underline"
                                  >
                                    {r.studentName} ({r.studentIdDisplay})
                                  </Link>
                                </td>
                                <td className="px-4 py-2 text-right">{r.issueCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Recent items */}
                  {data.recentItems.length > 0 && (
                    <div>
                      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Recent Affected Submissions
                      </h2>
                      <div className="rounded-lg border border-slate-200 dark:border-white/10 overflow-x-auto">
                        <table className="w-full text-sm min-w-[500px]">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-white/5">
                              <th className="text-left px-4 py-2 font-medium">Date</th>
                              <th className="text-left px-4 py-2 font-medium">Student</th>
                              <th className="text-left px-4 py-2 font-medium">Assessment</th>
                              <th className="text-left px-4 py-2 font-medium">Error</th>
                              <th className="text-left px-4 py-2 font-medium">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.recentItems.slice(0, 20).map((r) => (
                              <tr
                                key={r.answerId}
                                className="border-t border-slate-200 dark:border-white/10"
                              >
                                <td className="px-4 py-2 whitespace-nowrap">
                                  {formatDate(r.answeredAt)}
                                </td>
                                <td className="px-4 py-2">
                                  {r.studentName} ({r.studentIdDisplay})
                                </td>
                                <td className="px-4 py-2">
                                  {r.quizTitle} ({formatAssessmentType(r.assessmentType)})
                                </td>
                                <td className="px-4 py-2">
                                  <span className="text-amber-600 dark:text-amber-400">
                                    {r.errorType}
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  <Link
                                    href={`/admin/dashboard-v2/results/${r.attemptId}`}
                                    className="text-emerald-600 dark:text-emerald-400 hover:underline"
                                  >
                                    View attempt
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </CardWrapper>
    </motion.div>
  )
}
