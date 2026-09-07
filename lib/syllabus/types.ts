import type { SyllabusTemplateProvenance } from "@/lib/syllabus-exchange/types"

export type SyllabusStatus = "draft" | "published"

export type SyllabusContentMode = "structured" | "pdf"

export type SyllabusSectionType =
  | "text"
  | "table"
  | "list"
  | "policy"
  | "schedule"
  | "grading"

export type SyllabusTableBlock = {
  title?: string
  columns: string[]
  rows: string[][]
}

export type SyllabusSectionContent = {
  markdown?: string
  fields?: Record<string, string>
  columns?: string[]
  rows?: string[][]
  /** Additional named tables (e.g. exam schedule + lecture schedule in one section). */
  tables?: SyllabusTableBlock[]
  items?: string[]
  /** Optional section image (e.g. textbook cover for required materials). */
  imageUrl?: string
  imageFileName?: string
  imageCaption?: string
  /** Optional PDF attachment (e.g. curriculum vitae section). */
  documentUrl?: string
  documentFileName?: string
}

export type SyllabusSection = {
  sectionId: string
  title: string
  order: number
  type: SyllabusSectionType
  content: SyllabusSectionContent
  isRequired: boolean
  isVisible: boolean
  isEditable: boolean
}

export type CourseSyllabus = {
  id: number
  courseId: number
  /** When set, this syllabus applies only to that section/session. */
  sessionId: number | null
  title: string
  term: string
  status: SyllabusStatus
  contentMode: SyllabusContentMode
  pdfUrl: string | null
  pdfFileName: string | null
  logoUrl: string | null
  logoFileName: string | null
  sections: SyllabusSection[]
  templateProvenance?: SyllabusTemplateProvenance | null
  createdBy: number | null
  updatedBy: number | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

export type CourseSyllabusPayload = {
  title?: string
  term?: string
  contentMode?: SyllabusContentMode
  sections: SyllabusSection[]
}
