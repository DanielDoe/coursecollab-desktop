/**
 * Distinguish platform guests from enrolled course students.
 * Never treat `students` table membership alone as proof of enrollment.
 */

export type StudentIdentityFlags = {
  is_platform_guest?: boolean | null
  isPlatformGuest?: boolean | null
  section?: string | null
  student_program_role?: string | null
}

export function isPlatformGuestIdentity(row: StudentIdentityFlags | null | undefined): boolean {
  if (!row) return false
  return Boolean(row.is_platform_guest ?? row.isPlatformGuest)
}

/** Enrolled roster student — not a platform guest. */
export function isEnrolledStudentIdentity(row: StudentIdentityFlags | null | undefined): boolean {
  if (!row) return false
  if (isPlatformGuestIdentity(row)) return false
  const section = String(row.section ?? "").trim().toUpperCase()
  if (section === "GUEST") return false
  const role = String(row.student_program_role ?? "").trim().toLowerCase()
  if (role === "platform_guest") return false
  return true
}
