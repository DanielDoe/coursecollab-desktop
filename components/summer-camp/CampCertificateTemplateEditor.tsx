"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import {
  Award,
  Building2,
  FileText,
  Frame,
  ImageIcon,
  Loader2,
  PenLine,
  Save,
  Settings2,
  Upload,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import {
  CAMP_CERTIFICATE_BLOCK_GROUPS,
  CAMP_CERTIFICATE_BLOCK_LABELS,
  type CampCertificateBlockId,
  type CampCertificateTemplate,
} from "@/lib/summer-camp/certificate-template-types"
import {
  buildSampleCertificateVerificationUrl,
  SAMPLE_CERTIFICATE_VERIFICATION_CODE,
} from "@/lib/summer-camp/certificate-verification-url"
import {
  CampCertificatePreview,
  SAMPLE_CERTIFICATE_DATA,
} from "@/components/summer-camp/CampCertificatePreview"
import {
  applySignatureStyleToTemplate,
  CERTIFICATE_SIGNATURE_STYLES,
  resolveSignatoryAssetKey,
  signatureAssetUrl,
  type CertificateSignatureStyleId,
} from "@/lib/summer-camp/certificate-signature-styles"
import {
  signatoryFromTrainingInstructor,
  TRAINING_INSTRUCTOR_SIGNATORY_ID,
  trainingFacultyOptionLabel,
  type TrainingCertificateFaculty,
} from "@/lib/summer-camp/certificate-instructor-signatory"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalThemeStripe } from "@/lib/portal-module-themes"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import {
  clampSignatureScale,
  clampSignatureOffsetY,
  DEFAULT_SIGNATURE_SCALE,
  DEFAULT_SIGNATURE_OFFSET_Y_MM,
  SIGNATURE_SCALE_MAX,
  SIGNATURE_SCALE_MIN,
  SIGNATURE_OFFSET_Y_MAX_MM,
  SIGNATURE_OFFSET_Y_MIN_MM,
} from "@/lib/summer-camp/certificate-template-utils"

const SIGNATURE_SIZE_PRESETS: Array<{ label: string; scale: number }> = [
  { label: "Small", scale: 0.75 },
  { label: "Default", scale: 1 },
  { label: "Large", scale: 1.25 },
  { label: "Extra large", scale: 1.5 },
]

const SIGNATURE_POSITION_PRESETS: Array<{ label: string; offsetY: number }> = [
  { label: "Higher", offsetY: -10 },
  { label: "Default", offsetY: DEFAULT_SIGNATURE_OFFSET_Y_MM },
  { label: "Lower", offsetY: 10 },
]

type TrainingOption = { id: number; title: string; camp_title: string }

const ASSET_META: Array<{
  key: keyof CampCertificateTemplate["assets"]
  label: string
  hint: string
}> = [
  { key: "pvamuLogoUrl", label: "PVAMU logo", hint: "Left header — includes university name" },
  { key: "creditLogoUrl", label: "CREDIT Center logo", hint: "Right header column" },
  { key: "sealImageUrl", label: "University seal", hint: "PVAMU seal between signatories (defaults to recommendation letter logo)" },
  { key: "watermarkImageUrl", label: "Background watermark", hint: "Faint clock tower on the right" },
]

const GROUP_ICONS: Record<string, typeof Frame> = {
  frame: Frame,
  header: Building2,
  body: FileText,
  footer: Users,
}

function EditorSection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-4", className)}>
      <div className="mb-3">
        <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>{title}</p>
        {description ? <p className="mt-0.5 text-xs text-[var(--cc-text-secondary)]">{description}</p> : null}
      </div>
      {children}
    </div>
  )
}

function AssetUploadCard({
  label,
  hint,
  imageUrl,
  uploading,
  onUpload,
}: {
  label: string
  hint: string
  imageUrl?: string | null
  uploading: boolean
  onUpload: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--muted)]">
        {imageUrl ? (
          <Image src={imageUrl} alt="" width={56} height={56} className="size-full object-contain p-1" unoptimized />
        ) : (
          <ImageIcon className="size-5 text-[var(--cc-text-muted)]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{label}</p>
        <p className="text-xs text-[var(--cc-text-secondary)]">{hint}</p>
        {imageUrl ? (
          <p className="mt-1 truncate text-[10px] text-[var(--cc-accent)]">{imageUrl}</p>
        ) : null}
      </div>
      <Button size="sm" className={cn("h-8 rounded-lg", facultyEmbedChrome("summer-camp").solid)} disabled={uploading} onClick={onUpload}>
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
        {imageUrl ? "Replace" : "Upload"}
      </Button>
    </div>
  )
}

export function CampCertificateTemplateEditor({
  trainings,
  initialTrainingId,
}: {
  trainings: TrainingOption[]
  initialTrainingId?: number
}) {
  const { card, solid, quiet, switchChecked } = facultyEmbedChrome("summer-camp")
  const [trainingId, setTrainingId] = useState<number | null>(
    initialTrainingId ?? trainings[0]?.id ?? null,
  )
  const [template, setTemplate] = useState<CampCertificateTemplate | null>(null)
  const [trainingFaculty, setTrainingFaculty] = useState<TrainingCertificateFaculty[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingUpload, setPendingUpload] = useState<{
    assetKey: string
    signatoryId?: string
  } | null>(null)

  const headers = () => ({
    ...buildInstructorApiHeaders(),
    "Content-Type": "application/json",
  })

  const load = useCallback(async () => {
    if (!trainingId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/instructor/summer-camp/certificate-template?trainingId=${trainingId}`,
        { headers: buildInstructorApiHeaders() },
      )
      if (res.ok) {
        const data = await res.json()
        setTemplate(data.template)
        setTrainingFaculty(data.trainingFaculty ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [trainingId])

  useEffect(() => {
    if (!trainingId && trainings[0]?.id) {
      setTrainingId(trainings[0].id)
    }
  }, [trainings, trainingId])

  useEffect(() => {
    void load()
  }, [load])

  const selectTrainingInstructor = (instructorId: number) => {
    if (!template) return
    const faculty = trainingFaculty.find((f) => f.id === instructorId)
    if (!faculty) return
    const styleId = (template.signatureStyle ?? "classic-script") as CertificateSignatureStyleId
    const sig2 = template.signatories.find((s) => s.id === TRAINING_INSTRUCTOR_SIGNATORY_ID)
    const updatedSig2 = signatoryFromTrainingInstructor(faculty, sig2)
    const next = applySignatureStyleToTemplate(
      {
        ...template,
        signatories: template.signatories.map((s) =>
          s.id === TRAINING_INSTRUCTOR_SIGNATORY_ID ? updatedSig2 : s,
        ),
      },
      styleId,
    )
    setTemplate(next)
  }

  const previewData = useMemo(
    () => ({
      ...SAMPLE_CERTIFICATE_DATA,
      certificateNumber: `${template?.certificateIdPrefix ?? "PVAMU-AI-2026"}-0001`,
      trainingName: template?.trainingName ?? SAMPLE_CERTIFICATE_DATA.trainingName,
      verificationCode: SAMPLE_CERTIFICATE_VERIFICATION_CODE,
      verificationUrl: buildSampleCertificateVerificationUrl(
        typeof window !== "undefined" ? window.location.origin : null,
      ),
    }),
    [template],
  )

  const save = async () => {
    if (!trainingId || !template) return
    setSaving(true)
    try {
      const res = await instructorApiFetch("/api/instructor/summer-camp/certificate-template", {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ trainingId, template }),
      })
      if (res.ok) {
        const data = await res.json()
        setTemplate(data.template)
      }
    } finally {
      setSaving(false)
    }
  }

  const startUpload = (assetKey: string, signatoryId?: string) => {
    setPendingUpload({ assetKey, signatoryId })
    fileRef.current?.click()
  }

  const onFilePicked = async (file: File | undefined) => {
    if (!file || !trainingId || !pendingUpload) return
    setUploading(pendingUpload.assetKey)
    try {
      const fd = new FormData()
      fd.append("trainingId", String(trainingId))
      fd.append("assetKey", pendingUpload.assetKey)
      fd.append("file", file)
      if (pendingUpload.signatoryId) fd.append("signatoryId", pendingUpload.signatoryId)
      const res = await instructorApiFetch("/api/instructor/summer-camp/certificate-template", {
        method: "POST",
        headers: buildInstructorApiHeaders(),
        body: fd,
      })
      if (res.ok) {
        const data = await res.json()
        setTemplate(data.template)
      }
    } finally {
      setUploading(null)
      setPendingUpload(null)
    }
  }

  const toggleBlock = (block: CampCertificateBlockId, enabled: boolean) => {
    if (!template) return
    setTemplate({
      ...template,
      blocks: { ...template.blocks, [block]: enabled },
    })
  }

  if (!trainings.length) {
    return (
      <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No published trainings available.</p>
    )
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          void onFilePicked(f)
          e.target.value = ""
        }}
      />

      <div className={cn(card, "flex flex-wrap items-center justify-between gap-4 p-4")}>
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-4">
          <div className="min-w-[min(100%,220px)] flex-1 space-y-2">
            <Label>Training track</Label>
            <Select
              value={trainingId ? String(trainingId) : undefined}
              onValueChange={(v) => setTrainingId(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select training" />
              </SelectTrigger>
              <SelectContent>
                {trainings.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={() => void save()} disabled={saving || !template} className={cn("h-9 shrink-0 rounded-lg", solid)}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Save template
        </Button>
      </div>

      {loading || !template ? (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <div className={cn(card, "space-y-4 p-4")}>
            <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
              <Settings2 className="h-4 w-4 text-[var(--cc-accent)]" />
              <h2 className={cn("font-semibold", PORTAL_TEXT)}>Template configuration</h2>
            </div>

            <Accordion
              type="multiple"
              defaultValue={["copy", "branding", "sections", "signatories", "metadata"]}
              className="w-full"
            >
              <AccordionItem value="copy" className="border-[var(--border)]">
                <AccordionTrigger className="hover:no-underline py-3">
                  <span className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-[var(--cc-accent)]" />
                    Certificate copy
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <EditorSection title="Title & subtitle" description="Main heading shown on the certificate.">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Certificate title</Label>
                        <Input
                          value={template.certificateTitle}
                          onChange={(e) => setTemplate({ ...template, certificateTitle: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Subtitle</Label>
                        <Input
                          value={template.certificateSubtitle}
                          onChange={(e) => setTemplate({ ...template, certificateSubtitle: e.target.value })}
                        />
                      </div>
                    </div>
                  </EditorSection>
                  <EditorSection
                    title="Completion text"
                    description="Training name and optional program line under the student name."
                  >
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Training name (on certificate)</Label>
                        <Input
                          value={template.trainingName}
                          onChange={(e) => setTemplate({ ...template, trainingName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Program line (optional)</Label>
                        <Input
                          value={template.programLine}
                          onChange={(e) => setTemplate({ ...template, programLine: e.target.value })}
                          placeholder="Electrical & Computer Engineering STEM Summer Camp"
                        />
                        <p className="text-[11px] text-[var(--cc-text-secondary)]">
                          Enable &quot;STEM Summer Camp program line&quot; in Sections to show this on the PDF.
                        </p>
                      </div>
                    </div>
                  </EditorSection>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="branding" className="border-[var(--border)]">
                <AccordionTrigger className="hover:no-underline py-3">
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[var(--cc-accent)]" />
                    Branding & assets
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  {ASSET_META.map(({ key, label, hint }) => (
                    <AssetUploadCard
                      key={key}
                      label={label}
                      hint={hint}
                      imageUrl={template.assets[key]}
                      uploading={uploading === key}
                      onUpload={() => startUpload(key)}
                    />
                  ))}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="sections" className="border-[var(--border)]">
                <AccordionTrigger className="hover:no-underline py-3">
                  <span className="flex items-center gap-2">
                    <Frame className="h-4 w-4 text-[var(--cc-accent)]" />
                    Visible sections
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  {CAMP_CERTIFICATE_BLOCK_GROUPS.map((group) => {
                    const Icon = GROUP_ICONS[group.id] ?? Frame
                    return (
                      <EditorSection
                        key={group.id}
                        title={group.label}
                        description={group.description}
                      >
                        <div className="space-y-2">
                          {group.blocks.map((block, bi) => (
                            <div
                              key={block}
                              className={cn(
                                "flex items-center justify-between rounded-lg border px-3 py-2.5",
                                portalThemeStripe(bi).row,
                                portalThemeStripe(bi).border,
                              )}
                            >
                              <div className="flex items-start gap-2 pr-2">
                                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--cc-accent)]" />
                                <span className={cn("text-sm leading-snug", PORTAL_TEXT)}>
                                  {CAMP_CERTIFICATE_BLOCK_LABELS[block]}
                                </span>
                              </div>
                              <Switch
                                checked={template.blocks[block] !== false}
                                onCheckedChange={(c) => toggleBlock(block, c)}
                                className={switchChecked}
                              />
                            </div>
                          ))}
                        </div>
                      </EditorSection>
                    )
                  })}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="signatories" className="border-[var(--border)]">
                <AccordionTrigger className="hover:no-underline py-3">
                  <span className="flex items-center gap-2">
                    <PenLine className="h-4 w-4 text-[var(--cc-accent)]" />
                    Signatories
                    <span className="text-xs font-normal text-[var(--cc-text-secondary)]">(max 2)</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <EditorSection
                    title="Signature style"
                    description="Sample signatures generated from each signatory's name — pick one style for the certificate."
                  >
                    <div className="grid gap-2 sm:grid-cols-3">
                      {CERTIFICATE_SIGNATURE_STYLES.map((style) => {
                        const active = (template.signatureStyle ?? "classic-script") === style.id
                        return (
                          <button
                            key={style.id}
                            type="button"
                            onClick={() => {
                              setTemplate(
                                applySignatureStyleToTemplate(template, style.id as CertificateSignatureStyleId),
                              )
                            }}
                            className={cn(
                              "rounded-xl border p-3 text-left transition-colors hover:bg-muted/40",
                              active
                                ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)] ring-1 ring-[var(--cc-accent)]/40"
                                : "border-[var(--border)] bg-[var(--card)]",
                            )}
                          >
                            <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>{style.label}</p>
                            <p className="mt-0.5 text-xs text-[var(--cc-text-secondary)]">{style.description}</p>
                            <div className="mt-2 flex gap-2">
                              {template.signatories.slice(0, 2).map((sig) => {
                                const assetKey = resolveSignatoryAssetKey(sig)
                                if (!assetKey) return null
                                return (
                                  <div
                                    key={sig.id}
                                    className="relative h-8 flex-1 overflow-hidden rounded border border-[var(--border)] bg-[var(--muted)]"
                                  >
                                    <Image
                                      src={signatureAssetUrl(
                                        style.id as CertificateSignatureStyleId,
                                        assetKey,
                                      )}
                                      alt=""
                                      fill
                                      className="object-contain p-0.5"
                                      unoptimized
                                    />
                                  </div>
                                )
                              })}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </EditorSection>
                  <EditorSection
                    title="Signature size"
                    description="Adjust how large faculty signatures appear above the signatory lines in the preview and PDF."
                  >
                    {(() => {
                      const scale = clampSignatureScale(
                        template.typography.signatureScale ?? DEFAULT_SIGNATURE_SCALE,
                      )
                      const pct = Math.round(scale * 100)
                      return (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {SIGNATURE_SIZE_PRESETS.map((preset) => (
                              <Button
                                key={preset.label}
                                type="button"
                                size="sm"
                                className={cn(
                                  "h-8 rounded-lg",
                                  Math.abs(scale - preset.scale) < 0.01 ? solid : quiet,
                                )}
                                onClick={() =>
                                  setTemplate({
                                    ...template,
                                    typography: {
                                      ...template.typography,
                                      signatureScale: preset.scale,
                                    },
                                  })
                                }
                              >
                                {preset.label}
                              </Button>
                            ))}
                          </div>
                          <div className="flex items-center gap-3">
                            <Slider
                              min={SIGNATURE_SCALE_MIN * 100}
                              max={SIGNATURE_SCALE_MAX * 100}
                              step={5}
                              value={[pct]}
                              onValueChange={([v]) =>
                                setTemplate({
                                  ...template,
                                  typography: {
                                    ...template.typography,
                                    signatureScale: clampSignatureScale(v / 100),
                                  },
                                })
                              }
                              className="flex-1"
                            />
                            <span className={cn("w-12 shrink-0 text-right text-sm font-medium tabular-nums", PORTAL_TEXT)}>
                              {pct}%
                            </span>
                          </div>
                          <p className="text-xs text-[var(--cc-text-secondary)]">
                            Range {Math.round(SIGNATURE_SCALE_MIN * 100)}%–
                            {Math.round(SIGNATURE_SCALE_MAX * 100)}%. Changes apply to both signatories.
                          </p>
                        </div>
                      )
                    })()}
                  </EditorSection>
                  <EditorSection
                    title="Signature position"
                    description="Move only the handwritten signature above each signatory line. Names, titles, and the seal stay in place."
                  >
                    {(() => {
                      const offsetY = clampSignatureOffsetY(
                        template.typography.signatureOffsetY ?? DEFAULT_SIGNATURE_OFFSET_Y_MM,
                      )
                      return (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {SIGNATURE_POSITION_PRESETS.map((preset) => (
                              <Button
                                key={preset.label}
                                type="button"
                                size="sm"
                                className={cn(
                                  "h-8 rounded-lg",
                                  Math.abs(offsetY - preset.offsetY) < 0.5 ? solid : quiet,
                                )}
                                onClick={() =>
                                  setTemplate({
                                    ...template,
                                    typography: {
                                      ...template.typography,
                                      signatureOffsetY: preset.offsetY,
                                    },
                                  })
                                }
                              >
                                {preset.label}
                              </Button>
                            ))}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="w-8 shrink-0 text-xs text-[var(--cc-text-secondary)]">Up</span>
                            <Slider
                              min={SIGNATURE_OFFSET_Y_MIN_MM}
                              max={SIGNATURE_OFFSET_Y_MAX_MM}
                              step={1}
                              value={[offsetY]}
                              onValueChange={([v]) =>
                                setTemplate({
                                  ...template,
                                  typography: {
                                    ...template.typography,
                                    signatureOffsetY: clampSignatureOffsetY(v),
                                  },
                                })
                              }
                              className="flex-1"
                            />
                            <span className="w-10 shrink-0 text-xs text-[var(--cc-text-secondary)]">Down</span>
                            <span className={cn("w-14 shrink-0 text-right text-sm font-medium tabular-nums", PORTAL_TEXT)}>
                              {offsetY > 0 ? "+" : ""}
                              {offsetY} mm
                            </span>
                          </div>
                          <p className="text-xs text-[var(--cc-text-secondary)]">
                            Range {SIGNATURE_OFFSET_Y_MIN_MM} to {SIGNATURE_OFFSET_Y_MAX_MM} mm. Negative
                            values move the signature artwork up; signatory text does not move.
                          </p>
                        </div>
                      )
                    })()}
                  </EditorSection>
                  {template.signatories.map((sig, idx) => {
                    const isTrainingInstructor = sig.id === TRAINING_INSTRUCTOR_SIGNATORY_ID
                    return (
                    <div
                      key={sig.id}
                      className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">
                          {isTrainingInstructor ? "Training instructor" : `Signatory ${idx + 1}`}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--cc-text-secondary)]">Show on certificate</span>
                          <Switch
                            checked={sig.enabled}
                            onCheckedChange={(c) => {
                              const next = [...template.signatories]
                              next[idx] = { ...sig, enabled: c }
                              setTemplate({ ...template, signatories: next })
                            }}
                            className={switchChecked}
                          />
                        </div>
                      </div>
                      {isTrainingInstructor ? (
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label>Instructor for this training</Label>
                            {trainingFaculty.length === 0 ? (
                              <p className="text-xs text-amber-700 dark:text-amber-300">
                                No instructors assigned to this training yet. Assign faculty under Summer Camp admin, then reload.
                              </p>
                            ) : (
                              <Select
                                value={
                                  sig.instructorId != null
                                    ? String(sig.instructorId)
                                    : trainingFaculty[0]
                                      ? String(trainingFaculty[0].id)
                                      : undefined
                                }
                                onValueChange={(v) => selectTrainingInstructor(Number(v))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select training instructor" />
                                </SelectTrigger>
                                <SelectContent>
                                  {trainingFaculty.map((f) => (
                                    <SelectItem key={f.id} value={String(f.id)}>
                                      {trainingFacultyOptionLabel(f)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <p className="text-xs text-[var(--cc-text-secondary)]">
                              Name, title, and department are taken from the instructor&apos;s faculty profile.
                            </p>
                          </div>
                          {sig.name ? (
                            <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 p-3 text-xs text-[var(--cc-text-secondary)]">
                              <p className={cn("font-semibold", PORTAL_TEXT)}>{sig.name}</p>
                              <p className="mt-0.5">{sig.title}</p>
                              {sig.department ? <p>{sig.department}</p> : null}
                              <p>{sig.organization}</p>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                      <>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <Input
                          placeholder="Name"
                          value={sig.name}
                          onChange={(e) => {
                            const next = [...template.signatories]
                            next[idx] = { ...sig, name: e.target.value }
                            setTemplate({ ...template, signatories: next })
                          }}
                        />
                        <Input
                          placeholder="Title"
                          value={sig.title}
                          onChange={(e) => {
                            const next = [...template.signatories]
                            next[idx] = { ...sig, title: e.target.value }
                            setTemplate({ ...template, signatories: next })
                          }}
                        />
                      </div>
                      <Textarea
                        placeholder="Department (optional)"
                        rows={2}
                        value={sig.department}
                        onChange={(e) => {
                          const next = [...template.signatories]
                          next[idx] = { ...sig, department: e.target.value }
                          setTemplate({ ...template, signatories: next })
                        }}
                      />
                      <Input
                        placeholder="Organization"
                        value={sig.organization}
                        onChange={(e) => {
                          const next = [...template.signatories]
                          next[idx] = { ...sig, organization: e.target.value }
                          setTemplate({ ...template, signatories: next })
                        }}
                      />
                      </>
                      )}
                      <div className="flex items-center gap-3">
                        {sig.signatureImageUrl ? (
                          <div className="relative h-10 w-24 overflow-hidden rounded border border-[var(--border)] bg-[var(--muted)]">
                            <Image
                              src={sig.signatureImageUrl}
                              alt=""
                              fill
                              className="object-contain"
                              unoptimized
                            />
                          </div>
                        ) : null}
                        <Button
                          size="sm"
                          className={cn("h-8 rounded-lg", solid)}
                          disabled={uploading === `sig-${sig.id}`}
                          onClick={() => startUpload("signature", sig.id)}
                        >
                          <Upload className="h-3.5 w-3.5 mr-1" />
                          Upload signature
                        </Button>
                      </div>
                    </div>
                    )
                  })}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="metadata" className="border-[var(--border)]">
                <AccordionTrigger className="hover:no-underline py-3">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[var(--cc-accent)]" />
                    Footer & verification
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <EditorSection
                    title="Certificate ID & date"
                    description="Footer shows em-dash date and sequential certificate number."
                  >
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Certificate ID prefix</Label>
                        <Input
                          value={template.certificateIdPrefix}
                          onChange={(e) =>
                            setTemplate({ ...template, certificateIdPrefix: e.target.value })
                          }
                        />
                        <p className="text-[11px] text-[var(--cc-text-secondary)]">
                          Preview: {template.certificateIdPrefix}-0001
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Date format (legacy fields)</Label>
                        <Select
                          value={template.dateFormat}
                          onValueChange={(v) =>
                            setTemplate({
                              ...template,
                              dateFormat: v as CampCertificateTemplate["dateFormat"],
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="month-year">Month & Year</SelectItem>
                            <SelectItem value="full">Full date</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </EditorSection>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <div className="xl:sticky xl:top-4 space-y-3">
            <div className={cn(card, "p-4")}>
              <h2 className={cn("font-semibold", PORTAL_TEXT)}>Live preview</h2>
              <p className="mt-1 text-xs text-[var(--cc-text-secondary)]">
                Matches the PDF students download. Detailed completion info appears on the verification page only.
              </p>
            </div>
            <CampCertificatePreview template={template} data={previewData} className="w-full shadow-lg" />
          </div>
        </div>
      )}
    </div>
  )
}
