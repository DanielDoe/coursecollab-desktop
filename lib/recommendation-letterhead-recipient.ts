/**
 * Inside address block (business letter): lines after the date, before "Dear …".
 * Addressee name is not repeated here — it appears only in the salutation so the letter
 * doesn't show the same line twice. This block is organization (if any) + mailing lines
 * from `recipient_address`.
 */
export function buildRecipientInsideAddressLines(input: {
  letter_is_specific?: boolean | null
  recipient_name?: string | null
  recipient_organization?: string | null
  recipient_address?: string | null
}): string[] | undefined {
  if (!input.letter_is_specific) return undefined
  const lines: string[] = []
  const org = typeof input.recipient_organization === "string" ? input.recipient_organization.trim() : ""
  const addrRaw = typeof input.recipient_address === "string" ? input.recipient_address.trim() : ""
  if (org) lines.push(org)
  if (addrRaw) {
    for (const segment of addrRaw.split(/\r?\n/)) {
      const t = segment.trim()
      if (t) lines.push(t)
    }
  }

  const salutation = recommendationRecipientSalutationName({
    recipient_name: input.recipient_name,
    recipient_organization: input.recipient_organization,
  })
  if (lines.length === 1 && salutation && lines[0].trim() === salutation.trim()) {
    return undefined
  }

  return lines.length > 0 ? lines : undefined
}

/** Single line salutation target: prefer addressee name, else organization. */
export function recommendationRecipientSalutationName(input: {
  recipient_name?: string | null
  recipient_organization?: string | null
}): string | null {
  const name = typeof input.recipient_name === "string" ? input.recipient_name.trim() : ""
  if (name) return name
  const org = typeof input.recipient_organization === "string" ? input.recipient_organization.trim() : ""
  return org ? org : null
}
