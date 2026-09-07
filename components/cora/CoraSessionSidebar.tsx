"use client"

import { useState } from "react"
import {
  Archive,
  BookMarked,
  Check,
  Clock3,
  Code2,
  GitBranch,
  Loader2,
  NotebookPen,
  PanelRightClose,
  Pencil,
  RotateCcw,
  SquarePen,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  type CoraArtifactKind,
  type CoraSessionArtifact,
  type CoraWorkspaceSessionSnapshot,
} from "@/lib/cora/session-artifacts"
import { studentCoraCapability } from "@/lib/cora/student-capabilities"

type Props = {
  snapshot: CoraWorkspaceSessionSnapshot
  onScrollToMessage: (messageId: string) => void
  onLoadSavedConversation?: (conversationId: string) => void
  onStartNewConversation?: () => void
  onArchiveConversation?: (conversationId: string) => void
  onRestoreConversation?: (conversationId: string) => void
  onDeleteConversation?: (conversationId: string) => void
  onRenameConversation?: (conversationId: string, title: string) => void
  onExportToNotes?: () => void
  isExporting?: boolean
  onClose?: () => void
}

const ARTIFACT_TYPES = [
  { kind: "note" as const, label: "Study notes", icon: BookMarked, hint: "Summaries from this chat" },
  { kind: "flowchart" as const, label: "Flowcharts", icon: GitBranch, hint: "Visual concept maps" },
  { kind: "equation" as const, label: "Equations", icon: Sparkles, hint: "LaTeX & derivations" },
  { kind: "code" as const, label: "Code snippets", icon: Code2, hint: "Saved examples" },
]

/** Hide session artifacts when history grows — keeps the sidebar focused on threads. */
const HIDE_ARTIFACTS_WHEN_HISTORY_AT = 4

function capabilityBadgeLabel(capabilityId?: string): string | null {
  if (!capabilityId) return null
  const capability = studentCoraCapability(capabilityId)
  return capability?.title?.trim() || capabilityId
}

export function CoraSessionSidebar({
  snapshot,
  onScrollToMessage,
  onLoadSavedConversation,
  onStartNewConversation,
  onArchiveConversation,
  onRestoreConversation,
  onDeleteConversation,
  onRenameConversation,
  onExportToNotes,
  isExporting = false,
  onClose,
}: Props) {
  const [expandedKind, setExpandedKind] = useState<CoraArtifactKind | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState("")
  const conversations = [...(snapshot.savedConversations ?? [])].sort(
    (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
  )
  const archived = [...(snapshot.archivedConversations ?? [])].sort(
    (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
  )
  const hideArtifacts = conversations.length >= HIDE_ARTIFACTS_WHEN_HISTORY_AT
  const byKind = (kind: CoraArtifactKind) => snapshot.artifacts.filter((artifact) => artifact.kind === kind)

  const beginRename = (conversationId: string, title: string) => {
    setRenamingId(conversationId)
    setRenameDraft(title)
  }

  const commitRename = () => {
    if (!renamingId || !onRenameConversation) {
      setRenamingId(null)
      return
    }
    const next = renameDraft.trim()
    if (next) onRenameConversation(renamingId, next)
    setRenamingId(null)
  }

  return (
    <aside className="relative flex h-full min-h-0 flex-col border-l border-neutral-200/60 bg-white/50 p-4 dark:border-[var(--border)]/80 dark:bg-[var(--muted)]/10">
      <div className="shrink-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Chat history</p>
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/[0.06]"
              onClick={onClose}
              aria-label="Hide chat history"
            >
              <PanelRightClose className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-[var(--cc-text-muted)]">
          Each chat is saved automatically. Select a title to open its complete thread.
        </p>

        {onStartNewConversation ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 h-8 w-full justify-center gap-1.5 rounded-xl text-xs font-medium"
            onClick={onStartNewConversation}
          >
            <SquarePen className="h-3.5 w-3.5" />
            New conversation
          </Button>
        ) : null}
      </div>

      {conversations.length > 0 ? (
        <div
          className={cn(
            "mt-3 min-h-0 space-y-1.5 overflow-y-auto pr-0.5",
            hideArtifacts ? "flex-1" : "max-h-[min(52vh,420px)]",
          )}
        >
          {conversations.map((conversation) => {
            const badge = capabilityBadgeLabel(conversation.capabilityId)
            const isRenaming = renamingId === conversation.id
            return (
              <div
                key={conversation.id}
                className={cn(
                  "flex w-full items-start gap-1 rounded-xl px-1 py-1 transition-colors",
                  conversation.isCurrent
                    ? "bg-violet-100/80 text-violet-950 dark:bg-violet-500/15 dark:text-violet-100"
                    : "text-neutral-700 hover:bg-neutral-100/90 dark:text-neutral-200 dark:hover:bg-white/[0.06]",
                )}
              >
                {isRenaming ? (
                  <div className="flex min-w-0 flex-1 items-center gap-1 px-1 py-1">
                    <Input
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          commitRename()
                        }
                        if (e.key === "Escape") setRenamingId(null)
                      }}
                      className="h-7 text-xs"
                      autoFocus
                      aria-label="Rename conversation"
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={commitRename}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setRenamingId(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onLoadSavedConversation?.(conversation.id)}
                      className="flex min-w-0 flex-1 items-start gap-2.5 px-1.5 py-1.5 text-left"
                    >
                      <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-55" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">{conversation.title}</span>
                        <span className="mt-0.5 block text-[10px] text-neutral-500 dark:text-neutral-400">
                          {conversation.messageCount} messages ·{" "}
                          {new Date(conversation.lastUpdated).toLocaleDateString()}
                        </span>
                        {badge ? (
                          <span className="mt-1 inline-flex max-w-full truncate rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-medium text-violet-700 dark:text-violet-200">
                            {badge}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {onRenameConversation ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-1 h-7 w-7 shrink-0 rounded-md text-neutral-400 hover:text-neutral-700"
                        title="Rename"
                        onClick={() => beginRename(conversation.id, conversation.title)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    {onArchiveConversation ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-1 h-7 w-7 shrink-0 rounded-md text-neutral-400 hover:text-neutral-700"
                        title="Archive"
                        onClick={() => onArchiveConversation(conversation.id)}
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="mt-3 shrink-0 rounded-xl border border-dashed border-neutral-200/80 px-3 py-3 text-[11px] leading-relaxed text-neutral-500 dark:border-[var(--border)]/60">
          Start a conversation and it will appear here automatically.
        </p>
      )}

      {archived.length > 0 ? (
        <div className="mt-3 shrink-0">
          <button
            type="button"
            className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 hover:text-neutral-600"
            onClick={() => setShowArchived((v) => !v)}
          >
            Archived ({archived.length})
          </button>
          {showArchived ? (
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {archived.map((conversation) => (
                <div
                  key={conversation.id}
                  className="flex items-start gap-1 rounded-xl px-1 py-1 text-neutral-600 dark:text-neutral-300"
                >
                  <button
                    type="button"
                    onClick={() => onLoadSavedConversation?.(conversation.id)}
                    className="min-w-0 flex-1 truncate px-1.5 py-1.5 text-left text-xs"
                  >
                    {conversation.title}
                  </button>
                  {onRestoreConversation ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Restore"
                      onClick={() => onRestoreConversation(conversation.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                  {onDeleteConversation ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500"
                      title="Delete permanently"
                      onClick={() => onDeleteConversation(conversation.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {!hideArtifacts ? (
        <div className="mt-5 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Session artifacts</p>
            {onExportToNotes && snapshot.messages.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 rounded-lg px-2 text-[10px] font-medium text-neutral-500"
                disabled={isExporting}
                onClick={onExportToNotes}
              >
                {isExporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <NotebookPen className="h-3 w-3" />}
                Export
              </Button>
            ) : null}
          </div>
          <div className="mt-2 space-y-1">
            {ARTIFACT_TYPES.map(({ kind, label, icon: Icon, hint }) => {
              const items = byKind(kind)
              const open = expandedKind === kind
              return (
                <div key={kind}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs hover:bg-neutral-100/80 dark:hover:bg-white/[0.05]"
                    onClick={() => setExpandedKind(open ? null : kind)}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                    <span className="flex-1 font-medium text-neutral-700 dark:text-neutral-200">{label}</span>
                    <span className="text-[10px] text-neutral-400">{items.length}</span>
                  </button>
                  {open ? (
                    items.length === 0 ? (
                      <p className="px-2 pb-2 text-[10px] text-neutral-400">{hint}</p>
                    ) : (
                      <ul className="space-y-1 px-1 pb-2">
                        {items.map((artifact: CoraSessionArtifact) => (
                          <li key={artifact.id}>
                            <button
                              type="button"
                              className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-white/[0.05]"
                              onClick={() => onScrollToMessage(artifact.messageId)}
                            >
                              <span className="block truncate text-[11px] font-medium text-neutral-800 dark:text-neutral-100">
                                {artifact.title}
                              </span>
                              <span className="block truncate text-[10px] text-neutral-500">{artifact.preview}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </aside>
  )
}
