/**
 * Shared diagnostic scan → admin system_log_groups for quizzes and homework.
 */
import { sql } from "@/lib/db"
import { circuitSubmissionNeedsWorkspaceExport } from "@/lib/circuit-submission-workspace-export-ui"
import { logSystemEvent } from "@/lib/system-log"
import { updateSystemLogGroup } from "@/lib/system-log-query"

export type AssessmentDiagnosticType = "quiz" | "homework"

export type DiagnosticScanOptions = {
  assessmentTypes?: AssessmentDiagnosticType[]
  /** Only scan attempts started within this many days (0 = no limit) */
  attemptDays?: number
  /** Quiz issue lookback window */
  issueDays?: number
  dryRun?: boolean
}

export type DiagnosticScanResult = {
  attemptsScanned: number
  findingsLogged: number
  groupsTouched: number
  cleanAttempts: number
  byType: Record<string, number>
  lines: string[]
}

type Finding = {
  key: string
  severity: "warning" | "error" | "critical"
  title: string
  errorMessage: string
  instructions: string
  metadata: Record<string, unknown>
}

const MODULE_BY_TYPE: Record<AssessmentDiagnosticType, string> = {
  quiz: "Quiz Module",
  homework: "Homework Module",
}

const LABEL_BY_TYPE: Record<AssessmentDiagnosticType, string> = {
  quiz: "Quiz",
  homework: "Homework",
}

function parseJsonField(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null
  if (typeof raw === "object") return raw as Record<string, unknown>
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  }
  return null
}

function normalizeAssessmentType(raw: unknown): AssessmentDiagnosticType {
  const n = String(raw ?? "quiz")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
  return n === "homework" ? "homework" : "quiz"
}

function diagnosticFingerprint(
  assessmentType: AssessmentDiagnosticType,
  quizId: number,
  attemptId: number,
  findingKey: string,
): string {
  return `assessment-diagnostic:${assessmentType}:${quizId}:${attemptId}:${findingKey}`
}

async function relatedQuizIssues(
  attemptId: number,
  quizId: number,
  studentName: string,
  issueDays: number,
) {
  const pattern = `%Attempt ID: ${attemptId}%`
  return sql`
    SELECT id, status, description, created_at
    FROM quiz_issues
    WHERE (quiz_id = ${quizId} OR assessment_id = ${quizId})
      AND created_at >= NOW() - (${issueDays} * INTERVAL '1 day')
      AND (
        description ILIKE ${pattern}
        OR (reporter_name = ${studentName} AND description ILIKE '[System]%')
      )
    ORDER BY id ASC
  `
}

async function collectFindings(
  attempt: Record<string, unknown>,
  issueDays: number,
): Promise<Finding[]> {
  const attemptId = Number(attempt.id)
  const quizId = Number(attempt.quiz_id)
  const assessmentType = normalizeAssessmentType(attempt.assessment_type)
  const typeLabel = LABEL_BY_TYPE[assessmentType]
  const studentName = String(attempt.student_name)
  const studentId = String(attempt.student_id_display)
  const section = String(attempt.section ?? "")
  const quizTitle = String(attempt.quiz_title ?? typeLabel)
  const completed = !!attempt.completed_at
  const score = attempt.score
  const findings: Finding[] = []

  const baseMeta = {
    assessmentType,
    quizId,
    quizTitle,
    attemptId,
    studentName,
    studentId,
    section,
    courseId: attempt.course_id ?? null,
    courseName: attempt.course_name ?? null,
    completed,
    score,
    instructorResultsUrl: `/instructor/dashboard/results/${attemptId}`,
    diagnosticReportApi: `/api/instructor/results/${attemptId}/diagnostic-report`,
  }

  const issues = await relatedQuizIssues(attemptId, quizId, studentName, issueDays)

  const answers = await sql`
    SELECT qa.id, qa.question_id, qa.selected_answer, qa.answer_data, qa.ai_feedback,
           qa.requires_review, qa.points_earned, qa.is_correct, qq.question_order, qq.question_type
    FROM quiz_answers qa
    LEFT JOIN quiz_questions qq ON qq.id = qa.question_id AND qq.quiz_id = ${quizId}
    WHERE qa.attempt_id = ${attemptId}
    ORDER BY COALESCE(qq.question_order, 999), qa.question_id
  `
  const answerRows = answers as Array<Record<string, unknown>>
  const hasAnswers = answerRows.length > 0

  if (!completed && (hasAnswers || issues.length > 0)) {
    findings.push({
      key: "incomplete",
      severity: "error",
      title: `[${typeLabel}] Incomplete attempt — ${studentName}`,
      errorMessage: `Attempt ${attemptId} for ${studentName} on "${quizTitle}" is not finalized.`,
      instructions: [
        `Student: ${studentName} (${studentId}) · Section ${section}`,
        `Assessment: ${quizTitle} (${typeLabel} id ${quizId}) · Attempt ${attemptId}`,
        `Status: INCOMPLETE (no completed_at)`,
        `Saved answers: ${answerRows.length}`,
        "",
        "Remediation steps:",
        "1. Open instructor results for this attempt and verify saved answers.",
        "2. Use Submit on behalf or help student resume/finalize if appropriate.",
        "3. Check for finalization JSON.parse or network errors in quiz_issues.",
        "",
        `Instructor: /instructor/dashboard/results/${attemptId}`,
      ].join("\n"),
      metadata: { ...baseMeta, findingType: "incomplete_attempt" },
    })
  }

  for (const issue of issues as Array<{
    id: number
    status: string
    description: string | null
  }>) {
    const closed = issue.status === "closed"
    const attemptHealthy = completed && Number(score) > 0
    findings.push({
      key: `quiz-issue-${issue.id}`,
      severity: closed && attemptHealthy ? "warning" : "error",
      title: `[${typeLabel}] Quiz issue #${issue.id} — ${studentName}`,
      errorMessage: String(issue.description ?? "").slice(0, 500),
      instructions: [
        `Student: ${studentName} (${studentId}) · Section ${section}`,
        `Assessment: ${quizTitle} (${typeLabel} id ${quizId}) · Attempt ${attemptId}`,
        `Quiz issue #${issue.id} · Status: ${issue.status}`,
        "",
        "Issue description:",
        String(issue.description ?? "").trim(),
        "",
        closed && attemptHealthy
          ? "Verification: Attempt appears completed with a score — confirm fix deployed; resolve group after verify."
          : "Remediation: Investigate finalization/submit failure; verify answers saved; use Submit on behalf if needed.",
        "",
        `Instructor: /instructor/dashboard/results/${attemptId}`,
      ].join("\n"),
      metadata: {
        ...baseMeta,
        findingType: "quiz_issue",
        quizIssueId: issue.id,
        quizIssueStatus: issue.status,
      },
    })
  }

  for (const a of answerRows) {
    const ad = parseJsonField(a.answer_data) ?? {}
    const qOrder = a.question_order ?? a.question_id
    const qType = String(a.question_type ?? "unknown")
    const qLabel = `Q${qOrder} (${qType}) question_id=${a.question_id}`

    if (ad.submissionFailed === true || ad.submissionFailed === "true") {
      findings.push({
        key: `submission-failed-${a.question_id}`,
        severity: "error",
        title: `[${typeLabel}] Submission failed — ${studentName} · ${qLabel}`,
        errorMessage: `Submission failed on ${qLabel}: ${ad.submission_error_type ?? "Unknown"}`,
        instructions: [
          `Student: ${studentName} (${studentId}) · Attempt ${attemptId}`,
          `Assessment: ${quizTitle} (${typeLabel} id ${quizId})`,
          `Question: ${qLabel}`,
          `Error type: ${ad.submission_error_type ?? "Unknown"}`,
          `Retry count: ${ad.submission_retry_count ?? "—"}`,
          "",
          "Remediation:",
          "1. Confirm answer persisted in quiz_answers (fallback save-answer path).",
          "2. Re-evaluate or grade manually if points are wrong.",
          "3. Check network/submit API logs for this question type.",
          "",
          `Instructor: /instructor/dashboard/results/${attemptId}`,
        ].join("\n"),
        metadata: {
          ...baseMeta,
          findingType: "submission_failed",
          questionId: a.question_id,
          questionOrder: qOrder,
          questionType: qType,
          submissionErrorType: ad.submission_error_type,
        },
      })
    }

    if (
      a.requires_review === true &&
      (ad.submissionFailed === true || ad.submissionFailed === "true")
    ) {
      findings.push({
        key: `requires-review-${a.question_id}`,
        severity: "warning",
        title: `[${typeLabel}] Requires review after submit failure — ${studentName} · ${qLabel}`,
        errorMessage: `Answer on ${qLabel} flagged requires_review after submission failure.`,
        instructions: [
          `Student: ${studentName} (${studentId}) · Attempt ${attemptId}`,
          `Assessment: ${quizTitle} · Question: ${qLabel}`,
          "",
          "Remediation: Open instructor results, review answer, adjust grade or re-run evaluation.",
        ].join("\n"),
        metadata: {
          ...baseMeta,
          findingType: "requires_review_after_failure",
          questionId: a.question_id,
          questionOrder: qOrder,
        },
      })
    }

    if (
      String(a.question_type ?? "").toLowerCase() === "circuit_submission" &&
      circuitSubmissionNeedsWorkspaceExport(
        a.selected_answer,
        a.answer_data,
        a.ai_feedback,
      )
    ) {
      findings.push({
        key: `workspace-export-${a.question_id}`,
        severity: "warning",
        title: `[${typeLabel}] Missing workspace PNG export — ${studentName} · ${qLabel}`,
        errorMessage: `Circuit workspace ink saved but PNG pages missing for grading on ${qLabel}.`,
        instructions: [
          `Student: ${studentName} (${studentId}) · Attempt ${attemptId}`,
          `Assessment: ${quizTitle} · Question: ${qLabel}`,
          "",
          "Remediation:",
          "1. Open instructor results → Export workspace for grading.",
          "2. Re-grade after export if provisional/missing_submission.",
        ].join("\n"),
        metadata: {
          ...baseMeta,
          findingType: "workspace_export_missing",
          questionId: a.question_id,
          questionOrder: qOrder,
        },
      })
    }
  }

  try {
    const aiQueue = await sql`
      SELECT question_id, question_type, error_type, error_message, status, retry_count
      FROM ai_evaluation_queue
      WHERE attempt_id = ${attemptId}
        AND status NOT IN ('completed', 'success')
        AND (error_type IS NOT NULL OR error_message IS NOT NULL)
    `
    for (const row of aiQueue as Array<Record<string, unknown>>) {
      findings.push({
        key: `ai-queue-${row.question_id}-${row.error_type ?? "err"}`,
        severity: "error",
        title: `[${typeLabel}] AI eval queue error — ${studentName} · Q${row.question_id}`,
        errorMessage: String(row.error_message ?? row.error_type ?? "AI queue error"),
        instructions: [
          `Student: ${studentName} (${studentId}) · Attempt ${attemptId}`,
          `Assessment: ${quizTitle}`,
          `Question id: ${row.question_id} · Type: ${row.question_type}`,
          `Queue status: ${row.status} · Retries: ${row.retry_count ?? 0}`,
          `Error: ${row.error_type ?? ""} — ${row.error_message ?? ""}`,
          "",
          "Remediation: Re-run evaluation from instructor panel or fix evaluate API.",
        ].join("\n"),
        metadata: {
          ...baseMeta,
          findingType: "ai_queue_error",
          questionId: row.question_id,
          aiQueueStatus: row.status,
        },
      })
    }
  } catch {
    /* ai_evaluation_queue may not exist */
  }

  const aiGradedTypes = [
    "code_write",
    "code_explain",
    "code_problem",
    "debug_code",
    "code_debug",
    "code_write_plot",
  ]
  for (const a of answerRows) {
    const qt = String(a.question_type ?? "").toLowerCase()
    if (!aiGradedTypes.includes(qt)) continue
    if (a.ai_feedback != null) continue
    const ad = parseJsonField(a.answer_data) ?? {}
    if (
      ad.submissionFailed !== true &&
      ad.submissionFailed !== "true" &&
      a.requires_review !== true
    ) {
      continue
    }
    const qOrder = a.question_order ?? a.question_id
    findings.push({
      key: `ai-no-feedback-${a.question_id}`,
      severity: "error",
      title: `[${typeLabel}] AI eval missing feedback — ${studentName} · Q${qOrder}`,
      errorMessage: `AI-graded ${qt} question has no ai_feedback after submit/save failure.`,
      instructions: [
        `Student: ${studentName} (${studentId}) · Attempt ${attemptId}`,
        `Assessment: ${quizTitle} · Question id: ${a.question_id} · Type: ${qt}`,
        "",
        "Remediation: Re-run AI evaluation from instructor panel; check evaluate API logs.",
      ].join("\n"),
      metadata: {
        ...baseMeta,
        findingType: "ai_missing_feedback",
        questionId: a.question_id,
        questionType: qt,
      },
    })
  }

  return findings
}

async function upsertFindingGroup(
  attempt: Record<string, unknown>,
  finding: Finding,
  dryRun: boolean,
) {
  const attemptId = Number(attempt.id)
  const quizId = Number(attempt.quiz_id)
  const assessmentType = normalizeAssessmentType(attempt.assessment_type)
  const fingerprint = diagnosticFingerprint(assessmentType, quizId, attemptId, finding.key)

  if (dryRun) {
    return { id: 0, status: "dry-run", fingerprint }
  }

  const [existing] = await sql`
    SELECT id, status FROM system_log_groups WHERE fingerprint = ${fingerprint} LIMIT 1
  `
  if (
    existing &&
    (String(existing.status) === "resolved" ||
      String(existing.status) === "needs_attention" ||
      String(existing.status) === "ignored")
  ) {
    await updateSystemLogGroup(Number(existing.id), {
      status: "open",
      resolutionNotes: null,
      resolvedBy: null,
    })
  }

  await logSystemEvent({
    severity: finding.severity,
    category: "assessment",
    title: finding.title,
    description: finding.instructions,
    errorMessage: finding.errorMessage,
    moduleName: MODULE_BY_TYPE[assessmentType],
    featureName: String(attempt.quiz_title ?? LABEL_BY_TYPE[assessmentType]),
    pageUrl: `/instructor/dashboard/results/${attemptId}`,
    route: `/instructor/dashboard/results/${attemptId}`,
    userId: String(attempt.student_id_display),
    userName: String(attempt.student_name),
    userRole: "student",
    courseId: attempt.course_id != null ? Number(attempt.course_id) : undefined,
    courseName: attempt.course_name != null ? String(attempt.course_name) : undefined,
    environment: "production",
    metadata: {
      ...finding.metadata,
      source: "assessment_diagnostic_scan",
      requiresAdminReview: true,
      remediationAgent: true,
    },
    groupFingerprint: fingerprint,
    groupStatus: "open",
    groupOnRecurrence: "reopen_resolved",
    alwaysGroup: true,
  })

  const [group] = await sql`
    SELECT id, status FROM system_log_groups WHERE fingerprint = ${fingerprint} LIMIT 1
  `
  return group as { id: number; status: string; fingerprint?: string }
}

export async function scanAssessmentsForOpenIssues(
  options: DiagnosticScanOptions = {},
): Promise<DiagnosticScanResult> {
  const assessmentTypes = options.assessmentTypes ?? ["quiz", "homework"]
  const attemptDays = options.attemptDays ?? 0
  const issueDays = options.issueDays ?? 30
  const dryRun = options.dryRun ?? false

  const typeFilter = assessmentTypes.map((t) => t.toLowerCase())

  const attempts = await sql`
    SELECT qa.*,
           q.title AS quiz_title,
           q.course_id,
           q.assessment_type,
           c.course_code AS course_name,
           s.full_name AS student_name,
           s.student_id AS student_id_display,
           s.section
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa.quiz_id
    JOIN students s ON s.id = qa.student_id
    LEFT JOIN courses c ON c.id = q.course_id
    WHERE qa.deleted_at IS NULL
      AND LOWER(COALESCE(q.assessment_type, 'quiz')) = ANY(${typeFilter})
      AND (
        ${attemptDays} = 0
        OR qa.started_at >= NOW() - (${attemptDays} * INTERVAL '1 day')
      )
    ORDER BY q.assessment_type, q.id, s.full_name ASC, qa.id DESC
  `

  let findingsTotal = 0
  let groupsTouched = 0
  let cleanAttempts = 0
  const byType: Record<string, number> = {}
  const lines: string[] = []

  for (const attempt of attempts as Array<Record<string, unknown>>) {
    const attemptId = Number(attempt.id)
    const assessmentType = normalizeAssessmentType(attempt.assessment_type)
    const findings = await collectFindings(attempt, issueDays)

    if (findings.length === 0) {
      cleanAttempts++
      continue
    }

    for (const finding of findings) {
      findingsTotal++
      byType[finding.metadata.findingType as string] =
        (byType[finding.metadata.findingType as string] ?? 0) + 1

      const group = await upsertFindingGroup(attempt, finding, dryRun)
      groupsTouched++
      lines.push(
        `${finding.severity.toUpperCase().padEnd(8)} [${assessmentType}] attempt ${attemptId} ${attempt.student_name} · ${finding.key} → group #${group?.id ?? "?"} [${group?.status ?? "?"}]`,
      )
    }
  }

  return {
    attemptsScanned: attempts.length,
    findingsLogged: findingsTotal,
    groupsTouched,
    cleanAttempts,
    byType,
    lines,
  }
}
