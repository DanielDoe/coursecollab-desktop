import {
  CACHE_MUTATED_EVENT,
  COURSE_SWITCH_EVENT,
  SESSION_RESET_EVENT,
  type CacheMutatedDetail,
  type SessionResetReason,
} from "@/lib/data/types"

export function dispatchSessionReset(reason: SessionResetReason) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(SESSION_RESET_EVENT, { detail: { reason } }))
}

export function dispatchCourseSwitch() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(COURSE_SWITCH_EVENT))
}

export function dispatchCacheMutated(prefixes: readonly string[][]) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<CacheMutatedDetail>(CACHE_MUTATED_EVENT, { detail: { prefixes } }),
  )
}
