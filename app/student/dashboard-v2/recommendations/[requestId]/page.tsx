"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useParams, usePathname, useRouter } from "next/navigation"
import { motion, type Variants } from "framer-motion"
import {
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  Circle,
  ChevronRight,
  ClipboardCheck,
  FilePenLine,
  FileText,
  Lock,
  MessageSquare,
  Paperclip,
  Sparkles,
  UserRound,
  AlertCircle,
} from "lucide-react"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { LetterIntakeChoice } from "@/components/student/recommendations/letter-intake-choice"
import { LetterQuestionnaireWizard } from "@/components/student/recommendations/letter-questionnaire-wizard"
import { RecommendationDraftWorkspace } from "@/components/student/recommendations/recommendation-draft-workspace"
import { cn } from "@/lib/utils"
import { buildRecommendationLetterPlaceholderBody } from "@/lib/recommendation-letter-template"
import { letterPurposeLineDisplay } from "@/lib/recommendation-letters-shared"
import { getStudentRecommendationJourney } from "@/lib/recommendation-student-journey"
import { StudentRequestDetailsEditor } from "@/components/student/recommendations/student-request-details-editor"
import { useRecommendationNav } from "@/components/student/recommendations/recommendation-nav-context"
import { RecommendationBriefPanel } from "@/components/student/recommendations/RecommendationBriefPanel"
import {
  normalizeDeliveryMethod,
  studentCanDownloadPdf,
  studentDeliveryStatusLabel,
} from "@/lib/recommendation-delivery"

function formatUsDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" })
}

type AttachmentRow = { id?: number; file_type?: string; file_name?: string | null }

const progressListVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.06 },
  },
}

const progressItemVariants: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 420, damping: 28 },
  },
}

/** Side-by-side title vs “What happens next” at xl squeezed the ramp cards — stay stacked like the guest shell. */
function RecommendationInstructorLaneHero({
  mode,
}: {
  mode: "student_selected" | "instructor_polishing"
}) {
  const Icon = mode === "student_selected" ? ClipboardCheck : FilePenLine
  const copy =
    mode === "student_selected"
      ? {
          eyebrow: "Instructor approvals · active lane",
          title: "Your letter is with your instructor for final approval",
          body: "They’re reviewing your draft on official letterhead. When they sign off, your PDF unlocks in the download section — this page updates as soon as the status changes.",
          activeLabel: "Review & sign-off",
          activeHint: "Final pass on your letter",
          lockedLabel: "Official PDF",
          lockedHint: "Unlocks after they release it",
        }
      : {
          eyebrow: "Instructor approvals · polishing",
          title: "Your instructor is preparing your letter",
          body: "They may edit wording or formatting before exporting the final PDF. You’ll get the download as soon as they finalize — no action needed on your side right now.",
          activeLabel: "Polish & finalize",
          activeHint: "Editing before export",
          lockedLabel: "Official PDF",
          lockedHint: "Appears when ready",
        }

  return (
    <motion.section
      className="relative overflow-hidden rounded-2xl sm:rounded-3xl"
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby={
        mode === "student_selected"
          ? "rec-instructor-lane-heading-signoff"
          : "rec-instructor-lane-heading-polish"
      }
    >
      {/* Aurora-style mesh: ellipses fade to transparent (no rectangular blur clip) */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute -inset-[28%] dark:hidden"
          style={{
            background: `
              radial-gradient(ellipse 58% 48% at 96% 4%, rgba(139, 92, 246, 0.2), transparent 58%),
              radial-gradient(ellipse 52% 46% at -2% 96%, rgba(88, 44, 131, 0.14), transparent 56%),
              radial-gradient(ellipse 92% 42% at 52% -12%, rgba(167, 139, 250, 0.12), transparent 52%),
              radial-gradient(ellipse 70% 50% at 48% 108%, rgba(124, 58, 237, 0.05), transparent 48%)
            `,
          }}
        />
        <div
          className="absolute -inset-[28%] hidden dark:block"
          style={{
            background: `
              radial-gradient(ellipse 58% 48% at 96% 4%, rgba(167, 131, 230, 0.26), transparent 58%),
              radial-gradient(ellipse 52% 46% at -2% 96%, rgba(122, 78, 186, 0.2), transparent 56%),
              radial-gradient(ellipse 90% 40% at 50% -10%, rgba(88, 44, 131, 0.14), transparent 50%)
            `,
          }}
        />
      </div>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-4 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-[var(--cc-accent)]/28 to-transparent sm:inset-x-6 md:inset-x-8 lg:inset-x-10"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      />

      <div className="relative flex flex-col gap-8">
        <div className="flex min-w-0 w-full flex-col gap-6 sm:flex-row sm:items-start sm:gap-7">
          <div className="relative shrink-0">
            <motion.div
              className="relative flex h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem] items-center justify-center rounded-2xl bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)] shadow-lg shadow-[var(--cc-accent)]/14 ring-1 ring-[var(--cc-accent-border)]"
              animate={{ y: [0, -3, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
            >
              <Icon className="relative z-[1] h-8 w-8 sm:h-9 sm:w-9" aria-hidden />
              <motion.span
                className="pointer-events-none absolute inset-[-2px] rounded-2xl border-2 border-[var(--cc-accent-border)] dark:border-[var(--cc-accent-border)]"
                animate={{ opacity: [0.5, 0.12, 0.5], scale: [1, 1.06, 1] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
              />
            </motion.div>
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--cc-accent-dark)]/90 dark:text-[var(--cc-accent-dark)]/95">
              {copy.eyebrow}
            </p>
            <h2
              id={
                mode === "student_selected"
                  ? "rec-instructor-lane-heading-signoff"
                  : "rec-instructor-lane-heading-polish"
              }
              className="text-pretty text-xl font-bold tracking-tight text-[#261030] dark:text-white sm:text-2xl lg:text-[1.65rem] lg:leading-snug"
            >
              {copy.title}
            </h2>
            <p className="max-w-prose text-sm leading-relaxed text-[var(--cc-text)] sm:text-[15px]">
              {copy.body}
            </p>
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cc-accent-dark)]/90 dark:text-[var(--cc-accent-dark)]/95">
            What happens next
          </p>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-4">
            <div className="relative flex min-w-0 flex-1 flex-col gap-3 rounded-2xl border border-[var(--cc-accent-border)] bg-white/92 px-5 py-5 shadow-md shadow-[var(--cc-accent)]/10 dark:border-[var(--cc-accent-border)] dark:bg-white/[0.05]">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <span className="text-sm font-semibold leading-snug text-[#261030] dark:text-white">
                  {copy.activeLabel}
                </span>
                <motion.span
                  className="inline-flex shrink-0 items-center rounded-full bg-[var(--cc-accent-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-accent-dark)] shadow-sm dark:bg-[var(--cc-accent-soft)] dark:text-[var(--cc-accent)]"
                  animate={{ opacity: [1, 0.78, 1] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                >
                  In progress
                </motion.span>
              </div>
              <p className="text-[13px] leading-relaxed text-[var(--cc-text)]">{copy.activeHint}</p>
              <motion.div
                className="mt-auto h-1.5 overflow-hidden rounded-full bg-[var(--cc-accent-soft)] dark:bg-white/10"
                aria-hidden
              >
                <motion.div
                  className="h-full w-1/2 rounded-full bg-[var(--cc-accent)]"
                  animate={{ x: ["-30%", "120%"] }}
                  transition={{ repeat: Infinity, duration: 1.85, ease: "easeInOut" }}
                />
              </motion.div>
            </div>

            <div
              className="flex shrink-0 items-center justify-center py-1 lg:flex-col lg:justify-center lg:px-0.5 lg:py-0"
              aria-hidden
            >
              <ChevronRight className="h-6 w-6 rotate-90 text-[var(--cc-accent-dark)]/75 lg:rotate-0 dark:text-[var(--cc-accent-dark)]" />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-2xl border border-dashed border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)] px-5 py-5 opacity-[0.95] backdrop-blur-sm dark:border-[var(--cc-accent-border)] dark:bg-black/25">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold leading-snug text-[#34224a] dark:text-[var(--cc-accent-dark)]">
                  <Lock className="h-4 w-4 shrink-0 opacity-80 text-[var(--cc-accent-dark)]" aria-hidden />
                  {copy.lockedLabel}
                </span>
                <span className="shrink-0 rounded-full bg-[var(--muted)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                  Locked
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-[var(--cc-text-muted)]">{copy.lockedHint}</p>
              <div className="pointer-events-none mt-auto flex gap-1.5 pt-0.5 opacity-70" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={String(i)}
                    className="h-1.5 flex-1 rounded-full bg-[var(--cc-accent-soft)] dark:bg-[var(--cc-accent-soft)]"
                    animate={{ opacity: [0.35, 0.95, 0.35], scaleY: [0.85, 1, 0.85] }}
                    transition={{ repeat: Infinity, duration: 1.6, delay: i * 0.2, ease: "easeInOut" }}
                  />
                ))}
              </div>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--cc-text-muted)]">
            Multiple instructor passes can happen before release — the Progress panel keeps Gates 4 and steps 9–12 aligned with each review round.
          </p>
        </div>
      </div>
    </motion.section>
  )
}

function ProgressJumpLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="group/j inline-flex items-center gap-1 mt-2 text-xs font-semibold text-[var(--cc-accent-dark)] hover:text-[var(--cc-accent-dark)] dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]/40 rounded-sm"
    >
      <span className="border-b border-transparent group-hover/j:border-[var(--cc-accent-border)] dark:group-hover/j:border-[var(--cc-accent-border)] transition-colors">
        {children}
      </span>
      <ChevronRight
        className="h-3.5 w-3.5 shrink-0 transition-transform group-hover/j:translate-x-0.5"
        aria-hidden
      />
    </a>
  )
}

type ProgressStepVisual = "done" | "active" | "pending" | "error"

function ProgressStepIcon({ state }: { state: ProgressStepVisual }) {
  const icon =
    state === "done" ? (
      <CheckCircle2 className="relative z-[1] h-4 w-4 text-[var(--cc-accent-dark)]" aria-hidden />
    ) : state === "error" ? (
      <AlertCircle className="relative z-[1] h-4 w-4 text-red-500" aria-hidden />
    ) : state === "active" ? (
      <Circle
        className="relative z-[1] h-4 w-4 text-[var(--cc-accent-dark)] fill-[var(--cc-accent)]/25"
        aria-hidden
      />
    ) : (
      <Circle className="relative z-[1] h-4 w-4 text-[var(--cc-text-muted)]" aria-hidden />
    )

  return (
    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
      {state === "active" ? (
        <>
          <motion.span
            className="pointer-events-none absolute inset-[-4px] rounded-full border border-[var(--cc-accent-border)] dark:border-[var(--cc-accent-border)]"
            animate={{ scale: [1, 1.12, 1], opacity: [0.45, 0.12, 0.45] }}
            transition={{ duration: 2.35, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-full bg-[var(--cc-accent-soft)] dark:bg-[var(--cc-accent-soft)]"
            animate={{ opacity: [0.35, 0.75, 0.35] }}
            transition={{ duration: 2.35, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
        </>
      ) : null}
      {icon}
    </div>
  )
}

type ProgressStepDef = {
  title: string
  detail: string
  state: ProgressStepVisual
  href?: string
  linkLabel?: string
}

function RecommendationRequestProgress({
  steps,
  tierNote,
  listKey,
  runwayCaption,
  runwayDots,
  hideRunwayStripe,
  pdfReadyBanner,
}: {
  steps: ProgressStepDef[]
  tierNote: string
  listKey: string
  /** Mirrors the header badge (“Step N of 12 …”) under the roadmap title */
  runwayCaption?: string | null
  runwayDots?: string | null
  /** When the main workspace shows the instructor lane hero, omit this to avoid repeating the runway copy */
  hideRunwayStripe?: boolean
  /** Instructor released the PDF — show a clear message; optional primary download action (replaces jump link) */
  pdfReadyBanner?: {
    downloadedOnce: boolean
    onDownload?: () => void
    downloadBusy?: boolean
  } | null
}) {
  return (
    <CardWrapper delay={0.03} hover={false} className="p-4 sm:p-5 scroll-mt-24" id="rec-progress">
      <h3 className="font-semibold text-sm sm:text-base text-[var(--cc-text)]">Progress</h3>
      <p className="text-[11px] text-[var(--cc-text-muted)] mt-1 leading-snug">
        Jump to the step you need — links scroll the page to the matching section.
      </p>
      {pdfReadyBanner ? (
        <div className="mt-3 rounded-xl border border-emerald-300/70 bg-emerald-50/80 px-3 py-3 space-y-3 shadow-sm shadow-emerald-900/10 dark:border-emerald-800/55 dark:bg-emerald-950/40">
          <p className="text-xs font-semibold text-emerald-950 dark:text-white/85 leading-snug">
            {pdfReadyBanner.downloadedOnce ? "Official PDF unlocked" : "Official PDF ready to download"}
          </p>
          <p className="text-[11px] leading-relaxed text-emerald-900/92 dark:text-emerald-200/88">
            {pdfReadyBanner.downloadedOnce ? (
              <>
                You&apos;ve saved a copy — use the button anytime you need another download for applications or backups.
              </>
            ) : (
              <>Your instructor signed off — grab the official letter below.</>
            )}
          </p>
          {pdfReadyBanner.onDownload ? (
            <div id="rec-section-download" className="scroll-mt-24">
              <Button
                type="button"
                onClick={pdfReadyBanner.onDownload}
                disabled={pdfReadyBanner.downloadBusy}
                className="w-full rounded-xl bg-emerald-600 py-5 text-sm font-semibold hover:bg-emerald-700 shadow-md shadow-emerald-900/15"
              >
                {pdfReadyBanner.downloadBusy ? "Preparing…" : "Download recommendation PDF"}
              </Button>
            </div>
          ) : (
            <ProgressJumpLink href="#rec-section-download">Jump to Download PDF</ProgressJumpLink>
          )}
        </div>
      ) : null}
      {!hideRunwayStripe && (runwayCaption || runwayDots) && (
        <div className="mt-3 rounded-xl border border-[var(--cc-accent-border)] dark:border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)]/[0.04] dark:bg-[var(--cc-accent-soft)] px-3 py-2.5 space-y-2">
          {runwayCaption ? (
            <p className="text-[11px] sm:text-xs text-[var(--cc-text)] leading-snug font-medium">{runwayCaption}</p>
          ) : null}
          {runwayDots ? (
            <div
              className="-mx-1 px-1 max-w-full overflow-x-auto overscroll-x-contain [scrollbar-width:thin]"
              role="presentation"
            >
              <p
                className="font-mono text-[9px] sm:text-[10px] tracking-[0.13em] text-[var(--cc-text-muted)] whitespace-nowrap leading-none select-none w-max"
                aria-hidden
              >
                {runwayDots}
              </p>
            </div>
          ) : null}
          <p className="text-[10px] text-[var(--cc-text-muted)] leading-snug">
            The four checkpoints below summarize your work; numbered dots are the finer runway (instructor rounds can revisit the violet / rose stretches).
          </p>
        </div>
      )}
      <motion.ol
        key={listKey}
        className="mt-4 space-y-1 relative"
        variants={progressListVariants}
        initial="hidden"
        animate="visible"
        aria-label="Recommendation request progress"
      >
        {steps.map((step, i) => (
          <motion.li
            key={`${step.title}-${i}`}
            variants={progressItemVariants}
            className={cn(
              "flex gap-3 rounded-xl px-2 py-2.5 -mx-2 transition-colors",
              step.state === "active"
                ? "bg-[var(--cc-accent-soft)]/[0.06] dark:bg-[var(--cc-accent-soft)]/[0.12] ring-1 ring-[var(--cc-accent)]/15 dark:ring-white/10"
                : "",
            )}
          >
            <ProgressStepIcon state={step.state} />
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium text-[var(--cc-text)] break-words hyphens-auto">
                {step.title}
              </p>
              <p className="text-xs text-[var(--cc-text-muted)] mt-0.5 leading-relaxed">{step.detail}</p>
              {step.href && step.linkLabel ? (
                <ProgressJumpLink href={step.href}>{step.linkLabel}</ProgressJumpLink>
              ) : null}
            </div>
          </motion.li>
        ))}
      </motion.ol>
      <p className="mt-5 pt-4 border-t border-[var(--border)] text-[11px] sm:text-xs text-[var(--cc-text-muted)] leading-relaxed">
        {tierNote}
      </p>
    </CardWrapper>
  )
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof BookOpen
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex gap-3 min-w-0", className)}>
      <div className="shrink-0 mt-0.5 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-2 text-[var(--cc-accent-dark)]">
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">{label}</p>
        <div className="text-sm text-[var(--cc-text)] mt-0.5 break-words">{value}</div>
      </div>
    </div>
  )
}

export default function DashboardRecommendationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  /** Guest shell has no sidebar — use earlier breakpoints so summary + progress use width better on tablets. */
  const isGuestRecommendation = (pathname ?? "").startsWith("/guest/recommendations")
  const { base: BASE } = useRecommendationNav()
  const requestId = String(params.requestId ?? "")
  const [studentKey, setStudentKey] = useState<string | null>(null)
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [tier, setTier] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawBusy, setWithdrawBusy] = useState(false)
  const [intakeBusy, setIntakeBusy] = useState(false)
  const [workspacePreparing, setWorkspacePreparing] = useState(false)

  const [contentSource, setContentSource] = useState<"own_details" | "ai_guided">("ai_guided")
  const [tone, setTone] = useState("professional")
  const [fields, setFields] = useState({
    studentStrengths: "",
    achievements: "",
    projects: "",
    skills: "",
    leadershipExamples: "",
    goals: "",
    specialInstructions: "",
    letterFor: "",
    classExperience: "",
    personalQualities: "",
  })

  const [polishNote, setPolishNote] = useState("Tighten wording; keep all facts unchanged.")
  const [manualLetterText, setManualLetterText] = useState("")
  /** After manual letter submit API succeeds: which confirmation dialog to show. */
  const [manualLetterSentKind, setManualLetterSentKind] = useState<null | "awaiting_instructor" | "finalized">(null)

  const load = async (sid: string) => {
    const res = await fetch(
      `/api/student/recommendations/${requestId}?studentDatabaseId=${encodeURIComponent(sid)}`,
      { cache: "no-store" },
    )
    const j = await res.json()
    if (!res.ok) throw new Error(j.error || "Failed")
    setData(j)
    if (j.profile) {
      const p = j.profile
      setContentSource(p.content_mode === "own_details" ? "own_details" : "ai_guided")
      setTone(String(p.tone || "professional"))
      setFields({
        studentStrengths: String(p.student_strengths || ""),
        achievements: String(p.achievements || ""),
        projects: String(p.projects || ""),
        skills: String(p.skills || ""),
        leadershipExamples: String(p.leadership_examples || ""),
        goals: String(p.goals || ""),
        specialInstructions: String(p.special_instructions || ""),
        letterFor: String(p.letter_for || ""),
        classExperience: String(p.class_experience || ""),
        personalQualities: String(p.personal_qualities || ""),
      })
    }
  }

  const refreshTemplateSettings = useCallback(
    async (sid: string) => {
      try {
        const res = await fetch(
          `/api/student/recommendations/${requestId}?studentDatabaseId=${encodeURIComponent(sid)}`,
          { cache: "no-store" },
        )
        const j = (await res.json()) as { settings?: Record<string, unknown> }
        if (!res.ok) return
        setData((prev) => {
          if (!prev || j.settings == null) return prev
          return { ...prev, settings: j.settings }
        })
      } catch {
        /* ignore */
      }
    },
    [requestId],
  )

  useEffect(() => {
    const d = getStudentData()
    const sid = d?.databaseId ?? d?.id ?? null
    setStudentKey(sid)
    if (!sid || !d) return
    ;(async () => {
      try {
        const info = await studentApiFetch(`/api/student/info?student_id=${encodeURIComponent(d.id)}`)
        const ij = await info.json()
        if (info.ok && ij.student?.membership_tier) setTier(ij.student.membership_tier)
        await load(sid)
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed")
      }
    })()
  }, [requestId])

  useEffect(() => {
    if (!studentKey) return
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      void refreshTemplateSettings(studentKey)
    }
    document.addEventListener("visibilitychange", onVisible)
    const pollId = window.setInterval(() => void refreshTemplateSettings(studentKey), 60_000)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.clearInterval(pollId)
    }
  }, [studentKey, refreshTemplateSettings])

  useEffect(() => {
    const r = data?.request as Record<string, unknown> | undefined
    const m = String(r?.letter_intake_mode ?? "").trim()
    if (m === "questionnaire_ai") setContentSource("ai_guided")
  }, [data?.request])

  useEffect(() => {
    const r = data?.request as Record<string, unknown> | undefined
    if (!r || String(r.letter_intake_mode ?? "").trim() !== "bring_own_draft") return
    const name = String(r.student_full_name ?? "").trim()
    if (!name) return
    const letterSpecificReader = Boolean(r.letter_is_specific)
    let readerLine = ""
    if (letterSpecificReader) {
      const n = typeof r.recipient_name === "string" ? String(r.recipient_name).trim() : ""
      const o = typeof r.recipient_organization === "string" ? String(r.recipient_organization).trim() : ""
      readerLine = [n, o].filter(Boolean).join(", ")
    }
    setManualLetterText((prev) => {
      if (prev.trim()) return prev
      return buildRecommendationLetterPlaceholderBody({
        studentName: name,
        readerLine,
        instructorName: String(r.instructor_name ?? "Your instructor"),
        courseLine: [String(r.course_code ?? "").trim(), String(r.course_description ?? "").trim()]
          .filter(Boolean)
          .join(" — "),
      })
    })
  }, [data?.request])

  const req = data?.request as Record<string, string | boolean | null> | undefined
  const settings = data?.settings as Record<string, boolean | number | string | null> | undefined
  const drafts = (data?.drafts as Record<string, unknown>[]) || []

  const runwayJourney = useMemo(() => {
    if (!data || !req) return null
    const rq = req as Record<string, unknown>
    const intake =
      typeof rq.letter_intake_mode === "string" ? String(rq.letter_intake_mode).trim() : ""
    return getStudentRecommendationJourney({
      status: String(rq.status ?? ""),
      hasQuestionnaireProfile: Boolean(data.profile),
      letterIntakeMode: intake,
      aiDraftCount: drafts.length,
    })
  }, [data, req, drafts.length])
  const attachments = (data?.attachments as AttachmentRow[]) || []

  const progressSteps = useMemo((): ProgressStepDef[] => {
    if (!req || !data) return []
    const st = String(req.status ?? "")
    const hasProfile = Boolean(data.profile)
    const canProfileLocal =
      st === "approved" || st === "info_requested" || st === "revision_requested"
    const letterIntakeRaw =
      typeof (req as { letter_intake_mode?: unknown }).letter_intake_mode === "string"
        ? String((req as { letter_intake_mode: string }).letter_intake_mode).trim()
        : ""
    const awaitingIntakeChoice = canProfileLocal && !hasProfile && letterIntakeRaw === ""

    const canComposeLocal = st === "approved" || st === "revision_requested"

    const showGenerateLocal =
      canComposeLocal &&
      Boolean(settings?.allow_ai_generation) &&
      hasProfile &&
      letterIntakeRaw !== "bring_own_draft"

    const showManualComposeLocal =
      canComposeLocal &&
      hasProfile &&
      (settings?.allow_ai_generation === false || letterIntakeRaw === "bring_own_draft")
    const showCompareLocal = st === "ai_generated"
    const showDownloadLocal = st === "finalized" || st === "downloaded"
    const allowAi = settings?.allow_ai_generation !== false
    const created = formatUsDate(req.created_at != null ? String(req.created_at) : null)
    const instructorWaitingLocal = st === "requested"
    const isRejectedLocal = st === "rejected"
    const questionnaireActiveLocal = canProfileLocal && !hasProfile
    const questionnaireDoneLocal = hasProfile
    const draftsPhaseActiveLocal = showGenerateLocal || showCompareLocal || showManualComposeLocal
    const draftsPhaseDoneLocal = showDownloadLocal || st === "downloaded"
    const draftsStepActive =
      draftsPhaseActiveLocal ||
      st === "revision_requested" ||
      st === "student_selected" ||
      (st === "instructor_review_pending" && !canProfileLocal)

    const step1: ProgressStepDef = {
      title: "① Gate 1 · Request submitted",
      detail: created ? `Logged on ${created}.` : "Your request is on file.",
      state: "done",
      href: "#rec-summary",
      linkLabel: "View request summary",
    }

    const step2: ProgressStepDef = {
      title: "② Gate 2 · Instructor checkpoint",
      detail: isRejectedLocal
        ? "This request was closed."
        : instructorWaitingLocal
          ? "We’ll notify you when they approve, ask a question, or need more detail."
          : "Your instructor has acted on this request. Continue in your workspace when steps unlock.",
      state: isRejectedLocal ? "error" : instructorWaitingLocal ? "active" : "done",
      href: instructorWaitingLocal ? "#rec-section-waiting" : "#rec-main-workspace",
      linkLabel: instructorWaitingLocal ? "See what to do while you wait" : isRejectedLocal ? "View request details" : "Go to your workspace",
    }

    const step3: ProgressStepDef = {
      title: awaitingIntakeChoice ? "③ Gate 3 · Set up workspace" : "③ Gate 3 · Questionnaire & intake",
      detail: questionnaireDoneLocal
        ? settings?.allow_ai_generation === false
          ? "Saved. Draft your letter next — your instructor only steps in again to approve the final PDF."
          : "Saved. Next steps depend on your instructor’s AI settings."
        : awaitingIntakeChoice
          ? "Choose whether you already have letter text to paste into our template or you want guided questions first."
          : questionnaireActiveLocal
            ? letterIntakeRaw === "questionnaire_ai"
              ? "Use the timed, one-question prompts, then generate AI drafts when ready."
              : "Complete your details below — helps your instructor and any AI stay accurate."
            : instructorWaitingLocal
              ? "You’ll continue here after your instructor approves the request."
              : "Waiting for the next step from your instructor.",
      state: questionnaireDoneLocal ? "done" : questionnaireActiveLocal ? "active" : "pending",
      href:
        canProfileLocal && (questionnaireActiveLocal || questionnaireDoneLocal)
          ? "#rec-section-questionnaire"
          : instructorWaitingLocal
            ? "#rec-section-waiting"
            : "#rec-main-workspace",
      linkLabel: awaitingIntakeChoice
        ? "Choose your path"
        : questionnaireActiveLocal
          ? "Open questionnaire"
          : questionnaireDoneLocal && canProfileLocal
            ? "Review questionnaire"
            : instructorWaitingLocal
              ? "Read waiting-room tips"
              : "Go to workspace",
    }

    let step4Href = "#rec-main-workspace"
    let step4Link = "Go to workspace"
    if (showDownloadLocal) {
      step4Href = "#rec-section-download"
      step4Link = "Download PDF"
    } else if (showCompareLocal) {
      step4Href = "#rec-section-drafts"
      step4Link = "Compare drafts"
    } else if (showGenerateLocal) {
      step4Href = "#rec-section-generate"
      step4Link = "Generate AI drafts"
    } else if (showManualComposeLocal) {
      step4Href = "#rec-section-manual-letter"
      step4Link = "Write your letter"
    } else if (
      (st === "instructor_review_pending" && !canProfileLocal) ||
      st === "student_selected"
    ) {
      step4Href = "#rec-section-instructor-lane"
      step4Link = "See instructor lane status"
    }

    const step4: ProgressStepDef = {
      title: "④ Gate 4 · Letter, approvals & PDF",
      detail: !allowAi
        ? draftsPhaseDoneLocal
          ? "Your letter is ready — download the official PDF when you need it."
          : draftsPhaseActiveLocal
            ? "Write your letter here, send it to your instructor for approval, then download."
            : "After your questionnaire, you'll draft the letter on this page before your instructor signs off."
        : draftsPhaseDoneLocal
          ? "Your letter is ready — download the official PDF when you need it."
          : draftsPhaseActiveLocal
            ? "Generate or compare drafts, pick one, then wait for final approval."
            : "After your questionnaire, generate AI drafts (if enabled), pick a version, then your instructor gives final approval.",
      state: draftsPhaseDoneLocal ? "done" : draftsStepActive ? "active" : "pending",
      href: step4Href,
      linkLabel: step4Link,
    }

    if (isRejectedLocal) return [step1, step2]
    return [step1, step2, step3, step4]
  }, [data, req, settings])

  const status = String(req?.status ?? "")
  const letterIntakeMode =
    typeof (req as { letter_intake_mode?: unknown } | undefined)?.letter_intake_mode === "string"
      ? String((req as { letter_intake_mode: string }).letter_intake_mode).trim()
      : ""

  const canProfile = status === "approved" || status === "info_requested" || status === "revision_requested"
  const canStudentCompose = status === "approved" || status === "revision_requested"
  const isBringDraftPath = letterIntakeMode === "bring_own_draft"
  const deliveryMethod = normalizeDeliveryMethod(
    (req as { delivery_method?: string } | undefined)?.delivery_method,
  )
  const showGenerate =
    canStudentCompose &&
    Boolean(settings?.allow_ai_generation) &&
    Boolean(data?.profile) &&
    !isBringDraftPath &&
    !isGuestRecommendation
  const showManualCompose =
    canStudentCompose && Boolean(data?.profile) && (settings?.allow_ai_generation === false || isBringDraftPath)
  const useDraftLetterWorkspace = isBringDraftPath && showManualCompose
  const showCompare = status === "ai_generated"
  const showBrief =
    isGuestRecommendation && canProfile && Boolean(data?.profile) && !["rejected", "withdrawn"].includes(status)
  const showDownload = studentCanDownloadPdf(deliveryMethod, status)
  const showCompletedWithoutDownload =
    (status === "finalized" || status === "downloaded" || status === "delivered") && !showDownload
  /** Single main card for instructor sign-off lane — avoids duplicating runway + badge as two “approval” panels */
  const showInstructorLaneWorkspace =
    !canProfile && (status === "instructor_review_pending" || status === "student_selected")

  async function uploadRecommendationAttachments(sk: string) {
    if (settings?.require_resume && (document.getElementById("resume") as HTMLInputElement)?.files?.[0]) {
      const f = (document.getElementById("resume") as HTMLInputElement).files![0]
      const fd = new FormData()
      fd.append("file", f)
      fd.append("fileType", "resume")
      fd.append("studentDatabaseId", sk)
      const up = await studentApiFetch(`/api/student/recommendations/${requestId}/upload`, { method: "POST", body: fd })
      if (!up.ok) {
        const u = await up.json()
        throw new Error(u.error || "Upload failed")
      }
    }
    if (settings?.require_transcript && (document.getElementById("transcript") as HTMLInputElement)?.files?.[0]) {
      const f = (document.getElementById("transcript") as HTMLInputElement).files![0]
      const tfd = new FormData()
      tfd.append("file", f)
      tfd.append("fileType", "transcript")
      tfd.append("studentDatabaseId", sk)
      const up = await studentApiFetch(`/api/student/recommendations/${requestId}/upload`, { method: "POST", body: tfd })
      if (!up.ok) {
        const u = await up.json()
        throw new Error(u.error || "Upload failed")
      }
    }
  }

  async function saveQuestionnaireAnswers(sourceOverride?: "own_details" | "ai_guided") {
    const sk = studentKey
    if (!sk) return
    await uploadRecommendationAttachments(sk)
    const cs = sourceOverride ?? contentSource
    const res = await studentApiFetch(`/api/student/recommendations/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentDatabaseId: sk,
        contentSource: cs,
        tone,
        studentStrengths: fields.studentStrengths,
        achievements: fields.achievements,
        projects: fields.projects,
        skills: fields.skills,
        leadershipExamples: fields.leadershipExamples,
        goals: fields.goals,
        specialInstructions: fields.specialInstructions,
        letterFor: fields.letterFor,
        classExperience: fields.classExperience,
        personalQualities: fields.personalQualities,
      }),
    })
    const j = await res.json()
    if (!res.ok) throw new Error(j.error || "Save failed")
    await load(sk)
  }

  async function postLetterIntake(mode: "bring_own_draft" | "questionnaire_ai") {
    if (!studentKey) return
    setIntakeBusy(true)
    setErr(null)
    try {
      const res = await studentApiFetch(`/api/student/recommendations/${requestId}/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentDatabaseId: studentKey, mode }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || "Could not save your choice")
      if (mode === "questionnaire_ai") setContentSource("ai_guided")
      await load(studentKey)
      if (typeof document !== "undefined") {
        const el = document.getElementById("rec-section-questionnaire")
        el?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed")
    } finally {
      setIntakeBusy(false)
    }
  }

  async function resetLetterIntake() {
    if (!studentKey) return
    setIntakeBusy(true)
    setErr(null)
    try {
      const res = await studentApiFetch(`/api/student/recommendations/${requestId}/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentDatabaseId: studentKey, action: "reset" }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || "Could not go back")
      setManualLetterText("")
      await load(studentKey)
      if (typeof document !== "undefined") {
        document.getElementById("rec-section-questionnaire")?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed")
    } finally {
      setIntakeBusy(false)
    }
  }

  async function finalizeGuidedQuestionnaireFlow() {
    if (!studentKey) return
    setBusy(true)
    setErr(null)
    try {
      setContentSource("ai_guided")
      await saveQuestionnaireAnswers("ai_guided")
      const allow = settings?.allow_ai_generation !== false
      if (allow) {
        setWorkspacePreparing(true)
        await new Promise((r) => setTimeout(r, 450))
      }
      if (allow) {
        await fetchGenerateAiDraftsCore()
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed")
    } finally {
      setWorkspacePreparing(false)
      setBusy(false)
    }
  }

  async function fetchGenerateAiDraftsCore() {
    if (!studentKey) throw new Error("Missing session")
    const res = await studentApiFetch(`/api/student/recommendations/${requestId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentDatabaseId: studentKey }),
    })
    const j = await res.json()
    if (!res.ok) throw new Error(j.error || "Generation failed")
    setData((prev) =>
      prev
        ? { ...prev, drafts: j.drafts, request: { ...(prev.request as object), status: "ai_generated" } }
        : prev,
    )
    await load(studentKey)
    if (typeof document !== "undefined") {
      setTimeout(() => {
        document.getElementById("rec-section-drafts")?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 80)
    }
  }

  async function runGenerate() {
    if (!studentKey) return
    setBusy(true)
    setErr(null)
    try {
      await fetchGenerateAiDraftsCore()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed")
    } finally {
      setBusy(false)
    }
  }

  async function selectDraft(id: number) {
    if (!studentKey) return
    setBusy(true)
    setErr(null)
    try {
      const res = await studentApiFetch(`/api/student/recommendations/${requestId}/select-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentDatabaseId: studentKey, draftId: id }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || "Select failed")
      await load(studentKey)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed")
    } finally {
      setBusy(false)
    }
  }

  async function runPolish() {
    if (!studentKey) return
    setBusy(true)
    setErr(null)
    try {
      const res = await studentApiFetch(`/api/student/recommendations/${requestId}/polish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentDatabaseId: studentKey, instruction: polishNote }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || "Polish failed")
      await load(studentKey)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed")
    } finally {
      setBusy(false)
    }
  }

  async function submitManualLetter() {
    if (!studentKey) return
    const text = manualLetterText.trim()
    if (!text) {
      setErr("Write or paste your letter before submitting.")
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const res = await studentApiFetch(`/api/student/recommendations/${requestId}/submit-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentDatabaseId: studentKey, letterText: text }),
      })
      const j = (await res.json()) as { error?: string; status?: string }
      if (!res.ok) throw new Error(j.error || "Submit failed")
      setManualLetterText("")
      await load(studentKey)
      if (j.status === "finalized") {
        setManualLetterSentKind("finalized")
      } else if (j.status === "student_selected") {
        setManualLetterSentKind("awaiting_instructor")
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed")
    } finally {
      setBusy(false)
    }
  }

  async function downloadPdf() {
    if (!studentKey) return
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch(
        `/api/student/recommendations/${requestId}/pdf?studentDatabaseId=${encodeURIComponent(studentKey)}`,
        { cache: "no-store" },
      )
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || "Download failed")
      }
      const buf = await res.arrayBuffer()
      if (buf.byteLength === 0) {
        throw new Error("Empty PDF file — try again shortly.")
      }
      const head = String.fromCharCode(...new Uint8Array(buf.slice(0, Math.min(8, buf.byteLength))))
      if (!head.startsWith("%PDF")) {
        throw new Error("Download did not return a valid PDF. Try again or contact support.")
      }
      const blob = new Blob([buf], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `recommendation-${requestId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      await studentApiFetch(`/api/student/recommendations/${requestId}/mark-downloaded`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentDatabaseId: studentKey }),
      })
      await load(studentKey)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed")
    } finally {
      setBusy(false)
    }
  }

  const tierNote = useMemo(() => {
    if (tier === "Trailblazer") return "Trailblazer: AI polish and multiple generation batches (within instructor limits)."
    if (tier === "Explorer") return "Explorer: one AI draft generation per request."
    return "Scholar: you may submit requests; AI drafts only if your instructor enables them (limited)."
  }, [tier])

  if (!studentKey)
    return (
      <p className="text-red-600 dark:text-red-400 text-sm px-1 max-w-prose">
        {isGuestRecommendation
          ? "Sign in with your Career Member account to view this recommendation."
          : "Log in as a student."}
      </p>
    )
  if (!data || !req) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 rounded-full border-2 border-[var(--border)] border-t-[var(--cc-accent)] animate-spin" aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  const hasProfile = Boolean(data.profile)
  const needsIntakeChoice = canProfile && !hasProfile && letterIntakeMode === ""
  const showQuestionnaireWizard = canProfile && !hasProfile && letterIntakeMode === "questionnaire_ai"
  const courseCode = String(req.course_code ?? "")
  const courseDescription = String(req.course_description ?? "")
  const instructorName = String(req.instructor_name ?? "—")
  const deadlineDisp = formatUsDate(req.deadline != null ? String(req.deadline) : null)
  const createdDisp = formatUsDate(req.created_at != null ? String(req.created_at) : null)
  const purposeStr = letterPurposeLineDisplay(
    String(req.purpose ?? ""),
    typeof req.purpose_other_detail === "string" ? req.purpose_other_detail : null,
  )
  const letterSpecific = Boolean(req.letter_is_specific)
  const recipientName = req.recipient_name ? String(req.recipient_name).trim() : ""
  const recipientOrg = req.recipient_organization ? String(req.recipient_organization).trim() : ""
  const recipientAddr =
    typeof req.recipient_address === "string" ? String(req.recipient_address).trim() : ""
  const studentContext = String(req.student_request_description ?? "").trim()
  const canWithdrawStudent =
    status === "requested" ||
    status === "info_requested" ||
    (status === "approved" && drafts.length === 0)

  const insetCard =
    "rounded-2xl border border-[var(--border)] bg-white/60 dark:bg-white/[0.03] p-4 sm:p-5"

  const recommendationProgressProps = {
    steps: progressSteps,
    tierNote,
    listKey: status,
    runwayCaption: runwayJourney?.subline ?? null,
    runwayDots: runwayJourney?.runway ?? null,
    hideRunwayStripe: showInstructorLaneWorkspace,
    pdfReadyBanner: showDownload
      ? {
          downloadedOnce: status === "downloaded",
          onDownload: () => {
            void downloadPdf()
          },
          downloadBusy: busy,
        }
      : null,
  }

  const twoCol = showDownload
    ? "xl:grid-cols-[minmax(0,3.75fr)_minmax(0,8.25fr)]"
    : "xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "w-full min-w-0 mx-auto space-y-4 sm:space-y-5",
        isGuestRecommendation
          ? "max-w-full overflow-x-hidden"
          : "max-w-[min(100%,88rem)] overflow-x-hidden",
      )}
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-start gap-2 gap-y-2">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--cc-text)] shrink-0">
              Request #{requestId}
            </h1>
            <span
              className="text-[10px] sm:text-xs uppercase tracking-wide px-2 py-0.5 rounded-md bg-[var(--muted)] text-[var(--cc-text)] shrink-0 max-w-[min(100%,20rem)] truncate"
              title={status.replace(/_/g, " ")}
            >
              {status.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[var(--cc-text-muted)] max-w-2xl leading-snug">
            {useDraftLetterWorkspace ? (
              <>
                You&apos;re drafting on your instructor&apos;s official letter template — edits on the left, live preview on
                the right. Submit when you&apos;re ready for their review.
              </>
            ) : (
              <>
                Your instructor only needs to act when you first request the letter and once more to approve the final
                draft before you download the PDF.
              </>
            )}
          </p>
        </div>
        <div className="flex flex-row flex-wrap items-center justify-end gap-2 w-full sm:w-auto shrink-0">
          {canWithdrawStudent ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-red-200 text-red-800 hover:bg-red-50 dark:border-red-900 dark:text-red-200 dark:hover:bg-red-950/40 w-full sm:w-auto"
              onClick={() => setWithdrawOpen(true)}
            >
              Withdraw request
            </Button>
          ) : null}
          <Link
            href={BASE}
            className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-[var(--cc-accent-dark)] hover:underline whitespace-nowrap rounded-xl border border-[var(--border)] px-3 py-2 bg-[var(--card)]/70 w-full sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            All requests
          </Link>
        </div>
      </header>

      {err && (
        <p className="text-sm text-red-600 dark:text-red-400 rounded-xl border border-red-200/80 dark:border-red-900/40 bg-red-50/90 dark:bg-red-950/25 px-4 py-3" role="alert">
          {err}
        </p>
      )}

      {req?.status === "rejected" && (
        <div
          className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4 sm:p-5 text-red-950 dark:text-red-100 space-y-2"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-semibold">This request was declined</p>
          {String(req.rejection_reason ?? "").trim() ? (
            <div className="rounded-lg border border-red-200/80 bg-white/60 dark:border-red-900/40 dark:bg-red-950/50 px-3 py-2.5 text-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-red-800/80 dark:text-red-300/90">
                Message from your instructor
              </p>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-red-950 dark:text-red-100">
                {String(req.rejection_reason).trim()}
              </p>
            </div>
          ) : (
            <p className="text-sm text-red-800/90 dark:text-red-200/90">
              Your instructor did not leave a written note. If this surprises you, reach out to them directly.
            </p>
          )}
        </div>
      )}

      {req?.status === "info_requested" && req.info_request_note && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-950 dark:text-amber-100">
          <strong>Instructor note:</strong> {String(req.info_request_note)}
        </div>
      )}

      {req?.status === "revision_requested" && req.info_request_note && (
        <div
          className="rounded-2xl border border-rose-200 dark:border-rose-900/45 bg-rose-50 dark:bg-rose-950/25 p-4 sm:p-5 text-sm text-rose-950 dark:text-rose-50 space-y-2"
          role="status"
        >
          <p className="font-semibold">Your instructor asked for changes before final approval</p>
          <p className="whitespace-pre-wrap leading-relaxed">{String(req.info_request_note)}</p>
          <p className="text-xs text-rose-900/90 dark:text-rose-200/90">
            Update your request details if needed, revise your letter body, then submit again for review. You’ll get a
            notification when the instructor takes the next step.
          </p>
        </div>
      )}

      <div
        className={cn(
          !useDraftLetterWorkspace && "grid grid-cols-1",
          !useDraftLetterWorkspace && twoCol,
          "gap-4 sm:gap-5 lg:gap-6 xl:gap-8 xl:items-start",
        )}
      >
        {!useDraftLetterWorkspace ? (
        <aside className="flex flex-col gap-4 min-w-0 xl:sticky xl:top-6 xl:self-start">
          <CardWrapper delay={0} hover={false} className="p-4 sm:p-5 flex flex-col flex-1 min-h-0 scroll-mt-24" id="rec-summary">
            <h2 className="font-semibold text-sm sm:text-base text-[var(--cc-text)] mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--cc-accent-dark)] shrink-0" aria-hidden />
              Request summary
            </h2>
            <div className="space-y-4">
              <SummaryRow icon={BookOpen} label="Purpose" value={purposeStr} />
              <SummaryRow
                icon={Building2}
                label="Course"
                value={
                  <span>
                    {courseCode || "—"}
                    {courseDescription ? (
                      <span className="block text-[var(--cc-text-muted)] text-xs sm:text-sm mt-0.5 font-normal">
                        {courseDescription}
                      </span>
                    ) : null}
                  </span>
                }
              />
              <SummaryRow icon={UserRound} label="Instructor" value={instructorName} />
              <SummaryRow
                icon={CalendarDays}
                label="Deadline"
                value={deadlineDisp ?? "Not set"}
              />
              <SummaryRow
                icon={FileText}
                label="Recipient"
                value={
                  letterSpecific ? (
                    <span>
                      {[recipientName, recipientOrg].filter(Boolean).join(" · ") || "—"}
                      {recipientAddr ? (
                        <span className="block mt-2 text-[13px] text-[var(--cc-text)] whitespace-pre-wrap leading-snug">
                          {recipientAddr}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-[var(--cc-text-muted)]">General letter (not addressed to a specific reader)</span>
                  )
                }
              />
              {studentContext ? (
                <SummaryRow
                  icon={MessageSquare}
                  label="Your note to the instructor"
                  value={<span className="whitespace-pre-wrap">{studentContext}</span>}
                />
              ) : null}
              {createdDisp ? (
                <SummaryRow icon={CalendarDays} label="Submitted" value={createdDisp} />
              ) : null}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2.5 flex flex-wrap items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-amber-600/90 dark:text-amber-400/90 shrink-0" aria-hidden />
                <span className="text-xs text-[var(--cc-text)]">
                  {settings?.allow_ai_generation !== false
                    ? "AI drafts are enabled for this instructor."
                    : "AI drafts are off — you'll write your letter on this page, then your instructor approves it before download."}
                </span>
              </div>
            </div>
            {attachments.length > 0 ? (
              <div className="mt-5 pt-4 border-t border-[var(--border)]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)] mb-2 flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" aria-hidden />
                  Files on this request
                </p>
                <ul className="space-y-1.5">
                  {attachments.map((a, i) => (
                    <li
                      key={a.id ?? i}
                      className="text-xs text-[var(--cc-text)] truncate"
                      title={a.file_name ?? undefined}
                    >
                      <span className="font-medium capitalize text-[var(--cc-accent-dark)]">
                        {a.file_type ?? "file"}
                      </span>
                      {a.file_name ? ` · ${a.file_name}` : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardWrapper>

          {status !== "rejected" && studentKey ? (
            <StudentRequestDetailsEditor
              requestId={requestId}
              studentKey={studentKey}
              req={req}
              settings={settings}
              onSaved={async () => {
                await load(studentKey)
              }}
            />
          ) : null}

          {!showDownload ? (
            <RecommendationRequestProgress {...recommendationProgressProps} />
          ) : null}
        </aside>
        ) : null}

        <main className="flex flex-col gap-4 min-w-0 w-full scroll-mt-28" id="rec-main-workspace">
          {showDownload && !useDraftLetterWorkspace ? (
            <div className="min-w-0 order-first">
              <RecommendationRequestProgress {...recommendationProgressProps} />
            </div>
          ) : null}
          {useDraftLetterWorkspace ? (
            <RecommendationDraftWorkspace
              requestId={requestId}
              req={req as Record<string, unknown>}
              settings={settings as Record<string, unknown> | undefined}
              manualLetterText={manualLetterText}
              onManualLetterTextChange={setManualLetterText}
              studentKey={studentKey}
              onLetterMetaSaved={async () => {
                if (studentKey) await load(studentKey)
              }}
              busy={busy}
              intakeBusy={intakeBusy}
              onSubmit={() => void submitManualLetter()}
              onResetIntake={() => void resetLetterIntake()}
              showBackToOptions={letterIntakeMode === "bring_own_draft" && drafts.length === 0}
              requireFinalReview={settings?.require_final_review !== false}
            />
          ) : null}
          {canProfile && (needsIntakeChoice || showQuestionnaireWizard) && (
            <CardWrapper delay={0} hover={false} className="p-4 sm:p-6 scroll-mt-28" id="rec-section-questionnaire">
              {needsIntakeChoice ? (
              <LetterIntakeChoice
                allowAi={settings?.allow_ai_generation !== false}
                busy={intakeBusy}
                onChoose={(m) => void postLetterIntake(m)}
              />
              ) : null}
              {showQuestionnaireWizard ? (
              <LetterQuestionnaireWizard
                fields={{
                  studentStrengths: fields.studentStrengths,
                  achievements: fields.achievements,
                  projects: fields.projects,
                  skills: fields.skills,
                  leadershipExamples: fields.leadershipExamples,
                  goals: fields.goals,
                  specialInstructions: fields.specialInstructions,
                  letterFor: fields.letterFor,
                  classExperience: fields.classExperience,
                  personalQualities: fields.personalQualities,
                }}
                patchFields={(partial) =>
                  setFields((p) => ({
                    ...p,
                    ...partial,
                  }))
                }
                tone={tone}
                setTone={setTone}
                requireResume={Boolean(settings?.require_resume)}
                requireTranscript={Boolean(settings?.require_transcript)}
                busy={busy || workspacePreparing}
                allowAiAfter={settings?.allow_ai_generation !== false}
                onFinish={() => void finalizeGuidedQuestionnaireFlow()}
                onBackToChoices={() => void resetLetterIntake()}
                choicesBusy={intakeBusy}
              />
              ) : null}
            </CardWrapper>
          )}

          {showBrief && studentKey ? (
            <RecommendationBriefPanel
              requestId={requestId}
              studentKey={studentKey}
              disabled={busy}
              onGenerated={() => studentKey && void load(studentKey)}
            />
          ) : null}

          {showCompletedWithoutDownload ? (
            <CardWrapper
              delay={0.02}
              hover={false}
              className="p-4 sm:p-6 scroll-mt-28 border-emerald-200/80 dark:border-emerald-500/25"
              id="rec-section-completed"
            >
              <div className="flex gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden />
                <div className="space-y-1 min-w-0">
                  <h2 className="font-semibold text-base text-[var(--cc-text)]">
                    {studentDeliveryStatusLabel(deliveryMethod, status)}
                  </h2>
                  <p className="text-sm text-[var(--cc-text-muted)] leading-relaxed">
                    {deliveryMethod === "confidential"
                      ? "Your instructor finalized a confidential letter. You will not receive the letter text or PDF in CourseCollab."
                      : deliveryMethod === "faculty_submits"
                        ? "Your instructor submitted this recommendation outside the app. Track status here — no download is available."
                        : deliveryMethod === "designated_recipient"
                          ? "Your instructor sent the letter to the designated recipient. You can confirm completion here without accessing the letter."
                          : "This request is complete."}
                  </p>
                </div>
              </div>
            </CardWrapper>
          ) : null}

      {showInstructorLaneWorkspace ? (
        <CardWrapper
          delay={0}
          hover={false}
          className="border-[var(--cc-accent-border)] dark:border-[var(--cc-accent-border)] bg-[var(--card)] p-0 overflow-hidden scroll-mt-28 shadow-[0_8px_32px_-8px_rgba(88,44,131,0.18)] dark:shadow-[0_14px_50px_-12px_rgba(0,0,0,0.55)]"
          id="rec-section-instructor-lane"
        >
          <div className="p-4 sm:p-6 md:p-8 lg:p-10">
            <RecommendationInstructorLaneHero
              mode={status === "student_selected" ? "student_selected" : "instructor_polishing"}
            />
          </div>
        </CardWrapper>
      ) : null}

      {showGenerate && (
        <CardWrapper
          delay={0.03}
          hover={false}
          className="p-4 sm:p-6 space-y-2 scroll-mt-28"
          id="rec-section-generate"
        >
          <h2 className="font-semibold text-base sm:text-lg flex items-center gap-2 text-[var(--cc-text)]">
            <Sparkles className="h-5 w-5 text-[var(--cc-accent-dark)] shrink-0" />
            Generate AI drafts
          </h2>
          <p className="text-xs text-[var(--cc-text-muted)]">
            Three short drafts based on your responses and instructor settings.
          </p>
          <Button type="button" onClick={runGenerate} disabled={busy} className="rounded-xl w-full sm:w-auto">
            Generate three versions
          </Button>
        </CardWrapper>
      )}

      {showManualCompose && !useDraftLetterWorkspace && (
        <CardWrapper
          delay={0.035}
          hover={false}
          className="p-4 sm:p-6 space-y-3 scroll-mt-28"
          id="rec-section-manual-letter"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <h2 className="font-semibold text-base sm:text-lg flex items-center gap-2 text-[var(--cc-text)]">
              <FileText className="h-5 w-5 text-[var(--cc-accent-dark)] shrink-0" aria-hidden />
              Your letter draft
            </h2>
            {letterIntakeMode === "bring_own_draft" && drafts.length === 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-xl shrink-0 -mt-1 sm:mt-0 text-[var(--cc-text-muted)] hover:text-[var(--cc-accent-dark)] dark:hover:text-[var(--cc-accent-dark)]"
                disabled={intakeBusy || busy}
                onClick={() => void resetLetterIntake()}
              >
                Back to options
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-[var(--cc-text-muted)] leading-relaxed">
            Write or paste the full letter body (salutation through closing). Letterhead and signature blocks are added on the final PDF. When you&apos;re ready,
            send it to your instructor — they approve it once, then you can download.
          </p>
          <Textarea
            className={cn(
              "rounded-xl border-[var(--border)] bg-white bg-[var(--card)]/45 text-[var(--cc-text)] min-h-[220px] text-sm leading-relaxed",
              letterIntakeMode === "bring_own_draft" &&
                "min-h-[min(420px,56vh)] shadow-[inset_0_1px_0_0_rgba(148,163,184,0.12)] font-serif text-[15px] sm:text-base tracking-[0.01em]",
            )}
            value={manualLetterText}
            onChange={(e) => setManualLetterText(e.target.value)}
            placeholder="Dear Selection Committee,&#10;&#10;I am pleased to recommend…"
            disabled={busy}
          />
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <Button
              type="button"
              onClick={() => void submitManualLetter()}
              disabled={busy}
              className="rounded-xl w-full sm:w-auto bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] text-white"
            >
              Send to instructor for approval
            </Button>
            {settings?.require_final_review === false ? (
              <p className="text-[11px] sm:text-xs text-[var(--cc-text-muted)]">
                Your instructor does not require a final review on file — submitting may finalize the letter immediately so you can download.
              </p>
            ) : (
              <p className="text-[11px] sm:text-xs text-[var(--cc-text-muted)]">
                Your instructor will review and approve before download unlocks.
              </p>
            )}
          </div>
        </CardWrapper>
      )}

      {status === "requested" && (
        <CardWrapper
          delay={0}
          hover={false}
          className="relative overflow-hidden p-4 sm:p-6 flex-1 border-dashed border-[var(--cc-accent-border)] dark:border-[var(--cc-accent-border)] scroll-mt-28"
          id="rec-section-waiting"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-60 rounded-[inherit]"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 80% 0%, rgba(88,44,131,0.07), transparent 55%)",
            }}
          />
          <div className="relative space-y-3">
            <h2 className="font-semibold text-base text-[var(--cc-text)]">Waiting on your instructor</h2>
            <p className="text-sm text-[var(--cc-text-muted)] leading-relaxed max-w-prose">
              This request is in their queue. They may approve it, ask for more information, or suggest edits. Check
              back here — when the status changes, your next steps will show in the progress column.
            </p>
            <ul className="text-xs sm:text-sm text-[var(--cc-text-muted)] space-y-2 list-disc pl-4">
              <li>Course, instructor, and deadline stay visible in the summary panel.</li>
              <li>
                You will complete the questionnaire here after they approve the request or ask for more information.
              </li>
            </ul>
          </div>
        </CardWrapper>
      )}

      {showCompare && (
        <CardWrapper
          delay={0.04}
          hover={false}
          className="p-4 sm:p-6 space-y-3 min-w-0 scroll-mt-28"
          id="rec-section-drafts"
        >
          <h2 className="font-semibold text-base sm:text-lg text-[var(--cc-text)]">Compare drafts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {drafts.map((d) => (
              <div key={String(d.id)} className={`min-w-0 ${insetCard} flex flex-col`}>
                <h3 className="text-xs sm:text-sm font-medium text-[var(--cc-accent-dark)] mb-2 line-clamp-2">
                  {String(d.version_label)}
                </h3>
                <div className="text-[11px] sm:text-xs text-[var(--cc-text)] whitespace-pre-wrap max-h-[min(45vh,240px)] min-h-[120px] overflow-y-auto flex-1 border border-[var(--border)] rounded-xl p-2 bg-[var(--muted)]">
                  {String(d.letter_text ?? "")}
                </div>
                <Button
                  className="mt-3 rounded-xl w-full"
                  variant="secondary"
                  size="sm"
                  onClick={() => selectDraft(Number(d.id))}
                  disabled={busy}
                >
                  Use this version
                </Button>
              </div>
            ))}
          </div>

          {tier === "Trailblazer" && settings?.allow_ai_polish !== false && (
            <div
              className={`${insetCard} border-dashed space-y-2 [&_label]:text-[var(--cc-text)]`}
            >
              <Label>Minor AI polish (Trailblazer)</Label>
              <Textarea
                className="rounded-xl border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)]"
                value={polishNote}
                onChange={(e) => setPolishNote(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={runPolish} disabled={busy}>
                Polish selected letter
              </Button>
            </div>
          )}
        </CardWrapper>
      )}

        </main>
      </div>

      <AlertDialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw this request?</AlertDialogTitle>
            <AlertDialogDescription>
              Your instructor will no longer see it, and you'll need to submit a new request if you change your mind.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={withdrawBusy}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              disabled={withdrawBusy}
              onClick={async () => {
                if (!studentKey) return
                setWithdrawBusy(true)
                setErr(null)
                try {
                  const res = await fetch(
                    `/api/student/recommendations/${requestId}?studentDatabaseId=${encodeURIComponent(studentKey)}`,
                    { method: "DELETE" },
                  )
                  const j = await res.json()
                  if (!res.ok) throw new Error(j.error || "Failed")
                  setWithdrawOpen(false)
                  router.push(BASE)
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Failed to withdraw")
                } finally {
                  setWithdrawBusy(false)
                }
              }}
            >
              {withdrawBusy ? "Withdrawing…" : "Withdraw"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={manualLetterSentKind !== null}
        onOpenChange={(open) => {
          if (!open) setManualLetterSentKind(null)
        }}
      >
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {manualLetterSentKind === "finalized" ? "Your letter is on file" : "Sent for instructor approval"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <span className="block text-sm text-[var(--cc-text-muted)] leading-relaxed">
                {manualLetterSentKind === "finalized" ? (
                  <>
                    Your instructor doesn&apos;t require a separate approval step after you submit — the recommendation
                    is ready. Download the official PDF from this page whenever you need it.
                  </>
                ) : (
                  <>
                    Your letter has been submitted to{" "}
                    <span className="font-medium text-[var(--cc-text)]">{instructorName}</span>.
                    They&apos;ll review it when ready. Stay on this page to see status updates — you&apos;ll be able to
                    download the PDF after they finalize it.
                  </>
                )}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              className="rounded-xl bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] text-white"
              onClick={() => setManualLetterSentKind(null)}
            >
              OK
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {workspacePreparing ? (
        <motion.div
          aria-live="polite"
          aria-busy="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-5 bg-[var(--background)]/75 backdrop-blur-sm px-6 text-center pointer-events-auto"
        >
          <div className="h-12 w-12 rounded-full border-2 border-white/15 border-t-emerald-400 animate-spin" aria-hidden />
          <div className="space-y-2 max-w-sm">
            <p className="text-sm font-semibold text-white">Preparing your drafts</p>
            <p className="text-xs text-[var(--cc-text-muted)] leading-relaxed">
              Turning your answers into letter drafts for you to review — this usually takes a few seconds.
            </p>
          </div>
        </motion.div>
      ) : null}
    </motion.div>
  )
}
