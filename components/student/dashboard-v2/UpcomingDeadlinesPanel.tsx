"use client"

import { useState, useEffect } from "react"
import { Calendar, ClipboardList, BookOpen, FileText, GraduationCap, Code2, ChevronRight } from "lucide-react"
import { CardWrapper } from "./CardWrapper"
import Link from "next/link"
import { format, isAfter } from "date-fns"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import {
  resolveStudentDatabaseId,
  resolveStudentDisplayId,
  resolveStudentSection,
} from "@/lib/auth"
import { getStudentAssessmentFeed } from "@/lib/student-assessment-feed-client"
import {
  buildAssessmentHubItem,
  type StudentAssessmentHubItem,
  type StudentAssessmentHubType,
} from "@/lib/student-assessment-hub"

function pushUpcomingDeadline(
  items: StudentAssessmentHubItem[],
  row: {
    id: number
    title?: string
    description?: unknown
    available_from?: string | null
    available_until?: string | null
  },
  type: StudentAssessmentHubType,
  idPrefix: string,
  now: Date,
) {
  const due = row.available_until ? new Date(row.available_until) : null
  if (!due || !isAfter(due, now)) return

  const opensAt = row.available_from ? new Date(row.available_from) : null
  const status = opensAt && isAfter(opensAt, now) ? "coming_soon" : "open"

  items.push(
    buildAssessmentHubItem({
      type,
      id: row.id,
      title: row.title,
      description: row.description,
      available_from: row.available_from,
      available_until: row.available_until,
      status,
      idPrefix,
    }),
  )
}

export function UpcomingDeadlinesPanel() {
  const [deadlines, setDeadlines] = useState<StudentAssessmentHubItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const dbId = resolveStudentDatabaseId()
    const displayId = resolveStudentDisplayId()
    const section = resolveStudentSection()

    if (!dbId) {
      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        const feed = await getStudentAssessmentFeed(dbId, displayId || dbId, section)
        const items: StudentAssessmentHubItem[] = []
        const now = new Date()

        for (const q of feed.quizzes) {
          pushUpcomingDeadline(
            items,
            q as {
              id: number
              title?: string
              description?: unknown
              available_from?: string | null
              available_until?: string | null
            },
            "quiz",
            "quiz",
            now,
          )
        }

        for (const h of feed.homeworkHistory) {
          const row = h as {
            id: number
            title?: string
            description?: unknown
            status?: string
            available_from?: string | null
            available_until?: string | null
          }
          if (row.status !== "completed") {
            pushUpcomingDeadline(items, row, "homework", "hw", now)
          }
        }

        for (const m of feed.midSemesters) {
          pushUpcomingDeadline(
            items,
            m as {
              id: number
              title?: string
              description?: unknown
              available_from?: string | null
              available_until?: string | null
            },
            "midterm",
            "mid",
            now,
          )
        }

        for (const f of feed.finals) {
          pushUpcomingDeadline(
            items,
            f as {
              id: number
              title?: string
              description?: unknown
              available_from?: string | null
              available_until?: string | null
            },
            "final",
            "final",
            now,
          )
        }

        for (const s of feed.missingSubmissions) {
          const row = s as { id: number; title?: string; expires_at?: string }
          const expiresAt = row.expires_at ? new Date(row.expires_at) : null
          if (expiresAt && isAfter(expiresAt, now)) {
            items.push(
              buildAssessmentHubItem({
                type: "code_submission",
                id: row.id,
                title: row.title,
                available_until: row.expires_at,
                status: "open",
                idPrefix: "sub",
              }),
            )
          }
        }

        items.sort((a, b) => {
          const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
          const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
          return aDate - bDate
        })
        setDeadlines(items.slice(0, 5))
      } catch (e) {
        console.error("[UpcomingDeadlinesPanel] Failed:", e)
        setDeadlines([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const deadlineTheme = getStudentModuleTheme("dashboard").page
  const typeConfig = {
    quiz: { icon: ClipboardList, label: "Quiz", color: deadlineTheme.iconText },
    homework: { icon: BookOpen, label: "Homework", color: "text-gold" },
    midterm: { icon: FileText, label: "Midterm", color: "text-amber-500" },
    final: { icon: GraduationCap, label: "Final", color: "text-red-500" },
    code_submission: { icon: Code2, label: "Classroom assignment", color: "text-emerald-600" },
  }

  if (loading) {
    return (
      <CardWrapper delay={0.25}>
        <div className="p-6 h-64 animate-pulse bg-slate-200/30 dark:bg-white/5 rounded-2xl" />
      </CardWrapper>
    )
  }

  return (
    <CardWrapper delay={0.25}>
      <div className="flex h-full min-h-[280px] flex-col p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[var(--cc-text-muted)]" />
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
              Upcoming Deadlines
            </h3>
          </div>
          <Link
            href="/student/dashboard-v2/timeline"
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.12em] hover:underline",
              deadlineTheme.iconText,
            )}
          >
            Timeline
          </Link>
        </div>

        {deadlines.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--cc-text-muted)]">
            No upcoming deadlines — you&apos;re clear.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {deadlines.map((d) => {
              const config = typeConfig[d.type]
              const Icon = config.icon
              const opensSoon =
                d.opensAt && isAfter(new Date(d.opensAt), new Date()) ? new Date(d.opensAt) : null
              return (
                <li key={d.id}>
                  <Link
                    href={d.href}
                    className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-[var(--muted)]/50"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--muted)]/55">
                      <Icon className={cn("h-4 w-4", config.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--cc-text)]">
                        {d.title}
                      </p>
                      <p className="text-xs text-[var(--cc-text-muted)]">
                        {config.label}
                        {d.dueDate ? ` · Due ${format(new Date(d.dueDate), "MMM d, h:mm a")}` : ""}
                        {opensSoon ? ` · Opens ${format(opensSoon, "MMM d")}` : ""}
                      </p>
                      {d.instructions ? (
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[var(--cc-text-secondary)]">
                          {d.instructions}
                        </p>
                      ) : null}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--cc-text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </CardWrapper>
  )
}
