import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { getActiveInstitutionLicense } from "@/lib/institutions/licenses"
import { getInstitutionPlan } from "@/lib/institution-plans"
import { getInstitutionDashboardMetrics } from "@/lib/institutions/metrics/dashboard"
import type { InstitutionAdminRole } from "@/lib/institutions/auth"
import type { InstitutionDatePreset } from "@/lib/institutions/metrics/constants"

/** @deprecated Use getInstitutionDashboardMetrics — kept for legacy callers. */
export async function getInstitutionOverview(
  institutionId: number,
  opts?: { role?: InstitutionAdminRole; preset?: InstitutionDatePreset; from?: string; to?: string },
) {
  await ensureInstitutionSchema()
  const metrics = await getInstitutionDashboardMetrics(institutionId, opts?.role ?? "institution_admin", {
    institutionId,
    licenseId: null,
    from: opts?.from ?? "",
    to: opts?.to ?? "",
    preset: opts?.preset ?? "last_30_days",
  })
  if (!metrics) return null

  const instRows = await sql`
    SELECT id, name, legal_name, slug, domain, institution_type, status, logo_url, website
    FROM universities WHERE id = ${institutionId} LIMIT 1
  `
  const institution = instRows[0]
  const license = await getActiveInstitutionLicense(institutionId)
  const licenseId = license ? Number(license.id) : null
  const plan = license ? getInstitutionPlan(String(license.plan_id)) : null
  const included = metrics.coraUsage.creditsConsumed + metrics.coraUsage.creditsRemaining

  return {
    ...metrics,
    institution: institution
      ? {
          id: Number(institution.id),
          name: String(institution.name),
          legalName: institution.legal_name ? String(institution.legal_name) : null,
          slug: institution.slug ? String(institution.slug) : null,
          domain: institution.domain ? String(institution.domain) : null,
          type: String(institution.institution_type ?? "university"),
          status: String(institution.status ?? "active"),
        }
      : { id: institutionId, name: metrics.header.institutionName, status: "active" },
    license: license
      ? {
          id: licenseId,
          planId: String(license.plan_id),
          planName: plan?.displayName ?? String(license.plan_id),
          status: String(license.status),
          contractStatus: String(license.contract_status),
          startDate: license.start_date,
          endDate: license.end_date,
          billingMethod: String(license.billing_method),
          seatLimitStudents: metrics.licenseUtilization.licensedCapacity,
          includedCoraCredits: included,
        }
      : null,
    utilization: {
      activeStudents: metrics.licenseUtilization.currentActiveLearners,
      enrolledRoster: metrics.licenseUtilization.currentActiveLearners,
      coveredInstructors: metrics.licenseUtilization.coveredInstructors,
      courses: metrics.licenseUtilization.coveredCourses,
      organizationUnits: 0,
      seatUtilization: metrics.licenseUtilization.utilizationPercent,
    },
    cora: {
      included,
      used: metrics.coraUsage.creditsConsumed,
      remaining: metrics.coraUsage.creditsRemaining,
      workflows: metrics.coraUsage.workflowsThisPeriod,
      credits: metrics.coraUsage.creditsConsumed,
    },
    grading: {
      automatedVolume: metrics.assessmentAutomation.autoGraded,
      estimatedInstructorHoursSaved: metrics.instructorProductivity.estimatedHoursSaved,
    },
    series: {
      weekly: metrics.coraUsage.weeklyTrend,
      workflows: metrics.featureAdoption.instructor,
      roles: [],
      hasActivity: metrics.coraUsage.workflowsThisPeriod > 0,
    },
  }
}
