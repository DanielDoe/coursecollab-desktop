"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowLeft, FilePenLine, Settings2 } from "lucide-react"
import { getAdminData } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
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
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"

function optStrField(v: unknown): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t || null
}

function SectionShell({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.03] p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base">{title}</h2>
        {description ? <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{description}</p> : null}
      </div>
      {children}
    </div>
  )
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
    const inst = getAdminData()
    if (!inst?.id) return
    const res = await instructorApiFetch("/api/instructor/recommendations/settings", {
      headers: { "x-instructor-id": String(inst.id) },
    })
    const j = await res.json()
    if (!res.ok) throw new Error(j.error)
    setS(j.settings)
  }

  useEffect(() => {
    const i = getAdminData()
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
    const inst = getAdminData()
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
    const inst = getAdminData()
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
    const inst = getAdminData()
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
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-auto max-w-7xl w-full min-w-0"
      >
        <CardWrapper delay={0} hover={false}>
          <div className="p-8 text-slate-500 dark:text-slate-400 text-sm">Loading…</div>
        </CardWrapper>
      </motion.div>
    )
  }

  const num = (k: string, v: unknown) =>
    setS({ ...s, [k]: v === "" ? 0 : Number(v) })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-7xl w-full min-w-0 space-y-4 sm:space-y-5"
    >
      <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-emerald-700 dark:text-emerald-400">Settings saved</DialogTitle>
            <DialogDescription>
              Your recommendation letter module settings were updated successfully. Students will use the latest rules
              and letterhead on new activity.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" className="rounded-xl" onClick={() => setSaveModalOpen(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex gap-3 min-w-0 items-start">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 dark:border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.12] to-emerald-600/[0.06] dark:from-emerald-400/10 dark:to-emerald-600/5"
            aria-hidden
          >
            <Settings2 className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Recommendation letter settings
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-xl">
              Control requests, AI options, and PVAMU letterhead for exported PDFs.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          asChild
          size="sm"
          className="rounded-xl shrink-0 self-end sm:self-auto gap-2 h-10 border-slate-200/90 dark:border-white/[0.12] bg-white/90 dark:bg-white/[0.05] hover:bg-emerald-50/90 dark:hover:bg-emerald-950/25 w-fit"
        >
          <Link href="/admin/dashboard-v2/recommendations/all">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All requests
          </Link>
        </Button>
      </div>

      {err && (
        <p className="text-sm text-red-600 dark:text-red-400 rounded-lg border border-red-200/80 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 px-3 py-2">
          {err}
        </p>
      )}

      <CardWrapper delay={0} hover={false} contentClassName="min-h-0">
        <form
          onSubmit={save}
          className="flex flex-col min-h-0 p-3 sm:p-4 md:p-5 lg:p-6"
        >
          <div className="flex flex-col gap-8 xl:gap-y-10 xl:grid xl:grid-cols-[minmax(0,min(34rem,44%))_minmax(340px,1fr)] xl:gap-x-6 2xl:gap-x-8 xl:items-stretch xl:min-h-0 xl:h-[min(75dvh,calc(100dvh-11rem))]">
            <div className="space-y-5 sm:space-y-6 min-w-0 w-full max-w-xl xl:max-w-none xl:min-h-0 xl:max-h-full xl:overflow-y-auto xl:overscroll-contain xl:pr-2 xl:[scrollbar-gutter:stable] xl:border-r xl:border-slate-200/80 dark:xl:border-white/10 xl:pt-0">
              <SectionShell
                title="Requests & workflow"
                description="Who can submit, deadlines, and what students must upload."
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Accept recommendation requests</Label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Students can submit new requests when enabled.</p>
                  </div>
                  <Switch
                    checked={Boolean(s.enabled)}
                    onCheckedChange={(c) => setS({ ...s, enabled: c })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 sm:items-end">
                  <div className="flex flex-col gap-2 min-w-0">
                    <Label
                      htmlFor="rec-settings-max-requests"
                      className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug min-h-[2.75rem] sm:min-h-[3rem] flex items-end"
                    >
                      Max requests / student
                    </Label>
                    <Input
                      id="rec-settings-max-requests"
                      type="number"
                      className="rounded-xl h-10 w-full border-slate-200/90 dark:border-white/12 bg-white dark:bg-slate-950/50 text-slate-900 dark:text-slate-100"
                      value={String(s.max_requests_per_semester ?? 3)}
                      onChange={(e) => num("max_requests_per_semester", e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2 min-w-0">
                    <Label
                      htmlFor="rec-settings-min-notice"
                      className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug min-h-[2.75rem] sm:min-h-[3rem] flex items-end"
                    >
                      Min. notice (days)
                    </Label>
                    <Input
                      id="rec-settings-min-notice"
                      type="number"
                      className="rounded-xl h-10 w-full border-slate-200/90 dark:border-white/12 bg-white dark:bg-slate-950/50 text-slate-900 dark:text-slate-100"
                      value={String(s.minimum_notice_days ?? 7)}
                      onChange={(e) => num("minimum_notice_days", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 sm:gap-x-4 sm:gap-y-3">
                  {[
                    ["require_resume", "Require resume upload"],
                    ["require_transcript", "Require transcript upload"],
                    ["require_purpose_deadline", "Require purpose & deadline"],
                    ["require_final_review", "Require instructor approval before PDF"],
                    ["allow_ai_generation", "Allow AI-generated drafts"],
                    ["allow_ai_polish", "Allow AI polish (Trailblazer)"],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/60 dark:border-white/[0.06] bg-white/60 dark:bg-slate-950/20 px-3 py-2.5">
                      <Label className="font-normal text-sm leading-snug">{label}</Label>
                      <Switch
                        checked={s[key] !== false}
                        onCheckedChange={(c) => setS({ ...s, [key]: c })}
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>Max AI batches per request (Trailblazer / instructor)</Label>
                  <Input
                    type="number"
                    className="rounded-xl bg-white/90 dark:bg-slate-950/30"
                    min={1}
                    value={String(s.max_ai_batches_per_request ?? 3)}
                    onChange={(e) => num("max_ai_batches_per_request", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Default tone</Label>
                  <Input
                    className="rounded-xl bg-white/90 dark:bg-slate-950/30"
                    value={String(s.default_tone ?? "")}
                    onChange={(e) => setS({ ...s, default_tone: e.target.value })}
                  />
                </div>
              </SectionShell>

              <SectionShell
                title="PVAMU letterhead (PDF)"
                description="Logo, signature, sizes, and how your name appears on official exports."
              >
                <div className="rounded-xl border border-dashed border-emerald-500/25 dark:border-emerald-400/20 bg-emerald-500/[0.04] dark:bg-emerald-400/[0.06] p-3 flex gap-3 items-start">
                  <FilePenLine className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden />
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Upload PNG or JPEG assets. Use the sliders to match print scale; save to apply to student PDFs.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Name on letter (typed under signature)</Label>
                  <Input
                    className="rounded-xl bg-white/90 dark:bg-slate-950/30"
                    placeholder="e.g. Daniel Mawunyo Doe, Ph.D."
                    value={String(s.letterhead_signatory_name ?? "")}
                    onChange={(e) => setS({ ...s, letterhead_signatory_name: e.target.value })}
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    If empty, the first line of <strong>Signature block</strong> below is used, then your account name.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>University logo</Label>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) void uploadLetterheadAsset("logo", f)
                        e.target.value = ""
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        disabled={uploading === "logo"}
                        onClick={() => logoInputRef.current?.click()}
                      >
                        {uploading === "logo" ? "Uploading…" : "Upload logo"}
                      </Button>
                      {typeof s.letterhead_logo_url === "string" && s.letterhead_logo_url ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="rounded-xl text-red-600"
                          onClick={() => void clearLetterheadAsset("logo")}
                        >
                          Clear
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Signature image</Label>
                    <input
                      ref={signatureInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) void uploadLetterheadAsset("signature", f)
                        e.target.value = ""
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        disabled={uploading === "signature"}
                        onClick={() => signatureInputRef.current?.click()}
                      >
                        {uploading === "signature" ? "Uploading…" : "Upload signature"}
                      </Button>
                      {typeof s.letterhead_signature_image_url === "string" && s.letterhead_signature_image_url ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="rounded-xl text-red-600"
                          onClick={() => void clearLetterheadAsset("signature")}
                        >
                          Clear
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-2">
                    <div className="flex justify-between gap-2 text-xs">
                      <Label className="font-normal">Logo size</Label>
                      <span className="tabular-nums text-slate-500">
                        {Math.round(clampLetterheadImageScale(s.letterhead_logo_scale, 1) * 100)}%
                      </span>
                    </div>
                    <Slider
                      min={40}
                      max={200}
                      step={5}
                      value={[Math.round(clampLetterheadImageScale(s.letterhead_logo_scale, 1) * 100)]}
                      onValueChange={(v) =>
                        setS({ ...s, letterhead_logo_scale: (v[0] ?? 100) / 100 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between gap-2 text-xs">
                      <Label className="font-normal">Signature image size</Label>
                      <span className="tabular-nums text-slate-500">
                        {Math.round(clampLetterheadImageScale(s.letterhead_signature_scale, 1) * 100)}%
                      </span>
                    </div>
                    <Slider
                      min={40}
                      max={200}
                      step={5}
                      value={[Math.round(clampLetterheadImageScale(s.letterhead_signature_scale, 1) * 100)]}
                      onValueChange={(v) =>
                        setS({ ...s, letterhead_signature_scale: (v[0] ?? 100) / 100 })
                      }
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-emerald-500/[0.04] dark:bg-emerald-950/20 p-4 space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900/90 dark:text-emerald-300/90">
                    University banner text
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Matches official stock: banner sits beside the seal with a modest gap — not forced to the far page
                    edge. Adjust size, spacing, or align (right recreates a flush-right banner if needed).
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between gap-2 text-xs">
                      <Label className="font-normal">Banner title &amp; system line size</Label>
                      <span className="tabular-nums text-slate-500 dark:text-slate-400">
                        {Math.round(clampLetterheadHeaderFontScale(s.letterhead_header_font_scale) * 100)}%
                      </span>
                    </div>
                    <Slider
                      min={85}
                      max={135}
                      step={5}
                      value={[Math.round(clampLetterheadHeaderFontScale(s.letterhead_header_font_scale) * 100)]}
                      onValueChange={(v) =>
                        setS({ ...s, letterhead_header_font_scale: (v[0] ?? 100) / 100 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between gap-2 text-xs">
                      <Label className="font-normal">Space between seal and banner</Label>
                      <span className="tabular-nums text-slate-500 dark:text-slate-400">
                        {clampLetterheadLogoTextGapPx(s.letterhead_header_logo_text_gap_px)} px
                      </span>
                    </div>
                    <Slider
                      min={8}
                      max={48}
                      step={2}
                      value={[clampLetterheadLogoTextGapPx(s.letterhead_header_logo_text_gap_px)]}
                      onValueChange={(v) =>
                        setS({ ...s, letterhead_header_logo_text_gap_px: v[0] ?? 20 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="letterhead-header-align">Banner alignment</Label>
                    <select
                      id="letterhead-header-align"
                      className="flex h-10 w-full rounded-xl border border-slate-200/90 dark:border-white/12 bg-white dark:bg-slate-950/50 px-3 text-sm text-slate-900 dark:text-slate-100"
                      value={parseLetterheadHeaderTextAlign(s.letterhead_header_text_align)}
                      onChange={(e) =>
                        setS({
                          ...s,
                          letterhead_header_text_align: e.target.value,
                        })
                      }
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/50 dark:bg-slate-950/25 p-4 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between gap-2 text-xs">
                      <Label className="font-normal">Main letter body text size</Label>
                      <span className="tabular-nums text-slate-500 dark:text-slate-400">
                        {Math.round(clampLetterheadBodyFontScale(s.letterhead_body_font_scale, 1) * 100)}%
                      </span>
                    </div>
                    <Slider
                      min={85}
                      max={135}
                      step={5}
                      value={[Math.round(clampLetterheadBodyFontScale(s.letterhead_body_font_scale, 1) * 100)]}
                      onValueChange={(v) =>
                        setS({ ...s, letterhead_body_font_scale: (v[0] ?? 100) / 100 })
                      }
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Scales date, salutation, body paragraphs, and closing signature block — separate from university
                      banner controls above.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="letterhead-body-align">Main letter alignment</Label>
                    <select
                      id="letterhead-body-align"
                      className="flex h-10 w-full rounded-xl border border-slate-200/90 dark:border-white/12 bg-white dark:bg-slate-950/50 px-3 text-sm text-slate-900 dark:text-slate-100"
                      value={parseLetterheadBodyTextAlign(s.letterhead_body_text_align)}
                      onChange={(e) =>
                        setS({
                          ...s,
                          letterhead_body_text_align: e.target.value,
                        })
                      }
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                      <option value="justify">Justify</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="letterhead-content-margin">Page margins (letter content)</Label>
                    <select
                      id="letterhead-content-margin"
                      className="flex h-10 w-full rounded-xl border border-slate-200/90 dark:border-white/12 bg-white dark:bg-slate-950/50 px-3 text-sm text-slate-900 dark:text-slate-100"
                      value={parseLetterheadContentMargin(s.letterhead_content_margin)}
                      onChange={(e) =>
                        setS({
                          ...s,
                          letterhead_content_margin: e.target.value,
                        })
                      }
                    >
                      {LETTERHEAD_CONTENT_MARGIN_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label} — {opt.description}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Controls left and right inset for the full letter (banner through footer) in exported PDFs and
                      live previews.
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Your title (letter PDF)</Label>
                    <Input
                      className="rounded-xl bg-white/90 dark:bg-slate-950/30"
                      placeholder="Assistant Professor"
                      value={String(s.letterhead_instructor_title ?? "")}
                      onChange={(e) => setS({ ...s, letterhead_instructor_title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email (letter PDF)</Label>
                    <Input
                      className="rounded-xl bg-white/90 dark:bg-slate-950/30"
                      type="email"
                      placeholder="you@pvamu.edu"
                      value={String(s.letterhead_instructor_email ?? "")}
                      onChange={(e) => setS({ ...s, letterhead_instructor_email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone (letter PDF)</Label>
                    <Input
                      className="rounded-xl bg-white/90 dark:bg-slate-950/30"
                      placeholder="936-261-xxxx"
                      value={String(s.letterhead_instructor_phone ?? "")}
                      onChange={(e) => setS({ ...s, letterhead_instructor_phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Office (letter PDF)</Label>
                    <Input
                      className="rounded-xl bg-white/90 dark:bg-slate-950/30"
                      placeholder="Electrical Engineering 326"
                      value={String(s.letterhead_instructor_office ?? "")}
                      onChange={(e) => setS({ ...s, letterhead_instructor_office: e.target.value })}
                    />
                  </div>
                </div>
              </SectionShell>

              <SectionShell title="AI & signatures" description="Optional text blocks used for AI context and exports.">
                <div className="space-y-2">
                  <Label>Signature block (optional)</Label>
                  <Textarea
                    className="rounded-xl min-h-[100px] bg-white/90 dark:bg-slate-950/30"
                    value={String(s.signature_block ?? "")}
                    onChange={(e) => setS({ ...s, signature_block: e.target.value })}
                    placeholder={
                      "First line can be your full name and credentials (used on the letter if Name on letter is empty).\nAssistant Professor\n…"
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Extra instructions for the AI (optional, private)</Label>
                  <Textarea
                    className="rounded-xl bg-white/90 dark:bg-slate-950/30"
                    value={String(s.extra_instructions ?? "")}
                    onChange={(e) => setS({ ...s, extra_instructions: e.target.value })}
                  />
                </div>
              </SectionShell>

              <Button
                type="submit"
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm w-full sm:w-auto"
              >
                Save settings
              </Button>
            </div>

            <aside className="flex flex-col min-w-0 min-h-0 w-full space-y-3 xl:min-h-0 xl:max-h-full xl:overflow-hidden xl:pl-2 2xl:pl-4 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-200/80 dark:border-white/10">
              <div className="shrink-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Letterhead preview</p>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Live preview matches PDF layout. Save to persist for downloads.
                </p>
              </div>
              <div className="w-full min-h-[min(18rem,45vh)] xl:min-h-0 xl:flex-1 overflow-y-auto rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/60 dark:bg-slate-950/40 p-2 sm:p-3 xl:touch-pan-y">
                <div className="w-full min-w-0">
                  <LetterheadLetterPreview content={previewContent} className="shadow-md w-full max-w-none" />
                </div>
              </div>
            </aside>
          </div>
        </form>
      </CardWrapper>
    </motion.div>
  )
}
