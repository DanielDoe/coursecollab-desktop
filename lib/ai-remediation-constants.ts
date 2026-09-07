/** Job lifecycle for AI remediation worker */
export const REMEDIATION_JOB_STATUSES = [
  "queued",
  "investigating",
  "fixing",
  "validating",
  "deploying",
  "monitoring",
  "completed",
  "failed",
  "requires_human_review",
] as const
export type RemediationJobStatus = (typeof REMEDIATION_JOB_STATUSES)[number]

export const REMEDIATION_PRIORITIES = ["critical", "high", "medium", "low"] as const
export type RemediationPriority = (typeof REMEDIATION_PRIORITIES)[number]

/** System log event types written during remediation (category: deployment) */
export const REMEDIATION_EVENT_TYPES = [
  "ai_investigation_started",
  "ai_diagnosis_completed",
  "ai_fix_generated",
  "ai_validation_started",
  "ai_validation_passed",
  "ai_validation_failed",
  "ai_commit_created",
  "ai_push_completed",
  "ai_staging_deployment_started",
  "ai_staging_deployment_passed",
  "ai_production_deployment_started",
  "ai_production_deployment_passed",
  "production_monitoring_started",
  "production_monitoring_completed",
  "production_verification_failed",
  "automatic_rollback_triggered",
  "issue_reopened",
  "issue_resolved",
] as const
export type RemediationEventType = (typeof REMEDIATION_EVENT_TYPES)[number]

/** Only process groups in this status — never needs_attention or resolved */
export const REMEDIATION_ELIGIBLE_GROUP_STATUS = "open" as const

/** Assessment panel fingerprints must never be auto-remediated */
export const ASSESSMENT_ISSUE_FINGERPRINT_PREFIX = "assessment-issue:"

/** Max queued jobs a Cursor automation run may process (safety cap) */
export const REMEDIATION_MAX_JOBS_PER_AUTOMATION_RUN = 10

/** Only remediate logs from this environment (Cursor automation targets live users) */
export const REMEDIATION_PRODUCTION_ENVIRONMENT = "production" as const

/** Environments to skip — preview/dev logs are not production incidents */
export const REMEDIATION_NON_PRODUCTION_ENVIRONMENTS = [
  "development",
  "dev",
  "preview",
  "test",
  "local",
] as const

/** Known production hosts when environment field is missing */
export const REMEDIATION_PRODUCTION_HOST_SUFFIXES = [
  "coursecollab.vercel.app",
  "course-collab.com",
] as const

/** Group/log titles that are dev-only noise (not production bugs) */
export const REMEDIATION_DEV_TITLE_PREFIXES = [
  "Observability Test",
  "Localhost diagnostic",
] as const

/** No logs for this long → eligible for verify-and-close (already fixed) */
export const REMEDIATION_VERIFY_CLOSE_STALE_HOURS = 24

/** Window to confirm fingerprint has not recurred before auto-resolving */
export const REMEDIATION_VERIFY_CLOSE_RECURRENCE_HOURS = 24

/** Monitoring windows by severity (minutes) */
export const MONITORING_WINDOWS: Record<RemediationPriority, number> = {
  critical: 15,
  high: 30,
  medium: 60,
  low: 24 * 60,
}

/** Paths that always require human approval before deploy */
export const HUMAN_APPROVAL_PATH_PREFIXES = [
  "migrations/",
  "lib/auth",
  "lib/grading",
  "lib/multi-part-grading",
  "app/api/student/login",
  "app/api/admin/",
  "lib/enrollment",
  "lib/student-records",
] as const
