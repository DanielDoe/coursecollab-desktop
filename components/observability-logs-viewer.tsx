"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { 
  Activity, 
  Download, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp,
  Filter,
  Search,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Info,
  Clock,
  User,
  Code,
  FileText,
  Power
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { motion, AnimatePresence } from "framer-motion"
import { isObservabilityEnabled, setObservabilityEnabled } from "@/lib/observability"

interface Log {
  id: number
  user_id: number | null
  module: string
  sub_module: string | null
  event_type: string
  event_data: any
  status: string
  timestamp: string
  session_id: string | null
  student_name: string | null
  student_number: string | null
  student_email: string | null
}

interface ObservabilityLogsViewerProps {
  onClose?: () => void
  showHeader?: boolean
}

export function ObservabilityLogsViewer({ onClose, showHeader = true }: ObservabilityLogsViewerProps) {
  const { toast } = useToast()
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedLog, setExpandedLog] = useState<number | null>(null)
  const [observabilityToggle, setObservabilityToggle] = useState(isObservabilityEnabled())
  
  // Filters
  const [moduleFilter, setModuleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [eventTypeFilter, setEventTypeFilter] = useState("")
  const [studentFilter, setStudentFilter] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  
  // Pagination
  const [page, setPage] = useState(1)
  const [totalLogs, setTotalLogs] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const logsPerPage = 50
  
  // Handle observability toggle
  const handleToggleObservability = (enabled: boolean) => {
    setObservabilityToggle(enabled)
    setObservabilityEnabled(enabled)
    toast({
      title: enabled ? "Observability Enabled" : "Observability Disabled",
      description: enabled 
        ? "System will now log student events and behaviors" 
        : "System will stop logging new events. Existing logs are preserved.",
    })
  }

  useEffect(() => {
    fetchLogs()
  }, [moduleFilter, statusFilter, startDate, endDate, page])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        limit: logsPerPage.toString(),
        offset: ((page - 1) * logsPerPage).toString(),
        ...(moduleFilter !== "all" && { module: moduleFilter }),
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(eventTypeFilter && { eventType: eventTypeFilter }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      })

      const response = await fetch(`/api/observability/logs?${params}`, {
        headers: {
          'Authorization': localStorage.getItem("instructorSession") || "",
          'x-instructor-id': localStorage.getItem("instructorId") || ""
        }
      })

      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
        setTotalLogs(data.pagination?.total || 0)
        setHasMore(data.pagination?.hasMore || false)
      } else {
        toast({
          title: "❌ Failed to Load Logs",
          description: "Unable to fetch observability logs",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error fetching logs:", error)
      toast({
        title: "❌ Error",
        description: "An error occurred while fetching logs",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const exportLogs = async () => {
    try {
      const filters = {
        module: moduleFilter !== "all" ? moduleFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        eventType: eventTypeFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      }

      const response = await fetch('/api/observability/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem("instructorSession") || "",
          'x-instructor-id': localStorage.getItem("instructorId") || ""
        },
        body: JSON.stringify({ filters })
      })

      if (response.ok) {
        const data = await response.json()
        const logs = data.logs || []
        
        // Convert to CSV
        const headers = ["ID", "Timestamp", "Student", "Module", "Sub Module", "Event Type", "Status", "Session ID"]
        const rows = logs.map((log: Log) => [
          log.id,
          new Date(log.timestamp).toLocaleString('en-US', { timeZone: 'America/Chicago' }),
          log.student_name || "N/A",
          log.module,
          log.sub_module || "N/A",
          log.event_type,
          log.status,
          log.session_id || "N/A"
        ])

        const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n")
        const blob = new Blob([csvContent], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `observability-logs-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)

        toast({
          title: "✅ Export Successful",
          description: `Exported ${logs.length} log entries to CSV`
        })
      }
    } catch (error) {
      toast({
        title: "❌ Export Failed",
        description: "Unable to export logs",
        variant: "destructive"
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      default:
        return <Info className="h-4 w-4 text-blue-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      success: "bg-green-100 text-green-800 border-green-200",
      error: "bg-red-100 text-red-800 border-red-200",
      warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
      info: "bg-blue-100 text-blue-800 border-blue-200"
    }
    return colors[status as keyof typeof colors] || colors.info
  }

  const filteredLogs = logs.filter(log => {
    if (studentFilter && log.student_name && !log.student_name.toLowerCase().includes(studentFilter.toLowerCase())) {
      return false
    }
    if (eventTypeFilter && !log.event_type.toLowerCase().includes(eventTypeFilter.toLowerCase())) {
      return false
    }
    return true
  })

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">System Observability Logs</h2>
              <p className="text-slate-600">Track student behaviors and system events for debugging</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={exportLogs} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={fetchLogs} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
          
          {/* Observability Toggle */}
          <Card className={observabilityToggle ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${observabilityToggle ? "bg-green-100" : "bg-red-100"}`}>
                    <Power className={`h-5 w-5 ${observabilityToggle ? "text-green-600" : "text-red-600"}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">Observability System</h3>
                      <Badge variant={observabilityToggle ? "default" : "destructive"} className="text-xs">
                        {observabilityToggle ? "ACTIVE" : "DISABLED"}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600">
                      {observabilityToggle 
                        ? "Currently logging all student events and system behaviors" 
                        : "Logging is paused. No new events will be recorded."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="observability-toggle" className="text-sm font-medium">
                    {observabilityToggle ? "Disable" : "Enable"}
                  </Label>
                  <Switch
                    id="observability-toggle"
                    checked={observabilityToggle}
                    onCheckedChange={handleToggleObservability}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Module</Label>
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="assignment">Assignment</SelectItem>
                  <SelectItem value="playground">Playground</SelectItem>
                  <SelectItem value="lecture">Lecture</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Event Type</Label>
              <Input
                placeholder="Search event type..."
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Student Name</Label>
              <Input
                placeholder="Search student..."
                value={studentFilter}
                onChange={(e) => setStudentFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex justify-end mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setModuleFilter("all")
                setStatusFilter("all")
                setEventTypeFilter("")
                setStudentFilter("")
                setStartDate("")
                setEndDate("")
                setPage(1)
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Logs ({filteredLogs.length} of {totalLogs} total)
          </CardTitle>
          <CardDescription>
            Showing page {page} • {logsPerPage} logs per page
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-slate-600">Loading logs...</p>
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No Logs Found</h3>
              <p className="text-slate-600">Try adjusting your filters or check back later</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border rounded-lg overflow-hidden"
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          {getStatusIcon(log.status)}
                          <Badge className={getStatusBadge(log.status)}>
                            {log.status}
                          </Badge>
                          <Badge variant="outline">{log.module}</Badge>
                          {log.sub_module && (
                            <Badge variant="outline" className="text-xs">
                              {log.sub_module}
                            </Badge>
                          )}
                          <span className="font-semibold text-slate-900">{log.event_type}</span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          {log.student_name && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {log.student_name} ({log.student_number})
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(log.timestamp).toLocaleString('en-US', { timeZone: 'America/Chicago' })}
                          </div>
                        </div>
                      </div>
                      
                      <Button variant="ghost" size="sm">
                        {expandedLog === log.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {expandedLog === log.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t bg-slate-50"
                      >
                        <div className="p-4 space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-slate-700">Log ID:</span>
                              <span className="ml-2 text-slate-600">{log.id}</span>
                            </div>
                            <div>
                              <span className="font-medium text-slate-700">Session ID:</span>
                              <span className="ml-2 text-slate-600 font-mono text-xs">
                                {log.session_id || "N/A"}
                              </span>
                            </div>
                            {log.student_email && (
                              <div className="col-span-2">
                                <span className="font-medium text-slate-700">Student Email:</span>
                                <span className="ml-2 text-slate-600">{log.student_email}</span>
                              </div>
                            )}
                          </div>
                          
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Code className="h-4 w-4 text-slate-700" />
                              <span className="font-medium text-slate-700">Event Data:</span>
                            </div>
                            <pre className="bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
                              {JSON.stringify(log.event_data, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
          
          {/* Pagination */}
          {!loading && filteredLogs.length > 0 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-slate-600">
                Page {page} of {Math.ceil(totalLogs / logsPerPage)}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(p => p + 1)}
                disabled={!hasMore}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

