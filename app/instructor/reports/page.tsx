"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { motion } from "framer-motion"
import { 
  FileText, 
  Download, 
  Filter, 
  Calendar,
  BarChart3,
  TrendingUp,
  Users,
  BookOpen,
  RefreshCw,
  Eye,
  ArrowUpRight,
  ArrowLeft,
  Clock,
  Target,
  Award,
  Activity,
  PieChart,
  LineChart,
  Settings,
  Plus,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Zap,
  Trash2,
  LayoutGrid,
  List,
  AlertTriangle,
  Brain,
  UserRound,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Progress } from "@/components/ui/progress"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { AntiCheatReportViewer } from "@/components/anti-cheat-report-viewer"
import {
  exportReportToPDF,
  exportStudentIndividualReportPdf,
  type StudentIndividualReportPayload,
} from "@/components/report-pdf-exporter"
import { getFacultyModuleTheme } from "@/lib/faculty-module-themes"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { AN_META, AN_PANEL, AN_SPINNER, PORTAL_TEXT_MUTED } from "@/lib/analytics/analytics-instructor-ui"
import { cn } from "@/lib/utils"
import { ObservabilityLogsViewer } from "@/components/observability-logs-viewer"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

const instructorReportsHeaders = (extra: Record<string, string> = {}) =>
  buildInstructorAuthorizedApiHeaders({
    "x-instructor-id":
      typeof localStorage !== "undefined" ? localStorage.getItem("instructorId") ?? "" : "",
    ...extra,
  })

interface ReportData {
  reports: Array<{
    id?: number
    type: string
    title: string
    data: any[]
    summary?: {
      totalRecords: number
      averageScore?: number
      completionRate?: number
    }
  }>
  generatedAt: string
  filters: {
    type: string
    startDate?: string
    endDate?: string
  }
}

interface ReportTemplate {
  id: string
  name: string
  description: string
  icon: any
  color: string
  category: string
}

export function InstructorReportsContent({
  embedInDashboard,
  embedInHub,
  activeTab: controlledTab = "templates",
  onActiveTabChange,
}: {
  embedInDashboard?: boolean
  embedInHub?: boolean
  activeTab?: "templates" | "generated"
  onActiveTabChange?: (tab: "templates" | "generated") => void
} = {}) {
  const fp = embedInHub ? facultyEmbedChrome("reports").p : getFacultyModuleTheme("reports").page
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState("all")
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [dateRange, setDateRange] = useState({ start: "", end: "" })
  const [internalTab, setInternalTab] = useState("templates")
  const activeTab = embedInHub ? controlledTab : internalTab
  const setActiveTab = useCallback(
    (tab: "templates" | "generated") => {
      if (embedInHub) onActiveTabChange?.(tab)
      else setInternalTab(tab)
    },
    [embedInHub, onActiveTabChange],
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedReport, setSelectedReport] = useState<any>(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [deletedReports, setDeletedReports] = useState<any[]>([])
  const [showDeletedModal, setShowDeletedModal] = useState(false)
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const [showAntiCheatReport, setShowAntiCheatReport] = useState(false)
  const [antiCheatReportData, setAntiCheatReportData] = useState<any>(null)
  const [showObservabilityLogs, setShowObservabilityLogs] = useState(false)
  const { toast } = useToast()
  const [studentSearchResults, setStudentSearchResults] = useState<
    Array<{
      id: number
      fullName: string
      studentNumber: string | number | null
      email: string
      section: string | null
      sessionCatalogCode: string | null
    }>
  >([])
  const [studentSearchLoading, setStudentSearchLoading] = useState(false)
  const [studentReportLoading, setStudentReportLoading] = useState(false)
  const [studentReportPayload, setStudentReportPayload] =
    useState<StudentIndividualReportPayload | null>(null)
  const [showStudentReportDialog, setShowStudentReportDialog] = useState(false)

  // Report templates
  const reportTemplates: ReportTemplate[] = [
    {
      id: "quiz-performance",
      name: "Quiz Performance Analysis",
      description: "Detailed analysis of quiz performance across all students",
      icon: BarChart3,
      color: "blue",
      category: "Assessment"
    },
    {
      id: "student-progress",
      name: "Student Progress Report",
      description: "Track individual student progress and engagement",
      icon: Users,
      color: "green",
      category: "Student"
    },
    {
      id: "session-analytics",
      name: "Session Analytics",
      description: "Comprehensive session performance and participation",
      icon: TrendingUp,
      color: "purple",
      category: "Session"
    },
    {
      id: "assessment-summary",
      name: "Assessment Summary",
      description: "Overview of all assessments and their outcomes",
      icon: Target,
      color: "orange",
      category: "Assessment"
    },
    {
      id: "completion-rates",
      name: "Completion Rates",
      description: "Track completion rates across different assessments",
      icon: CheckCircle2,
      color: "emerald",
      category: "Analytics"
    },
    {
      id: "learning-analytics",
      name: "Learning Analytics Dashboard",
      description: "Comprehensive learning insights with daily activity, top performers, and intervention needs",
      icon: Brain,
      color: "indigo",
      category: "Analytics"
    },
    {
      id: "performance-trends",
      name: "Performance Trends",
      description: "Analyze performance trends over time",
      icon: LineChart,
      color: "pink",
      category: "Analytics"
    },
    {
      id: "anti-cheat-reports",
      name: "Anti-Cheat Behavior Analysis",
      description: "Comprehensive analysis of student behavior patterns and potential cheating incidents",
      icon: AlertTriangle,
      color: "red",
      category: "Security"
    },
    {
      id: "observability",
      name: "System Observability Logs",
      description: "Track student behaviors and system events for debugging and performance analysis",
      icon: Activity,
      color: "cyan",
      category: "System"
    }
  ]


  useEffect(() => {
    fetchReports()
  }, [selectedType, dateRange, courseScopeVersion])

  useEffect(() => {
    const q = searchQuery.trim()
    if (activeTab !== "templates" || q.length < 2) {
      setStudentSearchResults([])
      return
    }
    const t = setTimeout(async () => {
      setStudentSearchLoading(true)
      try {
        const res = await fetch(
          `/api/instructor/reports/student?q=${encodeURIComponent(q)}`,
          {
            headers: instructorReportsHeaders(),
          },
        )
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.success && Array.isArray(data.students)) {
          setStudentSearchResults(data.students)
        } else {
          setStudentSearchResults([])
        }
      } catch {
        setStudentSearchResults([])
      } finally {
        setStudentSearchLoading(false)
      }
    }, 320)
    return () => clearTimeout(t)
  }, [searchQuery, courseScopeVersion, activeTab])

  const searchNorm = searchQuery.trim().toLowerCase()
  const filteredTemplates = useMemo(() => {
    if (!searchNorm) return reportTemplates
    return reportTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(searchNorm) ||
        t.description.toLowerCase().includes(searchNorm) ||
        t.category.toLowerCase().includes(searchNorm),
    )
  }, [searchNorm, reportTemplates])

  const filteredGeneratedReports = useMemo(() => {
    const reports = reportData?.reports ?? []
    if (!searchNorm) return reports
    return reports.filter(
      (r) =>
        String(r.title ?? "").toLowerCase().includes(searchNorm) ||
        String(r.type ?? "").toLowerCase().includes(searchNorm),
    )
  }, [searchNorm, reportData?.reports])

  const getReportMetadata = (report: any): Record<string, any> => {
    const m = report?.metadata
    if (m == null) return {}
    if (typeof m === "string") {
      try {
        return JSON.parse(m) as Record<string, any>
      } catch {
        return {}
      }
    }
    return m as Record<string, any>
  }

  const loadStudentReport = async (studentId: number) => {
    try {
      setStudentReportLoading(true)
      const res = await fetch(
        `/api/instructor/reports/student?studentId=${studentId}`,
        {
          headers: instructorReportsHeaders(),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success || !data.report) {
        toast({
          title: "Could not load student",
          description:
            (data as { error?: string }).error ||
            "Try again or pick another student.",
          variant: "destructive",
        })
        return
      }
      setStudentReportPayload(data.report as StudentIndividualReportPayload)
      setShowStudentReportDialog(true)
    } catch (e) {
      toast({
        title: "Network error",
        description: e instanceof Error ? e.message : "Failed to load report.",
        variant: "destructive",
      })
    } finally {
      setStudentReportLoading(false)
    }
  }

  const saveStudentReportToGenerated = async (
    payload: StudentIndividualReportPayload,
  ) => {
    try {
      const instructorId = localStorage.getItem("instructorId") || ""
      const summaryRow = {
        studentName: payload.student.fullName,
        studentNumber: payload.student.studentNumber,
        section: payload.student.section,
        completedAttempts: payload.summary.completedAttempts,
        avgPercentage: payload.summary.avgPercentage,
        generatedAt: payload.generatedAt,
      }
      const saveResponse = await instructorApiFetch("/api/instructor/reports/save", {
        method: "POST",
        headers: instructorReportsHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          reportType: "individual-student",
          title: `Student report — ${payload.student.fullName}`,
          data: [summaryRow],
          metadata: { fullReport: payload },
          filters: {
            type: "individual-student",
            studentId: payload.student.id,
          },
        }),
      })
      if (saveResponse.ok) {
        fetchReports()
        setActiveTab("generated")
        toast({
          title: "Saved to generated reports",
          description: "You can reopen it from the Generated tab.",
        })
      } else {
        toast({
          title: "Save failed",
          description: "Could not save this report.",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Save failed",
        variant: "destructive",
      })
    }
  }

  const fetchReports = async () => {
    try {
      setLoading(true)
      
      // Fetch saved reports from database
      const response = await instructorApiFetch('/api/instructor/reports/save', {
        headers: instructorReportsHeaders(),
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.reports) {
          const normalizedReports = (data.reports as any[]).map((r) => {
            let meta = r.metadata
            let d = r.data
            if (typeof meta === "string") {
              try {
                meta = JSON.parse(meta || "{}")
              } catch {
                meta = {}
              }
            }
            if (typeof d === "string") {
              try {
                d = JSON.parse(d || "[]")
              } catch {
                d = []
              }
            }
            return { ...r, metadata: meta, data: d }
          })
          setReportData({
            reports: normalizedReports,
            generatedAt: new Date().toISOString(),
            filters: { type: selectedType },
          })
        }
      } else {
        toast({
          title: "❌ Failed to Load Reports",
          description: "Unable to fetch saved reports. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching reports:", error)
      toast({
        title: "❌ Network Error",
        description: "Unable to connect to the server. Please check your connection.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const generateCustomReport = async (reportType: string) => {
    try {
      setLoading(true)
      
      // Special handling for observability logs — open live viewer and save a snapshot for Generated tab
      if (reportType === "observability") {
        setShowObservabilityLogs(true)
        try {
          const params = new URLSearchParams({ limit: "200" })
          if (dateRange.start) params.set("startDate", dateRange.start)
          if (dateRange.end) params.set("endDate", dateRange.end)
          const res = await fetch(`/api/observability/logs?${params}`, {
            headers: instructorReportsHeaders(),
          })
          const j = await res.json()
          if (res.ok && Array.isArray(j.logs)) {
            const slim = j.logs.map((log: Record<string, unknown>) => ({
              timestamp: log.timestamp,
              module: log.module,
              sub_module: log.sub_module,
              event_type: log.event_type,
              status: log.status,
              student: log.student_name ?? "—",
              student_id: log.student_number ?? "—",
            }))
            await instructorApiFetch("/api/instructor/reports/save", {
              method: "POST",
            headers: instructorReportsHeaders({
              "Content-Type": "application/json",
            }),
              body: JSON.stringify({
                reportType: "observability",
                title: `System observability (${slim.length} events)`,
                data: slim,
                metadata: {
                  stats: j.stats,
                  pagination: j.pagination,
                  fullLogs: j.logs,
                },
                filters: {
                  startDate: dateRange.start,
                  endDate: dateRange.end,
                },
              }),
            })
            fetchReports()
            setActiveTab("generated")
            toast({
              title: "Observability snapshot saved",
              description: "Open Generated to export CSV/PDF, or use the live viewer.",
            })
          }
        } catch (e) {
          console.error(e)
          toast({
            title: "Could not save observability snapshot",
            variant: "destructive",
          })
        }
        setLoading(false)
        return
      }
      
      // Special handling for anti-cheat reports
      if (reportType === "anti-cheat-reports") {
        const params = new URLSearchParams({
          ...(dateRange.start && { startDate: dateRange.start }),
          ...(dateRange.end && { endDate: dateRange.end })
        })
        
        const response = await instructorApiFetch(`/api/instructor/anti-cheat-reports?${params}`, {
          headers: instructorReportsHeaders(),
        })
        
        if (response.ok) {
          const antiCheatData = await response.json()
          setAntiCheatReportData(antiCheatData)
          setShowAntiCheatReport(true)
          
          // Save report to database
          const saveResponse = await instructorApiFetch('/api/instructor/reports/save', {
            method: 'POST',
            headers: instructorReportsHeaders({
              "Content-Type": "application/json",
            }),
            body: JSON.stringify({
              reportType: "anti-cheat-reports",
              title: `Anti-Cheat Behavior Analysis (${antiCheatData.data?.length || 0} records)`,
              data: antiCheatData.data || [],
              // Store the full structured report so we can reopen the rich modal later
              metadata: { ...(antiCheatData.metadata || {}), fullReport: antiCheatData },
              filters: {
                type: "anti-cheat-reports",
                startDate: dateRange.start,
                endDate: dateRange.end
              }
            })
          })

          if (saveResponse.ok) {
            // Refresh reports from database
            fetchReports()
          } else {
            console.error('Failed to save report to database')
          }
          setLoading(false)
          
          // Switch to generated reports tab to show the new report
          setActiveTab("generated")
          
          toast({
            title: "✅ Anti-Cheat Report Generated",
            description: "Comprehensive security analysis report is ready for review.",
          })
        } else {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
          setLoading(false)
          toast({
            title: "❌ Generation Failed",
            description: errorData.error || "Unable to generate the anti-cheat report. Please try again.",
            variant: "destructive",
          })
        }
        return
      }
      
      // Regular report generation
      const response = await instructorApiFetch("/api/instructor/reports", {
        method: "POST",
        headers: instructorReportsHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          reportType,
          format: "json",
          filters: {
            startDate: dateRange.start,
            endDate: dateRange.end
          }
        })
      })
      
      if (response.ok) {
        const generatedData = await response.json()
        
        // Save report to database
        const reportTemplate = reportTemplates.find(t => t.id === reportType)
        const recordCount = generatedData.data?.length || 0
        
        const saveResponse = await instructorApiFetch('/api/instructor/reports/save', {
          method: 'POST',
          headers: instructorReportsHeaders({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            reportType: reportType,
            title: `${reportTemplate?.name || reportType} (${recordCount} records)`,
            data: generatedData.data || [],
            metadata: generatedData.metadata || {},
            filters: {
              type: reportType,
              startDate: dateRange.start,
              endDate: dateRange.end
            }
          })
        })

        if (saveResponse.ok) {
          // Refresh reports from database
          fetchReports()
        } else {
          console.error('Failed to save report to database')
        }
        setLoading(false)
        
        // Switch to generated reports tab to show the new report
        setActiveTab("generated")
        
        toast({
          title: "✅ Report Generated",
          description: `${reportTemplates.find(t => t.id === reportType)?.name} has been generated successfully.`,
        })
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        setLoading(false)
        toast({
          title: "❌ Generation Failed",
          description: errorData.error || "Unable to generate the report. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error generating report:", error)
      setLoading(false)
      toast({
        title: "❌ Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred while generating the report.",
        variant: "destructive",
      })
    }
  }

  const exportReport = (report: any, format: 'csv' | 'pdf' = 'csv') => {
    try {
      if (format === 'csv') {
        if (!report.data || report.data.length === 0) {
          toast({
            title: "❌ No Data to Export",
            description: "This report contains no data to export.",
            variant: "destructive",
          })
          return
        }

        const csvContent = [
          Object.keys(report.data[0] || {}).join(","),
          ...report.data.map((row: any) => Object.values(row).join(","))
        ].join("\n")
        
        const blob = new Blob([csvContent], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${report.type}-report-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
        
        toast({
          title: "✅ Export Successful",
          description: "Report has been exported to CSV file.",
        })
      } else if (format === 'pdf') {
        // Special handling for anti-cheat reports
        if (report.type === 'anti-cheat-reports') {
          // Use saved fullReport from metadata if available, otherwise reconstruct from saved data
          const fullReport = report.metadata?.fullReport || {
            data: report.data || [],
            summary_stats: report.metadata?.summary_stats || {},
            violation_breakdown: report.metadata?.violation_breakdown || [],
            top_violators: report.metadata?.top_violators || [],
            assessment_stats: report.metadata?.assessment_stats || [],
            time_trends: report.metadata?.time_trends || [],
            metadata: report.metadata || {}
          }
          
          const success = exportReportToPDF({
            reportData: fullReport,
            reportType: report.type,
            reportTitle: report.title,
            onExport: () => {
              toast({
                title: "✅ PDF Exported",
                description: `${report.title} has been exported as PDF successfully.`,
              })
            }
          })
          
          if (!success) {
            toast({
              title: "❌ PDF Export Failed",
              description: "An error occurred while generating the PDF report.",
              variant: "destructive",
            })
          }
        } else if (report.type === "individual-student") {
          const meta = getReportMetadata(report)
          const payload = meta.fullReport as
            | StudentIndividualReportPayload
            | undefined
          if (!payload) {
            toast({
              title: "PDF unavailable",
              description: "This saved report has no full payload. Regenerate from Templates.",
              variant: "destructive",
            })
            return
          }
          const success = exportStudentIndividualReportPdf(payload, () => {
            toast({
              title: "PDF exported",
              description: `${payload.student.fullName} — student report downloaded.`,
            })
          })
          if (!success) {
            toast({
              title: "PDF export failed",
              variant: "destructive",
            })
          }
        } else {
          const success = exportReportToPDF({
            reportData: report,
            reportType: report.type,
            reportTitle: report.title,
            onExport: () => {
              toast({
                title: "✅ PDF Exported",
                description: `${report.title} has been exported as PDF successfully.`,
              })
            }
          })
          
          if (!success) {
            toast({
              title: "❌ PDF Export Failed",
              description: "An error occurred while generating the PDF report.",
              variant: "destructive",
            })
          }
        }
      }
    } catch (error) {
      toast({
        title: "❌ Export Failed",
        description: "Unable to export the report. Please try again.",
        variant: "destructive",
      })
    }
  }

  const viewReportDetails = async (report: any) => {
    if (report?.type === "individual-student") {
      const meta = getReportMetadata(report)
      if (meta.fullReport) {
        setStudentReportPayload(meta.fullReport as StudentIndividualReportPayload)
        setShowStudentReportDialog(true)
        return
      }
      toast({
        title: "Report data missing",
        description:
          "Open a new student report from Templates, or delete this entry.",
        variant: "destructive",
      })
      return
    }
    if (report?.type === 'anti-cheat-reports') {
      // Prefer the rich analysis modal; use saved fullReport if available, otherwise refetch using filters
      const saved = report?.metadata?.fullReport
      if (saved) {
        setAntiCheatReportData(saved)
        setShowAntiCheatReport(true)
        return
      }
      try {
        const params = new URLSearchParams({
          ...(report?.filters?.startDate && { startDate: report.filters.startDate }),
          ...(report?.filters?.endDate && { endDate: report.filters.endDate }),
          ...(report?.filters?.assessmentType && { assessmentType: report.filters.assessmentType }),
          ...(report?.filters?.severity && { severity: report.filters.severity })
        })
        const response = await instructorApiFetch(`/api/instructor/anti-cheat-reports?${params}`, {
          headers: instructorReportsHeaders(),
        })
        const data = await response.json()
        if (response.ok) {
          setAntiCheatReportData(data)
          setShowAntiCheatReport(true)
          return
        }
      } catch {}
    }
    setSelectedReport(report)
    setShowReportModal(true)
  }

  const deleteReport = async (report: any) => {
    try {
      // Soft delete - move to deleted reports
      const deletedReport = {
        ...report,
        deletedAt: new Date().toISOString(),
        deletedBy: 'instructor'
      }
      
      setDeletedReports(prev => [...prev, deletedReport])
      
      // Delete from database
      const deleteResponse = await instructorApiFetch(`/api/instructor/reports/save?id=${report.id}`, {
        method: 'DELETE',
        headers: instructorReportsHeaders(),
      })

      if (deleteResponse.ok) {
        // Refresh reports from database
        fetchReports()
      } else {
        console.error('Failed to delete report from database')
      }
      
      toast({
        title: "🗑️ Report Deleted",
        description: `${report.title} has been moved to deleted items.`,
      })
    } catch (error) {
      toast({
        title: "❌ Delete Failed",
        description: "Unable to delete the report. Please try again.",
        variant: "destructive",
      })
    }
  }

  const recoverReport = async (report: any) => {
    try {
      // Remove from deleted reports
      setDeletedReports(prev => prev.filter(r => r.type !== report.type))
      
      // Add back to active reports
      if (reportData) {
        const recoveredReport = { ...report }
        delete recoveredReport.deletedAt
        delete recoveredReport.deletedBy
        
        setReportData({ 
          ...reportData, 
          reports: [...(reportData.reports || []), recoveredReport] 
        })
      }
      
      toast({
        title: "✅ Report Recovered",
        description: `${report.title} has been restored successfully.`,
      })
    } catch (error) {
      toast({
        title: "❌ Recovery Failed",
        description: "Unable to recover the report. Please try again.",
        variant: "destructive",
      })
    }
  }

  const permanentlyDeleteReport = async (report: any) => {
    try {
      // Remove from deleted reports permanently
      setDeletedReports(prev => prev.filter(r => r.type !== report.type))
      
      toast({
        title: "🗑️ Report Permanently Deleted",
        description: `${report.title} has been permanently removed.`,
        variant: "destructive",
      })
    } catch (error) {
      toast({
        title: "❌ Deletion Failed",
        description: "Unable to permanently delete the report. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      blue: "from-blue-600 to-blue-700 shadow-blue-500/25",
      green: "from-green-600 to-green-700 shadow-green-500/25",
      purple: "from-purple-600 to-purple-700 shadow-purple-500/25",
      orange: "from-orange-600 to-orange-700 shadow-orange-500/25",
      emerald: "from-emerald-600 to-emerald-700 shadow-emerald-500/25",
      pink: "from-pink-600 to-pink-700 shadow-pink-500/25",
      red: "from-red-600 to-red-700 shadow-red-500/25",
      indigo: "from-indigo-600 to-indigo-700 shadow-indigo-500/25",
      cyan: "from-cyan-600 to-cyan-700 shadow-cyan-500/25",
    }
    return colors[color] || colors.blue
  }

  // Helpers for preview formatting
  const renderPreviewValue = (key: string, value: any) => {
    if (key === 'violation_log' || key === 'detailed_violations') {
      const violations: any[] = Array.isArray(value)
        ? value
        : typeof value === 'string' && value.trim().startsWith('[')
          ? (() => { try { return JSON.parse(value) } catch { return [] } })()
          : []
      if (violations.length === 0) return 'None'
      const typeToCount: Record<string, number> = {}
      violations.forEach((v: any) => {
        const t = (v?.type || 'unknown').toString()
        typeToCount[t] = (typeToCount[t] || 0) + 1
      })
      const parts = Object.entries(typeToCount)
        .slice(0, 3)
        .map(([t, c]) => `${t.replace(/_/g, ' ')} (${c})`)
      return parts.join(' • ')
    }
    if (typeof value === 'number') return value.toLocaleString()
    if (value === null || value === undefined) return 'N/A'
    if (typeof value === 'object') return JSON.stringify(value).slice(0, 180)
    return String(value)
  }

  const getAntiCheatKPIs = (report: any) => {
    const summary = report?.metadata?.summary || {}
    const data = Array.isArray(report?.data) ? report.data : []
    const totals = {
      total: summary.total_attempts ?? data.length ?? 0,
      withViolations: summary.attempts_with_violations ?? data.filter((d: any) => d?.risk_level && d.risk_level !== 'NONE').length,
      high: data.filter((d: any) => d?.risk_level === 'HIGH').length,
      medium: data.filter((d: any) => d?.risk_level === 'MEDIUM').length,
      low: data.filter((d: any) => d?.risk_level === 'LOW').length,
      rate: summary.violation_rate ?? ((data.length ? (data.filter((d: any) => d?.risk_level && d.risk_level !== 'NONE').length / data.length) * 100 : 0).toFixed(1) + '%')
    }
    return totals
  }

  return (
    <>
      {/* Observability Logs Modal */}
      {showObservabilityLogs && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg">
                    <Activity className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">System Observability Logs</h2>
                    <p className="text-slate-600">
                      Track student behaviors and system events for debugging
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={() => setShowObservabilityLogs(false)}
                  variant="outline" 
                  size="sm"
                  className="bg-white border-slate-200 shadow-sm hover:bg-slate-50"
                >
                  Close
                </Button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[calc(95vh-120px)] p-6">
              <ObservabilityLogsViewer 
                onClose={() => setShowObservabilityLogs(false)}
                showHeader={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Anti-Cheat Report Modal - Always available */}
      {showAntiCheatReport && antiCheatReportData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-red-600 shadow-lg">
                    <AlertTriangle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Anti-Cheat Behavior Analysis</h2>
                    <p className="text-slate-600">
                      Comprehensive security report • {antiCheatReportData.metadata?.filters?.totalRecords || 0} records analyzed
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      if (!antiCheatReportData) return
                      exportReportToPDF({
                        reportData: antiCheatReportData,
                        reportType: 'anti-cheat-reports',
                        reportTitle: 'Anti-Cheat Behavior Analysis',
                      })
                    }}
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white shadow-sm"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export PDF
                  </Button>
                  <Button 
                    onClick={() => setShowAntiCheatReport(false)}
                    variant="outline" 
                    size="sm"
                    className="bg-white border-slate-200 shadow-sm hover:bg-slate-50"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[calc(95vh-120px)]">
              <AntiCheatReportViewer 
                reportData={antiCheatReportData} 
                onClose={() => setShowAntiCheatReport(false)}
                showHeader={false}
              />
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className={cn("w-10 h-10 rounded-full animate-spin mx-auto", AN_SPINNER)} />
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-[var(--cc-text)]">Loading reports</h3>
              <p className={PORTAL_TEXT_MUTED}>Fetching report data…</p>
            </div>
          </div>
        </div>
      ) : (
    <div className="space-y-4 sm:space-y-6">
      <FacultyIntegratedToolbar
        moduleId="reports"
        search={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchClear={() => {
          setSearchQuery("")
          setStudentSearchResults([])
        }}
        searchPlaceholder={
          activeTab === "templates"
            ? "Search templates or find a student by name, email, or ID…"
            : "Search generated reports…"
        }
        filters={
          <>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className={cn(facultyToolbarFilterButtonClass(selectedType !== "all"), "h-9 w-[132px] shadow-none")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reports</SelectItem>
                <SelectItem value="quiz">Quiz</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="session">Session</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={facultyToolbarFilterButtonClass(showFilters)}
            >
              <Filter className="h-3.5 w-3.5 opacity-70" />
              <span className="hidden sm:inline">Filters</span>
            </Button>
          </>
        }
        meta={
          <p className={AN_META}>
            {activeTab === "templates"
              ? `Report templates · ${filteredTemplates.length} shown`
              : `Generated reports · ${filteredGeneratedReports.length} shown`}
            {selectedType !== "all" ? ` · ${selectedType}` : ""}
            {activeTab === "templates" && searchNorm.length > 0 && searchNorm.length < 2
              ? " · type 2+ characters to find a student"
              : ""}
          </p>
        }
        trailing={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={fetchReports} className={facultyToolbarFilterButtonClass()}>
              <RefreshCw className="h-3.5 w-3.5 opacity-70" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            {!embedInDashboard && !embedInHub ? (
              <Button variant="ghost" size="sm" className={facultyToolbarFilterButtonClass()} onClick={() => { window.location.href = "/instructor/dashboard" }}>
                <ArrowLeft className="h-3.5 w-3.5 opacity-70" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            ) : null}
          </>
        }
      />

      {activeTab === "templates" && (studentSearchLoading || studentSearchResults.length > 0) ? (
        <div className={cn(AN_PANEL, "p-3 relative z-20")}>
          {studentSearchLoading ? (
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Searching students…</p>
          ) : null}
          {studentSearchResults.length > 0 ? (
            <ul className="divide-y rounded-lg border border-[var(--sidebar-border)] max-h-52 overflow-y-auto">
              {studentSearchResults.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={studentReportLoading}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--sidebar-accent)]/50 disabled:opacity-50"
                    onClick={() => {
                      void loadStudentReport(s.id)
                      setSearchQuery("")
                      setStudentSearchResults([])
                    }}
                  >
                    <span>
                      <span className="font-medium text-[var(--cc-text)]">{s.fullName}</span>
                      <span className={cn("mt-0.5 block text-xs", PORTAL_TEXT_MUTED)}>
                        {s.email}
                        {s.section ? ` · ${s.section}` : ""}
                        {s.studentNumber != null && s.studentNumber !== "" ? ` · ID ${s.studentNumber}` : ""}
                      </span>
                    </span>
                    <span className={cn("text-xs shrink-0", PORTAL_TEXT_MUTED)}>Open report</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {!embedInDashboard && !embedInHub && (
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Reports & Analytics</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">Generate reports and export data</p>
          </div>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className={cn(AN_PANEL, "overflow-hidden")}
        >
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button
                onClick={() => setDateRange({ start: "", end: "" })}
                variant="outline"
                size="sm"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "templates" | "generated")}>
        {!embedInHub ? (
          <div className={cn(AN_PANEL, "p-2 mb-4")}>
            <TabsList className="grid w-full grid-cols-2 bg-transparent h-10 sm:h-11">
              <TabsTrigger value="templates" className={cn("rounded-lg font-medium text-sm", fp.tabActive)}>
                <Plus className="h-4 w-4 mr-2" />
                Templates
              </TabsTrigger>
              <TabsTrigger value="generated" className={cn("rounded-lg font-medium text-sm", fp.tabActive)}>
                <FileText className="h-4 w-4 mr-2" />
                Generated
              </TabsTrigger>
            </TabsList>
          </div>
        ) : null}

        <TabsContent value="templates" className="space-y-4 sm:space-y-6">
          <Card className={embedInDashboard ? "border border-slate-200/60 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.02] rounded-xl shadow-sm" : "border-0 shadow-lg bg-gradient-to-r from-white to-slate-50"}>
            <CardHeader className="pb-4">
              <CardTitle className={`flex items-center gap-2 text-slate-800 dark:text-slate-200 ${embedInDashboard ? "text-base" : ""}`}>
                <div className={cn("p-2 rounded-lg shrink-0", embedInDashboard ? fp.iconBg : "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg")}>
                  <Zap className={cn("h-5 w-5", embedInDashboard ? fp.iconText : "text-white")} />
                </div>
                Report templates
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Click a template to generate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map((template, index) => (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card 
                      className={cn("group cursor-pointer transition-all duration-200", embedInDashboard ? cn("border border-slate-200/60 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.02] hover:bg-[var(--cc-accent-soft)] hover:border-[var(--cc-accent-border)]") : "border-0 bg-white hover:shadow-xl hover:-translate-y-1")}
                      onClick={() => generateCustomReport(template.id)}
                    >
                      <CardContent className="p-4 sm:p-5">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className={cn("p-2.5 rounded-xl shrink-0", embedInDashboard ? fp.iconBg : `bg-gradient-to-br ${getColorClasses(template.color)} shadow-lg`)}>
                              <template.icon className={cn("h-5 w-5", embedInDashboard ? fp.iconText : "text-white")} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-slate-800 dark:text-slate-200 truncate">{template.name}</h3>
                              <Badge variant="outline" className="text-xs mt-0.5">{template.category}</Badge>
                            </div>
                          </div>
                          <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-2">
                            {template.description}
                          </p>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-xs text-slate-500 dark:text-slate-400">Generate</span>
                            <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-[var(--cc-accent-dark)] transition-colors" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="generated" className="space-y-6">
          {filteredGeneratedReports.length > 0 ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                    Generated ({filteredGeneratedReports.length})
                  </h3>
                  {deletedReports.length > 0 && (
                    <Button
                      onClick={() => setShowDeletedModal(true)}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Deleted ({deletedReports.length})
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant={viewMode === 'card' ? (embedInDashboard ? 'secondary' : 'default') : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('card')}
                    className={cn("h-8 gap-1.5 text-xs", embedInDashboard && viewMode === "card" && fp.tabActive)}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    Cards
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? (embedInDashboard ? 'secondary' : 'default') : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className={cn("h-8 gap-1.5 text-xs", embedInDashboard && viewMode === "list" && fp.tabActive)}
                  >
                    <List className="w-3.5 h-3.5" />
                    List
                  </Button>
                </div>
              </div>

              {/* Reports Display */}
              <div className={viewMode === 'card' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
                {(filteredGeneratedReports).map((report, index) => (
                  <motion.div
                    key={report.id ?? `${report.type}-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <Card className={viewMode === 'card' ? (embedInDashboard ? "border border-slate-200/60 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.02] rounded-xl" : "border-0 shadow-lg bg-gradient-to-r from-white to-slate-50") : (embedInDashboard ? "border border-slate-200/60 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.02]" : "border-0 shadow bg-white")}>
                      <CardHeader className="pb-6">
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center gap-3">
                            <div className={cn("p-2.5 rounded-xl shrink-0", embedInDashboard ? fp.iconBg : "bg-gradient-to-br from-red-500 to-red-600 shadow-lg")}>
                              <BarChart3 className={cn("h-5 w-5", embedInDashboard ? fp.iconText : "text-white")} />
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-xl font-bold text-slate-800">
                                {report.title}
                              </CardTitle>
                              <CardDescription className="text-slate-600">
                                {report.data?.length || 0} records • Generated {new Date(reportData?.generatedAt || Date.now()).toLocaleDateString('en-US', { timeZone: 'America/Chicago' })}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button 
                              onClick={() => exportReport(report, 'csv')} 
                              variant="outline" 
                              size="sm"
                              className="bg-white border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 flex-shrink-0"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Export CSV
                            </Button>
                            <Button 
                              onClick={() => exportReport(report, 'pdf')} 
                              variant="outline" 
                              size="sm"
                              className="bg-red-50 border-red-200 shadow-sm hover:bg-red-100 hover:border-red-300 transition-all duration-200 text-red-600 hover:text-red-700 flex-shrink-0"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Export PDF
                            </Button>
                            <Button 
                              onClick={() => viewReportDetails(report)}
                              variant="outline" 
                              size="sm"
                              className="bg-blue-50 border-blue-200 text-blue-700 shadow-sm hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 flex-shrink-0"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </Button>
                            <Button 
                              onClick={() => deleteReport(report)}
                              variant="outline" 
                              size="sm"
                              className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300 transition-all duration-200 flex-shrink-0"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* Anti-cheat preview KPIs */}
                        {report.type === 'anti-cheat-reports' && (
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                            {(() => { const k = getAntiCheatKPIs(report); return (
                              <>
                                <div className="text-center"><div className="text-lg font-bold">{k.total}</div><div className="text-xs text-slate-500">Total</div></div>
                                <div className="text-center"><div className="text-lg font-bold text-red-600">{k.withViolations}</div><div className="text-xs text-slate-500">With Violations</div></div>
                                <div className="text-center"><div className="text-lg font-bold text-orange-600">{k.high}</div><div className="text-xs text-slate-500">High</div></div>
                                <div className="text-center"><div className="text-lg font-bold text-yellow-600">{k.medium}</div><div className="text-xs text-slate-500">Medium</div></div>
                                <div className="text-center"><div className="text-lg font-bold text-blue-600">{k.low}</div><div className="text-xs text-slate-500">Low</div></div>
                              </>
                            ) })()}
                          </div>
                        )}

                        <div className="space-y-4">
                          {(report.data || []).slice(0, 2).map((item: any, itemIndex: number) => (
                            <div key={itemIndex} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {Object.entries(item).filter(([key]) => key !== 'violation_log' && key !== 'detailed_violations').slice(0, 6).map(([key, value]: [string, any]) => (
                                  <div key={key} className="space-y-1">
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                                      {key.replace(/([A-Z])/g, ' $1').trim()}
                                    </span>
                                    <p className="text-sm font-semibold text-slate-800">
                                      {renderPreviewValue(key, value)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                          {(report.data?.length || 0) > 2 && (
                            <div className="text-center py-2">
                              <span className="text-sm text-slate-500">
                                ... and {(report.data?.length || 0) - 2} more records
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (reportData?.reports?.length ?? 0) > 0 && searchNorm ? (
            <Card className={AN_PANEL}>
              <CardContent className="py-10 text-center">
                <p className={PORTAL_TEXT_MUTED}>No generated reports match your search.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className={embedInDashboard ? "border border-slate-200/60 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.02] rounded-xl" : "border-0 shadow-lg bg-gradient-to-r from-white to-slate-50"}>
              <CardContent className="py-10 sm:py-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className={cn("p-4 rounded-full", embedInDashboard ? fp.iconBg : "bg-blue-100")}>
                    <FileText className={cn("h-10 w-10 sm:h-12 sm:w-12", embedInDashboard ? fp.iconText : "text-blue-600")} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">No reports yet</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Generate reports from the templates above</p>
                  </div>
                  <Button
                    onClick={() => setActiveTab("templates")}
                    className={embedInDashboard ? fp.cta : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg"}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Generate report
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={showStudentReportDialog}
        onOpenChange={(open) => {
          setShowStudentReportDialog(open)
          if (!open) setStudentReportPayload(null)
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-slate-900 dark:text-slate-100">
              {studentReportPayload ? (
                <>
                  <UserRound className="h-5 w-5 text-violet-600" />
                  {studentReportPayload.student.fullName}
                </>
              ) : (
                "Student report"
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              {studentReportPayload
                ? `${studentReportPayload.student.email || "No email"} · ${studentReportPayload.summary.completedAttempts} completed attempts · avg ${studentReportPayload.summary.avgPercentage}% (across attempts)`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {studentReportPayload ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-violet-600 text-white hover:bg-violet-700"
                  onClick={() => {
                    const ok = exportStudentIndividualReportPdf(
                      studentReportPayload,
                      () => {
                        toast({
                          title: "PDF downloaded",
                          description: `${studentReportPayload.student.fullName} — student report`,
                        })
                      },
                    )
                    if (!ok) {
                      toast({
                        title: "PDF failed",
                        variant: "destructive",
                      })
                    }
                  }}
                >
                  Download PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => saveStudentReportToGenerated(studentReportPayload)}
                >
                  Save to generated
                </Button>
              </div>

              {studentReportPayload.gradebook ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Gradebook snapshot
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                    {(
                      [
                        ["Quiz", studentReportPayload.gradebook.quiz_score],
                        ["Homework", studentReportPayload.gradebook.homework_score],
                        ["Midterm", studentReportPayload.gradebook.midterm_score],
                        ["Final", studentReportPayload.gradebook.final_score],
                        ["Attendance", studentReportPayload.gradebook.attendance_score],
                        ["Total", studentReportPayload.gradebook.total_score],
                        ["Letter", studentReportPayload.gradebook.letter_grade],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <span className="text-slate-500">{k}</span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {v != null ? String(v) : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Assessment history
                </h4>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-slate-100 text-xs uppercase text-slate-600 dark:bg-white/5 dark:text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Assessment</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Completed</th>
                        <th className="px-3 py-2">Score</th>
                        <th className="px-3 py-2">%</th>
                        <th className="px-3 py-2">Tab / paste</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentReportPayload.attempts.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-6 text-center text-slate-500"
                          >
                            No completed attempts.
                          </td>
                        </tr>
                      ) : (
                        studentReportPayload.attempts.map((a) => (
                          <tr
                            key={a.attemptId}
                            className="border-t border-slate-100 dark:border-white/5"
                          >
                            <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                              {a.quizTitle}
                            </td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                              {a.assessmentType}
                            </td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                              {a.completedAt
                                ? new Date(a.completedAt).toLocaleString()
                                : "—"}
                            </td>
                            <td className="px-3 py-2">
                              {Number(a.displayScore).toFixed(1)} /{" "}
                              {Number(a.displayTotal).toFixed(1)}
                            </td>
                            <td className="px-3 py-2 font-medium">
                              {Number(a.percentage).toFixed(1)}%
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-500">
                              {a.tabSwitches} / {a.copyPasteAttempts}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Report Details Modal */}
      {showReportModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">{selectedReport.title}</h2>
                    <p className="text-slate-600">
                      {selectedReport.data?.length || 0} records • Generated {new Date(selectedReport.generatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button 
                    onClick={() => exportReport(selectedReport, 'csv')} 
                    variant="outline" 
                    size="sm"
                    className="bg-white border-slate-200 shadow-sm hover:bg-slate-50"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button 
                    onClick={() => exportReport(selectedReport, 'pdf')} 
                    variant="outline" 
                    size="sm"
                    className="bg-white border-red-200 shadow-sm hover:bg-red-50 text-red-600 hover:text-red-700"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export PDF
                  </Button>
                  <Button 
                    onClick={() => setShowReportModal(false)}
                    variant="outline" 
                    size="sm"
                    className="bg-white border-slate-200 shadow-sm hover:bg-slate-50"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {(selectedReport.data?.length || 0) === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">No Data Available</h3>
                  <p className="text-slate-600">This report contains no data to display.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(selectedReport.data || []).map((item: any, index: number) => (
                    <div key={index} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {Object.entries(item).map(([key, value]: [string, any]) => (
                          <div key={key} className="space-y-1">
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                            <p className="text-sm font-semibold text-slate-800">
                              {typeof value === 'number' ? value.toLocaleString() : 
                               value === null || value === undefined ? 'N/A' : 
                               String(value)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Deleted Reports Modal */}
      {showDeletedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-red-600 shadow-lg">
                    <Trash2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Deleted Reports</h2>
                    <p className="text-slate-600">
                      {deletedReports.length} reports in trash • Restore or permanently delete
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={() => setShowDeletedModal(false)}
                  variant="outline" 
                  size="sm"
                  className="bg-white border-slate-200 shadow-sm hover:bg-slate-50"
                >
                  Close
                </Button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {deletedReports.length === 0 ? (
                <div className="text-center py-12">
                  <Trash2 className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">No Deleted Reports</h3>
                  <p className="text-slate-600">All reports are safe and accounted for!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {deletedReports.map((report, index) => (
                    <div key={`${report.id ?? report.type}-${index}`} className="p-4 bg-red-50 rounded-xl border border-red-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-red-900">{report.title}</h3>
                            <Badge variant="destructive" className="text-xs">
                              Deleted
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-red-600">
                            <div className="flex items-center gap-1">
                              <FileText className="h-4 w-4" />
                              {report.data?.length || 0} records
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              Deleted {new Date(report.deletedAt).toLocaleDateString()}
                            </div>
                            {report.deletedBy && (
                              <div className="text-xs text-red-500">
                                by {report.deletedBy}
                              </div>
                            )}
                          </div>
                          {/* 24-Hour Countdown */}
                          {(() => {
                            const deletedTime = new Date(report.deletedAt).getTime()
                            const currentTime = Date.now()
                            const hoursElapsed = Math.floor((currentTime - deletedTime) / (1000 * 60 * 60))
                            const hoursRemaining = 24 - hoursElapsed
                            const minutesRemaining = Math.floor(((24 * 60 * 60 * 1000) - (currentTime - deletedTime)) / (1000 * 60)) % 60
                            
                            if (hoursRemaining <= 0) {
                              return (
                                <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded-lg flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-red-700 flex-shrink-0" />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-red-900">
                                      ⚠️ This report will be permanently deleted soon
                                    </p>
                                    <p className="text-xs text-red-700">
                                      The 24-hour grace period has expired. Restore now to prevent permanent deletion.
                                    </p>
                                  </div>
                                </div>
                              )
                            } else if (hoursRemaining <= 3) {
                              return (
                                <div className="mt-3 p-3 bg-orange-100 border border-orange-300 rounded-lg flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-orange-700 flex-shrink-0" />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-orange-900">
                                      ⏰ {hoursRemaining}h {minutesRemaining}m remaining
                                    </p>
                                    <p className="text-xs text-orange-700">
                                      Will be permanently deleted after 24 hours
                                    </p>
                                  </div>
                                </div>
                              )
                            } else {
                              return (
                                <div className="mt-3 p-2 bg-blue-100 border border-blue-300 rounded-lg flex items-center gap-2">
                                  <Clock className="h-3 w-3 text-blue-700 flex-shrink-0" />
                                  <p className="text-xs text-blue-700">
                                    {hoursRemaining}h {minutesRemaining}m until permanent deletion
                                  </p>
                                </div>
                              )
                            }
                          })()}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            onClick={() => recoverReport(report)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            size="sm"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Restore
                          </Button>
                          <Button
                            onClick={() => permanentlyDeleteReport(report)}
                            variant="destructive"
                            size="sm"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete Forever
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
      )}
    </>
  )
}

export default function InstructorReportsPage() {
  return <InstructorReportsContent />
}