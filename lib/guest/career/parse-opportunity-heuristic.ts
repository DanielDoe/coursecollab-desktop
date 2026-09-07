import type { OpportunityProfileData, OpportunityType } from "@/lib/guest/career/types"

const SKILL_PATTERNS =
  /\b(Python|Java(?:Script)?|TypeScript|C\+\+|MATLAB|SQL|AWS|Azure|GCP|Kubernetes|Docker|PyTorch|TensorFlow|machine learning|deep learning|computer vision|NLP|project management|communication|leadership|research|distributed systems|cloud computing|CI\/CD|Agile|Scrum)\b/gi

const EDU_PATTERNS =
  /\b(Ph\.?D\.?|M\.?S\.?|M\.?A\.?|B\.?S\.?|B\.?A\.?|bachelor|master|doctorate|degree in [A-Za-z &/]+)\b/gi

const EXP_PATTERNS = /\b(\d+\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp\.?))\b/gi

function uniqueMatches(text: string, pattern: RegExp): string[] {
  const out = new Set<string>()
  let m: RegExpExecArray | null
  const re = new RegExp(pattern.source, pattern.flags)
  while ((m = re.exec(text)) !== null) {
    out.add(m[0].trim())
  }
  return [...out]
}

function inferTitle(description: string, organization: string | null): string {
  const firstLine = description.split(/\r?\n/).find((l) => l.trim().length > 8)?.trim()
  if (firstLine && firstLine.length < 120) return firstLine
  return organization ? `Opportunity at ${organization}` : "Opportunity"
}

/** Heuristic opportunity parser — extracts requirements/skills from description text. */
export function parseOpportunityHeuristic(args: {
  type: OpportunityType
  description: string
  organization?: string | null
  title?: string | null
  sourceUrl?: string | null
  location?: string | null
  deadline?: string | null
}): OpportunityProfileData {
  const description = args.description.trim()
  const requiredSkills = uniqueMatches(description, SKILL_PATTERNS)
  const educationRequirements = uniqueMatches(description, EDU_PATTERNS)
  const experienceRequirements = uniqueMatches(description, EXP_PATTERNS)

  const lines = description
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const responsibilities = lines
    .filter((l) => /^[•\-*]/.test(l) || /^(?:responsible for|you will|duties include)/i.test(l))
    .slice(0, 12)
    .map((l) => l.replace(/^[•\-*]\s*/, ""))

  const requiredQualifications = lines
    .filter((l) => /^(?:required|must have|minimum|qualifications?)/i.test(l))
    .slice(0, 8)

  const preferredQualifications = lines
    .filter((l) => /^(?:preferred|nice to have|bonus)/i.test(l))
    .slice(0, 8)

  const keywords = [...new Set([...requiredSkills, ...educationRequirements.slice(0, 5)])].slice(0, 24)

  return {
    organization: args.organization ?? null,
    title: args.title?.trim() || inferTitle(description, args.organization ?? null),
    description,
    sourceUrl: args.sourceUrl ?? null,
    location: args.location ?? null,
    deadline: args.deadline ?? null,
    requiredQualifications,
    preferredQualifications,
    requiredSkills,
    preferredSkills: [],
    educationRequirements,
    experienceRequirements,
    responsibilities,
    keywords,
    extractedMetadata: { parser: "heuristic_v1" },
  }
}
