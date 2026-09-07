import templateJson from "@/data/syllabus-generic-template.json"
import type { SyllabusSection, SyllabusSectionContent } from "@/lib/syllabus/types"

export type SyllabusTemplateDefaults = {
  title: string
  term: string
  sections: SyllabusSection[]
}

function cloneContent(content: SyllabusSectionContent): SyllabusSectionContent {
  return {
    markdown: content.markdown,
    fields: content.fields ? { ...content.fields } : undefined,
    columns: content.columns ? [...content.columns] : undefined,
    rows: content.rows ? content.rows.map((row) => [...row]) : undefined,
    items: content.items ? [...content.items] : undefined,
  }
}

/** Returns a deep copy of the generic syllabus template with placeholder content. */
export function getDefaultSyllabusTemplate(
  overrides?: Partial<{ title: string; term: string; courseCode: string; courseTitle: string }>,
): SyllabusTemplateDefaults {
  const raw = templateJson as SyllabusTemplateDefaults
  const title =
    overrides?.title ??
    (overrides?.courseCode && overrides?.courseTitle
      ? `${overrides.courseCode} — ${overrides.courseTitle} Syllabus`
      : raw.title)
  const term = overrides?.term ?? raw.term

  const sections: SyllabusSection[] = raw.sections.map((section) => ({
    ...section,
    content: cloneContent(section.content),
  }))

  if (overrides?.courseCode || overrides?.courseTitle) {
    const header = sections.find((s) => s.sectionId === "course-header")
    if (header?.content.fields) {
      if (overrides.courseCode) header.content.fields["Course Code"] = overrides.courseCode
      if (overrides.courseTitle) header.content.fields["Course Title"] = overrides.courseTitle
    }
  }

  return { title, term, sections }
}
