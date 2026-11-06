"use client"

import { cn } from "@/lib/utils"

export function CoraFollowUps({
  prompts,
  disabled,
  onSelect,
  className,
}: {
  prompts: string[]
  disabled?: boolean
  onSelect: (prompt: string) => void
  className?: string
}) {
  if (prompts.length === 0) return null

  return (
    <div className={cn("mb-4 mt-3 flex flex-col items-start gap-2", className)}>
      {prompts.map((prompt) => (
        <button
          key={prompt}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(prompt)}
          className="max-w-full rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-left text-xs leading-snug text-[var(--cc-text)] hover:bg-[var(--muted)] disabled:opacity-50"
        >
          {prompt}
        </button>
      ))}
    </div>
  )
}
