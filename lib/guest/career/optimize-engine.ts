/**
 * Résumé optimize engine — AI revision that closes the gaps a match analysis
 * found: missing keywords, undemonstrated skills, weak bullets, ATS issues.
 * Grounded in the user's real résumé; instructed never to invent experience.
 */

import OpenAI from "openai"
import type { CareerAnalysis } from "@/lib/guest/career/types"
import { resolveCoraDeployment } from "@/lib/cora/models/registry"

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null

export type ResumeOptimizeResult = {
  revisedSummary: string
  keywordAdditions: Array<{ keyword: string; section: string; suggestion: string }>
  bulletRewrites: Array<{ original: string; revised: string; reason: string }>
  skillsToAdd: string[]
  atsFixes: string[]
  revisedResumeText: string
}

function analysisGapBrief(analysis: CareerAnalysis | null): string {
  if (!analysis) return "No prior match analysis available."
  const missing = analysis.skillEvidence.notDemonstrated.map((s) => s.label).filter(Boolean)
  const partial = analysis.skillEvidence.partial.map((s) => s.label).filter(Boolean)
  const unmetReqs = analysis.requirements
    .filter((r) => r.level !== "demonstrated")
    .map((r) => r.label)
    .filter(Boolean)
  const atsIssues = analysis.atsReadability.findings
    .filter((f) => f.kind === "attention")
    .map((f) => f.message)
  return [
    `Match score: ${analysis.overallScore}/100 (${analysis.matchBand}).`,
    missing.length ? `Missing skills/keywords: ${missing.join(", ")}.` : "",
    partial.length ? `Partially demonstrated: ${partial.join(", ")}.` : "",
    unmetReqs.length ? `Unmet requirements: ${unmetReqs.join("; ")}.` : "",
    atsIssues.length ? `ATS issues: ${atsIssues.join("; ")}.` : "",
    analysis.topImprovements.length ? `Suggested improvements: ${analysis.topImprovements.join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

const SYSTEM_PROMPT = `You are Cora, a career résumé optimization expert. You revise résumés to close the gap with a specific opportunity.

Hard rules:
- NEVER invent employers, titles, degrees, dates, certifications, or accomplishments not present in the résumé.
- You may rephrase, reorder, quantify with existing evidence, and surface implied skills the résumé already demonstrates.
- Weave in missing keywords ONLY where the underlying experience genuinely supports them; otherwise list them under keywordAdditions with a suggestion of how the candidate could honestly address the gap.
- Keep the candidate's voice; use strong action verbs; keep bullets to one line where possible.

Return strict JSON with keys:
revisedSummary (string — 2-3 sentence professional summary tailored to this opportunity),
keywordAdditions (array of { keyword, section, suggestion }),
bulletRewrites (array of { original, revised, reason } — the highest-impact rewrites, max 8),
skillsToAdd (array of strings — skills the résumé demonstrates but never names),
atsFixes (array of strings — formatting/structure fixes for applicant tracking systems),
revisedResumeText (string — the complete revised résumé as plain text, ready to copy).`

export async function runResumeOptimize(args: {
  resumeText: string
  opportunityDescription: string
  analysis: CareerAnalysis | null
}): Promise<ResumeOptimizeResult> {
  if (!openai) {
    throw new Error("AI is not configured on this server.")
  }

  const model = resolveCoraDeployment("fast").model
  const response = await openai.chat.completions.create({
    model,
    max_tokens: 4000,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          "RÉSUMÉ:\n" + args.resumeText.slice(0, 16000),
          "OPPORTUNITY:\n" + args.opportunityDescription.slice(0, 8000),
          "MATCH ANALYSIS GAPS:\n" + analysisGapBrief(args.analysis),
        ].join("\n\n---\n\n"),
      },
    ],
  })

  try {
    const { recordModelCall } = await import("@/lib/cora/ai")
    await recordModelCall({
      context: {
        actor: { userId: 0, userRole: "guest" },
        feature: "OTHER",
        module: "career-resume-optimize",
        billable: false,
      },
      model,
      rawResponse: response,
    })
  } catch {
    /* accounting must not block optimize */
  }

  const raw = response.choices[0]?.message?.content ?? "{}"
  let parsed: Partial<ResumeOptimizeResult>
  try {
    parsed = JSON.parse(raw) as Partial<ResumeOptimizeResult>
  } catch {
    throw new Error("Optimization returned an unreadable result. Try again.")
  }

  return {
    revisedSummary: String(parsed.revisedSummary ?? ""),
    keywordAdditions: Array.isArray(parsed.keywordAdditions)
      ? parsed.keywordAdditions.map((k) => ({
          keyword: String(k?.keyword ?? ""),
          section: String(k?.section ?? ""),
          suggestion: String(k?.suggestion ?? ""),
        }))
      : [],
    bulletRewrites: Array.isArray(parsed.bulletRewrites)
      ? parsed.bulletRewrites.map((b) => ({
          original: String(b?.original ?? ""),
          revised: String(b?.revised ?? ""),
          reason: String(b?.reason ?? ""),
        }))
      : [],
    skillsToAdd: Array.isArray(parsed.skillsToAdd) ? parsed.skillsToAdd.map(String) : [],
    atsFixes: Array.isArray(parsed.atsFixes) ? parsed.atsFixes.map(String) : [],
    revisedResumeText: String(parsed.revisedResumeText ?? ""),
  }
}
