"use client"

import { useMemo } from "react"
import { resolveLecturePdfUrl } from "@/lib/resolve-lecture-pdf-url"

type LecturePdfIframePreviewProps = {
  pdfUrl: string
  title?: string
  className?: string
}

/** Lightweight instructor preview — avoids react-pdf/webpack ESM issues in the deck modal. */
export function LecturePdfIframePreview({ pdfUrl, title, className }: LecturePdfIframePreviewProps) {
  const src = useMemo(() => resolveLecturePdfUrl(pdfUrl), [pdfUrl])

  return (
    <iframe
      src={src}
      title={title ? `${title} PDF preview` : "Lecture PDF preview"}
      className={`w-full min-h-[280px] h-[min(52vh,520px)] rounded-lg border-0 bg-white ${className ?? ""}`}
    />
  )
}
