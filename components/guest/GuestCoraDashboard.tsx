"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Briefcase,
  FileText,
  Loader2,
  Mail,
  Maximize2,
  MessageSquare,
  Minimize2,
  Plus,
  ScanSearch,
  Sparkles,
  Target,
  Trash2,
  Zap,
} from "lucide-react"
import { getStudentData } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { CoraChatBubble } from "@/components/cora/CoraChatBubble"
import { CoraChatInput } from "@/components/cora/CoraChatInput"
import { CoraThinkingIndicator } from "@/components/cora/CoraThinkingIndicator"
import { CoraBrandInline } from "@/components/cora/CoraLogo"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { GuestUpgradePrompt } from "@/components/guest/GuestUpgradePrompt"
import { useGuestDashboard } from "@/components/guest/dashboard/GuestDashboardContext"
import {
  createGuestCoraConversation,
  deleteGuestCoraConversation,
  getGuestCoraConversation,
  listGuestCoraConversations,
  saveGuestCoraConversation,
  updateGuestCoraThreadMemory,
  type GuestCoraConversation,
} from "@/lib/guest/cora-conversation-storage"
import { clearGuestCoraContext } from "@/lib/cora/guest-cora-context-store"
import { GuestResumeOnboardingBanner } from "@/components/guest/career/GuestResumeOnboardingBanner"
import { GUEST_CORA_NAV_LABEL, GUEST_CORA_PLATFORM_SUBTITLE, GUEST_CORA_CHAT_MODES, GUEST_CORA_CHAT_PLACEHOLDER } from "@/lib/cora/constants"
import { GUEST_CORA_SETUP_STEPS } from "@/lib/cora/guest-cora-context"
import { useGuestCoraContext } from "@/hooks/use-guest-cora-context"
import {
  GUEST_CAREER_PLUS_MENU_ITEMS,
  GUEST_CAREER_PLUS_MENU_LABEL,
  guestPlusMenuTarget,
} from "@/lib/cora/guest-plus-menu"
import type { GuestCapability } from "@/lib/guest/types"
import { cn } from "@/lib/utils"

const QUICK_PROMPTS: Array<{
  id: string
  label: string
  icon: typeof Sparkles
  capability?: GuestCapability
  /** Open a dedicated career tool page */
  href?: string
  /** Send a message to Cora */
  prompt?: string
}> = [
  {
    id: "quick-scan",
    label: "Quick scan",
    href: "/guest/cora-career/quick-scan",
    icon: Zap,
  },
  {
    id: "match",
    label: "Résumé match",
    href: "/guest/cora-career/match",
    icon: ScanSearch,
  },
  {
    id: "cover-letter",
    label: "Cover letter",
    href: "/guest/cora-career/cover-letter",
    icon: Mail,
  },
  {
    id: "brief",
    label: "Recommendation brief",
    prompt: "Help me prepare a recommendation preparation brief for my faculty recommender.",
    icon: FileText,
    capability: "cora.generateRecommendationBrief",
  },
  {
    id: "interview",
    label: "Interview prep",
    prompt: "Help me prepare for an upcoming interview using my background and target role.",
    icon: MessageSquare,
    capability: "cora.prepareInterview",
  },
  {
    id: "applications",
    label: "Applications",
    href: "/guest/cora-career/applications",
    icon: Briefcase,
  },
  {
    id: "plan",
    label: "Application plan",
    prompt: "Build an application checklist and timeline for my next opportunity.",
    icon: Target,
    capability: "career.application",
  },
]

export function GuestCoraDashboard() {
  const router = useRouter()
  const { entitlements, refreshEntitlements, coraImmersive, setCoraImmersive } = useGuestDashboard()
  const guestData = getStudentData()
  const guestId = guestData?.databaseId ?? null
  const {
    status: contextStatus,
    setupStep,
    context: guestCoraContext,
    error: contextError,
    retrySetup,
    refreshContextIfStale,
  } = useGuestCoraContext({
    guestId,
    guestName: guestData?.name,
    enabled: Boolean(guestId),
  })
  const hasCareer = entitlements.plan === "cora_career"
  const capabilities = entitlements.capabilities

  const [threads, setThreads] = useState<GuestCoraConversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [chatMode, setChatMode] = useState(GUEST_CORA_CHAT_MODES[0]!.id)
  const handleModeChange = useCallback((modeId: string) => {
    if (modeId === "resume-match") {
      router.push("/guest/cora-career/match")
      return
    }
    if (modeId === "cover-letter") {
      router.push("/guest/cora-career/cover-letter")
      return
    }
    setChatMode(modeId)
  }, [router])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [showUpgrade, setShowUpgrade] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const active = activeId ? getGuestCoraConversation(activeId) : null
  const messages = active?.messages ?? []

  const reloadThreads = useCallback(() => {
    setThreads(listGuestCoraConversations())
  }, [])

  useEffect(() => {
    reloadThreads()
    const existing = listGuestCoraConversations()
    if (existing[0]) setActiveId(existing[0].id)
    else {
      const created = createGuestCoraConversation()
      setActiveId(created.id)
      reloadThreads()
    }
  }, [reloadThreads])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, busy])

  function startNewThread() {
    const conv = createGuestCoraConversation()
    reloadThreads()
    setActiveId(conv.id)
    setError("")
    setShowUpgrade(false)
  }

  function selectThread(id: string) {
    setActiveId(id)
    setError("")
    setShowUpgrade(false)
  }

  function removeThread(id: string) {
    deleteGuestCoraConversation(id)
    reloadThreads()
    if (activeId === id) {
      const next = listGuestCoraConversations()[0]
      if (next) setActiveId(next.id)
      else {
        const created = createGuestCoraConversation()
        setActiveId(created.id)
        reloadThreads()
      }
    }
  }

  async function sendMessage(textOverride?: string) {
    const text = (textOverride ?? input).trim()
    if (!text || busy || !activeId) return
    const d = getStudentData()
    if (!d?.databaseId) {
      setError("Sign in again to continue.")
      return
    }

    setError("")
    setShowUpgrade(false)
    setBusy(true)
    setInput("")

    const userMsg = { role: "user" as const, content: text }
    const prior = getGuestCoraConversation(activeId)
    const history = prior?.messages ?? []
    const title =
      prior?.title === "New conversation" && history.length === 0
        ? text.slice(0, 48) + (text.length > 48 ? "…" : "")
        : prior?.title ?? "Conversation"

    saveGuestCoraConversation({
      id: activeId,
      title,
      updatedAt: new Date().toISOString(),
      messages: [...history, userMsg],
    })
    reloadThreads()

    try {
      await refreshContextIfStale(true)
      const res = await fetch("/api/guest/cora/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          studentDatabaseId: d.databaseId,
          conversationHistory: history,
        }),
      })
      const data = await res.json()

      if (res.status === 403 && data.code === "GUEST_CORA_UPGRADE") {
        setShowUpgrade(true)
        setError(data.error ?? "Cora Career required.")
        return
      }
      if (res.status === 402) {
        setError(data.error ?? "Insufficient credits.")
        return
      }
      if (!res.ok) throw new Error(data.error || "Chat failed")

      const updated = getGuestCoraConversation(activeId)
      saveGuestCoraConversation({
        id: activeId,
        title,
        updatedAt: new Date().toISOString(),
        messages: [...(updated?.messages ?? [...history, userMsg]), { role: "assistant", content: String(data.content ?? "") }],
      })
      reloadThreads()
      void refreshContextIfStale(true)
      void refreshEntitlements()

      if (typeof data.contextSyncedAt === "string") {
        const d = getStudentData()
        if (d?.databaseId) clearGuestCoraContext(d.databaseId)
        void refreshContextIfStale(true)
      }
      updateGuestCoraThreadMemory(activeId, {
        lastUserTopic: text.slice(0, 160),
        summary: String(data.content ?? "").slice(0, 280),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-col",
        coraImmersive ? "h-[calc(100dvh-4rem)]" : "min-h-[560px]",
      )}
    >
      <div className="mb-4">
        <h1 className="flex items-baseline gap-1.5 text-xl font-semibold text-[var(--cc-text)] sm:text-2xl">
          <CoraBrandInline />
          <span>Career Copilot</span>
        </h1>
        <p className="mt-1 text-sm text-[var(--cc-text-muted)]">{GUEST_CORA_PLATFORM_SUBTITLE}</p>
      </div>

      <CardWrapper
        className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", coraImmersive && "border-0 shadow-none")}
      >
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="hidden w-56 shrink-0 border-r border-[var(--border)] bg-[var(--muted)]/30 lg:flex lg:flex-col">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">Threads</p>
              <Button type="button" variant="ghost" size="icon" className="size-8 rounded-lg" onClick={startNewThread}>
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {threads.map((t) => (
                <div key={t.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => selectThread(t.id)}
                    className={cn(
                      "flex-1 rounded-xl px-3 py-2 text-left text-xs transition-colors",
                      activeId === t.id
                        ? "bg-violet-500/15 text-violet-800 dark:text-violet-200"
                        : "hover:bg-[var(--sidebar-accent)] text-[var(--cc-text-secondary)]",
                    )}
                  >
                    <p className="truncate font-medium">{t.title}</p>
                  </button>
                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 p-1 text-[var(--cc-text-muted)] hover:text-red-600"
                    onClick={() => removeThread(t.id)}
                    aria-label="Delete thread"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </aside>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-[var(--border)] px-4 py-3 lg:hidden">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{GUEST_CORA_NAV_LABEL}</p>
                <Button type="button" variant="outline" size="sm" className="rounded-lg h-8" onClick={startNewThread}>
                  <Plus className="size-3.5 mr-1" /> New
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-violet-500/5 px-4 py-2 text-xs text-[var(--cc-text-muted)]">
              {!hasCareer ? (
                <p>
                  Basic recommendation brief help is free. Career tools unlock with{" "}
                  <Link href="/guest/cora-career/access" className="font-medium text-violet-600 hover:underline">
                    Cora Career
                  </Link>
                  .
                </p>
              ) : (
                <p>Cora Career active — all career tools unlocked.</p>
              )}
              <button
                type="button"
                onClick={() => setCoraImmersive(!coraImmersive)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 font-medium text-[var(--cc-text-secondary)] transition-colors hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300"
              >
                {coraImmersive ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
                {coraImmersive ? "Exit focus" : "Focus mode"}
              </button>
            </div>

            {!guestCoraContext?.payload.masterResume?.hasResume ? (
              <div className="border-b border-[var(--border)] px-4 py-3">
                <GuestResumeOnboardingBanner />
              </div>
            ) : null}

            {contextStatus === "running" ? (
              <div className="border-b border-[var(--border)] bg-[var(--muted)]/30 px-4 py-2 text-xs text-[var(--cc-text-muted)]">
                <Loader2 className="mr-1.5 inline size-3.5 animate-spin" />
                {GUEST_CORA_SETUP_STEPS.find((s) => s.id === setupStep)?.label ?? "Preparing Cora Career…"}
              </div>
            ) : null}
            {contextError ? (
              <div className="border-b border-[var(--border)] px-4 py-2 text-xs text-red-600">
                {contextError}{" "}
                <button type="button" className="underline" onClick={retrySetup}>
                  Retry
                </button>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 border-b border-[var(--border)] px-4 py-3">
              {QUICK_PROMPTS.map((action) => {
                const enabled =
                  !action.capability || capabilities.includes(action.capability)
                const Icon = action.icon
                const chipClass = cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  enabled
                    ? "border-[var(--border)] hover:border-violet-400 hover:bg-violet-500/5"
                    : "border-dashed opacity-70",
                )

                if (action.href) {
                  if (!enabled && !hasCareer) {
                    return (
                      <button
                        key={action.id}
                        type="button"
                        disabled={busy}
                        onClick={() => setShowUpgrade(true)}
                        className={chipClass}
                      >
                        <Icon className="size-3.5 text-violet-600" />
                        {action.label}
                      </button>
                    )
                  }
                  return (
                    <Link key={action.id} href={action.href} className={chipClass}>
                      <Icon className="size-3.5 text-violet-600" />
                      {action.label}
                    </Link>
                  )
                }

                return (
                  <button
                    key={action.id}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (!enabled && !hasCareer) {
                        setShowUpgrade(true)
                        return
                      }
                      if (action.prompt) void sendMessage(action.prompt)
                    }}
                    className={chipClass}
                  >
                    <Icon className="size-3.5 text-violet-600" />
                    {action.label}
                  </button>
                )
              })}
            </div>

            <div className="min-h-[320px] flex-1 overflow-y-auto px-4 py-4">
              {messages.length === 0 ? (
                <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center text-sm text-[var(--cc-text-muted)]">
                  <Sparkles className="mb-2 size-8 text-violet-500/70" />
                  <p>Ask {GUEST_CORA_NAV_LABEL} — or use Résumé match and Cover letter above.</p>
                  {guestCoraContext?.focusLabel ? (
                    <p className="mt-2 text-xs">Current focus: {guestCoraContext.focusLabel}</p>
                  ) : null}
                </div>
              ) : (
                messages.map((m, i) => (
                  <CoraChatBubble key={i} role={m.role === "user" ? "student" : "ai"}>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
                  </CoraChatBubble>
                ))
              )}
              {busy ? (
                <CoraThinkingIndicator mode="general" theme="light" compact className="my-2 max-w-md" />
              ) : null}
              <div ref={bottomRef} />
            </div>

            {error ? <p className="px-4 pb-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
            {showUpgrade ? (
              <div className="px-4 pb-3">
                <GuestUpgradePrompt
                  title="Unlock Cora Career"
                  description="Full career AI — résumé review, interview prep, statements, and application planning."
                  onDismiss={() => setShowUpgrade(false)}
                />
              </div>
            ) : null}

            <div className="border-t border-[var(--border)] p-3 sm:px-4 sm:pb-4 sm:pt-2">
              <CoraChatInput
                inputValue={input}
                onInputChange={setInput}
                onSend={(msg) => void sendMessage(msg)}
                modeOptions={[...GUEST_CORA_CHAT_MODES]}
                modeValue={chatMode}
                onModeChange={handleModeChange}
                modeMenuLabel="What are you working on?"
                plusMenuVariant="attach"
                plusMenuItems={GUEST_CAREER_PLUS_MENU_ITEMS}
                plusMenuItemsLabel={GUEST_CAREER_PLUS_MENU_LABEL}
                onQuickAction={(actionId) => {
                  const target = guestPlusMenuTarget(actionId)
                  if (target) router.push(target)
                }}
                isLoading={busy}
                placeholder={GUEST_CORA_CHAT_PLACEHOLDER}
                creditsLabel={
                  hasCareer && entitlements.credits != null
                    ? `${entitlements.credits.toLocaleString()} credits remaining`
                    : null
                }
                creditsExhausted={hasCareer && entitlements.credits === 0}
              />
            </div>
          </div>
        </div>
      </CardWrapper>
    </div>
  )
}
