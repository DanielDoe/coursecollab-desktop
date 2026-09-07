import { sql } from "@/lib/db"
import { getInstitutionPlan, type InstitutionFeatureFlag } from "@/lib/institution-plans"
import { getActiveInstitutionLicense, listInstitutionLicenses, countCoveredStudents } from "@/lib/institutions/licenses"
import { countActiveLearners } from "@/lib/institutions/active-learners"
import { coraUsageAlerts, highestTriggeredCoraAlert } from "@/lib/institutions/cora-alerts"
import { licenseUtilizationStatus, daysUntil } from "@/lib/institutions/metrics/scope"
import { countCoveredInstructorsForLicense } from "@/lib/institutions/metrics/queries"
import { INSTITUTION_ACTIVE_LEARNER_DEFINITION } from "@/lib/institutions/active-learner-definition"

const FEATURE_GROUPS: Record<string, { title: string; flags: InstitutionFeatureFlag[] }> = {
  learning: {
    title: "Learning",
    flags: ["practice_hub", "codebench", "institutional_cora", "shared_cora_resources"],
  },
  faculty: {
    title: "Faculty",
    flags: ["institutional_ai_grading", "faculty_management", "shared_assessment_library", "institutional_reports"],
  },
  institution: {
    title: "Institution",
    flags: ["organization_management", "student_management", "institution_analytics", "institutional_analytics"],
  },
  enterprise: {
    title: "Enterprise",
    flags: ["sso", "audit_logs", "sis_integration", "lms_integration", "advanced_rbac", "sla", "priority_support", "dedicated_support"],
  },
}

function formatDate(d: unknown): string | null {
  if (!d) return null
  const s = String(d).slice(0, 10)
  return s || null
}

export async function getInstitutionLicenseModule(institutionId: number) {
  const active = await getActiveInstitutionLicense(institutionId)
  const licenses = await listInstitutionLicenses(institutionId)
  const plan = active ? getInstitutionPlan(String(active.plan_id)) : null
  const licenseId = active ? Number(active.id) : null

  const [activeLearners, coveredInstructors, scopeRows, allowanceRows, instRow] = await Promise.all([
    licenseId ? countActiveLearners(licenseId) : Promise.resolve(0),
    licenseId ? countCoveredInstructorsForLicense(licenseId) : Promise.resolve(0),
    licenseId
      ? sql`
          SELECT s.scope_type, s.course_id, s.organization_unit_id, c.course_code, c.course_title, ou.name AS unit_name
          FROM institution_license_scopes s
          LEFT JOIN courses c ON c.id = s.course_id
          LEFT JOIN organization_units ou ON ou.id = s.organization_unit_id
          WHERE s.license_id = ${licenseId}
        `
      : Promise.resolve([]),
    licenseId
      ? sql`SELECT included_credits, used_credits, reset_date FROM institution_cora_allowances WHERE license_id = ${licenseId} LIMIT 1`
      : Promise.resolve([]),
    sql`SELECT name FROM universities WHERE id = ${institutionId} LIMIT 1`,
  ])

  const seatLimit =
    active?.seat_limit_students != null
      ? Number(active.seat_limit_students)
      : plan && plan.studentCapacity !== "negotiated"
        ? Number(plan.studentCapacity)
        : null
  const utilizationPct = seatLimit && seatLimit > 0 ? Math.round((activeLearners / seatLimit) * 1000) / 10 : null
  const utilStatus = licenseUtilizationStatus(utilizationPct)
  const includedCora = Number(allowanceRows[0]?.included_credits ?? active?.included_cora_credits ?? plan?.includedCoraCredits ?? 0)
  const usedCora = Number(allowanceRows[0]?.used_credits ?? 0)
  const coraPct = includedCora > 0 ? Math.round((usedCora / includedCora) * 1000) / 10 : null

  const featureGroups = plan
    ? Object.entries(FEATURE_GROUPS).map(([key, group]) => ({
        key,
        title: group.title,
        features: group.flags.map((flag) => ({
          key: flag,
          label: flag.replace(/_/g, " "),
          included: plan.featureFlags.includes(flag),
        })),
      }))
    : []

  const scope = scopeRows.map((r) => ({
    type: String(r.scope_type ?? "course"),
    courseId: r.course_id != null ? Number(r.course_id) : null,
    courseCode: r.course_code ? String(r.course_code) : null,
    courseTitle: r.course_title ? String(r.course_title) : null,
    organizationUnitId: r.organization_unit_id != null ? Number(r.organization_unit_id) : null,
    unitName: r.unit_name ? String(r.unit_name) : null,
    label:
      r.course_code != null
        ? `${r.course_code}${r.course_title ? ` · ${r.course_title}` : ""}`
        : r.unit_name
          ? String(r.unit_name)
          : String(r.scope_type ?? "scope"),
  }))

  const history = licenses.map((l) => ({
    id: Number(l.id),
    planId: String(l.plan_id),
    status: String(l.status),
    contractStatus: String(l.contract_status),
    startDate: formatDate(l.start_date),
    endDate: formatDate(l.end_date),
    createdAt: l.created_at ? String(l.created_at) : null,
  }))

  return {
    institutionName: String(instRow[0]?.name ?? ""),
    active: active
      ? {
          id: licenseId,
          planId: String(active.plan_id),
          planName: plan?.displayName ?? String(active.plan_id),
          status: String(active.status),
          contractStatus: String(active.contract_status),
          startDate: formatDate(active.start_date),
          endDate: formatDate(active.end_date),
          renewalDate: formatDate(active.renewal_date),
          contractTermMonths: Number(active.contract_term_months ?? 12),
          billingMethod: String(active.billing_method),
          scopeType: String(active.scope_type ?? plan?.allowedScopeTypes?.[0] ?? "program"),
          seatLimitStudents: seatLimit,
          seatLimitInstructors:
            active.seat_limit_instructors != null
              ? Number(active.seat_limit_instructors)
              : plan?.instructorCapacity === "unlimited"
                ? null
                : Number(plan?.instructorCapacity ?? 0) || null,
          supportLevel: plan?.supportLevel ?? "standard",
          includedCoraCredits: includedCora,
        }
      : null,
    kpis: {
      activeLearners,
      seatLimit,
      remainingCapacity: seatLimit != null ? Math.max(0, seatLimit - activeLearners) : null,
      utilizationPct,
      coveredInstructors,
      coveredCourses: scope.filter((s) => s.courseId).length,
      daysRemaining: daysUntil(active?.end_date ? String(active.end_date) : null),
    },
    utilization: {
      status: utilStatus.status,
      statusLabel: utilStatus.label,
      percent: utilizationPct,
    },
    cora: {
      included: includedCora,
      used: usedCora,
      remaining: Math.max(0, includedCora - usedCora),
      percentUsed: coraPct,
      resetDate: formatDate(allowanceRows[0]?.reset_date),
      alerts: coraUsageAlerts(includedCora, usedCora),
      highestAlert: highestTriggeredCoraAlert(includedCora, usedCora),
    },
    scope,
    featureGroups,
    history,
    activeLearnerDefinition: INSTITUTION_ACTIVE_LEARNER_DEFINITION.id,
  }
}
