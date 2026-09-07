import type { SyllabusSection, SyllabusTableBlock } from "@/lib/syllabus/types"

const EXAM_SECTION_ID = "exam-quiz-schedule"
const SCHEDULE_SECTION_ID = "schedule-assessments"

/** Fold standalone exam schedule into Course Schedule section for student display. */
export function mergeExamScheduleIntoAssessments(sections: SyllabusSection[]): SyllabusSection[] {
  const examSection = sections.find((s) => s.sectionId === EXAM_SECTION_ID)
  if (!examSection?.content.columns?.length) {
    return sections.filter((s) => s.sectionId !== EXAM_SECTION_ID || s.isVisible)
  }

  const examTable: SyllabusTableBlock = {
    title: "Recommended Exam and Quiz Dates",
    columns: examSection.content.columns,
    rows: examSection.content.rows ?? [],
  }

  return sections
    .filter((s) => s.sectionId !== EXAM_SECTION_ID)
    .map((section) => {
      if (section.sectionId !== SCHEDULE_SECTION_ID) return section

      const existingTables = section.content.tables ?? []
      const hasExamTable = existingTables.some((t) =>
        /exam|quiz|assessment/i.test(t.title ?? ""),
      )

      return {
        ...section,
        content: {
          ...section.content,
          tables: hasExamTable ? existingTables : [...existingTables, examTable],
        },
      }
    })
}

export function getStudentVisibleSections(sections: SyllabusSection[]): SyllabusSection[] {
  return mergeExamScheduleIntoAssessments(sections).filter(
    (s) => s.isVisible && s.sectionId !== "course-header",
  )
}
