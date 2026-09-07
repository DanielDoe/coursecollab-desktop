/**
 * Central production environment rules.
 * Production builds must fail closed — never fall back to localhost or staging.
 */

export const PRODUCTION_PUBLIC_ORIGINS = [
  "https://course-collab.com",
  "https://www.course-collab.com",
  "https://coursecollab.vercel.app",
] as const

export const PROHIBITED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.0\.0\.1$/,
  /^0\.0\.0\.0$/,
  /\.ngrok(?:-free)?\.(?:app|io|dev)$/i,
  /\.loca\.lt$/i,
  /^dev\./i,
  /^staging\./i,
  /^test\./i,
] as const

export type RuntimeEnvironment = "development" | "test" | "production"

export type ProductionConfigIssue = {
  code: string
  message: string
  severity: "blocker" | "critical" | "warning"
}

export function resolveRuntimeEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeEnvironment {
  if (env.VERCEL_ENV === "production" || env.CC_RUNTIME_ENV === "production") {
    return "production"
  }
  if (env.NODE_ENV === "test" || env.CC_RUNTIME_ENV === "test") return "test"
  if (env.NODE_ENV === "production" && env.VERCEL_ENV !== "preview") {
    return "production"
  }
  return "development"
}

export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveRuntimeEnvironment(env) === "production"
}

export function hostnameOf(urlOrHost: string): string {
  const raw = String(urlOrHost ?? "").trim()
  if (!raw) return ""
  try {
    const withProtocol = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`
    return new URL(withProtocol).hostname
  } catch {
    return raw.replace(/^https?:\/\//i, "").split("/")[0] ?? ""
  }
}

export function isProhibitedPublicOrigin(urlOrHost: string): boolean {
  const host = hostnameOf(urlOrHost)
  if (!host) return true
  return PROHIBITED_HOST_PATTERNS.some((re) => re.test(host))
}

export function isHttpsPublicOrigin(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" && !isProhibitedPublicOrigin(url)
  } catch {
    return false
  }
}

export function sanitizePublicOrigin(raw: string | null | undefined): string {
  return String(raw ?? "")
    .replace(/[\r\n\s]+/g, "")
    .replace(/\/+$/, "")
}

export function resolveConfiguredPublicOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const candidates = [
    env.NEXT_PUBLIC_APP_URL,
    env.NEXT_PUBLIC_BASE_URL,
    env.VERCEL_URL ? `https://${env.VERCEL_URL}` : null,
  ]
  for (const candidate of candidates) {
    const cleaned = sanitizePublicOrigin(candidate)
    if (cleaned) return cleaned
  }
  return null
}

export function defaultProductionOrigin(): string {
  return PRODUCTION_PUBLIC_ORIGINS[0]
}

export function collectProductionConfigIssues(
  env: NodeJS.ProcessEnv = process.env,
  opts?: { requirePayments?: boolean; requireAi?: boolean },
): ProductionConfigIssue[] {
  const issues: ProductionConfigIssue[] = []
  const origin = resolveConfiguredPublicOrigin(env)

  if (!origin) {
    issues.push({
      code: "missing_public_origin",
      message: "Production requires NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_BASE_URL.",
      severity: "blocker",
    })
  } else if (isProhibitedPublicOrigin(origin) || !isHttpsPublicOrigin(origin)) {
    issues.push({
      code: "invalid_public_origin",
      message: `Production public origin is not allowed: ${origin}`,
      severity: "blocker",
    })
  }

  const databaseUrl = String(env.DATABASE_URL ?? "").trim()
  if (!databaseUrl) {
    issues.push({
      code: "missing_database",
      message: "Production requires DATABASE_URL.",
      severity: "blocker",
    })
  } else if (isProhibitedPublicOrigin(databaseUrl) || /localhost|127\.0\.0\.1/i.test(databaseUrl)) {
    issues.push({
      code: "development_database",
      message: "Production DATABASE_URL points at a local or prohibited host.",
      severity: "blocker",
    })
  }

  if (opts?.requirePayments !== false) {
    if (!String(env.STRIPE_SECRET_KEY ?? "").trim()) {
      issues.push({
        code: "missing_stripe_secret",
        message: "Production payment configuration requires STRIPE_SECRET_KEY.",
        severity: "critical",
      })
    } else if (/^sk_test_/i.test(String(env.STRIPE_SECRET_KEY))) {
      issues.push({
        code: "test_stripe_secret",
        message: "Production must not use a Stripe test secret.",
        severity: "critical",
      })
    }
    if (!String(env.STRIPE_WEBHOOK_SECRET ?? "").trim()) {
      issues.push({
        code: "missing_stripe_webhook",
        message: "Production payment configuration requires STRIPE_WEBHOOK_SECRET.",
        severity: "critical",
      })
    }
  }

  if (opts?.requireAi !== false) {
    if (!String(env.OPENAI_API_KEY ?? "").trim() && !String(env.ANTHROPIC_API_KEY ?? "").trim()) {
      issues.push({
        code: "missing_ai_provider",
        message: "Production Cora requires OPENAI_API_KEY or ANTHROPIC_API_KEY.",
        severity: "critical",
      })
    }
  }

  if (!String(env.CRON_SECRET ?? "").trim()) {
    issues.push({
      code: "missing_cron_secret",
      message: "Production scheduled jobs require CRON_SECRET.",
      severity: "critical",
    })
  }

  const publicStripe = String(env.NEXT_PUBLIC_STRIPE_SECRET_KEY ?? "").trim()
  if (publicStripe) {
    issues.push({
      code: "public_stripe_secret",
      message: "Stripe secrets must never be exposed as NEXT_PUBLIC_*.",
      severity: "blocker",
    })
  }
  if (String(env.NEXT_PUBLIC_OPENAI_API_KEY ?? "").trim() || String(env.NEXT_PUBLIC_ANTHROPIC_API_KEY ?? "").trim()) {
    issues.push({
      code: "public_ai_secret",
      message: "AI provider secrets must never be exposed as NEXT_PUBLIC_*.",
      severity: "blocker",
    })
  }

  return issues
}

export function assertProductionConfig(
  env: NodeJS.ProcessEnv = process.env,
  opts?: { requirePayments?: boolean; requireAi?: boolean },
): void {
  if (!isProductionRuntime(env)) return
  const issues = collectProductionConfigIssues(env, opts)
  const fatal = issues.filter((issue) => issue.severity === "blocker")
  if (fatal.length > 0) {
    throw new Error(fatal.map((issue) => `[${issue.code}] ${issue.message}`).join(" "))
  }
}

export function requireProductionPublicOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const origin = resolveConfiguredPublicOrigin(env) ?? defaultProductionOrigin()
  if (isProductionRuntime(env) && (isProhibitedPublicOrigin(origin) || !isHttpsPublicOrigin(origin))) {
    throw new Error("Production public origin is missing or points at a development host.")
  }
  return origin
}
