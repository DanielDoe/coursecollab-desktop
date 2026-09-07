export type LectureContentMode = "pdf" | "ppt_converted_pdf" | "html_legacy"

export function normalizeLearningObjectives(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x))
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown
      return Array.isArray(p) ? p.map((x) => String(x)) : []
    } catch {
      return []
    }
  }
  return []
}

export function mapLectureRowToViewerPayload(lecture: Record<string, unknown>, slides: unknown[]) {
  const objectivesRaw =
    lecture.learning_objectives ?? lecture.objectives ?? lecture.learningObjectives

  const pdfUrl = (lecture.pdf_url ?? lecture.pdfUrl ?? null) as string | null
  const contentMode = (lecture.content_mode ?? lecture.contentMode ?? "html_legacy") as string

  return {
    id: lecture.id,
    courseId: lecture.course_id ?? lecture.courseId ?? null,
    sectionId: lecture.section_id ?? lecture.sectionId ?? null,
    week: lecture.week,
    title: lecture.title,
    description: lecture.description ?? "",
    learning_objectives: normalizeLearningObjectives(objectivesRaw),
    originalFileUrl: (lecture.original_file_url ?? lecture.originalFileUrl ?? null) as string | null,
    originalFileType: (lecture.original_file_type ?? lecture.originalFileType ?? null) as string | null,
    pdfUrl,
    thumbnailUrl: (lecture.thumbnail_url ?? lecture.thumbnailUrl ?? null) as string | null,
    contentMode: (["pdf", "ppt_converted_pdf", "html_legacy"].includes(contentMode)
      ? contentMode
      : "html_legacy") as LectureContentMode,
    allowDownload: Boolean(lecture.allow_download ?? lecture.allowDownload),
    isPublished: lecture.is_published !== false && lecture.isPublished !== false,
    createdAt: lecture.created_at ?? lecture.createdAt,
    updatedAt: lecture.updated_at ?? lecture.updatedAt,
    slides,
  }
}
