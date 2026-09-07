"use client"

import { memo, useEffect, useRef, useState, type ReactNode } from "react"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { PORTAL_CARD } from "@/lib/appearance/portal-nav-classes"
import { FacultyViewOrganizer } from "@/components/instructor/dashboard-v2/FacultyViewOrganizer"

const SEARCH_DEBOUNCE_MS = 200

export type FacultyIntegratedToolbarProps = {
  moduleId: string
  search?: string
  onSearchChange?: (value: string) => void
  onSearchClear?: () => void
  searchPlaceholder?: string
  /** Remount / wipe the field (e.g. course scope change). */
  searchResetToken?: string | number
  /** Category, sort, status selects, etc. — rendered inline after search, no dividers. */
  filters?: ReactNode
  viewMode?: "grid" | "list"
  onViewModeChange?: (mode: "grid" | "list") => void
  /** Muted count line under the bar, e.g. "85 announcements · 83 pinned". */
  meta?: ReactNode
  /** Removable filter chips row (optional). */
  chips?: ReactNode
  trailing?: ReactNode
  /** Icon-only search until focused; expands inline without hiding other controls. */
  searchCompact?: boolean
  /** Flat controls row when nested inside CardWrapper / embed shell */
  embedded?: boolean
  className?: string
}

/** Uncontrolled field so parent directory re-renders cannot steal keystrokes. */
const FacultyToolbarSearchField = memo(function FacultyToolbarSearchField({
  initialValue,
  placeholder,
  searchCompact,
  onSearchChange,
  onSearchClear,
}: {
  initialValue: string
  placeholder: string
  searchCompact: boolean
  onSearchChange: (value: string) => void
  onSearchClear?: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<number | null>(null)
  const onSearchChangeRef = useRef(onSearchChange)
  onSearchChangeRef.current = onSearchChange
  const [focused, setFocused] = useState(false)
  const [hasValue, setHasValue] = useState(() => Boolean(initialValue.trim()))

  const expanded = focused || hasValue
  const collapsed = searchCompact && !expanded

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
    }
  }, [])

  const emit = (next: string, immediate: boolean) => {
    setHasValue(next.trim().length > 0)
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (immediate) {
      onSearchChangeRef.current(next)
      return
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      onSearchChangeRef.current(next)
    }, SEARCH_DEBOUNCE_MS)
  }

  const clearSearch = () => {
    if (inputRef.current) inputRef.current.value = ""
    emit("", true)
    onSearchClear?.()
    setFocused(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  return (
    <div
      className={cn(
        "relative shrink-0 transition-[width] duration-200 ease-out motion-reduce:transition-none",
        collapsed ? "w-9" : "w-[min(100%,14rem)] sm:w-[min(100%,18rem)] flex-1 min-w-[8.5rem] max-w-md",
      )}
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        defaultValue={initialValue}
        autoComplete="off"
        onChange={(e) => emit(e.target.value, false)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          window.setTimeout(() => setFocused(false), 150)
        }}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return
          e.preventDefault()
          if (inputRef.current?.value.trim()) {
            clearSearch()
          } else {
            e.currentTarget.blur()
            setFocused(false)
          }
        }}
        placeholder={collapsed ? "" : placeholder}
        aria-label={placeholder}
        className={cn(
          "h-9 w-full min-w-0 rounded-full border-0 bg-[var(--sidebar-accent)]/50 pl-9 text-sm shadow-none outline-none",
          "text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)]/80",
          "focus-visible:bg-[var(--sidebar-accent)]/70 focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]/30",
          hasValue ? "pr-9" : "pr-3",
          "[appearance:textfield] [&::-webkit-search-cancel-button]:hidden",
        )}
      />
      {hasValue ? (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={clearSearch}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--cc-text-muted)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--cc-text)]"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
})

/** Single-row toolbar: pill search + inline filters + actions (signature faculty layout). */
export function FacultyIntegratedToolbar({
  moduleId,
  search,
  onSearchChange,
  onSearchClear,
  searchPlaceholder = "Search…",
  searchResetToken,
  filters,
  viewMode,
  onViewModeChange,
  meta,
  chips,
  trailing,
  searchCompact = false,
  embedded = false,
  className,
}: FacultyIntegratedToolbarProps) {
  const showSearch = onSearchChange !== undefined
  const showViewOrganizer = viewMode !== undefined && onViewModeChange !== undefined
  const hasControlsRow = showSearch || filters || showViewOrganizer || trailing

  return (
    <div className={cn("space-y-2", className)}>
      {hasControlsRow ? (
        <div
          className={cn(
            embedded
              ? "flex flex-nowrap items-center gap-1.5 overflow-x-auto sm:gap-2"
              : cn(
                  PORTAL_CARD,
                  "flex flex-nowrap items-center gap-1.5 overflow-x-auto p-2 sm:gap-2 sm:p-2.5",
                ),
            "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
          )}
        >
          {showSearch ? (
            <FacultyToolbarSearchField
              key={searchResetToken ?? "search"}
              initialValue={search ?? ""}
              placeholder={searchPlaceholder}
              searchCompact={searchCompact}
              onSearchChange={onSearchChange}
              onSearchClear={onSearchClear}
            />
          ) : null}

          {filters ? (
            <div
              className={cn(
                "flex shrink-0 flex-nowrap items-center gap-1.5",
                "[&_button]:h-9 [&_button]:shrink-0 [&_button]:rounded-full",
              )}
            >
              {filters}
            </div>
          ) : null}

          {showViewOrganizer ? (
            <FacultyViewOrganizer
              moduleId={moduleId}
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
              className="shrink-0"
            />
          ) : null}

          {trailing ? (
            <div
              className={cn(
                "ml-auto flex shrink-0 flex-nowrap items-center gap-1.5",
                "[&_button]:h-9 [&_button]:shrink-0 [&_button]:rounded-full",
                "[&_a]:inline-flex [&_a]:shrink-0",
              )}
            >
              {trailing}
            </div>
          ) : null}
        </div>
      ) : null}

      {meta ? <div className="px-0.5">{meta}</div> : null}
      {chips ? <div className="flex flex-wrap gap-1.5 px-0.5">{chips}</div> : null}
    </div>
  )
}

/** Outline-free filter trigger — matches integrated toolbar surfaces. */
export function facultyToolbarFilterButtonClass(active?: boolean) {
  return cn(
    "h-9 shrink-0 gap-1.5 rounded-full border-0 bg-[var(--sidebar-accent)]/40 px-2.5 shadow-none hover:bg-[var(--sidebar-accent)]/70",
    active && "bg-[var(--sidebar-accent)] text-[var(--cc-accent-dark)] font-medium",
  )
}

/** Compact icon-only control for dense single-row toolbars. */
export function facultyToolbarIconButtonClass(active?: boolean) {
  return cn(
    "h-9 w-9 shrink-0 rounded-full border-0 bg-[var(--sidebar-accent)]/40 p-0 shadow-none hover:bg-[var(--sidebar-accent)]/70",
    active && "bg-[var(--sidebar-accent)] text-[var(--cc-accent-dark)]",
  )
}

/** Narrow select trigger for inline toolbar filters. */
export function facultyToolbarSelectTriggerClass(active?: boolean) {
  return cn(
    facultyToolbarFilterButtonClass(active),
    "h-9 w-[6.25rem] shrink-0 px-2 text-xs shadow-none sm:w-[6.75rem] sm:text-sm [&>span]:line-clamp-1",
  )
}
