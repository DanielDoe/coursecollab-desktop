"use client"

import { CoraBotMark } from "@/components/cora/CoraBotMark"
import { CoraRichReply } from "@/components/cora/CoraRichReply"
import { cn } from "@/lib/utils"

type Props = {
  role: "user" | "assistant"
  content: string
  theme?: "light" | "dark"
  tone?: "error-analysis" | "default"
  className?: string
}

export function CoraWorkspaceChatMessage({ role, content, theme = "dark", tone = "default", className }: Props) {
  const isLight = theme === "light"

  if (role === "user") {
    return (
      <div className={cn("flex justify-end", className)}>
        <div
          className={cn(
            "max-w-[min(92%,420px)] rounded-[20px] px-4 py-2.5 text-sm leading-relaxed",
            isLight ? "bg-neutral-100 text-neutral-900" : "bg-white/[0.08] text-neutral-100",
          )}
        >
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex gap-3", className)}>
      <div className="relative shrink-0 pt-0.5">
        <CoraBotMark size="sm" idle />
      </div>
      <div className="min-w-0 flex-1">
        <CoraRichReply content={content} theme={theme} tone={tone} />
      </div>
    </div>
  )
}
