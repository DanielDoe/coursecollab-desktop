"use client"

import { useEffect, useRef, type RefObject } from "react"
import { cn } from "@/lib/utils"
import { CampScaledImage } from "@/components/summer-camp/CampScaledImage"
import { CampRichMarkdown } from "@/components/summer-camp/CampRichMarkdown"
import {
  canvasFigureStyle,
  normalizeImageTransform,
  placementFromCanvasPosition,
  wrapFigureStyle,
  type ImageFigureProps,
  type ImageTransform,
} from "@/lib/summer-camp/image-layout"

type Props = ImageFigureProps & {
  editable?: boolean
  onTransformChange?: (patch: Partial<ImageTransform>) => void
  className?: string
  containerRef?: RefObject<HTMLElement | null>
}

type DragMode = "move" | "resize-nw" | "resize-ne" | "resize-sw" | "resize-se"

type PixelBox = { left: number; top: number; width: number; height: number }

type DragSession = {
  mode: DragMode
  pointerId: number
  startPointerX: number
  startPointerY: number
  containerWidth: number
  containerHeight: number
  box: PixelBox
}

const MIN_WIDTH_PX = 48
const MIN_WIDTH_PCT = 12
const MAX_WIDTH_PCT = 88

const CORNER_HANDLES: { mode: DragMode; className: string }[] = [
  { mode: "resize-nw", className: "-left-1.5 -top-1.5 cursor-nwse-resize" },
  { mode: "resize-ne", className: "-right-1.5 -top-1.5 cursor-nesw-resize" },
  { mode: "resize-sw", className: "-left-1.5 -bottom-1.5 cursor-nesw-resize" },
  { mode: "resize-se", className: "-right-1.5 -bottom-1.5 cursor-nwse-resize" },
]

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function ImageContent({
  imageUrl,
  caption,
  alt,
  zoomable = true,
  selected = false,
}: {
  imageUrl?: string
  caption?: string
  alt?: string
  zoomable?: boolean
  selected?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card overflow-hidden shadow-sm",
        selected && "shadow-[inset_0_0_0_2px_rgb(124,58,237)]",
      )}
    >
      <CampScaledImage
        src={imageUrl ?? ""}
        alt={alt ?? caption ?? "Module image"}
        placeholder="Upload an image"
        aspectClass="aspect-[4/3]"
        imgClassName="object-contain p-2 bg-white dark:bg-slate-900 pointer-events-none"
        className="rounded-none border-0"
        zoomable={zoomable}
      />
      {caption?.trim() ? (
        <figcaption className="p-2.5 border-t border-dashboard-v2-border text-xs font-medium text-slate-700 dark:text-slate-200 pointer-events-none">
          {caption}
        </figcaption>
      ) : null}
    </div>
  )
}

function readFigureBox(figure: HTMLElement, container: HTMLElement): PixelBox {
  const c = container.getBoundingClientRect()
  const f = figure.getBoundingClientRect()
  return {
    left: f.left - c.left,
    top: f.top - c.top,
    width: f.width,
    height: f.height,
  }
}

function applyFigureBox(figure: HTMLElement, box: PixelBox, containerWidth: number, containerHeight: number) {
  figure.style.left = `${(box.left / containerWidth) * 100}%`
  figure.style.top = `${(box.top / containerHeight) * 100}%`
  figure.style.width = `${(box.width / containerWidth) * 100}%`
}

function clampBox(box: PixelBox, containerWidth: number, containerHeight: number): PixelBox {
  const width = clamp(box.width, MIN_WIDTH_PX, containerWidth)
  const height = Math.max(box.height, MIN_WIDTH_PX * 0.75)
  const left = clamp(box.left, 0, Math.max(0, containerWidth - width))
  const top = clamp(box.top, 0, Math.max(0, containerHeight - height))
  return { left, top, width, height }
}

function resizeBox(session: DragSession, pointerX: number, pointerY: number): PixelBox {
  const dx = pointerX - session.startPointerX
  const dy = pointerY - session.startPointerY
  const { box } = session
  const aspect = box.width / Math.max(box.height, 1)

  let left = box.left
  let top = box.top
  let width = box.width
  let height = box.height

  switch (session.mode) {
    case "resize-se": {
      const scale = Math.max((box.width + dx) / box.width, (box.height + dy) / box.height)
      width = box.width * scale
      height = width / aspect
      break
    }
    case "resize-nw": {
      const scale = Math.max((box.width - dx) / box.width, (box.height - dy) / box.height)
      width = box.width * scale
      height = width / aspect
      left = box.left + box.width - width
      top = box.top + box.height - height
      break
    }
    case "resize-ne": {
      const scale = Math.max((box.width + dx) / box.width, (box.height - dy) / box.height)
      width = box.width * scale
      height = width / aspect
      top = box.top + box.height - height
      break
    }
    case "resize-sw": {
      const scale = Math.max((box.width - dx) / box.width, (box.height + dy) / box.height)
      width = box.width * scale
      height = width / aspect
      left = box.left + box.width - width
      break
    }
    default:
      break
  }

  return clampBox({ left, top, width, height }, session.containerWidth, session.containerHeight)
}

function boxToTransform(box: PixelBox, containerWidth: number, containerHeight: number): Partial<ImageTransform> {
  const xPercent = clamp((box.left / containerWidth) * 100, 0, 92)
  const widthPercent = clamp((box.width / containerWidth) * 100, MIN_WIDTH_PCT, MAX_WIDTH_PCT)
  const yPercent = clamp((box.top / containerHeight) * 100, 0, 92)
  return {
    xPercent,
    yPercent,
    widthPercent,
    placement: placementFromCanvasPosition(xPercent),
  }
}

/** Click-and-drag image object with 4 corner resize handles (PowerPoint-style). */
export function CampDraggableImage({
  imageUrl,
  caption,
  alt,
  transform: rawTransform,
  editable = false,
  onTransformChange,
  className,
  containerRef,
}: Props) {
  const localContainerRef = useRef<HTMLDivElement>(null)
  const figureRef = useRef<HTMLElement>(null)
  const transform = normalizeImageTransform(rawTransform)
  const sessionRef = useRef<DragSession | null>(null)
  const rafRef = useRef<number | null>(null)
  const pendingPointerRef = useRef<{ x: number; y: number } | null>(null)
  const onTransformChangeRef = useRef(onTransformChange)
  onTransformChangeRef.current = onTransformChange

  const getContainer = () => containerRef?.current ?? localContainerRef.current?.parentElement

  const commitBox = (box: PixelBox, containerWidth: number, containerHeight: number) => {
    onTransformChangeRef.current?.(boxToTransform(box, containerWidth, containerHeight))
  }

  const applyPointer = (pointerX: number, pointerY: number) => {
    const session = sessionRef.current
    const figure = figureRef.current
    if (!session || !figure) return

    let nextBox: PixelBox

    if (session.mode === "move") {
      const dx = pointerX - session.startPointerX
      const dy = pointerY - session.startPointerY
      nextBox = clampBox(
        {
          left: session.box.left + dx,
          top: session.box.top + dy,
          width: session.box.width,
          height: session.box.height,
        },
        session.containerWidth,
        session.containerHeight,
      )
    } else {
      nextBox = resizeBox(session, pointerX, pointerY)
    }

    applyFigureBox(figure, nextBox, session.containerWidth, session.containerHeight)
  }

  const startSession = (mode: DragMode, e: React.PointerEvent) => {
    if (!editable || !onTransformChange) return
    e.preventDefault()
    e.stopPropagation()

    const container = getContainer()
    const figure = figureRef.current
    if (!container || !figure) return

    const cRect = container.getBoundingClientRect()
    const box = readFigureBox(figure, container)

    sessionRef.current = {
      mode,
      pointerId: e.pointerId,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      containerWidth: cRect.width,
      containerHeight: cRect.height,
      box,
    }

    figure.setPointerCapture(e.pointerId)
  }

  useEffect(() => {
    if (!editable) return

    const flush = () => {
      rafRef.current = null
      const pt = pendingPointerRef.current
      if (pt) applyPointer(pt.x, pt.y)
    }

    const onMove = (e: PointerEvent) => {
      if (!sessionRef.current || sessionRef.current.pointerId !== e.pointerId) return
      pendingPointerRef.current = { x: e.clientX, y: e.clientY }
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flush)
      }
    }

    const onUp = (e: PointerEvent) => {
      if (!sessionRef.current || sessionRef.current.pointerId !== e.pointerId) return

      const session = sessionRef.current
      const figure = figureRef.current
      if (figure) {
        try {
          figure.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        const box = readFigureBox(figure, getContainer()!)
        commitBox(box, session.containerWidth, session.containerHeight)
      }

      sessionRef.current = null
      pendingPointerRef.current = null
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [editable, containerRef])

  const figureStyle = canvasFigureStyle(transform)

  return (
    <div ref={localContainerRef} className={cn("pointer-events-none absolute inset-0", className)}>
      <figure
        ref={figureRef}
        style={figureStyle}
        className={cn(
          "relative m-0 pointer-events-auto select-none will-change-[left,top,width]",
          editable && "cursor-grab active:cursor-grabbing",
        )}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).dataset.resizeHandle) return
          startSession("move", e)
        }}
      >
        <ImageContent
          imageUrl={imageUrl}
          caption={caption}
          alt={alt}
          zoomable={false}
          selected={editable}
        />

        {editable
          ? CORNER_HANDLES.map(({ mode, className: handleClass }) => (
              <div
                key={mode}
                role="presentation"
                data-resize-handle="true"
                className={cn(
                  "absolute z-30 h-3.5 w-3.5 rounded-sm border-2 border-white bg-violet-600 shadow-md touch-none",
                  handleClass,
                )}
                onPointerDown={(e) => startSession(mode, e)}
              />
            ))
          : null}
      </figure>
    </div>
  )
}

export function CampPositionableImage(props: Props) {
  const transform = normalizeImageTransform(props.transform)
  const placement = transform.placement ?? "free"

  if (props.editable) {
    if (props.containerRef) {
      return <CampDraggableImage {...props} />
    }
    return (
      <div className="relative min-h-[240px] w-full">
        <CampDraggableImage {...props} />
      </div>
    )
  }

  if (placement === "wrap-left" || placement === "wrap-right") {
    const side = placement === "wrap-right" ? "right" : "left"
    return (
      <figure className="m-0" style={wrapFigureStyle(transform, side)}>
        <ImageContent imageUrl={props.imageUrl} caption={props.caption} alt={props.alt} />
      </figure>
    )
  }

  const containerRef = props.containerRef
  return (
    <div className="relative min-h-[200px] w-full">
      <CampDraggableImage {...props} containerRef={containerRef} />
    </div>
  )
}

export function CampTextWithWrappedImage({
  markdown,
  imageUrl,
  caption,
  alt,
  transform: rawTransform,
  omitLeadingSectionHeading,
  collapsibleMarkdownSections,
  editable,
  onTransformChange,
}: {
  markdown: string
  imageUrl?: string
  caption?: string
  alt?: string
  transform?: ImageTransform | Record<string, unknown> | null
  omitLeadingSectionHeading?: boolean
  collapsibleMarkdownSections?: boolean
  editable?: boolean
  onTransformChange?: (patch: Partial<ImageTransform>) => void
}) {
  const transform = normalizeImageTransform(rawTransform)
  const containerRef = useRef<HTMLDivElement>(null)
  const placement = transform.placement ?? "free"

  if (editable) {
    return (
      <div
        ref={containerRef}
        className="relative min-h-[360px] w-full rounded-xl border border-dashed border-violet-300/50 bg-white/40 dark:bg-slate-900/20 p-2"
      >
        <div className="relative z-0 min-h-[340px]">
          <CampRichMarkdown
            markdown={markdown}
            omitLeadingSectionHeading={omitLeadingSectionHeading}
            collapsibleSections={collapsibleMarkdownSections}
          />
        </div>
        <CampDraggableImage
          containerRef={containerRef}
          imageUrl={imageUrl}
          caption={caption}
          alt={alt}
          transform={transform}
          editable
          onTransformChange={onTransformChange}
        />
      </div>
    )
  }

  if (placement === "wrap-left" || placement === "wrap-right") {
    const side = placement === "wrap-right" ? "right" : "left"
    return (
      <div>
        <figure className="m-0" style={wrapFigureStyle(transform, side)}>
          <ImageContent imageUrl={imageUrl} caption={caption} alt={alt} />
        </figure>
        <CampRichMarkdown
          markdown={markdown}
          omitLeadingSectionHeading={omitLeadingSectionHeading}
          collapsibleSections={collapsibleMarkdownSections}
        />
        <div className="clear-both" />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative min-h-[280px] w-full">
      <div className="relative z-0">
        <CampRichMarkdown
          markdown={markdown}
          omitLeadingSectionHeading={omitLeadingSectionHeading}
          collapsibleSections={collapsibleMarkdownSections}
        />
      </div>
      <CampDraggableImage
        containerRef={containerRef}
        imageUrl={imageUrl}
        caption={caption}
        alt={alt}
        transform={transform}
      />
    </div>
  )
}
