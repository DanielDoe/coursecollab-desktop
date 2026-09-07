import type { SyllabusSection } from "@/lib/syllabus/types"

/** Clone syllabus sections for template apply; strip cross-course assets. */
export function cloneSectionsForTemplate(
  sections: SyllabusSection[],
  sameCourse: boolean,
): SyllabusSection[] {
  const stamp = Date.now()
  return sections.map((section, index) => {
    const sectionId = section.sectionId.startsWith("custom-")
      ? `custom-${stamp}-${index}`
      : section.sectionId

    const content = { ...section.content }
    if (!sameCourse) {
      delete content.imageUrl
      delete content.imageFileName
      delete content.imageCaption
    }

    return {
      ...section,
      sectionId,
      order: index + 1,
      content,
    }
  })
}
