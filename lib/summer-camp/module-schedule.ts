export type CampScheduleDay = {
  day: number
  label: string
  dateLabel?: string
}

export type CampModuleScheduleRule = {
  /** Case-insensitive substring matched against module title */
  titleIncludes: string
  schedule_day: number
  schedule_day_sort: number
}

export type CampTrainingScheduleConfig = {
  days: CampScheduleDay[]
  moduleRules: CampModuleScheduleRule[]
}

export type CampModuleScheduleRow = {
  id: number
  title: string
  description: string | null
  sort_order: number
  status: string
  schedule_day: number | null
  schedule_day_sort: number
  is_visible: boolean
  display_number: number | null
  project_id: number
}

export type ModuleScheduleSlot = {
  schedule_day: number
  schedule_day_sort: number
}

/** Default Foundational AI Workshop schedule — seed + faculty "reset" baseline only. */
export const FOUNDATIONAL_AI_DEFAULT_SCHEDULE: CampTrainingScheduleConfig = {
  days: [
    { day: 1, label: "Day 1", dateLabel: "July 27th" },
    { day: 2, label: "Day 2", dateLabel: "July 28th" },
    { day: 3, label: "Day 3", dateLabel: "July 29th" },
    { day: 4, label: "Day 4", dateLabel: "July 30th" },
  ],
  moduleRules: [
    { titleIncludes: "module 0", schedule_day: 1, schedule_day_sort: 0 },
    { titleIncludes: "welcome to the foundational ai", schedule_day: 1, schedule_day_sort: 0 },
    { titleIncludes: "what is artificial intelligence", schedule_day: 1, schedule_day_sort: 1 },
    { titleIncludes: "exploring ai tools", schedule_day: 1, schedule_day_sort: 2 },
    { titleIncludes: "prompt engineering", schedule_day: 1, schedule_day_sort: 3 },
    { titleIncludes: "ai ethics", schedule_day: 2, schedule_day_sort: 0 },
    { titleIncludes: "responsible ai", schedule_day: 2, schedule_day_sort: 0 },
    { titleIncludes: "ai creator studio", schedule_day: 2, schedule_day_sort: 1 },
    { titleIncludes: "ai learning accelerator", schedule_day: 3, schedule_day_sort: 0 },
    { titleIncludes: "ai for academic success", schedule_day: 3, schedule_day_sort: 0 },
    { titleIncludes: "ai career accelerator", schedule_day: 3, schedule_day_sort: 1 },
    { titleIncludes: "career", schedule_day: 3, schedule_day_sort: 1 },
    { titleIncludes: "innovation challenge", schedule_day: 4, schedule_day_sort: 0 },
    { titleIncludes: "graduation showcase", schedule_day: 4, schedule_day_sort: 0 },
    { titleIncludes: "summary, showcase", schedule_day: 4, schedule_day_sort: 1 },
    { titleIncludes: "graduation ceremony", schedule_day: 4, schedule_day_sort: 1 },
  ],
}

/** @deprecated Use FOUNDATIONAL_AI_DEFAULT_SCHEDULE.days */
export const FOUNDATIONAL_AI_WORKSHOP_SCHEDULE_DAYS = FOUNDATIONAL_AI_DEFAULT_SCHEDULE.days

const DEFAULT_SCHEDULE_BY_SLUG: Record<string, CampTrainingScheduleConfig> = {
  "ai-bootcamp": FOUNDATIONAL_AI_DEFAULT_SCHEDULE,
}

export function getDefaultTrainingScheduleConfig(trainingSlug?: string | null): CampTrainingScheduleConfig | null {
  if (!trainingSlug) return null
  return DEFAULT_SCHEDULE_BY_SLUG[trainingSlug] ?? null
}

export function normalizeScheduleDays(raw: unknown): CampScheduleDay[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null
      const day = Number((row as CampScheduleDay).day)
      const label = String((row as CampScheduleDay).label ?? "").trim()
      if (!Number.isFinite(day) || day < 1 || !label) return null
      const dateLabel = (row as CampScheduleDay).dateLabel
      return {
        day,
        label,
        ...(dateLabel ? { dateLabel: String(dateLabel) } : {}),
      }
    })
    .filter((row): row is CampScheduleDay => row != null)
    .sort((a, b) => a.day - b.day)
}

export function normalizeScheduleModuleRules(raw: unknown): CampModuleScheduleRule[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null
      const titleIncludes = String((row as CampModuleScheduleRule).titleIncludes ?? "").trim()
      const schedule_day = Number((row as CampModuleScheduleRule).schedule_day)
      const schedule_day_sort = Number((row as CampModuleScheduleRule).schedule_day_sort ?? 0)
      if (!titleIncludes || !Number.isFinite(schedule_day) || schedule_day < 1) return null
      return {
        titleIncludes: titleIncludes.toLowerCase(),
        schedule_day,
        schedule_day_sort: Number.isFinite(schedule_day_sort) ? schedule_day_sort : 0,
      }
    })
    .filter((row): row is CampModuleScheduleRule => row != null)
}

export function resolveModuleScheduleFromRules(
  title: string,
  rules: CampModuleScheduleRule[],
): ModuleScheduleSlot | null {
  const t = title.toLowerCase()
  const ordered = [...rules].sort((a, b) => b.titleIncludes.length - a.titleIncludes.length)
  for (const rule of ordered) {
    if (t.includes(rule.titleIncludes.toLowerCase())) {
      return { schedule_day: rule.schedule_day, schedule_day_sort: rule.schedule_day_sort }
    }
  }
  return null
}

/** @deprecated Use resolveModuleScheduleFromRules */
export function resolveFoundationalAiModuleSchedule(title: string): ModuleScheduleSlot | null {
  return resolveModuleScheduleFromRules(title, FOUNDATIONAL_AI_DEFAULT_SCHEDULE.moduleRules)
}

/** Stable fragment for persisting faculty assignments as re-seed rules. */
export function scheduleMatchFragment(title: string): string {
  const stripped = title.replace(/^Module\s+\d+(\s*[—–-]|:|\s+)/i, "").trim()
  return stripped.toLowerCase()
}

export function buildScheduleRulesFromModuleAssignments(
  modules: Array<{ title: string; schedule_day: number | null; schedule_day_sort: number }>,
): CampModuleScheduleRule[] {
  const seen = new Set<string>()
  const rules: CampModuleScheduleRule[] = []
  for (const mod of modules) {
    if (mod.schedule_day == null) continue
    const fragment = scheduleMatchFragment(mod.title)
    if (!fragment || seen.has(fragment)) continue
    seen.add(fragment)
    rules.push({
      titleIncludes: fragment,
      schedule_day: mod.schedule_day,
      schedule_day_sort: mod.schedule_day_sort ?? 0,
    })
  }
  return rules
}

export function mergeScheduleConfig(
  existing: Partial<CampTrainingScheduleConfig> | null | undefined,
  defaults: CampTrainingScheduleConfig | null,
): CampTrainingScheduleConfig {
  const days =
    normalizeScheduleDays(existing?.days).length > 0
      ? normalizeScheduleDays(existing?.days)
      : (defaults?.days ?? [])

  const defaultRules = defaults?.moduleRules ?? []
  const existingRules = normalizeScheduleModuleRules(existing?.moduleRules)

  if (existingRules.length === 0) {
    return { days, moduleRules: defaultRules }
  }

  // Union: curriculum defaults always present; faculty/custom rules override by titleIncludes key.
  const merged = new Map<string, CampModuleScheduleRule>()
  for (const rule of defaultRules) {
    merged.set(rule.titleIncludes.toLowerCase(), rule)
  }
  for (const rule of existingRules) {
    merged.set(rule.titleIncludes.toLowerCase(), rule)
  }

  return { days, moduleRules: [...merged.values()] }
}

/** @deprecated IDs change on re-seed — use DB-backed rules instead. */
export const FOUNDATIONAL_AI_MODULE_SCHEDULE: Record<
  number,
  { schedule_day: number; schedule_day_sort: number }
> = {}

export function isCampModuleVisibleToStudents(module: {
  status: string
  is_visible?: boolean | null
}) {
  return module.status === "published" && module.is_visible !== false
}

export function compareCampModulesBySchedule<
  T extends {
    id: number
    sort_order?: number | null
    schedule_day?: number | null
    schedule_day_sort?: number | null
  },
>(a: T, b: T): number {
  const dayA = a.schedule_day ?? 9999
  const dayB = b.schedule_day ?? 9999
  if (dayA !== dayB) return dayA - dayB
  const inDayA = a.schedule_day_sort ?? 0
  const inDayB = b.schedule_day_sort ?? 0
  if (inDayA !== inDayB) return inDayA - inDayB
  const sortA = a.sort_order ?? 0
  const sortB = b.sort_order ?? 0
  if (sortA !== sortB) return sortA - sortB
  return a.id - b.id
}

export function sortCampModulesBySchedule<T extends Parameters<typeof compareCampModulesBySchedule>[0]>(
  modules: T[],
): T[] {
  return [...modules].sort(compareCampModulesBySchedule)
}

export function extractModuleNumberFromTitle(title: string): number | null {
  const match = title.match(/^Module\s+(\d+)/i)
  if (!match) return null
  const n = Number.parseInt(match[1], 10)
  return Number.isFinite(n) ? n : null
}

export function renumberCampModuleTitle(title: string, displayNumber: number): string {
  if (/^Module\s+\d+/i.test(title)) {
    return title.replace(/^Module\s+\d+(\s*[—–-]|:|\s+)/i, `Module ${displayNumber}$1`)
  }
  return title
}

export function campModuleDisplayLabel(module: {
  title: string
  display_number?: number | null
  sort_order?: number | null
}): string {
  const n =
    module.display_number ??
    extractModuleNumberFromTitle(module.title) ??
    module.sort_order ??
    0
  const stripped = module.title.replace(/^Module\s+\d+(\s*[—–-]|:|\s+)/i, "").trim()
  if (!stripped) return module.title
  const sep = module.title.includes("—") ? " — " : module.title.includes(":") ? ": " : " "
  return `Module ${n}${sep}${stripped}`
}
