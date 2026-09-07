"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight, FileText, History, Target } from "lucide-react"
import { getStudentData } from "@/lib/auth"
import { EMBED_MATERIAL_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
import { cn } from "@/lib/utils"

type ScanItem = {
  id: number
  applicationId: number | null
  overallScore: number
  matchBand: string
  createdAt: string
  opportunityTitle: string | null
  organization: string | null
}

type LetterItem = {
  id: number
  applicationId: number
  tone: string
  updatedAt: string
  preview: string
  opportunityTitle: string | null
  organization: string | null
}

type Props = {
  kind: "scans" | "coverLetters"
  title?: string
  /** Report page the items link to, e.g. /guest/cora-career/match */
  linkBase: string
}

const BAND_LABELS: Record<string, string> = {
  NEEDS_ALIGNMENT: "Needs alignment",
  DEVELOPING_MATCH: "Developing",
  STRONG_MATCH: "Strong match",
  EXCELLENT_ALIGNMENT: "Excellent",
}

function scoreTone(score: number): string {
  if (score >= 80) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
  if (score >= 60) return "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300"
  if (score >= 40) return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
  return "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

/** Recent scans / cover letters list shown under the career tool forms. */
export function CareerHistoryPanel({ kind, title, linkBase }: Props) {
  const [scans, setScans] = useState<ScanItem[]>([])
  const [letters, setLetters] = useState<LetterItem[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const d = getStudentData()
    if (!d?.databaseId) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/guest/career/history?studentDatabaseId=${encodeURIComponent(d.databaseId)}`,
        )
        const json = await res.json()
        if (!res.ok || cancelled) return
        setScans(Array.isArray(json.scans) ? json.scans : [])
        setLetters(Array.isArray(json.coverLetters) ? json.coverLetters : [])
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const isEmpty = kind === "scans" ? scans.length === 0 : letters.length === 0
  if (!loaded || isEmpty) return null

  const heading = title ?? (kind === "scans" ? "Recent scans" : "Recent cover letters")

  return (
    <div className={cn(EMBED_MATERIAL_PANEL, "overflow-hidden")}>
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <History className="size-4 text-violet-600" aria-hidden />
        <h2 className="text-sm font-semibold text-[var(--cc-text)]">{heading}</h2>
      </div>
      <ul className="divide-y divide-[var(--border)]">
        {kind === "scans"
          ? scans.slice(0, 8).map((s) => (
              <li key={s.id}>
                <Link
                  href={s.applicationId ? `${linkBase}?applicationId=${s.applicationId}` : linkBase}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--muted)]/60"
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                      scoreTone(s.overallScore),
                    )}
                  >
                    {Math.round(s.overallScore)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--cc-text)]">
                      {s.opportunityTitle || "Untitled opportunity"}
                      {s.organization ? (
                        <span className="font-normal text-[var(--cc-text-muted)]"> · {s.organization}</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--cc-text-muted)]">
                      <Target className="size-3" aria-hidden />
                      {BAND_LABELS[s.matchBand] ?? s.matchBand}
                      <span aria-hidden>·</span>
                      {formatWhen(s.createdAt)}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-[var(--cc-text-muted)]" aria-hidden />
                </Link>
              </li>
            ))
          : letters.slice(0, 8).map((l) => (
              <li key={l.id}>
                <Link
                  href={`${linkBase}?applicationId=${l.applicationId}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--muted)]/60"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                    <FileText className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--cc-text)]">
                      {l.opportunityTitle || "Untitled opportunity"}
                      {l.organization ? (
                        <span className="font-normal text-[var(--cc-text-muted)]"> · {l.organization}</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--cc-text-muted)]">
                      {l.preview || `${l.tone} tone`} · {formatWhen(l.updatedAt)}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-[var(--cc-text-muted)]" aria-hidden />
                </Link>
              </li>
            ))}
      </ul>
    </div>
  )
}
