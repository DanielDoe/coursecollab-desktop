"use client"

import { studentApiFetch, getStudentAuthHeaders } from "@/lib/auth"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  Upload,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  X,
  FileText,
  ImageIcon,
  ClipboardCheck,
  Sparkles,
  Target,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { PASS_EXPECTATION_GRADE_OPTIONS } from "@/lib/grade-utils"
import {
  CourseEvaluationSurveyFields,
  emptySurveyFormState,
  type SurveyFormState,
} from "@/components/student/course-evaluation-survey-fields"
import { CourseEvaluationProofPreview } from "@/components/course-evaluation-proof-preview"
import { CourseEvaluationSubmissionDetail } from "@/components/student/course-evaluation-submission-detail"
import { getStudentNavGroupTheme } from "@/lib/student-module-themes"
import {
  createProofImagePreviewUrl,
  getPendingProofPreviewKind,
  pendingProofFileKey,
  type PendingProofPreviewKind,
} from "@/lib/course-evaluation-proof-preview-client"

type Proof = { id: number; url: string; file_name?: string; mime?: string }
type Evaluation = {
  id: number
  course_rating: number
  platform_helpfulness?: number | null
  favorite_features?: string[]
  favorite_features_other?: string | null
  feature_to_improve?: string | null
  feature_to_improve_other?: string | null
  improvement_suggestions: string
  instructor_clarity?: number | null
  workload?: string | null
  ai_tutor_usage?: string | null
  nps_score?: number | null
  missing_features?: string | null
  self_assessed_letter_grade?: string | null
  status: string
  instructor_note?: string | null
  submitted_at?: string
  reviewed_at?: string
  proofs?: Proof[]
}

const theme = getStudentNavGroupTheme("course-info")

/** Light jeans card; dark keeps elevated module chrome. */
const JEANS = cn(
  "rounded-xl border bg-white border-gray-200 shadow-md",
  "transition-shadow duration-300 hover:shadow-lg",
  "dark:border-white/15 dark:bg-[color-mix(in_srgb,var(--card)_78%,white)]",
  "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_22px_rgba(0,0,0,0.45)]",
  "dark:hover:brightness-110",
)

const TITLE = "text-gray-800 dark:text-[var(--cc-text)]"
const BODY = "text-gray-700 dark:text-[var(--cc-text-muted)]"
const LABEL = "text-sm font-medium text-gray-800 dark:text-[var(--cc-text)]"
const INPUT =
  "bg-white text-gray-800 border-gray-200 dark:bg-[var(--muted)] dark:text-[var(--cc-text)] dark:border-[var(--border)]"

function draftStorageKey(studentId: number, session: string): string {
  return `course-eval-draft:${studentId}:${session}`
}

type DraftPayload = { survey: SurveyFormState; selfAssessedGrade: string }

function readDraft(studentId: number, session: string): DraftPayload | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(draftStorageKey(studentId, session))
    if (!raw) return null
    const parsed = JSON.parse(raw) as DraftPayload
    if (!parsed?.survey || typeof parsed.selfAssessedGrade !== "string") return null
    return parsed
  } catch {
    return null
  }
}

function writeDraft(studentId: number, session: string, payload: DraftPayload) {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(draftStorageKey(studentId, session), JSON.stringify(payload))
  } catch {
    // Quota or private mode — ignore
  }
}

function clearDraft(studentId: number, session: string) {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(draftStorageKey(studentId, session))
  } catch {
    // ignore
  }
}

function evaluationToSurvey(e: Evaluation): SurveyFormState {
  return {
    overallExperience: e.course_rating || 0,
    platformHelpfulness: e.platform_helpfulness || 0,
    favoriteFeatures: e.favorite_features ?? [],
    favoriteFeaturesOther: e.favorite_features_other || "",
    featureToImprove: e.feature_to_improve || "",
    featureToImproveOther: e.feature_to_improve_other || "",
    openFeedback: e.improvement_suggestions || "",
    instructorClarity: e.instructor_clarity || 0,
    workload: e.workload || "",
    aiTutorUsage: e.ai_tutor_usage || "",
    npsScore: e.nps_score ?? null,
    missingFeatures: e.missing_features || "",
  }
}

function CrestKpi({
  label,
  value,
  hint,
  crestClass,
  icon: Icon,
}: {
  label: string
  value: string
  hint: string
  crestClass: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className={cn(JEANS, "relative flex flex-col pb-4 pt-0")}>
      <div
        className={cn(
          "relative mx-3 -mt-3 flex h-14 items-center justify-center overflow-hidden rounded-xl shadow-md",
          crestClass,
        )}
      >
        <Icon className="size-6 text-white drop-shadow-sm" />
      </div>
      <div className="space-y-1 px-4 pt-3">
        <p className={cn("text-xs font-medium uppercase tracking-wide", BODY)}>{label}</p>
        <p className={cn("text-lg font-semibold tabular-nums", TITLE)}>{value}</p>
        <p className={cn("text-xs", BODY)}>{hint}</p>
      </div>
    </div>
  )
}

export function CourseEvaluationPanel({
  studentId,
  session,
}: {
  studentId: number
  session: string
}) {
  const { toast } = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [engagementCredits, setEngagementCredits] = useState(50)
  const [survey, setSurvey] = useState<SurveyFormState>(emptySurveyFormState())
  const [selfAssessedGrade, setSelfAssessedGrade] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [previewGenerating, setPreviewGenerating] = useState(false)
  const [pendingPreviews, setPendingPreviews] = useState<
    Array<{ file: File; url: string | null; kind: PendingProofPreviewKind; broken?: boolean }>
  >([])
  const previewUrlsRef = useRef<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/student/course-evaluation?studentId=${studentId}&session=${encodeURIComponent(session)}`,
      )
      const data = await res.json()
      if (data.engagementCreditsOnApproval) setEngagementCredits(data.engagementCreditsOnApproval)
      if (data.evaluation) {
        setEvaluation(data.evaluation)
        setSurvey(evaluationToSurvey(data.evaluation))
        setSelfAssessedGrade(data.evaluation.self_assessed_letter_grade || "")
      } else {
        const draft = readDraft(studentId, session)
        if (draft) {
          setSurvey(draft.survey)
          setSelfAssessedGrade(draft.selfAssessedGrade)
        }
      }
    } catch {
      toastRef.current({
        title: "Error",
        description: "Could not load your evaluation",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [studentId, session])

  useEffect(() => {
    void load()
  }, [load])

  const locked = evaluation?.status === "approved" || evaluation?.status === "pending"
  const showSubmissionDetail =
    Boolean(evaluation) &&
    (evaluation?.status === "pending" ||
      evaluation?.status === "approved" ||
      evaluation?.status === "rejected")

  useEffect(() => {
    if (locked) return
    writeDraft(studentId, session, { survey, selfAssessedGrade })
  }, [studentId, session, survey, selfAssessedGrade, locked])

  const appendFiles = (picked: File[]) => {
    if (picked.length === 0) return
    setFiles((prev) => [...prev, ...picked].slice(0, 10))
  }

  const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    appendFiles(Array.from(e.target.files ?? []))
    e.target.value = ""
  }

  const onPdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    appendFiles(Array.from(e.target.files ?? []))
    e.target.value = ""
  }

  const removePendingFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  useEffect(() => {
    if (files.length === 0) {
      for (const url of previewUrlsRef.current) URL.revokeObjectURL(url)
      previewUrlsRef.current = []
      setPendingPreviews([])
      setPreviewGenerating(false)
      return
    }

    let cancelled = false
    setPreviewGenerating(true)

    void (async () => {
      const next: Array<{
        file: File
        url: string | null
        kind: PendingProofPreviewKind
        broken?: boolean
      }> = []

      for (const file of files) {
        if (cancelled) return
        const kind = getPendingProofPreviewKind(file)
        if (kind !== "image") {
          next.push({ file, url: null, kind })
          continue
        }
        try {
          const url = await createProofImagePreviewUrl(file)
          next.push({ file, url, kind, broken: url == null })
        } catch {
          next.push({ file, url: null, kind, broken: true })
        }
      }

      if (cancelled) {
        for (const item of next) {
          if (item.url) URL.revokeObjectURL(item.url)
        }
        return
      }

      for (const url of previewUrlsRef.current) URL.revokeObjectURL(url)
      previewUrlsRef.current = next.flatMap((item) => (item.url ? [item.url] : []))
      setPendingPreviews(next)
      setPreviewGenerating(false)
    })()

    return () => {
      cancelled = true
    }
  }, [files])

  useEffect(() => {
    return () => {
      for (const url of previewUrlsRef.current) URL.revokeObjectURL(url)
      previewUrlsRef.current = []
    }
  }, [])

  const totalProofCount = files.length + (evaluation?.proofs?.length ?? 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (locked) return
    if (!selfAssessedGrade) {
      toast({
        title: "Pass expectation required",
        description: "Select the grade that would feel like a pass for you in this course.",
        variant: "destructive",
      })
      return
    }
    if (files.length === 0 && !(evaluation?.proofs?.length)) {
      toast({
        title: "Proof required",
        description: "Upload screenshots or a PDF showing you completed the Canvas course evaluation.",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const form = new FormData()
      form.append("studentId", String(studentId))
      form.append("session", session)
      form.append("overallExperience", String(survey.overallExperience))
      form.append("platformHelpfulness", String(survey.platformHelpfulness))
      for (const f of survey.favoriteFeatures) form.append("favoriteFeatures", f)
      if (survey.favoriteFeaturesOther.trim()) {
        form.append("favoriteFeaturesOther", survey.favoriteFeaturesOther.trim())
      }
      form.append("featureToImprove", survey.featureToImprove)
      if (survey.featureToImproveOther.trim()) {
        form.append("featureToImproveOther", survey.featureToImproveOther.trim())
      }
      form.append("openFeedback", survey.openFeedback)
      form.append("selfAssessedLetterGrade", selfAssessedGrade)
      if (survey.instructorClarity > 0) form.append("instructorClarity", String(survey.instructorClarity))
      if (survey.workload) form.append("workload", survey.workload)
      if (survey.aiTutorUsage) form.append("aiTutorUsage", survey.aiTutorUsage)
      if (survey.npsScore != null) form.append("npsScore", String(survey.npsScore))
      if (survey.missingFeatures.trim()) form.append("missingFeatures", survey.missingFeatures.trim())
      for (const f of files) form.append("files", f)

      const res = await studentApiFetch("/api/student/course-evaluation", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Submit failed")

      setFiles([])
      clearDraft(studentId, session)
      setEvaluation(data.evaluation)
      setSurvey(evaluationToSurvey(data.evaluation))
      toast({
        title: "Submitted for review",
        description: "Your instructor will acknowledge your Canvas evaluation proof.",
      })
    } catch (err) {
      toast({
        title: "Submit failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center gap-2 text-gray-700 dark:text-[var(--cc-text-muted)]">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--cc-accent-dark)]" />
        Loading course evaluation…
      </div>
    )
  }

  const statusTone =
    evaluation?.status === "approved"
      ? {
          icon: CheckCircle2,
          label: `Approved — ${engagementCredits} engagement credits earned`,
          crest: "bg-emerald-500",
          soft: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
        }
      : evaluation?.status === "pending"
        ? {
            icon: Clock,
            label: "Awaiting instructor acknowledgment",
            crest: "bg-amber-500",
            soft: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
          }
        : evaluation?.status === "rejected"
          ? {
              icon: XCircle,
              label: "Returned — please revise and resubmit",
              crest: "bg-rose-500",
              soft: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
            }
          : null

  const StatusIcon = statusTone?.icon

  return (
    <div className="w-full min-w-0 space-y-5 pb-6 pt-2">
      {/* Hero */}
      <div className={cn(JEANS, "p-4 sm:p-5")}>
        <div className="flex flex-wrap items-start gap-4">
          <div
            className={cn(
              "flex size-14 shrink-0 items-center justify-center rounded-[14px] shadow-sm",
              theme.page.iconBg,
              theme.page.iconText,
            )}
          >
            <ClipboardCheck className="size-6" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={cn("text-lg font-semibold sm:text-xl", TITLE)}>Course Evaluation</h2>
              {session && session !== "ALL" ? (
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-medium",
                    theme.page.badge,
                  )}
                >
                  Section {session}
                </span>
              ) : null}
            </div>
            <p className={cn("max-w-2xl text-sm leading-relaxed", BODY)}>
              Finish the official Canvas evaluation, share CourseCollab feedback, and upload
              completion proof. Instructor acknowledgment earns{" "}
              <span className="font-semibold text-gray-800 dark:text-[var(--cc-accent-dark)]">
                {engagementCredits} engagement credits
              </span>
              .
            </p>
          </div>
          <div className={cn("rounded-xl px-4 py-2.5 text-center", theme.page.softBg)}>
            <p className={cn("text-2xl font-bold tabular-nums", TITLE)}>{engagementCredits}</p>
            <p className={cn("text-[11px] font-medium", BODY)}>Credits on approval</p>
          </div>
        </div>

        {statusTone && StatusIcon ? (
          <div className={cn("mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium", statusTone.soft)}>
            <StatusIcon className="size-4 shrink-0" />
            {statusTone.label}
          </div>
        ) : null}

        {evaluation?.status === "rejected" && evaluation.instructor_note ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm text-gray-800 dark:border-rose-500/30 dark:bg-transparent dark:text-[var(--cc-text)]">
            <strong className="font-semibold">Instructor note:</strong> {evaluation.instructor_note}
          </div>
        ) : null}
      </div>

      {/* Step crests */}
      {!locked ? (
        <div className="grid grid-cols-1 gap-4 pt-3 sm:grid-cols-3">
          <CrestKpi
            label="Step 1"
            value="Canvas"
            hint="Complete the official course eval"
            crestClass="bg-sky-500"
            icon={ExternalLink}
          />
          <CrestKpi
            label="Step 2"
            value="Survey"
            hint="Share CourseCollab feedback"
            crestClass="bg-[var(--cc-accent)]"
            icon={Sparkles}
          />
          <CrestKpi
            label="Step 3"
            value="Proof"
            hint="Upload screenshots or PDF"
            crestClass="bg-emerald-500"
            icon={Upload}
          />
        </div>
      ) : null}

      {showSubmissionDetail && evaluation ? (
        <CourseEvaluationSubmissionDetail evaluation={evaluation} />
      ) : null}

      {!locked ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className={cn(JEANS, "p-4 sm:p-5")}>
            <div className="mb-5">
              <h3 className={cn("text-base font-semibold sm:text-lg", TITLE)}>
                {evaluation?.status === "rejected" ? "Revise and resubmit" : "Your feedback"}
              </h3>
              <p className={cn("pt-1.5 text-sm", BODY)}>
                {evaluation?.status === "rejected"
                  ? "Update your responses or proof below, then submit again for instructor review."
                  : "Answer the survey questions, then upload Canvas completion proof."}
              </p>
            </div>
            <CourseEvaluationSurveyFields value={survey} onChange={setSurvey} />
          </div>

          <div className={cn(JEANS, "relative p-4 pt-0 sm:p-5 sm:pt-0")}>
            <div className="relative mx-0 -mt-3 mb-4 flex h-12 w-fit items-center gap-2 overflow-hidden rounded-xl bg-sky-500 px-4 shadow-md">
              <Target className="size-4 text-white" />
              <span className="text-sm font-semibold text-white">Pass expectation</span>
            </div>
            <Label htmlFor="self-grade" className={LABEL}>
              What does a pass look like for you in this course?
            </Label>
            <p className={cn("mt-1 mb-3 text-sm", BODY)}>
              Pick the letter grade that would feel like success — not what you think you have now,
              but what you are aiming for.
            </p>
            <Select value={selfAssessedGrade} onValueChange={setSelfAssessedGrade}>
              <SelectTrigger id="self-grade" className={cn("w-full sm:max-w-xs", INPUT)}>
                <SelectValue placeholder="What grade would feel like a pass?" />
              </SelectTrigger>
              <SelectContent className="bg-white text-gray-800 border-gray-200 dark:bg-[var(--card)] dark:text-[var(--cc-text)] dark:border-[var(--border)]">
                {PASS_EXPECTATION_GRADE_OPTIONS.map((grade) => (
                  <SelectItem key={grade} value={grade} className="focus:bg-gray-50 dark:focus:bg-[var(--muted)]">
                    {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={cn(JEANS, "p-4 sm:p-5")}>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm">
                <Upload className="size-4" />
              </span>
              <div>
                <h3 className={cn("text-base font-semibold", TITLE)}>Canvas evaluation proof</h3>
                <p className={cn("text-xs", BODY)}>PNG, JPEG, WebP, GIF, HEIC, or PDF — up to 25 MB each</p>
              </div>
            </div>
            <p className={cn("mb-4 text-sm", BODY)}>
              Upload screenshots and/or a PDF of your completed Canvas course evaluation report. At
              least one file is required before submit.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <label
                className={cn(
                  "inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-3.5 text-sm font-medium text-gray-800 transition-shadow hover:shadow-md",
                  "dark:border-white/20 dark:bg-transparent dark:text-[var(--cc-text)]",
                )}
              >
                <ImageIcon className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                Add screenshots
                <input
                  type="file"
                  name="proofImages"
                  accept="image/*,.heic,.heif"
                  multiple
                  className="sr-only"
                  onChange={onImageChange}
                />
              </label>
              <label
                className={cn(
                  "inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3.5 text-sm font-medium transition-shadow hover:shadow-md",
                  "border-sky-300 bg-sky-50 text-sky-900",
                  "dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200",
                )}
              >
                <FileText className="h-4 w-4 shrink-0" />
                Upload PDF report
                <input
                  type="file"
                  name="proofPdf"
                  accept="application/pdf,.pdf"
                  multiple
                  className="sr-only"
                  onChange={onPdfChange}
                />
              </label>
            </div>

            {(evaluation?.proofs?.length ?? 0) > 0 && (
              <div className="mt-4 space-y-2">
                <p className={cn("text-xs font-semibold uppercase tracking-wide", BODY)}>
                  Previously uploaded ({evaluation!.proofs!.length})
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {evaluation!.proofs!.map((p) => (
                    <a
                      key={p.id}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative block aspect-video overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-white/15 dark:bg-white/5"
                    >
                      <CourseEvaluationProofPreview
                        url={p.url}
                        fileName={p.file_name}
                        mime={p.mime}
                        compact
                      />
                    </a>
                  ))}
                </div>
                <p className={cn("text-xs", BODY)}>Upload new proof below to replace these on resubmit.</p>
              </div>
            )}

            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className={cn("text-xs font-semibold uppercase tracking-wide", BODY)}>
                  Ready to upload ({files.length})
                  {previewGenerating ? " — preparing preview…" : ""}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {pendingPreviews.map((preview, i) => (
                    <div
                      key={pendingProofFileKey(preview.file, i)}
                      className="relative aspect-video overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-white/15 dark:bg-white/5"
                    >
                      {preview.url && !preview.broken ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={preview.url}
                          alt={preview.file.name}
                          className="h-full w-full object-cover"
                          decoding="async"
                          onError={() => {
                            setPendingPreviews((prev) =>
                              prev.map((item, idx) =>
                                idx === i ? { ...item, broken: true, url: null } : item,
                              ),
                            )
                          }}
                        />
                      ) : preview.kind === "pdf" ? (
                        <div className="flex h-full flex-col items-center justify-center gap-1 bg-sky-50 p-2 text-center dark:bg-sky-500/10">
                          <FileText className="h-6 w-6 text-sky-700 dark:text-sky-300" />
                          <span className="text-[10px] font-semibold uppercase text-sky-800 dark:text-sky-200">
                            PDF
                          </span>
                          <span className="line-clamp-2 text-xs text-gray-800 dark:text-[var(--cc-text)]">
                            {preview.file.name}
                          </span>
                        </div>
                      ) : preview.kind === "heic" ? (
                        <div className="flex h-full flex-col items-center justify-center gap-1 bg-sky-50 p-2 text-center dark:bg-sky-500/10">
                          <ImageIcon className="h-6 w-6 text-sky-700 dark:text-sky-300" />
                          <span className="text-[10px] font-semibold uppercase text-sky-800 dark:text-sky-200">
                            HEIC
                          </span>
                          <span className="line-clamp-2 text-xs text-gray-800 dark:text-[var(--cc-text)]">
                            {preview.file.name}
                          </span>
                        </div>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
                          <ImageIcon className="h-6 w-6 text-gray-500" />
                          <span className="line-clamp-2 text-xs text-gray-800 dark:text-[var(--cc-text)]">
                            {preview.file.name}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removePendingFile(i)}
                        className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                        aria-label={`Remove ${preview.file.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className={cn("mt-3 text-xs", BODY)}>
              {totalProofCount > 0
                ? `${totalProofCount} proof file(s) will be included with your submission.`
                : "No proof files selected yet."}
            </p>
          </div>

          <div className={cn(JEANS, "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5")}>
            <p className={cn("text-sm", BODY)}>
              Submitting sends your survey and proof for instructor review.
            </p>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] text-white shadow-md"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Submit for instructor review
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
