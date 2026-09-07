import type { SyllabusContentMode, SyllabusStatus } from "@/lib/syllabus/types"

export type SyllabusTemplateProvenance = {
  sourceSyllabusId: number
  sourceCourseId: number
  sourceCourseCode: string
  sourceCourseTitle: string
  sourceInstructorId: number
  sourceInstructorName: string
  sourceTerm: string
  sourceSessionCode: string | null
  copiedAt: string
  copyRecordId: number
}

export type DiscoverableSyllabusRow = {
  syllabusId: number
  courseId: number
  sessionId: number | null
  courseCode: string
  courseTitle: string
  sessionCode: string | null
  university: string | null
  title: string
  term: string
  status: SyllabusStatus
  contentMode: SyllabusContentMode
  sectionCount: number
  hasPdf: boolean
  instructorId: number
  instructorName: string
  publishedAt: string | null
  updatedAt: string
  isOwnCourse: boolean
}

export type SyllabusExchangeCopyRow = {
  id: number
  sourceSyllabusId: number
  destinationSyllabusId: number
  sourceCourseId: number
  destinationCourseId: number
  sourceInstructorId: number
  destinationInstructorId: number
  attribution: SyllabusTemplateProvenance
  createdAt: string
}
