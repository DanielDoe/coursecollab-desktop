"use client"

import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Activity,
  Database,
  Server,
  Cpu,
  HardDrive,
  Wifi,
  RefreshCw,
  TrendingUp,
  Users,
  BookOpen,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface SystemHealth {
  status: string
  healthScore: number
  database: {
    status: string
    latency: number
    responseTime: string
  }
  system: {
    uptime: number
    memoryUsage: {
      rss: number
      heapTotal: number
      heapUsed: number
      external: number
    }
    cpuUsage: {
      user: number
      system: number
    }
  }
  metrics: {
    totalStudents: number
    totalQuizzes: number
    totalAttempts: number
    activeSessions: number
  }
  timestamp: string
}

interface SystemMonitorContentProps {
  embedInDashboard?: boolean
}

export function SystemMonitorContent({ embedInDashboard = false }: SystemMonitorContentProps) {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false)

  useEffect(() => {
    fetchSystemHealth()
  }, [])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (autoRefresh) {
      interval = setInterval(fetchSystemHealth, 30000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  const fetchSystemHealth = async () => {
    try {
      setLoading(true)
      const response = await instructorApiFetch("/api/instructor/system-monitor")
      if (response.ok) {
        const data = await response.json()
        setSystemHealth(data)
      }
    } catch (error) {
      console.error("Error fetching system health:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}d ${hours}h ${minutes}m`
  }

  const formatBytes = (bytes: number) => {
    const sizes = ["Bytes", "KB", "MB", "GB"]
    if (bytes === 0) return "0 Bytes"
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
  }

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400"
    if (score >= 60) return "text-amber-600 dark:text-amber-400"
    return "text-red-600 dark:text-red-400"
  }

  const getHealthBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-emerald-500/90 text-white">Healthy</Badge>
    if (score >= 60) return <Badge className="bg-amber-500/90 text-white">Warning</Badge>
    return <Badge className="bg-red-500/90 text-white">Critical</Badge>
  }

  if (loading && !systemHealth) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center space-y-4">
          <RefreshCw className="h-10 w-10 animate-spin text-slate-400 mx-auto" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Loading system health...</p>
        </div>
      </div>
    )
  }

  if (!systemHealth) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Unable to fetch system health data.
        </p>
        <Button onClick={fetchSystemHealth} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", embedInDashboard && "space-y-4 sm:space-y-5")}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className={cn("font-semibold text-slate-800 dark:text-slate-100", embedInDashboard ? "text-lg" : "text-xl")}>
            System Monitor
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Real-time health and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
          >
            <Activity className="h-3.5 w-3.5 mr-1.5" />
            {autoRefresh ? "Auto On" : "Auto Off"}
          </Button>
          <Button onClick={fetchSystemHealth} variant="outline" size="sm" className="h-8">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* System Status */}
      <Card className={cn("border-slate-200/80 dark:border-white/[0.08]", embedInDashboard && "border-l-4 border-l-emerald-500")}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              System Status
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className={cn("font-bold", getHealthColor(systemHealth.healthScore))}>
                {systemHealth.healthScore}%
              </span>
              {getHealthBadge(systemHealth.healthScore)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Progress value={systemHealth.healthScore} className="h-1.5" />
          <div className="flex gap-4 mt-2 text-xs text-slate-600 dark:text-slate-400">
            <span>Uptime: {formatUptime(systemHealth.system.uptime)}</span>
            <span className="capitalize">Status: {systemHealth.status}</span>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-slate-200/80 dark:border-white/[0.08]">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-emerald-600" />
              Database
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {systemHealth.database.responseTime}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Connected</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-white/[0.08]">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-blue-600" />
              Memory
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {formatBytes(systemHealth.system.memoryUsage.heapUsed)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">of {formatBytes(systemHealth.system.memoryUsage.heapTotal)}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-white/[0.08]">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-violet-600" />
              CPU
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {(systemHealth.system.cpuUsage.user + systemHealth.system.cpuUsage.system) / 1000}ms
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total usage</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-white/[0.08] col-span-2 lg:col-span-1">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
              App Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Students</span>
                <div className="font-semibold text-slate-900 dark:text-slate-100">{systemHealth.metrics.totalStudents}</div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Quizzes</span>
                <div className="font-semibold text-slate-900 dark:text-slate-100">{systemHealth.metrics.totalQuizzes}</div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Attempts</span>
                <div className="font-semibold text-slate-900 dark:text-slate-100">{systemHealth.metrics.totalAttempts}</div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Sessions</span>
                <div className="font-semibold text-slate-900 dark:text-slate-100">{systemHealth.metrics.activeSessions}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Application Metrics - compact when embedded */}
      {!embedInDashboard && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Application Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <Users className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <div className="text-2xl font-bold">{systemHealth.metrics.totalStudents}</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Total Students</div>
              </div>
              <div className="text-center">
                <BookOpen className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <div className="text-2xl font-bold">{systemHealth.metrics.totalQuizzes}</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Total Quizzes</div>
              </div>
              <div className="text-center">
                <Activity className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                <div className="text-2xl font-bold">{systemHealth.metrics.totalAttempts}</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Total Attempts</div>
              </div>
              <div className="text-center">
                <Wifi className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                <div className="text-2xl font-bold">{systemHealth.metrics.activeSessions}</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Sessions</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Last updated: {new Date(systemHealth.timestamp).toLocaleString("en-US", { timeZone: "America/Chicago" })}
      </p>
    </div>
  )
}
