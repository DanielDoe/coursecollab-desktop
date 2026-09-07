import { analyzeAtsReadability } from "@/lib/guest/career/ats-readability"
import {
  CAREER_ANALYSIS_ALGORITHM_VERSION,
  CAREER_MATCH_WEIGHTS,
  CAREER_MATCH_WEIGHTS_VERSION,
  matchBandHeadline,
  scoreToMatchBand,
} from "@/lib/guest/career/match-config"
import type {
  CareerAnalysis,
  MatchEvidenceLevel,
  OpportunityProfile,
  ProvenanceRef,
  RequirementCheckItem,
  ResumeProfile,
  SkillEvidenceItem,
} from "@/lib/guest/career/types"

function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+#.]/g, " ").replace(/\s+/g, " ").trim()
}

function semanticAliases(token: string): string[] {
  const n = normalizeToken(token)
  const aliases: Record<string, string[]> = {
    ml: ["machine learning"],
    ai: ["artificial intelligence"],
    "node.js": ["nodejs", "node"],
    k8s: ["kubernetes"],
  }
  return [n, ...(aliases[n] ?? [])]
}

function resumeCorpus(resume: ResumeProfile): string {
  const parts = [
    resume.parsedText,
    resume.profile.summary ?? "",
    ...resume.profile.skills.map((s) => s.name),
    ...resume.profile.experience.flatMap((e) => [e.title, e.organization, ...e.bullets]),
    ...resume.profile.education.flatMap((e) => [e.degree, e.institution]),
  ]
  return normalizeToken(parts.join(" "))
}

function findEvidenceInResume(resume: ResumeProfile, needle: string): ProvenanceRef[] {
  const refs: ProvenanceRef[] = []
  const n = normalizeToken(needle)
  if (!n) return refs

  for (const skill of resume.profile.skills) {
    if (semanticAliases(skill.name).some((a) => n.includes(a) || a.includes(n))) {
      for (const p of skill.provenance ?? []) refs.push(p)
    }
  }

  for (const exp of resume.profile.experience) {
    const blob = normalizeToken([exp.title, exp.organization, ...exp.bullets].join(" "))
    if (semanticAliases(needle).some((a) => blob.includes(a))) {
      refs.push({
        sourceSection: "Experience",
        sourceText: [exp.title, ...exp.bullets].filter(Boolean).join(" — ").slice(0, 280),
      })
    }
  }

  if (refs.length === 0 && resumeCorpus(resume).includes(n)) {
    const idx = resume.parsedText.toLowerCase().indexOf(needle.toLowerCase())
    if (idx >= 0) {
      refs.push({
        sourceSection: "Document",
        sourceText: resume.parsedText.slice(Math.max(0, idx - 40), idx + needle.length + 60),
      })
    }
  }

  return refs.slice(0, 4)
}

function classifySkill(resume: ResumeProfile, skill: string): SkillEvidenceItem {
  const explicit = resume.profile.skills.some((s) =>
    semanticAliases(s.name).some((a) => semanticAliases(skill).some((b) => a === b || a.includes(b) || b.includes(a))),
  )
  if (explicit) {
    const evidence = findEvidenceInResume(resume, skill)
    return {
      label: skill,
      level: "EXPLICIT_MATCH",
      evidence,
    }
  }

  const evidence = findEvidenceInResume(resume, skill)
  if (evidence.length > 0) {
    return { label: skill, level: "SEMANTIC_MATCH", evidence }
  }

  const partial = semanticAliases(skill).some((a) => {
    const words = a.split(" ")
    return words.length > 1 && words.every((w) => resumeCorpus(resume).includes(w))
  })
  if (partial) {
    return {
      label: skill,
      level: "PARTIAL",
      evidence: findEvidenceInResume(resume, skill),
      guidance: "Partially related language found — strengthen with explicit evidence if you have this skill.",
    }
  }

  return {
    label: skill,
    level: "NOT_FOUND",
    evidence: [],
    guidance: "Not demonstrated in your résumé. Add this only if you have genuine experience.",
  }
}

function scoreSkills(resume: ResumeProfile, opportunity: OpportunityProfile): number {
  const skills = [
    ...opportunity.profile.requiredSkills,
    ...opportunity.profile.preferredSkills,
    ...opportunity.profile.keywords.slice(0, 12),
  ]
  const unique = [...new Set(skills.map((s) => s.trim()).filter(Boolean))]
  if (unique.length === 0) return 70

  let points = 0
  for (const skill of unique) {
    const item = classifySkill(resume, skill)
    if (item.level === "EXPLICIT_MATCH") points += 1
    else if (item.level === "SEMANTIC_MATCH") points += 0.85
    else if (item.level === "PARTIAL") points += 0.45
  }
  return Math.round((points / unique.length) * 100)
}

function scoreKeywords(resume: ResumeProfile, opportunity: OpportunityProfile): number {
  const keys = opportunity.profile.keywords
  if (keys.length === 0) return 65
  const corpus = resumeCorpus(resume)
  let hit = 0
  for (const k of keys) {
    if (semanticAliases(k).some((a) => corpus.includes(a))) hit += 1
  }
  return Math.round((hit / keys.length) * 100)
}

function scoreExperience(resume: ResumeProfile, opportunity: OpportunityProfile): number {
  if (resume.profile.experience.length === 0) return 20
  const jd = normalizeToken(opportunity.description)
  let best = 0
  for (const exp of resume.profile.experience) {
    const blob = normalizeToken([exp.title, ...exp.bullets].join(" "))
    const overlap = opportunity.profile.keywords.filter((k) =>
      semanticAliases(k).some((a) => blob.includes(a)),
    ).length
    const bulletQuality = exp.bullets.filter((b) => /\d|%/.test(b)).length
    const score = Math.min(100, 40 + overlap * 8 + bulletQuality * 10)
    best = Math.max(best, score)
  }
  return best
}

function scoreTitle(resume: ResumeProfile, opportunity: OpportunityProfile): number {
  const target = normalizeToken(opportunity.title)
  if (!target) return 50
  const titles = resume.profile.experience.map((e) => normalizeToken(e.title))
  if (titles.some((t) => t.includes(target) || target.includes(t))) return 95
  const targetTokens = target.split(" ").filter((t) => t.length > 3)
  if (targetTokens.length === 0) return 50
  let best = 0
  for (const t of titles) {
    const overlap = targetTokens.filter((tok) => t.includes(tok)).length
    best = Math.max(best, Math.round((overlap / targetTokens.length) * 100))
  }
  return best
}

function scoreEducation(resume: ResumeProfile, opportunity: OpportunityProfile): number {
  const reqs = opportunity.profile.educationRequirements
  if (reqs.length === 0) return 75
  const eduText = normalizeToken(
    resume.profile.education.map((e) => [e.degree, e.institution, ...(e.details ?? [])].join(" ")).join(" "),
  )
  if (!eduText) return 30
  let hit = 0
  for (const r of reqs) {
    if (normalizeToken(r).split(" ").some((tok) => tok.length > 3 && eduText.includes(tok))) hit += 1
  }
  return Math.round((hit / reqs.length) * 100)
}

function scoreImpact(resume: ResumeProfile): number {
  const bullets = resume.profile.experience.flatMap((e) => e.bullets)
  if (bullets.length === 0) return 40
  const withMetrics = bullets.filter((b) => /\d|%|\$/.test(b)).length
  return Math.round(40 + (withMetrics / bullets.length) * 60)
}

function buildRequirements(resume: ResumeProfile, opportunity: OpportunityProfile): RequirementCheckItem[] {
  const items: string[] = [
    ...opportunity.profile.requiredQualifications.slice(0, 6),
    ...opportunity.profile.requiredSkills.slice(0, 10),
    ...opportunity.profile.educationRequirements.slice(0, 4),
    ...opportunity.profile.experienceRequirements.slice(0, 3),
  ]
  const unique = [...new Set(items.map((i) => i.trim()).filter(Boolean))].slice(0, 14)

  return unique.map((label) => {
    const skill = classifySkill(resume, label)
    let level: RequirementCheckItem["level"] = "not_demonstrated"
    if (skill.level === "EXPLICIT_MATCH" || skill.level === "SEMANTIC_MATCH") level = "demonstrated"
    else if (skill.level === "PARTIAL") level = "partial"
    return {
      label,
      level,
      evidence: skill.evidence,
      guidance: skill.guidance,
    }
  })
}

function buildSkillEvidence(resume: ResumeProfile, opportunity: OpportunityProfile) {
  const skills = [
    ...opportunity.profile.requiredSkills,
    ...opportunity.profile.preferredSkills,
  ]
  const unique = [...new Set(skills.map((s) => s.trim()).filter(Boolean))].slice(0, 20)
  const matched: SkillEvidenceItem[] = []
  const partial: SkillEvidenceItem[] = []
  const notDemonstrated: SkillEvidenceItem[] = []

  for (const s of unique) {
    const item = classifySkill(resume, s)
    if (item.level === "EXPLICIT_MATCH" || item.level === "SEMANTIC_MATCH") matched.push(item)
    else if (item.level === "PARTIAL") partial.push(item)
    else notDemonstrated.push(item)
  }

  return { matched, partial, notDemonstrated }
}

function buildImprovements(
  skillEvidence: ReturnType<typeof buildSkillEvidence>,
  dimensions: CareerAnalysis["dimensionScores"],
): string[] {
  const out: string[] = []
  if (dimensions.keywordCoverage < 75) out.push("Strengthen terminology that mirrors the opportunity description")
  if (dimensions.experienceAlignment < 75) out.push("Surface experience most relevant to this role with clearer outcomes")
  if (dimensions.resumeImpact < 75) out.push("Add measurable results to experience bullets where you have real numbers")
  if (skillEvidence.notDemonstrated.length > 0) {
    out.push(
      `Review undemonstrated skills (${skillEvidence.notDemonstrated
        .slice(0, 3)
        .map((s) => s.label)
        .join(", ")}) — only add what you genuinely have`,
    )
  }
  if (dimensions.atsReadability < 85) out.push("Improve résumé structure for clearer ATS readability")
  return out.slice(0, 5)
}

export function runCareerMatchAnalysis(args: {
  resume: ResumeProfile
  opportunity: OpportunityProfile
  resumeHash: string
  opportunityHash: string
  guestId: number
  applicationId?: number | null
}): Omit<CareerAnalysis, "id" | "createdAt"> {
  const dimensionScores = {
    skillsMatch: scoreSkills(args.resume, args.opportunity),
    experienceAlignment: scoreExperience(args.resume, args.opportunity),
    roleTitleAlignment: scoreTitle(args.resume, args.opportunity),
    educationQualifications: scoreEducation(args.resume, args.opportunity),
    keywordCoverage: scoreKeywords(args.resume, args.opportunity),
    resumeImpact: scoreImpact(args.resume),
    atsReadability: analyzeAtsReadability(args.resume).score,
  }

  const overallScore = Math.round(
    dimensionScores.skillsMatch * CAREER_MATCH_WEIGHTS.skillsMatch +
      dimensionScores.experienceAlignment * CAREER_MATCH_WEIGHTS.experienceAlignment +
      dimensionScores.roleTitleAlignment * CAREER_MATCH_WEIGHTS.roleTitleAlignment +
      dimensionScores.educationQualifications * CAREER_MATCH_WEIGHTS.educationQualifications +
      dimensionScores.keywordCoverage * CAREER_MATCH_WEIGHTS.keywordCoverage +
      dimensionScores.resumeImpact * CAREER_MATCH_WEIGHTS.resumeImpact +
      dimensionScores.atsReadability * CAREER_MATCH_WEIGHTS.atsReadability,
  )

  const matchBand = scoreToMatchBand(overallScore)
  const skillEvidence = buildSkillEvidence(args.resume, args.opportunity)
  const atsReadability = analyzeAtsReadability(args.resume)

  return {
    guestId: args.guestId,
    applicationId: args.applicationId ?? null,
    resumeId: args.resume.id,
    opportunityId: args.opportunity.id,
    algorithmVersion: CAREER_ANALYSIS_ALGORITHM_VERSION,
    weightsVersion: CAREER_MATCH_WEIGHTS_VERSION,
    overallScore,
    matchBand,
    dimensionScores,
    summary: matchBandHeadline(matchBand),
    topImprovements: buildImprovements(skillEvidence, dimensionScores),
    skillEvidence,
    requirements: buildRequirements(args.resume, args.opportunity),
    atsReadability,
    resumeHash: args.resumeHash,
    opportunityHash: args.opportunityHash,
  }
}

export function levelLabel(level: MatchEvidenceLevel): string {
  switch (level) {
    case "EXPLICIT_MATCH":
      return "Matched"
    case "SEMANTIC_MATCH":
      return "Matched"
    case "PARTIAL":
      return "Partial"
    default:
      return "Not demonstrated"
  }
}
