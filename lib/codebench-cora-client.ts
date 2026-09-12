export const CORA_CREDITS_EXHAUSTED =
  "You've used your Cora credits for this period. Buy a pack or wait for your monthly refresh."

export function messageFromCodebenchCoraBody(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const rec = data as { error?: unknown; creditsInsufficient?: unknown }
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
    error?: string
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
