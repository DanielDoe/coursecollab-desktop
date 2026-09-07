"use client"

import { Badge } from "@/components/ui/badge"
import { History } from "lucide-react"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

export type MyTradeHistory = {
  transactions?: Array<
    Record<string, unknown> & { role?: string; summary?: string; created_at?: string | Date }
  >
  rollovers?: Array<Record<string, unknown> & { summary?: string; applied_at?: string | Date }>
  extraAttempts?: Array<Record<string, unknown> & { summary?: string; created_at?: string | Date }>
  donationRequests?: Array<Record<string, unknown> & { summary?: string; created_at?: string | Date }>
  pointRequests?: Array<Record<string, unknown> & { summary?: string; created_at?: string | Date }>
}

function parseTime(v: unknown): number {
  if (v == null) return 0
  const t = new Date(v as string).getTime()
  return Number.isNaN(t) ? 0 : t
}

function formatTime(v: unknown): string {
  if (v == null) return "—"
  const d = new Date(v as string)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString()
}

const CAT_BADGE: Record<string, { label: string }> = {
  ec: { label: "EC trade" },
  rollover: { label: "Rollover" },
  extra_attempts: { label: "Extra attempts" },
  peer: { label: "Peer" },
  community: { label: "Community" },
}

export function buildUnifiedTimeline(h: MyTradeHistory | null) {
  if (!h) return []
  type Row = { key: string; t: number; cat: keyof typeof CAT_BADGE; summary: string; when: string }
  const rows: Row[] = []

  for (const tx of h.transactions || []) {
    const role = String(tx.role || "")
    let cat: keyof typeof CAT_BADGE = "ec"
    if (role === "ec_trade") cat = "ec"
    else if (role === "community_out") cat = "community"
    else cat = "peer"
    rows.push({
      key: `tx-${tx.id}`,
      t: parseTime(tx.created_at),
      cat,
      summary: String(tx.summary || ""),
      when: formatTime(tx.created_at),
    })
  }

  for (const r of h.rollovers || []) {
    rows.push({
      key: `ro-${r.id}`,
      t: parseTime(r.applied_at),
      cat: "rollover",
      summary: String(r.summary || ""),
      when: formatTime(r.applied_at),
    })
  }

  for (const ea of h.extraAttempts || []) {
    rows.push({
      key: `ea-${ea.id}`,
      t: parseTime(ea.created_at),
      cat: "extra_attempts",
      summary: String(ea.summary || ""),
      when: formatTime(ea.created_at),
    })
  }

  for (const d of h.donationRequests || []) {
    rows.push({
      key: `dr-${d.id}`,
      t: parseTime(d.created_at),
      cat: "peer",
      summary: String(d.summary || ""),
      when: formatTime(d.created_at),
    })
  }

  for (const pr of h.pointRequests || []) {
    rows.push({
      key: `pr-${pr.id}`,
      t: parseTime(pr.created_at),
      cat: "peer",
      summary: String(pr.summary || ""),
      when: formatTime(pr.created_at),
    })
  }

  return rows.sort((a, b) => b.t - a.t)
}

export function TradeHistoryCard({
  title,
  subtitle,
  rows,
  empty,
  max = 8,
}: {
  title: string
  subtitle?: string
  rows: { key: string; cat: string; summary: string; when: string }[]
  empty: string
  max?: number
}) {
  const theme = getStudentModuleTheme("trade-center")
  const shown = rows.slice(0, max)

  return (
    <div className={cn("rounded-2xl border p-5 shadow-sm", PORTAL_CARD)}>
      <div className="flex items-start gap-3 mb-4">
        <div className={cn("p-2 rounded-lg border shrink-0", theme.page.iconBg, theme.page.border)}>
          <History className={cn("h-4 w-4", theme.page.iconText)} />
        </div>
        <div>
          <h4 className={cn("font-semibold", PORTAL_TEXT)}>{title}</h4>
          {subtitle ? <p className={cn("text-xs mt-0.5", PORTAL_TEXT_MUTED)}>{subtitle}</p> : null}
        </div>
      </div>
      {shown.length === 0 ? (
        <p className={cn("text-sm py-4 text-center", PORTAL_TEXT_MUTED)}>{empty}</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((r) => {
            const badge = CAT_BADGE[r.cat] || CAT_BADGE.ec
            return (
              <li
                key={r.key}
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-xl border",
                  theme.page.softBg,
                  theme.page.border,
                )}
              >
                <Badge className={cn("text-xs shrink-0 w-fit", theme.page.badge)}>{badge.label}</Badge>
                <p className={cn("text-sm flex-1 min-w-0", PORTAL_TEXT)}>{r.summary}</p>
                <time className={cn("text-xs shrink-0 tabular-nums", PORTAL_TEXT_MUTED)}>{r.when}</time>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
