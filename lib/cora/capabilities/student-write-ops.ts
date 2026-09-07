import type { StudentCoraOperation } from "@/lib/cora/capabilities/student-module-registry"

/** Student mutation operations Cora may propose via registry capabilities. */
export const STUDENT_MUTATION_OPS = new Set<StudentCoraOperation>([
  "create",
  "update",
  "delete",
  "send",
  "book",
  "cancel",
  "join",
  "leave",
  "submit",
  "start",
  "generate",
])

export function isStudentMutationOperation(op: string): op is StudentCoraOperation {
  return STUDENT_MUTATION_OPS.has(op as StudentCoraOperation)
}

export function buildStudentCapabilityId(module: string, operation: string): string {
  return `${module}.${operation}`
}

export function parseStudentCapabilityId(capabilityId: string): { module: string; operation: string } | null {
  const dot = capabilityId.indexOf(".")
  if (dot <= 0) return null
  return {
    module: capabilityId.slice(0, dot),
    operation: capabilityId.slice(dot + 1),
  }
}
