"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowLeft, Loader2 } from "lucide-react"
import { getInstructorData } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  LetterheadLetterPreview,
  LETTERHEAD_PREVIEW_SAMPLE,
} from "@/components/recommendation-letter/LetterheadLetterPreview"
import type { RecommendationLetterheadContent } from "@/lib/recommendation-letterhead-types"
import { resolveLetterheadSignatoryName, clampLetterheadImageScale, clampLetterheadBodyFontScale, parseLetterheadBodyTextAlign, parseLetterheadHeaderTextAlign, clampLetterheadHeaderFontScale, clampLetterheadLogoTextGapPx } from "@/lib/recommendation-letterhead-signatory"
import { parseLetterheadContentMargin, LETTERHEAD_CONTENT_MARGIN_OPTIONS } from "@/lib/recommendation-letterhead-margin"
import { PORTAL_CARD, PORTAL_OUTLINE_BTN, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { facultyToolbarFilterButtonClass } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { cn } from "@/lib/utils"

const lettersChrome = facultyEmbedChrome("recommendations")

const inputClass = cn("h-10 rounded-lg shadow-none", CC_FIELD.base, CC_FIELD.focus, CC_FIELD.disabled)
const textareaClass = cn("min-h-[88px] rounded-lg shadow-none", CC_FIELD.base, CC_FIELD.focus, CC_FIELD.disabled)
const sliderClass = lettersChrome.slider
const switchClass = lettersChrome.switchChecked
const selectTriggerClass = cn(facultyToolbarFilterButtonClass(), "h-10 w-full shadow-none")

function SettingSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-b border-[var(--border)] pb-5 last:border-b-0 last:pb-0">
      <h2 className={cn("text-sm font-semibold", PORTAL_TEXT)}>{title}</h2>
      {children}
    </section>
  )
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (c: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-2.5 last:border-b-0">
      <Label className="text-sm font-normal text-[var(--cc-text)]">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className={switchClass} />
    </div>
  )
}

function SliderControl({
  label,
  display,
  min,
  max,
  step,
  value,
  onValueChange,
}: {
  label: string
  display: string
  min: number
  max: number
  step: number
  value: number[]
  onValueChange: (v: number[]) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <Label className="font-normal text-[var(--cc-text)]">{label}</Label>
        <span className={cn("tabular-nums", PORTAL_TEXT_MUTED)}>{display}</span>
      </div>
      <Slider min={min} max={max} step={step} value={value} onValueChange={onValueChange} className={sliderClass} />
    </div>
  )
}

function optStrField(v: unknown): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t || null
}

export default function InstructorRecommendationSettingsPage() {
  const [s, setS] = useState<Record<string, unknown> | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [instName, setInstName] = useState("")
  const [uploading, setUploading] = useState<"logo" | "signature" | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const signatureInputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    const inst = getInstructorData()
    if (!inst?.id) return
    const res = await instructorApiFetch("/api/instructor/recommendations/settings", {
      headers: { "x-instructor-id": String(inst.id) },
    })
    const j = await res.json()
    if (!res.ok) throw new Error(j.error)
    setS(j.settings)
  }

  useEffect(() => {
    const i = getInstructorData()
    if (i?.name) setInstName(i.name)
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        await load()
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed")
      }
    })()
  }, [])

  const previewContent = useMemo((): RecommendationLetterheadContent => {
    if (!s) return LETTERHEAD_PREVIEW_SAMPLE
    return {
      ...LETTERHEAD_PREVIEW_SAMPLE,
      date: new Date().toLocaleDateString("en-US", { timeZone: "America/Chicago" }),
      instructorName: resolveLetterheadSignatoryName(s, instName),
      instructorTitle: optStrField(s.letterhead_instructor_title),
      instructorEmail: optStrField(s.letterhead_instructor_email),
      instructorPhone: optStrField(s.letterhead_instructor_phone),
      instructorOffice: optStrField(s.letterhead_instructor_office),
      signatureBlock: optStrField(s.signature_block),
      logoUrl: optStrField(s.letterhead_logo_url),
      signatureUrl: optStrField(s.letterhead_signature_image_url),
      logoScale: clampLetterheadImageScale(s.letterhead_logo_scale, 1),
      signatureScale: clampLetterheadImageScale(s.letterhead_signature_scale, 1),
      bodyFontScale: clampLetterheadBodyFontScale(s.letterhead_body_font_scale, 1),
      bodyTextAlign: parseLetterheadBodyTextAlign(s.letterhead_body_text_align),
      headerFontScale: clampLetterheadHeaderFontScale(s.letterhead_header_font_scale),
      headerTextAlign: parseLetterheadHeaderTextAlign(s.letterhead_header_text_align),
      headerLogoTextGapPx: clampLetterheadLogoTextGapPx(s.letterhead_header_logo_text_gap_px),
      contentMargin: parseLetterheadContentMargin(s.letterhead_content_margin),
    }
  }, [s, instName])

  async function uploadLetterheadAsset(assetType: "logo" | "signature", file: File) {
    const inst = getInstructorData()
    if (!inst?.id) return
    setUploading(assetType)
    setErr(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("assetType", assetType)
      const res = await instructorApiFetch("/api/instructor/recommendations/settings/upload", {
        method: "POST",
        headers: { "x-instructor-id": String(inst.id) },
        body: fd,
      })
      const j = (await res.json()) as { error?: string; url?: string }
      if (!res.ok) throw new Error(j.error ?? "Upload failed")
      setS((prev) =>
        prev && j.url
          ? {
              ...prev,
              ...(assetType === "logo"
                ? { letterhead_logo_url: j.url }
                : { letterhead_signature_image_url: j.url }),
            }
          : prev,
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(null)
    }
  }

  async function clearLetterheadAsset(assetType: "logo" | "signature") {
    const inst = getInstructorData()
    if (!inst?.id) return
    setErr(null)
    const patch =
      assetType === "logo"
        ? { letterhead_logo_url: null }
        : { letterhead_signature_image_url: null }
    try {
      const res = await instructorApiFetch("/api/instructor/recommendations/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-instructor-id": String(inst.id),
        },
        body: JSON.stringify(patch),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? "Failed to clear")
      setS(j.settings)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to clear")
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const inst = getInstructorData()
    if (!inst?.id || !s) return
    setErr(null)
    try {
      const res = await instructorApiFetch("/api/instructor/recommendations/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-instructor-id": String(inst.id),
        },
        body: JSON.stringify(s),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      setS(j.settings)
      setSaveModalOpen(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed")
    }
  }

  if (!s) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full min-w-0">
        <div className={cn(PORTAL_CARD, "flex items-center gap-2 p-6 text-sm", PORTAL_TEXT_MUTED)}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading settings…
        </div>
      </motion.div>
    )
  }

  const num = (k: string, v: unknown) =>
    setS({ ...s, [k]: v === "" ? 0 : Number(v) })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="w-full min-w-0 space-y-3"
    >
      <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--cc-accent-dark)]">Settings saved</DialogTitle>
            <DialogDescription className={PORTAL_TEXT_MUTED}>
              Your letter module settings were updated. New requests will use these rules and letterhead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" className={cn("rounded-lg", lettersChrome.cta)} onClick={() => setSaveModalOpen(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between gap-3">
        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Letters · Settings</p>
        <Button variant="ghost" size="sm" asChild className="h-9 gap-1.5 rounded-lg text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]">
          <Link href="/instructor/dashboard-v2/recommendations/all">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All letters
          </Link>
        </Button>
      </div>

      {err ? (
        <p className="rounded-lg border border-[var(--cc-sem-danger-border)] bg-[var(--cc-sem-danger-soft)] px-3 py-2 text-sm text-[var(--cc-sem-danger-text)]">
          {err}
        </p>
      ) : null}

      <form onSubmit={save} className={cn(PORTAL_CARD, "overflow-hidden")}>
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(300px,38%)] xl:divide-x xl:divide-[var(--border)]">
          <div className="space-y-4 p-4 sm:p-5 xl:max-h-[min(78dvh,calc(100dvh-10rem))] xl:overflow-y-auto xl:overscroll-contain">
              <SettingSection title="Requests">
                <ToggleRow
                  label="Accept recommendation requests"
                  checked={Boolean(s.enabled)}
                  onCheckedChange={(c) => setS({ ...s, enabled: c })}
                />

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rec-settings-max-requests" className="text-xs text-[var(--cc-text-muted)]">
                      Max requests / student
                    </Label>
                    <Input
                      id="rec-settings-max-requests"
                      type="number"
                      className={inputClass}
                      value={String(s.max_requests_per_semester ?? 3)}
                      onChange={(e) => num("max_requests_per_semester", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rec-settings-min-notice" className="text-xs text-[var(--cc-text-muted)]">
                      Min. notice (days)
                    </Label>
                    <Input
                      id="rec-settings-min-notice"
                      type="number"
                      className={inputClass}
                      value={String(s.minimum_notice_days ?? 7)}
                      onChange={(e) => num("minimum_notice_days", e.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-[var(--border)] px-3">
                  {[
                    ["require_resume", "Require resume upload"],
                    ["require_transcript", "Require transcript upload"],
                    ["require_purpose_deadline", "Require purpose & deadline"],
                    ["require_final_review", "Require approval before PDF"],
                    ["allow_ai_generation", "Allow AI-generated drafts"],
                    ["allow_ai_polish", "Allow AI polish (Trailblazer)"],
                  ].map(([key, label]) => (
                    <ToggleRow
                      key={key}
                      label={label}
                      checked={s[key] !== false}
                      onCheckedChange={(c) => setS({ ...s, [key]: c })}
                    />
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[var(--cc-text-muted)]">Max AI batches / request</Label>
                    <Input
                      type="number"
                      className={inputClass}
                      min={1}
                      value={String(s.max_ai_batches_per_request ?? 3)}
                      onChange={(e) => num("max_ai_batches_per_request", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[var(--cc-text-muted)]">Default tone</Label>
                    <Input
                      className={inputClass}
                      value={String(s.default_tone ?? "")}
                      onChange={(e) => setS({ ...s, default_tone: e.target.value })}
                    />
                  </div>
                </div>
              </SettingSection>

              <SettingSection title="Letterhead (PDF)">
                <p className={cn("text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
                  Upload PNG or JPEG logo and signature. Adjust sliders, then save to update exported PDFs.
                </p>

                <div className="space-y-1.5">
                  <Label className="text-xs text-[var(--cc-text-muted)]">Name on letter</Label>
                  <Input
                    className={inputClass}
                    placeholder="e.g. Daniel Mawunyo Doe, Ph.D."
                    value={String(s.letterhead_signatory_name ?? "")}
                    onChange={(e) => setS({ ...s, letterhead_signatory_name: e.target.value })}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {(["logo", "signature"] as const).map((asset) => {
                    const isLogo = asset === "logo"
                    const ref = isLogo ? logoInputRef : signatureInputRef
                    const urlKey = isLogo ? "letterhead_logo_url" : "letterhead_signature_image_url"
                    const hasFile = typeof s[urlKey] === "string" && s[urlKey]
                    return (
                      <div key={asset} className="space-y-1.5">
                        <Label className="text-xs text-[var(--cc-text-muted)]">{isLogo ? "University logo" : "Signature image"}</Label>
                        <input
                          ref={ref}
                          type="file"
                          accept="image/png,image/jpeg"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) void uploadLetterheadAsset(asset, f)
                            e.target.value = ""
                          }}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className={cn("h-9 rounded-lg", PORTAL_OUTLINE_BTN)}
                            disabled={uploading === asset}
                            onClick={() => ref.current?.click()}
                          >
                            {uploading === asset ? "Uploading…" : isLogo ? "Upload logo" : "Upload signature"}
                          </Button>
                          {hasFile ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-9 rounded-lg text-[var(--cc-sem-danger-text)] hover:bg-[var(--cc-sem-danger-soft)]"
                              onClick={() => void clearLetterheadAsset(asset)}
                            >
                              Clear
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <SliderControl
                    label="Logo size"
                    display={`${Math.round(clampLetterheadImageScale(s.letterhead_logo_scale, 1) * 100)}%`}
                    min={40}
                    max={200}
                    step={5}
                    value={[Math.round(clampLetterheadImageScale(s.letterhead_logo_scale, 1) * 100)]}
                    onValueChange={(v) => setS({ ...s, letterhead_logo_scale: (v[0] ?? 100) / 100 })}
                  />
                  <SliderControl
                    label="Signature size"
                    display={`${Math.round(clampLetterheadImageScale(s.letterhead_signature_scale, 1) * 100)}%`}
                    min={40}
                    max={200}
                    step={5}
                    value={[Math.round(clampLetterheadImageScale(s.letterhead_signature_scale, 1) * 100)]}
                    onValueChange={(v) => setS({ ...s, letterhead_signature_scale: (v[0] ?? 100) / 100 })}
                  />
                </div>

                <div className="space-y-4 border-t border-[var(--border)] pt-4">
                  <p className={cn("text-xs font-medium", PORTAL_TEXT)}>Banner & layout</p>
                  <SliderControl
                    label="Banner text size"
                    display={`${Math.round(clampLetterheadHeaderFontScale(s.letterhead_header_font_scale) * 100)}%`}
                    min={85}
                    max={135}
                    step={5}
                    value={[Math.round(clampLetterheadHeaderFontScale(s.letterhead_header_font_scale) * 100)]}
                    onValueChange={(v) => setS({ ...s, letterhead_header_font_scale: (v[0] ?? 100) / 100 })}
                  />
                  <SliderControl
                    label="Seal-to-banner spacing"
                    display={`${clampLetterheadLogoTextGapPx(s.letterhead_header_logo_text_gap_px)} px`}
                    min={8}
                    max={48}
                    step={2}
                    value={[clampLetterheadLogoTextGapPx(s.letterhead_header_logo_text_gap_px)]}
                    onValueChange={(v) => setS({ ...s, letterhead_header_logo_text_gap_px: v[0] ?? 20 })}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-[var(--cc-text-muted)]">Banner alignment</Label>
                      <Select
                        value={parseLetterheadHeaderTextAlign(s.letterhead_header_text_align)}
                        onValueChange={(v) => setS({ ...s, letterhead_header_text_align: v })}
                      >
                        <SelectTrigger className={selectTriggerClass}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="center">Center</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-[var(--cc-text-muted)]">Body alignment</Label>
                      <Select
                        value={parseLetterheadBodyTextAlign(s.letterhead_body_text_align)}
                        onValueChange={(v) => setS({ ...s, letterhead_body_text_align: v })}
                      >
                        <SelectTrigger className={selectTriggerClass}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="center">Center</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                          <SelectItem value="justify">Justify</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <SliderControl
                    label="Body text size"
                    display={`${Math.round(clampLetterheadBodyFontScale(s.letterhead_body_font_scale, 1) * 100)}%`}
                    min={85}
                    max={135}
                    step={5}
                    value={[Math.round(clampLetterheadBodyFontScale(s.letterhead_body_font_scale, 1) * 100)]}
                    onValueChange={(v) => setS({ ...s, letterhead_body_font_scale: (v[0] ?? 100) / 100 })}
                  />
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[var(--cc-text-muted)]">Page margins</Label>
                    <Select
                      value={parseLetterheadContentMargin(s.letterhead_content_margin)}
                      onValueChange={(v) => setS({ ...s, letterhead_content_margin: v })}
                    >
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LETTERHEAD_CONTENT_MARGIN_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 border-t border-[var(--border)] pt-4">
                  {(
                    [
                      ["letterhead_instructor_title", "Title", "Assistant Professor"],
                      ["letterhead_instructor_email", "Email", "you@pvamu.edu"],
                      ["letterhead_instructor_phone", "Phone", "936-261-xxxx"],
                      ["letterhead_instructor_office", "Office", "Electrical Engineering 326"],
                    ] as const
                  ).map(([key, label, placeholder]) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-xs text-[var(--cc-text-muted)]">{label}</Label>
                      <Input
                        className={inputClass}
                        type={key.includes("email") ? "email" : "text"}
                        placeholder={placeholder}
                        value={String(s[key] ?? "")}
                        onChange={(e) => setS({ ...s, [key]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </SettingSection>

              <SettingSection title="AI & signature">
                <div className="space-y-1.5">
                  <Label className="text-xs text-[var(--cc-text-muted)]">Signature block</Label>
                  <Textarea
                    className={textareaClass}
                    value={String(s.signature_block ?? "")}
                    onChange={(e) => setS({ ...s, signature_block: e.target.value })}
                    placeholder="Name, credentials, and closing lines for the letter PDF."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[var(--cc-text-muted)]">Private AI instructions</Label>
                  <Textarea
                    className={textareaClass}
                    value={String(s.extra_instructions ?? "")}
                    onChange={(e) => setS({ ...s, extra_instructions: e.target.value })}
                    placeholder="Optional — not shown to students."
                  />
                </div>
              </SettingSection>

            <Button type="submit" className={cn("h-10 w-full rounded-lg sm:w-auto sm:min-w-[9rem]", lettersChrome.cta)}>
              Save settings
            </Button>
          </div>

          <aside className="flex min-h-[280px] flex-col gap-3 p-4 sm:p-5 xl:min-h-0 xl:max-h-[min(78dvh,calc(100dvh-10rem))] xl:overflow-hidden">
            <p className={cn("text-sm font-medium", PORTAL_TEXT)}>Preview</p>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-100 p-3 sm:p-4 dark:border-neutral-700 dark:bg-neutral-200">
              <LetterheadLetterPreview content={previewContent} className="w-full max-w-none shadow-md" />
            </div>
          </aside>
        </div>
      </form>
    </motion.div>
  )
}
