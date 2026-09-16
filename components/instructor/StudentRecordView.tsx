"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Calendar,
  ExternalLink,
  FileText,
  Mail,
  RefreshCw,
  User,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { cn } from "@/lib/utils"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { getFacultyModuleTheme, facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"
import { getAdminData } from "@/lib/auth"
import { adminApiRequestInit, withAdminIdQuery } from "@/lib/admin-portal-api"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import type { StudentPlatformRecord } from "@/lib/student-platform-record"

type Props = {
  studentDbId: string
  userType?: "admin" | "instructor"
  embedInDashboard?: boolean
}

const ASSESSMENT_LABELS: Record<string, string> = {
  quiz: "Quizzes",
  homework: "Homework",
  mid_semester: "Mid-Semester",
  midsem: "Mid-Semester",
  final: "Finals",
  final_exam: "Finals",
  attendance: "Attendance",
}

function formatWhen(value: string | null) {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return value
  }
}

function formatScore(score: number | null) {
  if (score == null || Number.isNaN(score)) return "—"
  return `${Math.round(score * 10) / 10}%`
}

function assessmentLabel(type: string) {
  return ASSESSMENT_LABELS[type] ?? type.replace(/_/g, " ")
}

export function StudentRecordView({ studentDbId, userType = "instructor", embedInDashboard = true }: Props) {
  const chrome = facultyEmbedChrome("student-mgmt")
  const fp = userType === "instructor" ? getFacultyModuleTheme("student-mgmt").page : null
  const iconBg = fp?.iconBg ?? chrome.p.iconBg
  const iconText = fp?.iconText ?? chrome.p.iconText
  const portalCta = fp?.cta ?? chrome.solid

  const [record, setRecord] = useState<StudentPlatformRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>("all")

  const resultsBase = embedInDashboard ? `${FACULTY_DASHBOARD_BASE}/results` : "/instructor/results"

  const buildHeaders = useCallback((): Record<string, string> => {
    if (userType === "admin") {
      return adminApiRequestInit().headers
    }
    const out = buildInstructorApiHeaders()
    const instructorSession = localStorage.getItem("instructorSession")
    if (instructorSession) out.authorization = instructorSession
    return out
  }, [userType])

  const fetchRecord = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const prefix = userType === "admin" ? "/api/admin" : "/api/instructor"
      let url = `${prefix}/students/${studentDbId}/record`
      if (userType === "admin") {
        const admin = getAdminData()
        url = withAdminIdQuery(url, admin?.id != null ? String(admin.id) : null)
      }
      const res = await fetch(url, { headers: buildHeaders(), cache: "no-store" })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to load student record")
        setRecord(null)
        return
      }
      setRecord(data.record)
    } catch {
      setError("Failed to load student record")
      setRecord(null)
    } finally {
      setLoading(false)
    }
  }, [buildHeaders, studentDbId, userType])

  useEffect(() => {
    fetchRecord()
  }, [fetchRecord])

  const filteredAttempts = useMemo(() => {
    if (!record) return []
    if (typeFilter === "all") return record.attempts
    return record.attempts.filter((a) => a.assessment_type === typeFilter)
  }, [record, typeFilter])

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <RefreshCw className={cn("h-8 w-8 animate-spin", facultyModuleSpinnerClass("student-mgmt"))} />
      </div>
    )
  }

  if (error || !record) {
    return (
      <div className={cn(chrome.card, "space-y-4 p-6")}>
        <p className="text-sm text-red-600 dark:text-red-400">{error || "Student not found"}</p>
        <Button variant="outline" size="sm" onClick={fetchRecord}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  const { student, summary } = record
  const pointsTotal = (record.classroomPoints ?? []).reduce((s, p) => s + (p.points || 0), 0)
  const gradeLabel = record.gradebook?.letter_grade
    || (record.gradebook?.total_score != null ? String(Math.round(record.gradebook.total_score * 10) / 10) : "—")

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 space-y-6 p-3 sm:p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", iconBg)}>
            <User className={cn("h-6 w-6", iconText)} />
          </div>
          <div className="min-w-0">
            <h1 className={cn("text-xl font-semibold sm:text-2xl", PORTAL_TEXT)}>{student.full_name}</h1>
            <p className={cn("font-mono text-sm", PORTAL_TEXT_MUTED)}>{student.student_id}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">{student.section}</Badge>
              {student.session_code && student.session_code !== student.section ? (
                <Badge variant="outline">{student.session_code}</Badge>
              ) : null}
            </div>
            {student.email ? (
              <p className={cn("mt-2 flex items-center gap-2 text-sm", PORTAL_TEXT_MUTED)}>
                <Mail className="h-4 w-4 shrink-0" />
                <span className="break-all">{student.email}</span>
              </p>
            ) : null}
            <p className={cn("mt-1 flex items-center gap-2 text-xs", PORTAL_TEXT_MUTED)}>
              <Calendar className="h-3.5 w-3.5" />
              Registered {formatWhen(student.created_at)}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRecord}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {[
          { label: "Grade", value: gradeLabel },
          { label: "Attempts", value: summary.total_attempts },
          { label: "Practice", value: summary.practice_attempts },
          { label: "Lectures", value: (record.lectures ?? []).length },
          { label: "Flashcards", value: (record.flashcards ?? []).length },
          { label: "Points", value: pointsTotal },
        ].map((stat) => (
          <div key={stat.label} className={cn(chrome.card, "px-4 py-3")}>
            <p className={cn("text-[11px] font-medium uppercase tracking-wide", PORTAL_TEXT_MUTED)}>{stat.label}</p>
            <p className={cn("text-lg font-semibold", PORTAL_TEXT)}>{stat.value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="assessments">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="assessments">Assessments ({record.attempts.length})</TabsTrigger>
          <TabsTrigger value="practice">Practice ({record.practice.length})</TabsTrigger>
          <TabsTrigger value="grades">Grades</TabsTrigger>
          <TabsTrigger value="lectures">Lectures ({(record.lectures ?? []).length})</TabsTrigger>
          <TabsTrigger value="flashcards">Flashcards ({(record.flashcards ?? []).length})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({(record.notes ?? []).length})</TabsTrigger>
          <TabsTrigger value="points">Points ({(record.classroomPoints ?? []).length})</TabsTrigger>
          <TabsTrigger value="activity">Activity ({(record.activity ?? []).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="assessments" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={typeFilter === "all" ? "default" : "outline"}
              className={typeFilter === "all" ? portalCta : undefined}
              onClick={() => setTypeFilter("all")}
            >
              All
            </Button>
            {summary.assessment_types.map((type) => (
              <Button
                key={type}
                size="sm"
                variant={typeFilter === type ? "default" : "outline"}
                className={typeFilter === type ? portalCta : undefined}
                onClick={() => setTypeFilter(type)}
              >
                {assessmentLabel(type)}
              </Button>
            ))}
          </div>

          {filteredAttempts.length === 0 ? (
            <div className={cn(chrome.card, "p-8 text-center text-sm", PORTAL_TEXT_MUTED)}>
              No assessment attempts recorded for this filter.
            </div>
          ) : (
            <div className={cn(chrome.card, "overflow-x-auto")}>
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className={cn("border-b text-left text-xs uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                    <th className="px-4 py-3 font-medium">Assessment</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Attempt</th>
                    <th className="px-4 py-3 font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {filteredAttempts.map((attempt) => (
                    <tr
                      key={attempt.id}
                      className={cn(
                        "border-b last:border-0",
                        attempt.deleted && "opacity-60",
                      )}
                    >
                      <td className="px-4 py-3 font-medium">{attempt.quiz_title}</td>
                      <td className="px-4 py-3">{assessmentLabel(attempt.assessment_type)}</td>
                      <td className="px-4 py-3">#{attempt.attempt_number}</td>
                      <td className="px-4 py-3 font-semibold">{formatScore(attempt.display_score)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {attempt.deleted ? <Badge variant="destructive">Deleted</Badge> : null}
                          {attempt.saved_for_later ? <Badge variant="outline">Paused</Badge> : null}
                          {!attempt.completed_at && !attempt.saved_for_later ? (
                            <Badge variant="outline">In progress</Badge>
                          ) : null}
                          {attempt.results_finalized ? <Badge className="bg-emerald-600">Finalized</Badge> : null}
                          {attempt.is_final_grade ? <Badge variant="secondary">Grade attempt</Badge> : null}
                        </div>
                      </td>
                      <td className={cn("px-4 py-3 text-xs", PORTAL_TEXT_MUTED)}>
                        {formatWhen(attempt.attempted_at || attempt.completed_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!attempt.deleted ? (
                          <Button asChild variant="ghost" size="sm" className="h-8">
                            <Link href={`${resultsBase}/${attempt.id}`}>
                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                              Open
                            </Link>
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="practice" className="mt-4">
          {record.practice.length === 0 ? (
            <div className={cn(chrome.card, "p-8 text-center text-sm", PORTAL_TEXT_MUTED)}>
              No practice sessions recorded.
            </div>
          ) : (
            <div className={cn(chrome.card, "overflow-x-auto")}>
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className={cn("border-b text-left text-xs uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                    <th className="px-4 py-3 font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Questions</th>
                    <th className="px-4 py-3 font-medium">Topics</th>
                    <th className="px-4 py-3 font-medium">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {record.practice.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-semibold">{formatScore(row.score_percentage)}</td>
                      <td className="px-4 py-3">
                        {row.correct_answers}/{row.total_questions}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {row.topics.slice(0, 4).map((topic) => (
                            <Badge key={topic} variant="outline" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className={cn("px-4 py-3 text-xs", PORTAL_TEXT_MUTED)}>
                        {formatWhen(row.completed_at || row.started_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="grades" className="mt-4 space-y-4">
          {record.gradebook ? (
            <div className={cn(chrome.card, "divide-y divide-[var(--border)]")}>
              {[
                ["Letter / total", `${record.gradebook.letter_grade ?? "—"} · ${record.gradebook.total_score ?? "—"}`],
                ["Quizzes", record.gradebook.quiz_score],
                ["Homework", record.gradebook.homework_score],
                ["Midterm", record.gradebook.midterm_score],
                ["Final", record.gradebook.final_score],
                ["Attendance", record.gradebook.attendance_score],
                ["Classroom", record.gradebook.classroom_score],
                ["Project", record.gradebook.project_score],
                ["Engagement", record.gradebook.engagement_credits],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className={PORTAL_TEXT}>{label}</span>
                  <span className={PORTAL_TEXT_MUTED}>{value ?? "—"}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={cn(chrome.card, "p-8 text-center text-sm", PORTAL_TEXT_MUTED)}>No gradebook row yet.</p>
          )}
          <div className={cn(chrome.card, "px-4 py-3 text-sm")}>
            <p className={PORTAL_TEXT}>
              Attendance {record.attendance?.rate ?? "—"}%
              {record.attendance?.recorded ? ` · ${record.attendance.present}/${record.attendance.recorded} recorded` : ""}
            </p>
            {(record.attendance?.recent_missed ?? []).length ? (
              <p className={cn("mt-1", PORTAL_TEXT_MUTED)}>Missed: {record.attendance.recent_missed.join(", ")}</p>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="lectures" className="mt-4 space-y-4">
          {(record.lectures ?? []).length ? (
            <div className={cn(chrome.card, "overflow-x-auto")}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={cn("border-b text-left text-xs uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                    <th className="px-4 py-3 font-medium">Lecture</th>
                    <th className="px-4 py-3 font-medium">Week</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Last opened</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {record.lectures.map((row) => (
                    <tr key={`${row.title}-${row.last_accessed}`}>
                      <td className="px-4 py-3 font-medium">{row.title}</td>
                      <td className="px-4 py-3">{row.week ?? "—"}</td>
                      <td className="px-4 py-3 capitalize">{row.status ?? "—"}</td>
                      <td className={cn("px-4 py-3 text-xs", PORTAL_TEXT_MUTED)}>{formatWhen(row.last_accessed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={cn(chrome.card, "p-8 text-center text-sm", PORTAL_TEXT_MUTED)}>No lecture progress yet.</p>
          )}
          {(record.lecturePractice ?? []).length ? (
            <div className={cn(chrome.card, "divide-y divide-[var(--border)]")}>
              {record.lecturePractice.map((row, i) => (
                <div key={`${row.lecture_title}-${i}`} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className={PORTAL_TEXT}>{row.lecture_title}</span>
                  <span className={PORTAL_TEXT_MUTED}>
                    {row.is_correct ? "Correct" : "Missed"} · {formatWhen(row.completed_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="flashcards" className="mt-4">
          {(record.flashcards ?? []).length ? (
            <div className={cn(chrome.card, "divide-y divide-[var(--border)]")}>
              {record.flashcards.map((row) => (
                <div key={row.title} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className={PORTAL_TEXT}>{row.title}</span>
                  <span className={PORTAL_TEXT_MUTED}>{row.card_count} cards · {formatWhen(row.updated_at)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={cn(chrome.card, "p-8 text-center text-sm", PORTAL_TEXT_MUTED)}>No flashcard decks yet.</p>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          {(record.notes ?? []).length ? (
            <div className={cn(chrome.card, "divide-y divide-[var(--border)]")}>
              {record.notes.map((row) => (
                <div key={row.title} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className={PORTAL_TEXT}>{row.title}</span>
                  <span className={PORTAL_TEXT_MUTED}>{formatWhen(row.updated_at)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={cn(chrome.card, "p-8 text-center text-sm", PORTAL_TEXT_MUTED)}>No notes yet.</p>
          )}
        </TabsContent>

        <TabsContent value="points" className="mt-4">
          {(record.classroomPoints ?? []).length ? (
            <div className={cn(chrome.card, "divide-y divide-[var(--border)]")}>
              {record.classroomPoints.map((row, i) => (
                <div key={`${row.awarded_at}-${i}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className={PORTAL_TEXT}>{row.reason || row.category || "Classroom points"}</p>
                    <p className={PORTAL_TEXT_MUTED}>{row.category} · {formatWhen(row.awarded_at)}</p>
                  </div>
                  <span className={cn("font-semibold", PORTAL_TEXT)}>{row.points > 0 ? `+${row.points}` : row.points}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={cn(chrome.card, "p-8 text-center text-sm", PORTAL_TEXT_MUTED)}>No classroom points yet.</p>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          {(record.activity ?? []).length ? (
            <div className={cn(chrome.card, "divide-y divide-[var(--border)]")}>
              {record.activity.map((row, i) => (
                <div key={`${row.kind}-${row.at}-${i}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className={PORTAL_TEXT}>{row.label}</p>
                    <p className={cn("capitalize", PORTAL_TEXT_MUTED)}>{row.kind}</p>
                  </div>
                  <span className={PORTAL_TEXT_MUTED}>{formatWhen(row.at)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={cn(chrome.card, "p-8 text-center text-sm", PORTAL_TEXT_MUTED)}>No recent platform activity.</p>
          )}
        </TabsContent>
      </Tabs>

      <p className={cn("flex items-start gap-2 text-xs", PORTAL_TEXT_MUTED)}>
        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Open any attempt for full question-by-question review, instructor overrides, and violation logs.
      </p>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
