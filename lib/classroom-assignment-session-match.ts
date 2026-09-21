import { sectionsAreAliasEquivalent } from "@/lib/session-code-aliases"

/** Student may only see / submit an assignment whose session equals their enrolled section. */
export function classroomAssignmentSessionMatchesStudent(
  assignmentSession: string | null | undefined,
  studentSession: string | null | undefined,
): boolean {
  return sectionsAreAliasEquivalent(String(assignmentSession ?? ""), String(studentSession ?? ""))
}

/**
 * Live classroom roster / list gate.
 * A blank assignment session is open-to-all. Otherwise match the student's
 * enrolled `sessions.code` or denormalized `students.section`, including aliases.
 */
export function studentMatchesLiveAssignmentSession(
  assignmentSession: string | null | undefined,
  studentSessionCode: string | null | undefined,
  studentSection?: string | null | undefined,
): boolean {
  const assignment = String(assignmentSession ?? "").trim()
  if (!assignment) return true
  return (
    classroomAssignmentSessionMatchesStudent(assignment, studentSessionCode) ||
    classroomAssignmentSessionMatchesStudent(assignment, studentSection)
  )
}
