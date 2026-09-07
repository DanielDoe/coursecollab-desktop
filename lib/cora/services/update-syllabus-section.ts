/**
 * Shared syllabus section update — Web editor and Cora confirm both call syllabus-service.
 */

import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"
import {
  getOrCreateSyllabusForCourse,
  publishSyllabus,
  saveSyllabusDraft,
} from "@/lib/syllabus/syllabus-service"
import type {
  CourseSyllabus,
  SyllabusSection,
  SyllabusSectionType,
} from "@/lib/syllabus/types"

function newSectionId(): string {
  return `sec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export type UpdateSyllabusSectionInput = {
  instructorId: number
  courseId: number
  sectionTitle: string
  markdown: string
  sectionType?: SyllabusSectionType
  /** When true, publish after update (high risk). Default: save draft only. */
  publish?: boolean
}

export type UpdateSyllabusSectionResult = {
  syllabus: CourseSyllabus
  sectionId: string
  created: boolean
  published: boolean
}

export async function updateSyllabusSection(
  input: UpdateSyllabusSectionInput,
): Promise<UpdateSyllabusSectionResult> {
  const sectionTitle = String(input.sectionTitle ?? "").trim()
  const markdown = String(input.markdown ?? "").trim()
  if (!sectionTitle) throw new Error("Section title is required.")
  if (!markdown) throw new Error("Section content is required.")

  const allowed = await instructorCanAccessCourse(input.instructorId, input.courseId)
  if (!allowed) throw new Error("Instructor cannot update syllabus for this course.")

  const existing = await getOrCreateSyllabusForCourse(input.courseId, input.instructorId)
  const sections = [...(existing.sections ?? [])]
  const matchIdx = sections.findIndex(
    (s) => s.title.trim().toLowerCase() === sectionTitle.toLowerCase(),
  )

  let sectionId: string
  let created = false
  if (matchIdx >= 0) {
    const prev = sections[matchIdx]!
    sectionId = prev.sectionId
    sections[matchIdx] = {
      ...prev,
      content: {
        ...prev.content,
        markdown,
      },
      isVisible: true,
    }
  } else {
    created = true
    sectionId = newSectionId()
    const section: SyllabusSection = {
      sectionId,
      title: sectionTitle,
      order: sections.length + 1,
      type: input.sectionType ?? "text",
      content: { markdown },
      isRequired: false,
      isVisible: true,
      isEditable: true,
    }
    sections.push(section)
  }

  const payload = {
    title: existing.title,
    term: existing.term,
    contentMode: existing.contentMode,
    sections,
  }

  const publish = input.publish === true
  const syllabus = publish
    ? await publishSyllabus(input.courseId, payload, input.instructorId)
    : await saveSyllabusDraft(input.courseId, payload, input.instructorId)

  return { syllabus, sectionId, created, published: publish }
}
