"use client"

import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { Loader2, Download, FileArchive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
  downloadCourseEvaluationPdf,
  downloadCourseEvaluationsZip,
} from "@/lib/course-evaluation-export-pdf"
import type { EvaluationRow, Proof } from "@/components/instructor/course-evaluation-shared"
import { useState } from "react"

export function CourseEvaluationExportPdfButton({
  row,
  proofs,
  size = "sm",
  variant = "ghost",
  className,
}: {
  row: EvaluationRow
  proofs: Proof[]
  size?: "sm" | "default"
  variant?: "outline" | "ghost"
  className?: string
}) {
  const { toast } = useToast()
  const [exporting, setExporting] = useState(false)

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      disabled={exporting}
      className={className}
      onClick={() => {
        setExporting(true)
        void downloadCourseEvaluationPdf(row, proofs)
          .then(() => {
            toast({ title: "Exported", description: "Evaluation PDF downloaded." })
          })
          .catch(() => {
            toast({ title: "Export failed", description: "Could not build PDF.", variant: "destructive" })
          })
          .finally(() => setExporting(false))
      }}
    >
      {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      Export PDF
    </Button>
  )
}

export function CourseEvaluationExportAllButton({
  items,
  label,
  className,
}: {
  items: EvaluationRow[]
  label?: string
  className?: string
}) {
  const { toast } = useToast()
  const [exporting, setExporting] = useState(false)

  if (items.length === 0) return null

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={exporting}
      className={className}
      onClick={() => {
        setExporting(true)
        void (async () => {
          const packed: Array<{ row: EvaluationRow; proofs: Proof[] }> = []
          for (const row of items) {
            const res = await instructorApiFetch(`/api/instructor/course-evaluations?id=${row.id}`)
            const data = await res.json()
            const proofs = (data.evaluation?.proofs ?? []) as Proof[]
            packed.push({
              row: data.evaluation ? { ...row, ...data.evaluation } : row,
              proofs,
            })
          }
          await downloadCourseEvaluationsZip(packed)
        })()
          .then(() => {
            toast({
              title: "Exported",
              description: `${items.length} evaluation report${items.length === 1 ? "" : "s"} downloaded as ZIP.`,
            })
          })
          .catch(() => {
            toast({ title: "Export failed", description: "Could not build ZIP.", variant: "destructive" })
          })
          .finally(() => setExporting(false))
      }}
    >
      {exporting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <FileArchive className="h-3.5 w-3.5" />
      )}
      {label ?? `Export all (${items.length})`}
    </Button>
  )
}
