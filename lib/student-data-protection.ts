/**
 * Production guards + audit for student activity records (playground, quizzes, roster, etc.).
 * Deletes on production are blocked unless ALLOW_PROD_STUDENT_DATA_MUTATION=1 is set server-side.
 */
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  PROTECTED_STUDENT_DATA_TYPES,
  STUDENT_DATA_DELETE_CONFIRM_PHRASE,
  type ProtectedStudentDataType,
} from "@/lib/student-data-delete-confirm"

export {
  PROTECTED_STUDENT_DATA_TYPES,
  STUDENT_DATA_DELETE_CONFIRM_PHRASE,
  type ProtectedStudentDataType,
}

const ALLOW_ENV = "ALLOW_PROD_STUDENT_DATA_MUTATION"
const LEGACY_ALLOW_ENV = "ALLOW_PROD_PLAYGROUND_MUTATION"

function databaseUrl(): string {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    ""
  )
}

export function isProductionDatabaseUrl(url = databaseUrl()): boolean {
  if (!url) return false
  const lower = url.toLowerCase()
  if (lower.includes("localhost") || lower.includes("127.0.0.1")) return false
  if (process.env.NODE_ENV === "production" && !lower.includes("preview")) return true
  if (lower.includes(".neon.tech")) return true
  if (process.env.VERCEL_ENV === "production") return true
  if (process.env.NEON_PROJECT_ID && lower.includes("neon")) return true
  return false
}

export function isProductionStudentDataTarget(): boolean {
  return isProductionDatabaseUrl() || process.env.VERCEL_ENV === "production"
}

export function isProdStudentDataMutationAllowed(): boolean {
  return process.env[ALLOW_ENV] === "1" || process.env[LEGACY_ALLOW_ENV] === "1"
}

export type StudentDataDeleteGuardFailure = {
  blocked: true
  code: string
  message: string
}

export type StudentDataDeleteGuardResult =
  | { blocked: false }
  | StudentDataDeleteGuardFailure

export function checkStudentRecordDeleteAllowed(options: {
  bulk?: boolean
  confirmPhrase?: string | null
  affectedRowEstimate?: number
  allowLiveSessionReset?: boolean
  operation?: string
}): StudentDataDeleteGuardResult {
  const {
    bulk = false,
    confirmPhrase,
    affectedRowEstimate = 0,
    allowLiveSessionReset = false,
    operation = "delete student records",
  } = options

  const onProd = isProductionStudentDataTarget()
  const envAllowed = isProdStudentDataMutationAllowed()
  const hasStudentData = bulk || affectedRowEstimate > 0

  if (allowLiveSessionReset && !bulk) {
    return { blocked: false }
  }

  if (hasStudentData && onProd && !envAllowed) {
    return {
      blocked: true,
      code: "student_data_prod_delete_blocked",
      message:
        `${operation} is disabled on production to protect student records. ` +
        "Contact the course owner before any delete. Ops may set ALLOW_PROD_STUDENT_DATA_MUTATION=1 only for approved maintenance.",
    }
  }

  if (hasStudentData && confirmPhrase !== STUDENT_DATA_DELETE_CONFIRM_PHRASE) {
    return {
      blocked: true,
      code: "student_data_confirm_required",
      message: `Confirmation required. Type exactly: ${STUDENT_DATA_DELETE_CONFIRM_PHRASE}`,
    }
  }

  return { blocked: false }
}

export function studentDataDeleteGuardResponse(
  failure: StudentDataDeleteGuardFailure,
): NextResponse {
  return NextResponse.json(
    { error: failure.message, code: failure.code },
    { status: 403 },
  )
}

export function assertProdStudentDataScriptAllowed(
  scriptName: string,
  reason = "mutate or delete student activity data",
): void {
  if (!isProductionDatabaseUrl()) return
  if (isProdStudentDataMutationAllowed()) return

  console.error(
    [
      `[student-data-guard] Refusing to run ${scriptName} against production database (${reason}).`,
      `Set ${ALLOW_ENV}=1 only after explicit instructor approval.`,
      "Use a Neon dev branch or local DATABASE_URL for test prep and cleanup.",
    ].join("\n"),
  )
  process.exit(1)
}

/** @deprecated Use assertProdStudentDataScriptAllowed */
export function assertProdPlaygroundMutationAllowed(scriptName: string): void {
  assertProdStudentDataScriptAllowed(scriptName, "delete playground student data")
}

export async function logStudentDataDeleteAudit(params: {
  source: string
  action?: string
  actorId?: number | null
  actorType?: "instructor" | "admin" | "script" | "system"
  courseId?: number | null
  entityType?: string
  entityId?: number | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  await sql`
    INSERT INTO audit_logs (
      actor_id,
      actor_type,
      action,
      entity_type,
      entity_id,
      course_id,
      metadata
    )
    VALUES (
      ${params.actorId ?? null},
      ${params.actorType ?? "system"},
      ${params.action ?? "student_data_deleted"},
      ${params.entityType ?? "student_data"},
      ${params.entityId ?? null},
      ${params.courseId != null && params.courseId > 0 ? params.courseId : null},
      ${JSON.stringify({ source: params.source, ...(params.metadata ?? {}) })}::jsonb
    )
  `
}

/** Back-compat wrappers for playground-specific guard names */
export const isProdPlaygroundMutationAllowed = isProdStudentDataMutationAllowed
export const isProductionPlaygroundTarget = isProductionStudentDataTarget
export const checkPlaygroundStudentDataDeleteAllowed = checkStudentRecordDeleteAllowed
export const playgroundDeleteGuardResponse = studentDataDeleteGuardResponse
