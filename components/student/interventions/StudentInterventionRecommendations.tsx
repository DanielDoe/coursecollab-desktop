"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

type StudentIntervention = {
  id: number
  interventionType: string
  contentSummary: string | null
  href: string
  actionLabel: string
}

export function StudentInterventionRecommendations({ className }: { className?: string }) {
  const [items, setItems] = useState<StudentIntervention[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/student/interventions?markViewed=1", { credentials: "include", cache: "no-store" })
        if (!res.ok) return
        const body = (await res.json()) as { interventions?: StudentIntervention[] }
        if (!cancelled) setItems(body.interventions ?? [])
      } catch {
        /* optional surface */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const onEngage = useCallback(async (interventionId: number) => {
    try {
      await fetch("/api/student/interventions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interventionId, action: "engaged" }),
      })
    } catch {
      /* non-blocking */
    }
  }, [])

  if (loading || items.length === 0) return null

  return (
    <div className={cn("space-y-3", className)}>
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-xl border border-[var(--cc-accent)]/25 bg-[var(--cc-accent)]/5 p-4"
        >
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-accent)]">
            <Sparkles className="h-3.5 w-3.5" />
            Recommended for you
          </div>
          <p className="text-sm text-[var(--cc-text)]">
            {item.contentSummary ?? "Your instructor team flagged an action that may help you catch up."}
          </p>
          <Link
            href={item.href}
            onClick={() => void onEngage(item.id)}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--cc-accent)] hover:underline"
          >
            {item.actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ))}
    </div>
  )
}
