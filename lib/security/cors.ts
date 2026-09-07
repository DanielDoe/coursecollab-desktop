import {
  PRODUCTION_PUBLIC_ORIGINS,
  hostnameOf,
  isProductionRuntime,
} from "@/lib/compliance/environment"

const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
] as const

const EXTRA = String(process.env.CC_CORS_EXTRA_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean)

export function allowedCorsOrigins(env: NodeJS.ProcessEnv = process.env): readonly string[] {
  if (isProductionRuntime(env)) {
    return [...PRODUCTION_PUBLIC_ORIGINS, ...EXTRA]
  }
  return [...PRODUCTION_PUBLIC_ORIGINS, ...DEV_ORIGINS, ...EXTRA]
}

export function isAllowedCorsOrigin(origin: string | null | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = String(origin ?? "").trim()
  if (!raw || raw === "*") return false
  const host = hostnameOf(raw)
  if (!host) return false
  return allowedCorsOrigins(env).some((allowed) => hostnameOf(allowed) === host)
}

/** Reflect only allowlisted origins. Never echo an arbitrary Origin. */
export function corsAllowOriginValue(origin: string | null | undefined, env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = String(origin ?? "").trim()
  if (!raw) return null
  return isAllowedCorsOrigin(raw, env) ? raw.replace(/\/+$/, "") : null
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"])

/**
 * Cookie-authenticated mutations must come from an allowlisted Origin when
 * the browser sends Origin. Native / server callers typically omit Origin.
 */
export function isBlockedCrossOriginMutation(
  method: string,
  origin: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!MUTATING.has(method.toUpperCase())) return false
  const raw = String(origin ?? "").trim()
  if (!raw) return false
  return !isAllowedCorsOrigin(raw, env)
}
