"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "@/components/student/dashboard-v2/light-motion"
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  BookOpen,
  Code2,
  FileText,
  GraduationCap,
  Bell,
  Calendar,
} from "lucide-react"
import Link from "next/link"
import { format, isAfter } from "date-fns"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import {
  portalAccentIconClass,
  portalIconBadgeClass,
  portalOutlineButtonClass,
} from "@/lib/portal-module-themes"
import { resolveStudentDatabaseId, resolveStudentSection, resolveStudentDisplayId } from "@/lib/auth"
import { getStudentAssessmentFeed } from "@/lib/student-assessment-feed-client"
import {
  buildAssessmentHubItem,
  type StudentAssessmentHubItem,
} from "@/lib/student-assessment-hub"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

const MAX_ITEMS_BEFORE_SUMMARY = 12

/** Only roster-released assessments (quiz_session_access on the student's session), not BETA-only preview access. */
function isRosterPendingAssessment(row: {
  can_take?: boolean
  session_active?: boolean
  completed?: boolean
}): boolean {
  return row.can_take === true && row.session_active === true && row.completed !== true
}

function pushAssessmentPending(
  pendingItems: StudentAssessmentHubItem[],
  row: {
    id: number
    title?: string
    description?: unknown
    available_from?: string | null
    available_until?: string | null
  },
  type: StudentAssessmentHubItem["type"],
  idPrefix: string,
) {
  pendingItems.push(
    buildAssessmentHubItem({
      type,
      id: row.id,
      title: row.title,
      description: row.description,
      available_from: row.available_from,
      available_until: row.available_until,
      status: "open",
      idPrefix,
    }),
  )
}

interface PendingItem extends StudentAssessmentHubItem {}

const dashboardTheme = getStudentModuleTheme("dashboard")

const typeConfig = {
  quiz: { icon: ClipboardList, label: "Quiz", color: portalAccentIconClass(dashboardTheme) },
  homework: { icon: BookOpen, label: "Homework", color: "text-amber-600" },
  code_submission: { icon: Code2, label: "Classroom assignment", color: "text-emerald-600" },
  midterm: { icon: FileText, label: "Midterm", color: "text-amber-500" },
  final: { icon: GraduationCap, label: "Final", color: "text-red-500" },
}

export function PendingAssignmentsBanner() {
  const [items, setItems] = useState<PendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const dbId = resolveStudentDatabaseId()
    const section = resolveStudentSection()

    if (!dbId) {
      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        const displayId = resolveStudentDisplayId() || dbId
        const feed = await getStudentAssessmentFeed(dbId, displayId, section)

        const pendingItems: PendingItem[] = []
        const now = new Date()

        for (const q of feed.quizzes) {
          if (isRosterPendingAssessment(q as Parameters<typeof isRosterPendingAssessment>[0])) {
            pushAssessmentPending(
              pendingItems,
              q as {
                id: number
                title?: string
                description?: unknown
                available_from?: string | null
                available_until?: string | null
              },
              "quiz",
              "quiz",
            )
          }
        }

        for (const h of feed.homeworkAssessments) {
          if (isRosterPendingAssessment(h as Parameters<typeof isRosterPendingAssessment>[0])) {
            pushAssessmentPending(
              pendingItems,
              h as {
                id: number
                title?: string
                description?: unknown
                available_from?: string | null
                available_until?: string | null
              },
              "homework",
              "hw",
            )
          }
        }

        for (const m of feed.midSemesters) {
          if (isRosterPendingAssessment(m as Parameters<typeof isRosterPendingAssessment>[0])) {
            pushAssessmentPending(
              pendingItems,
              m as {
                id: number
                title?: string
                description?: unknown
                available_from?: string | null
                available_until?: string | null
              },
              "midterm",
              "mid",
            )
          }
        }

        for (const f of feed.finals) {
          const final = f as {
            session_active?: boolean
            status?: string
            can_take?: boolean
            id: number
            title?: string
            description?: unknown
            available_from?: string | null
            available_until?: string | null
          }
          if (
            final.session_active === true &&
            final.status !== "completed" &&
            final.can_take !== false
          ) {
            pushAssessmentPending(pendingItems, final, "final", "final")
          }
        }

        for (const s of feed.missingSubmissions) {
          const sub = s as { id: number; title?: string; expires_at?: string; is_active?: boolean }
          if (sub.is_active === false) continue
          const expiresAt = sub.expires_at ? new Date(sub.expires_at) : null
          if (!expiresAt || isAfter(expiresAt, now)) {
            pendingItems.push(
              buildAssessmentHubItem({
                type: "code_submission",
                id: sub.id,
                title: sub.title,
                available_until: sub.expires_at,
                status: "open",
                idPrefix: "sub",
              }),
            )
          }
        }

        pendingItems.sort((a, b) => {
          const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
          const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
          return aDate - bDate
        })
        setItems(pendingItems)
        if (pendingItems.length > 0 && pendingItems.length <= MAX_ITEMS_BEFORE_SUMMARY) {
          setExpanded(true)
        }
      } catch (e) {
        console.error("[PendingAssignmentsBanner] Failed:", e)
        setItems([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading || items.length === 0) return null

  const showFullList = items.length <= MAX_ITEMS_BEFORE_SUMMARY
  const displayItems = showFullList ? items : items.slice(0, MAX_ITEMS_BEFORE_SUMMARY)

  const actionLinkClass =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors"

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3 }}
      >
        <div
          className={cn(
            "rounded-2xl border border-slate-200/80 dark:border-white/[0.08]",
            "bg-white dark:bg-slate-900/80",
            "shadow-md shadow-slate-200/30 dark:shadow-black/10"
          )}
        >
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <div className="p-4 sm:p-5">
              <div
                className={cn(
                  "flex gap-3",
                  showFullList
                    ? "flex-col sm:flex-row sm:items-center sm:justify-between"
                    : "flex-col lg:flex-row lg:items-center lg:justify-between",
                )}
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition-colors",
                      showFullList && "hover:bg-slate-100/50 dark:hover:bg-white/[0.02]",
                    )}
                    aria-expanded={expanded}
                  >
                    <div className={cn("shrink-0", portalIconBadgeClass(dashboardTheme, "sm"))}>
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        You have {items.length} pending {items.length === 1 ? "item" : "items"}
                      </h3>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {items.length === 1
                          ? "1 assignment, quiz, or classroom task"
                          : `${items.length} assignments, quizzes, or classroom tasks`}
                      </p>
                    </div>
                  </button>
                </CollapsibleTrigger>

                {!showFullList ? (
                  <div
                    className="flex shrink-0 flex-row flex-wrap items-center gap-2 sm:gap-2.5 lg:ml-auto"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <Link
                      href="/student/dashboard-v2/notifications"
                      className={cn(
                        actionLinkClass,
                        "flex-1 sm:flex-initial",
                        dashboardTheme.page.iconBg,
                        dashboardTheme.page.iconText,
                        "hover:opacity-90",
                      )}
                    >
                      <Bell className="h-4 w-4 shrink-0" />
                      Notifications
                    </Link>
                    <Link
                      href="/student/dashboard-v2/calendar"
                      className={cn(
                        actionLinkClass,
                        "flex-1 sm:flex-initial bg-slate-200/80 text-slate-700 hover:bg-slate-300/80 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15",
                      )}
                    >
                      <Calendar className="h-4 w-4 shrink-0" />
                      Calendar
                    </Link>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          actionLinkClass,
                          "shrink-0 border",
                          portalOutlineButtonClass(dashboardTheme),
                        )}
                      >
                        {expanded ? "Collapse" : "Expand"}
                        {expanded ? (
                          <ChevronUp className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        )}
                      </button>
                    </CollapsibleTrigger>
                  </div>
                ) : (
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex shrink-0 items-center gap-2 self-start text-xs font-medium sm:self-center",
                        portalAccentIconClass(dashboardTheme),
                      )}
                      aria-expanded={expanded}
                    >
                      {expanded ? "Collapse" : "Expand"}
                      {expanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                )}
              </div>
            </div>
            <CollapsibleContent>
              <div className="border-t border-slate-200/60 px-4 pb-4 pt-0 dark:border-white/[0.06] sm:px-5 sm:pb-5">
                {showFullList ? (
                  <ul className="mt-3 space-y-1.5">
                    {displayItems.map((item) => {
                      const cfg = typeConfig[item.type] || typeConfig.quiz
                      const Icon = cfg.icon
                      return (
                        <li key={item.id}>
                          <Link
                            href={item.href}
                            className="group flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                          >
                            <div
                              className={cn(
                                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                                cfg.color,
                                "bg-slate-100 dark:bg-white/5",
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                                {item.title}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-white/50">
                                {item.dueDate
                                  ? `Due ${format(new Date(item.dueDate), "MMM d, yyyy")} · ${cfg.label}`
                                  : cfg.label}
                              </p>
                              {item.instructions ? (
                                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                                  {item.instructions}
                                </p>
                              ) : null}
                            </div>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  expanded && (
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                      These are open quizzes, homework, and classroom assignments — not inbox notifications.
                      Use Calendar for your personal schedule and due-date view.
                    </p>
                  )
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
