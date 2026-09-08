"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, MessageCircle, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

export type FacultyDiscussionThread = {
  id: number
  module_id: number
  module_title: string
  training_title?: string
  training_id?: number
  student_name: string
  title: string | null
  body: string
  status: string
  created_at?: string
  updated_at?: string
  replies?: Array<{
    id: number
    body: string
    author_name?: string
    author_type?: string
    created_at?: string
  }>
}

type FacultyCampDiscussionsProps = {
  trainingId?: number
  showTrainingLabel?: boolean
  embedInDashboard?: boolean
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts.slice(0, 2).map((p) => p[0] ?? "").join("") || "?").toUpperCase()
}

function formatWhen(iso?: string) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function Avatar({ name, faculty }: { name: string; faculty?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
        faculty ? "bg-[var(--cc-accent)] !text-white" : "bg-[var(--muted)] text-[var(--cc-text)]",
      )}
    >
      {initials(name)}
    </span>
  )
}

export function FacultyCampDiscussions({
  trainingId,
  showTrainingLabel = false,
  embedInDashboard = false,
}: FacultyCampDiscussionsProps) {
  const { card, solid, quiet, danger } = facultyEmbedChrome("summer-camp")
  const [discussions, setDiscussions] = useState<FacultyDiscussionThread[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<"open" | "all">("open")
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [sendingId, setSendingId] = useState<number | null>(null)

  const headers = useMemo(
    () => ({
      ...buildInstructorApiHeaders(),
      "Content-Type": "application/json",
    }),
    [],
  )

  const load = useCallback(async () => {
    const q = new URLSearchParams()
    if (trainingId != null) q.set("trainingId", String(trainingId))
    if (statusFilter !== "all") q.set("status", statusFilter)
    const res = await instructorApiFetch(`/api/instructor/summer-camp/discussions?${q}`, {
      headers: buildInstructorApiHeaders(),
    })
    if (res.ok) {
      const data = await res.json()
      setDiscussions((data.discussions ?? []) as FacultyDiscussionThread[])
    }
  }, [trainingId, statusFilter])

  useEffect(() => {
    setLoading(true)
    void load().finally(() => setLoading(false))
  }, [load])

  const openCount = discussions.filter((d) => d.status === "open").length

  const replyDiscussion = async (thread: FacultyDiscussionThread) => {
    const text = (drafts[thread.id] ?? "").trim()
    if (!text) return
    setSendingId(thread.id)
    try {
      await instructorApiFetch("/api/instructor/summer-camp/discussions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          module_id: thread.module_id,
          parent_id: thread.id,
          body: text,
        }),
      })
      setDrafts((prev) => ({ ...prev, [thread.id]: "" }))
      await load()
    } finally {
      setSendingId(null)
    }
  }

  const updateStatus = async (discussionId: number, status: string) => {
    await instructorApiFetch("/api/instructor/summer-camp/discussions", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ discussion_id: discussionId, status }),
    })
    await load()
  }

  if (loading) {
    return (
      <div className={cn("space-y-3", embedInDashboard && "flex min-h-0 flex-1 flex-col")}>
        <Skeleton className="h-9 w-full shrink-0 rounded-xl" />
        <div className={cn("space-y-3", embedInDashboard && "min-h-0 flex-1")}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  const emptyPanelClass = embedInDashboard
    ? cn(card, "flex min-h-0 flex-1 flex-col items-center justify-center border-dashed px-4 py-10 text-center")
    : cn(card, "p-8 text-center")

  return (
    <div className={embedInDashboard ? "flex min-h-0 flex-1 flex-col gap-4" : "space-y-4"}>
      <div className={cn("flex flex-wrap items-center justify-between gap-3", embedInDashboard && "shrink-0")}>
        <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
          {openCount > 0
            ? `${openCount} open conversation${openCount === 1 ? "" : "s"} need a reply`
            : "No open conversations — campers can post from any module."}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            className={cn("h-8 rounded-lg", statusFilter === "open" ? solid : quiet)}
            onClick={() => setStatusFilter("open")}
          >
            Open
          </Button>
          <Button
            size="sm"
            className={cn("h-8 rounded-lg", statusFilter === "all" ? solid : quiet)}
            onClick={() => setStatusFilter("all")}
          >
            All
          </Button>
        </div>
      </div>

      <div className={embedInDashboard ? "flex min-h-0 flex-1 flex-col" : undefined}>
      {discussions.length === 0 ? (
        <div className={emptyPanelClass}>
          <MessageCircle className={cn("mx-auto mb-2 h-8 w-8", PORTAL_TEXT_MUTED)} />
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            No camper conversations yet. Questions from module pages appear here as threads.
          </p>
        </div>
      ) : (
        <div className={cn(embedInDashboard && "min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 sm:pr-2")}>
        {discussions.map((d) => {
          const isOpen = d.status === "open"
          const draft = drafts[d.id] ?? ""
          const sending = sendingId === d.id
          const context = [
            showTrainingLabel ? d.training_title : null,
            d.module_title,
          ]
            .filter(Boolean)
            .join(" · ")

          return (
            <article key={d.id} className={cn(card, "overflow-hidden")}>
              <header className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
                <Avatar name={d.student_name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn("truncate text-sm font-semibold", PORTAL_TEXT)}>{d.student_name}</p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        isOpen ? solid : quiet,
                      )}
                    >
                      {d.status}
                    </span>
                  </div>
                  <p className="truncate text-xs text-[var(--cc-text-secondary)]">
                    {d.title ? `${d.title} · ` : ""}
                    {context}
                    {d.created_at ? ` · ${formatWhen(d.created_at)}` : ""}
                  </p>
                </div>
              </header>

              <div className="space-y-3 px-4 py-4 sm:px-5">
                <div className="flex items-end gap-2">
                  <Avatar name={d.student_name} />
                  <div className="max-w-[min(100%,36rem)] rounded-2xl rounded-bl-md bg-[var(--muted)] px-3.5 py-2.5">
                    <p className={cn("whitespace-pre-wrap text-sm leading-relaxed", PORTAL_TEXT)}>{d.body}</p>
                  </div>
                </div>

                {(d.replies ?? []).map((r) => {
                  const faculty = r.author_type === "instructor"
                  const name = r.author_name ?? (faculty ? "You" : d.student_name)
                  return (
                    <div
                      key={r.id}
                      className={cn("flex items-end gap-2", faculty && "flex-row-reverse")}
                    >
                      <Avatar name={name} faculty={faculty} />
                      <div
                        className={cn(
                          "max-w-[min(100%,36rem)] px-3.5 py-2.5",
                          faculty
                            ? "rounded-2xl rounded-br-md bg-[var(--cc-accent)] !text-white"
                            : "rounded-2xl rounded-bl-md bg-[var(--muted)]",
                        )}
                      >
                        <p className={cn("text-[11px] font-medium", faculty ? "text-white/80" : "text-[var(--cc-text-secondary)]")}>
                          {name}
                          {r.created_at ? ` · ${formatWhen(r.created_at)}` : ""}
                        </p>
                        <p className={cn("mt-0.5 whitespace-pre-wrap text-sm leading-relaxed", faculty ? "!text-white" : PORTAL_TEXT)}>
                          {r.body}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {isOpen ? (
                <footer className="flex items-end gap-2 border-t border-[var(--border)] bg-[var(--muted)]/40 px-4 py-3 sm:px-5">
                  <Avatar name="You" faculty />
                  <Textarea
                    value={draft}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [d.id]: e.target.value }))}
                    placeholder="Write a reply…"
                    rows={2}
                    className="min-h-[44px] flex-1 resize-none rounded-xl bg-[var(--card)]"
                  />
                  <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                    <Button
                      size="sm"
                      className={cn("h-9 rounded-lg", solid)}
                      disabled={sending || !draft.trim()}
                      onClick={() => void replyDiscussion(d)}
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send
                    </Button>
                    <Button
                      size="sm"
                      className={cn("h-9 rounded-lg", danger)}
                      onClick={() => void updateStatus(d.id, "resolved")}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Resolve
                    </Button>
                  </div>
                </footer>
              ) : null}
            </article>
          )
        })}
        </div>
      )}
      </div>
    </div>
  )
}
