"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, FileText, ImageIcon, Link2, Loader2, Upload } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useMessagesTheme } from "@/components/messages/messages-theme-context"
import { getMessageAuthHeaders } from "@/lib/direct-messages/client"
import type { MessageParticipantProfile } from "@/lib/direct-messages/participant-profile"
import {
  buildSharedContentFromMessages,
  type SharedContentItem,
} from "@/lib/direct-messages/shared-content"
import {
  MESSAGE_BACKGROUND_PRESETS,
  fileToBackgroundDataUrl,
  type MessageThreadBackground,
} from "@/lib/direct-messages/message-thread-background"
import type { MessageRecipient, ThreadMessage } from "@/lib/direct-messages/types"
import { PresenceAvatar } from "@/components/presence/PresenceAvatar"
import { RoleWithLastSeen } from "@/components/presence/LastSeenLabel"
import { MessageImageLightbox } from "@/components/messages/MessageImageLightbox"
import { openDesktopUrl } from "@/lib/desktop-open-url"
import type { ManualPresenceStatus, PresenceStatus } from "@/lib/presence/types"

type DetailTab = "info" | "backgrounds" | "photos" | "links" | "documents"

const TABS: { id: DetailTab; label: string }[] = [
  { id: "info", label: "Info" },
  { id: "backgrounds", label: "Backgrounds" },
  { id: "photos", label: "Photos" },
  { id: "links", label: "Links" },
  { id: "documents", label: "Documents" },
]

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|heic|heif|bmp|svg)(?:$|\?)/i
const DOC_EXT = /\.(pdf|docx?|pptx?|xlsx?|csv|txt|zip|rtf)(?:$|\?)/i

type MessageParticipantDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  participant: MessageRecipient | null
  messages: ThreadMessage[]
  threadId?: number | null
  background?: MessageThreadBackground
  onBackgroundChange?: (next: MessageThreadBackground) => void
  presenceStatus?: PresenceStatus
  lastSeenAt?: string | null
  manualStatus?: ManualPresenceStatus | null
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function sharedCaption(senderName: string, createdAt: string): string {
  return [senderName, formatWhen(createdAt)].filter(Boolean).join(" · ")
}

function documentKind(item: SharedContentItem): string {
  const mime = (item.mimeType ?? "").toLowerCase()
  const name = item.title.toLowerCase()
  if (mime.startsWith("video/")) return "Video"
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "PDF"
  if (mime.includes("word") || /\.docx?$/.test(name)) return "Word"
  if (mime.includes("sheet") || mime.includes("excel") || /\.xlsx?$/.test(name) || name.endsWith(".csv")) return "Sheet"
  if (mime.includes("presentation") || /\.pptx?$/.test(name)) return "Slides"
  if (mime.startsWith("text/") || name.endsWith(".txt")) return "Text"
  if (name.endsWith(".zip")) return "Archive"
  return "File"
}

function classifyItem(item: SharedContentItem): "photo" | "document" | "link" {
  const mime = (item.mimeType ?? "").toLowerCase()
  if (item.kind === "photo" || mime.startsWith("image/") || IMAGE_EXT.test(item.url)) return "photo"
  if (item.kind === "document" || item.kind === "video" || item.kind === "other" || DOC_EXT.test(item.url) || mime.startsWith("video/")) {
    return "document"
  }
  return "link"
}

function linkHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function MessageParticipantDrawer({
  open,
  onOpenChange,
  participant,
  messages,
  threadId = null,
  background = { kind: "default" },
  onBackgroundChange,
  presenceStatus,
  lastSeenAt,
  manualStatus,
}: MessageParticipantDrawerProps) {
  const theme = useMessagesTheme()
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<DetailTab>("info")
  const [loading, setLoading] = useState(false)
  const [uploadingBackground, setUploadingBackground] = useState(false)
  const [backgroundNote, setBackgroundNote] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<MessageParticipantProfile | null>(null)

  const library = useMemo(() => {
    const photos: SharedContentItem[] = []
    const links: SharedContentItem[] = []
    const documents: SharedContentItem[] = []
    for (const item of buildSharedContentFromMessages(messages)) {
      const kind = classifyItem(item)
      if (kind === "photo") photos.push(item)
      else if (kind === "document") documents.push(item)
      else links.push(item)
    }
    return { photos, links, documents }
  }, [messages])

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
    setTab("info")
    setBackgroundNote(null)
  }, [participant?.id, participant?.kind])

  useEffect(() => {
    if (open && participant && !profile && !loading) void loadProfile()
  }, [open, participant, profile, loading, loadProfile])

  const displayName = profile?.displayName ?? participant?.displayName ?? "Profile"
  const statusRole = profile?.categoryLabel ?? participant?.subtitle ?? ""

  async function uploadBackground(file: File) {
    if (!threadId || !onBackgroundChange) return
    setBackgroundNote(null)
    setUploadingBackground(true)
    try {
      const uri = await fileToBackgroundDataUrl(file)
      onBackgroundChange({ kind: "image", uri })
    } catch (e) {
      setBackgroundNote(e instanceof Error ? e.message : "Could not save that photo. Try another image.")
    } finally {
      setUploadingBackground(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 dark:border-white/10 dark:bg-[#0f172a] sm:max-w-md"
      >
        <SheetHeader className="space-y-3 border-b border-slate-200/80 px-5 pb-4 pt-5 text-left dark:border-white/10">
          <div className="flex items-start gap-3 pr-8">
            <PresenceAvatar name={displayName} status={presenceStatus} />
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                {displayName}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Profile, chat background, and files shared with {displayName}
              </SheetDescription>
              <RoleWithLastSeen
                role={statusRole}
                status={presenceStatus}
                lastSeenAt={lastSeenAt}
                manualStatus={manualStatus}
                className="mt-1"
              />
            </div>
          </div>
        </SheetHeader>

        <div className="flex gap-1 overflow-x-auto px-4 py-3 scrollbar-hide" role="tablist">
          {TABS.map((item) => {
            const selected = tab === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(item.id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold",
                  selected
                    ? "bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white"
                    : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/[0.04]",
                )}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          {tab === "info" ? (
            loading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading profile…
              </div>
            ) : error ? (
              <div className="space-y-2 rounded-xl border border-red-200/80 bg-red-50/80 px-3 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                <p>{error}</p>
                <button type="button" className="font-semibold underline" onClick={() => void loadProfile()}>
                  Try again
                </button>
              </div>
            ) : profile ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10">
                <div className="flex items-center gap-3 p-4">
                  <PresenceAvatar name={profile.displayName} status={presenceStatus} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{profile.displayName}</p>
                    <RoleWithLastSeen
                      role={statusRole}
                      status={presenceStatus}
                      lastSeenAt={lastSeenAt}
                      manualStatus={manualStatus}
                      className="mt-1"
                    />
                  </div>
                </div>
                {profile.fields.length > 0 ? (
                  <dl>
                    {profile.fields.map((field) => (
                      <div
                        key={field.label}
                        className="grid grid-cols-[7.5rem_1fr] gap-3 border-t border-slate-200/80 px-4 py-2.5 text-sm dark:border-white/10"
                      >
                        <dt className="font-semibold text-slate-500 dark:text-slate-400">{field.label}</dt>
                        <dd className="break-all text-slate-900 dark:text-slate-100">{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="border-t border-slate-200/80 px-4 py-6 text-center text-sm text-slate-500 dark:border-white/10">
                    No additional details available.
                  </p>
                )}
              </div>
            ) : null
          ) : null}

          {tab === "backgrounds" ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pick a color or upload a photo from your library. It stays behind this chat.
              </p>
              {!threadId ? (
                <p className="text-sm text-slate-500">Open a conversation to set its background.</p>
              ) : (
                <>
                  {backgroundNote ? <p className="text-xs text-red-600 dark:text-red-400">{backgroundNote}</p> : null}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => onBackgroundChange?.({ kind: "default" })}
                      aria-pressed={background.kind === "default"}
                      className={cn(
                        "relative flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-2xl border bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-100",
                        background.kind === "default" ? "border-[var(--cc-accent)]" : "border-slate-200 dark:border-white/10",
                      )}
                    >
                      Default
                      {background.kind === "default" ? <Check className="h-4 w-4 text-[var(--cc-accent)]" /> : null}
                    </button>
                    {MESSAGE_BACKGROUND_PRESETS.map((preset) => {
                      const selected = background.kind === "preset" && background.presetId === preset.id
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => onBackgroundChange?.({ kind: "preset", presetId: preset.id })}
                          aria-pressed={selected}
                          className={cn(
                            "relative aspect-[3/4] overflow-hidden rounded-2xl border text-left",
                            selected ? "border-[var(--cc-accent)]" : "border-slate-200 dark:border-white/10",
                          )}
                        >
                          <span className="absolute inset-0 dark:hidden" style={{ background: preset.light }} />
                          <span className="absolute inset-0 hidden dark:block" style={{ background: preset.dark }} />
                          <span className="absolute bottom-2 left-2 right-2 text-xs font-semibold text-white drop-shadow">
                            {preset.label}
                          </span>
                          {selected ? <Check className="absolute right-2 top-2 h-4 w-4 text-white" /> : null}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploadingBackground}
                      aria-pressed={background.kind === "image"}
                      className={cn(
                        "relative flex aspect-[3/4] flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border text-xs font-semibold",
                        background.kind === "image"
                          ? "border-[var(--cc-accent)] text-white"
                          : "border-slate-200 bg-slate-100 text-slate-800 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100",
                      )}
                    >
                      {background.kind === "image" ? (
                        <span className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${background.uri})` }} />
                      ) : null}
                      <span className="relative flex flex-col items-center gap-1">
                        {uploadingBackground ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                        Upload
                      </span>
                      {background.kind === "image" ? <Check className="absolute right-2 top-2 h-4 w-4 text-white" /> : null}
                    </button>
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ""
                      if (file) void uploadBackground(file)
                    }}
                  />
                </>
              )}
            </div>
          ) : null}

          {tab === "photos" ? (
            library.photos.length > 0 ? (
              <div className="space-y-3">
                <LibraryHeading title="Photos" count={library.photos.length} />
                <div className="grid grid-cols-3 gap-0.5">
                  {library.photos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setPreviewUrl(photo.url)}
                      className="aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800"
                      aria-label={sharedCaption(photo.senderName, photo.createdAt) || "Open photo"}
                    >
                      <img src={photo.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyLibrary icon={ImageIcon} title="Photos shared in this chat show up here." />
            )
          ) : null}

          {tab === "links" ? (
            library.links.length > 0 ? (
              <div className="space-y-2">
                <LibraryHeading title="Links" count={library.links.length} />
                {library.links.map((link) => (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => void openDesktopUrl(link.url)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left hover:bg-slate-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
                  >
                    <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", theme.page.iconBg, theme.page.iconText)}>
                      <Link2 className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{link.title}</span>
                      <span className="block truncate text-xs text-slate-500">{linkHost(link.url)}</span>
                      <span className="block truncate text-xs text-slate-400">{sharedCaption(link.senderName, link.createdAt)}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyLibrary icon={Link2} title="Links shared in this chat show up here." />
            )
          ) : null}

          {tab === "documents" ? (
            library.documents.length > 0 ? (
              <div className="space-y-2">
                <LibraryHeading title="Documents" count={library.documents.length} />
                {library.documents.map((document) => (
                  <button
                    key={document.id}
                    type="button"
                    onClick={() => void openDesktopUrl(document.url)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left hover:bg-slate-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
                    aria-label={`Open ${document.title}`}
                  >
                    <span className={cn("inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl px-2 text-[10px] font-extrabold", theme.page.iconBg, theme.page.iconText)}>
                      {documentKind(document)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{document.title}</span>
                      <span className="block truncate text-xs text-slate-500">{sharedCaption(document.senderName, document.createdAt)}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyLibrary icon={FileText} title="Documents shared in this chat show up here." />
            )
          ) : null}
        </div>

        <MessageImageLightbox
          open={previewUrl != null}
          onOpenChange={(next) => {
            if (!next) setPreviewUrl(null)
          }}
          src={previewUrl ?? ""}
          alt="Shared photo"
        />
      </SheetContent>
    </Sheet>
  )
}

function LibraryHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <span className="text-xs tabular-nums text-slate-500">{count}</span>
    </div>
  )
}

function EmptyLibrary({ icon: Icon, title }: { icon: typeof ImageIcon; title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center dark:border-white/10">
      <Icon className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
      <p className="text-sm text-slate-600 dark:text-slate-400">{title}</p>
    </div>
  )
}
