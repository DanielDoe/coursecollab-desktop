import type { ClientScope } from "@/lib/data/types"

const ROOT = "cc" as const

function scopeParts(scope: ClientScope) {
  return [scope.role ?? "anon", scope.userId ?? "0", String(scope.courseId ?? "none"), scope.section ?? "all"] as const
}

/**
 * Cache keys always include role + user + course + section.
 * Faculty/admin payloads cannot collide with student sessions.
 */
export const queryKeys = {
  root: [ROOT] as const,
  scope: (scope: ClientScope) => [ROOT, ...scopeParts(scope)] as const,

  student: {
    notes: (scope: ClientScope) => [ROOT, ...scopeParts(scope), "student", "notes"] as const,
    courseNotes: (scope: ClientScope) => [ROOT, ...scopeParts(scope), "student", "courseNotes"] as const,
    flashcards: (scope: ClientScope, practiceHub = false) =>
      [ROOT, ...scopeParts(scope), "student", "flashcards", practiceHub ? "practice" : "all"] as const,
    announcements: (scope: ClientScope, studentId: string) =>
      [ROOT, ...scopeParts(scope), "student", "announcements", studentId] as const,
    lectures: (scope: ClientScope, studentId: string) =>
      [ROOT, ...scopeParts(scope), "student", "lectures", studentId] as const,
    lectureBookmarks: (scope: ClientScope, studentId: string) =>
      [ROOT, ...scopeParts(scope), "student", "lectureBookmarks", studentId] as const,
    lectureReminders: (scope: ClientScope, studentId: string) =>
      [ROOT, ...scopeParts(scope), "student", "lectureReminders", studentId] as const,
  },

  faculty: {
    announcements: (scope: ClientScope, instructorId: string) =>
      [ROOT, ...scopeParts(scope), "faculty", "announcements", instructorId] as const,
    courseNotes: (scope: ClientScope) => [ROOT, ...scopeParts(scope), "faculty", "courseNotes"] as const,
    courseNotesDeleted: (scope: ClientScope) =>
      [ROOT, ...scopeParts(scope), "faculty", "courseNotesDeleted"] as const,
    questionBank: (scope: ClientScope) => [ROOT, ...scopeParts(scope), "faculty", "questionBank"] as const,
    questionBankTopics: (scope: ClientScope) =>
      [ROOT, ...scopeParts(scope), "faculty", "questionBankTopics"] as const,
    questionBankDeleted: (scope: ClientScope) =>
      [ROOT, ...scopeParts(scope), "faculty", "questionBankDeleted"] as const,
    questionBankByTopic: (scope: ClientScope, topic: string) =>
      [ROOT, ...scopeParts(scope), "faculty", "questionBank", "topic", topic] as const,
    questionBankByType: (scope: ClientScope, type: string) =>
      [ROOT, ...scopeParts(scope), "faculty", "questionBank", "type", type] as const,
  },

  admin: {
    faculty: (scope: ClientScope) => [ROOT, ...scopeParts(scope), "admin", "faculty"] as const,
    students: (scope: ClientScope) => [ROOT, ...scopeParts(scope), "admin", "students"] as const,
    courses: (scope: ClientScope) => [ROOT, ...scopeParts(scope), "admin", "courses"] as const,
  },
}

export type QueryKeyPrefix = readonly unknown[]
