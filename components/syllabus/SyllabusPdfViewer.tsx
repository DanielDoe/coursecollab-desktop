"use client"

import { useMemo } from "react"
import { CalendarDays, Download } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LecturePdfIframePreview } from "@/components/lecture-pdf-iframe-preview"
import { buildSyllabusPdfProxyUrl } from "@/lib/syllabus/syllabus-pdf-url"
import type { CourseSyllabus } from "@/lib/syllabus/types"
import { SYLLABUS_TILE, SYLLABUS_VALUE, PORTAL_TEXT_MUTED } from "@/lib/syllabus/syllabus-surface-classes"
import { cn } from "@/lib/utils"

type SyllabusPdfViewerProps = {
  syllabus: CourseSyllabus
  showStatusBadge?: boolean
  studentId?: string
}

export function SyllabusPdfViewer({
  syllabus,
  showStatusBadge = false,
  studentId,
}: SyllabusPdfViewerProps) {
  const proxyUrl = useMemo(() => {
    if (studentId) {
      return buildSyllabusPdfProxyUrl(syllabus.courseId, { studentId })
    }
    return syllabus.pdfUrl ?? ""
  }, [syllabus.courseId, syllabus.pdfUrl, studentId])

  const downloadUrl = useMemo(() => {
    if (studentId) {
      return buildSyllabusPdfProxyUrl(syllabus.courseId, { studentId, download: true })
    }
    return proxyUrl
  }, [proxyUrl, syllabus.courseId, studentId])

  const lastUpdated = new Date(syllabus.updatedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  if (!syllabus.pdfUrl) {
    return (
      <p className={cn("py-12 text-center", PORTAL_TEXT_MUTED)}>
        No PDF syllabus has been uploaded yet.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className={cn(SYLLABUS_TILE, "flex flex-wrap items-center justify-between gap-3 py-3")}>
        <div>
          <p className={cn("text-sm font-medium", SYLLABUS_VALUE)}>{syllabus.pdfFileName ?? "Syllabus PDF"}</p>
          <p className={cn("flex items-center gap-2 text-xs", PORTAL_TEXT_MUTED)}>
            <CalendarDays className="h-3.5 w-3.5" />
            Last updated {lastUpdated}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showStatusBadge ? (
            <Badge
              variant="secondary"
              className={
                syllabus.status === "published"
                  ? "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
              }
            >
              {syllabus.status === "published" ? "Published" : "Draft"}
            </Badge>
          ) : null}
          <Button asChild size="sm" variant="outline">
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </a>
          </Button>
        </div>
      </div>

      <div className={cn(SYLLABUS_TILE, "overflow-hidden p-0")}>
        <LecturePdfIframePreview
          pdfUrl={proxyUrl}
          title={syllabus.title}
          className="min-h-[min(70vh,720px)] h-[min(70vh,720px)] w-full"
        />
      </div>
    </div>
  )
}
