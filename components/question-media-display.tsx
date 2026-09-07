"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ZoomIn, X, ImageOff, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  hasActiveQuestionMedia,
  isPublicMediaUrl,
  resolveQuestionMedia,
  type QuestionMedia,
  type QuestionMediaPlacement,
} from "@/lib/question-media"
import { questionMediaDisplayUrl } from "@/lib/question-media-proxy"

function MediaAsset({
  media,
  className,
  onZoom,
}: {
  media: QuestionMedia
  className?: string
  onZoom?: () => void
}) {
  const rawUrl = (media.media_url || "").trim()
  const alt = media.media_alt_text || media.media_caption || "Question diagram"
  const type = media.media_type || "image"
  const [retryKey, setRetryKey] = useState(0)
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading")

  const displayUrl = useMemo(() => {
    const base = questionMediaDisplayUrl(rawUrl)
    if (!base || retryKey === 0) return base
    const sep = base.includes("?") ? "&" : "?"
    return `${base}${sep}_r=${retryKey}`
  }, [rawUrl, retryKey])

  useEffect(() => {
    setStatus("loading")
  }, [displayUrl])

  if (!isPublicMediaUrl(rawUrl)) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Media reference: <code className="text-xs break-all">{rawUrl}</code>
      </p>
    )
  }

  if (type === "pdf") {
    return (
      <iframe
        src={`${displayUrl}#toolbar=0`}
        title={alt}
        className={cn("w-full min-h-[280px] max-h-[min(420px,55vh)] rounded-lg border-0 bg-white dark:bg-slate-900", className)}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
      />
    )
  }

  return (
    <div className="relative w-full flex justify-center">
      {status === "loading" ? (
        <div className={cn("flex items-center justify-center text-slate-400", className, "min-h-[120px] w-full")}>
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          <span className="sr-only">Loading diagram…</span>
        </div>
      ) : null}
      {status === "error" ? (
        <button
          type="button"
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 p-4 text-sm",
            className,
            "min-h-[120px] w-full",
          )}
          onClick={() => {
            setRetryKey((k) => k + 1)
            setStatus("loading")
          }}
        >
          <ImageOff className="h-6 w-6" />
          Diagram did not load. Tap to retry.
        </button>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={displayUrl}
        alt={alt}
        draggable={false}
        loading="eager"
        decoding="async"
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "max-w-full h-auto object-contain select-none",
          media.media_allow_zoom !== false && onZoom && "cursor-zoom-in",
          status !== "loaded" && "sr-only absolute opacity-0 pointer-events-none",
          className,
        )}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        onClick={() => {
          if (media.media_allow_zoom !== false && onZoom) onZoom()
        }}
      />
    </div>
  )
}

export function QuestionMediaDisplay({
  question,
  className,
  compact = false,
  /** Between compact (drawers) and default (full quiz layout). */
  size,
}: {
  question: { question_media?: unknown; circuit_spec?: unknown }
  className?: string
  /** Smaller inline diagram for drawers and compact layouts. */
  compact?: boolean
  size?: "compact" | "medium" | "default" | "large"
}) {
  const media = resolveQuestionMedia(question)
  const [zoomOpen, setZoomOpen] = useState(false)

  if (!hasActiveQuestionMedia(media)) return null

  const resolvedSize = size ?? (compact ? "compact" : "default")
  const canZoom = media.media_allow_zoom !== false && media.media_type !== "pdf"

  const sizeStyles = {
    compact: {
      image: "max-h-[min(160px,28vh)] max-w-[min(240px,100%)]",
      figure: "mx-auto max-w-[260px]",
      padding: "p-1.5",
    },
    medium: {
      image: "max-h-[min(260px,42vh)] max-w-[min(420px,100%)]",
      figure: "mx-auto max-w-[440px]",
      padding: "p-2 sm:p-2.5",
    },
    default: {
      image: "max-h-[min(360px,55vh)]",
      figure: "",
      padding: "p-2 sm:p-3",
    },
    large: {
      image: "max-h-[min(420px,60vh)]",
      figure: "mx-auto max-w-full",
      padding: "p-2 sm:p-3",
    },
  } as const

  const styles = sizeStyles[resolvedSize as keyof typeof sizeStyles] ?? sizeStyles.default

  return (
    <>
      <figure
        className={cn(
          "rounded-xl border border-slate-200/80 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/50 overflow-hidden",
          styles.figure,
          className,
        )}
      >
        <div
          className={cn(
            "relative flex justify-center bg-white/60 dark:bg-slate-900/40",
            styles.padding,
          )}
        >
          <MediaAsset
            media={media}
            className={styles.image}
            onZoom={canZoom ? () => setZoomOpen(true) : undefined}
          />
          {canZoom ? (
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-slate-900/70 text-white text-[10px] px-2 py-1 pointer-events-none">
              <ZoomIn className="h-3 w-3" />
              Zoom
            </span>
          ) : null}
        </div>
        {media.media_caption ? (
          <figcaption className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200/70 dark:border-slate-600">
            {media.media_caption}
          </figcaption>
        ) : null}
      </figure>

      {canZoom ? (
        <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
          <DialogContent className="max-w-[min(96vw,1100px)] max-h-[92vh] p-0 overflow-hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>{media.media_alt_text || "Diagram preview"}</DialogTitle>
            </DialogHeader>
            <button
              type="button"
              className="absolute right-3 top-3 z-10 rounded-full bg-slate-900/80 text-white p-2"
              onClick={() => setZoomOpen(false)}
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center justify-center p-4 bg-slate-950/95 min-h-[40vh] max-h-[85vh] overflow-auto">
              <MediaAsset media={media} className="max-h-[80vh]" />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}

export function QuestionStemWithMedia({
  question,
  children,
  placementOverride,
}: {
  question: { question_media?: unknown; circuit_spec?: unknown }
  children: ReactNode
  placementOverride?: QuestionMediaPlacement
}) {
  const media = resolveQuestionMedia(question)
  if (!hasActiveQuestionMedia(media)) {
    return <>{children}</>
  }

  const placement = placementOverride ?? media.media_placement ?? "above_question"
  const mediaEl = <QuestionMediaDisplay question={question} />

  if (placement === "side_by_side") {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-start mb-4">
        <div className="min-w-0">{mediaEl}</div>
        <div className="min-w-0 space-y-4">{children}</div>
      </div>
    )
  }

  if (placement === "below_question") {
    return (
      <div className="space-y-4 mb-4">
        {children}
        {mediaEl}
      </div>
    )
  }

  return (
    <div className="space-y-4 mb-4">
      {mediaEl}
      {children}
    </div>
  )
}
