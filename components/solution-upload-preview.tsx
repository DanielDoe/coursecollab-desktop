"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { ChevronLeft, ChevronRight, ExternalLink, Maximize2, X, ZoomIn } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ResizableDialogHandles } from "@/components/resizable-dialog-handles"
import { useResizableDialogSize } from "@/hooks/use-resizable-dialog-size"
import type { SolutionUploadAttachment } from "@/lib/solution-upload"
import { solutionImageDisplayUrl } from "@/lib/heic-image"
import { renderPdfBytesToDataUrl } from "@/lib/circuit-workspace-attach"

function isPdfUpload(upload: SolutionUploadAttachment): boolean {
  return (
    upload.mime === "application/pdf" || upload.name?.toLowerCase().endsWith(".pdf")
  )
}

function isImageUpload(upload: SolutionUploadAttachment): boolean {
  const mime = (upload.mime || "").toLowerCase()
  if (mime.startsWith("image/")) return true
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(upload.name || "")
}

function imageSrc(upload: SolutionUploadAttachment): string {
  return solutionImageDisplayUrl(upload.url, upload.mime, upload.name)
}

function PdfInlinePreview({
  upload,
  canExpand,
  onExpand,
}: {
  upload: SolutionUploadAttachment
  canExpand: boolean
  onExpand: () => void
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [useIframeFallback, setUseIframeFallback] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setUseIframeFallback(false)
    setThumbUrl(null)

    ;(async () => {
      try {
        const res = await fetch(upload.url, { mode: "cors" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const dataUrl = await renderPdfBytesToDataUrl(await res.arrayBuffer(), 1.1)
        if (!cancelled) {
          setThumbUrl(dataUrl)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setUseIframeFallback(true)
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [upload.url])

  const previewShell = (children: ReactNode) => (
    <button
      type="button"
      onClick={() => canExpand && onExpand()}
      disabled={!canExpand}
      className={cn(
        "relative w-full rounded-md overflow-hidden border border-slate-200/80 dark:border-slate-600 bg-white dark:bg-slate-900",
        canExpand && "cursor-zoom-in group",
      )}
    >
      {children}
      {canExpand ? (
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-slate-900/75 text-white text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <ZoomIn className="h-3 w-3" />
          Expand
        </span>
      ) : null}
    </button>
  )

  if (loading) {
    return (
      <div className="w-full rounded-md border border-slate-200/80 dark:border-slate-600 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="flex h-48 items-center justify-center animate-pulse bg-slate-100 dark:bg-slate-800/80">
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading PDF preview…</p>
        </div>
      </div>
    )
  }

  if (useIframeFallback) {
    return previewShell(
      <iframe
        src={`${upload.url}#toolbar=0&view=FitH`}
        title={upload.name || "PDF solution preview"}
        className="h-56 w-full border-0 bg-white pointer-events-none"
      />,
    )
  }

  if (!thumbUrl) {
    return previewShell(
      <div className="flex h-48 items-center justify-center p-4 text-center">
        <p className="text-xs text-slate-500 dark:text-slate-400">Click Expand to open PDF</p>
      </div>,
    )
  }

  return previewShell(
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={thumbUrl}
      alt={upload.name || "PDF solution preview"}
      className="max-h-64 w-full object-contain bg-white"
    />,
  )
}

function ExpandedSolutionContent({ upload }: { upload: SolutionUploadAttachment }) {
  if (isPdfUpload(upload)) {
    return (
      <div className="flex flex-col w-full h-full min-h-0 gap-3">
        <iframe
          src={`${upload.url}#toolbar=1`}
          title={upload.name || "Solution PDF"}
          className="w-full flex-1 min-h-0 rounded-lg border border-slate-700 bg-white"
        />
        <a
          href={upload.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-indigo-300 hover:text-indigo-200 self-start"
        >
          <ExternalLink className="h-4 w-4" />
          Open PDF in new tab
        </a>
      </div>
    )
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={imageSrc(upload)}
      alt={upload.name || "Student solution"}
      draggable={false}
      className="max-w-full max-h-full w-auto h-auto object-contain select-none"
    />
  )
}

export function SolutionUploadPreview({
  upload,
  uploads,
  index = 0,
  pageLabel,
  allowExpand = true,
  className,
}: {
  upload: SolutionUploadAttachment
  /** When provided, expanded view supports prev/next between pages. */
  uploads?: SolutionUploadAttachment[]
  index?: number
  pageLabel?: string
  allowExpand?: boolean
  className?: string
}) {
  const [expandedOpen, setExpandedOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(index)
  const { size: dialogSize, createResizeHandleProps } = useResizableDialogSize(expandedOpen)
  const gallery = uploads && uploads.length > 0 ? uploads : [upload]
  const activeUpload = gallery[activeIndex] ?? upload
  const canExpand = allowExpand && (isImageUpload(activeUpload) || isPdfUpload(activeUpload))
  const hasGallery = gallery.length > 1

  useEffect(() => {
    setActiveIndex(index)
  }, [index, upload.url])

  const goPrev = useCallback(() => {
    setActiveIndex((i) => (i <= 0 ? gallery.length - 1 : i - 1))
  }, [gallery.length])

  const goNext = useCallback(() => {
    setActiveIndex((i) => (i >= gallery.length - 1 ? 0 : i + 1))
  }, [gallery.length])

  useEffect(() => {
    if (!expandedOpen || !hasGallery) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev()
      if (e.key === "ArrowRight") goNext()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [expandedOpen, hasGallery, goPrev, goNext])

  const label = pageLabel ?? activeUpload.name ?? "Student solution"

  if (isPdfUpload(upload) && !allowExpand) {
    return (
      <div className={cn("rounded-lg border border-slate-200 dark:border-slate-600 p-3 bg-white dark:bg-slate-900/40", className)}>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{upload.name}</p>
        <a
          href={upload.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-indigo-600 dark:text-indigo-400 underline mt-1 inline-block"
        >
          Open PDF
        </a>
      </div>
    )
  }

  return (
    <>
      <div
        className={cn(
          "rounded-lg border border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-950/20 p-3 space-y-2",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200 truncate min-w-0">
            {pageLabel ?? upload.name}
          </p>
          {canExpand ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 gap-1 text-xs border-emerald-300/80 dark:border-emerald-700"
              onClick={() => setExpandedOpen(true)}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Expand
            </Button>
          ) : isPdfUpload(upload) ? (
            <a
              href={upload.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 dark:text-indigo-400 underline shrink-0"
            >
              Open PDF
            </a>
          ) : null}
        </div>

        {isPdfUpload(upload) ? (
          <PdfInlinePreview
            upload={upload}
            canExpand={canExpand}
            onExpand={() => setExpandedOpen(true)}
          />
        ) : (
          <button
            type="button"
            onClick={() => canExpand && setExpandedOpen(true)}
            disabled={!canExpand}
            className={cn(
              "relative w-full rounded-md overflow-hidden border border-slate-200/80 dark:border-slate-600 bg-white dark:bg-slate-900",
              canExpand && "cursor-zoom-in group",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc(upload)}
              alt={upload.name || "Uploaded solution"}
              className="max-h-64 w-full object-contain"
            />
            {canExpand ? (
              <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-slate-900/75 text-white text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <ZoomIn className="h-3 w-3" />
                Expand
              </span>
            ) : null}
          </button>
        )}
      </div>

      {canExpand ? (
        <Dialog open={expandedOpen} onOpenChange={setExpandedOpen}>
          <DialogContent
            showCloseButton={false}
            className="!flex !flex-col !gap-0 !p-0 !max-w-none sm:!max-w-none overflow-visible"
            style={{
              width: dialogSize.width,
              height: dialogSize.height,
              maxWidth: dialogSize.width,
              maxHeight: dialogSize.height,
              pointerEvents: "auto",
            }}
            onInteractOutside={(e) => {
              if (document.body.style.userSelect === "none") e.preventDefault()
            }}
          >
            <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg ring-1 ring-slate-200/80 dark:ring-slate-700/80">
            <DialogHeader className="px-4 pt-4 pb-2 pr-12 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <DialogTitle className="text-sm font-semibold truncate pr-2">
                {label}
                {hasGallery ? (
                  <span className="text-slate-500 dark:text-slate-400 font-normal ml-2">
                    ({activeIndex + 1} of {gallery.length})
                  </span>
                ) : null}
              </DialogTitle>
            </DialogHeader>

            <button
              type="button"
              className="absolute right-3 top-3 z-30 rounded-full bg-slate-900/80 text-white p-2 hover:bg-slate-900"
              onClick={() => setExpandedOpen(false)}
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative flex-1 flex min-h-0 p-4 bg-slate-950/95 overflow-hidden">
              {hasGallery ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full shadow-lg"
                    onClick={goPrev}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full shadow-lg"
                    onClick={goNext}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              ) : null}
              <div className="flex h-full w-full min-h-0 items-center justify-center">
                <ExpandedSolutionContent upload={activeUpload} />
              </div>
            </div>

            {hasGallery ? (
              <div className="shrink-0 px-4 py-2 border-t border-slate-200 dark:border-slate-700 flex gap-2 overflow-x-auto">
                {gallery.map((file, i) => (
                  <button
                    key={`${file.url}-${i}`}
                    type="button"
                    onClick={() => setActiveIndex(i)}
                    className={cn(
                      "shrink-0 rounded-md border-2 overflow-hidden w-14 h-14 bg-white dark:bg-slate-900",
                      i === activeIndex
                        ? "border-indigo-500 ring-2 ring-indigo-500/30"
                        : "border-slate-300 dark:border-slate-600 opacity-80 hover:opacity-100",
                    )}
                  >
                    {isPdfUpload(file) ? (
                      <span className="flex h-full w-full items-center justify-center text-[9px] text-slate-600 dark:text-slate-300 px-1">
                        PDF
                      </span>
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={imageSrc(file)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </button>
                ))}
              </div>
            ) : null}
              <ResizableDialogHandles createResizeHandleProps={createResizeHandleProps} />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
