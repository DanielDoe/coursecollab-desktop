import type { OpportunityProfile, ResumeProfile } from "@/lib/guest/career/types"

export type CoverLetterTone = "professional" | "warm"

function inferApplicantName(resume: ResumeProfile): string | null {
  const fromProfile = resume.profile.contactInformation.name?.trim()
  if (fromProfile) return fromProfile
  const firstLine = resume.parsedText.split(/\r?\n/).find((l) => l.trim().length > 0)?.trim()
  if (!firstLine || firstLine.length > 60) return null
  if (/@|\d{3}/.test(firstLine)) return null
  return firstLine
}

function overlapSkills(resume: ResumeProfile, opportunity: OpportunityProfile): string[] {
  const resumeSkills = new Set(
    resume.profile.skills.map((s) => s.name.toLowerCase()).filter(Boolean),
  )
  const fromResumeText = resume.parsedText.toLowerCase()
  return opportunity.profile.requiredSkills.filter((skill) => {
    const key = skill.toLowerCase()
    return resumeSkills.has(key) || fromResumeText.includes(key)
  })
}

/** Evidence-only cover letter draft — never invents qualifications. */
export function draftCoverLetter(args: {
  resume: ResumeProfile
  opportunity: OpportunityProfile
  tone?: CoverLetterTone
}): string {
  const { resume, opportunity } = args
  const tone = args.tone ?? "professional"
  const org = opportunity.organization?.trim() || "your organization"
  const title = opportunity.title?.trim() || "the open role"
  const name = inferApplicantName(resume)
  const signOff = name ?? "Applicant"

  const recentRole = resume.profile.experience[0]
  const education = resume.profile.education[0]
  const matchedSkills = overlapSkills(resume, opportunity).slice(0, 4)
  const summary = resume.profile.summary?.trim()

  const salutation = `Dear Hiring Manager,`
  const opening =
    tone === "warm"
      ? `I am excited to apply for the ${title} position at ${org}. After reviewing the opportunity, I believe my background aligns well with what you are looking for.`
      : `I am writing to express my interest in the ${title} position at ${org}. Based on my experience and the requirements outlined in your posting, I am confident I can contribute meaningfully to your team.`

  const experienceParts: string[] = []
  if (recentRole) {
    const span = [recentRole.startDate, recentRole.endDate].filter(Boolean).join(" – ")
    const detail = recentRole.bullets[0]?.trim()
    experienceParts.push(
      `In my role as ${recentRole.title} at ${recentRole.organization}${span ? ` (${span})` : ""}, I developed hands-on experience relevant to this opportunity${detail ? `: ${detail}` : "."}`,
    )
  } else if (summary) {
    experienceParts.push(summary)
  }

  if (education) {
    experienceParts.push(
      `I am pursuing/completed ${education.degree} at ${education.institution}${education.graduationDate ? ` (${education.graduationDate})` : ""}.`,
    )
  }

  const skillsPart =
    matchedSkills.length > 0
      ? `Your posting emphasizes ${matchedSkills.join(", ")}, which I have applied directly in my résumé materials and project work.`
      : opportunity.profile.responsibilities[0]
        ? `I am particularly drawn to responsibilities such as ${opportunity.profile.responsibilities[0].slice(0, 160)}.`
        : `I would welcome the chance to discuss how my background maps to the responsibilities described in your posting.`

  const closing =
    tone === "warm"
      ? `Thank you for considering my application. I would love to speak further about how I can support ${org}.`
      : `Thank you for your time and consideration. I look forward to the opportunity to discuss my application.`

  return [
    salutation,
    "",
    opening,
    "",
    ...experienceParts.map((p) => p + (p.endsWith(".") ? "" : ".")),
    ...(experienceParts.length ? [""] : []),
    skillsPart,
    "",
    closing,
    "",
    "Sincerely,",
    signOff,
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n")
}

export function splitCoverLetterParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}
