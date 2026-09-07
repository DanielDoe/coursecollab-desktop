/**
 * Shared student-style results report PDF (matches quiz-results.tsx download layout).
 * Used by instructor bulk ZIP export and by QuizResults download handler.
 */
import { jsPDF } from "jspdf"
import { formatToCDT } from "@/lib/timezone"
import { groupQuestionsBySections, getSectionForQuestionIndex } from "@/lib/assessment-sections"
import { hasCodeDataButZeroPoints, hasStudentAnswerContent } from "@/lib/student-answer-presence"
import { getCanonicalAiFeedbackPercent } from "@/lib/ai-points-consistency"
import { isPendingManualReview } from "@/lib/question-pending-review"
import { buildResultsPdfFilename } from "@/lib/results-pdf-filename"
import {
  formatQuestionTypeLabelForPdf,
  renderMultiPartQuestionInPdf,
  renderQuestionMediaInPdf,
  renderCircuitSubmissionInPdf,
  renderCircuitSubmissionAiFeedbackInPdf,
  renderStructuredAiFeedbackInPdf,
  type QuizPdfLayout,
} from "@/lib/quiz-results-pdf-circuit"
import { hasActiveQuestionMedia, resolveQuestionMedia } from "@/lib/question-media"
import { isMultiPartUploadPendingReview } from "@/lib/multi-part-pnd"
import { formatRichTextForPdf } from "@/lib/pdf-rich-text"
import { parseCircuitSubmissionConfig } from "@/lib/circuit-submission"

/** AI % shown in PDF — matches points_earned / max when feedback has scoreBreakdown.finalScore */
function canonicalAiPercentForUi(feedback: any): number | undefined {
  const c = getCanonicalAiFeedbackPercent(feedback)
  if (c != null) return c
  if (feedback && typeof feedback === "object" && feedback.score != null && Number.isFinite(Number(feedback.score))) {
    return Number(feedback.score)
  }
  return undefined
}

function anyQuestionHasDataButZeroPoints(questions: any[]): boolean {
  return (questions || []).some((q: any) => hasCodeDataButZeroPoints(q))
}

export interface QuestionResult {
  question_text: string
  question_type: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  option_e: string
  correct_answer: string
  selected_answer: string | null
  is_correct: boolean
  requires_review?: boolean
  points_earned?: number | null
  max_points?: number
  points?: number
  override_points?: number | null
  answer_data?: string | null
  time_spent_seconds?: number | null
  code?: string | null
  plotImage?: string | null
  question_order?: number
  ai_feedback?: any
  sample_answers?: Array<{
    approach: string
    description: string
    code: string
  }>
  subquestions?: unknown
  question_media?: unknown
  circuit_spec?: unknown
}

export interface ResultsData {
  student_name: string
  student_id: string
  section: string
  quiz_title: string
  score: number
  total_questions: number
  total_points?: number
  percentage: number
  questions: QuestionResult[]
  quiz_id: number
  assessment_type?: string
  tab_switch_count?: number
  copy_paste_attempts?: number
  mouse_leave_count?: number
  auto_submitted?: boolean
  violation_reason?: string | null
  gemini_strikes_count?: number
  section_breakdown?: Array<{
    title: string
    earned: number
    max: number
    weightPercent: number
    sectionPercentage: number
  }>
  section_config?: Array<{
    title: string
    question_types: string[]
    weight_percent: number
    question_order_start?: number
    question_order_end?: number
  }> | null
  results_review_locked?: boolean
  violation_log?: Array<{ type?: string }>
  should_show_pnd?: boolean
}

/** Default PDF filename segment (student report style) for ZIP entries. */
export function getResultsPdfFilenameForZip(
  results: ResultsData,
  assessmentType: string,
  /** Disambiguates retakes / multiple attempts in one ZIP */
  attemptId?: string | number,
): string {
  return buildResultsPdfFilename(
    results.student_name,
    results.section,
    results.assessment_type || assessmentType,
    attemptId != null ? String(attemptId) : undefined,
  )
}

export async function generateQuizResultsPdfArrayBuffer(
  results: ResultsData,
  assessmentType: string,
): Promise<ArrayBuffer> {
  if (!results.questions) results.questions = []

  try {
    const assessmentLabel = assessmentType === "mid_semester" ? "Mid-Semester Exam" 
      : assessmentType === "final" ? "Final Exam"
      : assessmentType === "homework" ? "Homework"
      : "Quiz"
    
    const reportTitle = `${assessmentLabel} Results Report`

    const pdf = new jsPDF("p", "mm", "a4")
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 15
    const contentWidth = pageWidth - 2 * margin
    let yPos = margin

    // Helper function to add new page if needed
    const checkPageBreak = (requiredSpace: number) => {
      if (yPos + requiredSpace > pageHeight - margin) {
        pdf.addPage()
        yPos = margin
        return true
      }
      return false
    }

    // Sanitize text for jsPDF (Helvetica/Courier only support basic Latin - no emojis, special Unicode)
    const sanitizeForPDF = (text: string | null | undefined): string => {
      if (text == null || typeof text !== "string") return ""
      let s = text
        // Strip HTML tags
        .replace(/<[^>]*>/g, "")
        // Decode HTML entities
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        // Replace emojis and special Unicode with ASCII equivalents
        .replace(/⚠️?/g, "[!]")
        .replace(/✓|✔/g, "[OK]")
        .replace(/✗|✘|❌/g, "[X]")
        .replace(/🥇/g, "1st")
        .replace(/🎯/g, "Target")
        .replace(/💪/g, "Strong")
        .replace(/🌱/g, "Growth")
        .replace(/🚀/g, "Rocket")
        .replace(/📚/g, "Sample")
        .replace(/·|\u2022/g, "-")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\u2013|\u2014/g, "-")
      // Replace any remaining non-printable or problematic chars (keep basic Latin, digits, common punctuation)
      return s.replace(/[^\x20-\x7E\n\r\t]/g, (c) => {
        if (c === "\n" || c === "\r" || c === "\t") return c
        return "?"
      })
    }

    // Helper function to wrap text (uses sanitized + rich-text formatted text)
    const wrapText = (text: string, maxWidth: number, fontSize: number) => {
      pdf.setFontSize(fontSize)
      return pdf.splitTextToSize(sanitizeForPDF(formatRichTextForPdf(text)), maxWidth)
    }

    const drawQuestionSeparator = (y: number) => {
      checkPageBreak(8)
      pdf.setDrawColor(226, 232, 240)
      pdf.setLineWidth(0.3)
      pdf.line(margin, y, pageWidth - margin, y)
      return y + 6
    }

    // Helper function to format code with preserved line breaks and indentation
    const formatCodeForPDF = (code: string, maxWidth: number, fontSize: number) => {
      if (!code) return []
      // Split by newlines to preserve line structure; sanitize each line for PDF
      const lines = sanitizeForPDF(code).split('\n')
      const formattedLines: string[] = []
      
      pdf.setFontSize(fontSize)
      pdf.setFont("courier", "normal") // Use monospace font for code
      
      lines.forEach((line) => {
        // For each line, check if it needs wrapping (but preserve indentation)
        const lineWidth = pdf.getTextWidth(line)
        if (lineWidth <= maxWidth) {
          formattedLines.push(line)
        } else {
          // Wrap long lines while preserving indentation
          const indentMatch = line.match(/^(\s*)/)
          const indent = indentMatch ? indentMatch[1] : ''
          const content = line.trim()
          
          // Split the content part
          const wrapped = pdf.splitTextToSize(content, maxWidth - pdf.getTextWidth(indent))
          wrapped.forEach((wrappedLine: string, index: number) => {
            formattedLines.push(index === 0 ? line : indent + wrappedLine)
          })
        }
      })
      
      pdf.setFont("helvetica", "normal") // Reset to default font
      return formattedLines
    }

    // === HEADER SECTION ===
    // Modern Gradient Header Design
    const headerColor = assessmentType === "mid_semester" ? [220, 38, 38] // Red for mid-semester
      : assessmentType === "final" ? [71, 85, 105] // Slate for final
      : assessmentType === "homework" ? [245, 158, 11] // Amber for homework
      : [76, 29, 149] // Purple for quiz
    
    pdf.setFillColor(...headerColor)
    pdf.rect(0, 0, pageWidth, 40, "F")

    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(28)
    pdf.setFont("helvetica", "bold")
    pdf.text(sanitizeForPDF(reportTitle), pageWidth / 2, 18, { align: "center" })

    pdf.setFontSize(16)
    pdf.setFont("helvetica", "normal")
    pdf.text(sanitizeForPDF(results.quiz_title), pageWidth / 2, 30, { align: "center" })

    yPos = 50

    // === STUDENT INFORMATION SECTION ===
    pdf.setFillColor(248, 250, 252) // Slate-50 background
    pdf.rect(margin, yPos, contentWidth, 30, "F")

    pdf.setTextColor(30, 41, 59) // Slate-800
    pdf.setFontSize(14)
    pdf.setFont("helvetica", "bold")
    pdf.text("Student Information", margin + 8, yPos + 10)

    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(11)
    pdf.text(`Name: ${sanitizeForPDF(results.student_name)}`, margin + 8, yPos + 18)
    pdf.text(`Student ID: ${sanitizeForPDF(results.student_id)}`, margin + 8, yPos + 24)
    pdf.text(`Section: ${sanitizeForPDF(results.section)}`, margin + 80, yPos + 24)

    yPos += 40

    // === SCORE SUMMARY SECTION ===
    const totalPoints = results.total_points || results.total_questions || 0
    const pdfPendingCount = (results.questions || []).filter((q: any) => isPendingManualReview(q)).length
    const pdfAllPending = pdfPendingCount > 0 && pdfPendingCount === (results.questions || []).length
    const pdfHasViolation = results.violation_log && Array.isArray(results.violation_log) &&
      results.violation_log.some((e: any) => e?.type === "score_pending" || e?.type === "evaluation_failed")
    const pdfApiPnd = (results as any)?.should_show_pnd as boolean | undefined
    const pdfHasAnyFlag =
      pdfApiPnd === false
        ? !!(results.auto_submitted || results.violation_reason)
        : pdfApiPnd === true ||
          pdfAllPending ||
          anyQuestionHasDataButZeroPoints(results.questions || []) ||
          (pdfApiPnd !== false && pdfHasViolation) ||
          results.auto_submitted ||
          results.violation_reason
    const scoreColor = pdfHasAnyFlag ? [245, 158, 11] : (results.percentage >= 70 ? [34, 197, 94] : [250, 204, 21]) // Amber for PND, else Emerald or Gold

    pdf.setFillColor(248, 250, 252)
    pdf.rect(margin, yPos, contentWidth, 40, "F")

    // Score circle (simulated)
    pdf.setFillColor(...scoreColor)
    pdf.circle(margin + 30, yPos + 20, 15, "F")

    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(20)
    pdf.setFont("helvetica", "bold")
    const pdfCirclePct = pdfHasAnyFlag ? "PND%" : `${(Math.floor((results.percentage || 0) * 100) / 100).toFixed(2)}%`
    pdf.text(pdfCirclePct, margin + 30, yPos + 24, { align: "center" })

    pdf.setTextColor(30, 41, 59)
    pdf.setFontSize(14)
    pdf.setFont("helvetica", "bold")
    pdf.text("Score Summary", margin + 60, yPos + 12)

    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(11)
    const pdfScore = pdfHasAnyFlag ? "PND%" : (results.score?.toFixed(2) || "0")
    const pdfPct = pdfHasAnyFlag ? "PND%" : `${(Math.floor((results.percentage || 0) * 100) / 100).toFixed(2)}%`
    const pdfStatus = pdfHasAnyFlag ? "AWAITING MANUAL REVIEW" : (results.percentage >= 70 ? "PASSED" : "NEEDS IMPROVEMENT")
    pdf.text(`Score: ${pdfScore} / ${totalPoints}${pdfPendingCount > 0 ? ` (${pdfPendingCount} pending review)` : ""}`, margin + 60, yPos + 22)
    pdf.text(`Percentage: ${pdfPct}`, margin + 60, yPos + 28)
    pdf.text(`Status: ${pdfStatus}`, margin + 60, yPos + 34)

    yPos += 45

    if (results.section_breakdown && results.section_breakdown.length > 0) {
      checkPageBreak(35)
      pdf.setFillColor(248, 250, 252) // Slate-50
      pdf.rect(margin, yPos, contentWidth, 8 + results.section_breakdown.length * 8, "F")
      pdf.setDrawColor(226, 232, 240) // Slate-200
      pdf.rect(margin, yPos, contentWidth, 8 + results.section_breakdown.length * 8, "D")

      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(12)
      pdf.setTextColor(30, 41, 59)
      pdf.text("Section Breakdown", margin + 8, yPos + 6)
      yPos += 10

      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(10)
      results.section_breakdown.forEach((s) => {
        const contribution = s.weightPercent > 0 && s.max > 0
          ? ((s.earned / s.max) * s.weightPercent).toFixed(1)
          : "0"
        pdf.setTextColor(71, 85, 105) // Slate-600
        pdf.text(`${s.title} (${s.weightPercent}%)`, margin + 8, yPos + 6)
        pdf.setTextColor(30, 41, 59) // Slate-800
        pdf.text(`${s.earned.toFixed(1)} / ${s.max} pts - ${s.sectionPercentage}%`, margin + 80, yPos + 6)
        pdf.setTextColor(100, 116, 139) // Slate-500
        pdf.setFontSize(9)
        pdf.text(`+${contribution} to total`, margin + 140, yPos + 6)
        pdf.setFontSize(10)
        yPos += 8
      })
      yPos += 10
    }

    // === SUBMISSION STATUS SECTION ===
    // Show violation status if auto-submitted, otherwise show normal submission
    const isAutoSubmitted = results.auto_submitted || results.violation_reason
    if (isAutoSubmitted) {
      // Calculate content height first
      let contentHeight = 8 // Title
      contentHeight += 5 // Spacing
      
      // Violation reason height
      if (results.violation_reason) {
        const reasonText = `Reason: ${results.violation_reason}`
        const wrappedReason = wrapText(reasonText, contentWidth - 16, 10)
        contentHeight += wrappedReason.length * 5 + 2
      } else {
        contentHeight += 5
      }
      
      // Violation counts
      const violationCounts: string[] = []
      if (results.gemini_strikes_count && results.gemini_strikes_count > 0) {
        violationCounts.push(`AI Detections: ${results.gemini_strikes_count}`)
      }
      if (results.tab_switch_count && results.tab_switch_count > 0) {
        violationCounts.push(`Tab Switches: ${results.tab_switch_count}`)
      }
      if (results.copy_paste_attempts && results.copy_paste_attempts > 0) {
        violationCounts.push(`Copy/Paste Attempts: ${results.copy_paste_attempts}`)
      }
      
      if (violationCounts.length > 0) {
        contentHeight += 5
      }
      
      contentHeight += 5 // "All answers saved" line
      contentHeight += 5 // Bottom padding
      
      const boxHeight = Math.max(28, contentHeight)
      checkPageBreak(boxHeight + 5)
      
      // Warning box with red/orange background
      pdf.setFillColor(254, 226, 226) // Red-100 background
      pdf.rect(margin, yPos, contentWidth, boxHeight, "F")
      
      // Border
      pdf.setDrawColor(239, 68, 68) // Red-500 border
      pdf.setLineWidth(0.5)
      pdf.rect(margin, yPos, contentWidth, boxHeight, "D")
      
      pdf.setTextColor(185, 28, 28) // Red-700 text
      pdf.setFontSize(12)
      pdf.setFont("helvetica", "bold")
      pdf.text(sanitizeForPDF("Auto-Submitted Assessment"), margin + 8, yPos + 8)
      
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(10)
      
      // Violation reason
      let currentY = yPos + 15
      if (results.violation_reason) {
        const reasonText = `Reason: ${results.violation_reason}`
        const wrappedReason = wrapText(reasonText, contentWidth - 16, 10)
        wrappedReason.forEach((line: string, index: number) => {
          pdf.text(line, margin + 8, currentY + (index * 5))
        })
        currentY += wrappedReason.length * 5 + 2
      } else {
        pdf.text("This assessment was automatically submitted due to policy violations.", margin + 8, currentY)
        currentY += 5
      }
      
      // Show violation counts if available
      if (violationCounts.length > 0) {
        pdf.setFontSize(9)
        pdf.setTextColor(153, 27, 27) // Red-800
        pdf.text(violationCounts.join(" | "), margin + 8, currentY)
        currentY += 5
      }
      
      pdf.setFontSize(9)
      pdf.setTextColor(153, 27, 27) // Red-800
      pdf.text("All answers have been saved and recorded.", margin + 8, currentY)
      
      yPos += boxHeight + 5
    } else {
      // Normal submission indicator
      checkPageBreak(15)
      
      // Success box with green background - more compact
      pdf.setFillColor(209, 250, 229) // Emerald-100 background
      pdf.rect(margin, yPos, contentWidth, 12, "F")
      
      // Border
      pdf.setDrawColor(34, 197, 94) // Emerald-500 border
      pdf.setLineWidth(0.5)
      pdf.rect(margin, yPos, contentWidth, 12, "D")
      
      pdf.setTextColor(22, 101, 52) // Emerald-800 text
      pdf.setFontSize(10)
      pdf.setFont("helvetica", "bold")
      pdf.text("Normal Submission", margin + 6, yPos + 6)
      
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(8)
      pdf.text("This assessment was submitted normally by the student.", margin + 6, yPos + 10)
      
      yPos += 12 + 8 // Box height + spacing
    }

    // === QUESTION REVIEW SECTION ===
    pdf.setFontSize(16)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(30, 41, 59)
    pdf.text("Question Review", margin, yPos)
    yPos += 10

    // Draw separator line
    pdf.setDrawColor(226, 232, 240) // Slate-200
    pdf.line(margin, yPos, pageWidth - margin, yPos)
    yPos += 10

    const sections = results.section_config && results.questions?.length
      ? groupQuestionsBySections(
          results.questions.map((q: any) => ({ question_type: q.question_type })),
          results.section_config
        )
      : []

    const pdfLayout: QuizPdfLayout = {
      pdf,
      margin,
      contentWidth,
      pageWidth,
      pageHeight,
      checkPageBreak,
      wrapText,
      sanitizeForPDF,
    }

    // Iterate through questions
    for (let index = 0; index < results.questions.length; index++) {
      const question: any = results.questions[index]
      if (index > 0) {
        yPos = drawQuestionSeparator(yPos)
      }
      checkPageBreak(40)

      const isCircuitSubmission = question.question_type?.toLowerCase() === "circuit_submission"

      // Section header for sectioned quizzes
      if (sections.length > 0) {
        const section = getSectionForQuestionIndex(index, sections)
        const prevSection = index > 0 ? getSectionForQuestionIndex(index - 1, sections) : null
        const isNewSection = section && (section.sectionIndex !== (prevSection?.sectionIndex ?? -1))
        if (isNewSection && section) {
          checkPageBreak(18)
          pdf.setFillColor(99, 102, 241) // Indigo-500
          pdf.rect(margin, yPos, contentWidth, 10, "F")
          pdf.setTextColor(255, 255, 255)
          pdf.setFontSize(11)
          pdf.setFont("helvetica", "bold")
          pdf.text(`${sanitizeForPDF(section.title)} (${section.weightPercent}%)`, margin + 6, yPos + 6)
          pdf.setTextColor(0, 0, 0)
          yPos += 14
        }
      }

      // Question header - handle partial scores for AI-graded questions
      // Use effective points: override_points when instructor manually adjusted, else points_earned
      let statusColor, statusText
      const pendingReview = isPendingManualReview(question)
      const pointsEarned = (question.override_points != null ? question.override_points : (question.points_earned !== undefined && question.points_earned !== null ? question.points_earned : (question.is_correct ? 1 : 0)))
      const maxPoints = question.max_points || 1
      const scorePercentage = (pointsEarned / maxPoints) * 100
      
      if (pendingReview) {
        statusColor = [245, 158, 11] // Amber - pending
        statusText = "PENDING REVIEW"
      } else if (question.is_correct || scorePercentage >= 90) {
        statusColor = [34, 197, 94] // Emerald
        statusText = "CORRECT"
      } else if (scorePercentage > 0 && scorePercentage < 90) {
        statusColor = [245, 158, 11] // Amber
        statusText = "PARTIAL"
      } else {
        statusColor = [239, 68, 68] // Red
        statusText = "INCORRECT"
      }

      pdf.setFillColor(248, 250, 252) // Slate-50
      pdf.rect(margin, yPos, contentWidth, 10, "F")

      pdf.setTextColor(30, 41, 59) // Slate-800
      pdf.setFontSize(12)
      pdf.setFont("helvetica", "bold")
      pdf.text(`Question ${index + 1}`, margin + 5, yPos + 6)

      // Points badge (purple/indigo gradient effect)
      const maxPointsForDisplay = question.max_points || question.points || 1
      const pointsText = pendingReview ? `PND%/${maxPointsForDisplay} pending` : `${Math.round(pointsEarned * 10) / 10}/${maxPointsForDisplay} pts`
      
      pdf.setFillColor(237, 233, 254) // Purple-100
      pdf.rect(pageWidth - margin - 70, yPos + 2, 32, 6, "F")
      pdf.setTextColor(109, 40, 217) // Purple-700
      pdf.setFontSize(8)
      pdf.setFont("helvetica", "bold")
      pdf.text(pointsText, pageWidth - margin - 54, yPos + 6, { align: "center" })

      // Status badge
      pdf.setFillColor(...statusColor)
      pdf.rect(pageWidth - margin - 35, yPos + 2, 32, 6, "F")
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(9)
      pdf.setFont("helvetica", "bold")
      pdf.text(statusText, pageWidth - margin - 19, yPos + 6, { align: "center" })

      yPos += 10

      if (isCircuitSubmission) {
        const config = parseCircuitSubmissionConfig(question.solution_upload_config)
        const displayTitle = config.title || question.hint?.trim() || null
        if (displayTitle) {
          pdf.setTextColor(30, 41, 59)
          pdf.setFontSize(11)
          pdf.setFont("helvetica", "bold")
          const titleLines = wrapText(displayTitle, contentWidth - 10, 11)
          titleLines.forEach((line: string) => {
            checkPageBreak(6)
            pdf.text(line, margin + 5, yPos)
            yPos += 5.5
          })
          yPos += 2
        }
        if (hasActiveQuestionMedia(resolveQuestionMedia(question))) {
          yPos = await renderQuestionMediaInPdf(pdfLayout, question, yPos)
          yPos += 3
        }
      }

      // Question text
      pdf.setTextColor(0, 0, 0)
      pdf.setFontSize(10)
      pdf.setFont("helvetica", "normal")

      // Handle code blocks in question text
      if (question.question_text.includes("```")) {
        const parts = question.question_text.split("```")
        parts.forEach((part, i) => {
          if (i % 2 === 1) {
            // Code block
            checkPageBreak(15)
            pdf.setFillColor(30, 41, 59) // Dark background for code
            const codeLines = sanitizeForPDF(part).split("\n").slice(1) // Skip language identifier
            const codeHeight = codeLines.length * 4 + 4
            pdf.rect(margin + 5, yPos, contentWidth - 10, codeHeight, "F")

            pdf.setTextColor(226, 232, 240) // Light text for code
            pdf.setFontSize(8)
            pdf.setFont("courier", "normal")
            codeLines.forEach((line, lineIndex) => {
              pdf.text(line, margin + 7, yPos + 4 + lineIndex * 4)
            })
            yPos += codeHeight + 3
            pdf.setFont("helvetica", "normal")
            pdf.setTextColor(0, 0, 0)
            pdf.setFontSize(10)
          } else {
            // Regular text
            const wrappedText = wrapText(part, contentWidth - 10, 10)
            wrappedText.forEach((line: string) => {
              checkPageBreak(6)
              pdf.text(line, margin + 5, yPos)
              yPos += 5
            })
          }
        })
      } else {
        const wrappedText = wrapText(question.question_text, contentWidth - 10, 10)
        wrappedText.forEach((line: string) => {
          checkPageBreak(6)
          pdf.text(line, margin + 5, yPos)
          yPos += 5
        })
      }

      yPos += 3

      const isMultiPartQuestion = question.question_type?.toLowerCase() === "multi_part"
      if (hasActiveQuestionMedia(resolveQuestionMedia(question)) && !isCircuitSubmission) {
        yPos = await renderQuestionMediaInPdf(pdfLayout, question, yPos)
        yPos += 2
      }

      // Question type and time spent
      pdf.setFontSize(8)
      pdf.setTextColor(100, 100, 100)
      const timeStr = question.time_spent_seconds != null && question.time_spent_seconds >= 0
        ? question.time_spent_seconds >= 60
          ? `${Math.floor(question.time_spent_seconds / 60)}m ${question.time_spent_seconds % 60}s`
          : `${question.time_spent_seconds}s`
        : "—"
      const typeLabel = formatQuestionTypeLabelForPdf(question)
      pdf.text(`Type: ${sanitizeForPDF(typeLabel)} | Time: ${timeStr}`, margin + 5, yPos)
      yPos += 6

      // Handle different question types
      const isTextInputQuestion = ["fill_blank", "code_output", "trace_output", "fill_code", "trace_logic", "scenario_match", "code_write", "code_problem", "debug_code", "code_explain", "code_write_plot", "circuit_numeric", "circuit_worked_solution", "circuit_diagram_analysis", "circuit_multi_part", "circuit_fill_equation", "circuit_transfer_function", "circuit_phasor_power", "circuit_transient_response", "circuit_upload_work", "multi_part"].includes(question.question_type?.toLowerCase())
      const isSelectAllQuestion = question.question_type?.toLowerCase() === "select_all"

      if (isMultiPartQuestion) {
        yPos = await renderMultiPartQuestionInPdf(pdfLayout, question, yPos)
      } else if (isCircuitSubmission) {
        yPos = await renderCircuitSubmissionInPdf(pdfLayout, question, yPos, {
          includeTitle: false,
        })
      } else if (isTextInputQuestion) {
        // Handle fill-in-the-blank and other text input questions
        
        // Extract student code from various sources (same logic as UI)
        let studentCode = null
        let plotImage = null
        
        if (question.question_type?.toLowerCase() === "code_write_plot" || 
            ["code_write", "code_problem", "debug_code", "code_explain"].includes(question.question_type?.toLowerCase())) {
          // Priority 1: Check if code was extracted by API
          if (question.code) {
            studentCode = question.code
          }
          
          // Priority 2: Check answer_data (may contain JSON with code and plot)
          if (!studentCode && question.answer_data) {
            try {
              const parsed = JSON.parse(question.answer_data)
              studentCode = parsed.code || parsed.answer || question.selected_answer
              if (parsed.plotImage && question.question_type?.toLowerCase() === "code_write_plot") {
                plotImage = parsed.plotImage
              }
            } catch (e) {
              // Not JSON, use as-is
              studentCode = question.answer_data || question.selected_answer
            }
          }
          
          // Priority 3: Fallback to selected_answer
          if (!studentCode) {
            studentCode = question.selected_answer
          }
          
          // Show template code as-is so instructors can see what the student submitted
          
          // Also check question.plotImage (extracted by API)
          if (!plotImage && question.plotImage && question.question_type?.toLowerCase() === "code_write_plot") {
            plotImage = question.plotImage
          }
        } else {
          studentCode = question.selected_answer || question.answer_data
        }
        
        // Student's Answer
        checkPageBreak(15)
        if (question.is_correct) {
          pdf.setFillColor(209, 250, 229) // Emerald-100
        } else {
          pdf.setFillColor(254, 226, 226) // Red-100
        }
        pdf.rect(margin + 5, yPos, contentWidth - 10, 12, "F")
        
        pdf.setTextColor(30, 41, 59) // Slate-800
        pdf.setFontSize(9)
        pdf.setFont("helvetica", "bold")
        // Use "Student's Code:" for code questions, "Your Answer:" for others
        const isCodeQuestion = ["code_write", "code_problem", "debug_code", "code_explain", "code_write_plot", "code_debug"].includes(
          question.question_type?.toLowerCase()
        )
        pdf.text(isCodeQuestion ? "Student's Code:" : "Your Answer:", margin + 8, yPos + 4)
        
        pdf.setFontSize(8)
        pdf.setFont("helvetica", "normal")
        if (studentCode && studentCode.trim()) {
          // Format code with preserved line breaks and indentation
          const answerLines = formatCodeForPDF(studentCode, contentWidth - 25, 8)
          const codeHeight = Math.max(answerLines.length * 4 + 4, 12) // Minimum height
          
          // Draw code background box
          pdf.setFillColor(30, 41, 59) // Dark background for code
          pdf.rect(margin + 8, yPos + 6, contentWidth - 25, codeHeight, "F")
          
          pdf.setTextColor(226, 232, 240) // Light text for code
          pdf.setFont("courier", "normal") // Monospace font
          pdf.setFontSize(8)
          answerLines.forEach((line: string, lineIndex: number) => {
            pdf.text(line, margin + 10, yPos + 10 + lineIndex * 4)
          })
          
          // Reset font and color
          pdf.setFont("helvetica", "normal")
          pdf.setTextColor(30, 41, 59) // Reset to dark text
          
          // Add plot image for code_write_plot questions
          if (plotImage && question.question_type?.toLowerCase() === "code_write_plot") {
            yPos += codeHeight + 8
            checkPageBreak(60)
            pdf.setFontSize(8)
            pdf.setFont("helvetica", "bold")
            pdf.text("Uploaded Plot:", margin + 8, yPos)
            yPos += 6
            
            try {
              // Convert base64 to image and add to PDF
              const imageData = plotImage.startsWith('data:') 
                ? plotImage.split(',')[1] 
                : plotImage
              
              // Add image to PDF (jsPDF supports base64 images)
              pdf.addImage(imageData, 'PNG', margin + 8, yPos, contentWidth - 16, 50)
              yPos += 55
            } catch (imgError) {
              pdf.setFontSize(7)
              pdf.setTextColor(100, 100, 100)
              pdf.text("(Plot image could not be embedded)", margin + 8, yPos)
              yPos += 6
            }
          } else {
            yPos += codeHeight + 8
          }
        } else {
          pdf.text("No answer provided", margin + 8, yPos + 8)
          yPos += 10
        }
        
        // Status badge - use encouraging status for AI-graded questions
        pdf.setFontSize(7)
        pdf.setFont("helvetica", "bold")
        if (question.ai_feedback?.status) {
          // Use encouraging status with appropriate colors
          const status = question.ai_feedback.status
          if (status === "Expert") {
            pdf.setTextColor(234, 179, 8) // Yellow-500
            pdf.text(`[1st] ${status}`, pageWidth - margin - 35, yPos + 8)
          } else if (status === "Very Good") {
            pdf.setTextColor(59, 130, 246) // Blue-500
            pdf.text(`[Target] ${status}`, pageWidth - margin - 45, yPos + 8)
          } else if (status === "Keep Practicing") {
            pdf.setTextColor(34, 197, 94) // Green-500
            pdf.text(`[Strong] ${status}`, pageWidth - margin - 50, yPos + 8)
          } else if (status === "Getting Started") {
            pdf.setTextColor(168, 85, 247) // Purple-500
            pdf.text(`[Growth] ${status}`, pageWidth - margin - 55, yPos + 8)
          } else {
            pdf.setTextColor(249, 115, 22) // Orange-500
            pdf.text(`[Rocket] ${status}`, pageWidth - margin - 55, yPos + 8)
          }
        } else if (question.is_correct) {
          pdf.setTextColor(34, 197, 94)
          pdf.text("CORRECT", pageWidth - margin - 35, yPos + 8)
        } else {
          pdf.setTextColor(239, 68, 68)
          pdf.text("INCORRECT", pageWidth - margin - 40, yPos + 8)
        }
        
        yPos += 15

        // Correct Answer - only show for non-AI-graded code questions
        // AI-graded code questions don't have a single "correct answer"
        const shouldShowCorrectAnswer = !isCodeQuestion || 
          ["fill_code", "trace_logic"].includes(question.question_type?.toLowerCase())
        
        if (shouldShowCorrectAnswer) {
          checkPageBreak(15)
          pdf.setFillColor(219, 234, 254) // Blue-100
          pdf.rect(margin + 5, yPos, contentWidth - 10, 12, "F")
          
          pdf.setTextColor(30, 64, 175) // Blue-800
          pdf.setFontSize(9)
          pdf.setFont("helvetica", "bold")
          pdf.text("Correct Answer:", margin + 8, yPos + 4)
          
          // Answer key badge
          pdf.setFontSize(7)
          pdf.setFont("helvetica", "bold")
          pdf.setTextColor(30, 64, 175) // Blue-800
          pdf.text("ANSWER KEY", pageWidth - margin - 35, yPos + 4)
          
          pdf.setFontSize(8)
          pdf.setFont("helvetica", "normal")
          pdf.setTextColor(30, 41, 59) // Slate-800
          
          // Handle different formats of correct_answer
          let correctAnswer = question.correct_answer;
          if (typeof correctAnswer === 'string') {
            try {
              const parsed = JSON.parse(correctAnswer);
              if (Array.isArray(parsed)) {
                correctAnswer = parsed.join(", ");
              }
            } catch (e) {
              // Keep as string
            }
          } else if (Array.isArray(correctAnswer)) {
            correctAnswer = correctAnswer.join(", ");
          }
          
          if (correctAnswer) {
            const correctAnswerStr = correctAnswer.toString()
            // Check if this is code (for fill_code, trace_logic questions)
            const isCodeAnswer = ["fill_code", "trace_logic"].includes(question.question_type?.toLowerCase()) && (
              correctAnswerStr.includes('{') || 
              correctAnswerStr.includes(';') || 
              correctAnswerStr.includes('#include') ||
              correctAnswerStr.includes('int main') ||
              correctAnswerStr.split('\n').length > 1
            )
            
            if (isCodeAnswer) {
              // Format code with preserved line breaks
              const correctLines = formatCodeForPDF(correctAnswerStr, contentWidth - 25, 8)
              const codeHeight = Math.max(correctLines.length * 4 + 4, 12) // Minimum height
              
              // Draw code background box
              pdf.setFillColor(30, 41, 59) // Dark background for code
              pdf.rect(margin + 8, yPos + 6, contentWidth - 25, codeHeight, "F")
              
              pdf.setTextColor(226, 232, 240) // Light text for code
              pdf.setFont("courier", "normal") // Monospace font
              pdf.setFontSize(8)
              correctLines.forEach((line: string, lineIndex: number) => {
                pdf.text(line, margin + 10, yPos + 10 + lineIndex * 4)
              })
              
              // Reset font and color
              pdf.setFont("helvetica", "normal")
              pdf.setTextColor(30, 41, 59) // Reset to dark text
              yPos += codeHeight + 8
            } else {
              // Regular text formatting
              const correctLines = wrapText(correctAnswerStr, contentWidth - 25, 8)
              correctLines.forEach((line: string, lineIndex: number) => {
                pdf.text(line, margin + 8, yPos + 8 + lineIndex * 4)
              })
              yPos += correctLines.length * 4 + 8
            }
          } else {
            pdf.text("No correct answer specified", margin + 8, yPos + 8)
            yPos += 15
          }
        }
      } else if (isSelectAllQuestion) {
        // Handle Select All questions
        
        // Student's Answer
        checkPageBreak(15)
        if (question.is_correct) {
          pdf.setFillColor(209, 250, 229) // Emerald-100
        } else {
          pdf.setFillColor(254, 226, 226) // Red-100
        }
        pdf.rect(margin + 5, yPos, contentWidth - 10, 12, "F")
        
        pdf.setTextColor(30, 41, 59) // Slate-800
        pdf.setFont("helvetica", "bold")
        pdf.text("Your Answer:", margin + 8, yPos + 4)
        
        pdf.setFont("helvetica", "normal")
        if (question.selected_answer) {
          try {
            const selectedAnswers = JSON.parse(question.selected_answer)
            selectedAnswers.forEach((answer: string, index: number) => {
              const optionKey = `option_${answer.toLowerCase()}` as keyof typeof question
              const optionText = question[optionKey] as string
              if (optionText) {
                pdf.text(`${answer}. ${sanitizeForPDF(optionText)}`, margin + 8, yPos + 8 + (index * 4))
              }
            })
          } catch (e) {
            pdf.text(sanitizeForPDF(question.selected_answer), margin + 8, yPos + 8)
          }
        } else {
          pdf.text("No answer selected", margin + 8, yPos + 8)
        }
        
        yPos += 20
        
        // Correct Answer
        checkPageBreak(15)
        pdf.setFillColor(219, 234, 254) // Blue-100
        pdf.rect(margin + 5, yPos, contentWidth - 10, 12, "F")
        
        pdf.setTextColor(30, 64, 175) // Blue-800
        pdf.setFontSize(9)
        pdf.setFont("helvetica", "bold")
        pdf.text("Correct Answer:", margin + 8, yPos + 4)
        
        pdf.setFontSize(8)
        pdf.setFont("helvetica", "normal")
        pdf.setTextColor(30, 41, 59) // Slate-800
        
        if (question.correct_answer) {
          try {
            const correctAnswers = JSON.parse(question.correct_answer)
            correctAnswers.forEach((answer: string, index: number) => {
              const optionKey = `option_${answer.toLowerCase()}` as keyof typeof question
              const optionText = question[optionKey] as string
              if (optionText) {
                pdf.text(`${answer}. ${sanitizeForPDF(optionText)}`, margin + 8, yPos + 8 + (index * 4))
              }
            })
          } catch (e) {
            pdf.text(sanitizeForPDF(question.correct_answer), margin + 8, yPos + 8)
          }
        } else {
          pdf.text("No correct answer specified", margin + 8, yPos + 8)
        }
        
        // Answer key badge
        pdf.setFontSize(7)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(30, 64, 175) // Blue-800
        pdf.text("ANSWER KEY", pageWidth - margin - 35, yPos + 8)
        
        yPos += 20
      } else {
        // Handle MCQ/True-False questions with options
      const options = [
        { key: "option_a", letter: "A" },
        { key: "option_b", letter: "B" },
        { key: "option_c", letter: "C" },
        { key: "option_d", letter: "D" },
        { key: "option_e", letter: "E" },
      ]

      options.forEach(({ key, letter }) => {
        const optionValue = question[key as keyof QuestionResult]
        if (!optionValue) return

        checkPageBreak(10)

        const optionTextValue = String(optionValue || "").trim()
        const correctAnswer = String(question.correct_answer || "").trim()
        const selectedAnswer = String(question.selected_answer || "").trim()
        
        // Check if correct_answer is a letter (A, B, C, D, E) or text
        const correctIsLetter = /^[A-E]$/i.test(correctAnswer)
        const selectedIsLetter = /^[A-E]$/i.test(selectedAnswer)
        
        // Determine if this option is correct
        let isCorrect = false
        if (correctIsLetter) {
          isCorrect = correctAnswer.toUpperCase() === letter
        } else {
          isCorrect = correctAnswer.toLowerCase().trim() === optionTextValue.toLowerCase().trim()
        }
        
        // Determine if this option was selected
        let isSelected = false
        if (selectedIsLetter) {
          isSelected = selectedAnswer.toUpperCase() === letter
        } else {
          isSelected = selectedAnswer.toLowerCase().trim() === optionTextValue.toLowerCase().trim()
        }

        // Option background
        if (isCorrect) {
          pdf.setFillColor(209, 250, 229) // Emerald-100
        } else if (isSelected) {
          pdf.setFillColor(254, 226, 226) // Red-100
        } else {
          pdf.setFillColor(248, 250, 252) // Slate-50
        }

        const optionHeight = 10
        pdf.rect(margin + 5, yPos, contentWidth - 10, optionHeight, "F")

        // Option text
        pdf.setTextColor(30, 41, 59) // Slate-800
        pdf.setFontSize(10)
        pdf.setFont("helvetica", "normal")
        pdf.text(`${letter}.`, margin + 8, yPos + 6)

        const optionText = wrapText(optionValue as string, contentWidth - 30, 10)
        pdf.text(optionText[0], margin + 15, yPos + 6)

        // Status label - simplified to avoid overlap
        if (isCorrect && isSelected) {
          pdf.setFontSize(7)
          pdf.setTextColor(34, 197, 94)
          pdf.text("CORRECT", pageWidth - margin - 25, yPos + 6)
        } else if (isCorrect) {
          pdf.setFontSize(7)
          pdf.setTextColor(100, 116, 139) // Gray for correct but not selected
          pdf.text("ANSWER", pageWidth - margin - 20, yPos + 6)
        } else if (isSelected) {
          pdf.setFontSize(7)
          pdf.setTextColor(239, 68, 68)
          pdf.text("WRONG", pageWidth - margin - 25, yPos + 6)
        }

        yPos += optionHeight + 2
      })
      
      // Add "Your Answer" summary section for MCQ/True-False (clean, non-redundant format)
      if (question.question_type?.toLowerCase() === "mcq" || question.question_type?.toLowerCase() === "true_false") {
        checkPageBreak(12)
        yPos += 5
        
        // Background box
        if (question.is_correct) {
          pdf.setFillColor(209, 250, 229) // Emerald-100
        } else {
          pdf.setFillColor(254, 226, 226) // Red-100
        }
        pdf.rect(margin + 5, yPos, contentWidth - 10, 10, "F")
        
        // "Your Answer:" label
        pdf.setFontSize(9)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(51, 65, 85) // Slate-700
        pdf.text("Your Answer:", margin + 8, yPos + 6)
        
        // Selected answer text
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(9)
        if (question.selected_answer) {
          const selectedAnswer = String(question.selected_answer || "").trim()
          const isLetter = /^[A-E]$/i.test(selectedAnswer)
          
          let selectedLetter: string
          let selectedOptionText: string
          
          if (isLetter) {
            // Selected answer is a letter (A, B, C, D, E)
            selectedLetter = selectedAnswer.toUpperCase()
            const selectedOptionKey = `option_${selectedLetter.toLowerCase()}` as keyof QuestionResult
            selectedOptionText = String(question[selectedOptionKey] || selectedAnswer)
          } else {
            // Selected answer is text (like "True", "False")
            // Find which option matches this text
            const options = [
              { key: "option_a", letter: "A" },
              { key: "option_b", letter: "B" },
              { key: "option_c", letter: "C" },
              { key: "option_d", letter: "D" },
              { key: "option_e", letter: "E" },
            ]
            
            const matchingOption = options.find(opt => {
              const optionText = String(question[opt.key as keyof QuestionResult] || "").trim()
              return optionText.toLowerCase() === selectedAnswer.toLowerCase()
            })
            
            if (matchingOption) {
              selectedLetter = matchingOption.letter
              selectedOptionText = String(question[matchingOption.key as keyof QuestionResult] || selectedAnswer)
            } else {
              // No matching option found, display as-is
              selectedLetter = ""
              selectedOptionText = selectedAnswer
            }
          }
          
          pdf.setTextColor(30, 41, 59) // Slate-800
          const answerText = selectedLetter ? `${selectedLetter}. ${selectedOptionText}` : selectedOptionText
          // Wrap long answer text
          const answerLines = wrapText(answerText, contentWidth - 50, 9)
          answerLines.forEach((line: string, lineIndex: number) => {
            pdf.text(line, margin + 32, yPos + 6 + (lineIndex * 4))
          })
        } else {
          pdf.setTextColor(100, 116, 139) // Slate-500
          pdf.text("No answer selected", margin + 32, yPos + 6)
        }
        
        // Status badge - positioned to avoid overlap
        pdf.setFontSize(8)
        pdf.setFont("helvetica", "bold")
        if (question.is_correct) {
          pdf.setTextColor(34, 197, 94) // Green-600
          pdf.text("CORRECT", pageWidth - margin - 30, yPos + 6)
        } else {
          pdf.setTextColor(239, 68, 68) // Red-500
          pdf.text("INCORRECT", pageWidth - margin - 35, yPos + 6)
        }
        
        yPos += 12
      }
      
      // Correct Answer section for MCQ/True-False (separate from "Your Answer" section)
      if (question.question_type?.toLowerCase() === "mcq" || question.question_type?.toLowerCase() === "true_false") {
        checkPageBreak(12)
        yPos += 3
        
        pdf.setFillColor(219, 234, 254) // Blue-100
        pdf.rect(margin + 5, yPos, contentWidth - 10, 10, "F")
        
        pdf.setTextColor(30, 64, 175) // Blue-800
        pdf.setFontSize(9)
        pdf.setFont("helvetica", "bold")
        pdf.text("Correct Answer:", margin + 8, yPos + 6)
        
        // Answer key badge
        pdf.setFontSize(7)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(30, 64, 175) // Blue-800
        pdf.text("ANSWER KEY", pageWidth - margin - 30, yPos + 6)
        
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(9)
        pdf.setTextColor(30, 41, 59) // Slate-800
        
        if (question.correct_answer) {
          const correctAnswer = String(question.correct_answer || "").trim()
          const isLetter = /^[A-E]$/i.test(correctAnswer)
          
          let correctLetter: string
          let correctOptionText: string
          
          if (isLetter) {
            correctLetter = correctAnswer.toUpperCase()
            const correctOptionKey = `option_${correctLetter.toLowerCase()}` as keyof QuestionResult
            correctOptionText = String(question[correctOptionKey] || correctAnswer)
          } else {
            // Find matching option
            const options = [
              { key: "option_a", letter: "A" },
              { key: "option_b", letter: "B" },
              { key: "option_c", letter: "C" },
              { key: "option_d", letter: "D" },
              { key: "option_e", letter: "E" },
            ]
            
            const matchingOption = options.find(opt => {
              const optionText = String(question[opt.key as keyof QuestionResult] || "").trim()
              return optionText.toLowerCase() === correctAnswer.toLowerCase()
            })
            
            if (matchingOption) {
              correctLetter = matchingOption.letter
              correctOptionText = String(question[matchingOption.key as keyof QuestionResult] || correctAnswer)
            } else {
              correctLetter = ""
              correctOptionText = correctAnswer
            }
          }
          
          const answerText = correctLetter ? `${correctLetter}. ${correctOptionText}` : correctOptionText
          // Wrap long answer text
          const answerLines = wrapText(answerText, contentWidth - 50, 9)
          answerLines.forEach((line: string, lineIndex: number) => {
            pdf.text(line, margin + 32, yPos + 6 + (lineIndex * 4))
          })
        } else {
          pdf.setTextColor(100, 116, 139) // Slate-500
          pdf.text("No correct answer specified", margin + 32, yPos + 6)
        }
        
        yPos += 12
      }
      }

      // "Not Answered" message removed from PDF - all question types already show their answers in the options/answer sections above

      // AI Feedback section (if available)
      if (question.ai_feedback && question.ai_feedback.feedback) {
        checkPageBreak(30)
        yPos += 4

        if (
          question.ai_feedback.questionType === "circuit_submission" ||
          question.ai_feedback.circuitSubmissionAiGraded != null
        ) {
          yPos = renderCircuitSubmissionAiFeedbackInPdf(pdfLayout, question.ai_feedback, yPos)
        } else {
        checkPageBreak(30)
        yPos += 5 // Extra space before AI feedback section
        
        // Quiz Master Feedback header
        pdf.setFillColor(239, 246, 255) // Blue-50
        pdf.rect(margin + 5, yPos, contentWidth - 10, 8, "F")
        pdf.setTextColor(30, 64, 175) // Blue-800
        pdf.setFontSize(9)
        pdf.setFont("helvetica", "bold")
        pdf.text("Quiz Master Evaluation Feedback", margin + 8, yPos + 5)
        yPos += 12 // Increased spacing after header

        // Score breakdown
        if (question.ai_feedback.criteria) {
          checkPageBreak(20)
          pdf.setFontSize(8)
          pdf.setTextColor(100, 100, 100)
          pdf.setFont("helvetica", "normal")
          
          const criteria = question.ai_feedback.criteria
          pdf.text(`Correctness: ${criteria.correctness}/40`, margin + 8, yPos)
          yPos += 5 // Increased line spacing
          pdf.text(`Code Quality: ${criteria.codeQuality}/25`, margin + 8, yPos)
          yPos += 5
          pdf.text(`Efficiency: ${criteria.efficiency}/20`, margin + 8, yPos)
          yPos += 5
          pdf.text(`Completeness: ${criteria.completeness}/15`, margin + 8, yPos)
          yPos += 8 // Extra space after criteria
        }

        // Grade Breakdown (if available)
        if (question.ai_feedback.gradeBreakdown) {
          checkPageBreak(25)
          const breakdown = question.ai_feedback.gradeBreakdown
          
          // Reasoning
          if (breakdown.reasoning) {
            pdf.setFontSize(8)
            pdf.setTextColor(30, 64, 175) // Blue-800
            pdf.setFont("helvetica", "bold")
            pdf.text("Reasoning:", margin + 8, yPos)
            yPos += 5
            
            pdf.setFont("helvetica", "normal")
            pdf.setTextColor(30, 41, 59) // Slate-800
            const reasoningLines = pdf.splitTextToSize(sanitizeForPDF(breakdown.reasoning), contentWidth - 16)
            reasoningLines.forEach((line: string) => {
              checkPageBreak(5)
              pdf.text(line, margin + 8, yPos)
              yPos += 5 // Increased line spacing
            })
            yPos += 3
          }
          
          // Strengths
          if (breakdown.strengths && breakdown.strengths.length > 0) {
            checkPageBreak(15)
            pdf.setFontSize(8)
            pdf.setTextColor(34, 197, 94) // Green-500
            pdf.setFont("helvetica", "bold")
            pdf.text("Strengths:", margin + 8, yPos)
            yPos += 5
            
            pdf.setFont("helvetica", "normal")
            pdf.setTextColor(100, 100, 100)
            breakdown.strengths.forEach((strength: string) => {
              checkPageBreak(5)
              const strengthLines = pdf.splitTextToSize(sanitizeForPDF(`- ${strength}`), contentWidth - 16)
              strengthLines.forEach((line: string) => {
                pdf.text(line, margin + 12, yPos)
                yPos += 5
              })
            })
            yPos += 3
          }
          
          // Weaknesses
          if (breakdown.weaknesses && breakdown.weaknesses.length > 0) {
            checkPageBreak(15)
            pdf.setFontSize(8)
            pdf.setTextColor(239, 68, 68) // Red-500
            pdf.setFont("helvetica", "bold")
            pdf.text("Weaknesses:", margin + 8, yPos)
            yPos += 5
            
            pdf.setFont("helvetica", "normal")
            pdf.setTextColor(100, 100, 100)
            breakdown.weaknesses.forEach((weakness: string) => {
              checkPageBreak(5)
              const weaknessLines = pdf.splitTextToSize(sanitizeForPDF(`- ${weakness}`), contentWidth - 16)
              weaknessLines.forEach((line: string) => {
                pdf.text(line, margin + 12, yPos)
                yPos += 5
              })
            })
            yPos += 3
          }
          
          // Improvements
          if (breakdown.improvements && breakdown.improvements.length > 0) {
            checkPageBreak(15)
            pdf.setFontSize(8)
            pdf.setTextColor(245, 158, 11) // Amber-500
            pdf.setFont("helvetica", "bold")
            pdf.text("Improvements:", margin + 8, yPos)
            yPos += 5
            
            pdf.setFont("helvetica", "normal")
            pdf.setTextColor(100, 100, 100)
            breakdown.improvements.forEach((improvement: string) => {
              checkPageBreak(5)
              const improvementLines = pdf.splitTextToSize(sanitizeForPDF(`- ${improvement}`), contentWidth - 16)
              improvementLines.forEach((line: string) => {
                pdf.text(line, margin + 12, yPos)
                yPos += 5
              })
            })
            yPos += 3
          }
        }

        // Main feedback + suggestions (structured numbered points and bullet sections)
        const gradeBreakdown = question.ai_feedback.gradeBreakdown
        yPos = renderStructuredAiFeedbackInPdf(pdfLayout, question.ai_feedback, yPos, {
          skipHeader: true,
          skipRubric: true,
          includeStrengths: !(gradeBreakdown?.strengths?.length),
          includeImprovements: !(gradeBreakdown?.improvements?.length),
        })

        yPos += 5 // Extra space after AI feedback section
        }
      }

      // Sample Answers section (if available in ai_feedback or question)
      const sampleAnswers = question.ai_feedback?.sampleAnswers || question.sample_answers
      if (sampleAnswers && sampleAnswers.length > 0) {
        checkPageBreak(15)
        
        // Sample Answers header
        pdf.setFillColor(254, 249, 195) // Yellow-100
        pdf.rect(margin + 5, yPos, contentWidth - 10, 8, "F")
        pdf.setTextColor(133, 77, 14) // Amber-800
        pdf.setFontSize(9)
        pdf.setFont("helvetica", "bold")
        pdf.text("Sample Correct Answers", margin + 8, yPos + 5)
        yPos += 10

        sampleAnswers.forEach((sample: any, index: number) => {
          checkPageBreak(20)
          
          // Approach label
          pdf.setFontSize(8)
          pdf.setTextColor(79, 70, 229) // Indigo-600
          pdf.setFont("helvetica", "bold")
          pdf.text(`Approach ${index + 1}: ${sanitizeForPDF(sample.approach || "Solution")}`, margin + 8, yPos)
          yPos += 5
          
          // Description (if available)
          if (sample.description) {
            pdf.setFontSize(7)
            pdf.setTextColor(100, 100, 100)
            pdf.setFont("helvetica", "italic")
            const descLines = pdf.splitTextToSize(sanitizeForPDF(sample.description), contentWidth - 20)
            descLines.forEach((line: string) => {
              checkPageBreak(3)
              pdf.text(line, margin + 8, yPos)
              yPos += 3
            })
            yPos += 2
          }
          
          // Code sample
          pdf.setFontSize(7)
          pdf.setTextColor(30, 41, 59) // Slate-800
          pdf.setFont("courier", "normal")
          
          const codeLines = sanitizeForPDF(sample.code || sample.answer || "").split("\n")
          codeLines.forEach((line: string) => {
            checkPageBreak(3)
            // Limit line length to prevent overflow
            const trimmedLine = line.substring(0, 120)
            pdf.text(trimmedLine, margin + 10, yPos)
            yPos += 3
          })
          
          yPos += 5 // Space between samples
        })
        
        yPos += 4
      }

      yPos += 12 // Space between questions
    }

    // === FOOTER ===
    const totalPages = pdf.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i)
      pdf.setFontSize(9)
      pdf.setTextColor(100, 116, 139) // Slate-500
      pdf.text(
        `Generated on ${formatToCDT(new Date())} CDT | Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 12,
        { align: "center" },
      )
    }

    return pdf.output("arraybuffer")
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error))
  }
}
