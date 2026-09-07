"use client"

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

const MIN_WIDTH = 400
const MIN_HEIGHT = 320

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"

export type DialogSize = { width: number; height: number }

function getViewportCaps() {
  if (typeof window === "undefined") {
    return { maxW: 1200, maxH: 900, defaultW: 960, defaultH: 720 }
  }
  return {
    maxW: Math.floor(window.innerWidth * 0.98),
    maxH: Math.floor(window.innerHeight * 0.95),
    defaultW: Math.min(Math.floor(window.innerWidth * 0.92), 1100),
    defaultH: Math.floor(window.innerHeight * 0.82),
  }
}

function clampSize(width: number, height: number): DialogSize {
  const { maxW, maxH } = getViewportCaps()
  return {
    width: Math.max(MIN_WIDTH, Math.min(maxW, Math.round(width))),
    height: Math.max(MIN_HEIGHT, Math.min(maxH, Math.round(height))),
  }
}

export const RESIZE_HANDLE_CURSORS: Record<ResizeHandle, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
  sw: "nesw-resize",
}

export const RESIZE_HANDLES: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]

export function useResizableDialogSize(open: boolean) {
  const [size, setSize] = useState<DialogSize>(() => {
    const { defaultW, defaultH } = getViewportCaps()
    return { width: defaultW, height: defaultH }
  })
  const sizeRef = useRef(size)
  sizeRef.current = size
  const dragRef = useRef<{
    handle: ResizeHandle
    startX: number
    startY: number
    startW: number
    startH: number
  } | null>(null)

  useEffect(() => {
    if (!open) return
    const { defaultW, defaultH } = getViewportCaps()
    setSize({ width: defaultW, height: defaultH })

    const onWindowResize = () => {
      setSize((prev) => clampSize(prev.width, prev.height))
    }
    window.addEventListener("resize", onWindowResize)
    return () => window.removeEventListener("resize", onWindowResize)
  }, [open])

  const applyDragDelta = useCallback((clientX: number, clientY: number) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = clientX - drag.startX
    const dy = clientY - drag.startY
    let width = drag.startW
    let height = drag.startH
    const h = drag.handle
    if (h.includes("e")) width += dx
    if (h.includes("w")) width -= dx
    if (h.includes("s")) height += dy
    if (h.includes("n")) height -= dy
    setSize(clampSize(width, height))
  }, [])

  const endResize = useCallback(() => {
    dragRef.current = null
    document.body.style.userSelect = ""
    document.body.style.cursor = ""
  }, [])

  useEffect(() => {
    const onDocumentPointerMove = (e: PointerEvent) => {
      if (!dragRef.current) return
      e.preventDefault()
      applyDragDelta(e.clientX, e.clientY)
    }
    const onDocumentPointerUp = () => {
      if (!dragRef.current) return
      endResize()
    }
    document.addEventListener("pointermove", onDocumentPointerMove, { passive: false })
    document.addEventListener("pointerup", onDocumentPointerUp)
    document.addEventListener("pointercancel", onDocumentPointerUp)
    return () => {
      document.removeEventListener("pointermove", onDocumentPointerMove)
      document.removeEventListener("pointerup", onDocumentPointerUp)
      document.removeEventListener("pointercancel", onDocumentPointerUp)
    }
  }, [applyDragDelta, endResize])

  const createResizeHandleProps = useCallback(
    (handle: ResizeHandle) => ({
      style: { cursor: RESIZE_HANDLE_CURSORS[handle] } as const,
      onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        dragRef.current = {
          handle,
          startX: e.clientX,
          startY: e.clientY,
          startW: sizeRef.current.width,
          startH: sizeRef.current.height,
        }
        document.body.style.userSelect = "none"
        document.body.style.cursor = RESIZE_HANDLE_CURSORS[handle]
        e.currentTarget.setPointerCapture(e.pointerId)
      },
      onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!dragRef.current || dragRef.current.handle !== handle) return
        e.preventDefault()
        applyDragDelta(e.clientX, e.clientY)
      },
      onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!dragRef.current || dragRef.current.handle !== handle) return
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
        endResize()
      },
      onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
        endResize()
      },
    }),
    [applyDragDelta, endResize],
  )

  return { size, createResizeHandleProps, endResize }
}
