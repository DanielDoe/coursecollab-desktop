"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  Reply,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { PORTAL_CTA } from "@/lib/appearance/portal-nav-classes"
import { portalProgressFillClass } from "@/lib/portal-module-themes"
import { getMessagesPortalTheme } from "@/lib/messages-portal-theme"
import { MessagesThemeProvider } from "@/components/messages/messages-theme-context"
import { getMessageAuthHeaders, messageApiFetch } from "@/lib/direct-messages/client"
import { looksLikeHtml, sanitizeMessageHtml, stripHtmlToPlain } from "@/lib/direct-messages/html"
import { messageIsOnlyLocalDeviceFile } from "@/lib/direct-messages/local-device-file"
import {
  MessageComposer,
  isComposerEmpty,
  type MessageAttachmentDraft,
} from "@/components/messages/MessageComposer"
import { attachmentsReadyForSend } from "@/lib/direct-messages/upload-message-attachment-client"
import {
  clearMessageSendOutbox,
  listMessageSendOutbox,
  saveMessageSendOutbox,
  type MessageSendOutboxEntry,
} from "@/lib/direct-messages/message-send-outbox"
import { MessageAttachmentView } from "@/components/messages/MessageAttachmentView"
import { MessageReactionBar } from "@/components/messages/MessageReactionBar"
import { MessageParticipantDrawer } from "@/components/messages/MessageParticipantDrawer"
import { MessageQuoteCard } from "@/components/messages/MessageQuoteCard"
import { MessageThreadBackdrop } from "@/components/messages/MessageThreadBackdrop"
import {
  buildQuotedReply,
  parseMessageQuote,
  quoteExcerptFromBody,
  quoteNamesMatch,
  type MessageQuote,
} from "@/lib/direct-messages/message-quote"
import {
  backgroundChangeLine,
  readMessageThreadAppearance,
  sameMessageBackground,
  writeMessageThreadAppearance,
  type BackgroundNotice,
  type MessageThreadBackground,
} from "@/lib/direct-messages/message-thread-background"
import { PresenceAvatar } from "@/components/presence/PresenceAvatar"
import { PresenceStatusPicker } from "@/components/presence/PresenceStatusPicker"
import { RoleWithLastSeen } from "@/components/presence/LastSeenLabel"
import { usePresenceTracking } from "@/components/presence/usePresence"
import { unsentAuditLabel } from "@/lib/direct-messages/message-lifecycle"
import type { ParticipantKind } from "@/lib/direct-messages/types"
import type {
  MessageRecipient,
  MessageReactionGroup,
  ThreadDetail,
  ThreadMessage,
  ThreadSummary,
} from "@/lib/direct-messages/types"

export type MessagesPortal = "student" | "instructor" | "guest" | "camp"

type MessagesInboxProps = {
  portal: MessagesPortal
  /** @deprecated Breadcrumbs carry title; kept for API compatibility */
  title?: string
  /** @deprecated Breadcrumbs carry context; kept for API compatibility */
  description?: string
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) return time

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  if (isYesterday) return `Yesterday ${time}`

  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** Fallback last-active time from the other participant's most recent message. */
function lastActiveFromThread(thread: ThreadDetail, kind: ParticipantKind, id: number): string | null {
  let latest: string | null = null
  for (const m of thread.messages) {
    if (m.isMine) continue
    if (m.senderKind !== kind || Number(m.senderId) !== id) continue
    if (!latest || m.createdAt > latest) latest = m.createdAt
  }
  return latest
}

function messagePlainText(body: string): string {
  return looksLikeHtml(body) ? stripHtmlToPlain(body) : body.trim()
}

function viewerDisplayName(): string {
  if (typeof window === "undefined") return "You"
  const student = window.sessionStorage.getItem("studentName")?.trim()
  if (student) return student
  try {
    const raw = window.localStorage.getItem("instructorSession")
    if (!raw) return "You"
    const session = JSON.parse(raw) as { name?: string; fullName?: string; full_name?: string }
    return session.name?.trim() || session.fullName?.trim() || session.full_name?.trim() || "You"
  } catch {
    return "You"
  }
}

function MessageBody({ message, isMine }: { message: ThreadMessage; isMine: boolean }) {
  if (message.unsent) {
    return (
      <p
        className={cn(
          "text-xs italic leading-snug",
          isMine ? "text-white/85" : "text-slate-500 dark:text-slate-400",
        )}
      >
        {unsentAuditLabel(Boolean(message.unsentByMe), message.senderName)}
      </p>
    )
  }
  const parsedQuote = parseMessageQuote(message.body)
  const replySource = parsedQuote.quote ? parsedQuote.reply : message.body
  const plain = messagePlainText(replySource)
  const localFileOnly = messageIsOnlyLocalDeviceFile(plain)
  const html = plain && !localFileOnly && looksLikeHtml(replySource) ? sanitizeMessageHtml(replySource) : null
  const hasAttachments = message.attachments.length > 0
  const emptyShell = (!plain || localFileOnly) && !hasAttachments

  return (
    <div className="space-y-2">
      {parsedQuote.quote ? (
        <MessageQuoteCard
          senderName={parsedQuote.quote.senderName}
          excerpt={parsedQuote.quote.excerpt}
          mine={isMine}
          quotingSelf={quoteNamesMatch(parsedQuote.quote.senderName, viewerDisplayName())}
        />
      ) : null}
      {emptyShell && !parsedQuote.quote ? (
        <p
          className={cn(
            "text-xs italic leading-snug",
            isMine ? "text-white/90" : "text-slate-600 dark:text-slate-300",
          )}
        >
          {localFileOnly
            ? isMine
              ? "Photo didn't upload. Tap the photo button and choose the picture."
              : "Photo didn't upload. Ask them to tap the photo button and choose the picture."
            : isMine
              ? "Attachment missing — the photo or file may not have finished uploading. Open the + menu → Photo and send again."
              : "Attachment missing — ask them to resend using the + button → Photo."}
        </p>
      ) : null}
      {html ? (
        <div
          className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0.5 [&_a]:underline break-words"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : plain && !localFileOnly ? (
        <p className="whitespace-pre-wrap break-words">{plain}</p>
      ) : null}
      {hasAttachments && (
        <div className="flex flex-col gap-2 pt-0.5">
          {message.attachments.map((a) => (
            <MessageAttachmentView key={a.id} attachment={a} isMine={message.isMine} />
          ))}
        </div>
      )}
    </div>
  )
}

export function MessagesInbox({
  portal,
}: MessagesInboxProps) {
  const uiTheme = getMessagesPortalTheme(portal)
  const isStudentDash = portal === "student" || portal === "guest"
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedThreadId = searchParams.get("thread")
    ? Number(searchParams.get("thread"))
    : null

  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [thread, setThread] = useState<ThreadDetail | null>(null)
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [mobileShowChat, setMobileShowChat] = useState(false)
  const [recipientQuery, setRecipientQuery] = useState("")
  const [recipientResults, setRecipientResults] = useState<MessageRecipient[]>([])
  const [searchingRecipients, setSearchingRecipients] = useState(false)
  const [selectedRecipient, setSelectedRecipient] = useState<MessageRecipient | null>(null)
  const [participantProfileOpen, setParticipantProfileOpen] = useState(false)
  const [replyQuote, setReplyQuote] = useState<(MessageQuote & { quotingSelf?: boolean }) | null>(null)
  const [composerFocusRequest, setComposerFocusRequest] = useState(0)
  const [threadBackground, setThreadBackground] = useState<MessageThreadBackground>({ kind: "default" })
  const [backgroundNotices, setBackgroundNotices] = useState<BackgroundNotice[]>([])
  const [newSubject, setNewSubject] = useState("")
  const [draftHtml, setDraftHtml] = useState("")
  const [draftAttachments, setDraftAttachments] = useState<MessageAttachmentDraft[]>([])
  const [sending, setSending] = useState(false)
  const [unsendingId, setUnsendingId] = useState<number | null>(null)
  const [reactingId, setReactingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [threadSearch, setThreadSearch] = useState("")
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [threadSort, setThreadSort] = useState<"newest" | "oldest" | "unread">("newest")
  const [sendOutbox, setSendOutbox] = useState<MessageSendOutboxEntry[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const basePath = useMemo(() => {
    switch (portal) {
      case "instructor":
        return "/faculty/dashboard/communication/messages"
      case "guest":
        return "/guest/messages"
      case "camp":
        return "/student/dashboard-v2/summer-camp/messages"
      default:
        return "/student/dashboard-v2/messages"
    }
  }, [portal])

  const authHeaders = useMemo(() => getMessageAuthHeaders(), [])

  const messageActor = useMemo(() => {
    const headers = authHeaders as Record<string, string>
    const studentId = headers["x-student-id"]?.trim()
    if (studentId) return { kind: "student" as const, id: Number(studentId) }
    const instructorId = headers["x-instructor-id"]?.trim()
    if (instructorId && /^\d+$/.test(instructorId)) {
      return { kind: "instructor" as const, id: Number(instructorId) }
    }
    return null
  }, [authHeaders])

  const presenceParticipants = useMemo(() => {
    const list: Array<{ kind: ParticipantKind; id: number }> = []
    for (const t of threads) {
      list.push({ kind: t.otherParticipant.kind, id: t.otherParticipant.id })
    }
    if (thread) {
      list.push({ kind: thread.otherParticipant.kind, id: thread.otherParticipant.id })
      for (const m of thread.messages) {
        if (!m.isMine) list.push({ kind: m.senderKind, id: Number(m.senderId) })
      }
    }
    if (selectedRecipient) {
      list.push({ kind: selectedRecipient.kind, id: selectedRecipient.id })
    }
    return list
  }, [threads, thread, selectedRecipient])

  const { getStatus, getLastSeenAt, getManualStatus } = usePresenceTracking(presenceParticipants)

  const drawerParticipant = thread?.otherParticipant ?? selectedRecipient ?? null

  const chatRows = useMemo(() => {
    if (!thread) return []
    const rows: Array<
      | { kind: "message"; key: string; at: number; message: ThreadMessage }
      | { kind: "notice"; key: string; at: number; text: string }
    > = thread.messages.map((message) => ({
      kind: "message" as const,
      key: `m-${message.id}`,
      at: Date.parse(message.createdAt) || 0,
      message,
    }))
    for (const notice of backgroundNotices) {
      rows.push({
        kind: "notice",
        key: notice.id,
        at: Date.parse(notice.at) || 0,
        text: notice.text,
      })
    }
    rows.sort((a, b) => a.at - b.at)
    return rows
  }, [thread, backgroundNotices])

  const resetDraft = () => {
    setDraftHtml("")
    setDraftAttachments([])
    setReplyQuote(null)
  }

  const beginQuotedReply = useCallback((message: ThreadMessage) => {
    if (message.unsent) return
    const viewer = viewerDisplayName()
    setReplyQuote({
      senderName: message.senderName,
      excerpt: quoteExcerptFromBody(message.body) || "Attachment",
      quotingSelf: message.isMine || quoteNamesMatch(message.senderName, viewer),
    })
    setComposerFocusRequest((request) => request + 1)
  }, [])

  const changeThreadBackground = useCallback((next: MessageThreadBackground) => {
    if (!selectedThreadId || !Number.isFinite(selectedThreadId)) return
    setThreadBackground((current) => {
      if (sameMessageBackground(current, next)) return current
      setBackgroundNotices((prev) => {
        const notices = [
          ...prev,
          {
            id: `bg-${Date.now()}`,
            at: new Date().toISOString(),
            text: backgroundChangeLine(viewerDisplayName(), next.kind === "default"),
          },
        ]
        writeMessageThreadAppearance(selectedThreadId, { background: next, notices })
        return notices
      })
      return next
    })
  }, [selectedThreadId])

  useEffect(() => {
    setSendOutbox(listMessageSendOutbox())
  }, [])

  function rememberFailedSend(entry: Omit<MessageSendOutboxEntry, "id" | "createdAt">) {
    saveMessageSendOutbox(entry)
    setSendOutbox(listMessageSendOutbox())
  }

  async function retryOutboxEntry(entry: MessageSendOutboxEntry) {
    setSending(true)
    setError(null)
    try {
      const url =
        entry.sendUrl ||
        (entry.threadId != null ? `/api/messages/threads/${entry.threadId}` : "/api/messages/threads")
      const payload =
        entry.threadId != null
          ? { body: entry.bodyHtml, attachments: entry.attachments }
          : {
              recipientKind: entry.recipientKind,
              recipientId: entry.recipientId,
              subject: entry.subject ?? null,
              body: entry.bodyHtml,
              attachments: entry.attachments,
            }
      const res = await messageApiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { thread?: ThreadDetail; threadId?: number; error?: string }
      if (!res.ok) throw new Error(data.error || "Send failed")
      clearMessageSendOutbox(entry.id)
      setSendOutbox(listMessageSendOutbox())
      resetDraft()
      await loadThreads()
      if (data.thread) setThread(data.thread)
      else if (data.threadId) openThread(data.threadId)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed")
    } finally {
      setSending(false)
    }
  }

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true)
    setError(null)
    try {
      const res = await messageApiFetch("/api/messages/threads")
      if (!res.ok) throw new Error("Could not load inbox")
      const data = (await res.json()) as { threads: ThreadSummary[] }
      setThreads(data.threads ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inbox")
    } finally {
      setLoadingThreads(false)
    }
  }, [authHeaders])

  const loadThread = useCallback(
    async (id: number) => {
      setLoadingThread(true)
      setError(null)
      try {
        const res = await messageApiFetch(`/api/messages/threads/${id}`)
        if (!res.ok) throw new Error("Could not load conversation")
        const data = (await res.json()) as { thread: ThreadDetail }
        setThread(data.thread)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load conversation")
      } finally {
        setLoadingThread(false)
      }
    },
    [authHeaders],
  )

  useEffect(() => {
    void loadThreads()
  }, [loadThreads])

  useEffect(() => {
    if (selectedThreadId && Number.isFinite(selectedThreadId)) {
      void loadThread(selectedThreadId)
      setComposeOpen(false)
      setMobileShowChat(true)
    } else {
      setThread(null)
      setMobileShowChat(false)
    }
  }, [selectedThreadId, loadThread])

  useEffect(() => {
    setParticipantProfileOpen(false)
    setReplyQuote(null)
    if (!selectedThreadId || !Number.isFinite(selectedThreadId)) {
      setThreadBackground({ kind: "default" })
      setBackgroundNotices([])
      return
    }
    const appearance = readMessageThreadAppearance(selectedThreadId)
    setThreadBackground(appearance.background)
    setBackgroundNotices(appearance.notices)
  }, [selectedThreadId, selectedRecipient?.id, selectedRecipient?.kind, thread?.otherParticipant.id, thread?.otherParticipant.kind])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [thread?.messages.length, loadingThread])

  useEffect(() => {
    if (!composeOpen) return
    const q = recipientQuery.trim()
    if (q.length < 2) {
      setRecipientResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchingRecipients(true)
      try {
        const res = await messageApiFetch(`/api/messages/recipients?q=${encodeURIComponent(q)}`)
        if (res.ok) {
          const data = (await res.json()) as { recipients: MessageRecipient[] }
          setRecipientResults(data.recipients ?? [])
        }
      } finally {
        setSearchingRecipients(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [recipientQuery, composeOpen, authHeaders])

  function openThread(id: number) {
    router.push(`${basePath}?thread=${id}`)
  }

  async function handleSendNew() {
    if (!selectedRecipient || isComposerEmpty(draftHtml, draftAttachments)) return
    const ready = attachmentsReadyForSend(draftAttachments)
    if (draftAttachments.length > 0 && ready.length === 0) {
      setError("Attachments are still uploading or failed — wait for the checkmark or remove them before sending.")
      return
    }
    setSending(true)
    setError(null)
    try {
      const res = await messageApiFetch("/api/messages/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientKind: selectedRecipient.kind,
          recipientId: selectedRecipient.id,
          subject: newSubject.trim() || null,
          body: draftHtml,
          attachments: attachmentsReadyForSend(draftAttachments),
        }),
      })
      const data = (await res.json()) as { threadId?: number; error?: string }
      if (!res.ok) throw new Error(data.error || "Send failed")
      resetDraft()
      setNewSubject("")
      setComposeOpen(false)
      setSelectedRecipient(null)
      setRecipientQuery("")
      await loadThreads()
      if (data.threadId) openThread(data.threadId)
    } catch (e) {
      rememberFailedSend({
        threadId: null,
        recipientKind: selectedRecipient.kind,
        recipientId: selectedRecipient.id,
        subject: newSubject.trim() || null,
        bodyHtml: draftHtml,
        attachments: attachmentsReadyForSend(draftAttachments),
        sendUrl: "/api/messages/threads",
      })
      setError(
        (e instanceof Error ? e.message : "Send failed") +
          " Your draft was saved on this device — use Retry below when you're back online.",
      )
    } finally {
      setSending(false)
    }
  }

  async function handleReact(messageId: number, emoji: string) {
    if (!thread) return
    setReactingId(messageId)
    setError(null)
    try {
      const res = await messageApiFetch(
        `/api/messages/threads/${thread.id}/messages/${messageId}/reactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        },
      )
      const data = (await res.json()) as {
        reactions?: MessageReactionGroup[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || "Reaction failed")
      setThread((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          messages: prev.messages.map((m) =>
            Number(m.id) === messageId ? { ...m, reactions: data.reactions ?? [] } : m,
          ),
        }
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reaction failed")
    } finally {
      setReactingId(null)
    }
  }

  async function handleReply() {
    if (!thread || isComposerEmpty(draftHtml, draftAttachments)) return
    const ready = attachmentsReadyForSend(draftAttachments)
    if (draftAttachments.length > 0 && ready.length === 0) {
      setError("Attachments are still uploading or failed — wait for the checkmark or remove them before sending.")
      return
    }
    const quotedPrefix = replyQuote
      ? buildQuotedReply(replyQuote.senderName ?? "Quoted message", replyQuote.excerpt)
      : ""
    const body = `${quotedPrefix}${draftHtml}`
    setSending(true)
    setError(null)
    try {
      const res = await messageApiFetch(`/api/messages/threads/${thread.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          attachments: attachmentsReadyForSend(draftAttachments),
        }),
      })
      const data = (await res.json()) as { thread?: ThreadDetail; error?: string }
      if (!res.ok) throw new Error(data.error || "Send failed")
      resetDraft()
      if (data.thread) setThread(data.thread)
      await loadThreads()
    } catch (e) {
      rememberFailedSend({
        threadId: thread.id,
        bodyHtml: body,
        attachments: attachmentsReadyForSend(draftAttachments),
        sendUrl: `/api/messages/threads/${thread.id}`,
      })
      setError(
        (e instanceof Error ? e.message : "Send failed") +
          " Your draft was saved on this device — use Retry below when you're back online.",
      )
    } finally {
      setSending(false)
    }
  }

  async function handleUnsend(messageId: number) {
    if (!thread) return
    setUnsendingId(messageId)
    setError(null)
    try {
      const res = await messageApiFetch(
        `/api/messages/threads/${thread.id}/messages/${messageId}?mode=unsend`,
        { method: "DELETE" },
      )
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Could not undo send")
      setThread((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          messages: prev.messages.map((m) =>
            Number(m.id) === messageId
              ? {
                  ...m,
                  body: "",
                  unsent: true,
                  unsentByMe: true,
                  canUnsend: false,
                  canEdit: false,
                  attachments: [],
                }
              : m,
          ),
        }
      })
      await loadThreads()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not undo send")
    } finally {
      setUnsendingId(null)
    }
  }

  const showListPanel = !mobileShowChat || composeOpen
  const showChatPanel = mobileShowChat || composeOpen

  const filteredThreads = useMemo(() => {
    let list = [...threads]
    if (unreadOnly) {
      list = list.filter((t) => t.unreadCount > 0)
    }
    const q = threadSearch.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (t) =>
          t.otherParticipant.displayName.toLowerCase().includes(q) ||
          (t.subject?.toLowerCase().includes(q) ?? false) ||
          (t.lastMessage?.body.toLowerCase().includes(q) ?? false),
      )
    }
    list.sort((a, b) => {
      if (threadSort === "unread") {
        if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount
      }
      const aTime = new Date(a.lastMessage?.createdAt ?? a.updatedAt).getTime()
      const bTime = new Date(b.lastMessage?.createdAt ?? b.updatedAt).getTime()
      return threadSort === "oldest" ? aTime - bTime : bTime - aTime
    })
    return list
  }, [threads, threadSearch, unreadOnly, threadSort])

  const openCompose = () => {
    setComposeOpen(true)
    setSelectedRecipient(null)
    setRecipientQuery("")
    setNewSubject("")
    resetDraft()
    setMobileShowChat(true)
    router.push(basePath)
  }

  const inboxToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 basis-[min(100%,14rem)]">
        <Search
          className={cn(
            "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
            isStudentDash ? "text-[var(--cc-text-muted)]" : "text-slate-400",
          )}
        />
        <Input
          value={threadSearch}
          onChange={(e) => setThreadSearch(e.target.value)}
          placeholder="Search conversations..."
          className={cn(
            "h-10 rounded-full pl-9 pr-9 shadow-none focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]/30",
            isStudentDash
              ? "border border-[var(--border)] bg-[var(--muted)]/40"
              : "border-0 bg-slate-100 dark:bg-slate-900",
          )}
        />
        {threadSearch && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setThreadSearch("")}
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full p-0"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full"
              aria-label="Sort conversations"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 sm:w-48">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={threadSort} onValueChange={(v) => setThreadSort(v as typeof threadSort)}>
              <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="oldest">Oldest first</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="unread">Unread first</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setUnreadOnly((v) => !v)}
          className={cn(
            "h-10 w-10 rounded-full",
            unreadOnly &&
              (isStudentDash
                ? "bg-[var(--cc-accent)] text-white hover:bg-[var(--cc-accent-hover)] hover:text-white"
                : cn(uiTheme.page.cta, "hover:opacity-90")),
          )}
          title="Unread only"
          aria-label="Unread only"
        >
          <CheckCircle2 className="h-4 w-4" />
        </Button>

        {(threadSearch || unreadOnly) && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setThreadSearch("")
              setUnreadOnly(false)
            }}
            className={cn(
              "h-10 w-10 rounded-full",
              isStudentDash ? "text-[var(--cc-accent-dark)]" : "text-slate-600",
            )}
            aria-label="Clear filters"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        <Button
          type="button"
          onClick={openCompose}
          className={cn(
            "h-10 rounded-full px-4",
            isStudentDash ? PORTAL_CTA : cn(uiTheme.page.cta, "shadow-md"),
          )}
        >
          <Plus className="h-4 w-4 mr-1.5" aria-hidden />
          New message
        </Button>
      </div>
    </div>
  )

  const inboxGrid = (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-[minmax(260px,320px)_1fr] flex-1 min-h-0",
        isStudentDash ? "gap-3 p-3 md:p-4 md:pt-0" : "gap-3 md:gap-4",
      )}
    >
        {/* Thread list */}
        <aside
          className={cn(
            "overflow-hidden flex flex-col min-h-[240px]",
            isStudentDash
              ? "rounded-xl bg-[var(--muted)]/30"
              : "rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white/90 dark:bg-slate-950/40 backdrop-blur-sm shadow-sm",
            !showListPanel && "hidden md:flex",
          )}
        >
          {!isStudentDash ? (
            <div className="px-4 py-3 border-b border-slate-200/80 dark:border-white/10 flex items-center gap-2 shrink-0">
              <MessageCircle className={cn("h-4 w-4", uiTheme.page.iconText)} />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Conversations
                {filteredThreads.length !== threads.length ? (
                  <span className="ml-1.5 font-normal text-slate-500">({filteredThreads.length})</span>
                ) : null}
              </span>
            </div>
          ) : null}
          <div className="overflow-y-auto flex-1 p-2">
            {loadingThreads ? (
              <div className="p-8 flex justify-center text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : threads.length === 0 ? (
              <p
                className={cn(
                  "p-5 text-sm",
                  isStudentDash ? "text-[var(--cc-text-muted)]" : "text-slate-500 dark:text-slate-400",
                )}
              >
                No conversations yet. Message an instructor or classmate to get started.
              </p>
            ) : filteredThreads.length === 0 ? (
              <p className="p-5 text-sm text-[var(--cc-text-muted)]">No conversations match your search.</p>
            ) : (
              <ul className="space-y-1">
                {filteredThreads.map((t) => {
                  const selected = selectedThreadId === t.id
                  const lastFromMe =
                    Boolean(messageActor) &&
                    Boolean(t.lastMessage) &&
                    t.lastMessage!.senderKind === messageActor!.kind &&
                    Number(t.lastMessage!.senderId) === messageActor!.id

                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => openThread(t.id)}
                        className={cn(
                          "relative w-full text-left flex gap-3 px-2.5 py-2.5 rounded-xl transition-colors",
                          selected
                            ? isStudentDash
                              ? "bg-[var(--cc-accent-soft)]"
                              : "bg-slate-50 dark:bg-white/[0.06] shadow-sm"
                            : "hover:bg-[var(--muted)]/50 dark:hover:bg-white/[0.04]",
                        )}
                      >
                        {selected && !isStudentDash && (
                          <span
                            className={cn("absolute left-0 top-2 bottom-2 w-[3px] rounded-r", portalProgressFillClass(uiTheme))}
                            aria-hidden
                          />
                        )}
                        <PresenceAvatar
                          name={t.otherParticipant.displayName}
                          status={getStatus(t.otherParticipant.kind, t.otherParticipant.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={cn(
                                "text-sm truncate",
                                selected || t.unreadCount > 0
                                  ? "font-semibold text-slate-900 dark:text-slate-100"
                                  : "font-medium text-slate-800 dark:text-slate-200",
                              )}
                            >
                              {t.otherParticipant.displayName}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0 tabular-nums leading-5">
                              {formatWhen(t.lastMessage?.createdAt ?? t.updatedAt)}
                            </span>
                          </div>
                          {t.lastMessage ? (
                            <p
                              className={cn(
                                "text-xs mt-0.5 line-clamp-2",
                                t.unreadCount > 0 && !selected
                                  ? "text-slate-700 dark:text-slate-300 font-medium"
                                  : "text-slate-500 dark:text-slate-400",
                              )}
                            >
                              {lastFromMe ? "You: " : ""}
                              {messageIsOnlyLocalDeviceFile(messagePlainText(t.lastMessage.body))
                                ? "Photo didn't upload"
                                : messagePlainText(t.lastMessage.body)}
                            </p>
                          ) : (
                            <p className="text-xs mt-0.5 text-slate-400 italic">No messages yet</p>
                          )}
                        </div>
                        {t.unreadCount > 0 && (
                          <Badge className={cn("shrink-0 self-center text-white text-[10px] px-1.5 py-0 min-w-[1.25rem] justify-center", uiTheme.page.cta)}>
                            {t.unreadCount}
                          </Badge>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Chat panel */}
        <section
          className={cn(
            "relative flex flex-col min-h-[360px] overflow-hidden",
            isStudentDash
              ? "rounded-xl bg-[var(--muted)]/20"
              : "rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white/90 dark:bg-slate-950/40 backdrop-blur-sm shadow-sm",
            !showChatPanel && "hidden md:flex",
          )}
        >
          {thread && threadBackground.kind !== "default" ? (
            <MessageThreadBackdrop background={threadBackground} />
          ) : null}
          {composeOpen && !selectedThreadId ? (
            <div className="flex flex-col flex-1 min-h-0">
              <div
                className={cn(
                  "px-4 py-3 flex items-center gap-2",
                  isStudentDash ? "bg-[var(--muted)]/25" : "border-b border-slate-200/80 dark:border-white/10",
                )}
              >
                <button
                  type="button"
                  className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
                  onClick={() => {
                    setComposeOpen(false)
                    setMobileShowChat(false)
                  }}
                  aria-label="Back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">New message</h2>
              </div>
              <div className="p-4 sm:p-5 flex flex-col gap-4 flex-1 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">To</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={recipientQuery}
                      onChange={(e) => {
                        setRecipientQuery(e.target.value)
                        setSelectedRecipient(null)
                      }}
                      placeholder="Search instructor, student, or email"
                      className="pl-9 bg-white dark:bg-slate-900"
                    />
                  </div>
                  {searchingRecipients && (
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Searching…
                    </p>
                  )}
                  {recipientResults.length > 0 && !selectedRecipient && (
                    <ul className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden max-h-44 overflow-y-auto bg-white dark:bg-slate-900">
                      {recipientResults.map((r) => {
                        const blocked = r.messageable === false
                        const row = (
                          <>
                            <PresenceAvatar
                              name={r.displayName}
                              status={blocked ? "offline" : getStatus(r.kind, r.id)}
                              size="sm"
                            />
                            <span>
                              <span className="font-medium text-slate-900 dark:text-slate-100">{r.displayName}</span>
                              <span className="block text-xs text-slate-500">{r.subtitle}</span>
                            </span>
                          </>
                        )
                        return (
                          <li key={`${r.kind}-${r.id}`}>
                            {blocked ? (
                              <div
                                className="w-full text-left px-3 py-2.5 text-sm flex gap-3 items-center opacity-45 cursor-not-allowed bg-slate-50/80 dark:bg-white/[0.02]"
                                aria-disabled
                                title="Demo account — message your instructor instead"
                              >
                                {row}
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.04] text-sm flex gap-3 items-center"
                                onClick={() => {
                                  setSelectedRecipient(r)
                                  setRecipientQuery(r.displayName)
                                  setRecipientResults([])
                                }}
                              >
                                {row}
                              </button>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
                {selectedRecipient && (
                  <button
                    type="button"
                    onClick={() => setParticipantProfileOpen(true)}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] px-3 py-2.5 text-left hover:bg-slate-100/80 dark:hover:bg-white/[0.05] transition-colors"
                    aria-label="View profile and shared files"
                  >
                    <PresenceAvatar
                      name={selectedRecipient.displayName}
                      status={getStatus(selectedRecipient.kind, selectedRecipient.id)}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-slate-900 dark:text-slate-100 truncate">
                        {selectedRecipient.displayName}
                      </span>
                      <span className="block text-xs text-slate-500 truncate">{selectedRecipient.subtitle}</span>
                    </span>
                  </button>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Subject (optional)</label>
                  <Input
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="e.g. Question about Lab 2"
                    className="bg-white dark:bg-slate-900"
                  />
                </div>
                <MessageComposer
                  value={draftHtml}
                  onChange={setDraftHtml}
                  attachments={draftAttachments}
                  onAttachmentsChange={setDraftAttachments}
                  onSubmit={() => void handleSendNew()}
                  disabled={sending}
                  showSend
                  sending={sending}
                  sendDisabled={!selectedRecipient}
                />
                <div className="flex gap-2 justify-end pt-1">
                  <Button type="button" variant="outline" onClick={() => setComposeOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : loadingThread ? (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : thread ? (
            <>
              <header className="relative z-10 px-4 py-3 flex items-center gap-3 shrink-0 bg-[var(--muted)]/25 dark:bg-slate-900/40">
                <button
                  type="button"
                  className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
                  onClick={() => {
                    setMobileShowChat(false)
                    router.push(basePath)
                  }}
                  aria-label="Back to inbox"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setParticipantProfileOpen(true)}
                  className="rounded-full shrink-0 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                  aria-label={`Details for ${thread.otherParticipant.displayName}`}
                >
                  <PresenceAvatar
                    name={thread.otherParticipant.displayName}
                    status={getStatus(thread.otherParticipant.kind, thread.otherParticipant.id)}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setParticipantProfileOpen(true)}
                      className="min-w-0 truncate text-left font-semibold text-slate-900 hover:underline dark:text-slate-100"
                      aria-label={`Details for ${thread.otherParticipant.displayName}`}
                    >
                      {thread.otherParticipant.displayName}
                    </button>
                    <PresenceStatusPicker className="shrink-0 hidden sm:inline-flex" />
                  </div>
                  <RoleWithLastSeen
                    role={thread.otherParticipant.subtitle}
                    status={getStatus(thread.otherParticipant.kind, thread.otherParticipant.id)}
                    lastSeenAt={
                      getLastSeenAt(thread.otherParticipant.kind, thread.otherParticipant.id) ??
                      lastActiveFromThread(
                        thread,
                        thread.otherParticipant.kind,
                        thread.otherParticipant.id,
                      )
                    }
                    manualStatus={getManualStatus(thread.otherParticipant.kind, thread.otherParticipant.id)}
                  />
                  {thread.subject && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                      Re: {thread.subject}
                    </p>
                  )}
                </div>
              </header>

              <div className="px-4 pb-2 sm:hidden">
                <PresenceStatusPicker />
              </div>

              <div
                className={cn(
                  "relative z-10 flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-4",
                  threadBackground.kind === "default" &&
                    "bg-gradient-to-b from-slate-50/50 to-transparent dark:from-slate-900/30",
                )}
              >
                {chatRows.map((row) => row.kind === "notice" ? (
                  <p key={row.key} className="text-center text-xs text-slate-500 dark:text-slate-400">
                    {row.text}
                  </p>
                ) : (
                  <div
                    key={row.key}
                    className={cn(
                      "flex gap-2.5 max-w-[min(88%,42rem)] items-start",
                      row.message.isMine ? "ml-auto flex-row-reverse" : "mr-auto",
                    )}
                  >
                    {!row.message.isMine && (
                      <PresenceAvatar
                        name={row.message.senderName}
                        status={getStatus(row.message.senderKind, Number(row.message.senderId))}
                      />
                    )}
                    <div className={cn("min-w-0 flex-1", row.message.isMine && "flex flex-col items-end")}>
                      <div
                        className={cn(
                          "flex items-baseline gap-2 mb-1 leading-none",
                          row.message.isMine && "flex-row-reverse",
                        )}
                      >
                        {row.message.isMine ? (
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">You</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setParticipantProfileOpen(true)}
                            className="text-xs font-semibold text-slate-800 hover:underline dark:text-slate-100"
                            aria-label={`Details for ${row.message.senderName}`}
                          >
                            {row.message.senderName}
                          </button>
                        )}
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {formatWhen(row.message.createdAt)}
                        </span>
                      </div>

                      <MessageReactionBar
                        messageId={row.message.id}
                        reactions={row.message.reactions}
                        isMine={row.message.isMine}
                        onReact={handleReact}
                        reacting={reactingId === row.message.id}
                      >
                        <div
                          className={cn(
                            "rounded-lg px-3 py-2 text-sm max-w-full",
                            row.message.isMine
                              ? cn(uiTheme.page.cta)
                              : "bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 border border-slate-200/70 dark:border-white/10",
                          )}
                        >
                          <MessageBody message={row.message} isMine={row.message.isMine} />
                        </div>
                      </MessageReactionBar>
                      <div className={cn("mt-1 flex items-center gap-3", row.message.isMine && "flex-row-reverse")}>
                        {!row.message.unsent ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                            onClick={() => beginQuotedReply(row.message)}
                          >
                            <Reply className="h-3 w-3" />
                            Reply
                          </button>
                        ) : null}
                        {row.message.canUnsend ? (
                          <button
                            type="button"
                            className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                            onClick={() => void handleUnsend(Number(row.message.id))}
                            disabled={unsendingId === Number(row.message.id)}
                          >
                            {unsendingId === Number(row.message.id) ? "Undoing…" : "Undo send"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <footer className="relative z-10 px-3 sm:px-4 py-3 sm:py-4 bg-[var(--muted)]/25 dark:bg-slate-950/70 shrink-0 backdrop-blur-sm">
                <MessageComposer
                  value={draftHtml}
                  onChange={setDraftHtml}
                  attachments={draftAttachments}
                  onAttachmentsChange={setDraftAttachments}
                  onSubmit={() => void handleReply()}
                  disabled={sending}
                  compact
                  showSend
                  sending={sending}
                  placeholder="Write a reply…"
                  minHeight={24}
                  replyQuote={replyQuote}
                  onDismissReplyQuote={() => setReplyQuote(null)}
                  focusRequest={composerFocusRequest}
                />
              </footer>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 dark:text-slate-400">
              <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center mb-4", uiTheme.page.iconBg)}>
                <Mail className={cn("h-7 w-7 opacity-80", uiTheme.page.iconText)} />
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Your inbox is ready</p>
              <p className="text-xs mt-1 max-w-xs">Pick a conversation or start a new message to an instructor.</p>
            </div>
          )}
        </section>
      </div>
  )

  return (
    <MessagesThemeProvider theme={uiTheme}>
    <div className="flex flex-col h-[min(78vh,780px)] min-h-[520px] w-full min-w-0">
      {sendOutbox.length > 0 && (
        <div className="shrink-0 mb-4 space-y-2">
          {sendOutbox.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
            >
              <span className="min-w-0">
                Unsent message saved on this device
                {entry.attachments.length > 0
                  ? ` (${entry.attachments.length} attachment${entry.attachments.length === 1 ? "" : "s"})`
                  : ""}
                .
              </span>
              <div className="flex gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={sending}
                  onClick={() => void retryOutboxEntry(entry)}
                >
                  Retry send
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => {
                    clearMessageSendOutbox(entry.id)
                    setSendOutbox(listMessageSendOutbox())
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 shrink-0 mb-4">
          {error}
        </p>
      )}

      {isStudentDash ? (
        <section className="flex flex-col flex-1 min-h-0 rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="shrink-0 p-4 sm:p-5">{inboxToolbar}</div>
          {inboxGrid}
        </section>
      ) : (
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          <div className="shrink-0">{inboxToolbar}</div>
          {inboxGrid}
        </div>
      )}

      <MessageParticipantDrawer
        open={participantProfileOpen && drawerParticipant != null}
        onOpenChange={setParticipantProfileOpen}
        participant={drawerParticipant}
        messages={thread?.messages ?? []}
        threadId={thread?.id ?? null}
        background={threadBackground}
        onBackgroundChange={changeThreadBackground}
        presenceStatus={
          drawerParticipant ? getStatus(drawerParticipant.kind, drawerParticipant.id) : undefined
        }
        lastSeenAt={
          drawerParticipant
            ? getLastSeenAt(drawerParticipant.kind, drawerParticipant.id) ??
              (thread
                ? lastActiveFromThread(thread, drawerParticipant.kind, drawerParticipant.id)
                : null)
            : null
        }
        manualStatus={
          drawerParticipant ? getManualStatus(drawerParticipant.kind, drawerParticipant.id) : null
        }
      />
    </div>
    </MessagesThemeProvider>
  )
}
