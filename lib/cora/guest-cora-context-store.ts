import { type GuestCoraContext, GUEST_CORA_CONTEXT_VERSION } from "@/lib/cora/guest-cora-context"

const memoryCache = new Map<string, GuestCoraContext>()

function storageKey(guestId: string): string {
  return `guestCoraContext:${guestId}`
}

export function loadGuestCoraContext(guestId: string): GuestCoraContext | null {
  if (typeof window === "undefined" || !guestId) return null
  const cached = memoryCache.get(guestId)
  if (cached) return cached

  try {
    const raw = localStorage.getItem(storageKey(guestId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as GuestCoraContext
    if (parsed.version !== GUEST_CORA_CONTEXT_VERSION || !parsed.setupComplete) return null
    if (parsed.guestId !== guestId) return null
    memoryCache.set(guestId, parsed)
    return parsed
  } catch {
    return null
  }
}

export function saveGuestCoraContext(context: GuestCoraContext): void {
  if (typeof window === "undefined") return
  memoryCache.set(context.guestId, context)
  try {
    localStorage.setItem(storageKey(context.guestId), JSON.stringify(context))
  } catch {
    /* non-fatal */
  }
}

export function clearGuestCoraContext(guestId: string): void {
  memoryCache.delete(guestId)
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(storageKey(guestId))
  } catch {
    /* non-fatal */
  }
}

export const GUEST_CORA_CONTEXT_STALE_MS = 15 * 60 * 1000

export function isGuestCoraContextStale(context: GuestCoraContext | null): boolean {
  if (!context?.generatedAt) return true
  const age = Date.now() - new Date(context.generatedAt).getTime()
  return !Number.isFinite(age) || age > GUEST_CORA_CONTEXT_STALE_MS
}
