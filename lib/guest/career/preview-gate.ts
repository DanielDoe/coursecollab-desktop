import type {
  AtsReadabilityFinding,
  CareerAnalysis,
  RequirementCheckItem,
  SkillEvidenceItem,
} from "@/lib/guest/career/types"

export type CareerAccessTier = "preview" | "full"

export type CareerAnalysisIssueCounts = {
  skillsToImprove: number
  requirementsGap: number
  improvements: number
  atsAttention: number
}

/** Visible in preview — enough to prove value without giving away actionable detail. */
const PREVIEW_MATCHED_SKILLS = 2
const PREVIEW_PARTIAL_SKILLS = 1
const PREVIEW_MISSING_SKILLS = 0
const PREVIEW_REQUIREMENTS = 2
const PREVIEW_IMPROVEMENTS = 1
const PREVIEW_ATS_FINDINGS = 1

function lockSkill(item: SkillEvidenceItem): SkillEvidenceItem {
  return {
    label: "",
    level: item.level,
    evidence: [],
    guidance: undefined,
    locked: true,
  }
}

function lockRequirement(item: RequirementCheckItem): RequirementCheckItem {
  return {
    label: "",
    level: item.level,
    evidence: [],
    guidance: undefined,
    locked: true,
  }
}

function lockAtsFinding(item: AtsReadabilityFinding): AtsReadabilityFinding {
  return {
    kind: item.kind,
    message: "",
    locked: true,
  }
}

export function careerAnalysisIssueCounts(analysis: CareerAnalysis): CareerAnalysisIssueCounts {
  return {
    skillsToImprove:
      analysis.skillEvidence.partial.length + analysis.skillEvidence.notDemonstrated.length,
    requirementsGap: analysis.requirements.filter((r) => r.level !== "demonstrated").length,
    improvements: analysis.topImprovements.length,
    atsAttention: analysis.atsReadability.findings.filter((f) => f.kind === "attention").length,
  }
}

/** Server-side redaction — never send full detail to preview-tier clients. */
export function gateCareerAnalysis(
  analysis: CareerAnalysis,
  tier: CareerAccessTier,
): CareerAnalysis {
  if (tier === "full") return analysis

  const gateSkills = (items: SkillEvidenceItem[], visible: number) =>
    items.map((item, i) => (i < visible ? { ...item, locked: false } : lockSkill(item)))

  return {
    ...analysis,
    topImprovements: analysis.topImprovements.slice(0, PREVIEW_IMPROVEMENTS),
    skillEvidence: {
      matched: gateSkills(analysis.skillEvidence.matched, PREVIEW_MATCHED_SKILLS),
      partial: gateSkills(analysis.skillEvidence.partial, PREVIEW_PARTIAL_SKILLS),
      notDemonstrated: gateSkills(analysis.skillEvidence.notDemonstrated, PREVIEW_MISSING_SKILLS),
    },
    requirements: analysis.requirements.map((item, i) =>
      i < PREVIEW_REQUIREMENTS ? { ...item, locked: false } : lockRequirement(item),
    ),
    atsReadability: {
      ...analysis.atsReadability,
      findings: analysis.atsReadability.findings.map((item, i) =>
        i < PREVIEW_ATS_FINDINGS ? item : lockAtsFinding(item),
      ),
    },
  }
}

export function careerAccessMeta(tier: CareerAccessTier) {
  return {
    accessTier: tier,
    upgradeUrl: "/guest/cora-career/access",
    previewNote:
      tier === "preview"
        ? "Unlock Cora Career to see missing keywords, evidence, and tailored fixes."
        : null,
  }
}

const PREVIEW_COVER_LETTER_PARAGRAPHS = 1

export function gateCoverLetterBody(body: string, tier: CareerAccessTier) {
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  if (tier === "full") {
    return {
      body,
      lockedParagraphCount: 0,
      totalParagraphCount: paragraphs.length,
      preview: false as const,
    }
  }

  // A short salutation ("Dear Hiring Manager,") shouldn't count as the preview
  // paragraph — always pair it with the first real paragraph.
  const isSalutation = (p: string) => p.length < 60 && /^(dear|to whom|hello|hi)\b/i.test(p)
  const previewCount =
    paragraphs[0] && isSalutation(paragraphs[0])
      ? PREVIEW_COVER_LETTER_PARAGRAPHS + 1
      : PREVIEW_COVER_LETTER_PARAGRAPHS
  const visible = paragraphs.slice(0, previewCount)
  return {
    body: visible.join("\n\n"),
    lockedParagraphCount: Math.max(0, paragraphs.length - visible.length),
    totalParagraphCount: paragraphs.length,
    preview: true as const,
  }
}
