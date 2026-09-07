/** Env-backed Cora architecture flags. Unset = documented default (rollback via env). */

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]
  if (raw == null || raw.trim() === "") return defaultValue
  const v = raw.trim().toLowerCase()
  if (v === "0" || v === "false" || v === "off" || v === "no") return false
  return v === "1" || v === "true" || v === "on" || v === "yes"
}

function envInt(name: string, defaultValue: number): number {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n >= 0 ? n : defaultValue
}

export function isCoraMultiModelRoutingEnabled(): boolean {
  return envFlag("CORA_MULTI_MODEL_ROUTING", true)
}

export function isCoraProviderFallbackEnabled(): boolean {
  return envFlag("CORA_PROVIDER_FALLBACK", true)
}

export function isCoraModelEscalationEnabled(): boolean {
  return envFlag("CORA_MODEL_ESCALATION", true)
}

export function isCoraCrossModelVerificationEnabled(): boolean {
  return envFlag("CORA_CROSS_MODEL_VERIFICATION", false)
}

export function isCoraCostConfirmationEnabled(): boolean {
  return envFlag("CORA_COST_CONFIRMATION", true)
}

export function isCoraLiteEnabled(): boolean {
  return envFlag("CORA_LITE_ENABLED", true)
}

export function getMaxModelEscalations(): number {
  return envInt("MAX_MODEL_ESCALATIONS", 2)
}

export function getMaxAgentToolRounds(): number {
  return envInt("MAX_AGENT_TOOL_ROUNDS", 8)
}

export function getMaxProviderRetries(): number {
  return envInt("CORA_PROVIDER_MAX_RETRIES", 1)
}

export function getCoraCostConfirmationThreshold(): number {
  return envInt("CORA_COST_CONFIRMATION_THRESHOLD", 100)
}

export function getLongContextTokenThreshold(): number {
  return envInt("CORA_LONG_CONTEXT_TOKEN_THRESHOLD", 24_000)
}
