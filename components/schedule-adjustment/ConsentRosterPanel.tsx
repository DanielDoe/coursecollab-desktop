"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { cn } from "@/lib/utils"

type ConsentRow = {
  student_id: number
  student_display_name: string
  campus_student_id?: string | null
  email?: string | null
  status?: string | null
  signature_name?: string | null
  signed_at?: string | null
  document_version?: number | null
  decline_reason?: string | null
}

export function ConsentRosterPanel({
  requestId,
  counts,
  sectionCode,
  onRemind,
}: {
  requestId: number
  counts: { total: number; agreed: number; declined: number; pending: number }
  sectionCode?: string | null
  onRemind: () => void
}) {
  const [tab, setTab] = useState("all")
  const [rows, setRows] = useState<ConsentRow[]>([])
  const pct = counts.total ? Math.round((counts.agreed / counts.total) * 100) : 0

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await instructorApiFetch(
        `/api/instructor/schedule-adjustments/${requestId}/actions?view=consents&tab=${tab}`,
        { headers: buildInstructorApiHeaders() },
      )
      const data = await res.json()
      if (!cancelled) setRows(data.consents ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [requestId, tab])

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
      <div>
        <p className="text-sm font-semibold text-[var(--cc-text)]">Student Consent</p>
        <p className="text-sm text-[var(--cc-text-muted)]">
          {sectionCode ?? "Section"} · {counts.total} Students
        </p>
        <p className="mt-1 text-sm text-[var(--cc-text)]">
          Agreed: {counts.agreed} · Concerns: {counts.declined} · Pending: {counts.pending}
        </p>
        <p className="text-sm font-medium text-[var(--cc-text)]">Consent Progress: {pct} percent</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {["all", "agreed", "concern", "pending"].map((key) => (
          <Button key={key} size="sm" variant={tab === key ? "default" : "outline"} onClick={() => setTab(key)}>
            {key === "all" ? "All" : key === "agreed" ? "Agreed" : key === "concern" ? "Concern" : "Pending"}
          </Button>
        ))}
        <Button size="sm" variant="outline" onClick={onRemind}>
          Send Reminder to Pending Students
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void (async () => {
              const res = await instructorApiFetch(
                `/api/instructor/schedule-adjustments/${requestId}/consent-report`,
                { headers: buildInstructorApiHeaders() },
              )
              if (!res.ok) return
              const blob = await res.blob()
              const url = URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = `consent-report-${sectionCode ?? requestId}.pdf`
              a.click()
              URL.revokeObjectURL(url)
            })()
          }}
        >
          Export Consent Report
        </Button>
      </div>
      <div className={cn("overflow-hidden rounded-xl border divide-y divide-[var(--border)]")}>
        {rows.length === 0 ? (
          <p className="p-3 text-sm text-[var(--cc-text-muted)]">No students in this tab.</p>
        ) : (
          rows.map((row) => (
            <div key={`${row.student_id}-${row.document_version ?? 1}`} className="px-3 py-2 text-sm">
              <p className="font-medium text-[var(--cc-text)]">{row.student_display_name}</p>
              <p className="text-xs text-[var(--cc-text-muted)]">
                {row.campus_student_id ?? "—"} · {row.email ?? "—"} · {String(row.status ?? "pending")}
                {row.signature_name ? ` · signed ${row.signature_name}` : ""}
              </p>
              {row.decline_reason ? (
                <p className="mt-1 text-xs text-[var(--cc-text)]">{row.decline_reason}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
