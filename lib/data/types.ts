export type PortalRole = "student" | "faculty" | "admin" | "guest"

export type MutationMode = "OPTIMISTIC" | "PENDING" | "CONFIRMATION_REQUIRED"

export type CacheTier = "realtime" | "dynamic" | "normal" | "slow"

export type ClientScope = {
  role: PortalRole | null
  userId: string | null
  courseId: number | null
  section: string | null
}

export type OptimisticEntity = {
  optimistic?: boolean
}

export const SESSION_RESET_EVENT = "cc-session-reset"
export const COURSE_SWITCH_EVENT = "cc-course-switched"
export const CACHE_MUTATED_EVENT = "cc-cache-mutated"

export type SessionResetReason = "logout" | "role-change" | "account-switch"

export type SessionResetDetail = {
  reason: SessionResetReason
}

export type CacheMutatedDetail = {
  prefixes: readonly string[][]
}
