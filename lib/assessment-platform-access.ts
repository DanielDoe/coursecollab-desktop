export const ASSESSMENT_PLATFORM_IDS = ["web", "mobile", "desktop"] as const
export type AssessmentPlatformId = (typeof ASSESSMENT_PLATFORM_IDS)[number]

export const ASSESSMENT_PLATFORM_KINDS = ["quiz", "homework", "mid_semester", "final"] as const
export type AssessmentPlatformKind = (typeof ASSESSMENT_PLATFORM_KINDS)[number]

export type AssessmentPlatformFlags = Record<AssessmentPlatformId, boolean>
export type AssessmentPlatformAccess = Record<AssessmentPlatformKind, AssessmentPlatformFlags>

export const DEFAULT_ASSESSMENT_PLATFORM_ACCESS: AssessmentPlatformAccess = {
  quiz: { web: true, mobile: true, desktop: true },
  homework: { web: true, mobile: true, desktop: true },
  mid_semester: { web: true, mobile: true, desktop: true },
  final: { web: true, mobile: true, desktop: true },
}

const KIND_ALIASES: Record<string, AssessmentPlatformKind> = {
  quiz: "quiz",
  quizzes: "quiz",
  homework: "homework",
  mid_semester: "mid_semester",
  midsem: "mid_semester",
  midterm: "mid_semester",
  "mid-semester": "mid_semester",
  final: "final",
  finals: "final",
}

export function resolveAssessmentPlatformKind(raw: string | undefined | null): AssessmentPlatformKind {
  const key = String(raw ?? "quiz")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
  return KIND_ALIASES[key] ?? "quiz"
}

function parseBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value
  if (value === 0 || value === "0" || value === "false") return false
  if (value === 1 || value === "1" || value === "true") return true
  return fallback
}

function parseFlags(raw: unknown, fallback: AssessmentPlatformFlags): AssessmentPlatformFlags {
  if (!raw || typeof raw !== "object") return { ...fallback }
  const o = raw as Record<string, unknown>
  return {
    web: parseBool(o.web, fallback.web),
    mobile: parseBool(o.mobile ?? o.app ?? o.native, fallback.mobile),
    desktop: parseBool(o.desktop, fallback.desktop),
  }
}

export const DEFAULT_ASSESSMENT_PLATFORM_FLAGS: AssessmentPlatformFlags = {
  web: true,
  mobile: true,
  desktop: true,
}

export function parseAssessmentPlatformAccess(raw: unknown): AssessmentPlatformAccess {
  const base: AssessmentPlatformAccess = {
    quiz: { ...DEFAULT_ASSESSMENT_PLATFORM_ACCESS.quiz },
    homework: { ...DEFAULT_ASSESSMENT_PLATFORM_ACCESS.homework },
    mid_semester: { ...DEFAULT_ASSESSMENT_PLATFORM_ACCESS.mid_semester },
    final: { ...DEFAULT_ASSESSMENT_PLATFORM_ACCESS.final },
  }
  if (!raw || typeof raw !== "object") return base
  const o = raw as Record<string, unknown>
  return {
    quiz: parseFlags(o.quiz ?? o.quizzes, base.quiz),
    homework: parseFlags(o.homework, base.homework),
    mid_semester: parseFlags(o.mid_semester ?? o.midsem ?? o.midterm, base.mid_semester),
    final: parseFlags(o.final ?? o.finals, base.final),
  }
}

/** `null` means inherit the course default for this assessment's type. */
export function parseAssessmentPlatformOverride(raw: unknown): AssessmentPlatformFlags | null {
  if (raw == null) return null
  if (typeof raw === "string") {
    const s = raw.trim()
    if (!s || s === "null" || s === "inherit") return null
    try {
      return parseAssessmentPlatformOverride(JSON.parse(s) as unknown)
    } catch {
      return null
    }
  }
  if (typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  if (o.inherit === true || o.mode === "inherit" || o.use_course_default === true) return null
  const hasFlag =
    o.web != null || o.mobile != null || o.desktop != null || o.app != null || o.native != null
  if (!hasFlag) return null
  return parseFlags(o, DEFAULT_ASSESSMENT_PLATFORM_FLAGS)
}

export function resolveAssessmentPlatformFlags(
  courseAccess: AssessmentPlatformAccess,
  kind: string | undefined | null,
  override?: unknown,
): AssessmentPlatformFlags {
  const parsed = parseAssessmentPlatformOverride(override)
  if (parsed) return parsed
  return { ...courseAccess[resolveAssessmentPlatformKind(kind)] }
}

export function quizPlatformAccessSqlValue(raw: unknown): string | null {
  const parsed = parseAssessmentPlatformOverride(raw)
  return parsed ? JSON.stringify(parsed) : null
}

export function isAssessmentPlatformAllowed(
  access: AssessmentPlatformAccess,
  kind: string | undefined | null,
  platform: AssessmentPlatformId,
  override?: unknown,
): boolean {
  return resolveAssessmentPlatformFlags(access, kind, override)[platform] !== false
}

export function assessmentPlatformBlockedMessage(
  kind: string | undefined | null,
  platform: AssessmentPlatformId,
): string {
  const resolved = resolveAssessmentPlatformKind(kind)
  const label =
    resolved === "homework"
      ? "homework"
      : resolved === "mid_semester"
        ? "mid-semester exam"
        : resolved === "final"
          ? "final exam"
          : "quiz"
  if (platform === "mobile") {
    return `This ${label} must be taken on the CourseCollab website. The mobile app is turned off for this assessment.`
  }
  if (platform === "desktop") {
    return `This ${label} must be taken on the CourseCollab website. The desktop app is turned off for this assessment.`
  }
  return `This ${label} cannot be taken in the browser. Use the CourseCollab app your instructor enabled for this assessment.`
}

export const ASSESSMENT_PLATFORM_DISABLED_CODE = "PLATFORM_DISABLED"
