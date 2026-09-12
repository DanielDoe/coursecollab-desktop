import { sectionsAreAliasEquivalent } from "@/lib/session-code-aliases"

/** Student may only see / submit an assignment whose session equals their enrolled section. */
export function classroomAssignmentSessionMatchesStudent(
  assignmentSession: string | null | undefined,
  studentSession: string | null | undefined,
): boolean {
  return sectionsAreAliasEquivalent(String(assignmentSession ?? ""), String(studentSession ?? ""))
}
