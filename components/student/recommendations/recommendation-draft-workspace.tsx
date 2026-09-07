"use client"

import { studentApiFetch, getStudentAuthHeaders } from "@/lib/auth"
import { useEffect, useMemo, useState } from "react"
import { SplitSquareHorizontal, Keyboard, Loader2 } from "lucide-react"
import { LetterheadLetterPreview } from "@/components/recommendation-letter/LetterheadLetterPreview"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { buildLetterheadPreviewContentForStudentDraft } from "@/lib/recommendation-draft-letter-preview"
import { RecommendationPurposeSelect } from "@/components/student/recommendations/recommendation-purpose-select"

type RecommendationDraftWorkspaceProps = {
  requestId: string
  req: Record<string, unknown>
  settings: Record<string, unknown> | undefined
  manualLetterText: string
  onManualLetterTextChange: (value: string) => void
  studentKey?: string | null
  /** Called after letter metadata PATCH so parent can merge `request` (e.g. reload). */
  onLetterMetaSaved?: () => void | Promise<void>
  busy: boolean
  intakeBusy: boolean
  onSubmit: () => void | Promise<void>
  onResetIntake?: () => void | Promise<void>
  showBackToOptions: boolean
  requireFinalReview: boolean | undefined
}

function wordCount(s: string): number {
  const t = s.trim()
  if (!t) return 0
  return t.split(/\s+/).filter(Boolean).length
}

export function RecommendationDraftWorkspace({
  requestId,
  req,
  settings,
  manualLetterText,
  onManualLetterTextChange,
  studentKey,
  onLetterMetaSaved,
  busy,
  intakeBusy,
  onSubmit,
  onResetIntake,
  showBackToOptions,
  requireFinalReview,
}: RecommendationDraftWorkspaceProps) {
  const [purposeV, setPurposeV] = useState<string>(() =>
    typeof req.purpose === "string" ? req.purpose : "other",
  )
  const [purposeOtherDetailV, setPurposeOtherDetailV] = useState(() =>
    typeof req.purpose_other_detail === "string" ? req.purpose_other_detail : "",
  )
  const [recipientNameV, setRecipientNameV] = useState(() =>
    typeof req.recipient_name === "string" ? req.recipient_name : "",
  )
  const [recipientOrgV, setRecipientOrgV] = useState(() =>
    typeof req.recipient_organization === "string" ? req.recipient_organization : "",
  )
  const [recipientAddrV, setRecipientAddrV] = useState(() =>
    typeof req.recipient_address === "string" ? req.recipient_address : "",
  )
  const [letterSpecificV, setLetterSpecificV] = useState(() => Boolean(req.letter_is_specific))
  const [metaBusy, setMetaBusy] = useState(false)
  const [metaMsg, setMetaMsg] = useState<string | null>(null)

  useEffect(() => {
    setPurposeV(typeof req.purpose === "string" ? req.purpose : "other")
    setPurposeOtherDetailV(typeof req.purpose_other_detail === "string" ? req.purpose_other_detail : "")
    setRecipientNameV(typeof req.recipient_name === "string" ? req.recipient_name : "")
    setRecipientOrgV(typeof req.recipient_organization === "string" ? req.recipient_organization : "")
    setRecipientAddrV(typeof req.recipient_address === "string" ? req.recipient_address : "")
    setLetterSpecificV(Boolean(req.letter_is_specific))
  }, [
    typeof req.updated_at === "string" ? req.updated_at : "",
    req.purpose,
    req.purpose_other_detail,
    req.recipient_name,
    req.recipient_organization,
    req.recipient_address,
    req.letter_is_specific,
  ])

  const previewPayload = useMemo(
    (): Record<string, unknown> => ({
      ...req,
      purpose: purposeV,
      purpose_other_detail:
        purposeV === "other" ? purposeOtherDetailV.trim().slice(0, 500) || null : null,
      recipient_name: letterSpecificV ? recipientNameV.trim() || null : null,
      recipient_organization: letterSpecificV ? recipientOrgV.trim() || null : null,
      recipient_address:
        letterSpecificV && recipientAddrV.trim()
          ? recipientAddrV.trim().slice(0, 2000)
          : null,
      letter_is_specific: letterSpecificV,
    }),
    [req, purposeV, purposeOtherDetailV, recipientNameV, recipientOrgV, recipientAddrV, letterSpecificV],
  )

  async function persistLetterMeta(): Promise<boolean> {
    if (!studentKey) {
      setMetaMsg("Missing session")
      return false
    }
    if (purposeV === "other" && purposeOtherDetailV.trim().length < 2) {
      setMetaMsg(
        'Add a short phrase (2+ characters) when purpose is Other — it appears on the formal letter.',
      )
      return false
    }
    setMetaBusy(true)
    setMetaMsg(null)
    try {
      const res = await studentApiFetch(`/api/student/recommendations/${requestId}/request-details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentDatabaseId: studentKey,
          purpose: purposeV,
          purposeOtherDetail: purposeV === "other" ? purposeOtherDetailV.trim().slice(0, 500) : null,
          recipientName: recipientNameV.trim() || null,
          recipientOrganization: recipientOrgV.trim() || null,
          recipientAddress: letterSpecificV ? recipientAddrV.trim().slice(0, 2000) || null : null,
          letterIsSpecific: letterSpecificV,
        }),
      })
      const j = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(j.error || "Could not save")
      await onLetterMetaSaved?.()
      return true
    } catch (e) {
      setMetaMsg(e instanceof Error ? e.message : "Could not save")
      return false
    } finally {
      setMetaBusy(false)
    }
  }

  async function handleSaveHeadingClick() {
    const ok = await persistLetterMeta()
    if (ok) {
      setMetaMsg("Saved")
      window.setTimeout(() => setMetaMsg(null), 2500)
    }
  }

  async function handleSendToInstructor() {
    const ok = await persistLetterMeta()
    if (!ok) return
    await onSubmit()
  }

  const previewContent = useMemo(
    () => buildLetterheadPreviewContentForStudentDraft({ manualLetterText, req: previewPayload, settings }),
    [manualLetterText, previewPayload, settings],
  )
  const words = wordCount(manualLetterText)

  return (
    <div
      id="rec-section-manual-letter"
      className="rounded-[1.35rem] border border-sky-600/14 dark:border-sky-300/20 bg-sky-600/[0.04] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] dark:shadow-none overflow-hidden scroll-mt-28"
    >
      <div className="flex flex-col xl:flex-row xl:min-h-[min(920px,calc(100vh-14rem))]">
        <section
          className={cn(
            "flex flex-col border-b xl:border-b-0 xl:border-r border-sky-600/12 dark:border-white/[0.07]",
            "xl:w-[min(100%,26rem)] shrink-0 bg-white/85 dark:bg-slate-950/60 backdrop-blur-sm",
          )}
          aria-labelledby="draft-tools-heading"
        >
          <div className="p-5 sm:p-6 flex flex-col flex-1 min-h-0 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sky-600 dark:text-sky-300">
                <Keyboard className="h-4 w-4 shrink-0" aria-hidden />
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">Request #{requestId}</span>
              </div>
              <h2 id="draft-tools-heading" className="text-lg font-semibold text-slate-900 dark:text-white leading-tight">
                Editing tools
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Your instructor&apos;s letterhead, signature, and footer are fixed — compose the memo body here or paste from
                a draft. The preview updates as you type.
              </p>
            </div>

            <div className="rounded-xl border border-sky-600/14 dark:border-white/[0.08] bg-white/90 dark:bg-slate-950/40 px-3 py-3 space-y-3 shrink-0">
              <div className="space-y-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-300">
                  Formal letter heading
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Sets the greeting, the{" "}
                  <span className="font-medium text-slate-700 dark:text-slate-300">Re: Recommendation …</span> line, and
                  what instructors export as PDF — save before you submit if you edit.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rec-draft-purpose" className="text-xs font-medium">
                  Letter purpose
                </Label>
                <RecommendationPurposeSelect
                  id="rec-draft-purpose"
                  value={purposeV}
                  onChange={(v) => {
                    setPurposeV(v)
                    if (v !== "other") setPurposeOtherDetailV("")
                  }}
                  disabled={busy || metaBusy || intakeBusy}
                />
                {purposeV === "other" ? (
                  <div className="space-y-1 pt-1">
                    <Label htmlFor="rec-draft-purpose-other" className="text-[11px]">
                      Full Re: line (custom){" "}
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        — your text is the entire subject; we only add &quot;Re:&quot; if needed
                      </span>
                    </Label>
                    <Input
                      id="rec-draft-purpose-other"
                      className="h-10 rounded-lg text-sm"
                      value={purposeOtherDetailV}
                      onChange={(e) => setPurposeOtherDetailV(e.target.value)}
                      placeholder="e.g., Recommendation in Support of Jane Doe's Application"
                      disabled={busy || metaBusy || intakeBusy}
                      maxLength={500}
                      required={purposeV === "other"}
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-100">Specific recipient</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Turn off for a general letter (“To whom it may concern”).
                  </p>
                </div>
                <Switch
                  checked={letterSpecificV}
                  onCheckedChange={(c) => {
                    setLetterSpecificV(c)
                    if (!c) {
                      setRecipientNameV("")
                      setRecipientOrgV("")
                      setRecipientAddrV("")
                    }
                  }}
                  disabled={busy || metaBusy || intakeBusy}
                  aria-label="Letter is addressed to a specific recipient"
                />
              </div>
              {letterSpecificV ? (
                <div className="grid gap-2 sm:grid-cols-1">
                  <div className="space-y-1">
                    <Label htmlFor="rec-draft-recipient-name" className="text-[11px]">
                      Recipient name
                    </Label>
                    <Input
                      id="rec-draft-recipient-name"
                      className="h-10 rounded-lg text-sm"
                      value={recipientNameV}
                      onChange={(e) => setRecipientNameV(e.target.value)}
                      placeholder="e.g., Dr. Smith"
                      disabled={busy || metaBusy || intakeBusy}
                      maxLength={500}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="rec-draft-recipient-org" className="text-[11px]">
                      Recipient organization (optional)
                    </Label>
                    <Input
                      id="rec-draft-recipient-org"
                      className="h-10 rounded-lg text-sm"
                      value={recipientOrgV}
                      onChange={(e) => setRecipientOrgV(e.target.value)}
                      placeholder="e.g., Graduate Admissions"
                      disabled={busy || metaBusy || intakeBusy}
                      maxLength={500}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="rec-draft-recipient-addr" className="text-[11px]">
                      Mailing address <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
                    </Label>
                    <Textarea
                      id="rec-draft-recipient-addr"
                      className="min-h-[4.5rem] rounded-lg text-sm resize-y"
                      value={recipientAddrV}
                      onChange={(e) => setRecipientAddrV(e.target.value.slice(0, 2000))}
                      placeholder={"Street or PO Box\nCity, ST ZIP"}
                      disabled={busy || metaBusy || intakeBusy}
                      maxLength={2000}
                      rows={3}
                    />
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                      Shown below the date on the official letter.
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl h-9 border-slate-200/90 dark:border-white/12 text-xs"
                  onClick={() => void handleSaveHeadingClick()}
                  disabled={busy || metaBusy || intakeBusy || !studentKey}
                >
                  {metaBusy ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      Saving…
                    </span>
                  ) : (
                    "Save formal heading"
                  )}
                </Button>
                {metaMsg ? (
                  <span
                    className={cn(
                      "text-[11px]",
                      metaMsg === "Saved" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {metaMsg}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="rounded-full bg-slate-100 dark:bg-white/[0.06] px-2.5 py-0.5 font-medium tabular-nums">
                {words} word{words === 1 ? "" : "s"}
              </span>
              <span className="text-slate-400 dark:text-slate-500">Separate paragraphs with a blank line for spacing.</span>
            </div>

            <label className="sr-only" htmlFor="draft-letter-editor">
              Letter memo text
            </label>
            <Textarea
              id="draft-letter-editor"
              className={cn(
                "flex-1 min-h-[min(440px,48vh)] max-h-[60vh] xl:max-h-none xl:h-full rounded-xl",
                "border-slate-200/90 dark:border-white/10 bg-white dark:bg-slate-950/50",
                "text-slate-900 dark:text-slate-100 font-serif text-[15px] sm:text-[15px] leading-relaxed",
                "shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] focus-visible:ring-2 focus-visible:ring-sky-600/35",
              )}
              value={manualLetterText}
              onChange={(e) => onManualLetterTextChange(e.target.value)}
              placeholder="Dear Selection Committee,&#10;&#10;I write to recommend …"
              disabled={busy}
              spellCheck
            />

            <div className="rounded-xl border border-dashed border-slate-200/90 dark:border-white/10 px-3 py-2.5 space-y-1.5 bg-slate-50/80 dark:bg-white/[0.02]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tips</p>
              <ul className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 space-y-1 list-disc pl-4 leading-snug">
                <li>Preview omits greeting and sign-off when they match typical letter lines — the official layout adds them.</li>
                <li>Submitted text is sent exactly as typed; instructors generate the final PDF with this letterhead.</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2.5 mt-auto pt-1">
              <Button
                type="button"
                onClick={() => void handleSendToInstructor()}
                disabled={busy || intakeBusy || metaBusy}
                className="rounded-xl w-full bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/25"
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Sending…
                  </span>
                ) : (
                  "Send to instructor for approval"
                )}
              </Button>
              <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400 px-0.5">
                {requireFinalReview ? (
                  <>Your instructor reviews and approves before the official PDF downloads.</>
                ) : (
                  <>
                    Final review may be streamlined for this instructor — submitting can unlock download quickly once
                    processed.
                  </>
                )}
              </p>

              {showBackToOptions && onResetIntake ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy || intakeBusy}
                  onClick={() => void onResetIntake()}
                  className="rounded-xl text-slate-600 dark:text-slate-400 hover:text-sky-600 hover:bg-sky-600/10 -ml-2"
                >
                  Back to questionnaire options
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <section
          className="flex-1 min-w-0 flex flex-col bg-gradient-to-br from-stone-100/90 via-stone-50 to-slate-100/70 dark:from-slate-900 dark:via-slate-950 dark:to-black/40"
          aria-labelledby="draft-preview-heading"
        >
          <div className="flex items-center gap-2 px-4 sm:px-6 pt-4 pb-3 border-b border-stone-200/80 dark:border-white/[0.07] shrink-0">
            <SplitSquareHorizontal className="h-4 w-4 text-sky-600 dark:text-sky-300 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p id="draft-preview-heading" className="text-sm font-semibold text-slate-900 dark:text-white">
                Live preview
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Letterhead matches your instructor module settings · scroll on small screens
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 min-h-[min(560px,70vh)]">
            <LetterheadLetterPreview
              content={previewContent}
              className={cn(
                "mx-auto w-full shadow-xl shadow-black/10 dark:shadow-black/60",
                "xl:origin-top xl:scale-[0.93] xl:max-h-none",
              )}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
