/** URL-safe slug segment for camps and training tracks. */
export function slugifySegment(input: string, fallback = "item"): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
  return slug || fallback
}
