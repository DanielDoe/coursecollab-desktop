"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ArrowUpRight, ClipboardCheck, X } from "lucide-react"
import { AnimatePresence, motion } from "@/components/student/dashboard-v2/light-motion"
import { resolveStudentDatabaseId, getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import { getStudentDatabaseIdFromClient } from "@/lib/student-dashboard-banner-prefs"

type AwaitingItem = {
  quizId: number
  title: string
  assessmentType: string
  completedAt: string | null
  resultsHref: string
}

const typeLabel: Record<string, string> = {
  homework: "Homework",
  quiz: "Quiz",
  mid_semester: "Midterm",
  midsem: "Midterm",
  final: "Final",
  finals: "Final",
}

function awaitingDismissKey(studentDbId: string): string {
  return `cc_student_${studentDbId}_awaiting_review_dismissed`
}

function fingerprint(items: AwaitingItem[]): string {
  return items
    .map((item) => item.quizId)
    .sort((a, b) => a - b)
    .join(",")
}

function readDismissed(studentDbId: string | null, items: AwaitingItem[]): boolean {
  if (!studentDbId || typeof window === "undefined") return false
  try {
    return localStorage.getItem(awaitingDismissKey(studentDbId)) === fingerprint(items)
  } catch {
    return false
  }
}

function writeDismissed(studentDbId: string, items: AwaitingItem[]): void {
  try {
    localStorage.setItem(awaitingDismissKey(studentDbId), fingerprint(items))
  } catch {
    /* private mode */
  }
}

export function GradesAwaitingReviewBanner() {
  const [items, setItems] = useState<AwaitingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const dbId = resolveStudentDatabaseId()
    if (!dbId) {
      setLoading(false)
      return
    }

    studentApiFetch(`/api/grades/student/awaiting-review?studentId=${dbId}`, {
      headers: getStudentAuthHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        const next = Array.isArray(data.items) ? (data.items as AwaitingItem[]) : []
        setItems(next)
        setDismissed(readDismissed(getStudentDatabaseIdFromClient(), next))
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading || items.length === 0 || dismissed) return null

  const first = items[0]
  const extra = items.length - 1
  const countLabel = items.length === 1 ? "1 submission" : `${items.length} submissions`
  const meta = [
    typeLabel[first.assessmentType] ?? "Assessment",
    first.completedAt ? `Submitted ${format(new Date(first.completedAt), "MMM d")}` : null,
    extra > 0 ? `+${extra} more` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  const handleDismiss = () => {
    const studentDbId = getStudentDatabaseIdFromClient()
    if (studentDbId) writeDismissed(studentDbId, items)
    setDismissed(true)
  }

  return (
    <AnimatePresence>
      <motion.section
        data-awaiting-review-banner
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        aria-label="Grades awaiting review"
        className="mb-3 overflow-visible rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 sm:px-4"
      >
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]">
              <ClipboardCheck className="size-4" strokeWidth={2.25} />
            </div>
            <span className="absolute -right-1 -top-1 flex min-w-[1.05rem] items-center justify-center rounded-full bg-[var(--cc-warning)] px-1 text-[10px] font-bold tabular-nums text-white">
              {items.length}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--cc-text)]">
              {countLabel} awaiting review
            </p>
            <p className="truncate text-xs text-[var(--cc-text-muted)]">
              {first.title}
              {meta ? ` · ${meta}` : ""}
            </p>
          </div>

          <Link
            href="/student/dashboard-v2/grades"
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-[var(--cc-accent-soft)] px-3 text-xs font-semibold text-[var(--cc-accent-dark)]"
          >
            Grades
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--cc-text-muted)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--cc-text)]"
            aria-label="Dismiss pending review banner"
          >
            <X className="size-4" />
          </button>
        </div>
      </motion.section>
    </AnimatePresence>
  )
}
