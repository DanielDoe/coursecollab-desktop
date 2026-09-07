/**
 * Unified “runway” model for recommendation requests on the student side.
 * One fixed-length track so badges can show coherent step numbers across multiple instructor gates & revision loops.
 */

export const STUDENT_RECOMMENDATION_RUNWAY_TOTAL = 12

export type StudentJourneyTone =
  | "queue"
  | "pause"
  | "clearance"
  | "workspace"
  | "studio"
  | "orbit"
  | "loop"
  | "vault"
  | "halt"

export type StudentRecommendationJourney = {
  /** 1 … STUDENT_RECOMMENDATION_RUNWAY_TOTAL (halt/rejected maps to tone only) */
  step: number
  total: typeof STUDENT_RECOMMENDATION_RUNWAY_TOTAL
  /** Short pillar, e.g. "Pre-flight" | "Studio" | "Instructor approvals" */
  pillar: string
  /** Badge title */
  headline: string
  /** Second line — step strip + vibe */
  subline: string
  /** Tiny dot strip for badges (filled = ●, rest = ○), length = total */
  runway: string
  tone: StudentJourneyTone
  /** Accessible description */
  ariaLabel: string
}

function runwayDots(step: number, total = STUDENT_RECOMMENDATION_RUNWAY_TOTAL): string {
  const clamped = Math.min(Math.max(step, 0), total)
  return Array.from({ length: total }, (_, i) => (i < clamped ? "●" : "○")).join("")
}

/** Public entry — list page may omit profile / intake when unknown */
export function getStudentRecommendationJourney(args: {
  status: string
  /** Saves questionnaire answers */
  hasQuestionnaireProfile?: boolean
  letterIntakeMode?: string | null
  aiDraftCount?: number
}): StudentRecommendationJourney {
  const st = String(args.status ?? "").trim()
  const hasQ = Boolean(args.hasQuestionnaireProfile)
  const intakeRaw = typeof args.letterIntakeMode === "string" ? args.letterIntakeMode.trim() : ""
  const drafts = Math.max(0, Number(args.aiDraftCount) || 0)

  let step = 4
  let pillar = "Workspace"
  let headline = "In progress"
  let subline = ""
  let tone: StudentJourneyTone = "workspace"

  if (st === "rejected") {
    const j: StudentRecommendationJourney = {
      step: 0,
      total: STUDENT_RECOMMENDATION_RUNWAY_TOTAL,
      pillar: "Closed",
      headline: "Request closed",
      subline: "This recommendation will not proceed.",
      runway: runwayDots(1),
      tone: "halt",
      ariaLabel: "Request closed.",
    }
    return j
  }

  if (st === "requested") {
    step = 1
    pillar = "Pre-flight"
    headline = "Instructor queue"
    subline = "Step 1 of 12 · Waiting for first approval"
    tone = "queue"
    return finalize(step, pillar, headline, subline, tone)
  }

  if (st === "info_requested") {
    step = 3
    pillar = "Pre-flight pause"
    headline = "Details requested"
    subline = "Step 3 of 12 · Your instructor paused the flow until you reply"
    tone = "pause"
    return finalize(step, pillar, headline, subline, tone)
  }

  if (st === "approved") {
    if (!hasQ) {
      step = 4
      pillar = "Clearance"
      headline = "Cleared · Questionnaire next"
      subline = "Step 4 of 12 · First instructor OK — finish your questionnaire"
      tone = "clearance"
      return finalize(step, pillar, headline, subline, tone)
    }
    if (!intakeRaw) {
      step = 5
      pillar = "Workspace boot"
      headline = "Choose your lane"
      subline = "Step 5 of 12 · Bring-your-own-draft vs guided prompts"
      tone = "workspace"
      return finalize(step, pillar, headline, subline, tone)
    }
    step = 6
    pillar = "Letter studio"
    headline = drafts > 0 ? "Drafts in play" : "Draft your letter"
    subline =
      drafts > 0
        ? "Step 6 of 12 · AI batches or your text — iterate before submitting"
        : "Step 6 of 12 · Compose the body — letterhead attaches on export"
    tone = "studio"
    return finalize(step, pillar, headline, subline, tone)
  }

  if (st === "student_form_pending") {
    step = 4
    pillar = "Intake"
    headline = "Wrapping questionnaire"
    subline = "Step 4 of 12 · Saving your structured answers"
    tone = "clearance"
    return finalize(step, pillar, headline, subline, tone)
  }

  if (st === "ai_generated") {
    step = 7
    pillar = "Letter studio"
    headline = "Compare AI drafts"
    subline = "Step 7 of 12 · Pick a spine, then ship for instructor review"
    tone = "studio"
    return finalize(step, pillar, headline, subline, tone)
  }

  if (st === "student_selected") {
    step = 8
    pillar = "Instructor approvals"
    headline = "Letter with instructor"
    subline = "Step 8 of 12 · Active lane · Awaiting instructor review / sign-off"
    tone = "orbit"
    return finalize(step, pillar, headline, subline, tone)
  }

  if (st === "instructor_review_pending") {
    step = 9
    pillar = "Instructor approvals"
    headline = "Instructor polishing"
    subline =
      "Step 9 of 12 · Active lane · Possible extra editing before they release the PDF"
    tone = "orbit"
    return finalize(step, pillar, headline, subline, tone)
  }

  if (st === "revision_requested") {
    step = 10
    pillar = "Instructor approvals · loop"
    headline = "Revisions requested"
    subline =
      "Step 10 of 12 · Active lane may repeat · Fix & resubmit for another instructor pass"
    tone = "loop"
    return finalize(step, pillar, headline, subline, tone)
  }

  if (st === "finalized") {
    step = 11
    pillar = "Finish line"
    headline = "Ready to download"
    subline = "Step 11 of 12 · PDF unlocked — snag it when needed"
    tone = "vault"
    return finalize(step, pillar, headline, subline, tone)
  }

  if (st === "downloaded") {
    step = 12
    pillar = "Complete"
    headline = "Delivered"
    subline = "Step 12 of 12 · You’ve pulled an official PDF"
    tone = "vault"
    return finalize(step, pillar, headline, subline, tone)
  }

  step = 4
  pillar = "In progress"
  headline = st.replace(/_/g, " ") || "Updating"
  subline = `Step ${step} of 12 · ${headline}`
  tone = "workspace"
  return finalize(step, pillar, headline, subline, tone)

  function finalize(
    s: number,
    p: string,
    h: string,
    sl: string,
    t: StudentJourneyTone,
  ): StudentRecommendationJourney {
    return {
      step: s,
      total: STUDENT_RECOMMENDATION_RUNWAY_TOTAL,
      pillar: p,
      headline: h,
      subline: sl,
      runway: runwayDots(s === 0 ? 0 : s),
      tone: t,
      ariaLabel: `${h}. ${sl}. Progress ${Math.min(s, STUDENT_RECOMMENDATION_RUNWAY_TOTAL)} of ${STUDENT_RECOMMENDATION_RUNWAY_TOTAL}.`,
    }
  }
}

export function toneToBadgeShellClass(tone: StudentJourneyTone): string {
  switch (tone) {
    case "queue":
      return "border-slate-300/90 bg-gradient-to-br from-slate-50 via-white to-slate-50/95 text-slate-800 shadow-sm dark:border-white/14 dark:from-slate-900 dark:via-slate-950 dark:to-black/70 dark:text-slate-100"
    case "pause":
      return "border-sky-300/85 bg-gradient-to-br from-sky-50 via-white to-cyan-50/90 text-sky-950 shadow-sm dark:border-sky-800/55 dark:from-sky-950/50 dark:text-sky-100"
    case "clearance":
      return "border-violet-300/80 bg-gradient-to-br from-violet-50 via-white to-indigo-50/95 text-violet-950 shadow-sm dark:border-violet-800/45 dark:from-violet-950/40 dark:text-violet-100"
    case "workspace":
      return "border-indigo-200/90 bg-gradient-to-br from-indigo-50/95 via-white to-fuchsia-50/40 text-indigo-950 shadow-sm dark:border-indigo-900/35 dark:from-[#2a2140]/95 dark:to-slate-950 dark:text-indigo-100"
    case "studio":
      return "border-fuchsia-300/75 bg-gradient-to-br from-fuchsia-50 via-white to-purple-50/95 text-purple-950 shadow-sm dark:border-fuchsia-900/35 dark:from-purple-950/35 dark:text-fuchsia-100"
    case "orbit":
      return "border-[#582c83]/35 bg-gradient-to-br from-[#faf8fe] via-violet-50/90 to-purple-50/80 text-[#2d1745] shadow-md shadow-[#582c83]/15 dark:border-[#7a4eba]/45 dark:from-[#1e1530]/95 dark:via-[#261c3d]/90 dark:to-black/85 dark:text-[#eae4f9]"
    case "loop":
      return "border-rose-400/80 bg-gradient-to-br from-rose-50 via-white to-orange-50/95 text-rose-950 shadow-md shadow-rose-900/10 dark:border-rose-800/55 dark:from-rose-950/45 dark:to-slate-900 dark:text-rose-50"
    case "vault":
      /* Finished / downloadable — neutral shell so list rows don’t read as bulky “green cards” */
      return "border-slate-200/90 bg-gradient-to-br from-white via-slate-50/75 to-[#582c83]/[0.045] text-slate-900 shadow-sm dark:border-white/[0.12] dark:from-slate-900 dark:via-slate-950 dark:to-[#1a1628]/92 dark:text-slate-100"
    case "halt":
      return "border-red-400/85 bg-gradient-to-br from-red-50 via-white to-orange-50/90 text-red-950 shadow-sm dark:border-red-900/45 dark:from-red-950/55 dark:to-slate-900 dark:text-red-100"
    default:
      return "border-slate-200 bg-white dark:border-white/15 dark:bg-slate-900"
  }
}
