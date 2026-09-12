"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { ArrowUp, Loader2 } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type Props = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  placeholder?: string
  isLoading?: boolean
  disabled?: boolean
  theme?: "light" | "dark"
  className?: string
  footer?: ReactNode
}

export function CodebenchCoraComposer({
  value,
  onChange,
  onSend,
  placeholder = "Ask about your code…",
  isLoading = false,
  disabled = false,
  theme = "dark",
  className,
  footer,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const isLight = theme === "light"
  const canSend = value.trim().length > 0 && !isLoading && !disabled

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`
  }, [value])

  const send = () => {
    if (canSend) onSend()
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border px-2.5 py-1.5",
          "shadow-[0_1px_8px_rgba(0,0,0,0.05)] transition-shadow focus-within:shadow-[0_2px_14px_rgba(0,0,0,0.08)]",
          isLight
            ? "border-neutral-200/80 bg-white"
            : "border-white/10 bg-[#1c1c22] shadow-[0_1px_12px_rgba(0,0,0,0.28)] focus-within:shadow-[0_2px_18px_rgba(0,0,0,0.38)]",
        )}
      >
        <Textarea
          ref={ref}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              send()
            }
          }}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          rows={1}
          title="Enter to send · Shift+Enter for new line"
          className={cn(
            "max-h-24 min-h-[32px] min-w-0 flex-1 resize-none border-0 bg-transparent py-1.5 pl-1 pr-0 text-sm leading-snug shadow-none focus-visible:ring-0",
            isLight
              ? "text-neutral-900 placeholder:text-neutral-400"
              : "text-neutral-100 placeholder:text-neutral-500",
          )}
        />
        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          aria-label="Send message"
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all",
            canSend
              ? isLight
                ? "bg-[color-mix(in_srgb,var(--cc-accent)_18%,#d3e3fd)] text-[var(--cc-accent-dark,var(--cc-accent))] hover:bg-[color-mix(in_srgb,var(--cc-accent)_24%,#d3e3fd)]"
                : "bg-[color-mix(in_srgb,var(--cc-accent)_32%,#1e293b)] text-white shadow-[0_0_0_1px_color-mix(in_srgb,var(--cc-accent)_35%,transparent)] hover:bg-[color-mix(in_srgb,var(--cc-accent)_42%,#1e293b)]"
              : isLight
                ? "bg-neutral-100 text-neutral-300"
                : "bg-white/[0.06] text-neutral-600",
          )}
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          )}
        </button>
      </div>
      {footer ? <div className="mt-2">{footer}</div> : null}
    </div>
  )
}
