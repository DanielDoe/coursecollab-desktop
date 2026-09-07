"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ExternalLink,
  FileText,
  Film,
  ImageIcon,
  Link2,
  Loader2,
  Paperclip,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useMessagesTheme } from "@/components/messages/messages-theme-context"
import { portalSelectedOutlineClass } from "@/lib/portal-module-themes"
import { getMessageAuthHeaders } from "@/lib/direct-messages/client"
import type { MessageParticipantProfile } from "@/lib/direct-messages/participant-profile"
import {
  buildSharedContentFromMessages,
  filterSharedContent,
  formatFileSize,
  linkHostname,
  sharedContentCounts,
  type SharedContentFilter,
  type SharedContentItem,
} from "@/lib/direct-messages/shared-content"
import type { MessageRecipient, ThreadMessage } from "@/lib/direct-messages/types"
import { PresenceAvatar } from "@/components/presence/PresenceAvatar"
import { RoleWithLastSeen } from "@/components/presence/LastSeenLabel"
import type { ManualPresenceStatus, PresenceStatus } from "@/lib/presence/types"

type MessageParticipantDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  participant: MessageRecipient | null
  messages: ThreadMessage[]
  presenceStatus?: PresenceStatus
  lastSeenAt?: string | null
  manualStatus?: ManualPresenceStatus | null
}

const FILTER_TABS: Array<{ id: SharedContentFilter; label: string; icon: typeof ImageIcon }> = [
  { id: "all", label: "All", icon: Paperclip },
  { id: "photo", label: "Photos", icon: ImageIcon },
  { id: "document", label: "Docs", icon: FileText },
  { id: "link", label: "Links", icon: Link2 },
  { id: "video", label: "Videos", icon: Film },
]

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function SharedItemRow({ item }: { item: SharedContentItem }) {
  const theme = useMessagesTheme()
  const Icon =
    item.kind === "photo"
      ? ImageIcon
      : item.kind === "video"
        ? Film
        : item.kind === "link"
          ? Link2
          : FileText

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/50 p-3 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
    >
      {item.kind === "photo" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url}
          alt={item.title}
          className="h-14 w-14 rounded-lg object-cover shrink-0 bg-slate-100 dark:bg-slate-800"
        />
      ) : (
        <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", theme.page.iconBg, theme.page.iconText)}>
          <Icon className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
          {item.title}
        </span>
        <span className="block text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
          {item.kind === "link" ? linkHostname(item.url) : formatFileSize(item.fileSize) ?? item.mimeType ?? "File"}
        </span>
        <span className="block text-[11px] text-slate-400 dark:text-slate-500 mt-1">
          {item.senderName} · {formatWhen(item.createdAt)}
        </span>
      </span>
      <ExternalLink className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-1" aria-hidden />
    </a>
  )
}

export function MessageParticipantDrawer({
  open,
  onOpenChange,
  participant,
  messages,
  presenceStatus,
  lastSeenAt,
  manualStatus,
}: MessageParticipantDrawerProps) {
  const theme = useMessagesTheme()
  const [filter, setFilter] = useState<SharedContentFilter>("all")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<MessageParticipantProfile | null>(null)

  const sharedItems = useMemo(() => buildSharedContentFromMessages(messages), [messages])
  const counts = useMemo(() => sharedContentCounts(sharedItems), [sharedItems])
  const visibleItems = useMemo(() => filterSharedContent(sharedItems, filter), [sharedItems, filter])

  const loadProfile = useCallback(async () => {
    if (!participant) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/messages/participants/${participant.kind}/${participant.id}/profile`,
        { headers: getMessageAuthHeaders() },
      )
      const data = (await res.json()) as { profile?: MessageParticipantProfile; error?: string }
      if (!res.ok) throw new Error(data.error || "Could not load profile")
      setProfile(data.profile ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load profile")
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [participant])

  useEffect(() => {
    setProfile(null)
    setError(null)
    setFilter("all")
  }, [participant?.id, participant?.kind])

  useEffect(() => {
    if (open && participant && !profile && !loading) void loadProfile()
  }, [open, participant, profile, loading, loadProfile])

  const displayName = profile?.displayName ?? participant?.displayName ?? "Profile"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 gap-0 h-full overflow-hidden bg-white dark:bg-[#0f172a] border-slate-200 dark:border-white/10 flex flex-col"
      >
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-slate-200/80 dark:border-white/10 text-left space-y-3">
          <div className="flex items-start gap-3 pr-8">
            <PresenceAvatar name={displayName} status={presenceStatus} />
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                {displayName}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Profile details and shared files for {displayName}
              </SheetDescription>
              <RoleWithLastSeen
                role={profile?.categoryLabel ?? participant?.subtitle ?? ""}
                status={presenceStatus}
                lastSeenAt={lastSeenAt}
                manualStatus={manualStatus}
                className="mt-1"
              />
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading profile…
            </div>
          )}

          {error && !loading && (
            <div className="rounded-lg border border-red-200/80 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {profile && !loading && profile.fields.length > 0 && (
            <dl className="grid gap-2 pt-1">
              {profile.fields.map((field) => (
                <div key={field.label} className="grid grid-cols-[minmax(5rem,38%)_1fr] gap-2 text-xs">
                  <dt className="text-slate-500 dark:text-slate-400">{field.label}</dt>
                  <dd className="text-slate-800 dark:text-slate-200 break-all">{field.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </SheetHeader>

        <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Shared in this chat</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Photos, documents, links, and videos from this conversation
            </p>
          </div>

          <div className="px-5 pb-3 flex gap-1.5 overflow-x-auto scrollbar-hide">
            {FILTER_TABS.map((tab) => {
              const count = counts[tab.id]
              if (tab.id !== "all" && count === 0) return null
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                    filter === tab.id
                      ? portalSelectedOutlineClass(theme)
                      : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  <span className="tabular-nums opacity-70">{count}</span>
                </button>
              )
            })}
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-2">
            {visibleItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/10 px-4 py-8 text-center">
                <Paperclip className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm text-slate-600 dark:text-slate-400">Nothing shared yet</p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                  Attach files, photos, or links in your messages to see them here.
                </p>
              </div>
            ) : (
              visibleItems.map((item) => <SharedItemRow key={item.id} item={item} />)
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
