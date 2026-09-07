"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"
import { InstructorPolicySurfaceCard } from "@/components/instructor/InstructorPolicySurfaceCard"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Mail,
  User,
} from "lucide-react"
import { motion } from "framer-motion"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { CoraSectionTools } from "@/components/instructor/administration/CoraSectionTools"

interface Struggle {
  id: number
  student_name: string
  student_id: string
  topic: string
  severity: "low" | "medium" | "high" | "critical"
  question_count: number
  last_seen: string
  status: "new" | "reviewed" | "resolved"
}

const SEVERITY_STYLES = {
  critical: "bg-[var(--cc-sem-danger)] text-white",
  high: "bg-[var(--cc-sem-warning)] text-white",
  medium: "bg-[var(--cc-sem-info)] text-white",
  low: "bg-[var(--cc-sem-neutral)] text-white",
} as const

export function AITutorStruggles({
  embedInDashboard,
  searchQuery = "",
}: {
  embedInDashboard?: boolean
  searchQuery?: string
} = {}) {
  const chrome = embedInDashboard ? facultyEmbedChrome("ai-assistant-settings") : null
  const [struggles, setStruggles] = useState<Struggle[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(searchQuery)

  useEffect(() => {
    void fetchStruggles()
  }, [])

  const fetchStruggles = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/ai-tutor/struggles", {
        headers: buildInstructorApiHeaders(),
      })
      const data = await response.json()
      if (response.ok) setStruggles(data.struggles || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  const q = filter.trim().toLowerCase()
  const filtered = struggles.filter(
    (s) =>
      !q ||
      s.student_name.toLowerCase().includes(q) ||
      s.student_id.toLowerCase().includes(q) ||
      s.topic.toLowerCase().includes(q),
  )

  if (loading) {
    if (embedInDashboard) {
      return <InstructorPolicyLoadingState moduleId="ai-assistant-settings" label="Loading struggle alerts…" />
    }
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white/85 p-12 text-center dark:border-slate-700/60 dark:bg-slate-800/85">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-purple-600" />
        <p className="text-slate-600 dark:text-slate-400">Loading struggle alerts...</p>
      </div>
    )
  }

  const body =
    filtered.length === 0 ? (
      <div className="py-10 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-[var(--cc-sem-success)]" />
        <p className={cn("text-sm font-medium", PORTAL_TEXT)}>No alerts right now</p>
        <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>Students aren&apos;t flagging struggle patterns</p>
      </div>
    ) : (
      <div className="space-y-3">
        {filtered.map((struggle, index) => {
          const severityClass = SEVERITY_STYLES[struggle.severity] ?? SEVERITY_STYLES.low
          const SeverityIcon = struggle.severity === "critical" || struggle.severity === "low" ? AlertCircle : AlertTriangle
          return (
            <motion.div
              key={struggle.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(index * 0.04, 0.25) }}
              className="rounded-xl border border-[var(--border)] bg-[var(--sidebar-accent)]/10 p-4"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <div className={cn("text-sm font-medium", PORTAL_TEXT)}>{struggle.student_name}</div>
                    <div className={cn("text-xs", PORTAL_TEXT_MUTED)}>{struggle.student_id}</div>
                  </div>
                </div>
                <Badge className={cn("gap-1 capitalize", severityClass)}>
                  <SeverityIcon className="h-3 w-3" />
                  {struggle.severity}
                </Badge>
              </div>

              <Badge variant="outline" className="mb-2 border-[var(--cc-accent)]/30 capitalize">
                {struggle.topic}
              </Badge>
              <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
                {struggle.question_count} questions on this topic · last seen {struggle.last_seen}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" className={cn("h-8 rounded-lg", chrome?.outline)}>
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  View chats
                </Button>
                <Button type="button" size="sm" variant="outline" className={cn("h-8 rounded-lg", chrome?.outline)}>
                  <Mail className="mr-1.5 h-3.5 w-3.5" />
                  Email
                </Button>
                <Button type="button" size="sm" className={cn("ml-auto h-8 rounded-lg", chrome?.cta)}>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Resolve
                </Button>
              </div>
            </motion.div>
          )
        })}
      </div>
    )

  if (embedInDashboard) {
    return (
      <div className="space-y-4">
        <CoraSectionTools
          search={filter}
          onSearchChange={setFilter}
          searchPlaceholder="Search alerts…"
          meta={`${filtered.length} opted-in alert${filtered.length === 1 ? "" : "s"}`}
        />
        <InstructorPolicySurfaceCard
          variant="section"
          title="Struggle alerts"
          description="Named alerts only appear when a student shares Cora summaries"
        >
          {body}
        </InstructorPolicySurfaceCard>
      </div>
    )
  }

  return <div className="space-y-6">{body}</div>
}
