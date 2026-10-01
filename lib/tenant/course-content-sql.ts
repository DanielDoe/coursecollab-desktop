import { sql } from "@/lib/db"
import { createInstitutionSql, withPlatformPrivilegedDbContext, type TenantSql } from "@/lib/db-tenant-context"
import { resolveAttemptTenant, resolveCourseTenant } from "@/lib/tenant/resource"

/**
 * Tenant-scoped SQL after Stage 4 has verified the institution.
 * Personal/demo courses (null institution) use an explicit privileged path.
 */
export async function sqlForVerifiedInstitution(
  institutionId: number | null | undefined,
): Promise<TenantSql> {
  const id = institutionId == null ? null : Math.trunc(Number(institutionId))
  if (id != null && Number.isInteger(id) && id >= 1) {
    return createInstitutionSql(id)
  }
  const privileged: TenantSql = async (strings, ...values) => {
    const rows = await withPlatformPrivilegedDbContext(
      "personal_or_demo_course_content",
      () => sql(strings, ...values),
    )
    return (Array.isArray(rows) ? rows : []) as any[]
  }
  return privileged
}

/**
 * Bootstrap course → institution (privileged, metadata only), then tenant SQL.
 * Call only after the actor is authorized for this course.
 */
export async function sqlForVerifiedCourse(courseId: number): Promise<TenantSql> {
  const tenant = await resolveCourseTenant(courseId)
  return sqlForVerifiedInstitution(tenant?.institutionId ?? null)
}

/**
 * Bootstrap attempt → quiz → course → institution (privileged metadata), then tenant SQL.
 * Call only after the actor is authorized for this attempt.
 */
export async function sqlForVerifiedAttempt(attemptId: number): Promise<TenantSql> {
  const tenant = await resolveAttemptTenant(attemptId)
  return sqlForVerifiedInstitution(tenant?.institutionId ?? null)
}
