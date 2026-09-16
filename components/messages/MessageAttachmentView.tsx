"use client"

import { useMemo, useState } from "react"
import { Download, FileText, ImageOff, Maximize2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { openDesktopUrl } from "@/lib/desktop-open-url"
import { isHeicMimeOrName, solutionImageDisplayUrl } from "@/lib/heic-image"
import { mediaDisplayUrl } from "@/lib/media/display-url"
import {
  isMessageImageAttachment,
  isPersistedMessageAttachmentUrl,
} from "@/lib/direct-messages/attachments"
import type { MessageAttachment } from "@/lib/direct-messages/types"
import { MessageImageLightbox } from "@/components/messages/MessageImageLightbox"

type MessageAttachmentViewProps = {
  attachment: MessageAttachment
  isMine: boolean
}

function messageImageFullUrl(
  fileUrl: string,
  mimeType: string | null | undefined,
  fileName: string,
): string {
  if (isHeicMimeOrName(mimeType, fileName) || isHeicMimeOrName(null, fileUrl)) {
    return `/api/solution-image?url=${encodeURIComponent(fileUrl)}`
  }
  return mediaDisplayUrl(fileUrl, "full")
}

export function MessageAttachmentView({ attachment, isMine }: MessageAttachmentViewProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const valid = isPersistedMessageAttachmentUrl(attachment.fileUrl)
  const isImage = isMessageImageAttachment(attachment.mimeType, attachment.fileName)

  const thumbnailSrc = useMemo(
    () =>
      solutionImageDisplayUrl(attachment.fileUrl, attachment.mimeType, attachment.fileName),
    [attachment.fileUrl, attachment.mimeType, attachment.fileName],
  )
  const fullSrc = useMemo(
    () => messageImageFullUrl(attachment.fileUrl, attachment.mimeType, attachment.fileName),
    [attachment.fileUrl, attachment.mimeType, attachment.fileName],
  )

  if (!valid) {
    return (
      <p
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs max-w-full",
          isMine
            ? "bg-white/10 text-white/90"
            : "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 border border-amber-200/80 dark:border-amber-800/50",
        )}
      >
        <ImageOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>Attachment did not upload — ask the sender to resend the file.</span>
      </p>
    )
  }

  if (isImage) {
    return (
      <>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className={cn(
            "group/att relative block max-w-full rounded-lg overflow-hidden border text-left transition-[opacity,box-shadow] hover:opacity-[0.98] hover:shadow-md",
            isMine ? "border-white/25" : "border-slate-200/80 dark:border-white/10",
          )}
        >
          <img
            src={thumbnailSrc}
            alt={attachment.fileName || "Image attachment"}
            className="max-h-72 max-w-full w-auto object-contain bg-black/5 dark:bg-black/20"
            loading="lazy"
          />
          <span
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/att:bg-black/25",
            )}
            aria-hidden
          >
            <span className="flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 backdrop-blur-sm transition-opacity group-hover/att:opacity-100 group-focus-visible/att:opacity-100">
              <Maximize2 className="h-3.5 w-3.5" />
              View full size
            </span>
          </span>
          {attachment.fileName ? (
            <span
              className={cn(
                "block px-2 py-1 text-[11px] truncate border-t",
                isMine
                  ? "border-white/15 text-white/85 bg-black/10"
                  : "border-slate-200/60 dark:border-white/10 text-slate-600 dark:text-slate-300 bg-black/[0.03] dark:bg-white/[0.04]",
              )}
            >
              {attachment.fileName}
            </span>
          ) : null}
        </button>
        <MessageImageLightbox
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          src={fullSrc}
          alt={attachment.fileName || "Image attachment"}
          fileName={attachment.fileName}
          downloadUrl={attachment.fileUrl}
        />
      </>
    )
  }

  return (
    <a
      href={attachment.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.preventDefault()
        void openDesktopUrl(attachment.fileUrl)
      }}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium w-fit max-w-full",
        isMine
          ? "bg-white/15 text-white hover:bg-white/20"
          : "bg-slate-200/80 dark:bg-slate-700/80 text-slate-800 dark:text-slate-100 hover:opacity-90",
      )}
    >
      <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{attachment.fileName || "Download file"}</span>
      <Download className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
    </a>
  )
}
