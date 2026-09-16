"use client"

import { useEffect, useState } from "react"
import { Download, ExternalLink, Loader2, X } from "lucide-react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { openDesktopUrl } from "@/lib/desktop-open-url"
import { downloadAnnouncementAttachment } from "@/lib/announcement-attachments"
import { isPersistedMessageAttachmentUrl } from "@/lib/direct-messages/attachments"

type MessageImageLightboxProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  src: string
  alt?: string
  fileName?: string
  /** Original file URL for download / open in browser */
  downloadUrl?: string
}

export function MessageImageLightbox({
  open,
  onOpenChange,
  src,
  alt = "",
  fileName,
  downloadUrl,
}: MessageImageLightboxProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const label = fileName?.trim() || alt.trim() || "Image attachment"
  const externalUrl = downloadUrl?.trim() || src
  const canDownload = isPersistedMessageAttachmentUrl(externalUrl)

  async function handleDownload() {
    if (!canDownload) return
    setDownloading(true)
    try {
      await downloadAnnouncementAttachment({
        name: fileName?.trim() || "attachment",
        url: externalUrl,
        type: "",
      })
    } catch {
      void openDesktopUrl(externalUrl)
    } finally {
      setDownloading(false)
    }
  }

  useEffect(() => {
    if (!open) {
      setLoaded(false)
      setFailed(false)
    }
  }, [open, src])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "!fixed !inset-0 !top-0 !left-0 !right-0 !bottom-0",
          "!z-[80] !flex !h-[100dvh] !w-screen !max-w-none sm:!max-w-none md:!max-w-none lg:!max-w-none",
          "!translate-x-0 !translate-y-0",
          "flex-col gap-0 !rounded-none border-0 p-0 shadow-none",
          "!bg-black/94 text-white",
          "data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-95 duration-200",
        )}
        onPointerDownOutside={() => onOpenChange(false)}
      >
        <DialogTitle className="sr-only">{label}</DialogTitle>
        <DialogDescription className="sr-only">Full-size message attachment preview</DialogDescription>

        <header className="relative z-20 flex shrink-0 items-center gap-2 border-b border-white/[0.08] bg-black/40 px-3 py-2.5 backdrop-blur-md sm:px-4">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-white/90">{label}</p>
          <div className="flex shrink-0 items-center gap-0.5">
            {canDownload ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={downloading}
                  className="h-9 w-9 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-50"
                  aria-label="Download image"
                  onClick={() => void handleDownload()}
                >
                  {downloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-white/80 hover:bg-white/10 hover:text-white"
                  aria-label="Open in browser"
                  onClick={() => void openDesktopUrl(externalUrl)}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </>
            ) : null}
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
        </header>

        <div
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-6"
          onClick={() => onOpenChange(false)}
          role="presentation"
        >
          {!loaded && !failed ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-white/50" aria-hidden />
            </div>
          ) : null}
          {failed ? (
            <p className="max-w-sm text-center text-sm text-white/70">
              Could not load this image. Try opening it in your browser instead.
            </p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt={alt || label}
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "max-h-[calc(100dvh-4.5rem)] max-w-full object-contain transition-opacity duration-200",
                "rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.55)] ring-1 ring-white/10",
                loaded ? "opacity-100" : "opacity-0",
              )}
            />
          )}
        </div>

        <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[11px] text-white/40 sm:bottom-4">
          Click outside the image or press Esc to close
        </p>
      </DialogContent>
    </Dialog>
  )
}
