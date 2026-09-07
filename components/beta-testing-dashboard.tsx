"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  TestTube, 
  Users, 
  Flag, 
  Settings, 
  Eye, 
  EyeOff,
  Plus,
  Save,
  RefreshCw,
  CheckCircle2,
  XCircle
} from "lucide-react"

interface FeatureFlag {
  id: number
  flag_name: string
  description: string
  enabled_for_beta: boolean
  enabled_for_all: boolean
  module: string
}

interface BetaUser {
  student_id: string
  full_name: string
  email: string
  section: string
  beta_user: boolean
}

export function BetaTestingDashboard() {
  const { toast } = useToast()
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([])
  const [betaUsers, setBetaUsers] = useState<BetaUser[]>([])
  const [loading, setLoading] = useState(true)
  const [newFlag, setNewFlag] = useState({
    flag_name: "",
    description: "",
    module: "",
    enabled_for_beta: false,
    enabled_for_all: false
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        fetchFeatureFlags(),
        fetchBetaUsers()
      ])
    } catch (error) {
      console.error("Failed to fetch data:", error)
      toast({
        title: "Error",
        description: "Failed to fetch beta testing data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchFeatureFlags = async () => {
    try {
      const response = await fetch("/api/feature-flags")
      if (response.ok) {
        const data = await response.json()
        setFeatureFlags(data.allFlags || [])
      }
    } catch (error) {
      console.error("Failed to fetch feature flags:", error)
    }
  }

  const fetchBetaUsers = async () => {
    try {
      const response = await fetch("/api/admin/beta-users")
      if (response.ok) {
        const data = await response.json()
        setBetaUsers(data.users || [])
      }
    } catch (error) {
      console.error("Failed to fetch beta users:", error)
    }
  }

  const updateFeatureFlag = async (flagName: string, updates: Partial<FeatureFlag>) => {
    try {
      const response = await fetch("/api/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flagName,
          ...updates
        })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Feature flag ${flagName} updated successfully`
        })
        fetchFeatureFlags()
      } else {
        throw new Error("Failed to update feature flag")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update feature flag",
        variant: "destructive"
      })
    }
  }

  const createFeatureFlag = async () => {
    try {
      const response = await fetch("/api/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFlag)
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Feature flag created successfully"
        })
        setNewFlag({
          flag_name: "",
          description: "",
          module: "",
          enabled_for_beta: false,
          enabled_for_all: false
        })
        fetchFeatureFlags()
      } else {
        throw new Error("Failed to create feature flag")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create feature flag",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading beta testing dashboard...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Beta Testing Dashboard</h2>
          <p className="text-muted-foreground">Manage feature flags and beta users</p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="flags" className="space-y-4">
        <TabsList>
          <TabsTrigger value="flags">Feature Flags</TabsTrigger>
          <TabsTrigger value="users">Beta Users</TabsTrigger>
          <TabsTrigger value="create">Create Flag</TabsTrigger>
        </TabsList>

        <TabsContent value="flags" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5" />
                Feature Flags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {featureFlags.map((flag) => (
                  <div key={flag.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{flag.flag_name}</h3>
                        <Badge variant="secondary">{flag.module}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{flag.description}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`beta-${flag.id}`} className="text-sm">Beta</Label>
                        <Switch
                          id={`beta-${flag.id}`}
                          checked={flag.enabled_for_beta}
                          onCheckedChange={(checked) =>
                            updateFeatureFlag(flag.flag_name, { enabled_for_beta: checked })
                          }
                        />
                        {flag.enabled_for_beta ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`all-${flag.id}`} className="text-sm">All Users</Label>
                        <Switch
                          id={`all-${flag.id}`}
                          checked={flag.enabled_for_all}
                          onCheckedChange={(checked) =>
                            updateFeatureFlag(flag.flag_name, { enabled_for_all: checked })
                          }
                        />
                        {flag.enabled_for_all ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Beta Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {betaUsers.map((user) => (
                  <div key={user.student_id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{user.full_name}</h3>
                        <Badge variant={user.beta_user ? "default" : "secondary"}>
                          {user.beta_user ? "Beta User" : "Regular User"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {user.email} • {user.section}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">ID: {user.student_id}</span>
                      {user.beta_user ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create Feature Flag
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="flag-name">Flag Name</Label>
                  <Input
                    id="flag-name"
                    placeholder="e.g., new_feature_2024"
                    value={newFlag.flag_name}
                    onChange={(e) => setNewFlag({ ...newFlag, flag_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flag-module">Module</Label>
                  <Select
                    value={newFlag.module}
                    onValueChange={(value) => setNewFlag({ ...newFlag, module: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select module" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assessments">Assessments</SelectItem>
                      <SelectItem value="practice">Practice</SelectItem>
                      <SelectItem value="analytics">Analytics</SelectItem>
                      <SelectItem value="ui">UI/UX</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="flag-description">Description</Label>
                <Textarea
                  id="flag-description"
                  placeholder="Describe what this feature flag controls..."
                  value={newFlag.description}
                  onChange={(e) => setNewFlag({ ...newFlag, description: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="enable-beta"
                    checked={newFlag.enabled_for_beta}
                    onCheckedChange={(checked) =>
                      setNewFlag({ ...newFlag, enabled_for_beta: checked })
                    }
                  />
                  <Label htmlFor="enable-beta">Enable for Beta Users</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="enable-all"
                    checked={newFlag.enabled_for_all}
                    onCheckedChange={(checked) =>
                      setNewFlag({ ...newFlag, enabled_for_all: checked })
                    }
                  />
                  <Label htmlFor="enable-all">Enable for All Users</Label>
                </div>
              </div>

              <Button onClick={createFeatureFlag} disabled={!newFlag.flag_name}>
                <Save className="h-4 w-4 mr-2" />
                Create Feature Flag
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
