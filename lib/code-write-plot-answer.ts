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
