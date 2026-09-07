/** One client-side telemetry row (browser → Next server console). */
export type AiNotetakerClientLogEvent = {
  ts: number
  event: string
  detail?: Record<string, unknown>
}

export const AI_NOTETAKER_CLIENT_LOG_ENV = "NEXT_PUBLIC_AI_NOTETAKER_CLIENT_LOG"

export function isAiNotetakerClientLogEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_AI_NOTETAKER_CLIENT_LOG
  if (raw == null || String(raw).trim() === "") return false
  const v = String(raw).trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes" || v === "on"
}
