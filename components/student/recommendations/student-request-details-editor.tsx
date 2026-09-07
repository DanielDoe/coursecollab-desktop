"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight, Loader2, Pencil } from "lucide-react"
import { getInstructorData, studentApiFetch } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { RecommendationPurposeSelect } from "@/components/student/recommendations/recommendation-purpose-select"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"

type ReqShape = Record<string, string | boolean | null | undefined>

export function StudentRequestDetailsEditor(props: {
  requestId: string
  /** Student session id — required when `actor` is `"student"` (default). */
  studentKey?: string
  actor?: "student" | "instructor"
  req: ReqShape
  settings?: Record<string, string | number | boolean | null> | null | undefined
  onSaved: () => void | Promise<void>
  disabled?: boolean
  /** Instructor: purpose/greeting live in the Letter tab — hide duplicate fields here. */
  hideLetterHeadingFields?: boolean
}) {
  const { requestId, studentKey, actor = "student", req, settings, onSaved, disabled, hideLetterHeadingFields } = props
  const mode = actor
  const updatedKey = typeof req.updated_at === "string" ? req.updated_at : ""

  /** Instructors often need recipient/salutation fixes on submitted drafts — show the form expanded by default. */
  const [open, setOpen] = useState(() => mode === "instructor")
  const [purpose, setPurpose] = useState(() => String(req.purpose ?? "other"))
  const [purposeOther, setPurposeOther] = useState(() =>
    typeof req.purpose_other_detail === "string" ? req.purpose_other_detail : "",
  )
  const [deadline, setDeadline] = useState(() => {
    const d = req.deadline
    if (d == null || d === "") return ""
    return String(d).slice(0, 10)
  })
  const [recipientName, setRecipientName] = useState(() =>
    typeof req.recipient_name === "string" ? req.recipient_name : "",
  )
  const [recipientOrg, setRecipientOrg] = useState(() =>
    typeof req.recipient_organization === "string" ? req.recipient_organization : "",
  )
  const [recipientAddress, setRecipientAddress] = useState(() =>
    typeof req.recipient_address === "string" ? req.recipient_address : "",
  )
  const [specific, setSpecific] = useState(() => Boolean(req.letter_is_specific))
  const [note, setNote] = useState(() =>
    typeof req.student_request_description === "string" ? req.student_request_description : "",
  )
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    setPurpose(String(req.purpose ?? "other"))
    setPurposeOther(typeof req.purpose_other_detail === "string" ? req.purpose_other_detail : "")
    const d = req.deadline
    setDeadline(d == null || d === "" ? "" : String(d).slice(0, 10))
    setRecipientName(typeof req.recipient_name === "string" ? req.recipient_name : "")
    setRecipientOrg(typeof req.recipient_organization === "string" ? req.recipient_organization : "")
    setRecipientAddress(typeof req.recipient_address === "string" ? req.recipient_address : "")
    setSpecific(Boolean(req.letter_is_specific))
    setNote(typeof req.student_request_description === "string" ? req.student_request_description : "")
  }, [
    updatedKey,
    req.purpose,
    req.purpose_other_detail,
    req.deadline,
    req.recipient_name,
    req.recipient_organization,
    req.recipient_address,
    req.letter_is_specific,
    req.student_request_description,
  ])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (purpose === "other" && purposeOther.trim().length < 2) {
      setMsg(
        'Add a short phrase (2+ characters) when purpose is "Other" — it appears on the formal letter instead of the word Other.',
      )
      return
    }
    if (mode === "student" && !studentKey?.trim()) {
      setMsg("Session error — reload and try again.")
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const hasRecipientBlock =
        recipientName.trim().length > 0 ||
        recipientOrg.trim().length > 0 ||
        recipientAddress.trim().length > 0
      const letterIsSpecificPayload =
        mode === "instructor" ? hasRecipientBlock : specific
      const payload = {
        purpose,
        purposeOtherDetail: purpose === "other" ? purposeOther.trim().slice(0, 500) : null,
        deadline: deadline || null,
        recipientName: recipientName.trim() || null,
        recipientOrganization: recipientOrg.trim() || null,
        recipientAddress:
          letterIsSpecificPayload ? recipientAddress.trim().slice(0, 2000) || null : null,
        letterIsSpecific: letterIsSpecificPayload,
        studentRequestDescription: note.trim().slice(0, 4000) || null,
      }
      let res: Response
      if (mode === "instructor") {
        const inst = getInstructorData()
        if (!inst?.id) throw new Error("Not signed in as instructor")
        res = await instructorApiFetch(`/api/instructor/recommendations/${requestId}/request-details`, {
          method: "PATCH",
          headers: buildInstructorAuthorizedApiHeaders({
            "Content-Type": "application/json",
            "x-instructor-id": String(inst.id),
          }),
          body: JSON.stringify(payload),
        })
      } else {
        res = await studentApiFetch(`/api/student/recommendations/${requestId}/request-details`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, studentDatabaseId: studentKey }),
        })
      }
      const j = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(j.error || "Could not save")
      await onSaved()
      setMsg(
        mode === "instructor"
          ? "Saved. The student was notified."
          : "Saved. Your instructor was notified — no re-approval needed.",
      )
      window.setTimeout(() => setMsg(null), 5000)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save")
    } finally {
      setBusy(false)
    }
  }

  const reqDeadline =
    typeof settings?.require_purpose_deadline === "boolean" ? settings.require_purpose_deadline : false
  const minNotice = Math.max(0, Number(settings?.minimum_notice_days) || 0)

  const field =
    "rounded-xl w-full min-w-0 border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/45 text-slate-900 dark:text-slate-100"

  const accentRing = mode === "instructor" ? "focus-visible:ring-emerald-500/35" : "focus-visible:ring-sky-600/35"
  const accentIcon =
    mode === "instructor"
      ? "border-emerald-200/70 dark:border-emerald-900/35 text-emerald-800 dark:text-emerald-300"
      : "border-sky-600/25 text-sky-600 dark:text-sky-300"
  const wrap =
    mode === "instructor"
      ? "rounded-2xl border border-emerald-200/65 dark:border-emerald-900/35 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 sm:p-5"
      : "rounded-2xl border border-sky-600/14 dark:border-sky-300/22 bg-sky-600/[0.03] dark:bg-sky-600/12 p-4 sm:p-5"

  return (
    <div className={wrap}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-start gap-3 text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 ${accentRing}`}
      >
        <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-white dark:bg-slate-950/50 ${accentIcon}`}>
          <Pencil className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 font-semibold text-sm text-slate-900 dark:text-white">
            {mode === "instructor" ? "Student-facing request details" : "Edit request details"}
            {open ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            )}
          </span>
          <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {mode === "instructor"
              ? hideLetterHeadingFields
                ? String(req.status ?? "") === "finalized" || String(req.status ?? "") === "downloaded"
                  ? "Deadline and student context. After letter-heading changes on the Letter tab, use Notify student so the PDF and email stay in sync."
                  : "Deadline and student context. Greeting and Re: line are edited on the Letter tab before you approve."
                : "Purpose, deadline, and the formal PDF recipient block (greeting + inside address). Use recipient fields to replace “To whom it may concern” when the student forgot."
              : "Fix spelling, update purpose or deadline, or refine your note. Your instructor gets a heads-up — this does not reset their approval or review steps."}
          </span>
        </span>
      </button>

      {open ? (
        <form onSubmit={(e) => void handleSave(e)} className="mt-4 space-y-3 border-t border-slate-200/70 dark:border-white/[0.08] pt-4">
          {msg ? (
            <p
              className={cn(
                "text-sm rounded-xl px-3 py-2",
                msg.startsWith("Saved")
                  ? "text-emerald-800 dark:text-emerald-300 bg-emerald-50/90 dark:bg-emerald-950/30"
                  : "text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-950/25",
              )}
              role="status"
            >
              {msg}
            </p>
          ) : null}

          {!hideLetterHeadingFields ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Purpose</Label>
                <RecommendationPurposeSelect
                  value={purpose}
                  onChange={(v) => {
                    setPurpose(v)
                    if (v !== "other") setPurposeOther("")
                  }}
                  disabled={busy || disabled}
                />
              </div>

              {purpose === "other" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Full Re: line (custom){" "}
                    <span className="font-normal text-slate-500 dark:text-slate-400">
                      — your phrase is the entire subject when purpose is Other
                    </span>
                  </Label>
                  <Input
                    className={cn(field, "h-10")}
                    value={purposeOther}
                    onChange={(e) => setPurposeOther(e.target.value)}
                    placeholder="e.g., Fulbright fellowship application"
                    maxLength={500}
                    disabled={busy || disabled}
                    required
                  />
                </div>
              ) : null}
            </>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-xs">
              Deadline{" "}
              {!reqDeadline ? (
                <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
              ) : null}
            </Label>
            <Input
              className={cn(field, "h-10")}
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={busy || disabled}
              required={reqDeadline}
            />
            {minNotice > 0 ? (
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Must be at least {minNotice} day(s) from today (instructor rule).
              </p>
            ) : null}
          </div>

          {mode === "student" ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-100">Specific recipient</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Turn off for a general letter.</p>
                </div>
                <Switch
                  checked={specific}
                  onCheckedChange={(c) => {
                    setSpecific(c)
                    if (!c) {
                      setRecipientName("")
                      setRecipientOrg("")
                      setRecipientAddress("")
                    }
                  }}
                  disabled={busy || disabled}
                />
              </div>

              {specific ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 min-w-0">
                      <Label className="text-xs">Recipient</Label>
                      <Input
                        className={cn(field, "h-10")}
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        disabled={busy || disabled}
                        maxLength={500}
                      />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <Label className="text-xs">Organization (optional)</Label>
                      <Input
                        className={cn(field, "h-10")}
                        value={recipientOrg}
                        onChange={(e) => setRecipientOrg(e.target.value)}
                        disabled={busy || disabled}
                        maxLength={500}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Mailing address <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
                    </Label>
                    <Textarea
                      className={cn(field, "min-h-[4rem] resize-y text-sm py-2")}
                      value={recipientAddress}
                      maxLength={2000}
                      placeholder={"Street\nCity, ST ZIP"}
                      onChange={(e) => setRecipientAddress(e.target.value.slice(0, 2000))}
                      disabled={busy || disabled}
                    />
                  </div>
                </div>
              ) : null}
            </>
          ) : hideLetterHeadingFields ? null : (
            <div className="space-y-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white/60 dark:bg-slate-950/30 p-3 sm:p-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-800 dark:text-slate-100">Formal PDF salutation & recipient</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  The exported letterhead uses these fields for the greeting and inside address. Leave all three empty for
                  “To whom it may concern” and no mailing block. Filling any field marks this as a specific recipient on the
                  request.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs">Recipient name</Label>
                  <Input
                    className={cn(field, "h-10")}
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    disabled={busy || disabled}
                    maxLength={500}
                    placeholder="e.g., Dr. A. Rivera"
                  />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs">Organization (optional)</Label>
                  <Input
                    className={cn(field, "h-10")}
                    value={recipientOrg}
                    onChange={(e) => setRecipientOrg(e.target.value)}
                    disabled={busy || disabled}
                    maxLength={500}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Mailing address <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
                </Label>
                <Textarea
                  className={cn(field, "min-h-[4rem] resize-y text-sm py-2")}
                  value={recipientAddress}
                  maxLength={2000}
                  placeholder={"Street\nCity, ST ZIP"}
                  onChange={(e) => setRecipientAddress(e.target.value.slice(0, 2000))}
                  disabled={busy || disabled}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">
              Context for instructor <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
            </Label>
            <Textarea
              className={cn(field, "min-h-[4rem] resize-y text-sm py-2")}
              value={note}
              maxLength={4000}
              onChange={(e) => setNote(e.target.value.slice(0, 4000))}
              disabled={busy || disabled}
            />
          </div>

          <Button
            type="submit"
            disabled={busy || disabled}
            className={
              mode === "instructor"
                ? "rounded-xl bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
                : "rounded-xl bg-sky-600 hover:bg-sky-700 w-full sm:w-auto"
            }
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </span>
            ) : (
              "Save changes"
            )}
          </Button>
        </form>
      ) : null}
    </div>
  )
}
