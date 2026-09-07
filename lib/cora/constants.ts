/** Cora = Course + Core — step-by-step problem guide for students. */
export const CORA_NAME = "Cora"
export const CORA_LOGO_LIGHT_SRC = "/assets/cora/cora-mark-light.png"
export const CORA_LOGO_DARK_SRC = "/assets/cora/cora-mark-dark.png"
/** @deprecated Use CORA_LOGO_LIGHT_SRC / CORA_LOGO_DARK_SRC */
export const CORA_LOGO_SRC = CORA_LOGO_LIGHT_SRC
export const CORA_TAGLINE = "Course + Core"
export const CORA_MOTTO = "Don't just get the answer. Learn every step."
export const CORA_SOLVE_LABEL = `✨ Solve with ${CORA_NAME}`
export const CORA_NAV_LABEL = "Cora Assistant"
export const CORA_PLATFORM_TITLE = "Your Personal Learning Intelligence"
export const CORA_PLATFORM_SUBTITLE = "Course + Core — the intelligence layer for everything you learn"
export const CORA_ASK_LABEL = `✨ Ask ${CORA_NAME}`
export const CORA_LEARNING_GOALS_HEADING = "How can I help you today?"
export const CORA_EXPLAIN_LABEL = `✨ Explain with ${CORA_NAME}`
export const CORA_WALKTHROUGH_LABEL = `✨ Walk through with ${CORA_NAME}`
export const CORA_DESCRIPTION =
  "Interactive problem-solving workspace — animated, guided, and aligned with your course materials."

/** Faculty teaching copilot branding (mirrors mobile Faculty Cora). */
export const FACULTY_CORA_NAV_LABEL = "Cora Copilot"
export const FACULTY_CORA_TAGLINE = "Your AI teaching copilot"
export const FACULTY_CORA_GREETING = "What would you like help with today?"
export const FACULTY_CORA_PLATFORM_TITLE = "Cora Teaching Copilot"
export const FACULTY_CORA_PLATFORM_SUBTITLE =
  "Create, improve, analyze, and automate your course — with instructor-safe guardrails"

/** Guest / alumni career copilot branding */
export const GUEST_CORA_NAV_LABEL = "Cora Career Assistant"
/** Compact sidemenu label (group is already "Cora Career"). */
export const GUEST_CORA_SIDEBAR_LABEL = "Cora AI"
export const GUEST_CORA_PLATFORM_TITLE = "Cora Career Copilot"
export const GUEST_CORA_PLATFORM_SUBTITLE =
  "Recommendations, résumés, applications, and interview prep — isolated from course data"

export const GUEST_CORA_CHAT_PLACEHOLDER =
  "Ask Cora about your application, résumé, or recommendation brief…"

export const GUEST_CORA_CHAT_MODES = [
  {
    id: "applications",
    emoji: "📋",
    label: "Applications",
    shortLabel: "Apply",
    tagline: "Résumés, statements, and deadlines",
  },
  {
    id: "resume-match",
    emoji: "🔍",
    label: "Résumé match",
    shortLabel: "Match",
    tagline: "Compare résumé to an opportunity",
  },
  {
    id: "cover-letter",
    emoji: "✉️",
    label: "Cover letter",
    shortLabel: "Cover",
    tagline: "Draft from your résumé + role",
  },
  {
    id: "interviews",
    emoji: "🎯",
    label: "Interview prep",
    shortLabel: "Interview",
    tagline: "Practice questions and feedback",
  },
  {
    id: "recommendations",
    emoji: "📝",
    label: "Recommendations",
    shortLabel: "Letters",
    tagline: "Briefs and faculty coordination",
  },
] as const

export const CORA_WALKTHROUGH_MIN_STEPS = 2
export const CORA_WALKTHROUGH_MAX_STEPS = 12
