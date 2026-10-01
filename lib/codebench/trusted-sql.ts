import { resolveTrustedStudentCoraContext } from "@/lib/cora/governance/trusted-context"
import { sqlForVerifiedCourse, sqlForVerifiedInstitution } from "@/lib/tenant/course-content-sql"
import type { TenantSql } from "@/lib/db-tenant-context"

export async function sqlForCodebenchStudent(studentDbId: number): Promise<TenantSql | null> {
  const ctx = await resolveTrustedStudentCoraContext({ studentDbId })
  if (!ctx) return null
  return sqlForVerifiedInstitution(ctx.institutionId)
}

export async function sqlForCodebenchCourse(courseId: number): Promise<TenantSql> {
  return sqlForVerifiedCourse(courseId)
}
