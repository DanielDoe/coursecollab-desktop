import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { jsPDF } from "jspdf"

export const dynamic = "force-dynamic"

function sanitize(text: string | null | undefined): string {
  if (text == null || typeof text !== "string") return ""
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/[^\x20-\x7E\n\r\t]/g, (c) => (c === "\n" || c === "\r" || c === "\t" ? c : "?"))
}

/**
 * GET /api/instructor/results/[id]/diagnostic-report
 * Generates a detailed diagnostic PDF for an attempt (errors, submission issues, violations, etc.)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const attemptId = parseInt(id, 10)
    if (isNaN(attemptId)) {
      return NextResponse.json({ error: "Invalid attempt ID" }, { status: 400 })
    }

    const [attempt] = await sql`
      SELECT qa.*, q.title as quiz_title, q.assessment_type,
             s.full_name as student_name, s.student_id as student_id_display, s.section
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN students s ON qa.student_id = s.id
      WHERE qa.id = ${attemptId} AND qa.deleted_at IS NULL
    `

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    const answersResult = await sql`
      SELECT qa.id, qa.question_id, qa.selected_answer, qa.answer_data, qa.ai_feedback, qa.requires_review,
             qa.points_earned, qa.is_correct, qa.answered_at, qa.time_spent_seconds,
             qq.question_order, qq.question_type
      FROM quiz_answers qa
      LEFT JOIN quiz_questions qq ON qq.id = qa.question_id AND qq.quiz_id = ${attempt.quiz_id}
      WHERE qa.attempt_id = ${attemptId}
      ORDER BY COALESCE(qq.question_order, 999), qa.question_id
    `
    const answersList = Array.isArray(answersResult) ? answersResult : []

    let aiQueueList: Array<Record<string, unknown>> = []
    try {
      const aiResult = await sql`
        SELECT id, question_id, question_type, error_type, error_message, status, retry_count,
               created_at, completed_at
        FROM ai_evaluation_queue
        WHERE attempt_id = ${attemptId}
        ORDER BY question_id
      `
      aiQueueList = Array.isArray(aiResult) ? aiResult : []
    } catch {
      // Table may not exist in some environments
    }

    const attemptIssuePattern = `%Attempt ID: ${attemptId}%`
    const issuesResult = await sql`
      SELECT id, quiz_title, question_number, description, status, created_at
      FROM quiz_issues
      WHERE (quiz_id = ${attempt.quiz_id} OR assessment_id = ${attempt.quiz_id})
        AND created_at >= NOW() - INTERVAL '30 days'
        AND (
          description ILIKE ${attemptIssuePattern}
          OR (
            reporter_name = ${attempt.student_name}
            AND description ILIKE '[System]%'
          )
        )
      ORDER BY created_at DESC
      LIMIT 20
    `
    const issuesList = Array.isArray(issuesResult) ? issuesResult : []

    const violationLog = (attempt.violation_log as unknown) as Array<Record<string, unknown>> | null
    const violations = Array.isArray(violationLog) ? violationLog : []

    const pdf = new jsPDF("p", "mm", "a4")
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 15
    const contentWidth = pageWidth - 2 * margin
    let yPos = margin

    const checkPageBreak = (required: number) => {
      if (yPos + required > pageHeight - margin) {
        pdf.addPage()
        yPos = margin
      }
    }

    const addSection = (title: string, color: [number, number, number]) => {
      checkPageBreak(20)
      pdf.setFillColor(...color)
      pdf.rect(margin, yPos, 4, 8, "F")
      pdf.setTextColor(...color)
      pdf.setFontSize(12)
      pdf.setFont("helvetica", "bold")
      pdf.text(title, margin + 8, yPos + 6)
      yPos += 14
    }

    const addLine = (label: string, value: string | number | null | undefined) => {
      checkPageBreak(8)
      pdf.setFontSize(9)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(71, 85, 105)
      pdf.text(sanitize(String(label)) + ":", margin, yPos)
      pdf.setTextColor(30, 41, 59)
      const val = value != null ? String(value) : "—"
      pdf.text(sanitize(val).substring(0, 80), margin + 50, yPos)
      yPos += 6
    }

    const addBlock = (text: string, maxWidth?: number) => {
      pdf.setFontSize(8)
      const lines = pdf.splitTextToSize(sanitize(text), maxWidth ?? contentWidth - 10)
      for (const line of lines) {
        checkPageBreak(5)
        pdf.text(line, margin + 5, yPos)
        yPos += 5
      }
      yPos += 3
    }

    const addJsonBlock = (label: string, obj: unknown) => {
      if (obj == null) return
      checkPageBreak(8)
      pdf.setFontSize(8)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(71, 85, 105)
      pdf.text(sanitize(label), margin, yPos)
      yPos += 5
      pdf.setFont("helvetica", "normal")
      try {
        const str = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2)
        const lines = pdf.splitTextToSize(sanitize(str).substring(0, 2000), contentWidth - 15)
        for (const line of lines) {
          checkPageBreak(5)
          pdf.text(line, margin + 5, yPos)
          yPos += 5
        }
      } catch {
        pdf.text("(unable to serialize)", margin + 5, yPos)
        yPos += 5
      }
      yPos += 3
    }

    // Header
    pdf.setFillColor(100, 116, 139)
    pdf.rect(0, 0, pageWidth, 35, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(18)
    pdf.setFont("helvetica", "bold")
    pdf.text("Diagnostic Report", pageWidth / 2, 14, { align: "center" })
    pdf.setFontSize(11)
    pdf.setFont("helvetica", "normal")
    pdf.text(
      `${sanitize(attempt.quiz_title)} • Attempt #${attemptId}`,
      pageWidth / 2,
      24,
      { align: "center" }
    )
    pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, 30, {
      align: "right",
    })
    yPos = 45

    // Attempt summary
    addSection("Attempt Summary", [59, 130, 246])
    addLine("Student", `${attempt.student_name} (${attempt.student_id_display})`)
    addLine("Section", attempt.section)
    addLine("Quiz", attempt.quiz_title)
    addLine("Assessment Type", attempt.assessment_type)
    addLine("Score", `${attempt.score} / ${attempt.total_questions}`)
    addLine("Started", attempt.started_at ? new Date(attempt.started_at).toLocaleString() : null)
    addLine("Completed", attempt.completed_at ? new Date(attempt.completed_at).toLocaleString() : null)
    addLine("Auto-submitted", attempt.auto_submitted ? "Yes" : "No")
    if (attempt.violation_reason) {
      addLine("Violation Reason", attempt.violation_reason)
    }
    yPos += 5

    // Anti-cheat / Violations
    addSection("Anti-Cheat & Violations", [234, 88, 12])
    addLine("Tab Switches", attempt.tab_switch_count ?? 0)
    addLine("Copy/Paste Attempts", attempt.copy_paste_attempts ?? 0)
    addLine("Mouse Leave Events", attempt.mouse_leave_count ?? 0)
    addLine("Gemini Strikes", attempt.gemini_strikes_count ?? 0)
    if (violations.length > 0) {
      yPos += 3
      pdf.setFontSize(9)
      pdf.setFont("helvetica", "bold")
      pdf.text("Violation Log (raw):", margin, yPos)
      yPos += 6
      for (const v of violations.slice(0, 15)) {
        addBlock(JSON.stringify(v), contentWidth - 15)
      }
    } else {
      addLine("Violation Log", "None")
    }
    yPos += 5

    // Submission / Connection Issues (from answer_data)
    const answersWithIssues = answersList.filter((a: { answer_data?: unknown }) => {
      const ad = a.answer_data as Record<string, unknown> | null
      return ad && (ad.submissionFailed === true || ad.submissionFailed === "true")
    })

    addSection("Submission & Connection Issues", [245, 158, 11])
    addLine(
      "Answers with submission issues",
      answersWithIssues.length > 0 ? `${answersWithIssues.length} (see per-question below)` : "None"
    )
    if (answersWithIssues.length > 0) {
      for (const a of answersWithIssues) {
        const ad = (a.answer_data as Record<string, unknown>) || {}
        yPos += 4
        addLine("  Question ID", a.question_id)
        addLine("  Error Type", ad.submission_error_type ?? "Unknown")
        addLine("  Retry Count", ad.submission_retry_count ?? "—")
        addLine("  Requires Review", a.requires_review ? "Yes" : "No")
      }
    }
    yPos += 5

    // Per-answer diagnostics
    addSection("Per-Answer Diagnostics", [76, 29, 149])
    for (const a of answersList) {
      checkPageBreak(25)
      const ad = (a.answer_data as Record<string, unknown>) || {}
      const hasIssue =
        ad.submissionFailed === true ||
        ad.submissionFailed === "true" ||
        a.requires_review === true
      const bgColor = hasIssue ? [254, 243, 199] : [241, 245, 249]
      pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2])
      pdf.rect(margin, yPos, contentWidth, 22, "F")
      pdf.setFontSize(9)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(30, 41, 59)
      pdf.text(`Q${a.question_order ?? a.question_id} (${a.question_type ?? "—"})`, margin + 5, yPos + 7)
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(8)
      pdf.setTextColor(71, 85, 105)
      pdf.text(
        `Answered: ${a.answered_at ? new Date(a.answered_at).toLocaleString() : "—"} | ` +
          `Points: ${a.points_earned ?? 0} | Correct: ${a.is_correct ? "Yes" : "No"}`,
        margin + 5,
        yPos + 13
      )
      if (hasIssue || ad.submissionFailed || ad.submission_error_type) {
        pdf.setTextColor(180, 83, 9)
        const parts: string[] = []
        if (ad.submissionFailed) parts.push("Submission failed (fallback save)")
        if (ad.submission_error_type) parts.push(`Error: ${ad.submission_error_type}`)
        if (ad.submission_retry_count != null) parts.push(`Retries: ${ad.submission_retry_count}`)
        if (a.requires_review) parts.push("Requires manual review")
        pdf.text(parts.join(" | "), margin + 5, yPos + 19)
      }
      yPos += 25
    }
    yPos += 5

    // API Diagnostics (AI Evaluation) — request, response, timeout, retries, errors (per-question debug)
    const aiGradedTypes = ["code_write", "code_explain", "code_problem", "debug_code", "code_debug", "code_write_plot"]
    const aiGradedAnswers = answersList.filter((a: { question_type?: string }) => {
      const qt = (a.question_type || "").toLowerCase()
      return aiGradedTypes.includes(qt)
    })
    const answersWithAiFeedback = aiGradedAnswers.filter((a: { ai_feedback?: unknown }) => (a as { ai_feedback?: unknown }).ai_feedback != null)
    const aiGradedWithoutFeedback = aiGradedAnswers.filter((a: { ai_feedback?: unknown; answer_data?: unknown }) => {
      const af = (a as { ai_feedback?: unknown }).ai_feedback
      const ad = (a.answer_data as Record<string, unknown>) || {}
      return af == null && (ad.submissionFailed === true || ad.submissionFailed === "true" || a.requires_review)
    })

    addSection("AI Evaluation Diagnostics (Per-Question Debug)", [124, 58, 237])
    addLine("AI-graded questions total", aiGradedAnswers.length)
    addLine("With ai_feedback (eval ran)", answersWithAiFeedback.length)
    addLine("Without ai_feedback (eval/save failed)", aiGradedWithoutFeedback.length)
    yPos += 5

    const renderQuestionDiag = (a: any, label: string) => {
      let af = (a as { ai_feedback?: unknown }).ai_feedback
      if (typeof af === "string") {
        try {
          af = JSON.parse(af) as Record<string, unknown>
        } catch {
          af = null
        }
      }
      const afObj = af as Record<string, unknown> | null
      const ad = (a.answer_data as Record<string, unknown>) || {}
      const diag = afObj?.evaluationDiagnostics as Record<string, unknown> | null
      const quizSummary = diag?.quizEvaluateRequestSummary as Record<string, unknown> | null
      const reqSummary = diag?.requestSummary as Record<string, unknown> | null
      const retryLog = diag?.retryLog as Array<{ attempt: number; at: string; error?: string }> | null

      checkPageBreak(55)
      const isFailure = diag?.errorType || diag?.errorMessage || ad.submissionFailed
      pdf.setFillColor(...(isFailure ? [254, 243, 199] : [248, 250, 252]))
      let boxHeight = 42
      if (quizSummary) boxHeight += 12
      if (reqSummary) boxHeight += 6
      if (diag?.errorType || diag?.errorMessage || ad.submissionFailed) boxHeight += 6
      pdf.rect(margin, yPos, contentWidth, boxHeight, "F")
      pdf.setFontSize(9)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(30, 41, 59)
      pdf.text(`${label}Q${a.question_order ?? a.question_id} (${a.question_type ?? "—"})`, margin + 5, yPos + 7)
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(8)
      pdf.setTextColor(71, 85, 105)
      let lineY = yPos + 13
      if (quizSummary) {
        pdf.text(`Quiz→AI: baseUrl=${String(quizSummary.baseUrl ?? "—").substring(0, 45)} | evalUrl=${String(quizSummary.evalUrl ?? "—").substring(0, 40)}`, margin + 5, lineY)
        lineY += 6
        pdf.text(`Payload: qTextLen=${quizSummary.questionTextLength ?? "—"} | answerLen=${quizSummary.studentAnswerLength ?? "—"} | hasPlot=${quizSummary.hasPlotImage ?? false}`, margin + 5, lineY)
        lineY += 6
      }
      if (reqSummary) {
        pdf.text(`AI Request: type=${reqSummary.questionType ?? "—"} | model=${reqSummary.model ?? "—"} | timeout=${diag?.timeoutMs ?? diag?.quizEvaluateFetchTimeoutMs ?? "—"}ms`, margin + 5, lineY)
        lineY += 6
      }
      pdf.text(`Timeline: req=${diag?.quizEvaluateRequestReceivedAt ?? diag?.requestReceivedAt ?? "—"} | resp=${diag?.quizEvaluateResponseReceivedAt ?? diag?.openaiResponseReceivedAt ?? "—"} | duration=${diag?.quizEvaluateTotalDurationMs ?? diag?.durationMs ?? "—"}ms`, margin + 5, lineY)
      lineY += 6
      pdf.text(`Retries: ${diag?.retryCount ?? "0"} | Model: ${diag?.model ?? "—"} | HTTP: ${diag?.httpStatus ?? "—"}`, margin + 5, lineY)
      lineY += 6
      if (diag?.errorType || diag?.errorMessage || diag?.errorName) {
        pdf.setTextColor(180, 83, 9)
        pdf.text(`ERROR: ${diag.errorType ?? diag.errorName ?? ""} - ${String(diag.errorMessage ?? "").substring(0, 90)}`, margin + 5, lineY)
        pdf.setTextColor(71, 85, 105)
        lineY += 6
      }
      if (ad.submissionFailed && !diag?.errorType) {
        pdf.setTextColor(180, 83, 9)
        pdf.text(`SAVE FAILED: ${ad.submission_error_type ?? "Unknown"} | retries: ${ad.submission_retry_count ?? "—"}`, margin + 5, lineY)
        pdf.setTextColor(71, 85, 105)
      }
      yPos += boxHeight + 3

      if (retryLog && retryLog.length > 0) {
        addBlock("Retry log: " + JSON.stringify(retryLog), contentWidth - 15)
      }
      addJsonBlock("evaluationDiagnostics (full)", diag ?? "—")
      if (Object.keys(ad).length) {
        addJsonBlock("answer_data (submissionFailed, errorType, retries)", {
          submissionFailed: ad.submissionFailed,
          submission_error_type: ad.submission_error_type,
          submission_retry_count: ad.submission_retry_count,
          savedAt: ad.savedAt,
        })
      }
      addJsonBlock("ai_feedback (full)", afObj)
      yPos += 5
    }

    for (const a of answersWithAiFeedback) {
      renderQuestionDiag(a, "")
    }
    for (const a of aiGradedWithoutFeedback) {
      renderQuestionDiag(a, "[NO AI FEEDBACK] ")
    }
    if (aiGradedAnswers.length === 0) {
      addLine("No AI-graded questions in this attempt", "—")
    }
    yPos += 5

    // AI Evaluation Queue
    addSection("AI Evaluation Queue", [16, 185, 129])
    if (aiQueueList.length === 0) {
      addLine("Entries", "None")
    } else {
      addLine("Entries", aiQueueList.length)
      for (const q of aiQueueList) {
        yPos += 4
        addLine("  Question", q.question_id)
        addLine("  Type", q.question_type)
        addLine("  Status", q.status)
        if (q.error_type) addLine("  Error Type", q.error_type)
        if (q.error_message) addBlock("  Error: " + String(q.error_message).substring(0, 200))
        if (q.retry_count != null) addLine("  Retry Count", q.retry_count)
      }
    }
    yPos += 5

    // Quiz Issues
    addSection("Related Quiz Issues (this attempt, last 30 days)", [139, 92, 246])
    if (issuesList.length === 0) {
      addLine("Issues", "None")
    } else {
      addLine("Count", issuesList.length)
      for (const i of issuesList) {
        yPos += 4
        addLine("  Issue #", i.id)
        addLine("  Status", i.status)
        addLine("  Created", i.created_at ? new Date(i.created_at).toLocaleString() : "—")
        if (i.description) addBlock("  " + String(i.description).substring(0, 300))
      }
    }

    const blob = pdf.output("arraybuffer")
    const filename = `diagnostic-report-attempt-${attemptId}-${Date.now()}.pdf`

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("[Diagnostic Report] Error:", error)
    return NextResponse.json(
      { error: "Failed to generate diagnostic report" },
      { status: 500 }
    )
  }
}
