/**
 * Public URL segment for a note: lowercase slug from title + "-" + numeric id (unique, stable per row).
 * Example: "introduction-to-sorting-42"
 */
export function makeNotePublicSlug(title: string, id: number): string {
  const raw = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 72)
  const base = raw || "lecture"
  return `${base}-${id}`
}
