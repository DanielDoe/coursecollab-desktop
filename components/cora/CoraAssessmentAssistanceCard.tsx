"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Assistance = {
  questionsAssisted: number
  conceptualHints: number
  debuggingSessions: number
  answerSeekingRedirected: number
  successRateAfterAssistance: number | null
}

export function CoraAssessmentAssistanceCard({ className }: { className?: string }) {
  const [data, setData] = useState<Assistance | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/student/cora/assessment-assistance")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.assistance) setData(json.assistance)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null

  const items = [
    { label: "Questions assisted", value: data.questionsAssisted },
    { label: "Conceptual hints", value: data.conceptualHints },
    { label: "Debugging sessions", value: data.debuggingSessions },
    { label: "Answer-seeking redirected", value: data.answerSeekingRedirected },
    {
      label: "Solved after assistance",
      value:
        data.successRateAfterAssistance != null ? `${data.successRateAfterAssistance}%` : "—",
    },
  ]

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Cora Assistance</CardTitle>
        <CardDescription>
          Learning support on written questions — Cora guides you, and never replaces your own work.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <div key={item.label} className="min-w-0">
              <p className="text-xl font-semibold tabular-nums">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
