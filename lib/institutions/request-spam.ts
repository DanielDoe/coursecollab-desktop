export type InstitutionRequestFields = {
  institutionName: string
  contactName: string
  contactEmail: string
  domain?: string | null
  jobTitle?: string | null
  department?: string | null
  desiredScope?: string | null
}

/** Single mixed-case token like eQLYgSUqAiUcztvJzbJXf. Real names have spaces or normal casing. */
export function looksLikeRandomToken(value: string): boolean {
  const text = value.trim()
  if (text.length < 10) return false
  if (/[\s,.'’-]/.test(text)) return false
  if (!/^[A-Za-z0-9]+$/.test(text)) return false
  let transitions = 0
  for (let i = 1; i < text.length; i++) {
    const prev = text[i - 1]
    const curr = text[i]
    if (!/[A-Za-z]/.test(prev) || !/[A-Za-z]/.test(curr)) continue
    const prevLower = prev === prev.toLowerCase()
    const currLower = curr === curr.toLowerCase()
    if (prevLower !== currLower) transitions += 1
  }
  return transitions >= 4
}

function stuffedLocalPart(email: string): boolean {
  const local = email.split("@")[0] ?? ""
  const dots = local.split(".").length - 1
  if (dots >= 3) return true
  const singleCharParts = local.split(".").filter((part) => part.length === 1).length
  return singleCharParts >= 3
}

function invalidDomain(domain: string): boolean {
  const text = domain.trim()
  if (!text) return false
  if (looksLikeRandomToken(text)) return true
  return !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)+$/i.test(text)
}

export function institutionRequestSpamReason(input: InstitutionRequestFields): string | null {
  const email = input.contactEmail.trim().toLowerCase()
  if (stuffedLocalPart(email)) return "stuffed-email"
  const labeled = [
    input.institutionName,
    input.contactName,
    input.domain,
    input.jobTitle,
    input.department,
    input.desiredScope,
  ]
  for (const value of labeled) {
    if (value && looksLikeRandomToken(value)) return "random-token"
  }
  if (input.domain && invalidDomain(input.domain)) return "invalid-domain"
  return null
}
