/**
 * Send notification emails to students
 * Fetches student email from DB, sends only if valid email on file
 */

import { sql } from "@/lib/db"
import { sendEmail } from "./sendEmail"
import type { EmailType } from "./emailTypes"
import type { EmailParams } from "./sendEmail"

const PLACEHOLDER_DOMAIN = "@student.placeholder.edu"

/** Check if email is valid (not null, not empty, not placeholder) */
export function isValidStudentEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) return false
  if (trimmed.endsWith(PLACEHOLDER_DOMAIN)) return false
  if (!trimmed.includes("@")) return false
  return true
}

/** Get student email by internal ID or student_id string */
export async function getStudentEmail(
  studentId: string | number
): Promise<string | null> {
  const result =
    typeof studentId === "number"
      ? await sql`SELECT email, full_name FROM students WHERE id = ${studentId} LIMIT 1`
      : await sql`SELECT email, full_name FROM students WHERE student_id = ${studentId} LIMIT 1`
  const row = result[0] as { email: string | null; full_name: string } | undefined
  return row && isValidStudentEmail(row.email) ? row.email!.trim() : null
}

/** Get student by ID - returns { email, full_name } or null */
export async function getStudentForEmail(
  studentId: string | number
): Promise<{ email: string; name: string } | null> {
  const result =
    typeof studentId === "number"
      ? await sql`SELECT email, full_name FROM students WHERE id = ${studentId} LIMIT 1`
      : await sql`SELECT email, full_name FROM students WHERE student_id = ${studentId} LIMIT 1`
  const row = result[0] as { email: string | null; full_name: string } | undefined
  if (!row || !isValidStudentEmail(row.email)) return null
  return { email: row.email!.trim(), name: row.full_name || "Student" }
}

/**
 * Send notification email to a student
 * Returns { sent: true } if email sent, { sent: false, reason } if skipped
 */
export async function sendNotificationEmail<T extends EmailType>(
  studentId: string | number,
  type: T,
  params: EmailParams[T]
): Promise<{ sent: boolean; reason?: string }> {
  const student = await getStudentForEmail(studentId)
  if (!student) {
    return { sent: false, reason: "No valid email on file" }
  }

  const result = await sendEmail(type, student.email, params)
  if (result.success) {
    return { sent: true }
  }
  return { sent: false, reason: result.error }
}

/** Get students with valid emails, optionally filtered by session ID(s) */
export async function getStudentsWithEmails(
  sessionIds?: number | number[]
): Promise<{ id: number; email: string; name: string }[]> {
  const ids = sessionIds != null ? (Array.isArray(sessionIds) ? sessionIds : [sessionIds]) : null
  const rows = ids
    ? await sql`
        SELECT id, email, full_name
        FROM students
        WHERE session_id = ANY(${ids})
      `
    : await sql`SELECT id, email, full_name FROM students`
  return (rows as { id: number; email: string | null; full_name: string }[])
    .filter((r) => isValidStudentEmail(r.email))
    .map((r) => ({ id: r.id, email: r.email!.trim(), name: r.full_name || "Student" }))
}

/**
 * Send notification emails to multiple students
 * Only sends to those with valid emails on file
 */
export async function sendBulkNotificationEmails<T extends EmailType>(
  studentIds: (string | number)[],
  type: T,
  params: Omit<EmailParams[T], "name"> & { name?: string }
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const errors: string[] = []
  let sent = 0
  let skipped = 0

  for (const id of studentIds) {
    const student = await getStudentForEmail(id)
    if (!student) {
      skipped++
      continue
    }

    const fullParams = {
      ...params,
      name: params.name ?? student.name,
    } as EmailParams[T]

    const result = await sendEmail(type, student.email, fullParams)
    if (result.success) {
      sent++
    } else {
      skipped++
      if (result.error) errors.push(`${student.email}: ${result.error}`)
    }
  }

  return { sent, skipped, errors }
}
