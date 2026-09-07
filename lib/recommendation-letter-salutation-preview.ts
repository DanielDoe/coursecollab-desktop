/** Preview line for letterhead greeting (matches LetterheadLetterPreview). */
export function formatLetterSalutationPreview(recipientName: string, recipientOrganization = ""): string {
  const target = recipientName.trim() || recipientOrganization.trim()
  if (!target) return "To Whom It May Concern:"
  const lower = target.toLowerCase()
  if (lower === "to whom it may concern" || lower === "to whom it may concern:") return "To Whom It May Concern:"
  if (lower.startsWith("dear ")) return target.endsWith(":") ? target : `${target}:`
  return `Dear ${target}:`
}
