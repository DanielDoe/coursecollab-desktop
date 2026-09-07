"use client"

import { useState, useEffect } from "react"
import { AdminHeader } from "@/components/admin-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Activity, 
  Server, 
  Database, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  RefreshCw,
  Monitor,
  HardDrive,
  Cpu,
  MemoryStick,
  Network
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface SystemHealth {
  status: "healthy" | "warning" | "critical"
  uptime: number
  lastCheck: Date
  responseTime: number
}

interface DatabaseHealth {
  status: "connected" | "slow" | "error"
  connectionCount: number
  queryTime: number
  lastBackup: Date
}

interface ApiHealth {
  endpoint: string
  status: "up" | "down" | "slow"
  responseTime: number
  lastCheck: Date
  errorRate: number
}

interface SystemMetrics {
  cpu: number
  memory: number
  disk: number
  network: number
}

interface ErrorLog {
  id: string
  level: "error" | "warning" | "info"
  message: string
  timestamp: Date
  source: string
  resolved: boolean
}

export default function SystemMonitorPage() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [databaseHealth, setDatabaseHealth] = useState<DatabaseHealth | null>(null)
  const [apiHealth, setApiHealth] = useState<ApiHealth[]>([])
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [recentErrors, setRecentErrors] = useState<ErrorLog[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchSystemData()
    const interval = setInterval(fetchSystemData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchSystemData = async () => {
    setRefreshing(true)
    try {
      const response = await fetch("/api/admin/system-monitor")
      const data = await response.json()
      
      if (response.ok) {
        setSystemHealth(data.systemHealth)
        setDatabaseHealth(data.databaseHealth)
        setApiHealth(data.apiHealth)
        setMetrics(data.metrics)
        setRecentErrors(data.recentErrors || [])
      }
    } catch (error) {
      console.error("Failed to fetch system data:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
      case "connected":
      case "up":
        return "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30"
      case "warning":
      case "slow":
        return "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30"
      case "critical":
      case "error":
      case "down":
        return "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30"
      default:
        return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
      case "connected":
      case "up":
        return <CheckCircle2 className="h-4 w-4" />
      case "warning":
      case "slow":
        return <AlertTriangle className="h-4 w-4" />
      case "critical":
      case "error":
      case "down":
        return <XCircle className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getErrorLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30"
      case "warning":
        return "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30"
      case "info":
        return "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30"
      default:
        return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-secondary">
        <AdminHeader />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="text-muted-foreground">Loading system monitor...</div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary">
      <AdminHeader />

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">System Monitor</h1>
            <p className="text-muted-foreground">Real-time system health and performance metrics</p>
          </div>
          <Button onClick={fetchSystemData} disabled={refreshing} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="api">API Status</TabsTrigger>
            <TabsTrigger value="errors">Error Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* System Health Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    System Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {systemHealth && (
                    <div className="space-y-2">
                      <Badge className={getStatusColor(systemHealth.status)}>
                        {getStatusIcon(systemHealth.status)}
                        <span className="ml-1 capitalize">{systemHealth.status}</span>
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        Uptime: {Math.floor(systemHealth.uptime / 3600)}h {Math.floor((systemHealth.uptime % 3600) / 60)}m
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Response: {systemHealth.responseTime}ms
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Database
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {databaseHealth && (
                    <div className="space-y-2">
                      <Badge className={getStatusColor(databaseHealth.status)}>
                        {getStatusIcon(databaseHealth.status)}
                        <span className="ml-1 capitalize">{databaseHealth.status}</span>
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        Connections: {databaseHealth.connectionCount}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Query Time: {databaseHealth.queryTime}ms
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Last Check
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {systemHealth && (
                    <div className="text-sm text-muted-foreground">
                      {formatDistanceToNow(systemHealth.lastCheck, { addSuffix: true })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Recent Errors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {recentErrors.filter(e => e.level === "error").length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    In the last 24 hours
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common system maintenance tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Database className="mr-2 h-4 w-4" />
                    Backup Database
                  </Button>
                  <Button variant="outline" size="sm">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Clear Cache
                  </Button>
                  <Button variant="outline" size="sm">
                    <Activity className="mr-2 h-4 w-4" />
                    Restart Services
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            {metrics && (
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Cpu className="h-5 w-5" />
                      CPU Usage
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>CPU</span>
                        <span>{metrics.cpu}%</span>
                      </div>
                      <Progress value={metrics.cpu} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MemoryStick className="h-5 w-5" />
                      Memory Usage
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>RAM</span>
                        <span>{metrics.memory}%</span>
                      </div>
                      <Progress value={metrics.memory} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HardDrive className="h-5 w-5" />
                      Disk Usage
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Storage</span>
                        <span>{metrics.disk}%</span>
                      </div>
                      <Progress value={metrics.disk} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Network className="h-5 w-5" />
                      Network I/O
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Network</span>
                        <span>{metrics.network}%</span>
                      </div>
                      <Progress value={metrics.network} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="api" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>API Endpoints Status</CardTitle>
                <CardDescription>Monitor the health of all API endpoints</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {apiHealth.map((api) => (
                    <div key={api.endpoint} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge className={getStatusColor(api.status)}>
                          {getStatusIcon(api.status)}
                          <span className="ml-1 capitalize">{api.status}</span>
                        </Badge>
                        <div>
                          <div className="font-medium">{api.endpoint}</div>
                          <div className="text-sm text-muted-foreground">
                            Response time: {api.responseTime}ms
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          Error rate: {api.errorRate}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(api.lastCheck, { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="errors" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Error Logs</CardTitle>
                <CardDescription>Latest system errors and warnings</CardDescription>
              </CardHeader>
              <CardContent>
                {recentErrors.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <h3 className="text-lg font-semibold mb-2">No recent errors</h3>
                    <p className="text-muted-foreground">System is running smoothly</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentErrors.map((error) => (
                      <div key={error.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <Badge className={getErrorLevelColor(error.level)}>
                          {error.level}
                        </Badge>
                        <div className="flex-1">
                          <div className="font-medium">{error.message}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Source: {error.source} • {formatDistanceToNow(error.timestamp, { addSuffix: true })}
                          </div>
                        </div>
                        {!error.resolved && (
                          <Button size="sm" variant="outline">
                            Resolve
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

