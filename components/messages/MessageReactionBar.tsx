"use client"

import { useState, type ReactNode } from "react"
import { Plus, Smile } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useMessagesTheme } from "@/components/messages/messages-theme-context"
import { portalSelectedOutlineClass } from "@/lib/portal-module-themes"
import { DM_MORE_REACTIONS, DM_QUICK_REACTIONS } from "@/lib/direct-messages/reaction-constants"
import type { MessageReactionGroup } from "@/lib/direct-messages/types"

type MessageReactionBarProps = {
  messageId: number
  reactions: MessageReactionGroup[]
  isMine: boolean
  onReact: (messageId: number, emoji: string) => Promise<void>
  reacting?: boolean
  children: ReactNode
}

function ReactionChip({
  group,
  onClick,
  isMine,
}: {
  group: MessageReactionGroup
  onClick: () => void
  isMine: boolean
}) {
  const theme = useMessagesTheme()
  return (
    <button
      type="button"
      onClick={onClick}
      title={group.reactedByMe ? "Remove reaction" : "React"}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs border transition-colors shrink-0",
        group.reactedByMe
          ? portalSelectedOutlineClass(theme)
          : "bg-white dark:bg-slate-800 border-slate-200/90 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700",
        isMine && !group.reactedByMe && "shadow-sm",
      )}
    >
      <span className="text-sm leading-none">{group.emoji}</span>
      <span className="font-medium tabular-nums">{group.count}</span>
    </button>
  )
}

export function MessageReactionBar({
  messageId,
  reactions,
  isMine,
  onReact,
  reacting,
  children,
}: MessageReactionBarProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  async function pick(emoji: string) {
    setMoreOpen(false)
    setMobileOpen(false)
    await onReact(messageId, emoji)
  }

  const hoverBar = (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-full border px-1 py-0.5 shadow-lg",
        "bg-white dark:bg-slate-900",
        "border-slate-200/90 dark:border-slate-700/80",
        "opacity-0 pointer-events-none translate-y-1",
        "group-hover/message:opacity-100 group-hover/message:pointer-events-auto group-hover/message:translate-y-0",
        "group-focus-within/message:opacity-100 group-focus-within/message:pointer-events-auto group-focus-within/message:translate-y-0",
        mobileOpen && "opacity-100 pointer-events-auto translate-y-0",
        "transition-all duration-150",
      )}
    >
      {DM_QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          disabled={reacting}
          aria-label={`React with ${emoji}`}
          onClick={() => void pick(emoji)}
          className="h-8 w-8 rounded-full text-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95 disabled:opacity-50"
        >
          {emoji}
        </button>
      ))}
      <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" aria-hidden />
      <Popover open={moreOpen} onOpenChange={setMoreOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="More reactions"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span className="relative inline-flex">
              <Smile className="h-4 w-4" />
              <Plus className="h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5 rounded-full bg-white dark:bg-slate-900" strokeWidth={3} />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="top"
          sideOffset={8}
          className={cn(
            "w-auto p-2 rounded-2xl shadow-xl z-[60]",
            "bg-white dark:bg-slate-900",
            "border border-slate-200 dark:border-slate-700/80",
          )}
        >
          <div className="flex flex-wrap gap-1 max-w-[12rem]">
            {DM_MORE_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="h-9 w-9 rounded-lg text-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => void pick(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )

  return (
    <div
      className={cn(
        "group/message relative max-w-full flex flex-col",
        isMine ? "items-end" : "items-start",
      )}
    >
      <div className="absolute z-20 right-0 -top-4">{hoverBar}</div>

      <div className="relative min-w-0 max-w-full z-[1]">
        <button
          type="button"
          className="md:hidden absolute inset-0 z-[5] rounded-lg"
          aria-label="Show reactions"
          onClick={() => setMobileOpen((v) => !v)}
        />
        {children}
      </div>

      {reactions.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap gap-1 -mt-2.5 relative z-[2] px-0.5",
            isMine ? "justify-end" : "justify-start",
          )}
        >
          {reactions.map((group) => (
            <ReactionChip
              key={group.emoji}
              group={group}
              isMine={isMine}
              onClick={() => void pick(group.emoji)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
