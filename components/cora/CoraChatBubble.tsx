"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import {
  CORA_CHAT_PALETTE_DARK,
  CORA_CHAT_PALETTE_LIGHT,
  type CoraChatBubblePalette,
} from "@/lib/cora/chat-bubble-theme"

type Props = {
  role: "student" | "ai"
  children: ReactNode
  className?: string
  footer?: ReactNode
  palette?: CoraChatBubblePalette
  isDark?: boolean
}

export function CoraChatBubble({
  role,
  children,
  className,
  footer,
  palette,
  isDark = false,
}: Props) {
  const colors = palette ?? (isDark ? CORA_CHAT_PALETTE_DARK : CORA_CHAT_PALETTE_LIGHT)
  const isUser = role === "student"
  const set = isUser ? colors.user : colors.assistant

  return (
    <div className={cn("group mb-8", isUser ? "flex justify-end" : "block", className)}>
      <div
        className={cn(
          "max-w-[min(92%,560px)]",
          isUser ? "ml-auto" : "mr-auto w-full max-w-none",
        )}
      >
        <div
          className={cn(
            "text-[15px] leading-[1.7]",
            isUser && "whitespace-pre-wrap px-5 py-3",
            !isUser && "[&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-semibold",
          )}
          style={{
            background: set.background,
            color: set.text,
            borderRadius: isUser ? colors.userRadius : colors.assistantRadius,
            border:
              set.border && set.border !== "transparent" ? `1px solid ${set.border}` : undefined,
          }}
        >
          {children}
        </div>
        {footer ? <div className="mt-2">{footer}</div> : null}
      </div>
    </div>
  )
}
