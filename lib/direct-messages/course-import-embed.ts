const EMBED_RE = /\[\[cc-course-import:v1\]\]/i

export function hasCourseImportEmbed(body: string): boolean {
  return EMBED_RE.test(body)
}
