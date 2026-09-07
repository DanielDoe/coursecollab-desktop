"use client"

import * as React from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Outer shell — matches announcements / messages; visible edge in light + dark */
export const EMBED_CARD = cn(
  "rounded-xl bg-[var(--card)] overflow-hidden",
  "border border-[color-mix(in_srgb,var(--cc-text)_14%,transparent)]",
  "shadow-[0_1px_2px_rgba(15,23,42,0.06),0_10px_28px_rgba(15,23,42,0.09)]",
  "dark:border-white/[0.10]",
  "dark:shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_12px_36px_rgba(0,0,0,0.4)]",
)

export const EMBED_SEARCH =
  "h-10 rounded-full border border-[var(--border)] bg-[var(--muted)]/40 pl-9 pr-9 shadow-none focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]/30"

export const EMBED_TOOLBAR_ICON =
  "h-10 w-10 rounded-full text-[var(--cc-text-muted)] hover:bg-[var(--muted)]/60"

export const EMBED_TOOLBAR_ICON_ACTIVE =
  "h-10 w-10 rounded-full bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"

export const EMBED_INNER_PANEL = "rounded-xl bg-[var(--muted)]/30"

/** Lifted material tile — depth via tone + shadow; dark mode uses accent tint, not flat gray. */
export const EMBED_MATERIAL_PANEL = cn(
  "rounded-xl bg-[var(--card)]",
  "border border-[color-mix(in_srgb,var(--cc-text)_8%,transparent)]",
  "shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_22px_rgba(15,23,42,0.07)]",
  "dark:border-[color-mix(in_srgb,var(--cc-accent)_14%,var(--border))]",
  "dark:bg-[color-mix(in_srgb,var(--card)_84%,var(--cc-accent)_16%)]",
  "dark:shadow-[0_1px_0_color-mix(in_srgb,var(--cc-accent)_10%,transparent)_inset,0_8px_24px_rgba(0,0,0,0.35)]",
)

export const EMBED_LIST = "space-y-2"

export const EMBED_LIST_TILE =
  "rounded-xl px-3 py-3 sm:px-4 sm:py-3.5 transition-colors hover:bg-[var(--muted)]/45"

export const EMBED_LIST_TILE_ACTIVE = "bg-[var(--cc-accent-soft)]"

export const EMBED_LIST_TILE_UNREAD = "bg-[var(--cc-accent-soft)]/40"

/** Hairline below merged-shell breadcrumbs — matches Lectures, Notes, Practice Hub */
export const EMBED_MERGED_MODULE_DIVIDER =
  "border-t border-[color-mix(in_srgb,var(--cc-text)_10%,transparent)] pt-3 sm:pt-4"

type EmbedModuleCardProps = {
  children: React.ReactNode
  className?: string
  toolbar?: React.ReactNode
}

export function EmbedModuleCard({ children, className, toolbar }: EmbedModuleCardProps) {
  return (
    <section data-embed-module-card className={cn(EMBED_CARD, className)}>
      {toolbar ? (
        <div data-embed-module-card-toolbar className="p-4 sm:p-5">
          {toolbar}
        </div>
      ) : null}
      {children}
    </section>
  )
}

type EmbedSearchFieldProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function EmbedSearchField({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: EmbedSearchFieldProps) {
  return (
    <div className={cn("relative min-w-0 flex-1", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]"
        aria-hidden
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={EMBED_SEARCH}
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange("")}
          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full p-0"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  )
}

type EmbedToolbarProps = {
  children: React.ReactNode
  className?: string
}

export function EmbedToolbar({ children, className }: EmbedToolbarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
    </div>
  )
}

export function EmbedToolbarActions({ children, className }: EmbedToolbarProps) {
  return <div className={cn("flex shrink-0 items-center gap-0.5", className)}>{children}</div>
}

type EmbedListTileProps = React.ComponentProps<"div"> & {
  active?: boolean
  unread?: boolean
}

export function EmbedListTile({ active, unread, className, ...props }: EmbedListTileProps) {
  return (
    <div
      className={cn(
        EMBED_LIST_TILE,
        active && EMBED_LIST_TILE_ACTIVE,
        !active && unread && EMBED_LIST_TILE_UNREAD,
        className,
      )}
      {...props}
    />
  )
}
