"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type CampImageLightboxProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  src: string
  alt?: string
  caption?: string
}

const CAPTION_BLOCK_PX = 52
const MODAL_PADDING_X = 32
const MODAL_PADDING_Y = 32

function getViewportLimits(hasCaption: boolean) {
  if (typeof window === "undefined") {
    return { maxWidth: 1200, maxHeight: 800 }
  }
  return {
    maxWidth: Math.min(window.innerWidth * 0.96, 1400),
    maxHeight: window.innerHeight * 0.9 - (hasCaption ? CAPTION_BLOCK_PX : 0) - MODAL_PADDING_Y,
  }
}

/** Fit image inside viewport; wide images grow horizontally, tall images grow vertically. */
function fitImageToViewport(
  naturalWidth: number,
  naturalHeight: number,
  limits: { maxWidth: number; maxHeight: number },
) {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { width: limits.maxWidth, height: limits.maxHeight }
  }

  const aspect = naturalWidth / naturalHeight
  let width = limits.maxWidth
  let height = width / aspect

  if (height > limits.maxHeight) {
    height = limits.maxHeight
    width = height * aspect
  }

  // Avoid upscaling small assets beyond their native resolution.
  if (width > naturalWidth && height > naturalHeight) {
    width = naturalWidth
    height = naturalHeight
  }

  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  }
}

/** Full-screen immersive image viewer — modal size follows each image's aspect ratio. */
export function CampImageLightbox({
  open,
  onOpenChange,
  src,
  alt = "",
  caption,
}: CampImageLightboxProps) {
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
  const [viewportTick, setViewportTick] = useState(0)

  const hasCaption = Boolean(caption || alt)

  useEffect(() => {
    if (!open) {
      setNaturalSize(null)
    }
  }, [open, src])

  useEffect(() => {
    if (!open) return
    const onResize = () => setViewportTick((n) => n + 1)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [open])

  const fitted = useMemo(() => {
    void viewportTick
    if (!naturalSize) return null
    return fitImageToViewport(naturalSize.width, naturalSize.height, getViewportLimits(hasCaption))
  }, [naturalSize, hasCaption, viewportTick])

  const onImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
  }, [])

  const modalWidth = fitted ? fitted.width + MODAL_PADDING_X : undefined
  const modalMaxHeight = fitted ? fitted.height + MODAL_PADDING_Y + (hasCaption ? CAPTION_BLOCK_PX : 0) : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 overflow-hidden p-0",
          "border-white/10 bg-slate-950/98 text-white shadow-2xl",
          "w-auto max-w-[96vw] transition-[width,max-height] duration-200 ease-out",
          !fitted && "max-w-[min(96vw,1400px)]",
        )}
        style={
          fitted
            ? {
                width: modalWidth,
                maxHeight: modalMaxHeight,
              }
            : undefined
        }
        showCloseButton
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{alt || "Image preview"}</DialogTitle>
          <DialogDescription>Expanded camp module image</DialogDescription>
        </DialogHeader>
        <div
          className={cn(
            "flex items-center justify-center px-4 py-4 sm:px-4 sm:py-4",
            !fitted && "min-h-[min(50vh,480px)]",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={src}
            src={src}
            alt={alt}
            onLoad={onImageLoad}
            className={cn(
              "block object-contain transition-opacity duration-150",
              fitted ? "opacity-100" : "max-h-[min(78vh,880px)] max-w-full opacity-90",
            )}
            style={
              fitted
                ? {
                    width: fitted.width,
                    height: fitted.height,
                    maxWidth: "100%",
                    maxHeight: "100%",
                  }
                : undefined
            }
          />
        </div>
        {hasCaption ? (
          <div className="border-t border-white/10 px-4 py-3 text-center text-sm text-white/75">
            {caption || alt}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
