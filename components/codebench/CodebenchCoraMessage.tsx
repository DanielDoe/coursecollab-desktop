"use client"

import { CoraBotMark } from "@/components/cora/CoraBotMark"
import { CoraWorkspaceChatMessage } from "@/components/cora/CoraWorkspaceChatMessage"
import { PseudocodeRenderer } from "@/components/codebench/PseudocodeRenderer"
import { cn } from "@/lib/utils"

type Props = {
  role: "user" | "assistant" | "system"
  content: string
  theme?: "light" | "dark"
  mode?: string
  timestamp?: Date
}

function isStructuredPseudocode(content: string, mode?: string) {
  return (
    mode === "pseudocode" &&
    (content.includes("Algorithm Overview") ||
      content.includes("Flow Diagram") ||
      content.includes("Structured Pseudocode") ||
      content.includes("Detailed Teaching Steps"))
  )
}

export function CodebenchCoraMessage({ role, content, theme = "dark", mode, timestamp }: Props) {
  if (role === "system") {
    return (
      <p className={cn("text-center text-xs", theme === "light" ? "text-slate-500" : "text-slate-400")}>
        {content}
      </p>
    )
  }

  if (role === "assistant" && isStructuredPseudocode(content, mode)) {
    return (
      <div className="flex w-full min-w-0 gap-3">
        <CoraBotMark size="sm" idle className="shrink-0" />
        <div className="min-w-0 flex-1">
          <PseudocodeRenderer content={content} />
          {timestamp ? (
            <p className={cn("mt-2 pl-0 text-xs", theme === "light" ? "text-slate-500" : "text-slate-400")}>
              {timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0">
      <CoraWorkspaceChatMessage
        role={role}
        content={content}
        theme={theme}
        tone={role === "assistant" && mode === "debug" ? "error-analysis" : "default"}
      />
      {timestamp ? (
        <p
          className={cn(
            "mt-1.5 text-xs",
            role === "user" ? "text-right" : "pl-11",
            theme === "light" ? "text-slate-500" : "text-slate-400",
          )}
        >
          {timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      ) : null}
    </div>
  )
}
