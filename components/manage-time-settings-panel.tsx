"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Edit2, Save, X, Clock, Plus } from "lucide-react"
import { DEFAULT_TIME_PER_TYPE, formatTimeLimit, QUESTION_TYPE_METADATA } from "@/lib/config/quizSettings"

interface QuestionTimeSetting {
  id: number
  question_type: string
  assessment_type: string
  time_limit: number
  description: string
  updated_at: string
}

interface ManageTimeSettingsPanelProps {
  userType: "admin" | "instructor"
}

export function ManageTimeSettingsPanel({ userType }: ManageTimeSettingsPanelProps) {
  const [settings, setSettings] = useState<QuestionTimeSetting[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingValues, setEditingValues] = useState<Partial<QuestionTimeSetting>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("generic")
  const { toast } = useToast()

  const assessmentTypes = [
    { value: "generic", label: "Generic (Default)" },
    { value: "mid_semester", label: "Mid-Semester" },
    { value: "quiz", label: "Quiz" },
    { value: "final", label: "Final" },
    { value: "homework", label: "Homework" }
  ]

  const getSessionHeaders = () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    
    if (userType === "admin") {
      const adminId = sessionStorage.getItem("adminId")
      if (adminId) {
        headers["admin-session"] = adminId
      }
    } else {
      const instructorSession = localStorage.getItem("instructorSession")
      if (instructorSession) {
        headers["instructor-session"] = instructorSession
      }
    }
    
    return headers
  }

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const headers = getSessionHeaders()
      const response = await fetch(`/api/${userType}/question-time-settings`, {
        headers
      })
      
      if (!response.ok) {
        throw new Error("Failed to fetch time settings")
      }
      
      const data = await response.json()
      setSettings(data.settings || [])
    } catch (error) {
      console.error("Failed to fetch time settings:", error)
      toast({
        title: "Error",
        description: "Failed to fetch question time settings",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const getSettingsForAssessment = (assessmentType: string) => {
    return settings.filter(s => s.assessment_type === assessmentType)
  }

  const startEditing = (setting: QuestionTimeSetting) => {
    setEditingId(setting.id)
    setEditingValues({
      time_limit: setting.time_limit,
      description: setting.description
    })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingValues({})
  }

  const saveSetting = async (id: number) => {
    setSaving(true)
    try {
      const headers = getSessionHeaders()
      const response = await fetch(`/api/${userType}/question-time-settings`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          id,
          ...editingValues
        })
      })
      
      if (!response.ok) {
        throw new Error("Failed to update time setting")
      }
      
      await fetchSettings()
      setEditingId(null)
      setEditingValues({})
      
      toast({
        title: "Success",
        description: "Question time setting updated successfully",
      })
    } catch (error) {
      console.error("Failed to update time setting:", error)
      toast({
        title: "Error",
        description: "Failed to update question time setting",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const getQuestionTypeLabel = (type: string) => {
    return QUESTION_TYPE_METADATA[type as keyof typeof QUESTION_TYPE_METADATA]?.label || type
  }

  const getQuestionTypeDescription = (type: string) => {
    return QUESTION_TYPE_METADATA[type as keyof typeof QUESTION_TYPE_METADATA]?.description || ""
  }

  const getDifficultyBadge = (type: string) => {
    const difficulty = QUESTION_TYPE_METADATA[type as keyof typeof QUESTION_TYPE_METADATA]?.difficulty || "medium"
    const colors = {
      easy: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
      hard: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
    }
    return (
      <Badge className={colors[difficulty as keyof typeof colors]}>
        {difficulty}
      </Badge>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Manage Time Settings by Question Type</CardTitle>
          <CardDescription>Loading time settings...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Manage Time Settings by Question Type
        </CardTitle>
        <CardDescription>
          Configure time limits for different question types across assessment types. 
          These settings automatically apply when creating new assessments.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            {assessmentTypes.map((type) => (
              <TabsTrigger key={type.value} value={type.value}>
                {type.label}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {assessmentTypes.map((type) => (
            <TabsContent key={type.value} value={type.value}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">{type.label} Time Settings</h3>
                  <div className="text-sm text-muted-foreground">
                    {getSettingsForAssessment(type.value).length} question types configured
                  </div>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Question Type</TableHead>
                      <TableHead>Difficulty</TableHead>
                      <TableHead>Time Limit</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getSettingsForAssessment(type.value).map((setting) => (
                      <TableRow key={setting.id}>
                        <TableCell className="font-medium">
                          {getQuestionTypeLabel(setting.question_type)}
                        </TableCell>
                        <TableCell>
                          {getDifficultyBadge(setting.question_type)}
                        </TableCell>
                        <TableCell>
                          {editingId === setting.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="15"
                                max="900"
                                value={editingValues.time_limit || 0}
                                onChange={(e) => setEditingValues(prev => ({
                                  ...prev,
                                  time_limit: parseInt(e.target.value)
                                }))}
                                className="w-20"
                              />
                              <span className="text-sm text-muted-foreground">sec</span>
                            </div>
                          ) : (
                            <Badge variant="outline" className="font-mono">
                              {formatTimeLimit(setting.time_limit)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {editingId === setting.id ? (
                            <Input
                              value={editingValues.description || ""}
                              onChange={(e) => setEditingValues(prev => ({
                                ...prev,
                                description: e.target.value
                              }))}
                              placeholder="Description"
                            />
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {setting.description || getQuestionTypeDescription(setting.question_type)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(setting.updated_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {editingId === setting.id ? (
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={() => saveSetting(setting.id)}
                                disabled={saving}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEditing}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditing(setting)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {getSettingsForAssessment(type.value).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No time settings configured for {type.label} assessments.
                    <br />
                    Default times will be used from the Generic configuration.
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
        
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-lg">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            ⏱️ Time Limit Guidelines
          </h4>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>• <strong>Quick Recall (30-45s):</strong> True/False, MCQ, Fill Blank</li>
            <li>• <strong>Analysis (60-120s):</strong> Select All, Code Output, Scenario Match</li>
            <li>• <strong>Deep Thinking (180-300s):</strong> Code Write, Code Problem, Debug</li>
            <li>• <strong>Anti-Cheat Optimized:</strong> Tight time limits prevent cheating</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
