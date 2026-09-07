"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { FileText, Loader2, Mail, Maximize2, Minimize2, Sparkles, SplitSquareHorizontal } from "lucide-react"
import { LetterheadLetterPreview } from "@/components/recommendation-letter/LetterheadLetterPreview"
import { buildLetterheadPreviewContentForStudentDraft } from "@/lib/recommendation-draft-letter-preview"
import { formatLetterSalutationPreview } from "@/lib/recommendation-letter-salutation-preview"
import { getInstructorData } from "@/lib/auth"
import { purposeLabel, formatRecommendationReLine } from "@/lib/recommendation-letters-shared"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StudentRequestDetailsEditor } from "@/components/student/recommendations/student-request-details-editor"
import { RecommendationPurposeSelect } from "@/components/student/recommendations/recommendation-purpose-select"
import { InstructorRecommendationBriefDelivery } from "@/components/instructor/recommendations/InstructorRecommendationBriefDelivery"
import { normalizeDeliveryMethod } from "@/lib/recommendation-delivery"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

export type InstructorRequestBundle = {
  request: Record<string, unknown>
  /** Letterhead / PDF layout (same row the student preview uses). */
  settings?: Record<string, unknown> | null
  profile: Record<string, unknown> | null
  brief?: Record<string, unknown> | null
  drafts: Record<string, unknown>[]
  attachments?: Record<string, unknown>[]
  audit?: Record<string, unknown>[]
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" })
}

function profileField(label: string, value: unknown) {
  const v = value != null && String(value).trim() ? String(value) : null
  if (!v) return null
  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 mt-1 whitespace-pre-wrap">{v}</p>
    </div>
  )
}

export function InstructorRequestWorkspace({
  requestId,
  bundle,
  onAfterMutation,
  showDetailLink = true,
  embedInModal = false,
  hidePendingDecision = false,
  onRequestDeleted,
  className,
}: {
  requestId: string
  bundle: InstructorRequestBundle
  onAfterMutation?: () => void
  showDetailLink?: boolean
  /** Omit hero + summary cards (shown in modal chrome instead). */
  embedInModal?: boolean
  /** Hide in-flow approve/reject (e.g. modal footer handles it). */
  hidePendingDecision?: boolean
  /** Called after this request is permanently deleted (navigate or close modal). */
  onRequestDeleted?: () => void
  className?: string
}) {
  const { courseScopeVersion } = useInstructorDashboardV2()
  const { toast } = useToast()
  const req = bundle.request as Record<string, string | boolean | null>
  const status = String(req.status ?? "")
  const earlyInfoEligible =
    status === "requested" ||
    status === "approved" ||
    status === "info_requested" ||
    status === "student_form_pending" ||
    status === "ai_generated"
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [finalText, setFinalText] = useState(String(req.final_letter_text ?? ""))
  const letterTextDirtyRef = useRef(false)
  const letterHeadingDirtyRef = useRef(false)
  const [greetingRecipientName, setGreetingRecipientName] = useState(() =>
    typeof req.recipient_name === "string" ? req.recipient_name : "",
  )
  const [greetingRecipientOrg, setGreetingRecipientOrg] = useState(() =>
    typeof req.recipient_organization === "string" ? req.recipient_organization : "",
  )
  const [greetingRecipientAddress, setGreetingRecipientAddress] = useState(() =>
    typeof req.recipient_address === "string" ? req.recipient_address : "",
  )
  const [letterPurpose, setLetterPurpose] = useState(() => String(req.purpose ?? "other"))
  const [letterPurposeOther, setLetterPurposeOther] = useState(() =>
    typeof req.purpose_other_detail === "string" ? req.purpose_other_detail : "",
  )
  const [rejectReason, setRejectReason] = useState("")
  const [infoNote, setInfoNote] = useState("")
  const [revisionNote, setRevisionNote] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [previewExpanded, setPreviewExpanded] = useState(false)

  const requestUpdatedAt = typeof req.updated_at === "string" ? req.updated_at : ""

  useEffect(() => {
    if (letterTextDirtyRef.current) return
    setFinalText(String(req.final_letter_text ?? ""))
  }, [requestUpdatedAt, req.final_letter_text])

  useEffect(() => {
    if (letterHeadingDirtyRef.current) return
    setGreetingRecipientName(typeof req.recipient_name === "string" ? req.recipient_name : "")
    setGreetingRecipientOrg(typeof req.recipient_organization === "string" ? req.recipient_organization : "")
    setGreetingRecipientAddress(typeof req.recipient_address === "string" ? req.recipient_address : "")
    setLetterPurpose(String(req.purpose ?? "other"))
    setLetterPurposeOther(typeof req.purpose_other_detail === "string" ? req.purpose_other_detail : "")
  }, [
    requestUpdatedAt,
    req.recipient_name,
    req.recipient_organization,
    req.recipient_address,
    req.purpose,
    req.purpose_other_detail,
  ])

  const patch = useCallback(
    async (action: string, body: Record<string, unknown> = {}) => {
      const inst = getInstructorData()
      if (!inst?.id) throw new Error("Not signed in")
      setErr(null)
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
      await onAfterMutation?.()
      return j as Record<string, unknown>
    },
    [onAfterMutation, requestId, courseScopeVersion],
  )

  const persistLetterHeading = useCallback(async () => {
    const inst = getInstructorData()
    if (!inst?.id) throw new Error("Not signed in")
    if (letterPurpose === "other" && letterPurposeOther.trim().length < 2) {
      throw new Error(
        'When purpose is "Other", add a short phrase (2+ characters) for the Re: line on the formal letter.',
      )
    }
    const hasRecipientBlock =
      greetingRecipientName.trim().length > 0 ||
      greetingRecipientOrg.trim().length > 0 ||
      greetingRecipientAddress.trim().length > 0
    const res = await instructorApiFetch(`/api/instructor/recommendations/${requestId}/request-details`, {
      method: "PATCH",
      headers: buildInstructorAuthorizedApiHeaders({
        "Content-Type": "application/json",
        "x-instructor-id": String(inst.id),
      }),
      body: JSON.stringify({
        purpose: letterPurpose,
        purposeOtherDetail: letterPurpose === "other" ? letterPurposeOther.trim().slice(0, 500) : null,
        recipientName: greetingRecipientName.trim() || null,
        recipientOrganization: greetingRecipientOrg.trim() || null,
        recipientAddress: hasRecipientBlock ? greetingRecipientAddress.trim().slice(0, 2000) || null : null,
        letterIsSpecific: hasRecipientBlock,
      }),
    })
    const j = (await res.json()) as { error?: string }
    if (!res.ok) throw new Error(j.error || "Could not save letter heading")
    letterHeadingDirtyRef.current = false
  }, [
    greetingRecipientAddress,
    greetingRecipientName,
    greetingRecipientOrg,
    letterPurpose,
    letterPurposeOther,
    requestId,
    courseScopeVersion,
  ])

  function emailSkipReasonLabel(reason: string | null | undefined): string {
    const r = String(reason ?? "").trim()
    if (!r) return "Email could not be sent."
    if (r === "no_student_email" || r === "empty_student_email") return "No valid email address on file for this student."
    if (r === "no_row") return "Student record was not found."
    if (r === "invalid_student_email") return "The student email on file is not valid."
    return r.replace(/_/g, " ")
  }

  async function saveLetterDraft(finalizeAfter = false) {
    setBusy(finalizeAfter ? "finalize" : "save")
    try {
      await persistLetterHeading()
      await patch(finalizeAfter ? "finalize" : "update_final_text", { finalLetterText: finalText })
      letterTextDirtyRef.current = false
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed")
    } finally {
      setBusy(null)
    }
  }

  async function notifyStudentLetterReady() {
    setBusy("notify")
    setErr(null)
    try {
      if (!finalText.trim()) {
        throw new Error("Add letter text before notifying the student.")
      }
      await persistLetterHeading()
      const result = await patch("notify_student_letter_ready", { finalLetterText: finalText })
      letterTextDirtyRef.current = false

      const note = result.studentNotification as
        | {
            emailSent?: boolean
            emailSkipReason?: string | null
            studentEmail?: string | null
            inAppNotified?: boolean
            wasAlreadyReleased?: boolean
          }
        | undefined
      const emailSent = Boolean(note?.emailSent)
      const studentEmail = String(note?.studentEmail ?? req.student_email ?? "").trim()
      const inAppNotified = Boolean(note?.inAppNotified)
      const renotified = Boolean(note?.wasAlreadyReleased)

      if (emailSent) {
        toast({
          title: renotified ? "Reminder email sent" : "Student notified",
          description: [
            studentEmail ? `Email sent to ${studentEmail}.` : "Notification email sent.",
            renotified ? "Updated letter saved." : "PDF unlocked for download.",
            inAppNotified ? "In-app alert posted on their account." : null,
          ]
            .filter(Boolean)
            .join(" "),
        })
      } else {
        toast({
          title: renotified ? "Letter updated — email not sent" : "PDF unlocked — email not sent",
          description: [
            emailSkipReasonLabel(note?.emailSkipReason),
            studentEmail ? `On file: ${studentEmail}.` : null,
            inAppNotified ? "In-app alert was still posted." : "Ask them to check CourseCollab directly.",
          ]
            .filter(Boolean)
            .join(" "),
          variant: "destructive",
        })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to notify student"
      setErr(message)
      toast({ title: "Could not notify student", description: message, variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  async function runAiSuggest() {
    const inst = getInstructorData()
    if (!inst?.id) return
    setBusy("ai")
    setErr(null)
    try {
      const res = await instructorApiFetch(`/api/instructor/recommendations/${requestId}/ai-suggest`, {
        method: "POST",
        headers: buildInstructorAuthorizedApiHeaders({ "x-instructor-id": String(inst.id) }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || "AI failed")
      setFinalText(String(j.text ?? ""))
      letterTextDirtyRef.current = true
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI failed")
    } finally {
      setBusy(null)
    }
  }

  const p = bundle.profile
  const letterSpecific = Boolean(req.letter_is_specific)
  const letterheadSettings = bundle.settings as Record<string, unknown> | undefined

  const previewRequestPayload = useMemo((): Record<string, unknown> => {
    const r = bundle.request as Record<string, unknown>
    const full =
      typeof r.student_full_name === "string"
        ? String(r.student_full_name).trim()
        : String(r.student_name ?? "").trim()
    const hasRecipientBlock =
      greetingRecipientName.trim().length > 0 ||
      greetingRecipientOrg.trim().length > 0 ||
      greetingRecipientAddress.trim().length > 0
    return {
      ...r,
      student_full_name: full || "Student",
      purpose: letterPurpose,
      purpose_other_detail: letterPurpose === "other" ? letterPurposeOther.trim().slice(0, 500) || null : null,
      recipient_name: hasRecipientBlock ? greetingRecipientName.trim() || null : null,
      recipient_organization: hasRecipientBlock ? greetingRecipientOrg.trim() || null : null,
      recipient_address:
        hasRecipientBlock && greetingRecipientAddress.trim()
          ? greetingRecipientAddress.trim().slice(0, 2000)
          : null,
      letter_is_specific: hasRecipientBlock,
    }
  }, [
    bundle.request,
    greetingRecipientAddress,
    greetingRecipientName,
    greetingRecipientOrg,
    letterPurpose,
    letterPurposeOther,
  ])

  const greetingPreviewLine = useMemo(
    () => formatLetterSalutationPreview(greetingRecipientName, greetingRecipientOrg),
    [greetingRecipientName, greetingRecipientOrg],
  )

  const reLinePreview = useMemo(() => {
    const studentName =
      typeof previewRequestPayload.student_full_name === "string"
        ? previewRequestPayload.student_full_name
        : "Student"
    return formatRecommendationReLine(studentName, letterPurpose, letterPurposeOther) ?? ""
  }, [letterPurpose, letterPurposeOther, previewRequestPayload.student_full_name])

  const letterheadPreview = useMemo(
    () =>
      buildLetterheadPreviewContentForStudentDraft({
        manualLetterText: finalText,
        req: previewRequestPayload,
        settings: letterheadSettings,
      }),
    [finalText, previewRequestPayload, letterheadSettings],
  )

  return (
    <div className={cn("space-y-5 sm:space-y-6 min-w-0", className)}>
      {!embedInModal && (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 dark:border-emerald-400/20 bg-emerald-500/10"
                aria-hidden
              >
                <FileText className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2 gap-y-1">
                  <h2 className="min-w-0 flex-1 break-words text-lg font-bold text-slate-900 dark:text-white sm:text-xl">
                    {String(req.student_name ?? "Student")}
                  </h2>
                  <span className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-300 sm:text-xs rounded-full border border-slate-200/70 bg-slate-100 px-2 py-0.5 dark:border-white/10 dark:bg-white/10">
                    {status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="break-words text-xs text-slate-600 dark:text-slate-400 sm:text-sm">
                  {String(req.course_code ?? "")}
                  {req.course_description ? (
                    <span className="text-slate-500 dark:text-slate-500"> · {String(req.course_description)}</span>
                  ) : null}
                </p>
                {showDetailLink ? (
                  <Link
                    href={`/instructor/dashboard-v2/recommendations/${requestId}`}
                    className="mt-1 inline-block text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    Open full-page workspace
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          {status === "requested" && !hidePendingDecision && (
            <section
              className="rounded-2xl border border-emerald-200/90 bg-emerald-50/70 p-px shadow-sm dark:border-emerald-800/55 dark:bg-emerald-950/30"
              aria-labelledby="workspace-initial-decision-heading"
            >
              <div className="rounded-[0.9375rem] bg-white/95 p-4 sm:p-5 dark:bg-slate-950/80">
                <div className="space-y-1">
                  <h3
                    id="workspace-initial-decision-heading"
                    className="text-sm font-semibold text-slate-900 dark:text-white"
                  >
                    Initial decision
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Approve so the student can complete their questionnaire and either generate AI drafts (if enabled) or
                    compose their letter for your final sign-off. Decline to turn down the request.
                  </p>
                </div>

                <div className="mt-5 space-y-5">
                  <div className="flex flex-col gap-3 rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-4 dark:border-emerald-800/45 dark:bg-emerald-950/25">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 sm:max-w-md">
                        Ready to proceed with this recommendation?
                      </p>
                      <Button
                        size="lg"
                        className="h-11 shrink-0 rounded-xl px-6 font-semibold bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto sm:min-w-[11rem]"
                        disabled={!!busy}
                        onClick={async () => {
                          setBusy("approve")
                          try {
                            await patch("approve")
                          } catch (e) {
                            setErr(e instanceof Error ? e.message : "Failed")
                          } finally {
                            setBusy(null)
                          }
                        }}
                      >
                        <span className="inline-flex items-center justify-center gap-2">
                          {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden /> : null}
                          Approve request
                        </span>
                      </Button>
                    </div>
                  </div>

                  <div className="relative py-1" role="presentation">
                    <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-200/90 dark:bg-white/[0.1]" />
                    <p className="relative mx-auto flex w-fit items-center bg-white px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:bg-slate-950 dark:text-slate-500">
                      Or decline
                    </p>
                  </div>

                  <div className="rounded-xl border border-red-200/65 bg-red-50/35 p-4 dark:border-red-900/50 dark:bg-red-950/20">
                    <Label htmlFor="reject-reason" className="text-xs font-medium text-red-950 dark:text-red-100">
                      Decline request
                    </Label>
                    <p className="mt-1 text-[11px] text-red-800/85 dark:text-red-200/80">
                      Optionally add a short reason; it will be shown to the student.
                    </p>
                    <Textarea
                      id="reject-reason"
                      className="mt-3 rounded-xl min-h-[4.5rem] text-sm border-red-200/60 bg-white dark:bg-red-950/15 dark:border-red-900/40"
                      placeholder="Reason (optional, shown to student)"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="destructive"
                        className="rounded-xl min-w-[9rem]"
                        disabled={!!busy}
                        onClick={async () => {
                          setBusy("reject")
                          try {
                            await patch("reject", { reason: rejectReason })
                            setRejectReason("")
                          } catch (e) {
                            setErr(e instanceof Error ? e.message : "Failed")
                          } finally {
                            setBusy(null)
                          }
                        }}
                      >
                        <span className="inline-flex items-center justify-center gap-2">
                          {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden /> : null}
                          Decline request
                        </span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Request details
            </p>
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3 sm:gap-3 sm:text-sm">
              <div className="rounded-xl border border-slate-200/80 bg-white/60 px-3 py-2.5 dark:border-white/[0.08] dark:bg-slate-950/25">
                <span className="text-slate-500 dark:text-slate-400">Purpose</span>
                <p className="mt-0.5 font-medium text-slate-900 dark:text-white">{purposeLabel(String(req.purpose ?? ""))}</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white/60 px-3 py-2.5 dark:border-white/[0.08] dark:bg-slate-950/25">
                <span className="text-slate-500 dark:text-slate-400">Deadline</span>
                <p className="mt-0.5 font-medium text-slate-900 dark:text-white">
                  {formatShortDate(req.deadline != null ? String(req.deadline) : null)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white/60 px-3 py-2.5 dark:border-white/[0.08] dark:bg-slate-950/25">
                <span className="text-slate-500 dark:text-slate-400">Recipient</span>
                <p className="mt-0.5 font-medium text-slate-900 dark:text-white break-words">
                  {letterSpecific ? (
                    <span className="block">
                      <span className="block">{[req.recipient_name, req.recipient_organization].filter(Boolean).join(" · ") || "—"}</span>
                      {String(req.recipient_address ?? "").trim() ? (
                        <span className="mt-1 block whitespace-pre-wrap text-[13px] font-normal leading-snug text-slate-800 dark:text-slate-100">
                          {String(req.recipient_address).trim()}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    "General letter"
                  )}
                </p>
              </div>
              {String(req.student_request_description ?? "").trim() ? (
                <div className="rounded-xl border border-slate-200/80 bg-white/60 px-3 py-2.5 sm:col-span-3 dark:border-white/[0.08] dark:bg-slate-950/25">
                  <span className="text-slate-500 dark:text-slate-400">Student context</span>
                  <p className="mt-0.5 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                    {String(req.student_request_description).trim()}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}

      {err && (
        <p className="text-sm text-red-600 dark:text-red-400 rounded-xl border border-red-200/80 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 px-3 py-2.5">
          {err}
        </p>
      )}

      <StudentRequestDetailsEditor
        actor="instructor"
        requestId={requestId}
        req={
          bundle.request as Record<string, string | boolean | null | undefined> & {
            updated_at?: string
          }
        }
        settings={bundle.settings as Record<string, string | number | boolean | null> | undefined}
        onSaved={async () => {
          letterHeadingDirtyRef.current = false
          await onAfterMutation?.()
        }}
        hideLetterHeadingFields
      />

      {(status === "student_selected" || status === "instructor_review_pending") && (
        <section className="rounded-xl border border-rose-200/75 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/25 p-4 sm:p-5 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Send back for edits</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              The student can update their letter and request metadata, then submit again for your review. They receive an
              in-app notification at the same time.
            </p>
          </div>
          <Textarea
            className="rounded-xl min-h-[92px] text-sm bg-white dark:bg-slate-950/40 border-rose-200/60 dark:border-rose-900/35"
            placeholder="What needs to change? (shown to the student)"
            value={revisionNote}
            onChange={(e) => setRevisionNote(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-rose-300 text-rose-900 hover:bg-rose-100 dark:border-rose-800 dark:text-rose-100 dark:hover:bg-rose-950/50"
            disabled={!!busy || !revisionNote.trim()}
            onClick={async () => {
              setBusy("revision")
              try {
                await patch("request_student_revision", { note: revisionNote.trim() })
                setRevisionNote("")
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Failed")
              } finally {
                setBusy(null)
              }
            }}
          >
            {busy === "revision" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Request student revisions
          </Button>
        </section>
      )}

      {status === "revision_requested" && String(req.info_request_note ?? "").trim() ? (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/65 dark:bg-amber-950/25 dark:border-amber-900/40 px-4 py-3 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200/90">
            Student is addressing your revision note
          </p>
          <p className="text-sm text-amber-950 dark:text-amber-50 whitespace-pre-wrap">
            {String(req.info_request_note).trim()}
          </p>
        </div>
      ) : null}

      {earlyInfoEligible ? (
        <section className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/40 dark:bg-white/[0.02] p-4 sm:p-5 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Ask the student for more detail</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sends a note and sets the request to &quot;information requested&quot; so they can reply.
            </p>
          </div>
          <Textarea
            className="rounded-xl min-h-[72px] text-sm bg-white dark:bg-slate-950/40"
            placeholder="Note to student (sets status to information requested)"
            value={infoNote}
            onChange={(e) => setInfoNote(e.target.value)}
          />
          <Button
            variant="outline"
            className="rounded-xl w-full sm:w-auto"
            disabled={!!busy || !infoNote.trim()}
            onClick={async () => {
              setBusy("info")
              try {
                await patch("request_info", { note: infoNote })
                setInfoNote("")
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Failed")
              } finally {
                setBusy(null)
              }
            }}
          >
            Send information request
          </Button>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200/80 bg-white/50 shadow-sm dark:border-white/[0.08] dark:bg-slate-950/30 p-4 sm:p-5 space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Draft and questionnaire</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Compose the letter, pull from AI or student drafts, and review questionnaire answers below.
          </p>
        </div>
        <Tabs defaultValue="letter" className="w-full min-w-0">
        <TabsList className="w-full h-auto grid grid-cols-2 sm:inline-flex sm:w-auto gap-1 rounded-xl p-1 border border-slate-200/70 dark:border-white/[0.08] bg-slate-100/80 dark:bg-white/[0.04]">
          <TabsTrigger value="letter" className="rounded-lg text-xs sm:text-sm px-3 py-2">
            Letter
          </TabsTrigger>
          <TabsTrigger value="student" className="rounded-lg text-xs sm:text-sm px-3 py-2">
            Student questionnaire
          </TabsTrigger>
        </TabsList>
        <TabsContent value="letter" className="mt-4 space-y-3 min-w-0 outline-none">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Edit the greeting, Re: line, and letter body before you approve. The preview uses your letterhead — same
            layout as the student&apos;s PDF download.
          </p>
          <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-900/35 bg-emerald-50/45 dark:bg-emerald-950/20 p-3 sm:p-4 space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">PDF greeting (salutation)</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                If the student forgot a custom greeting, set it here — e.g. enter{" "}
                <span className="font-medium text-slate-800 dark:text-slate-200">Selection Committee</span> for{" "}
                <span className="font-medium text-slate-800 dark:text-slate-200">Dear Selection Committee:</span>. Leave
                all fields empty for &quot;To Whom It May Concern&quot;.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 min-w-0 sm:col-span-2">
                <Label htmlFor="instructor-greeting-recipient" className="text-xs">
                  Greeting addressee
                </Label>
                <Input
                  id="instructor-greeting-recipient"
                  className="rounded-xl h-10 text-sm bg-white dark:bg-slate-950/45"
                  value={greetingRecipientName}
                  onChange={(e) => {
                    letterHeadingDirtyRef.current = true
                    setGreetingRecipientName(e.target.value)
                  }}
                  placeholder="e.g., Selection Committee"
                  maxLength={500}
                  disabled={!!busy}
                />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label htmlFor="instructor-greeting-org" className="text-xs">
                  Organization <span className="font-normal text-slate-500">(optional)</span>
                </Label>
                <Input
                  id="instructor-greeting-org"
                  className="rounded-xl h-10 text-sm bg-white dark:bg-slate-950/45"
                  value={greetingRecipientOrg}
                  onChange={(e) => {
                    letterHeadingDirtyRef.current = true
                    setGreetingRecipientOrg(e.target.value)
                  }}
                  maxLength={500}
                  disabled={!!busy}
                />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label htmlFor="instructor-greeting-preview" className="text-xs">
                  Preview line
                </Label>
                <p
                  id="instructor-greeting-preview"
                  className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white/80 dark:bg-slate-950/40 px-3 py-2.5 text-sm font-serif text-slate-900 dark:text-slate-100"
                >
                  {greetingPreviewLine}
                </p>
              </div>
              <div className="space-y-1.5 min-w-0 sm:col-span-2">
                <Label htmlFor="instructor-greeting-address" className="text-xs">
                  Mailing address <span className="font-normal text-slate-500">(optional)</span>
                </Label>
                <Textarea
                  id="instructor-greeting-address"
                  className="rounded-xl min-h-[4rem] text-sm bg-white dark:bg-slate-950/45 resize-y"
                  value={greetingRecipientAddress}
                  onChange={(e) => {
                    letterHeadingDirtyRef.current = true
                    setGreetingRecipientAddress(e.target.value.slice(0, 2000))
                  }}
                  placeholder={"Street\nCity, ST ZIP"}
                  maxLength={2000}
                  disabled={!!busy}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl h-8 text-xs"
                disabled={!!busy}
                onClick={() => {
                  letterHeadingDirtyRef.current = true
                  setGreetingRecipientName("Selection Committee")
                  setGreetingRecipientOrg("")
                }}
              >
                Use &quot;Dear Selection Committee&quot;
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl h-8 text-xs"
                disabled={!!busy}
                onClick={() => {
                  letterHeadingDirtyRef.current = true
                  setGreetingRecipientName("")
                  setGreetingRecipientOrg("")
                  setGreetingRecipientAddress("")
                }}
              >
                Reset to general letter
              </Button>
            </div>

            <div className="border-t border-emerald-200/60 dark:border-emerald-900/30 pt-4 space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Re: line (letter purpose)</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  For standard purposes, the line is{" "}
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    Re: Recommendation — Student (purpose)
                  </span>
                  . When you choose <span className="font-medium">Other</span>, your custom phrase is the entire Re:
                  line (we only add &quot;Re:&quot; if you omit it).
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="instructor-letter-purpose" className="text-xs">
                    Purpose
                  </Label>
                  <RecommendationPurposeSelect
                    id="instructor-letter-purpose"
                    value={letterPurpose}
                    onChange={(v) => {
                      letterHeadingDirtyRef.current = true
                      setLetterPurpose(v)
                      if (v !== "other") setLetterPurposeOther("")
                    }}
                    disabled={!!busy}
                  />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="instructor-re-line-preview" className="text-xs">
                    Preview line
                  </Label>
                  <p
                    id="instructor-re-line-preview"
                    className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white/80 dark:bg-slate-950/40 px-3 py-2.5 text-[13px] font-serif text-slate-900 dark:text-slate-100 leading-snug"
                  >
                    {reLinePreview}
                  </p>
                </div>
                {letterPurpose === "other" ? (
                  <div className="space-y-1.5 min-w-0 sm:col-span-2">
                    <Label htmlFor="instructor-letter-purpose-other" className="text-xs">
                      Full Re: line (custom)
                    </Label>
                    <Input
                      id="instructor-letter-purpose-other"
                      className="rounded-xl h-10 text-sm bg-white dark:bg-slate-950/45"
                      value={letterPurposeOther}
                      onChange={(e) => {
                        letterHeadingDirtyRef.current = true
                        setLetterPurposeOther(e.target.value)
                      }}
                      placeholder="e.g., Recommendation in Support of Angel Tillery's Application"
                      maxLength={500}
                      disabled={!!busy}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-col xl:flex-row xl:gap-5 xl:items-stretch xl:min-h-[min(520px,calc(100vh-14rem))] rounded-2xl border border-slate-200/75 dark:border-white/[0.08] overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
            <div className="flex flex-col gap-3 min-w-0 p-4 sm:p-5 xl:flex-1 xl:max-w-[min(100%,38rem)] border-b xl:border-b-0 xl:border-r border-slate-200/75 dark:border-white/[0.08] bg-white/70 dark:bg-slate-950/35">
              <InstructorRecommendationBriefDelivery
                requestId={requestId}
                deliveryMethod={normalizeDeliveryMethod(req.delivery_method)}
                designatedRecipientEmail={
                  typeof req.designated_recipient_email === "string"
                    ? req.designated_recipient_email
                    : null
                }
                briefMarkdown={
                  typeof bundle.brief?.brief_markdown === "string"
                    ? bundle.brief.brief_markdown
                    : null
                }
                onUpdated={onAfterMutation}
              />
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-xl gap-2 w-full sm:w-auto"
                  disabled={!!busy || !p}
                  onClick={() => void runAiSuggest()}
                >
                  {busy === "ai" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Cora — prepare draft
                </Button>
                {!p ? (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Available after the student submits their questionnaire.
                  </p>
                ) : null}
              </div>
              <Textarea
                className="rounded-xl flex-1 min-h-[240px] sm:min-h-[300px] text-sm font-serif leading-relaxed xl:min-h-[min(360px,calc(100vh-24rem))]"
                value={finalText}
                onChange={(e) => {
                  letterTextDirtyRef.current = true
                  setFinalText(e.target.value)
                }}
                placeholder="Edit the letter body here. Greeting and sign-off come from the letterhead — use the fields above for the salutation."
                spellCheck
              />
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-xl"
                  disabled={!!busy}
                  onClick={() => void saveLetterDraft(false)}
                >
                  {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save letter
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-1.5 border-[#582c83]/30 text-[#582c83] hover:bg-[#582c83]/5 dark:border-[#7a4eba]/45 dark:text-[#d4c4f0] dark:hover:bg-[#582c83]/15"
                  disabled={!!busy || !finalText.trim()}
                  onClick={() => void notifyStudentLetterReady()}
                >
                  {busy === "notify" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  Notify student — review &amp; download
                </Button>
                {(status === "student_selected" || status === "instructor_review_pending") && (
                  <Button
                    size="sm"
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                    disabled={!!busy}
                    onClick={() => void saveLetterDraft(true)}
                  >
                    {busy === "finalize" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Approve &amp; finalize for download
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Save keeps your edits private. Notify saves, unlocks the PDF for the student, and emails them to log in
                and download — or ask you for changes.
              </p>
            </div>
            <div
              className="flex flex-col min-h-[min(480px,55vh)] xl:min-h-0 xl:flex-1 xl:min-w-0 bg-gradient-to-br from-stone-100/90 via-stone-50 to-slate-100/70 dark:from-slate-900 dark:via-slate-950 dark:to-black/40"
              aria-labelledby="instructor-letter-preview-heading"
            >
              <div className="flex items-center gap-2 px-4 sm:px-5 pt-4 pb-3 border-b border-stone-200/80 dark:border-white/[0.07] shrink-0">
                <SplitSquareHorizontal className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p
                    id="instructor-letter-preview-heading"
                    className="text-sm font-semibold text-slate-900 dark:text-white"
                  >
                    Live PDF-style preview
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Student content with your department letterhead — scroll when needed
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg h-8 shrink-0 gap-1.5 text-xs"
                  onClick={() => setPreviewExpanded(true)}
                  aria-label="Expand letter preview"
                >
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                  Expand
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 min-h-[min(440px,50vh)]">
                <LetterheadLetterPreview
                  content={letterheadPreview}
                  className={cn(
                    "mx-auto w-full shadow-xl shadow-black/10 dark:shadow-black/60",
                    "xl:origin-top xl:scale-[0.92] xl:max-h-none",
                  )}
                />
              </div>
            </div>
          </div>
          <Dialog open={previewExpanded} onOpenChange={setPreviewExpanded}>
            <DialogContent
              className="flex max-h-[min(96vh,920px)] w-[min(96vw,52rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
              aria-describedby="instructor-letter-preview-dialog-desc"
            >
              <DialogHeader className="shrink-0 border-b border-stone-200/80 px-4 py-3 sm:px-5 dark:border-white/[0.08]">
                <div className="flex items-start gap-3 pr-8">
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="text-base">Live PDF-style preview</DialogTitle>
                    <DialogDescription id="instructor-letter-preview-dialog-desc" className="text-xs">
                      Full-size letterhead preview — same layout as the student&apos;s PDF download
                    </DialogDescription>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-lg"
                    onClick={() => setPreviewExpanded(false)}
                    aria-label="Close expanded preview"
                  >
                    <Minimize2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-br from-stone-100/90 via-stone-50 to-slate-100/70 px-4 py-5 sm:px-6 dark:from-slate-900 dark:via-slate-950 dark:to-black/40">
                <LetterheadLetterPreview
                  content={letterheadPreview}
                  className="mx-auto w-full max-w-[8.5in] shadow-2xl shadow-black/15 dark:shadow-black/50"
                />
              </div>
            </DialogContent>
          </Dialog>
          {bundle.drafts.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.08]">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Student AI drafts</h3>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {bundle.drafts.map((d) => (
                  <div
                    key={String(d.id)}
                    className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white/70 dark:bg-slate-950/30 p-3 text-xs flex flex-col max-h-56"
                  >
                    <p className="font-medium text-emerald-700 dark:text-emerald-400 mb-1">{String(d.version_label)}</p>
                    <p className="flex-1 overflow-y-auto whitespace-pre-wrap">{String(d.letter_text ?? "")}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 rounded-lg h-8 text-[11px] w-full shrink-0"
                      disabled={!!busy}
                      onClick={() => {
                        letterTextDirtyRef.current = true
                        setFinalText(String(d.letter_text ?? ""))
                      }}
                    >
                      Load into editor
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
        <TabsContent value="student" className="mt-4 outline-none">
          {p ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {profileField("Academic strengths", p.student_strengths)}
              {profileField("Achievements", p.achievements)}
              {profileField("Projects", p.projects)}
              {profileField("Skills", p.skills)}
              {profileField("Leadership", p.leadership_examples)}
              {profileField("Goals", p.goals)}
              {profileField("Class experience", p.class_experience)}
              {profileField("Personal qualities", p.personal_qualities)}
              {profileField("Letter emphasis", p.letter_for)}
              {profileField("Special instructions", p.special_instructions)}
              {profileField("Content mode", p.content_mode)}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-white/15">
              No questionnaire submitted yet.
            </p>
          )}
          {bundle.attachments && bundle.attachments.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-semibold">Attachments</h3>
              <ul className="text-xs space-y-1">
                {bundle.attachments.map((a, i) => (
                  <li key={String((a as { id?: number }).id ?? i)} className="text-slate-600 dark:text-slate-400">
                    <span className="font-medium capitalize">{(a as { file_type?: string }).file_type}</span>
                    {(a as { file_name?: string }).file_name ? ` — ${(a as { file_name?: string }).file_name}` : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>
      </Tabs>
      </section>

      <div className="rounded-xl border border-red-200/70 bg-red-50/40 p-4 dark:border-red-900/45 dark:bg-red-950/20 space-y-2">
        <p className="text-sm font-medium text-red-900 dark:text-red-100">Danger zone</p>
        <p className="text-xs text-red-800/90 dark:text-red-200/85 leading-relaxed">
          Permanently remove this request and all related questionnaire data, drafts, and files. This cannot be undone.
        </p>
        <Button
          type="button"
          variant="destructive"
          className="rounded-xl"
          disabled={!!busy || deleteBusy}
          onClick={() => setDeleteOpen(true)}
        >
          Delete request
        </Button>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this request?</AlertDialogTitle>
            <AlertDialogDescription>
              The student will no longer see it. All drafts, uploads, and PDFs tied to this request are removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={deleteBusy}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              disabled={deleteBusy}
              onClick={async () => {
                const inst = getInstructorData()
                if (!inst?.id) {
                  setErr("Not signed in")
                  return
                }
                setDeleteBusy(true)
                setErr(null)
                try {
                  const res = await instructorApiFetch(`/api/instructor/recommendations/${requestId}`, {
                    method: "DELETE",
                    headers: buildInstructorAuthorizedApiHeaders({
                      "x-instructor-id": String(inst.id),
                    }),
                  })
                  const j = await res.json()
                  if (!res.ok) throw new Error(j.error || "Failed")
                  setDeleteOpen(false)
                  onRequestDeleted?.()
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Failed to delete")
                } finally {
                  setDeleteBusy(false)
                }
              }}
            >
              {deleteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete permanently"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {bundle.audit && bundle.audit.length > 0 && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 max-h-36 overflow-y-auto rounded-lg border border-slate-200/60 dark:border-white/[0.06] bg-slate-50/40 dark:bg-slate-950/20 p-3">
          <h3 className="font-medium text-slate-700 dark:text-slate-300 sticky top-0 bg-inherit">Recent activity</h3>
          {(bundle.audit as { action: string; created_at: string }[]).slice(0, 12).map((a) => (
            <div key={`${a.created_at}-${a.action}`}>
              {String(a.created_at)}: {a.action}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
