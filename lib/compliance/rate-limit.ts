/**
 * In-process rate limiter for sensitive endpoints.
 * Classroom-friendly: keyed by IP + route, not by shared campus NAT alone for Cora.
 * Multi-instance Vercel does not share this map — it is a first line, not a WAF.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export type RateLimitResult = {
  ok: boolean
  remaining: number
  retryAfterSeconds: number
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: Math.ceil(windowMs / 1000) }
  }
  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }
  existing.count += 1
  return {
    ok: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  }
}

export function rateLimitKey(request: { headers: Headers }, route: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown"
  return `${route}:${ip}`
}

export const AUTH_RATE_LIMIT = { limit: 40, windowMs: 10 * 60 * 1000 }
export const DELETE_ACCOUNT_RATE_LIMIT = { limit: 8, windowMs: 15 * 60 * 1000 }
export const PASSWORD_RESET_RATE_LIMIT = { limit: 8, windowMs: 15 * 60 * 1000 }
export const PAYMENT_MUTATION_RATE_LIMIT = { limit: 20, windowMs: 10 * 60 * 1000 }
