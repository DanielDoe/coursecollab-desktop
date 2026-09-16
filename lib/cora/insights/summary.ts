/** Template class summary from structured aggregates — no LLM. */

export function buildClassSummary(input: {
  rangeLabel: string
  concepts: Array<{
    concept: string
    students: number
    requests: number
    successAfter: number | null
    independentSuccess: number | null
  }>
  attentionCount: number
  highCount: number
  noImprovement: number
  assistedSuccess: number | null
  topIndependentWeak: Array<{ concept: string; successAfter: number | null; independentSuccess: number | null }>
}): string {
  const top = input.concepts.filter((c) => c.concept && c.concept !== "Course help").slice(0, 3)
  if (input.concepts.length === 0 && input.attentionCount === 0) {
    return `Not enough structured Cora activity in ${input.rangeLabel.toLowerCase()} to summarize class learning yet.`
  }
  const topicList = top.map((c) => c.concept).join(", ")
  const parts: string[] = []
  if (top.length) {
    parts.push(
      `${input.rangeLabel}, students are primarily requesting help with ${topicList}.`,
    )
  } else {
    parts.push(`${input.rangeLabel}, Cora activity is present but topics are not yet classified.`)
  }
  if (input.attentionCount > 0) {
    parts.push(
      `${input.attentionCount} student${input.attentionCount === 1 ? "" : "s"} show repeated difficulty${
        input.highCount ? ` (${input.highCount} high priority)` : ""
      }.`,
    )
  }
  if (input.noImprovement > 0) {
    parts.push(
      `${input.noImprovement} student${input.noImprovement === 1 ? "" : "s"} have requested repeated help on the same concepts without subsequent improvement.`,
    )
  }
  const improved = input.concepts.filter((c) => c.successAfter != null && c.successAfter >= 65)
  const weakIndep = input.topIndependentWeak[0] ?? input.concepts.find((c) => c.independentSuccess != null && c.successAfter != null && c.independentSuccess + 12 < c.successAfter)
  if (improved[0] && weakIndep) {
    parts.push(
      `Performance after Cora assistance improved most for ${improved[0].concept} (${improved[0].successAfter}%) but remains weaker independently for ${weakIndep.concept}${
        weakIndep.independentSuccess != null ? ` (${weakIndep.independentSuccess}% independent)` : ""
      }.`,
    )
  } else if (input.assistedSuccess != null) {
    parts.push(`Cora-assisted success on known follow-ups is ${input.assistedSuccess}%.`)
  }
  return parts.join(" ")
}
