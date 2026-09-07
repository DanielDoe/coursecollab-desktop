"use client"

import { useMemo, useState } from "react"
import {
  Check,
  Eye,
  Loader2,
  Search,
  Share2,
  UserRound,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { initialsFromName } from "@/lib/initials-from-name"

export type ClassmateShareEntry = {
  id: number
  full_name: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  /** Shown as a pill under the header (e.g. note title). */
  subjectLabel?: string
  roster: ClassmateShareEntry[]
  selectedIds: number[]
  onSelectedIdsChange: (ids: number[]) => void
  loading?: boolean
  saving?: boolean
  onSave: () => void | Promise<void>
  saveDisabled?: boolean
  saveLabel?: string
  permissionHint?: string
  nativeLayout?: boolean
}

function ShareSkeletonRows() {
  return (
    <div className="space-y-2 px-1">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5"
        >
          <div className="size-9 animate-pulse rounded-full bg-[var(--muted)]" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-[var(--muted)]" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-[var(--muted)]" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ClassmateShareDialog({
  open,
  onOpenChange,
  title = "Share note",
  description = "Choose classmates in your section. They get read-only access — no editing or deleting.",
  subjectLabel,
  roster,
  selectedIds,
  onSelectedIdsChange,
  loading = false,
  saving = false,
  onSave,
  saveDisabled = false,
  saveLabel = "Save sharing",
  permissionHint = "View only",
  nativeLayout = false,
}: Props) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return roster
    return roster.filter((student) => student.full_name.toLowerCase().includes(q))
  }, [query, roster])

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((student) => selectedIds.includes(student.id))

  const toggleStudent = (id: number) => {
    onSelectedIdsChange(
      selectedIds.includes(id)
        ? selectedIds.filter((entry) => entry !== id)
        : [...selectedIds, id],
    )
  }

  const selectAllFiltered = () => {
    const merged = new Set([...selectedIds, ...filtered.map((student) => student.id)])
    onSelectedIdsChange([...merged])
  }

  const clearAll = () => onSelectedIdsChange([])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("")
        onOpenChange(next)
      }}
    >
      <DialogContent
        showCloseButton
        className={cn(
          "gap-0 overflow-hidden rounded-2xl border-[var(--border)] p-0 shadow-2xl sm:max-w-lg",
          nativeLayout && "max-h-[min(92dvh,720px)]",
        )}
      >
        <div className="relative border-b border-[var(--border)] bg-[var(--card)] px-5 pb-4 pt-5">
          <div
            className="absolute inset-x-0 top-0 h-1 bg-[var(--cc-accent)]"
            aria-hidden
          />
          <div className="flex items-start gap-3 pr-8">
            <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]">
              <Share2 className="size-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-left text-lg font-semibold text-[var(--cc-text)]">
                {title}
              </DialogTitle>
              <DialogDescription className="text-left text-sm leading-relaxed text-[var(--cc-text-muted)]">
                {description}
              </DialogDescription>
            </div>
          </div>

          {subjectLabel ? (
            <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)]/60 px-3 py-1 text-xs font-medium text-[var(--cc-text)]">
              <UserRound className="size-3.5 shrink-0" />
              <span className="truncate">{subjectLabel}</span>
            </div>
          ) : null}

          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--muted)]/50 px-2.5 py-1 text-[11px] font-medium text-[var(--cc-text-muted)]">
            <Eye className="size-3.5 text-[var(--cc-accent-dark)]" />
            {permissionHint}
          </div>
        </div>

        <div className="space-y-3 bg-[var(--cc-modal-surface,var(--background))] px-5 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search classmates…"
              disabled={loading || roster.length === 0}
              className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] pl-9 pr-3 text-sm text-[var(--cc-text)] outline-none transition-shadow placeholder:text-[var(--cc-text-muted)] focus:ring-2 focus:ring-[var(--cc-accent)]/25 disabled:opacity-60"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-full text-xs"
                disabled={loading || filtered.length === 0 || allFilteredSelected}
                onClick={selectAllFiltered}
              >
                Select {query.trim() ? "shown" : "all"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-full text-xs text-[var(--cc-text-muted)]"
                disabled={loading || selectedIds.length === 0}
                onClick={clearAll}
              >
                Clear
              </Button>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--sidebar-accent)]/50 px-2.5 py-1 text-[11px] font-semibold text-[var(--cc-text)]">
              <Users className="size-3.5 text-[var(--cc-accent-dark)]" />
              {selectedIds.length} selected
            </span>
          </div>

          <div
            className={cn(
              "overflow-y-auto pr-0.5",
              nativeLayout ? "max-h-[min(42dvh,360px)]" : "max-h-[min(50vh,320px)]",
            )}
          >
            {loading ? (
              <ShareSkeletonRows />
            ) : roster.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-10 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[var(--muted)] text-[var(--cc-text-muted)]">
                  <Users className="size-5" />
                </span>
                <p className="mt-3 text-sm font-medium text-[var(--cc-text)]">No classmates found</p>
                <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
                  Your section roster may still be syncing.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--cc-text-muted)]">
                No classmates match &ldquo;{query.trim()}&rdquo;.
              </div>
            ) : (
              <ul className="space-y-2">
                {filtered.map((student) => {
                  const checked = selectedIds.includes(student.id)
                  return (
                    <li key={student.id}>
                      <button
                        type="button"
                        onClick={() => toggleStudent(student.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
                          checked
                            ? "border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)]/45 shadow-sm"
                            : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--cc-accent-border)]/60 hover:bg-[var(--sidebar-accent)]/35",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                            checked
                              ? "bg-[var(--cc-accent)] text-white"
                              : "bg-[var(--muted)] text-[var(--cc-text-muted)]",
                          )}
                        >
                          {initialsFromName(student.full_name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-[var(--cc-text)]">
                            {student.full_name}
                          </span>
                          <span className="block text-[11px] text-[var(--cc-text-muted)]">
                            {checked ? "Will receive read-only access" : "Tap to share"}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                            checked
                              ? "border-[var(--cc-accent)] bg-[var(--cc-accent)] text-white"
                              : "border-[var(--border)] bg-[var(--card)] text-transparent",
                          )}
                          aria-hidden
                        >
                          <Check className="size-3.5" />
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] bg-[var(--card)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--cc-text-muted)] sm:max-w-[55%]">
            {selectedIds.length > 0
              ? `${selectedIds.length} classmate${selectedIds.length === 1 ? "" : "s"} can open this note in their portal.`
              : "No one else will have access until you select classmates."}
          </p>
          <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-full bg-[var(--cc-accent)] text-white hover:bg-[var(--cc-accent-hover)]"
              disabled={loading || saving || saveDisabled}
              onClick={() => void onSave()}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : saveLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
