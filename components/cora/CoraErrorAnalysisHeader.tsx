"use client"

import { Bug } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  line?: string
  theme?: "light" | "dark"
  className?: string
}

/** Compact single-row header for compiler / suggest-fix replies. */
export function CoraErrorAnalysisHeader({ line, theme = "dark", className }: Props) {
  const isLight = theme === "light"

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 border-b px-3 py-2",
        isLight ? "border-neutral-200/90 bg-neutral-50" : "border-white/10 bg-white/[0.04]",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          isLight ? "bg-rose-100 text-rose-600" : "bg-rose-500/15 text-rose-300",
        )}
      >
        <Bug className="h-3.5 w-3.5" aria-hidden />
      </span>
      <p
        className={cn(
          "min-w-0 flex-1 truncate text-[13px] font-semibold leading-none tracking-tight",
          isLight ? "text-neutral-900" : "text-neutral-100",
        )}
      >
        Compiler error
        {line ? (
          <>
            <span className={cn("mx-1.5 font-normal", isLight ? "text-neutral-400" : "text-neutral-500")}>·</span>
            <span className={isLight ? "text-rose-700" : "text-rose-300"}>Line {line}</span>
          </>
        ) : null}
      </p>
    </div>
  )
}
