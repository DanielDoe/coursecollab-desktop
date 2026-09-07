"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Crop, Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type CropRect = { x: number; y: number; width: number; height: number }

const MIN_CROP_PX = 24

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeRect(rect: CropRect, bounds: { width: number; height: number }): CropRect | null {
  const x = clamp(rect.x, 0, bounds.width)
  const y = clamp(rect.y, 0, bounds.height)
  const width = clamp(rect.width, 0, bounds.width - x)
  const height = clamp(rect.height, 0, bounds.height - y)
  if (width < MIN_CROP_PX || height < MIN_CROP_PX) return null
  return { x, y, width, height }
}

function defaultCropRect(displayWidth: number, displayHeight: number): CropRect {
  const marginX = displayWidth * 0.05
  const marginY = displayHeight * 0.05
  return {
    x: marginX,
    y: marginY,
    width: displayWidth - marginX * 2,
    height: displayHeight - marginY * 2,
  }
}

function isSameOriginUrl(url: string): boolean {
  if (url.startsWith("/")) return true
  try {
    return new URL(url, window.location.origin).origin === window.location.origin
  } catch {
    return false
  }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageUrl: string
  onCropped: (file: File) => void | Promise<void>
}

export function QuestionMediaCropDialog({ open, onOpenChange, imageUrl, onCropped }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; origin: CropRect } | null>(null)

  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number } | null>(null)
  const [cropRect, setCropRect] = useState<CropRect | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const syncDisplaySize = useCallback(() => {
    const img = imageRef.current
    if (!img || !img.clientWidth || !img.clientHeight) return
    const next = { width: img.clientWidth, height: img.clientHeight }
    setDisplaySize(next)
    setCropRect((prev) => prev ?? defaultCropRect(next.width, next.height))
  }, [])

  useEffect(() => {
    if (!open) return
    setNaturalSize(null)
    setDisplaySize(null)
    setCropRect(null)
    setLoadError(null)
    setIsApplying(false)
  }, [open, imageUrl])

  useEffect(() => {
    if (!open) return
    const onResize = () => syncDisplaySize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [open, syncDisplaySize])

  const pointerToLocal = (clientX: number, clientY: number) => {
    const img = imageRef.current
    if (!img) return null
    const bounds = img.getBoundingClientRect()
    return {
      x: clamp(clientX - bounds.left, 0, bounds.width),
      y: clamp(clientY - bounds.top, 0, bounds.height),
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!displaySize) return
    const point = pointerToLocal(event.clientX, event.clientY)
    if (!point) return
    dragRef.current = { startX: point.x, startY: point.y, origin: { x: point.x, y: point.y, width: 0, height: 0 } }
    setCropRect({ x: point.x, y: point.y, width: 0, height: 0 })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || !displaySize) return
    const point = pointerToLocal(event.clientX, event.clientY)
    if (!point) return
    const x = Math.min(drag.startX, point.x)
    const y = Math.min(drag.startY, point.y)
    const width = Math.abs(point.x - drag.startX)
    const height = Math.abs(point.y - drag.startY)
    setCropRect(normalizeRect({ x, y, width, height }, displaySize) ?? { x, y, width, height })
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setCropRect((prev) => {
      if (!prev || !displaySize) return prev
      return normalizeRect(prev, displaySize) ?? defaultCropRect(displaySize.width, displaySize.height)
    })
  }

  const resetCrop = () => {
    if (!displaySize) return
    setCropRect(defaultCropRect(displaySize.width, displaySize.height))
  }

  const applyCrop = async () => {
    const img = imageRef.current
    if (!img || !naturalSize || !displaySize || !cropRect) return

    const scaleX = naturalSize.width / displaySize.width
    const scaleY = naturalSize.height / displaySize.height
    const sx = Math.round(cropRect.x * scaleX)
    const sy = Math.round(cropRect.y * scaleY)
    const sw = Math.round(cropRect.width * scaleX)
    const sh = Math.round(cropRect.height * scaleY)

    const canvas = document.createElement("canvas")
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)

    setIsApplying(true)
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.95))
      if (!blob) throw new Error("Could not export cropped image")
      const file = new File([blob], "cropped-diagram.png", { type: "image/png" })
      await onCropped(file)
      onOpenChange(false)
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crop className="h-5 w-5" />
            Crop circuit diagram
          </DialogTitle>
          <DialogDescription>
            Drag on the image to select the circuit area. Margins and page chrome will be trimmed from the saved figure.
          </DialogDescription>
        </DialogHeader>

        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : (
          <div className="flex justify-center overflow-hidden rounded-lg border bg-muted/30">
            <div ref={containerRef} className="relative inline-block max-w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                src={imageUrl}
                alt="Diagram to crop"
                crossOrigin={isSameOriginUrl(imageUrl) ? undefined : "anonymous"}
                className="block max-h-[min(70vh,560px)] w-auto max-w-full select-none"
                draggable={false}
                onLoad={(e) => {
                  const target = e.currentTarget
                  setNaturalSize({ width: target.naturalWidth, height: target.naturalHeight })
                  requestAnimationFrame(() => syncDisplaySize())
                }}
                onError={() =>
                  setLoadError(
                    "Could not load the diagram for cropping. Use an uploaded or same-origin image URL.",
                  )
                }
              />

              {displaySize && cropRect ? (
                <div
                  className="absolute inset-0 touch-none"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                >
                  <div
                    className="pointer-events-none absolute left-0 right-0 top-0 bg-black/50"
                    style={{ height: cropRect.y }}
                  />
                  <div
                    className="pointer-events-none absolute left-0 bg-black/50"
                    style={{ top: cropRect.y, width: cropRect.x, height: cropRect.height }}
                  />
                  <div
                    className="pointer-events-none absolute right-0 bg-black/50"
                    style={{
                      top: cropRect.y,
                      left: cropRect.x + cropRect.width,
                      height: cropRect.height,
                    }}
                  />
                  <div
                    className="pointer-events-none absolute left-0 right-0 bottom-0 bg-black/50"
                    style={{ top: cropRect.y + cropRect.height }}
                  />
                  <div
                    className="pointer-events-none absolute border-2 border-primary ring-1 ring-white/40"
                    style={{
                      left: cropRect.x,
                      top: cropRect.y,
                      width: cropRect.width,
                      height: cropRect.height,
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={resetCrop} disabled={!displaySize || isApplying}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset selection
          </Button>
          <Button type="button" onClick={applyCrop} disabled={!cropRect || isApplying || Boolean(loadError)}>
            {isApplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Crop className="mr-2 h-4 w-4" />}
            Apply crop &amp; update figure
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
