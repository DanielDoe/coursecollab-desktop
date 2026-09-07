"use client"

import { useState } from "react"
import {
  Archive,
  Loader2,
  PanelRightClose,
  Pencil,
  RotateCcw,
  SquarePen,
  Trash2,
  Check,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { FacultyCoraChatThread } from "@/lib/cora/faculty-cora-thread-types"
import { facultyCoraCapability } from "@/lib/cora/faculty-capabilities"

type Props = {
  threads: FacultyCoraChatThread[]
  archivedThreads: FacultyCoraChatThread[]
  activeThreadId: string | null
  syncing?: boolean
  onSelect: (thread: FacultyCoraChatThread) => void
  onNew: () => void
  onRename: (threadId: string, title: string) => void
  onArchive: (threadId: string) => void
  onRestore: (threadId: string) => void
  onDelete: (threadId: string) => void
  onClose?: () => void
}

export function FacultyCoraSessionSidebar({
  threads,
  archivedThreads,
  activeThreadId,
  syncing = false,
  onSelect,
  onNew,
  onRename,
  onArchive,
  onRestore,
  onDelete,
  onClose,
}: Props) {
  const [showArchived, setShowArchived] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState("")

  const commitRename = () => {
    if (!renamingId) return
    const next = renameDraft.trim()
    if (next) onRename(renamingId, next)
    setRenamingId(null)
  }

  const renderThread = (thread: FacultyCoraChatThread, archived = false) => {
    const badge = thread.capabilityId
      ? facultyCoraCapability(String(thread.capabilityId)).title
      : null
    const isActive = thread.id === activeThreadId
    const isRenaming = renamingId === thread.id

    return (
      <div
        key={thread.id}
        className={cn(
          "group rounded-xl border px-3 py-2.5 transition",
          isActive
            ? "border-[var(--cc-accent)]/40 bg-[var(--muted)]/40"
            : "border-transparent hover:border-[var(--border)] hover:bg-[var(--muted)]/20",
        )}
      >
        {isRenaming ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename()
                if (e.key === "Escape") setRenamingId(null)
              }}
              className="h-8 rounded-lg text-xs"
              autoFocus
            />
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={commitRename}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setRenamingId(null)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <>
            <button type="button" className="w-full text-left" onClick={() => onSelect(thread)}>
              <p className="truncate text-sm font-medium text-[var(--cc-text)]">{thread.title}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--cc-text-muted)]">{thread.preview}</p>
              {badge ? (
                <span className="mt-1.5 inline-flex rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--cc-text-muted)]">
                  {badge}
                </span>
              ) : null}
            </button>
            <div className="mt-2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => {
                  setRenamingId(thread.id)
                  setRenameDraft(thread.title)
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {archived ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => onRestore(thread.id)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => onArchive(thread.id)}
                >
                  <Archive className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-red-500"
                onClick={() => onDelete(thread.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <aside className="relative flex h-full min-h-0 flex-col border-l border-[var(--border)] bg-[var(--muted)]/10 p-4">
      <div className="shrink-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold tracking-widest text-[var(--cc-text-muted)]">
            Chat history
          </p>
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
              aria-label="Hide chat history"
            >
              <PanelRightClose className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--cc-text-muted)]">
          Conversations sync to your course. Select a title to reopen the full thread.
        </p>
        {syncing ? (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--cc-text-muted)]">
            <Loader2 className="h-3 w-3 animate-spin" /> Syncing…
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 h-8 w-full justify-center gap-1.5 rounded-xl text-xs font-medium"
          onClick={onNew}
        >
          <SquarePen className="h-3.5 w-3.5" />
          New conversation
        </Button>
      </div>

      <div className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        {threads.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-[var(--cc-text-muted)]">
            No saved chats yet.
          </p>
        ) : (
          threads.map((thread) => renderThread(thread))
        )}
      </div>

      {archivedThreads.length > 0 ? (
        <div className="mt-3 shrink-0 border-t border-[var(--border)] pt-3">
          <button
            type="button"
            className="mb-2 text-xs font-medium text-[var(--cc-text-muted)]"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? "Hide archived" : `Archived (${archivedThreads.length})`}
          </button>
          {showArchived ? (
            <div className="max-h-40 space-y-1.5 overflow-y-auto">
              {archivedThreads.map((thread) => renderThread(thread, true))}
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}
