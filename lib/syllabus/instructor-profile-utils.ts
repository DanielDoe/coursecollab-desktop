export function findInstructorNameField(fields: Record<string, string>): string | null {
  const entry = Object.entries(fields).find(([key]) => /instructor\s*name|^name$/i.test(key.trim()))
  return entry?.[1]?.trim() || null
}

export { initialsFromName } from "@/lib/initials-from-name"

export function isInstructorNameLabel(label: string): boolean {
  return /instructor\s*name|^name$/i.test(label.trim())
}
