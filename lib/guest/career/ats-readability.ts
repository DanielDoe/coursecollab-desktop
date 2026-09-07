import type { AtsReadabilityReport, ResumeProfile } from "@/lib/guest/career/types"

/** Lightweight structural ATS readability — no LLM. */
export function analyzeAtsReadability(resume: ResumeProfile): AtsReadabilityReport {
  const text = resume.parsedText
  const findings: AtsReadabilityReport["findings"] = []
  let score = 100

  if (!text.trim()) {
    return { score: 0, findings: [{ kind: "attention", message: "No extractable text — upload or paste résumé content." }] }
  }

  const lower = text.toLowerCase()
  const hasEmail = /@/.test(text)
  const hasPhone = /\d{3}/.test(text)
  if (hasEmail) findings.push({ kind: "pass", message: "Contact email detected" })
  else {
    score -= 8
    findings.push({ kind: "attention", message: "Contact email not detected" })
  }
  if (hasPhone) findings.push({ kind: "pass", message: "Phone number detected" })
  else findings.push({ kind: "attention", message: "Phone number not detected" })

  const sectionHits = ["experience", "education", "skills"].filter((s) => lower.includes(s))
  if (sectionHits.length >= 2) {
    findings.push({ kind: "pass", message: "Standard section headings detected" })
  } else {
    score -= 10
    findings.push({ kind: "attention", message: "Common section headings (Experience, Education, Skills) are unclear" })
  }

  if (/\t{2,}/.test(text) || /\|{2,}/.test(text)) {
    score -= 8
    findings.push({ kind: "attention", message: "Table-like formatting may reduce parsing reliability" })
  }

  if (/(?:^|\n)\s*\S+\s{4,}\S+\s{4,}\S+/m.test(text)) {
    score -= 6
    findings.push({ kind: "attention", message: "Multi-column spacing detected — may reduce ATS parsing reliability" })
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length
  if (wordCount > 900) {
    score -= 5
    findings.push({ kind: "attention", message: "Résumé is long — consider tightening for scanability" })
  } else if (wordCount >= 150) {
    findings.push({ kind: "pass", message: "Résumé length looks reasonable" })
  } else {
    score -= 5
    findings.push({ kind: "attention", message: "Résumé text is very short" })
  }

  if (resume.profile.experience.length > 0) {
    findings.push({ kind: "pass", message: "Experience section parsed successfully" })
  }

  return { score: Math.max(0, Math.min(100, score)), findings }
}
