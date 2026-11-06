export function slugifySectionKey(title: string, index: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
  return base ? `${base}-${index + 1}` : `section-${index + 1}`
}
