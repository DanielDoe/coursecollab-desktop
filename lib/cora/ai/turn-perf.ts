/** Dev-only Cora turn timing. Never logs prompts, responses, or identifiers. */
export function logCoraTurnPerf(fields: {
  provider?: string
  modelMs?: number
  toolMs?: number
  toolRounds?: number
  toolCalls?: number
  inputTokens?: number
  outputTokens?: number
  credits?: number
  totalMs?: number
}): void {
  if (process.env.NODE_ENV === "production" && process.env.CC_PERF_LOG !== "1") return
  console.info(
    [
      "[cora-perf]",
      fields.provider ?? "",
      fields.totalMs != null ? `total=${Math.round(fields.totalMs)}ms` : "",
      fields.modelMs != null ? `model=${Math.round(fields.modelMs)}ms` : "",
      fields.toolMs != null ? `tools=${Math.round(fields.toolMs)}ms` : "",
      fields.toolRounds != null ? `rounds=${fields.toolRounds}` : "",
      fields.toolCalls != null ? `calls=${fields.toolCalls}` : "",
      fields.inputTokens != null ? `in=${fields.inputTokens}` : "",
      fields.outputTokens != null ? `out=${fields.outputTokens}` : "",
      fields.credits != null ? `credits=${fields.credits}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  )
}
