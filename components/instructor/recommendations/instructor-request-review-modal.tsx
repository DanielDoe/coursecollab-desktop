"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink, FileText, Loader2 } from "lucide-react"
import { getInstructorData } from "@/lib/auth"
import { purposeLabel } from "@/lib/recommendation-letters-shared"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { InstructorRequestBundle } from "./instructor-request-workspace"

function formatModalDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function InstructorRequestReviewModal({
  requestId,
  open,
  onOpenChange,
  onListRefresh,
}: {
  requestId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onListRefresh?: () => void
}) {
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [bundle, setBundle] = useState<InstructorRequestBundle | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [footerBusy, setFooterBusy] = useState<"approve" | "reject" | "request_info" | null>(null)
  const [footerErr, setFooterErr] = useState<string | null>(null)
  const [modalRejectReason, setModalRejectReason] = useState("")
  const [modalInfoNote, setModalInfoNote] = useState("")

  const load = useCallback(async () => {
    if (requestId == null) return
    const inst = getInstructorData()
    if (!inst?.id) {
      setErr("Not signed in")
      return
    }
    setLoading(true)
    setErr(null)
    try {
      const res = await instructorApiFetch(`/api/instructor/recommendations/${requestId}`, {
        headers: buildInstructorAuthorizedApiHeaders({ "x-instructor-id": String(inst.id) }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || "Failed")
      setBundle({
        request: j.request,
        settings: j.settings ?? null,
        profile: j.profile ?? null,
        drafts: j.drafts || [],
        attachments: j.attachments || [],
        audit: j.audit || [],
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed")
      setBundle(null)
    } finally {
      setLoading(false)
    }
  }, [requestId, courseScopeVersion])

  useEffect(() => {
    if (!open || requestId == null) {
      setBundle(null)
      setModalRejectReason("")
      setModalInfoNote("")
      setFooterErr(null)
      return
    }
    void load()
  }, [open, requestId, load])

  useEffect(() => {
    if (!open) {
      setModalRejectReason("")
      setModalInfoNote("")
      setFooterErr(null)
    }
  }, [open])

  const requestRecord = bundle?.request as Record<string, string | boolean | null> | undefined
  const status = String(requestRecord?.status ?? "")
  const isPending = status === "requested"
  const studentName = String(requestRecord?.student_name ?? "Student")
  const courseCode = String(requestRecord?.course_code ?? "")
  const letterSpecific = Boolean(requestRecord?.letter_is_specific)

  async function patchFooter(
    action: "approve" | "reject" | "request_info",
    body: Record<string, unknown> = {},
  ) {
    if (requestId == null) return
    const inst = getInstructorData()
    if (!inst?.id) {
      setFooterErr("Not signed in")
      return
    }
    setFooterBusy(action)
    setFooterErr(null)
    try {
      const res = await instructorApiFetch(`/api/instructor/recommendations/${requestId}`, {
        method: "PATCH",
        headers: buildInstructorAuthorizedApiHeaders({
          "Content-Type": "application/json",
          "x-instructor-id": String(inst.id),
        }),
        body: JSON.stringify({ action, ...body }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || "Request failed")
      setModalRejectReason("")
      setModalInfoNote("")
      await load()
      onListRefresh?.()
    } catch (e) {
      setFooterErr(e instanceof Error ? e.message : "Failed")
    } finally {
      setFooterBusy(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          "flex min-h-0 max-h-[min(92dvh,calc(100vh-1rem))] flex-col gap-0 overflow-hidden rounded-2xl border-slate-200/90 bg-white p-0 dark:border-white/[0.1] dark:bg-slate-950",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-[34rem]",
          "left-1/2 top-4 z-[60] -translate-x-1/2 translate-y-0 sm:top-1/2 sm:-translate-y-1/2",
        )}
      >
        {/* Header — request facts only (no letter editing here) */}
        <DialogHeader className="shrink-0 space-y-0 border-b border-slate-200/80 bg-slate-50/80 px-4 py-4 text-left dark:border-white/[0.08] dark:bg-slate-950/50 sm:px-6 sm:py-5">
          <div className="flex items-start gap-3 pr-8">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 dark:border-emerald-400/20"
              aria-hidden
            >
              <FileText className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <DialogTitle className="text-lg font-semibold leading-snug text-slate-900 dark:text-white sm:text-xl">
                  {studentName}
                </DialogTitle>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Request #{requestId ?? ""}
                  {courseCode ? (
                    <>
                      {" "}
                      · <span className="font-medium text-slate-600 dark:text-slate-300">{courseCode}</span>
                    </>
                  ) : null}
                </p>
                {!loading && requestRecord && String(requestRecord.student_email ?? "").trim() ? (
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">Student email: </span>
                    {String(requestRecord.student_email).trim()}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full border border-slate-200/80 bg-white/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
                  {status.replace(/_/g, " ")}
                </span>
                <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs text-emerald-700 dark:text-emerald-400" asChild>
                  <Link href={`/instructor/dashboard-v2/recommendations/${requestId}`} className="no-underline">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    Open workspace
                  </Link>
                </Button>
              </div>
              {!loading && bundle && requestRecord ? (
                <div className="grid grid-cols-1 gap-2 pt-1 text-xs sm:grid-cols-3 sm:gap-2">
                  <div className="rounded-lg border border-slate-200/70 bg-white/70 px-2.5 py-2 dark:border-white/[0.08] dark:bg-slate-900/40">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Purpose</p>
                    <p className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                      {purposeLabel(String(requestRecord.purpose ?? ""))}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200/70 bg-white/70 px-2.5 py-2 dark:border-white/[0.08] dark:bg-slate-900/40">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Deadline</p>
                    <p className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                      {formatModalDate(requestRecord.deadline != null ? String(requestRecord.deadline) : null)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200/70 bg-white/70 px-2.5 py-2 dark:border-white/[0.08] dark:bg-slate-900/40">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Recipient</p>
                    <p className="mt-0.5 break-words font-medium text-slate-900 dark:text-slate-100">
                      {letterSpecific ? (
                        <span className="block">
                          <span className="block">
                            {[requestRecord.recipient_name, requestRecord.recipient_organization].filter(Boolean).join(" · ") || "—"}
                          </span>
                          {String(requestRecord.recipient_address ?? "").trim() ? (
                            <span className="mt-1 block whitespace-pre-wrap text-[12px] font-normal leading-snug text-slate-800 dark:text-slate-100">
                              {String(requestRecord.recipient_address).trim()}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        "General letter"
                      )}
                    </p>
                  </div>
                </div>
              ) : null}
              {!loading && bundle && requestRecord && String(requestRecord.course_description ?? "").trim() ? (
                <div className="rounded-lg border border-slate-200/70 bg-white/70 px-2.5 py-2 dark:border-white/[0.08] dark:bg-slate-900/40">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Course</p>
                  <p className="mt-0.5 text-sm text-slate-800 dark:text-slate-200 leading-snug">
                    {String(requestRecord.course_description).trim()}
                  </p>
                </div>
              ) : null}
              {!loading && bundle && requestRecord && String(requestRecord.student_request_description ?? "").trim() ? (
                <div className="mt-0 rounded-lg border border-slate-200/70 bg-white/70 px-2.5 py-2 dark:border-white/[0.08] dark:bg-slate-900/40">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Student context
                  </p>
                  <p className="mt-0.5 text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap break-words">
                    {String(requestRecord.student_request_description).trim()}
                  </p>
                </div>
              ) : null}
              <DialogDescription className="sr-only">
                Review request details and approve, ask for more information, or reject. Letter drafting opens on the full workspace page.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white px-4 py-4 dark:bg-slate-950 sm:px-6 sm:py-5">
          {loading && <p className="py-10 text-center text-sm text-slate-500">Loading request…</p>}
          {err && !loading && (
            <p className="rounded-lg border border-red-200/80 bg-red-50/80 px-3 py-2 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
              {err}
            </p>
          )}
          {!loading && bundle && requestId != null && requestRecord ? (
            <>
              {isPending ? (
                <div className="space-y-5">
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Decide on this request: approve so the student can continue with their materials and template, ask for more
                    detail, or reject with an optional note.
                  </p>
                  <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
                    <Label htmlFor="modal-info-note" className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      Request more information
                    </Label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Sends a note to the student and sets the request to &quot;information requested&quot;. Required before sending.
                    </p>
                    <Textarea
                      id="modal-info-note"
                      value={modalInfoNote}
                      onChange={(e) => setModalInfoNote(e.target.value)}
                      placeholder="What do you need from the student?"
                      className="min-h-[4.5rem] resize-y rounded-xl border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-950/40"
                      disabled={footerBusy !== null}
                    />
                  </div>
                  <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
                    <Label htmlFor="modal-reject-reason" className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      Rejection note{" "}
                      <span className="font-normal text-slate-500 dark:text-slate-400">(optional; shown to student)</span>
                    </Label>
                    <Textarea
                      id="modal-reject-reason"
                      value={modalRejectReason}
                      onChange={(e) => setModalRejectReason(e.target.value)}
                      placeholder="Add a short reason if you plan to reject…"
                      className="min-h-[4.5rem] resize-y rounded-xl border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-950/40"
                      disabled={footerBusy !== null}
                    />
                  </div>
                  {footerErr ? (
                    <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                      {footerErr}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Initial review is done here. Use the workspace to see their questionnaire, drafts, and the finalized letter when
                    it is ready for your approval.
                  </p>
                  {status === "info_requested" && String(requestRecord.info_request_note ?? "").trim() ? (
                    <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/25">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200/90">
                        Note to student
                      </p>
                      <p className="mt-1 text-sm text-amber-950 dark:text-amber-100 whitespace-pre-wrap">
                        {String(requestRecord.info_request_note).trim()}
                      </p>
                    </div>
                  ) : null}
                  {status === "rejected" && String(requestRecord.rejection_reason ?? "").trim() ? (
                    <div className="rounded-xl border border-red-200/70 bg-red-50/60 px-3 py-2.5 dark:border-red-900/40 dark:bg-red-950/25">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-red-900 dark:text-red-200/90">
                        Rejection reason on file
                      </p>
                      <p className="mt-1 text-sm text-red-950 dark:text-red-100 whitespace-pre-wrap">
                        {String(requestRecord.rejection_reason).trim()}
                      </p>
                    </div>
                  ) : null}
                  {bundle.attachments && bundle.attachments.length > 0 ? (
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Files on this request
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-slate-700 dark:text-slate-300">
                        {bundle.attachments.map((a, i) => {
                          const row = a as { id?: number; file_type?: string; file_name?: string | null }
                          return (
                            <li key={String(row.id ?? i)}>
                              <span className="font-medium capitalize">{row.file_type ?? "file"}</span>
                              {row.file_name ? ` — ${row.file_name}` : null}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ) : null}
                  <Button className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 sm:w-auto" asChild>
                    <Link href={`/instructor/dashboard-v2/recommendations/${requestId}`} className="no-underline gap-2">
                      <ExternalLink className="h-4 w-4" aria-hidden />
                      Open full workspace
                    </Link>
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </div>

        {isPending && !loading && bundle && requestId != null ? (
          <footer
            role="group"
            aria-label="Request actions"
            className="grid w-full shrink-0 grid-cols-1 gap-2 border-t border-slate-200/90 bg-white/95 px-4 py-3 dark:border-white/[0.1] dark:bg-slate-950/95 sm:grid-cols-3 sm:gap-3 sm:px-6 sm:py-3"
          >
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full touch-manipulation justify-center rounded-xl border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40 sm:h-10"
              disabled={footerBusy !== null}
              onClick={() => void patchFooter("reject", { reason: modalRejectReason })}
            >
              {footerBusy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full touch-manipulation justify-center rounded-xl sm:h-10"
              disabled={footerBusy !== null || !modalInfoNote.trim()}
              onClick={() => void patchFooter("request_info", { note: modalInfoNote })}
            >
              {footerBusy === "request_info" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request more info"}
            </Button>
            <Button
              type="button"
              className="h-11 w-full touch-manipulation justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 sm:h-10"
              disabled={footerBusy !== null}
              onClick={() => void patchFooter("approve")}
            >
              {footerBusy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
            </Button>
          </footer>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
