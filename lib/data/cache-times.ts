import type { CacheTier } from "@/lib/data/types"

/** Starting stale times. Tune from product behavior, not a single global. */
export const CACHE_STALE_MS: Record<CacheTier, number> = {
  realtime: 10_000,
  dynamic: 60_000,
  normal: 10 * 60_000,
  slow: 30 * 60_000,
}

export const CACHE_GC_MS = 30 * 60_000

export const RESOURCE_TIER = {
  liveAssessments: "realtime",
  messages: "realtime",
  playground: "realtime",
  submissions: "realtime",
  notifications: "dynamic",
  announcements: "dynamic",
  officeHours: "dynamic",
  recentActivity: "dynamic",
  lectures: "normal",
  notes: "normal",
  flashcards: "normal",
  questionBank: "normal",
  practice: "normal",
  projects: "normal",
  syllabus: "slow",
  policies: "slow",
  gradingConfig: "slow",
  assessmentDefaults: "slow",
} as const satisfies Record<string, CacheTier>

export function staleMsFor(tier: CacheTier): number {
  return CACHE_STALE_MS[tier]
}

export function refetchOnFocusFor(tier: CacheTier): boolean {
  return tier === "realtime" || tier === "dynamic"
}
