"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { 
  Shield, 
  AlertTriangle, 
  Users, 
  TrendingUp, 
  Clock, 
  Download,
  Eye,
  ChevronDown,
  ChevronUp,
  FileText,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Zap,
  UserX,
  MousePointer,
  Copy,
  Monitor
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { jsPDF } from "jspdf"

interface AntiCheatReportData {
  data: any[]
  summary_stats: any
  violation_breakdown: any[]
  top_violators: any[]
  assessment_stats: any[]
  time_trends: any[]
  metadata: any
}

interface AntiCheatReportViewerProps {
  reportData: AntiCheatReportData
  onClose?: () => void
  showHeader?: boolean
}

// Helper functions outside component
const getRiskColor = (level: string) => {
  switch (level) {
    case 'HIGH': return 'bg-red-100 text-red-800 border-red-200'
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'LOW': return 'bg-blue-100 text-blue-800 border-blue-200'
    default: return 'bg-green-100 text-green-800 border-green-200'
  }
}

const getViolationIcon = (type: string) => {
  switch (type) {
    case 'tab_switch': return <Monitor className="h-4 w-4" />
    case 'copy_attempt':
    case 'paste_attempt':
    case 'copy_paste': return <Copy className="h-4 w-4" />
    case 'mouse_leave': return <MousePointer className="h-4 w-4" />
    default: return <AlertTriangle className="h-4 w-4" />
  }
}

export function AntiCheatReportViewer({ reportData, onClose, showHeader = true }: AntiCheatReportViewerProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary']))
  const [selectedTab, setSelectedTab] = useState("overview")

  // Defensive checks - ensure all required arrays exist
  const safeReportData = {
    data: reportData?.data || [],
    summary_stats: reportData?.summary_stats || {},
    violation_breakdown: reportData?.violation_breakdown || [],
    top_violators: reportData?.top_violators || [],
    assessment_stats: reportData?.assessment_stats || [],
    time_trends: reportData?.time_trends || [],
    metadata: reportData?.metadata || { generated_at: new Date().toISOString(), filters: {}, summary: {} }
  }

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const generatePDF = () => {
    const pdf = new jsPDF("p", "mm", "a4")
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 15
    const contentWidth = pageWidth - 2 * margin
    let yPos = margin

    // Helper functions
    const checkPageBreak = (requiredSpace: number) => {
      if (yPos + requiredSpace > pageHeight - margin) {
        pdf.addPage()
        yPos = margin
        return true
      }
      return false
    }

    const addSection = (title: string, content: string, isHeader = false) => {
      checkPageBreak(15)
      if (isHeader) {
        pdf.setFillColor(220, 38, 38) // Red background
        pdf.rect(0, 0, pageWidth, 40, "F")
        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(24)
        pdf.setFont("helvetica", "bold")
        pdf.text(title, pageWidth / 2, 25, { align: "center" })
        yPos = 50
      } else {
        pdf.setTextColor(220, 38, 38)
        pdf.setFontSize(16)
        pdf.setFont("helvetica", "bold")
        pdf.text(title, margin, yPos)
        yPos += 10
      }
      
      pdf.setTextColor(30, 41, 59)
      pdf.setFontSize(10)
      pdf.setFont("helvetica", "normal")
      const lines = pdf.splitTextToSize(content, contentWidth)
      lines.forEach((line: string) => {
        checkPageBreak(5)
        pdf.text(line, margin, yPos)
        yPos += 5
      })
      yPos += 5
    }

    // Header
    addSection("Anti-Cheat Behavior Analysis Report", "", true)
    
    // Report metadata
    addSection("Report Information", 
      `Generated: ${new Date(safeReportData.metadata.generated_at).toLocaleString()}
Filters: ${Object.entries(safeReportData.metadata.filters || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}
Total Records: ${safeReportData.metadata.filters?.totalRecords || 0}`)

    // Summary statistics
    const stats = safeReportData.summary_stats
    addSection("Summary Statistics",
      `Total Attempts: ${stats.total_attempts || 0}
Attempts with Violations: ${stats.attempts_with_violations || 0}
High Risk Attempts: ${stats.high_risk_attempts || 0}
Medium Risk Attempts: ${stats.medium_risk_attempts || 0}
Low Risk Attempts: ${stats.low_risk_attempts || 0}
Violation Rate: ${safeReportData.metadata.summary?.violation_rate || '0%'}
Average Tab Switches: ${(parseFloat(stats.avg_tab_switches) || 0).toFixed(2)}
Average Copy/Paste Attempts: ${(parseFloat(stats.avg_copy_paste_attempts) || 0).toFixed(2)}
Average Mouse Leaves: ${(parseFloat(stats.avg_mouse_leaves) || 0).toFixed(2)}`)

    // Top violators
    if (safeReportData.top_violators && safeReportData.top_violators.length > 0) {
      addSection("Top Violators", 
        safeReportData.top_violators.slice(0, 10).map((violator, index) => 
          `${index + 1}. ${violator.student_name || 'Unknown'} (${violator.student_section || 'Unknown'})
   - Total Violations: ${violator.total_violations || 0}
   - Tab Switches: ${violator.total_tab_switches || 0}
   - Copy/Paste Attempts: ${violator.total_copy_paste_attempts || 0}
   - Mouse Leaves: ${violator.total_mouse_leaves || 0}
   - Average Score: ${(parseFloat(violator.avg_score) || 0).toFixed(1)}%`
        ).join('\n\n'))
    }

    // Assessment statistics
    if (safeReportData.assessment_stats && safeReportData.assessment_stats.length > 0) {
      addSection("Assessment-Specific Statistics",
        safeReportData.assessment_stats.slice(0, 10).map(assessment =>
          `${assessment.assessment_title || 'Unknown'} (${assessment.assessment_type || 'Unknown'})
   - Total Attempts: ${assessment.total_attempts || 0}
   - Violations: ${assessment.attempts_with_violations || 0}
   - High Risk: ${assessment.high_risk_attempts || 0}
   - Average Score: ${(parseFloat(assessment.avg_score) || 0).toFixed(1)}%`
        ).join('\n\n'))
    }

    // Detailed violations (sample)
    const sampleViolations = safeReportData.data.slice(0, 20)
    if (sampleViolations.length > 0) {
      addSection("Detailed Violation Records (Sample)",
        sampleViolations.map((attempt, index) =>
          `${index + 1}. Student: ${attempt.student_name} (${attempt.student_section})
   Assessment: ${attempt.assessment_title}
   Risk Level: ${attempt.risk_level}
   Tab Switches: ${attempt.tab_switch_count}
   Copy/Paste: ${attempt.copy_paste_attempts}
   Mouse Leaves: ${attempt.mouse_leave_count}
   Score: ${attempt.score || 'N/A'}%`
        ).join('\n\n'))
    }

    // Footer
    checkPageBreak(20)
    pdf.setFontSize(8)
    pdf.setTextColor(100, 100, 100)
    pdf.text(
      `Generated on ${new Date().toLocaleString()} | Anti-Cheat Analysis Report`,
      pageWidth / 2,
      yPos,
      { align: "center" }
    )

    // Save PDF
    const filename = `Anti-Cheat-Report-${new Date().toISOString().split('T')[0]}.pdf`
    pdf.save(filename)
  }

  return (
    <>
      <div className="space-y-6 max-w-7xl mx-auto p-6">
        {/* Header (optional) */}
        {showHeader && (
        <Card className="border-red-200 bg-gradient-to-r from-red-50 to-red-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-red-600 shadow-lg">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold text-red-900">
                    Anti-Cheat Behavior Analysis
                  </CardTitle>
                  <CardDescription className="text-red-700">
                    Comprehensive security report generated on {new Date(safeReportData.metadata.generated_at).toLocaleString()}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  onClick={generatePDF}
                  className="bg-red-600 hover:bg-red-700 text-white shadow-lg"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
                {onClose && (
                  <Button variant="outline" onClick={onClose}>
                    Close
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-red-600" />
            Summary Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-slate-900">{safeReportData.summary_stats?.total_attempts || 0}</div>
              <div className="text-sm text-slate-600">Total Attempts</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{safeReportData.summary_stats?.attempts_with_violations || 0}</div>
              <div className="text-sm text-slate-600">With Violations</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">{safeReportData.summary_stats?.high_risk_attempts || 0}</div>
              <div className="text-sm text-slate-600">High Risk</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-700">{safeReportData.metadata.summary?.violation_rate || '0%'}</div>
              <div className="text-sm text-slate-600">Violation Rate</div>
            </div>
          </div>
          
          <div className="mt-6 space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Tab Switches</span>
                <span>{(parseFloat(safeReportData.summary_stats?.avg_tab_switches) || 0).toFixed(2)} avg</span>
              </div>
              <Progress value={Math.min(100, (safeReportData.summary_stats?.avg_tab_switches || 0) * 10)} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Copy/Paste Attempts</span>
                <span>{(parseFloat(safeReportData.summary_stats?.avg_copy_paste_attempts) || 0).toFixed(2)} avg</span>
              </div>
              <Progress value={Math.min(100, (safeReportData.summary_stats?.avg_copy_paste_attempts || 0) * 20)} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Mouse Leaves</span>
                <span>{(parseFloat(safeReportData.summary_stats?.avg_mouse_leaves) || 0).toFixed(2)} avg</span>
              </div>
              <Progress value={Math.min(100, (safeReportData.summary_stats?.avg_mouse_leaves || 0) * 2)} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different views - Modernized */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="mt-6">
        <TabsList className="grid w-full grid-cols-5 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-sm h-auto">
          <TabsTrigger 
            value="overview" 
            className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg transition-all duration-200 py-3 flex flex-col items-center gap-1"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="text-xs font-medium">Overview</span>
          </TabsTrigger>
          <TabsTrigger 
            value="violators" 
            className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg transition-all duration-200 py-3 flex flex-col items-center gap-1"
          >
            <UserX className="h-4 w-4" />
            <span className="text-xs font-medium">Top Violators</span>
          </TabsTrigger>
          <TabsTrigger 
            value="assessments" 
            className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg transition-all duration-200 py-3 flex flex-col items-center gap-1"
          >
            <Target className="h-4 w-4" />
            <span className="text-xs font-medium">Assessments</span>
          </TabsTrigger>
          <TabsTrigger 
            value="students" 
            className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg transition-all duration-200 py-3 flex flex-col items-center gap-1"
          >
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">Student Reports</span>
          </TabsTrigger>
          <TabsTrigger 
            value="details" 
            className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg transition-all duration-200 py-3 flex flex-col items-center gap-1"
          >
            <FileText className="h-4 w-4" />
            <span className="text-xs font-medium">Detailed Records</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
          {/* Risk Level Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-red-600" />
                Risk Level Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {safeReportData.violation_breakdown.map((item, index) => (
                  <div key={index} className="text-center p-4 rounded-lg border">
                    <Badge className={`${getRiskColor(item.risk_level)} mb-2`}>
                      {item.risk_level}
                    </Badge>
                    <div className="text-2xl font-bold text-slate-900">{item.count}</div>
                    <div className="text-sm text-slate-600">Attempts</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Tab: {(parseFloat(item.avg_tab_switches) || 0).toFixed(1)} | 
                      Copy: {(parseFloat(item.avg_copy_paste_attempts) || 0).toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Time Trends */}
          {safeReportData.time_trends.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-red-600" />
                  Violation Trends (Last 30 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {safeReportData.time_trends.slice(0, 10).map((trend, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <div className="font-medium">{new Date(trend.date).toLocaleDateString()}</div>
                        <div className="text-sm text-slate-600">{trend.total_attempts} total attempts</div>
                      </div>
                      <div className="text-right">
                        <div className="text-red-600 font-bold">{trend.attempts_with_violations} violations</div>
                        <div className="text-xs text-slate-500">
                          {((parseFloat(trend.attempts_with_violations) || 0) / (parseFloat(trend.total_attempts) || 1) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          </motion.div>
        </TabsContent>

        <TabsContent value="violators" className="space-y-6 mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserX className="h-5 w-5 text-red-600" />
                Top Violators
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {safeReportData.top_violators.map((violator, index) => (
                  <div key={index} className="p-4 border rounded-lg bg-slate-50">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-bold text-slate-900">{violator.student_name}</div>
                        <div className="text-sm text-slate-600">{violator.student_email} • {violator.student_section}</div>
                      </div>
                      <Badge variant="destructive" className="text-lg px-3 py-1">
                        #{index + 1}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{violator.total_violations}</div>
                        <div className="text-xs text-slate-600">Total Violations</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{violator.total_tab_switches}</div>
                        <div className="text-xs text-slate-600">Tab Switches</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">{violator.total_copy_paste_attempts}</div>
                        <div className="text-xs text-slate-600">Copy/Paste</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{(parseFloat(violator.avg_score) || 0).toFixed(1)}%</div>
                        <div className="text-xs text-slate-600">Avg Score</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="assessments" className="space-y-6 mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-red-600" />
                Assessment Statistics
              </CardTitle>
              <CardDescription>
                Violation patterns by assessment
              </CardDescription>
            </CardHeader>
            <CardContent>
              {safeReportData.assessment_stats.length === 0 ? (
                <div className="text-sm text-slate-500">No assessment data available.</div>
              ) : (
                <div className="space-y-4">
                  {safeReportData.assessment_stats.map((assessment, idx) => (
                    <div key={`${assessment.assessment_title}-${idx}`} className="p-4 border rounded-lg bg-gradient-to-r from-slate-50 to-white">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-semibold text-slate-900">{assessment.assessment_title}</div>
                          <div className="text-xs text-slate-600 capitalize">{assessment.assessment_type}</div>
                        </div>
                        <Badge variant={assessment.high_risk_attempts > 0 ? "destructive" : "outline"}>
                          {assessment.high_risk_attempts} High Risk
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="text-center p-2 bg-blue-50 rounded-lg">
                          <div className="text-lg font-bold text-blue-600">{assessment.total_attempts}</div>
                          <div className="text-xs text-slate-600">Total Attempts</div>
                        </div>
                        <div className="text-center p-2 bg-red-50 rounded-lg">
                          <div className="text-lg font-bold text-red-600">{assessment.attempts_with_violations}</div>
                          <div className="text-xs text-slate-600">With Violations</div>
                        </div>
                        <div className="text-center p-2 bg-orange-50 rounded-lg">
                          <div className="text-lg font-bold text-orange-600">{assessment.high_risk_attempts}</div>
                          <div className="text-xs text-slate-600">High Risk</div>
                        </div>
                        <div className="text-center p-2 bg-green-50 rounded-lg">
                          <div className="text-lg font-bold text-green-600">{(assessment.avg_score || 0).toFixed(1)}%</div>
                          <div className="text-xs text-slate-600">Avg Score</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="students" className="space-y-6 mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-red-600" />
                Student Reports
              </CardTitle>
              <CardDescription>
                Summary of students with any violation activity in this dataset
              </CardDescription>
            </CardHeader>
            <CardContent>
              {safeReportData.top_violators.length === 0 ? (
                <div className="text-sm text-slate-500">No violation activity recorded.</div>
              ) : (
                <div className="space-y-3">
                  {safeReportData.top_violators.slice(0, 20).map((v, idx) => (
                    <div key={`${v.student_id}-${idx}`} className="p-3 border rounded-lg bg-slate-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-900">{v.student_name}</div>
                          <div className="text-xs text-slate-600">{v.student_section}</div>
                        </div>
                        <Badge variant="outline">{v.total_violations} violations</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-2 text-xs text-slate-600">
                        <div>Tab switches: <span className="font-semibold text-slate-800">{v.total_tab_switches}</span></div>
                        <div>Copy/paste: <span className="font-semibold text-slate-800">{v.total_copy_paste_attempts}</span></div>
                        <div>Mouse leaves: <span className="font-semibold text-slate-800">{v.total_mouse_leaves}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="details" className="space-y-6 mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-red-600" />
                Detailed Violation Records
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {safeReportData.data.slice(0, 50).map((attempt, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="p-4 border rounded-lg bg-slate-50"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-bold text-slate-900">{attempt.student_name}</div>
                        <div className="text-sm text-slate-600">{attempt.student_section} • {attempt.assessment_title}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(attempt.started_at).toLocaleString()}
                        </div>
                      </div>
                      <Badge className={getRiskColor(attempt.risk_level)}>
                        {attempt.risk_level}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div className="text-center">
                        <div className="text-lg font-bold text-orange-600">{attempt.tab_switch_count}</div>
                        <div className="text-xs text-slate-600">Tab Switches</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-yellow-600">{attempt.copy_paste_attempts}</div>
                        <div className="text-xs text-slate-600">Copy/Paste</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600">{attempt.mouse_leave_count}</div>
                        <div className="text-xs text-slate-600">Mouse Leaves</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">{attempt.score || 'N/A'}%</div>
                        <div className="text-xs text-slate-600">Score</div>
                      </div>
                    </div>

                    {/* Detailed violations */}
                    {attempt.detailed_violations && attempt.detailed_violations.length > 0 && (
                      <div className="mt-3">
                        <div className="text-sm font-medium text-slate-700 mb-2">Violation Timeline:</div>
                        <div className="space-y-1">
                          {attempt.detailed_violations.slice(0, 5).map((violation: any, vIndex: number) => (
                            <div key={vIndex} className="flex items-center gap-2 text-xs bg-white p-2 rounded border">
                              {getViolationIcon(violation.type)}
                              <span className="capitalize">{violation.type.replace('_', ' ')}</span>
                              <span className="text-slate-500">
                                {new Date(violation.timestamp).toLocaleTimeString()}
                              </span>
                              {violation.percentage_through_attempt && (
                                <Badge variant="outline" className="text-xs">
                                  {violation.percentage_through_attempt}
                                </Badge>
                              )}
                            </div>
                          ))}
                          {attempt.detailed_violations.length > 5 && (
                            <div className="text-xs text-slate-500 italic">
                              ... and {attempt.detailed_violations.length - 5} more violations
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Risk indicators */}
                    {attempt.risk_indicators && attempt.risk_indicators.length > 0 && (
                      <div className="mt-3">
                        <div className="text-sm font-medium text-red-700 mb-1">Risk Indicators:</div>
                        <div className="flex flex-wrap gap-1">
                          {attempt.risk_indicators.map((indicator: string, iIndex: number) => (
                            <Badge key={iIndex} variant="destructive" className="text-xs">
                              {indicator}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
      </div>
    </>
  )
}
