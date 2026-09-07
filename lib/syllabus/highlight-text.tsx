"use client"

import { Fragment, type ReactNode } from "react"
import { cn } from "@/lib/utils"

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function highlightMatch(text: string, query?: string, className?: string): ReactNode {
  if (!text) return text
  const q = query?.trim()
  if (!q) return text

  const regex = new RegExp(`(${escapeRegex(q)})`, "gi")
  const parts = text.split(regex)

  return parts.map((part, index) => {
    if (part.toLowerCase() === q.toLowerCase()) {
      return (
        <mark
          key={index}
          className={cn(
            "rounded-sm bg-amber-200/90 px-0.5 font-medium text-foreground dark:bg-amber-500/35",
            className,
          )}
        >
          {part}
        </mark>
      )
    }
    return <Fragment key={index}>{part}</Fragment>
  })
}

export function textMatchesQuery(text: string, query?: string): boolean {
  const q = query?.trim().toLowerCase()
  if (!q) return true
  return text.toLowerCase().includes(q)
}
