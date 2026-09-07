import type { CoraStepKind, CoraWalkthroughStep } from "@/lib/cora/types"

const STEP_HEADING =
  /^(?:#{1,3}\s*)?(?:\*\*)?(?:step\s*)?(\d+)[.)]\s*(.+?)(?:\*\*)?\s*$/i

function inferStepKind(title: string, body: string): CoraStepKind {
  const blob = `${title} ${body}`.toLowerCase()
  if (/\b(hint|recall|remember|note that)\b/.test(blob)) return "hint"
  if (/\b(check|verify|confirm|does this|units)\b/.test(blob)) return "check"
  if (/\b(code|compile|function|loop|syntax|implement)\b/.test(blob)) return "code"
  if (/\b(therefore|final|answer|result|conclusion)\b/.test(blob)) return "summary"
  if (/\b(define|identify|draw|label|setup|given|known)\b/.test(blob)) return "setup"
  if (/\b(concept|law|theorem|formula|principle)\b/.test(blob)) return "concept"
  return "compute"
}

function toStep(index: number, title: string, body: string): CoraWalkthroughStep {
  const trimmedTitle = title.trim() || `Step ${index + 1}`
  const trimmedBody = body.trim()
  return {
    id: `step-${index + 1}`,
    index,
    title: trimmedTitle,
    body: trimmedBody,
    kind: inferStepKind(trimmedTitle, trimmedBody),
  }
}

/** Turn bank / workspace reference lines into structured walkthrough steps. */
export function parseReferenceSteps(lines: string[]): CoraWalkthroughStep[] {
  const cleaned = lines.map((l) => l.trim()).filter(Boolean)
  if (cleaned.length === 0) return []

  const structured: CoraWalkthroughStep[] = []
  let bufferTitle = ""
  let bufferBody: string[] = []

  const flush = () => {
    if (!bufferTitle && bufferBody.length === 0) return
    structured.push(toStep(structured.length, bufferTitle || `Step ${structured.length + 1}`, bufferBody.join("\n\n")))
    bufferTitle = ""
    bufferBody = []
  }

  for (const line of cleaned) {
    const heading = line.match(STEP_HEADING)
    if (heading) {
      flush()
      bufferTitle = heading[2]!.trim()
      continue
    }
    if (!bufferTitle && structured.length === 0 && bufferBody.length === 0) {
      bufferTitle = line.replace(/^\*\*|\*\*$/g, "").trim()
      continue
    }
    bufferBody.push(line)
  }
  flush()

  if (structured.length >= 2) return structured

  // Fallback: one step per paragraph block
  return cleaned.map((block, i) => toStep(i, `Step ${i + 1}`, block))
}

export function parseExplanationSteps(explanation: string | null | undefined): CoraWalkthroughStep[] {
  if (!explanation?.trim()) return []
  const chunks = explanation
    .split(/\n{2,}/)
    .map((c) => c.trim())
    .filter(Boolean)
  return parseReferenceSteps(chunks)
}
