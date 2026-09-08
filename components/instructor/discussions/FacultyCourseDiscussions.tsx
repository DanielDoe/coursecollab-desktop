"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  Pin,
  PinOff,
  Send,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import {
  AM_PANEL_FILL,
  AM_PANEL_SCROLL,
  AM_PANEL_SECTION,
} from "@/lib/assessments/assessment-management-surface-classes"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
  facultyToolbarIconButtonClass,
  facultyToolbarSelectTriggerClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

export type FacultyDiscussionThread = {
  id: number
  title: string
  description: string
  code_snippet?: string | null
  tags?: string[] | null
  upvotes: number
  downvotes: number
  reply_count: number
  is_anonymous: boolean
  is_pinned: boolean
  is_resolved: boolean
  created_at: string
  updated_at: string
  author_name: string | null
  author_section: string | null
  author_student_number: string | null
  author_reputation: number
}

type FacultyDiscussionReply = {
  id: number
  reply_text: string
  created_at: string
  author_name: string | null
  author_type: "instructor" | "student"
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function FacultyCourseDiscussions() {
  const { toast } = useToast()
  const chrome = facultyEmbedChrome("discussions")
  const spinner = facultyModuleSpinnerClass("discussions")

  const [threads, setThreads] = useState<FacultyDiscussionThread[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [replies, setReplies] = useState<FacultyDiscussionReply[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved">("open")
  const [sortBy, setSortBy] = useState<"recent" | "popular">("recent")
  const [replyText, setReplyText] = useState("")
  const [sending, setSending] = useState(false)

  const headers = useMemo(
    () => ({
      ...buildInstructorAuthorizedApiHeaders(),
      "Content-Type": "application/json",
    }),
    [],
  )

  const selectedThread = threads.find((t) => t.id === selectedId) ?? null

  const loadThreads = useCallback(async () => {
    const q = new URLSearchParams()
    if (search.trim()) q.set("search", search.trim())
    q.set("status", statusFilter)
    q.set("sortBy", sortBy)
    const res = await instructorApiFetch(`/api/instructor/discussions?${q}`, {
      headers: buildInstructorAuthorizedApiHeaders(),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error((err as { error?: string }).error ?? "Failed to load discussions")
    }
    const data = (await res.json()) as { threads?: FacultyDiscussionThread[] }
    const list = data.threads ?? []
    setThreads(list)
    setSelectedId((prev) => {
      if (prev != null && list.some((t) => t.id === prev)) return prev
      return list[0]?.id ?? null
    })
  }, [search, statusFilter, sortBy])

  const loadThreadDetail = useCallback(async (threadId: number) => {
    setDetailLoading(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/discussions?threadId=${threadId}`, {
        headers: buildInstructorAuthorizedApiHeaders(),
      })
      if (!res.ok) return
      const data = (await res.json()) as {
        thread?: FacultyDiscussionThread
        replies?: FacultyDiscussionReply[]
      }
      if (data.thread) {
        setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, ...data.thread! } : t)))
      }
      setReplies(data.replies ?? [])
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    void loadThreads()
      .catch((e) => {
        toast({ title: "Could not load discussions", description: e.message, variant: "destructive" })
      })
      .finally(() => setLoading(false))
  }, [loadThreads, toast])

  useEffect(() => {
    if (selectedId == null) {
      setReplies([])
      return
    }
    void loadThreadDetail(selectedId)
  }, [selectedId, loadThreadDetail])

  const patchThread = async (threadId: number, patch: { is_pinned?: boolean; is_resolved?: boolean }) => {
    const res = await instructorApiFetch("/api/instructor/discussions", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ thread_id: threadId, ...patch }),
    })
    if (!res.ok) {
      toast({ title: "Update failed", variant: "destructive" })
      return
    }
    const data = (await res.json()) as { thread?: FacultyDiscussionThread }
    if (data.thread) {
      setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, ...data.thread! } : t)))
    }
    await loadThreads()
  }

  const deleteThread = async (threadId: number) => {
    const res = await instructorApiFetch(`/api/instructor/discussions?threadId=${threadId}`, {
      method: "DELETE",
      headers: buildInstructorAuthorizedApiHeaders(),
    })
    if (!res.ok) {
      toast({ title: "Delete failed", variant: "destructive" })
      return
    }
    toast({ title: "Discussion removed" })
    setSelectedId(null)
    await loadThreads()
  }

  const sendReply = async () => {
    if (!selectedId || !replyText.trim()) return
    setSending(true)
    try {
      const res = await instructorApiFetch("/api/instructor/discussions", {
        method: "POST",
        headers,
        body: JSON.stringify({ thread_id: selectedId, reply_text: replyText.trim() }),
      })
      if (!res.ok) {
        toast({ title: "Reply failed", variant: "destructive" })
        return
      }
      const data = (await res.json()) as { replies?: FacultyDiscussionReply[] }
      setReplies(data.replies ?? [])
      setReplyText("")
      await loadThreads()
      toast({ title: "Reply posted" })
    } finally {
      setSending(false)
    }
  }

  const openCount = threads.filter((t) => !t.is_resolved).length

  if (loading) {
    return (
      <div className={cn(AM_PANEL_SECTION, AM_PANEL_FILL, "w-full min-w-0")}>
        <Loader2 className={cn("h-8 w-8 animate-spin", spinner)} />
      </div>
    )
  }

  return (
    <div className={cn(AM_PANEL_SECTION, "gap-4 min-w-0 w-full")}>
      <div className="flex shrink-0 items-start gap-3">
        <span className={chrome.iconBadge("md")}>
          <MessageCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className={cn("text-lg font-semibold sm:text-xl", PORTAL_TEXT)}>Course discussions</h1>
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            {openCount > 0
              ? `${openCount} open thread${openCount === 1 ? "" : "s"} from your course forum`
              : "Moderate student forum threads and post official replies."}
          </p>
        </div>
      </div>

      <div className="shrink-0">
      <FacultyIntegratedToolbar
        moduleId="discussions"
        search={search}
        onSearchChange={setSearch}
        onSearchClear={() => setSearch("")}
        searchPlaceholder="Search threads…"
        filters={
          <>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className={facultyToolbarSelectTriggerClass(statusFilter !== "all")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className={cn(facultyToolbarSelectTriggerClass(), "w-[6.5rem]")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recent</SelectItem>
                <SelectItem value="popular">Popular</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {threads.length} thread{threads.length === 1 ? "" : "s"}
            {statusFilter === "open" ? " · unresolved" : statusFilter === "resolved" ? " · resolved" : ""}
          </p>
        }
      />
      </div>

      {threads.length === 0 ? (
        <div className={cn(PORTAL_CARD, AM_PANEL_FILL, "px-6 py-14 text-center min-h-0 flex-1")}>
          <MessageCircle className={cn("mx-auto mb-3 h-8 w-8 opacity-40", PORTAL_TEXT_MUTED)} />
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            No forum threads match your filters. Students post from the Forum Hub.
          </p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[minmax(13rem,18rem)_minmax(0,1fr)] lg:gap-4">
          <div className={cn(PORTAL_CARD, "flex min-h-0 flex-col overflow-hidden p-1.5")}>
            <ul className={cn(AM_PANEL_SCROLL, "space-y-0.5 pr-1")}>
              {threads.map((t) => {
                const active = t.id === selectedId
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className={cn(
                        "w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                        active
                          ? "bg-[var(--sidebar-accent)] text-[var(--cc-text)]"
                          : "hover:bg-[var(--sidebar-accent)]/45 text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]",
                      )}
                    >
                      <div className="flex items-start gap-1.5">
                        {t.is_pinned ? <Pin className="mt-0.5 h-3 w-3 shrink-0 text-[var(--cc-accent)]" /> : null}
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-medium leading-snug">{t.title}</p>
                          <p className="mt-0.5 truncate text-xs opacity-80">
                            {t.author_name}
                            {t.reply_count > 0 ? ` · ${t.reply_count} replies` : ""}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className={cn(PORTAL_CARD, "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden")}>
            {!selectedThread ? (
              <div className="flex flex-1 items-center justify-center p-6">
                <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Select a thread</p>
              </div>
            ) : detailLoading && replies.length === 0 ? (
              <div className="flex flex-1 items-center justify-center p-6">
                <Loader2 className={cn("h-7 w-7 animate-spin", spinner)} />
              </div>
            ) : (
              <>
                <div className={cn(AM_PANEL_SCROLL, "space-y-3 p-4 sm:p-5")}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedThread.is_pinned ? (
                          <Badge variant="outline" className="border-[var(--cc-accent)]/40 text-[var(--cc-accent-dark)]">
                            Pinned
                          </Badge>
                        ) : null}
                        <Badge variant={selectedThread.is_resolved ? "secondary" : "default"}>
                          {selectedThread.is_resolved ? "Resolved" : "Open"}
                        </Badge>
                      </div>
                      <h2 className={cn("text-base font-semibold leading-snug", PORTAL_TEXT)}>{selectedThread.title}</h2>
                      <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                        {selectedThread.author_name}
                        {selectedThread.author_section ? ` · ${selectedThread.author_section}` : ""}
                        {selectedThread.author_student_number ? ` · ${selectedThread.author_student_number}` : ""}
                        {" · "}
                        {formatWhen(selectedThread.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={facultyToolbarIconButtonClass(selectedThread.is_pinned)}
                        aria-label={selectedThread.is_pinned ? "Unpin" : "Pin"}
                        title={selectedThread.is_pinned ? "Unpin" : "Pin"}
                        onClick={() =>
                          void patchThread(selectedThread.id, { is_pinned: !selectedThread.is_pinned })
                        }
                      >
                        {selectedThread.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </Button>
                      {!selectedThread.is_resolved ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={facultyToolbarIconButtonClass()}
                          aria-label="Mark resolved"
                          title="Mark resolved"
                          onClick={() => void patchThread(selectedThread.id, { is_resolved: true })}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={facultyToolbarFilterButtonClass()}
                          onClick={() => void patchThread(selectedThread.id, { is_resolved: false })}
                        >
                          Reopen
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(facultyToolbarIconButtonClass(), "text-red-600 dark:text-red-400")}
                        aria-label="Delete thread"
                        title="Delete"
                        onClick={() => void deleteThread(selectedThread.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <p className={cn("whitespace-pre-wrap text-sm leading-relaxed", PORTAL_TEXT)}>
                    {selectedThread.description}
                  </p>

                  {selectedThread.code_snippet ? (
                    <pre className="overflow-x-auto rounded-lg bg-[var(--sidebar-accent)]/30 p-3 text-xs leading-relaxed">
                      {selectedThread.code_snippet}
                    </pre>
                  ) : null}

                  {replies.length > 0 ? (
                    <div className="space-y-3 pt-1">
                      {replies.map((r) => (
                        <div
                          key={r.id}
                          className={cn(
                            "rounded-lg px-3 py-2.5",
                            r.author_type === "instructor"
                              ? "bg-[var(--cc-accent-soft)]/35"
                              : "bg-[var(--sidebar-accent)]/25",
                          )}
                        >
                          <p className="text-xs font-medium text-[var(--cc-accent-dark)] dark:text-[var(--cc-accent)]">
                            {r.author_name ?? (r.author_type === "instructor" ? "Faculty" : "Student")}
                            <span className={cn("ml-2 font-normal", PORTAL_TEXT_MUTED)}>
                              {formatWhen(r.created_at)}
                            </span>
                          </p>
                          <p className={cn("mt-1 whitespace-pre-wrap text-sm", PORTAL_TEXT)}>{r.reply_text}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="mt-auto border-t border-[var(--border)]/60 p-4 sm:p-5">
                  <div className="flex gap-2">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write an official faculty reply…"
                      rows={3}
                      className="min-h-[4.5rem] flex-1 resize-none rounded-lg border-0 bg-[var(--sidebar-accent)]/35 shadow-none focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]/35"
                    />
                    <Button
                      type="button"
                      size="icon"
                      className={cn("h-10 w-10 shrink-0 self-end rounded-lg", chrome.cta)}
                      disabled={sending || !replyText.trim()}
                      aria-label="Send reply"
                      onClick={() => void sendReply()}
                    >
                      {sending ? (
                        <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}