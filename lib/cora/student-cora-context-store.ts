import {
  STUDENT_CORA_CONTEXT_VERSION,
  type StudentCoraContext,
} from "@/lib/cora/student-cora-context"
import {
  STUDENT_CORA_CAPABILITIES,
  tailorStudentCoraCapabilities,
  type StudentCoraCapability,
} from "@/lib/cora/student-capabilities"

const memoryCache = new Map<string, StudentCoraContext>()

function storageKey(studentId: string): string {
  return `studentCoraContext:${studentId}`
}

export function getStudentCoraContextFromMemory(studentId: string): StudentCoraContext | null {
  return memoryCache.get(studentId) ?? null
}

export function loadStudentCoraContext(studentId: string): StudentCoraContext | null {
  if (typeof window === "undefined" || !studentId) return null
  const cached = memoryCache.get(studentId)
  if (cached) return cached

  try {
    const raw = localStorage.getItem(storageKey(studentId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StudentCoraContext
    if (parsed.version !== STUDENT_CORA_CONTEXT_VERSION || !parsed.setupComplete) return null
    if (parsed.studentId !== studentId) return null
    memoryCache.set(studentId, parsed)
    return parsed
  } catch {
    return null
  }
}

export function saveStudentCoraContext(context: StudentCoraContext): void {
  if (typeof window === "undefined") return
  memoryCache.set(context.studentId, context)
  try {
    localStorage.setItem(storageKey(context.studentId), JSON.stringify(context))
  } catch {
    /* non-fatal */
  }
}

export function clearStudentCoraContext(studentId: string): void {
  memoryCache.delete(studentId)
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(storageKey(studentId))
  } catch {
    /* non-fatal */
  }
}

export function resolveStudentCoraCapabilities(context: StudentCoraContext | null): StudentCoraCapability[] {
  if (context?.payload && context.setupComplete) {
    return tailorStudentCoraCapabilities(context.payload)
  }
  return STUDENT_CORA_CAPABILITIES
}

/** Re-fetch platform data when Cora hub opens after this interval. */
export const STUDENT_CORA_CONTEXT_STALE_MS = 20 * 60 * 1000

export function isStudentCoraContextStale(context: StudentCoraContext | null): boolean {
  if (!context?.generatedAt) return true
  const age = Date.now() - new Date(context.generatedAt).getTime()
  return !Number.isFinite(age) || age > STUDENT_CORA_CONTEXT_STALE_MS
}
