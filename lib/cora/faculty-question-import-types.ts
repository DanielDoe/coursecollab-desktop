export type FacultyImportSourceKey =
  | "question_bank"
  | "quizzes"
  | "homework"
  | "mid_semester"
  | "final"

export type FacultyImportSourceOption = {
  key: FacultyImportSourceKey
  label: string
  description: string
  count: number
}

export type FacultyImportContainerOption = {
  id: string
  label: string
  subtitle?: string
  count?: number
}
