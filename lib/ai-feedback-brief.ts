/** Two short sentences for student-facing AI grade copy. */
export function briefAiFeedback(text: string | null | undefined, maxChars = 280): string {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim()
  if (!clean) return ""
  const two = clean.split(/(?<=[.!])\s+/).slice(0, 2).join(" ")
  if (two.length <= maxChars) return two
  return `${two.slice(0, maxChars).replace(/\s+\S*$/, "")}…`
}
