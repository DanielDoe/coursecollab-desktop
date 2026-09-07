import type { ResumeProfile } from "@/lib/guest/career/types"
import { upsertGuestCoraProfile } from "@/lib/cora/fetch-guest-context"

/** Derive a factual career summary from résumé text — no invented claims. */
export function buildCareerSummaryFromResume(resume: ResumeProfile): string {
  const parts: string[] = []
  const contact = resume.profile.contactInformation
  if (contact.name) parts.push(`Name: ${contact.name}`)

  const roles = resume.profile.experience.slice(0, 3).map((e) => {
    const span = [e.startDate, e.endDate].filter(Boolean).join("–")
    return `${e.title} at ${e.organization}${span ? ` (${span})` : ""}`
  })
  if (roles.length) parts.push(`Recent roles: ${roles.join("; ")}`)

  const edu = resume.profile.education[0]
  if (edu) parts.push(`Education: ${edu.degree} at ${edu.institution}`)

  const skills = resume.profile.skills.slice(0, 10).map((s) => s.name)
  if (skills.length) parts.push(`Skills: ${skills.join(", ")}`)

  if (resume.profile.summary?.trim()) {
    parts.push(resume.profile.summary.trim().slice(0, 400))
  }

  return parts.join(". ") || resume.parsedText.slice(0, 500) || (resume.originalFileName ? `Résumé on file: ${resume.originalFileName}` : "")
}

export async function syncGuestProfileFromMasterResume(
  guestId: number,
  resume: ResumeProfile,
): Promise<void> {
  const careerSummary = buildCareerSummaryFromResume(resume)
  const targetRoles = resume.profile.experience.slice(0, 3).map((e) => e.title).filter(Boolean)

  await upsertGuestCoraProfile(guestId, {
    careerSummary,
    targetRoles: targetRoles.length ? targetRoles : undefined,
    coraNotes: {
      master_resume_id: resume.id,
      master_resume_updated_at: resume.updatedAt,
      master_resume_hash: resume.contentHash,
    },
  })
}
