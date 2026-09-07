"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles } from "lucide-react"
import { getStudentData } from "@/lib/auth"
import { CoraChatBubble } from "@/components/cora/CoraChatBubble"
import { CoraChatInput } from "@/components/cora/CoraChatInput"
import { CoraLogo } from "@/components/cora/CoraLogo"
import { GuestUpgradePrompt } from "@/components/guest/GuestUpgradePrompt"
import {
  GUEST_CORA_CHAT_MODES,
  GUEST_CORA_CHAT_PLACEHOLDER,
} from "@/lib/cora/constants"
import {
  GUEST_CAREER_PLUS_MENU_ITEMS,
  GUEST_CAREER_PLUS_MENU_LABEL,
  guestPlusMenuTarget,
} from "@/lib/cora/guest-plus-menu"
import { portalCard } from "@/lib/appearance/portal-shell-theme"
import { cn } from "@/lib/utils"

type Message = { role: "user" | "assistant"; content: string }

type Props = {
  hasCareer: boolean
  credits: number | null
  requestId?: number | null
  placeholder?: string
  className?: string
}

export function GuestCoraChatPanel({
  hasCareer,
  credits,
  requestId,
  placeholder = GUEST_CORA_CHAT_PLACEHOLDER,
  className,
}: Props) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [chatMode, setChatMode] = useState(GUEST_CORA_CHAT_MODES[0]!.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [creditsLeft, setCreditsLeft] = useState<number | null>(credits)
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollDown = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    const d = getStudentData()
    if (!d?.databaseId) {
      setError("Sign in again to continue.")
      return
    }

    setError("")
    setShowUpgrade(false)
    setBusy(true)
    setInput("")
    const nextMessages: Message[] = [...messages, { role: "user", content: trimmed }]
    setMessages(nextMessages)

    try {
      const res = await fetch("/api/guest/cora/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          studentDatabaseId: d.databaseId,
          conversationHistory: messages,
          requestId: requestId ?? null,
        }),
      })
      const data = await res.json()
      if (res.status === 403 && data.code === "GUEST_CORA_UPGRADE") {
        setShowUpgrade(true)
        setError(data.error ?? "Cora Career required for this request.")
        setMessages(messages)
        return
      }
      if (res.status === 402) {
        setError(data.error ?? "Insufficient credits.")
        setMessages(messages)
        return
      }
      if (!res.ok) throw new Error(data.error || "Chat failed")

      if (typeof data.creditsRemaining === "number") setCreditsLeft(data.creditsRemaining)
      setMessages([...nextMessages, { role: "assistant", content: String(data.content ?? "") }])
      setTimeout(scrollDown, 50)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed")
      setMessages(messages)
    } finally {
      setBusy(false)
    }
  }

  const balance = creditsLeft ?? credits

  return (
    <div className={cn(portalCard, "flex flex-col overflow-hidden", className)}>
      <div className="flex items-center gap-2 border-b border-[var(--cc-border)] px-4 py-3">
        <CoraLogo className="size-6" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--cc-text)]">Cora Career Assistant</p>
          <p className="text-[10px] text-[var(--cc-text-muted)]">
            {hasCareer
              ? `${(balance ?? 0).toLocaleString()} credits · lifetime access`
              : "Basic recommendation brief help is free on your request pages"}
          </p>
        </div>
        {hasCareer ? (
          <Link href="/guest/cora-credits" className="text-[10px] font-medium text-violet-600 hover:underline">
            Add credits
          </Link>
        ) : null}
      </div>

      <div className="min-h-[280px] max-h-[420px] overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center text-sm text-[var(--cc-text-muted)]">
            <Sparkles className="mb-2 size-8 text-violet-500/70" aria-hidden />
            <p>Ask Cora to prepare a recommendation brief, review your résumé, or plan an interview.</p>
            {!hasCareer ? (
              <p className="mt-2 text-xs">Career tools unlock with Cora Career — brief help stays free.</p>
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
          <div className="flex items-center gap-2 py-3 text-sm text-[var(--cc-text-muted)]">
            <Loader2 className="size-4 animate-spin" /> Cora is thinking…
          </div>
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

      <div className="border-t border-[var(--cc-border)] p-3 sm:px-4 sm:pb-4 sm:pt-2">
        <CoraChatInput
          inputValue={input}
          onInputChange={setInput}
          onSend={(msg) => void send(msg)}
          modeOptions={[...GUEST_CORA_CHAT_MODES]}
          modeValue={chatMode}
          onModeChange={setChatMode}
          modeMenuLabel="What are you working on?"
          plusMenuVariant="attach"
          plusMenuItems={GUEST_CAREER_PLUS_MENU_ITEMS}
          plusMenuItemsLabel={GUEST_CAREER_PLUS_MENU_LABEL}
          onQuickAction={(actionId) => {
            const target = guestPlusMenuTarget(actionId)
            if (target) router.push(target)
          }}
          isLoading={busy}
          placeholder={placeholder}
          creditsLabel={
            hasCareer && balance != null ? `${balance.toLocaleString()} credits remaining` : null
          }
          creditsExhausted={hasCareer && balance === 0}
        />
      </div>
    </div>
  )
}
