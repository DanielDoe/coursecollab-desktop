export const CORA_CREDITS_EXHAUSTED =
  "You've used your Cora credits for this period. Buy a pack or wait for your monthly refresh."

export const CORA_MEMBERSHIP_REQUIRED =
  "Cora in CodeBench requires Explorer or Trailblazer membership."

export class CodebenchCoraMembershipError extends Error {
  readonly membershipRequired = true
  constructor(message = CORA_MEMBERSHIP_REQUIRED) {
    super(message)
    this.name = "CodebenchCoraMembershipError"
  }
}

export function isCodebenchCoraMembershipError(error: unknown): boolean {
  return error instanceof CodebenchCoraMembershipError
}

/** Mark a Cora request as originating from CodeBench so the server applies CodeBench Cora entitlement. */
export function withCodebenchCoraContext<T extends Record<string, unknown>>(context: T): T & {
  source: "codebench"
  module: "codebench"
} {
  return { ...context, source: "codebench", module: "codebench" }
}

export function messageFromCodebenchCoraBody(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const rec = data as { error?: unknown; creditsInsufficient?: unknown; membershipRequired?: unknown }
    if (rec.membershipRequired === true) {
      return typeof rec.error === "string" && rec.error.trim() ? rec.error : CORA_MEMBERSHIP_REQUIRED
    }
    if (rec.creditsInsufficient === true) {
      return typeof rec.error === "string" && rec.error.trim() ? rec.error : CORA_CREDITS_EXHAUSTED
    }
    if (typeof rec.error === "string" && rec.error.trim()) return rec.error
  }
  return fallback
}

export async function parseCodebenchCoraJson<T extends Record<string, unknown>>(
  res: Response,
  fallback: string,
): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & {
    creditsInsufficient?: boolean
    membershipRequired?: boolean
    error?: string
  }
  if (res.status === 403 || data.membershipRequired) {
    throw new CodebenchCoraMembershipError(messageFromCodebenchCoraBody(data, CORA_MEMBERSHIP_REQUIRED))
  }
  if (res.status === 402 || data.creditsInsufficient) {
    throw new Error(messageFromCodebenchCoraBody(data, CORA_CREDITS_EXHAUSTED))
  }
  if (!res.ok) {
    throw new Error(messageFromCodebenchCoraBody(data, fallback))
  }
  return data
}

export async function parseOptionalCodebenchCoraJson<T extends Record<string, unknown>>(
  res: Response,
  fallback: string,
  empty: T,
): Promise<T> {
  if (res.ok || res.status === 402) {
    return parseCodebenchCoraJson<T>(res, fallback)
  }
  return empty
}
