"use client"

import { cn } from "@/lib/utils"
import { RESIZE_HANDLES, type ResizeHandle } from "@/hooks/use-resizable-dialog-size"

/** Invisible edge/corner hit zones — OS-style resize (cursor change only, no visible grips). */
const EDGE_HIT_ZONES: Record<ResizeHandle, string> = {
  n: "top-0 left-5 right-5 h-3",
  s: "bottom-0 left-5 right-5 h-3",
  e: "right-0 top-5 bottom-5 w-3",
  w: "left-0 top-5 bottom-5 w-3",
  ne: "top-0 right-0 h-5 w-5",
  nw: "top-0 left-0 h-5 w-5",
  se: "bottom-0 right-0 h-5 w-5",
  sw: "bottom-0 left-0 h-5 w-5",
}

export function ResizableDialogHandles({
  createResizeHandleProps,
  className,
}: {
  createResizeHandleProps: (handle: ResizeHandle) => {
    style: { cursor: string }
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void
  }
  className?: string
}) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 z-50", className)}>
      {RESIZE_HANDLES.map((handle) => {
        const props = createResizeHandleProps(handle)
        return (
          <div
            key={handle}
            role="separator"
            aria-orientation={
              handle === "n" || handle === "s"
                ? "horizontal"
                : handle === "e" || handle === "w"
                  ? "vertical"
                  : undefined
            }
            aria-label={`Resize ${handle}`}
            {...props}
            className={cn(
              "pointer-events-auto absolute touch-none bg-transparent",
              "hover:bg-slate-500/15 dark:hover:bg-slate-300/10",
              EDGE_HIT_ZONES[handle],
            )}
          />
        )
      })}
    </div>
  )
}
