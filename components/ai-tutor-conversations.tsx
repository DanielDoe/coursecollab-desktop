"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"
import { InstructorPolicySurfaceCard } from "@/components/instructor/InstructorPolicySurfaceCard"
import { ChevronLeft, ChevronRight, MessageSquare, User } from "lucide-react"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { portalListStripe } from "@/lib/portal-module-themes"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { cn } from "@/lib/utils"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { CoraSectionTools } from "@/components/instructor/administration/CoraSectionTools"

interface Conversation {
  id: string
  source?: "student-assistant" | "faculty-copilot"
  student_name: string
  student_id: string
  topic: string
  timestamp: string
  module_source?: string
  summary?: string
  turn_count?: number
}

interface AnonymousSummary {
  themes: Array<{ topic: string; questions: number; students: number }>
  modules: Array<{ module: string; questions: number; students: number }>
  hiddenStudents: number
  note: string
}

function text(value: unknown) {
  return typeof value === "string" ? value : ""
}

export function AITutorConversations({
  embedInDashboard,
  searchQuery = "",
}: {
  embedInDashboard?: boolean
  searchQuery?: string
} = {}) {
  const chrome = facultyEmbedChrome("ai-assistant-settings")
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [anonymous, setAnonymous] = useState<AnonymousSummary | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState(searchQuery)

  useEffect(() => {
    setPage(1)
  }, [filter])

  useEffect(() => {
    void fetchConversations()
  }, [page, filter])

  const fetchConversations = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "8" })
      if (filter.trim()) params.set("q", filter.trim())
      const response = await instructorApiFetch(`/api/instructor/ai-tutor/conversations?${params}`, {
        headers: buildInstructorApiHeaders(),
      })
      const data = await response.json()
      setConversations(Array.isArray(data.conversations) ? data.conversations : [])
      setAnonymous(data.anonymous ?? null)
      setTotalPages(Math.max(1, Number(data.totalPages) || 1))
      setTotal(Number(data.total) || 0)
      setError(response.ok ? null : data.error || "Could not load conversations")
    } catch {
      setError("Could not load conversations")
    } finally {
      setLoading(false)
    }
  }

  if (loading && conversations.length === 0) {
    if (embedInDashboard) {
      return <InstructorPolicyLoadingState moduleId="ai-assistant-settings" label="Loading conversations…" />
    }
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white/85 p-12 text-center dark:border-slate-700/60 dark:bg-slate-800/85">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-purple-600" />
        <p className="text-slate-600 dark:text-slate-400">Loading conversations...</p>
      </div>
    )
  }

  const list = (
    <div className="space-y-4">
      <CoraSectionTools
        search={filter}
        onSearchChange={setFilter}
        searchPlaceholder="Filter summaries…"
        meta={`${total} shared summar${total === 1 ? "y" : "ies"}`}
      />
      {anonymous ? (
        <InstructorPolicySurfaceCard
          variant="section"
          title="Anonymous class themes"
          description={anonymous.note}
        >
          {anonymous.themes.length === 0 ? (
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No class-wide Cora themes yet.</p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {anonymous.themes.map((theme, index) => {
                const stripe = portalListStripe(index, "amber")
                return (
                  <div key={theme.topic} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums",
                          stripe.iconBg,
                          stripe.iconText,
                        )}
                      >
                        {theme.questions}
                      </div>
                      <div className="min-w-0">
                        <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{theme.topic}</p>
                        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>High-level theme · no student names</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {anonymous.hiddenStudents > 0 ? (
            <p className={cn("mt-3 text-xs", PORTAL_TEXT_MUTED)}>
              {anonymous.hiddenStudents} student{anonymous.hiddenStudents === 1 ? "" : "s"} kept chats private.
            </p>
          ) : null}
        </InstructorPolicySurfaceCard>
      ) : null}

      <InstructorPolicySurfaceCard
        variant="section"
        title="Shared summaries"
        description={`${total} opted-in summar${total === 1 ? "y" : "ies"} — no transcripts`}
      >
        {conversations.length === 0 ? (
          <div className="py-10 text-center">
            <MessageSquare className="mx-auto mb-3 h-10 w-10 text-[var(--cc-text-muted)]/50" />
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
              {error ||
                "No students have opted in to share Cora summaries. Anonymous themes above still help you teach."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {conversations.map((conv, index) => {
              const stripe = portalListStripe(index, "amber")
              return (
                <div key={conv.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                      stripe.iconBg,
                      stripe.iconText,
                    )}
                  >
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{conv.student_name || "Student"}</p>
                      <p className={cn("text-xs tabular-nums", PORTAL_TEXT_MUTED)}>{conv.timestamp}</p>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {conv.module_source ? (
                        <Badge className="bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)] hover:bg-[var(--cc-accent-soft)]">
                          {conv.module_source}
                        </Badge>
                      ) : null}
                      {conv.topic ? (
                        <Badge variant="outline" className="border-[var(--border)]">
                          {conv.topic}
                        </Badge>
                      ) : null}
                    </div>
                    <p className={cn("mt-2 text-sm", PORTAL_TEXT_MUTED)}>{text(conv.summary)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <Button
                type="button"
                size="sm"
                className={cn("h-8 gap-1 rounded-lg", chrome.cta)}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </InstructorPolicySurfaceCard>
    </div>
  )

  if (embedInDashboard) return list
  return <div className="space-y-6">{list}</div>
}
