"use client"

import { studentApiFetch, getStudentAuthHeaders } from "@/lib/auth"
import { useEffect, useId, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  RecommendationPurposeSelect,
  recommendSelectContentCn,
  recommendSelectItemCn,
  recommendSelectTriggerCn,
} from "@/components/student/recommendations/recommendation-purpose-select"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { PORTAL_CTA, PORTAL_OUTLINE_BTN } from "@/lib/appearance/portal-nav-classes"

export type NewRecommendationRequestFormProps = {
  studentKey: string
  /** Return URL for cancel (standalone page only) */
  listHref: string
  onCreated: (requestId: number) => void
  /** Omit cancel button on combined list page */
  showCancel?: boolean
  className?: string
  /** Guest portal: faculty accept each letter; course is the GUEST session. */
  guestMode?: boolean
}

export function NewRecommendationRequestForm({
  studentKey,
  listHref,
  onCreated,
  showCancel = false,
  className,
  guestMode = false,
}: NewRecommendationRequestFormProps) {
  const uid = useId()
  const specId = `${uid}-spec`
  const [sessions, setSessions] = useState<{ id: number; code: string; description: string | null }[]>([])
  const [instructors, setInstructors] = useState<{ id: number; name: string | null; email: string | null }[]>([])
  const [courseId, setCourseId] = useState("")
  const [instructorId, setInstructorId] = useState("")
  const [purpose, setPurpose] = useState<string>("scholarship")
  const [purposeOther, setPurposeOther] = useState("")
  const [deadline, setDeadline] = useState("")
  const [recipientName, setRecipientName] = useState("")
  const [recipientOrg, setRecipientOrg] = useState("")
  const [recipientAddress, setRecipientAddress] = useState("")
  const [specific, setSpecific] = useState(false)
  const [requestDescription, setRequestDescription] = useState("")
  const [metaErr, setMetaErr] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await studentApiFetch(`/api/student/recommendations/meta?studentDatabaseId=${encodeURIComponent(studentKey)}`)
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || "Failed to load")
        if (cancelled) return
        setMetaErr(null)
        setSessions(j.sessions || [])
        setInstructors(j.instructors || [])
        const stSession = j.student?.session_id
        if (stSession) setCourseId(String(stSession))
        else if ((j.sessions || []).length === 1) setCourseId(String(j.sessions[0].id))
      } catch (e) {
        if (!cancelled) setMetaErr(e instanceof Error ? e.message : "Failed to load form")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [studentKey])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (purpose === "other" && purposeOther.trim().length < 2) {
      setErr(
        'When purpose is "Other", add a short phrase (2+ characters) for the formal letter (Re: line).',
      )
      return
    }
    setSaving(true)
    try {
      const res = await studentApiFetch("/api/student/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentDatabaseId: studentKey,
          courseId: Number(courseId),
          instructorId: Number(instructorId),
          purpose,
          purposeOtherDetail: purpose === "other" ? purposeOther.trim().slice(0, 500) : null,
          deadline: deadline || null,
          recipientName: recipientName || null,
          recipientOrganization: recipientOrg || null,
          recipientAddress: specific ? recipientAddress.trim().slice(0, 2000) || null : null,
          letterIsSpecific: specific,
          studentRequestDescription: requestDescription.trim() || null,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || "Failed")
      onCreated(Number(j.id))
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  const field =
    "rounded-lg w-full min-w-0 border-[var(--border)] bg-[var(--muted)]/40 text-[var(--cc-text)]"

  return (
    <form onSubmit={submit} className={cn("space-y-3 sm:space-y-4 [&_label]:text-[var(--cc-text)]", className)}>
      {metaErr && (
        <p className="text-sm text-amber-700 dark:text-amber-300 rounded-lg border border-amber-200/80 dark:border-amber-900/30 bg-amber-50/80 dark:bg-amber-950/20 px-3 py-2" role="status">
          {metaErr}
        </p>
      )}
      {err && (
        <p className="text-sm text-red-600 dark:text-red-400 rounded-lg border border-red-200/80 dark:border-red-900/40 bg-red-50/80 dark:bg-red-950/25 px-3 py-2" role="alert">
          {err}
        </p>
      )}
      {guestMode ? (
        <div className="rounded-xl border border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)] px-3 py-2.5 text-xs leading-relaxed text-[var(--cc-accent-dark)]">
          Faculty review every letter request. Submitting asks them to accept you — they can decline. Career tools stay open without that step.
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:gap-3.5">
        {guestMode ? null : (
        <div className="space-y-1.5">
          <Label className="text-xs sm:text-sm">Course (session)</Label>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger className={recommendSelectTriggerCn()} aria-label="Course session">
              <SelectValue placeholder="Select course" />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={6} align="start" className={recommendSelectContentCn()}>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={String(s.id)} className={recommendSelectItemCn()}>
                  {s.code} {s.description ? `— ${s.description}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs sm:text-sm">Instructor</Label>
            <Select value={instructorId} onValueChange={setInstructorId}>
              <SelectTrigger className={recommendSelectTriggerCn()} aria-label="Instructor">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={6} align="start" className={recommendSelectContentCn()}>
                {instructors.map((i) => (
                  <SelectItem key={i.id} value={String(i.id)} className={recommendSelectItemCn()}>
                    {i.name || i.email || `Instructor #${i.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs sm:text-sm">Purpose</Label>
            <RecommendationPurposeSelect
              value={purpose}
              onChange={(v) => {
                setPurpose(v)
                if (v !== "other") setPurposeOther("")
              }}
            />
          </div>
        </div>
        {purpose === "other" ? (
          <div className="space-y-1.5">
            <Label className="text-xs sm:text-sm">
              Formal letter phrase <span className="font-normal text-[var(--cc-text-muted)]">(Re: line)</span>
            </Label>
            <Input
              className={cn(field, "h-10")}
              value={purposeOther}
              onChange={(e) => setPurposeOther(e.target.value.slice(0, 500))}
              placeholder="e.g., Fulbright fellowship application"
              required
            />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label className="text-xs sm:text-sm">Deadline</Label>
          <Input className={cn(field, "h-10")} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs sm:text-sm">
            Context for your instructor <span className="font-normal text-[var(--cc-text-muted)]">(optional)</span>
          </Label>
          <Textarea
            className={cn(field, "min-h-[4.5rem] resize-y text-sm py-2.5")}
            placeholder="e.g. program name, why you're applying, anything they should highlight"
            value={requestDescription}
            maxLength={4000}
            onChange={(e) => setRequestDescription(e.target.value.slice(0, 4000))}
          />
          <p className="text-[10px] text-[var(--cc-text-muted)] tabular-nums">{requestDescription.length}/4000</p>
        </div>
      </div>

      <div className="flex items-start gap-2.5 pt-0.5">
        <Checkbox
          id={specId}
          checked={specific}
          onCheckedChange={(c) => {
            const on = Boolean(c)
            setSpecific(on)
            if (!on) {
              setRecipientName("")
              setRecipientOrg("")
              setRecipientAddress("")
            }
          }}
          className="mt-0.5"
        />
        <Label htmlFor={specId} className="font-normal cursor-pointer text-xs sm:text-sm leading-snug text-[var(--cc-text)]">
          Addressed to a specific person or organization
        </Label>
      </div>

      {specific ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-3 sm:px-4 sm:py-4 space-y-3">
          <p className="text-[11px] font-medium text-[var(--cc-text)]">Recipient details (shown on the formal letter)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs sm:text-sm">Addressee name</Label>
              <Input className={cn(field, "h-10")} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="e.g., Dr. A. Rivera" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs sm:text-sm">Organization (optional)</Label>
              <Input className={cn(field, "h-10")} value={recipientOrg} onChange={(e) => setRecipientOrg(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs sm:text-sm">
              Mailing address <span className="font-normal text-[var(--cc-text-muted)]">(optional)</span>
            </Label>
            <Textarea
              className={cn(field, "min-h-[4.75rem] resize-y text-sm py-2.5")}
              placeholder={
                "Street or PO Box\nCity, ST ZIP Code"
              }
              value={recipientAddress}
              maxLength={2000}
              onChange={(e) => setRecipientAddress(e.target.value.slice(0, 2000))}
            />
            <p className="text-[10px] text-[var(--cc-text-muted)] leading-snug">
              Appears in the letter after the date — use separate lines like a printed envelope.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center pt-1">
        <Button
          type="submit"
          disabled={saving || !courseId || !instructorId}
          className={cn("rounded-full w-full sm:w-auto h-10", PORTAL_CTA)}
        >
          {saving ? "Submitting…" : "Submit request"}
        </Button>
        {showCancel && (
          <Button type="button" variant="ghost" asChild className={cn("rounded-full w-full sm:w-auto h-10", PORTAL_OUTLINE_BTN)}>
            <Link href={listHref}>Cancel</Link>
          </Button>
        )}
      </div>
    </form>
  )
}
