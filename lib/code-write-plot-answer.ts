/**
 * code_write_plot answers are often JSON: { code, plotImage }.
 * Prefer explicit plotImage from the request body; fall back to embedded plot.
 */
export function resolvePlotImageForCodeWritePlot(
  answer: unknown,
  plotFromRequest: unknown
): string | undefined {
  if (typeof plotFromRequest === "string" && plotFromRequest.length > 0) {
    return plotFromRequest
  }
  if (typeof answer !== "string") return undefined
  try {
    const p = JSON.parse(answer) as { plotImage?: unknown }
    if (typeof p?.plotImage === "string" && p.plotImage.length > 0) {
      return p.plotImage
    }
  } catch {
    // not JSON
  }
  return undefined
}

/**
 * Stored code candidates may be the `{ code, plotImage }` JSON blob. Sending that to the model as
 * "code" ships base64 into the prompt (token-limit failures → heuristic grades), so unwrap to `.code`.
 */
export function unwrapCodePlotCandidates(candidates: string[]): { codes: string[]; plotImage?: string } {
  let plotImage: string | undefined
  const codes = candidates.map((candidate) => {
    const trimmed = candidate.trim()
    if (!trimmed.startsWith("{")) return candidate
    try {
      const parsed = JSON.parse(trimmed) as { code?: unknown; plotImage?: unknown }
      if (!plotImage && typeof parsed?.plotImage === "string" && parsed.plotImage.length > 0) {
        plotImage = parsed.plotImage
      }
      return typeof parsed?.code === "string" ? parsed.code : candidate
    } catch {
      return candidate
    }
  })
  return { codes, plotImage }
}
