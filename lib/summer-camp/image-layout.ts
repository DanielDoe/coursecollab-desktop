/** PowerPoint-style image placement + transform for camp module blocks. */

import type { CSSProperties } from "react"

export type ImagePlacement =
  | "columns"
  | "wrap-left"
  | "wrap-right"
  | "above"
  | "below"
  | "free"

export type ImageAlignH = "left" | "center" | "right"
export type ImageAlignV = "top" | "middle" | "bottom"

export type ImageTransform = {
  placement?: ImagePlacement
  /** Canvas position (% from left). */
  xPercent?: number
  /** Canvas position (% from top). */
  yPercent?: number
  widthPercent?: number
  /** @deprecated use xPercent / yPercent */
  offsetX?: number
  /** @deprecated use xPercent / yPercent */
  offsetY?: number
  alignH?: ImageAlignH
  alignV?: ImageAlignV
}

export const IMAGE_PLACEMENT_LABELS: Record<ImagePlacement, string> = {
  columns: "Side-by-side columns",
  "wrap-left": "Float left — text wraps",
  "wrap-right": "Float right — text wraps",
  above: "Image above text",
  below: "Image below text",
  free: "Free position",
}

export function defaultImageTransform(placement: ImagePlacement = "free"): ImageTransform {
  if (placement === "columns") {
    return { placement, xPercent: 58, yPercent: 0, widthPercent: 38, alignH: "center", alignV: "top" }
  }
  if (placement === "wrap-left") {
    return { placement, xPercent: 0, yPercent: 0, widthPercent: 42 }
  }
  if (placement === "wrap-right") {
    return { placement, xPercent: 58, yPercent: 0, widthPercent: 42 }
  }
  return { placement: "free", xPercent: 55, yPercent: 0, widthPercent: 38, alignH: "center", alignV: "top" }
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function migrateLegacyCoords(r: Record<string, unknown>, placement: ImagePlacement): {
  xPercent: number
  yPercent: number
} {
  if (r.xPercent != null || r.yPercent != null) {
    return {
      xPercent: clamp(Number(r.xPercent) || 0, 0, 92),
      yPercent: clamp(Number(r.yPercent) || 0, 0, 92),
    }
  }

  const ox = Number(r.offsetX) || 0
  const oy = Number(r.offsetY) || 0

  if (placement === "wrap-left") {
    return { xPercent: clamp(ox / 4, 0, 20), yPercent: clamp(oy / 4, 0, 40) }
  }
  if (placement === "wrap-right") {
    return { xPercent: clamp(58 + ox / 4, 40, 92), yPercent: clamp(oy / 4, 0, 40) }
  }
  if (placement === "columns") {
    return { xPercent: 58, yPercent: clamp(oy / 4, 0, 40) }
  }

  return {
    xPercent: clamp(50 + ox / 6, 0, 92),
    yPercent: clamp(oy / 4, 0, 92),
  }
}

export function normalizeImageTransform(raw?: ImageTransform | Record<string, unknown> | null): ImageTransform {
  const r = (raw ?? {}) as Record<string, unknown>
  const placement = (r.placement as ImagePlacement) || "free"
  const valid: ImagePlacement[] = ["columns", "wrap-left", "wrap-right", "above", "below", "free"]
  const safePlacement = valid.includes(placement) ? placement : "free"
  const coords = migrateLegacyCoords(r, safePlacement)
  const defaultWidth = safePlacement === "columns" ? 38 : 42

  return {
    placement: safePlacement,
    xPercent: coords.xPercent,
    yPercent: coords.yPercent,
    widthPercent: clamp(Number(r.widthPercent) || defaultWidth, 12, 88),
    offsetX: Number(r.offsetX) || 0,
    offsetY: Number(r.offsetY) || 0,
    alignH: (["left", "center", "right"].includes(String(r.alignH)) ? r.alignH : "center") as ImageAlignH,
    alignV: (["top", "middle", "bottom"].includes(String(r.alignV)) ? r.alignV : "top") as ImageAlignV,
  }
}

/** Infer text-wrap mode from where the image sits on the canvas. */
export function placementFromCanvasPosition(xPercent: number): ImagePlacement {
  if (xPercent < 36) return "wrap-left"
  if (xPercent > 58) return "wrap-right"
  return "free"
}

export type ImageFigureProps = {
  imageUrl?: string
  caption?: string
  alt?: string
  transform?: ImageTransform | Record<string, unknown> | null
}

export function imageCellTransform(cell: Record<string, unknown>): ImageTransform {
  const explicit =
    (cell.imageTransform as ImageTransform | undefined) ??
    (cell.transform as ImageTransform | undefined)

  if (explicit) return normalizeImageTransform(explicit)

  const width = Number(cell.imageWidthPercent)
  if (Number.isFinite(width) && width >= 90) {
    return normalizeImageTransform({
      placement: "free",
      xPercent: 0,
      yPercent: 0,
      widthPercent: 100,
      alignH: "center",
      alignV: "middle",
    })
  }

  return normalizeImageTransform(defaultImageTransform("free"))
}

export function columnCellAlignClass(transform: ImageTransform): string {
  const h =
    transform.alignH === "left"
      ? "items-start"
      : transform.alignH === "right"
        ? "items-end"
        : "items-center"
  const v =
    transform.alignV === "top"
      ? "justify-start"
      : transform.alignV === "bottom"
        ? "justify-end"
        : "justify-center"
  return `flex flex-col ${h} ${v}`
}

export function canvasFigureStyle(transform: ImageTransform): CSSProperties {
  return {
    position: "absolute",
    left: `${transform.xPercent ?? 0}%`,
    top: `${transform.yPercent ?? 0}%`,
    width: `${transform.widthPercent ?? 38}%`,
    maxWidth: "88%",
    zIndex: 3,
    touchAction: "none",
  }
}

export function wrapFigureStyle(transform: ImageTransform, side: "left" | "right"): CSSProperties {
  const w = transform.widthPercent ?? 42
  return {
    float: side,
    width: `${w}%`,
    maxWidth: "min(48%, 420px)",
    marginTop: `${transform.yPercent ?? 0}px`,
    marginBottom: 12,
    marginLeft: side === "left" ? 0 : 16,
    marginRight: side === "right" ? 0 : 16,
    shapeOutside: "margin-box",
  }
}

export function columnFigureWrapStyle(transform: ImageTransform): CSSProperties {
  return {
    width: `${transform.widthPercent ?? 100}%`,
    maxWidth: "100%",
  }
}
