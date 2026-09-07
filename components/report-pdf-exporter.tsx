import jsPDF from 'jspdf'
import { formatToCDT } from '@/lib/timezone'

/** Payload from GET /api/instructor/reports/student?studentId= */
export interface StudentIndividualReportPayload {
  student: {
    id: number
    fullName: string
    studentNumber: string | number | null
    email: string
    section: string | null
    sessionCatalogCode: string | null
  }
  gradebook: Record<string, unknown> | null
  attempts: Array<{
    attemptId: number
    quizId: number
    quizTitle: string
    assessmentType: string
    completedAt: string | null
    displayScore: number
    displayTotal: number
    percentage: number
    tabSwitches: number
    copyPasteAttempts: number
  }>
  summary: {
    completedAttempts: number
    avgPercentage: number
  }
  generatedAt: string
}

interface ReportPDFExporterProps {
  reportData: any
  reportType: string
  reportTitle: string
  onExport?: () => void
}

const TABULAR_INSTRUCTOR_REPORT_IDS = new Set([
  "quiz-performance",
  "student-progress",
  "session-analytics",
  "assessment-summary",
  "completion-rates",
  "learning-analytics",
  "performance-trends",
  "observability",
])

function formatPdfCell(v: unknown): string {
  if (v == null) return "—"
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "—"
  if (typeof v === "boolean") return v ? "Yes" : "No"
  if (typeof v === "object") {
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  }
  const s = String(v)
  return s.length > 200 ? s.slice(0, 197) + "…" : s
}

function pdfRecordTitle(row: Record<string, unknown>, index: number): string {
  const rt = row.recordType
  if (typeof rt === "string" && rt) {
    return `${index + 1}. [${rt.replace(/_/g, " ")}]`
  }
  const keys = [
    "quizName",
    "studentName",
    "sessionName",
    "assessmentType",
    "week",
    "date",
  ] as const
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== "") {
      return `${index + 1}. ${row[k]}`
    }
  }
  return `${index + 1}. Record`
}

export const exportReportToPDF = ({ reportData, reportType, reportTitle, onExport }: ReportPDFExporterProps) => {
  try {
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    let yPosition = 20

    const isAntiCheat = reportType === 'anti-cheat-reports'
    const headerRgb = isAntiCheat ? { p: [220, 38, 38] as const, a: [239, 68, 68] as const } : { p: [51, 65, 85] as const, a: [100, 116, 139] as const }
    const accentText = isAntiCheat ? [220, 38, 38] as const : [51, 65, 85] as const

    // Helper function to add new page if needed
    const checkNewPage = (requiredSpace: number = 10) => {
      if (yPosition + requiredSpace > pageHeight - 20) {
        pdf.addPage()
        yPosition = 20
        return true
      }
      return false
    }

    // Helper function to add text with word wrapping
    const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 12) => {
      pdf.setFontSize(fontSize)
      const lines = pdf.splitTextToSize(text, maxWidth)
      pdf.text(lines, x, y)
      return y + (lines.length * (fontSize * 0.35))
    }

    // Header bar
    pdf.setFillColor(headerRgb.p[0], headerRgb.p[1], headerRgb.p[2])
    pdf.rect(0, 0, pageWidth, 32, 'F')
    
    pdf.setFillColor(headerRgb.a[0], headerRgb.a[1], headerRgb.a[2])
    pdf.rect(0, 28, pageWidth, 4, 'F')
    
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(20)
    pdf.setFont('helvetica', 'bold')
    const titleLine = (reportTitle || 'CourseCollab Report').length > 72
      ? (reportTitle || 'CourseCollab Report').slice(0, 69) + '…'
      : (reportTitle || 'CourseCollab Report')
    pdf.text(titleLine, 15, 18)
    
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.text('Generated: ' + formatToCDT(new Date()), pageWidth - 15, 20, { align: 'right' })

    yPosition = 42

    pdf.setFillColor(248, 250, 252)
    pdf.roundedRect(15, yPosition, pageWidth - 30, 20, 3, 3, 'F')
    
    pdf.setTextColor(71, 85, 105)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.text('Report Type:', 20, yPosition + 8)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(30, 41, 59)
    pdf.text(reportType.replace(/-/g, ' ').toUpperCase(), 20, yPosition + 14)
    
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(71, 85, 105)
    pdf.text('Total Records:', pageWidth / 2, yPosition + 8)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(accentText[0], accentText[1], accentText[2])
    const totalRecords = reportData?.data?.length || reportData?.summary_stats?.total_attempts || 0
    pdf.text(String(totalRecords), pageWidth / 2, yPosition + 14)
    
    yPosition += 28

    // Anti-Cheat Report Specific Content
    if (reportType === 'anti-cheat-reports' && reportData) {
      // Modern Summary Statistics with card design
      checkNewPage(50)
      
      // Section header with accent line
      pdf.setFillColor(220, 38, 38) // Red-600
      pdf.rect(15, yPosition, 4, 8, 'F')
      pdf.setTextColor(220, 38, 38)
      pdf.setFontSize(16)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Summary Statistics', 22, yPosition + 6)
      yPosition += 14

      if (reportData.summary_stats) {
        const stats = reportData.summary_stats
        
        // Modern KPI cards
        checkNewPage(35)
        const kpiY = yPosition
        const boxW = (pageWidth - 30 - 6) / 3
        const cardData = [
          { c: [220, 38, 38], bg: [254, 226, 226], label: 'Violations', val: stats.attempts_with_violations || 0 },
          { c: [234, 88, 12], bg: [255, 237, 213], label: 'High Risk', val: stats.high_risk_attempts || 0 },
          { c: [37, 99, 235], bg: [219, 234, 254], label: 'Violation Rate', val: stats.violation_rate || '0%' },
        ]
        
        cardData.forEach((card, i) => {
          const x = 15 + i * (boxW + 3)
          // Card background
          pdf.setFillColor(card.bg[0], card.bg[1], card.bg[2])
          pdf.roundedRect(x, kpiY, boxW, 22, 2, 2, 'F')
          
          // Value
          pdf.setTextColor(card.c[0], card.c[1], card.c[2])
          pdf.setFontSize(18)
          pdf.setFont('helvetica', 'bold')
          pdf.text(String(card.val), x + boxW / 2, kpiY + 10, { align: 'center' })
          
          // Label
          pdf.setFontSize(8)
          pdf.setFont('helvetica', 'normal')
          pdf.text(card.label, x + boxW / 2, kpiY + 17, { align: 'center' })
        })
        
        yPosition += 30
        
        // Comprehensive Statistics Grid
        checkNewPage(50)
        
        // Overview Stats
        pdf.setFillColor(241, 245, 249) // Slate-100
        pdf.roundedRect(15, yPosition, pageWidth - 30, 35, 2, 2, 'F')
        
        pdf.setTextColor(30, 41, 59) // Slate-800
        pdf.setFontSize(11)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Overview Statistics', 20, yPosition + 7)
        
        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(71, 85, 105) // Slate-600
        
        const col1X = 20
        const col2X = pageWidth / 2 + 5
        let statsY = yPosition + 15
        
        // Left column
        pdf.text(`Total Attempts: ${stats.total_attempts || 0}`, col1X, statsY)
        pdf.text(`Attempts with Violations: ${stats.attempts_with_violations || 0}`, col1X, statsY + 5)
        pdf.text(`Violation Rate: ${stats.violation_rate || '0%'}`, col1X, statsY + 10)
        
        // Right column
        pdf.text(`High Risk: ${stats.high_risk_attempts || 0}`, col2X, statsY)
        pdf.text(`Medium Risk: ${stats.medium_risk_attempts || 0}`, col2X, statsY + 5)
        pdf.text(`Low Risk: ${stats.low_risk_attempts || 0}`, col2X, statsY + 10)
        
        yPosition += 42
        
        // Violation Type Breakdown
        pdf.setFillColor(254, 226, 226) // Red-100
        pdf.roundedRect(15, yPosition, pageWidth - 30, 30, 2, 2, 'F')
        
        pdf.setTextColor(220, 38, 38) // Red-600
        pdf.setFontSize(11)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Violation Type Breakdown', 20, yPosition + 7)
        
        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(71, 85, 105)
        
        statsY = yPosition + 15
        
        // Tab switches
        pdf.text(`Tab Switches:`, col1X, statsY)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(220, 38, 38)
        pdf.text(`Avg: ${(stats.avg_tab_switches || 0).toFixed(2)}`, col1X + 35, statsY)
        
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(71, 85, 105)
        
        // Copy/Paste
        pdf.text(`Copy/Paste Attempts:`, col2X, statsY)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(234, 88, 12) // Orange
        pdf.text(`Avg: ${(stats.avg_copy_paste_attempts || 0).toFixed(2)}`, col2X + 45, statsY)
        
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(71, 85, 105)
        
        // Mouse leaves
        pdf.text(`Mouse Leave Events:`, col1X, statsY + 6)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(37, 99, 235) // Blue
        pdf.text(`Avg: ${(stats.avg_mouse_leaves || 0).toFixed(2)}`, col1X + 40, statsY + 6)
        
        yPosition += 38

      }

      // Top Violators
      if (reportData.top_violators && reportData.top_violators.length > 0) {
        checkNewPage(30)
        
        // Section header with accent line
        pdf.setFillColor(220, 38, 38) // Red-600
        pdf.rect(15, yPosition, 4, 8, 'F')
        pdf.setTextColor(220, 38, 38)
        pdf.setFontSize(16)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Top Violators', 22, yPosition + 6)
        yPosition += 12

        // Table header
        const headerY = yPosition
        pdf.setFillColor(252, 231, 233)
        pdf.rect(15, headerY - 5, pageWidth - 30, 8, 'F')
        pdf.setFontSize(8.5)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(100,116,139)
        const cols = [15, 95, 120, 138, 156, 174]
        pdf.text('Student', cols[0], headerY)
        pdf.text('Violations', cols[1], headerY)
        pdf.text('Tab', cols[2], headerY)
        pdf.text('Copy', cols[3], headerY)
        pdf.text('Mouse', cols[4], headerY)
        pdf.text('Avg %', cols[5], headerY)
        yPosition = headerY + 9

        // Rows with improved styling
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(30, 41, 59) // Slate-800
        pdf.setFontSize(8)
        reportData.top_violators.slice(0, 15).forEach((v: any, idx: number) => {
          checkNewPage(8)
          // Zebra striping
          if (idx % 2 === 1) {
            pdf.setFillColor(248, 250, 252) // Slate-50
            pdf.rect(15, yPosition - 4, pageWidth - 30, 6, 'F')
          }
          const student = v.student_name.length > 28 ? 
            v.student_name.substring(0, 28) + '...' : v.student_name
          pdf.text(student, cols[0] + 2, yPosition)
          
          // Bold violation count if high
          if (v.total_violations > 5) {
            pdf.setFont('helvetica', 'bold')
            pdf.setTextColor(220, 38, 38) // Red
          }
          pdf.text(String(v.total_violations || 0), cols[1] + 2, yPosition)
          pdf.setFont('helvetica', 'normal')
          pdf.setTextColor(30, 41, 59)
          
          pdf.text(String(v.total_tab_switches || 0), cols[2] + 2, yPosition)
          pdf.text(String(v.total_copy_paste_attempts || 0), cols[3] + 2, yPosition)
          pdf.text(String(v.total_mouse_leaves || 0), cols[4] + 2, yPosition)
          const avg = typeof v.avg_score === 'number' ? v.avg_score : parseFloat(v.avg_score || '0') || 0
          pdf.text(avg.toFixed(1), cols[5] + 2, yPosition)
          yPosition += 5
        })
        yPosition += 8
      }

      // Assessment Statistics
      if (reportData.assessment_stats && reportData.assessment_stats.length > 0) {
        checkNewPage(30)
        
        // Section header with accent line
        pdf.setFillColor(220, 38, 38) // Red-600
        pdf.rect(15, yPosition, 4, 8, 'F')
        pdf.setTextColor(220, 38, 38)
        pdf.setFontSize(16)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Assessment Statistics', 22, yPosition + 6)
        yPosition += 12

        pdf.setTextColor(71, 85, 105) // Slate-600
        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'normal')
        
        reportData.assessment_stats.slice(0, 10).forEach((assessment: any, idx: number) => {
          checkNewPage(15)
          
          // Assessment card with light background
          if (idx % 2 === 0) {
            pdf.setFillColor(248, 250, 252) // Slate-50
            pdf.roundedRect(15, yPosition - 2, pageWidth - 30, 12, 1, 1, 'F')
          }
          
          pdf.setTextColor(30, 41, 59) // Slate-800
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(10)
          pdf.text(`${assessment.assessment_title}`, 18, yPosition + 2)
          
          pdf.setFont('helvetica', 'normal')
          pdf.setTextColor(71, 85, 105)
          pdf.setFontSize(8)
          const statsLine = `Type: ${assessment.assessment_type} | Attempts: ${assessment.total_attempts} | Violations: ${assessment.attempts_with_violations} | High Risk: ${assessment.high_risk_attempts} | Avg: ${(assessment.avg_score || 0).toFixed(1)}%`
          pdf.text(statsLine, 18, yPosition + 7)
          
          yPosition += 14
        })
        yPosition += 4
      }

      // Detailed Violations (Sample)
      if (reportData.data && reportData.data.length > 0) {
        checkNewPage(30)
        
        // Section header with accent line
        pdf.setFillColor(220, 38, 38) // Red-600
        pdf.rect(15, yPosition, 4, 8, 'F')
        pdf.setTextColor(220, 38, 38)
        pdf.setFontSize(16)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Detailed Violations (Sample)', 22, yPosition + 6)
        yPosition += 12
        
        // Table header
        const headerY = yPosition
        pdf.setFillColor(254, 226, 226) // Red-100 header
        pdf.rect(15, headerY - 5, pageWidth - 30, 8, 'F')
        
        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(100, 116, 139) // Slate-500
        pdf.text('Student', 17, headerY)
        pdf.text('Assessment', 60, headerY)
        pdf.text('Risk', 110, headerY)
        pdf.text('Tab', 125, headerY)
        pdf.text('Copy', 135, headerY)
        pdf.text('Mouse', 145, headerY)
        pdf.text('Score%', 155, headerY)
        pdf.text('Date', 165, headerY)
        
        yPosition = headerY + 9

        // Table rows with zebra striping
        reportData.data.slice(0, 50).forEach((violation: any, idx: number) => {
          checkNewPage(8)
          
          // Zebra striping
          if (idx % 2 === 1) {
            pdf.setFillColor(248, 250, 252) // Slate-50
            pdf.rect(15, yPosition - 4, pageWidth - 30, 6, 'F')
          }
          
          pdf.setFontSize(7)
          pdf.setFont('helvetica', 'normal')
          pdf.setTextColor(30, 41, 59) // Slate-800
          
          // Student name (truncated)
          const studentName = violation.student_name.length > 12 ? 
            violation.student_name.substring(0, 12) + '...' : violation.student_name
          pdf.text(studentName, 17, yPosition)
          
          // Assessment title (truncated)
          const assessmentTitle = violation.assessment_title.length > 15 ? 
            violation.assessment_title.substring(0, 15) + '...' : violation.assessment_title
          pdf.text(assessmentTitle, 60, yPosition)
          
          // Risk level with color coding
          const riskColors: Record<string, number[]> = {
            'HIGH': [220, 38, 38],
            'MEDIUM': [234, 88, 12],
            'LOW': [37, 99, 235],
            'NONE': [71, 85, 105]
          }
          const riskColor = riskColors[violation.risk_level] || [71, 85, 105]
          pdf.setFont('helvetica', 'bold')
          pdf.setTextColor(riskColor[0], riskColor[1], riskColor[2])
          pdf.text(violation.risk_level, 110, yPosition)
          
          pdf.setFont('helvetica', 'normal')
          pdf.setTextColor(30, 41, 59)
          
          // Violation counts
          pdf.text(violation.tab_switch_count?.toString() || '0', 125, yPosition)
          pdf.text(violation.copy_paste_attempts?.toString() || '0', 135, yPosition)
          pdf.text(violation.mouse_leave_count?.toString() || '0', 145, yPosition)
          
          // Score
          const pct = typeof violation.percentage === 'number' 
            ? violation.percentage 
            : parseFloat(violation.percentage ?? '0') || 0
          pdf.text(pct.toFixed(1), 155, yPosition)
          
          // Date (truncated)
          const date = new Date(violation.started_at).toLocaleDateString()
          pdf.text(date, 165, yPosition)
          
          yPosition += 5
        })
        yPosition += 5
      }
    } else if (
      TABULAR_INSTRUCTOR_REPORT_IDS.has(reportType) &&
      reportData &&
      Array.isArray(reportData.data) &&
      reportData.data.length > 0
    ) {
      checkNewPage(24)
      pdf.setFillColor(headerRgb.p[0], headerRgb.p[1], headerRgb.p[2])
      pdf.rect(15, yPosition, 4, 8, 'F')
      pdf.setTextColor(headerRgb.p[0], headerRgb.p[1], headerRgb.p[2])
      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Detailed records', 22, yPosition + 6)
      yPosition += 14

      const bundle = reportData.metadata?.learningAnalyticsBundle
      if (bundle?.insights && typeof bundle.insights === 'object') {
        checkNewPage(22)
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(30, 41, 59)
        pdf.text('Learning analytics — summary', 15, yPosition)
        yPosition += 6
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8.5)
        pdf.setTextColor(71, 85, 105)
        for (const [k, v] of Object.entries(bundle.insights as Record<string, unknown>)) {
          checkNewPage(5)
          const line = `${k.replace(/([A-Z])/g, ' $1').trim()}: ${formatPdfCell(v)}`
          yPosition = addWrappedText(line, 18, yPosition, pageWidth - 24, 8.5) + 2
        }
        yPosition += 4
      }

      const rows = reportData.data as Record<string, unknown>[]
      const maxRows = reportType === 'learning-analytics' ? 100 : 180
      for (let i = 0; i < Math.min(rows.length, maxRows); i++) {
        const row = rows[i]
        const entries = Object.entries(row).filter(
          ([key]) => !['violation_log', 'detailed_violations'].includes(key),
        )
        checkNewPage(26)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(9)
        pdf.setTextColor(30, 41, 59)
        yPosition = addWrappedText(pdfRecordTitle(row, i), 15, yPosition, pageWidth - 30, 9) + 3
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        pdf.setTextColor(71, 85, 105)
        for (const [key, val] of entries.slice(0, 11)) {
          checkNewPage(5)
          const line = `${key.replace(/([A-Z])/g, ' $1').trim()}: ${formatPdfCell(val)}`
          yPosition = addWrappedText(line, 18, yPosition, pageWidth - 22, 8) + 1
        }
        yPosition += 5
      }
      if (rows.length > maxRows) {
        checkNewPage(10)
        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'italic')
        pdf.setTextColor(100, 116, 139)
        yPosition = addWrappedText(
          `… and ${rows.length - maxRows} more rows — use Export CSV for the full dataset.`,
          15,
          yPosition,
          pageWidth - 30,
          9,
        ) + 4
      }
    } else if (reportData && reportData.data) {
      // Generic report content
      pdf.setTextColor(0, 0, 0)
      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      yPosition = addWrappedText('Report Data', 15, yPosition, pageWidth - 30, 14) + 5

      if (Array.isArray(reportData.data)) {
        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'normal')
        
        reportData.data.slice(0, 100).forEach((item: any, index: number) => {
          checkNewPage(15)
          const itemText = `${index + 1}. ${JSON.stringify(item, null, 2)}`
          yPosition = addWrappedText(itemText, 15, yPosition, pageWidth - 30, 9) + 5
        })
      }
    }

    // Footer
    const totalPages = pdf.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i)
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(100, 100, 100)
      pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 20, pageHeight - 10, { align: 'right' })
      pdf.text('CourseCollab Analytics Report', 15, pageHeight - 10)
    }

    // Save the PDF
    const fileName = `${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
    pdf.save(fileName)

    if (onExport) {
      onExport()
    }

    return true
  } catch (error) {
    console.error('Error generating PDF:', error)
    return false
  }
}

/**
 * Instructor-facing PDF for a single student (assessment history + stored gradebook snapshot).
 */
export function exportStudentIndividualReportPdf(
  payload: StudentIndividualReportPayload,
  onExport?: () => void,
): boolean {
  try {
    const pdf = new jsPDF("p", "mm", "a4")
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    let y = 18

    const checkNewPage = (need: number) => {
      if (y + need > pageHeight - 16) {
        pdf.addPage()
        y = 18
        return true
      }
      return false
    }

    // Header — indigo (distinct from anti-cheat red)
    pdf.setFillColor(67, 56, 202)
    pdf.rect(0, 0, pageWidth, 30, "F")
    pdf.setFillColor(99, 102, 241)
    pdf.rect(0, 26, pageWidth, 4, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(18)
    pdf.setFont("helvetica", "bold")
    pdf.text("Student progress report", 14, 14)
    pdf.setFontSize(9)
    pdf.setFont("helvetica", "normal")
    pdf.text(formatToCDT(new Date()), pageWidth - 14, 14, { align: "right" })

    y = 38
    pdf.setTextColor(30, 41, 59)
    const st = payload.student
    pdf.setFontSize(15)
    pdf.setFont("helvetica", "bold")
    pdf.text(st.fullName, 14, y)
    y += 8
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(71, 85, 105)
    const lines = [
      st.studentNumber != null && st.studentNumber !== ""
        ? `Student ID: ${st.studentNumber}`
        : null,
      st.email ? `Email: ${st.email}` : null,
      st.section ? `Section: ${st.section}` : null,
      st.sessionCatalogCode
        ? `Session (catalog): ${st.sessionCatalogCode}`
        : null,
    ].filter(Boolean) as string[]
    for (const line of lines) {
      pdf.text(line, 14, y)
      y += 5
    }

    y += 4
    pdf.setTextColor(67, 56, 202)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(11)
    pdf.text("Summary", 14, y)
    y += 6
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9)
    pdf.setTextColor(51, 65, 85)
    pdf.text(
      `Completed attempts: ${payload.summary.completedAttempts} • Avg score (% across attempts): ${payload.summary.avgPercentage}%`,
      14,
      y,
    )
    y += 8

    const gb = payload.gradebook
    if (gb && typeof gb === "object") {
      checkNewPage(40)
      pdf.setTextColor(67, 56, 202)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(11)
      pdf.text("Stored gradebook snapshot", 14, y)
      y += 6
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(9)
      pdf.setTextColor(51, 65, 85)
      const nums: [string, string][] = [
        ["Quiz %", String(gb.quiz_score ?? "—")],
        ["Homework %", String(gb.homework_score ?? "—")],
        ["Midterm %", String(gb.midterm_score ?? "—")],
        ["Final %", String(gb.final_score ?? "—")],
        ["Attendance %", String(gb.attendance_score ?? "—")],
        ["Project %", String(gb.project_score ?? "—")],
        ["Classroom %", String(gb.classroom_score ?? "—")],
        ["Engagement", String(gb.engagement_credits ?? "—")],
        ["Course total %", String(gb.total_score ?? "—")],
        ["Letter", String(gb.letter_grade ?? "—")],
        ["Session key", String(gb.session ?? "—")],
      ]
      for (const [k, v] of nums) {
        pdf.setFont("helvetica", "bold")
        pdf.text(`${k}:`, 14, y)
        pdf.setFont("helvetica", "normal")
        const vStr = v.length > 70 ? v.slice(0, 67) + "…" : v
        pdf.text(vStr, 52, y)
        y += 4.5
      }
      y += 4
    }

    checkNewPage(20)
    pdf.setTextColor(67, 56, 202)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(11)
    pdf.text("Assessment history (display scoring)", 14, y)
    y += 7

    if (payload.attempts.length === 0) {
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(9)
      pdf.setTextColor(100, 116, 139)
      pdf.text("No completed attempts on record.", 14, y)
      y += 8
    } else {
      const colX = [14, 52, 92, 128, 154, 178]
      pdf.setFillColor(241, 245, 249)
      pdf.rect(12, y - 4, pageWidth - 24, 7, "F")
      pdf.setFontSize(7.5)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(71, 85, 105)
      pdf.text("Assessment", colX[0], y)
      pdf.text("Type", colX[1], y)
      pdf.text("Completed", colX[2], y)
      pdf.text("Score", colX[3], y)
      pdf.text("%", colX[4], y)
      pdf.text("Integrity", colX[5], y)
      y += 6
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(30, 41, 59)

      for (let i = 0; i < payload.attempts.length; i++) {
        checkNewPage(8)
        const a = payload.attempts[i]
        if (i % 2 === 1) {
          pdf.setFillColor(248, 250, 252)
          pdf.rect(12, y - 3.5, pageWidth - 24, 6, "F")
        }
        const title =
          a.quizTitle.length > 22 ? a.quizTitle.slice(0, 20) + "…" : a.quizTitle
        pdf.setFontSize(7)
        pdf.text(title, colX[0] + 1, y)
        const typeShort =
          (a.assessmentType || "").length > 10
            ? (a.assessmentType || "").slice(0, 8) + "…"
            : a.assessmentType || "—"
        pdf.text(typeShort, colX[1] + 1, y)
        const when = a.completedAt
          ? formatToCDT(new Date(a.completedAt))
          : "—"
        pdf.text(when.length > 14 ? when.slice(0, 12) + "…" : when, colX[2], y)
        pdf.text(
          `${Number(a.displayScore).toFixed(1)}/${Number(a.displayTotal).toFixed(1)}`,
          colX[3],
          y,
        )
        pdf.text(`${Number(a.percentage).toFixed(1)}`, colX[4], y)
        pdf.text(`T${a.tabSwitches}/C${a.copyPasteAttempts}`, colX[5], y)
        y += 5.2
      }
    }

    const totalPages = pdf.getNumberOfPages()
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p)
      pdf.setFontSize(8)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(100, 100, 100)
      pdf.text(`Page ${p} of ${totalPages}`, pageWidth - 18, pageHeight - 8, {
        align: "right",
      })
      pdf.text("CourseCollab — Student report", 14, pageHeight - 8)
    }

    const safeName = String(st.fullName).replace(/[^a-zA-Z0-9]+/g, "_")
    pdf.save(`Student_Report_${safeName}_${new Date().toISOString().split("T")[0]}.pdf`)
    onExport?.()
    return true
  } catch (e) {
    console.error("exportStudentIndividualReportPdf", e)
    return false
  }
}

export default function ReportPDFExporter({ reportData, reportType, reportTitle, onExport }: ReportPDFExporterProps) {
  const handleExport = () => {
    const success = exportReportToPDF({ reportData, reportType, reportTitle, onExport })
    if (!success) {
      throw new Error('Failed to generate PDF report')
    }
  }

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors duration-200"
    >
      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Export PDF
    </button>
  )
}
