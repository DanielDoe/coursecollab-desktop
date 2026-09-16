"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  SendHorizontal,
  Plus,
  Paperclip,
  Camera,
  Image as ImageIcon,
  Smile,
  ChevronLeft,
  Underline as UnderlineIcon,
  X,
  Loader2,
  FileText,
  Link2,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useMessagesTheme } from "@/components/messages/messages-theme-context"
import type { MessageAttachmentDraft } from "@/lib/direct-messages/attachments"
import {
  composerCanSend,
  uploadMessageAttachment,
} from "@/lib/direct-messages/upload-message-attachment-client"
import { mediaDisplayUrl } from "@/lib/media/display-url"

export type { MessageAttachmentDraft } from "@/lib/direct-messages/attachments"

const QUICK_EMOJIS = [
  "😀", "😊", "👍", "🙏", "❤️", "🎉", "✅", "📎",
  "💡", "🤔", "😅", "👋", "🔥", "⭐", "📚", "✏️",
  "📝", "💬", "🎓", "⏰", "❓", "‼️", "🙌", "💯",
]

type MessageComposerProps = {
  value: string
  onChange: (html: string) => void
  attachments: MessageAttachmentDraft[]
  onAttachmentsChange: (attachments: MessageAttachmentDraft[]) => void
  placeholder?: string
  disabled?: boolean
  minHeight?: number
  compact?: boolean
  onSubmit?: () => void
  /** Show integrated send button (reply bar). */
  showSend?: boolean
  sending?: boolean
  sendDisabled?: boolean
  className?: string
}

function FormatButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const theme = useMessagesTheme()
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 dark:text-slate-400",
        "hover:bg-white dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-slate-100 transition-colors",
        "disabled:opacity-40 disabled:pointer-events-none",
        active && cn("bg-white dark:bg-white/10 shadow-sm", theme.page.iconText),
      )}
    >
      {children}
    </button>
  )
}

function ComposerPlusMenu({
  disabled,
  uploading,
  side = "top",
  onAttachFile,
  onTakePhoto,
  onChoosePhoto,
  onPickEmoji,
  onInsertLink,
}: {
  disabled?: boolean
  uploading?: boolean
  side?: "top" | "bottom"
  onAttachFile: () => void
  onTakePhoto: () => void
  onChoosePhoto: () => void
  onPickEmoji: (emoji: string) => void
  onInsertLink: (url: string, label?: string) => void
}) {
  const theme = useMessagesTheme()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<"menu" | "emoji" | "link">("menu")
  const [linkUrl, setLinkUrl] = useState("")
  const [linkLabel, setLinkLabel] = useState("")

  useEffect(() => {
    if (!open) {
      setView("menu")
      setLinkUrl("")
      setLinkLabel("")
    }
  }, [open])

  function submitLink() {
    const url = linkUrl.trim()
    if (!url) return
    onInsertLink(url, linkLabel.trim() || undefined)
    setOpen(false)
  }

  const menuItems = [
    {
      id: "attach",
      label: "Attach file",
      description: "PDF, docs, and more",
      icon: Paperclip,
      onClick: () => {
        onAttachFile()
        setOpen(false)
      },
    },
    {
      id: "link",
      label: "Link",
      description: "Add a web address",
      icon: Link2,
      onClick: () => setView("link"),
    },
    {
      id: "camera",
      label: "Take photo",
      description: "Use your camera",
      icon: Camera,
      onClick: () => {
        onTakePhoto()
        setOpen(false)
      },
    },
    {
      id: "gallery",
      label: "Photo library",
      description: "Choose from device",
      icon: ImageIcon,
      onClick: () => {
        onChoosePhoto()
        setOpen(false)
      },
    },
    {
      id: "emoji",
      label: "Emoji",
      description: "Insert a reaction",
      icon: Smile,
      onClick: () => setView("emoji"),
    },
  ]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Add attachment or emoji"
          disabled={disabled}
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200",
            "text-slate-500 dark:text-slate-400",
            "hover:bg-white/10 dark:hover:bg-white/10",
            theme.page.iconText,
            "active:scale-95 disabled:opacity-40 disabled:pointer-events-none",
            open && cn(theme.page.softBg, theme.page.iconText, "rotate-45"),
          )}
        >
          {uploading ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin" />
          ) : (
            <Plus className="h-[18px] w-[18px] transition-transform duration-200" strokeWidth={2.25} />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side={side}
        sideOffset={10}
        className={cn(
          "w-56 p-1.5 rounded-2xl shadow-xl z-50",
          "border border-slate-200 dark:border-slate-700/80",
          "bg-white dark:bg-slate-900",
          "text-slate-900 dark:text-slate-100",
        )}
      >
        {view === "menu" ? (
          <ul className="flex flex-col gap-0.5">
            {menuItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={item.onClick}
                >
                  <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full", theme.page.iconBg, theme.page.iconText)}>
                    <item.icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {item.label}
                    </span>
                    <span className="block text-[11px] leading-snug text-slate-600 dark:text-slate-300 truncate">
                      {item.description}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : view === "emoji" ? (
          <div>
            <button
              type="button"
              className="flex items-center gap-1.5 px-2 py-1.5 mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              onClick={() => setView("menu")}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Pick an emoji
            </p>
            <div className="grid grid-cols-8 gap-0.5 px-1 pb-1">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="h-8 w-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-lg transition-colors active:scale-95"
                  onClick={() => {
                    onPickEmoji(emoji)
                    setOpen(false)
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-2 pb-2 space-y-2">
            <button
              type="button"
              className="flex items-center gap-1.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              onClick={() => setView("menu")}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Insert link
            </p>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
            <input
              type="text"
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder="Display text (optional)"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
            <button
              type="button"
              disabled={!linkUrl.trim()}
              onClick={submitLink}
              className={cn("w-full rounded-lg text-white text-sm font-semibold py-2 disabled:opacity-40 hover:brightness-105 transition", theme.page.cta)}
            >
              Add link
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function SendButton({
  disabled,
  sending,
  uploading,
  hasContent,
  onClick,
  compact,
  extraDisabled,
}: {
  disabled?: boolean
  sending?: boolean
  uploading?: boolean
  hasContent: boolean
  onClick?: () => void
  compact?: boolean
  extraDisabled?: boolean
}) {
  const theme = useMessagesTheme()
  const canSend = hasContent && !extraDisabled && !uploading
  return (
    <button
      type="button"
      aria-label="Send message"
      disabled={disabled || !canSend}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-all duration-200",
        compact ? "h-10 w-10" : "h-11 w-11",
        canSend && !disabled
          ? cn(theme.page.cta, "shadow-md hover:brightness-105 active:scale-95")
          : "bg-slate-200/90 dark:bg-slate-700/80 text-slate-400 dark:text-slate-500 cursor-not-allowed",
      )}
    >
      {sending ? (
        <Loader2 className="h-[18px] w-[18px] animate-spin" />
      ) : (
        <SendHorizontal className={cn("h-[18px] w-[18px]", canSend && "-mr-0.5")} strokeWidth={2.25} />
      )}
    </button>
  )
}

export function MessageComposer({
  value,
  onChange,
  attachments,
  onAttachmentsChange,
  placeholder = "Write your message…",
  disabled,
  minHeight = 120,
  compact,
  onSubmit,
  showSend,
  sending,
  sendDisabled,
  className,
}: MessageComposerProps) {
  const theme = useMessagesTheme()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const uploadFileRef = useRef<(file: File) => void>(() => {})
  const attachmentsRef = useRef(attachments)
  attachmentsRef.current = attachments
  const uploadChainRef = useRef<Promise<void>>(Promise.resolve())
  const activeUploadsRef = useRef(0)

  const setUploadingCount = useCallback((delta: number) => {
    activeUploadsRef.current = Math.max(0, activeUploadsRef.current + delta)
    setUploading(activeUploadsRef.current > 0)
  }, [])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none",
          "text-slate-900 dark:text-slate-100",
          "[&_p]:my-0.5 [&_ul]:my-1 [&_ol]:my-1",
          compact ? "text-[15px] leading-relaxed" : "text-sm",
        ),
        style: `min-height:${compact ? 24 : minHeight}px`,
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && !event.shiftKey && compact && showSend) {
          event.preventDefault()
          if (!isComposerEmpty(value, attachments) && !disabled && !sending) {
            onSubmit?.()
          }
          return true
        }
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
          onSubmit?.()
          return true
        }
        return false
      },
      handlePaste: (_view, event) => {
        const clipboard = event.clipboardData
        if (!clipboard) return false
        for (const item of clipboard.items) {
          if (item.kind !== "file") continue
          const file = item.getAsFile()
          if (
            file &&
            (file.type.startsWith("image/") ||
              /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(file.name))
          ) {
            event.preventDefault()
            uploadFileRef.current(file)
            return true
          }
        }
        return false
      },
      handleDrop: (_view, event) => {
        const file = event.dataTransfer?.files?.[0]
        if (
          file &&
          (file.type.startsWith("image/") ||
            /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(file.name))
        ) {
          event.preventDefault()
          uploadFileRef.current(file)
          return true
        }
        return false
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    if (!value || value === "<p></p>") {
      editor.commands.setContent("")
    }
  }, [value, editor])

  const insertEmoji = useCallback(
    (emoji: string) => {
      editor?.chain().focus().insertContent(emoji).run()
    },
    [editor],
  )

  const insertLink = useCallback(
    (rawUrl: string, label?: string) => {
      if (!editor) return
      const href = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`
      const text = (label?.trim() || href).replace(/</g, "")
      editor.chain().focus().insertContent(`<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a> `).run()
    },
    [editor],
  )

  const queueUpload = useCallback(
    (file: File) => {
      const localKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`
      const pending: MessageAttachmentDraft = {
        fileName: file.name || "Uploading…",
        fileUrl: "",
        mimeType: file.type || null,
        fileSize: file.size,
        uploadState: "uploading",
        localKey,
      }
      const withPending = [...attachmentsRef.current, pending]
      attachmentsRef.current = withPending
      onAttachmentsChange(withPending)

      const task = uploadChainRef.current.then(async () => {
        setUploadError(null)
        setUploadingCount(1)
        try {
          const uploaded = await uploadMessageAttachment(file)
          const next = attachmentsRef.current.map((a) =>
            a.localKey === localKey ? { ...uploaded, localKey: undefined } : a,
          )
          attachmentsRef.current = next
          onAttachmentsChange(next)
        } catch (e) {
          const next = attachmentsRef.current.filter((a) => a.localKey !== localKey)
          attachmentsRef.current = next
          onAttachmentsChange(next)
          setUploadError(e instanceof Error ? e.message : "Upload failed")
        } finally {
          setUploadingCount(-1)
        }
      })
      uploadChainRef.current = task.catch(() => undefined)
    },
    [onAttachmentsChange, setUploadingCount],
  )

  uploadFileRef.current = (file) => {
    queueUpload(file)
  }

  const hasContent = composerCanSend(value, attachments)

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {!compact && (
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-white/[0.06]">
          <FormatButton
            label="Bold"
            active={editor?.isActive("bold")}
            disabled={disabled || !editor}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold className="h-3.5 w-3.5" />
          </FormatButton>
          <FormatButton
            label="Italic"
            active={editor?.isActive("italic")}
            disabled={disabled || !editor}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-3.5 w-3.5" />
          </FormatButton>
          <FormatButton
            label="Underline"
            active={editor?.isActive("underline")}
            disabled={disabled || !editor}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </FormatButton>
          <span className="w-px h-5 bg-slate-200 dark:bg-white/10 mx-0.5" aria-hidden />
          <FormatButton
            label="Bullet list"
            active={editor?.isActive("bulletList")}
            disabled={disabled || !editor}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List className="h-3.5 w-3.5" />
          </FormatButton>
          <FormatButton
            label="Numbered list"
            active={editor?.isActive("orderedList")}
            disabled={disabled || !editor}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </FormatButton>
          <span className="w-px h-5 bg-slate-200 dark:bg-white/10 mx-0.5" aria-hidden />
          <FormatButton
            label="Insert link"
            active={editor?.isActive("link")}
            disabled={disabled || !editor}
            onClick={() => {
              const prev = editor?.getAttributes("link").href as string | undefined
              const url = window.prompt("Link URL", prev ?? "https://")
              if (url == null) return
              const trimmed = url.trim()
              if (!trimmed) {
                editor?.chain().focus().extendMarkRange("link").unsetLink().run()
                return
              }
              const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
              editor?.chain().focus().extendMarkRange("link").setLink({ href }).run()
            }}
          >
            <Link2 className="h-3.5 w-3.5" />
          </FormatButton>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {attachments.map((a) => (
            <div
              key={a.localKey ?? a.fileUrl ?? a.fileName}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-slate-800/90 pl-1.5 pr-1.5 py-1 text-xs shadow-sm max-w-full"
            >
              {a.uploadState === "uploading" ? (
                <Loader2 className={cn("h-8 w-8 animate-spin shrink-0 p-1.5", theme.page.iconText)} />
              ) : a.mimeType?.startsWith("image/") && a.fileUrl ? (
                <img
                  src={mediaDisplayUrl(a.fileUrl, "thumbnail")}
                  alt=""
                  className="h-8 w-8 rounded-lg object-cover shrink-0 bg-slate-100 dark:bg-slate-900"
                />
              ) : a.mimeType?.startsWith("image/") ? (
                <ImageIcon className={cn("h-3.5 w-3.5 shrink-0", theme.page.iconText)} />
              ) : (
                <FileText className={cn("h-3.5 w-3.5 shrink-0", theme.page.iconText)} />
              )}
              <span className="max-w-[120px] sm:max-w-[180px] truncate text-slate-700 dark:text-slate-200">
                {a.uploadState === "uploading" ? "Uploading…" : a.fileName}
              </span>
              <button
                type="button"
                aria-label={`Remove ${a.fileName}`}
                disabled={a.uploadState === "uploading"}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                onClick={() =>
                  onAttachmentsChange(attachments.filter((x) => (x.localKey ?? x.fileUrl) !== (a.localKey ?? a.fileUrl)))
                }
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Unified chat input bar */}
      <div
        className={cn(
          "flex items-end gap-1.5 sm:gap-2 rounded-[1.35rem] border p-1.5 sm:p-2 transition-shadow",
          "border-slate-200/90 dark:border-white/10",
          "bg-slate-50/90 dark:bg-slate-900/70",
          "shadow-sm focus-within:shadow-md",
          theme.page.border,
          "focus-within:ring-2 focus-within:ring-amber-500/15 dark:focus-within:ring-amber-500/25",
        )}
      >
        <div className="flex items-center shrink-0 pb-0.5">
          <ComposerPlusMenu
            disabled={disabled || uploading}
            uploading={uploading}
            side={compact ? "top" : "bottom"}
            onAttachFile={() => fileInputRef.current?.click()}
            onTakePhoto={() => cameraInputRef.current?.click()}
            onChoosePhoto={() => photoInputRef.current?.click()}
            onPickEmoji={insertEmoji}
            onInsertLink={insertLink}
          />
        </div>

        <div
          className={cn(
            "flex-1 min-w-0 rounded-2xl px-3 py-2",
            "bg-white/90 dark:bg-slate-950/50",
            "border border-transparent focus-within:border-slate-200/80 dark:focus-within:border-white/[0.08]",
          )}
        >
          <EditorContent editor={editor} />
        </div>

        {showSend && (
          <div className="pb-0.5 shrink-0">
            <SendButton
              compact={compact}
              hasContent={hasContent}
              disabled={disabled || sending}
              uploading={uploading}
              sending={sending}
              extraDisabled={sendDisabled}
              onClick={onSubmit}
            />
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.doc,.docx,.txt,.csv,.zip"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) queueUpload(file)
          e.target.value = ""
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) queueUpload(file)
          e.target.value = ""
        }}
      />
      <input
        ref={photoInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) queueUpload(file)
          e.target.value = ""
        }}
      />

      {uploadError && (
        <p className="px-1 text-xs text-red-600 dark:text-red-400">{uploadError}</p>
      )}

      {!compact && hasContent && (
        <p className="px-1 text-[10px] text-slate-400">⌘/Ctrl + Enter to send</p>
      )}

      {compact && (
        <p className="px-1 text-[10px] text-slate-400 hidden sm:block">Enter to send · Shift+Enter for new line</p>
      )}
    </div>
  )
}

export function isComposerEmpty(html: string, attachments: MessageAttachmentDraft[]): boolean {
  return !composerCanSend(html, attachments)
}
