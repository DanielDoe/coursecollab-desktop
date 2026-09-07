"use client"

import { useState } from "react"
import { FileText, ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { solutionImageDisplayUrl } from "@/lib/heic-image"

export function isCourseEvaluationPdfProof(
  mime?: string | null,
  fileName?: string | null,
): boolean {
  const m = (mime || "").toLowerCase()
  if (m === "application/pdf") return true
  return (fileName || "").toLowerCase().endsWith(".pdf")
}

type ProofPreviewProps = {
  url: string
  fileName?: string | null
  mime?: string | null
  className?: string
  compact?: boolean
}

export function CourseEvaluationProofPreview({
  url,
  fileName,
  mime,
  className,
  compact,
}: ProofPreviewProps) {
  const name = fileName || "Proof"
  const isPdf = isCourseEvaluationPdfProof(mime, name)
  const [imageFailed, setImageFailed] = useState(false)

  if (isPdf) {
    return (
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-slate-100 p-3 text-center dark:bg-slate-800",
          className,
        )}
      >
        <FileText
          className={cn("text-sky-600 dark:text-sky-400", compact ? "h-6 w-6" : "h-8 w-8")}
          aria-hidden
        />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
          PDF
        </span>
        <span className="line-clamp-2 text-xs text-slate-700 dark:text-slate-200">{name}</span>
      </div>
    )
  }

  if (!url?.trim() || imageFailed) {
    return (
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-slate-100 p-3 text-center dark:bg-slate-800",
          className,
        )}
      >
        <ImageIcon
          className={cn("text-sky-600 dark:text-sky-400", compact ? "h-6 w-6" : "h-8 w-8")}
          aria-hidden
        />
        <span className="line-clamp-2 text-xs text-slate-700 dark:text-slate-200">{name}</span>
      </div>
    )
  }

  const displayUrl = solutionImageDisplayUrl(url, mime, name)

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={displayUrl}
      alt={name}
      className={cn("absolute inset-0 h-full w-full object-cover", className)}
      loading="lazy"
      decoding="async"
      onError={() => setImageFailed(true)}
    />
  )
}
