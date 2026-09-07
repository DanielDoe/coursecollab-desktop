"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Edit2, Save, X, RotateCcw, Plus } from "lucide-react"

interface QuestionTypeWeight {
  id: number
  question_type: string
  assessment_type: string
  points_value: number
  percentage_weight: number
  evaluation_mode: string
  grading_mode: string
  updated_at: string
}

interface ManageScoresPanelProps {
  userType: "admin" | "instructor"
  assessmentType?: string
}

export function ManageScoresPanel({ userType, assessmentType }: ManageScoresPanelProps) {
  const [weights, setWeights] = useState<QuestionTypeWeight[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingValues, setEditingValues] = useState<Partial<QuestionTypeWeight>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Map assessment types to panel tabs
  const getDefaultTab = () => {
    if (assessmentType === 'final' || assessmentType === 'final-exams') return 'final'
    if (assessmentType === 'mid_semester' || assessmentType === 'mid-semester-exams') return 'mid_semester'
    if (assessmentType === 'homework' || assessmentType === 'homeworks') return 'homework'
    if (assessmentType === 'quiz' || assessmentType === 'quizzes') return 'quiz'
    return 'mid_semester' // Default fallback
  }
  
  const [activeTab, setActiveTab] = useState(getDefaultTab())
  const { toast } = useToast()

  const assessmentTypes = [
    { value: "mid_semester", label: "Mid-Semester" },
    { value: "quiz", label: "Quiz" },
    { value: "final", label: "Final" },
    { value: "homework", label: "Homework" },
    { value: "generic", label: "Generic" }
  ]

  const questionTypes = [
    { value: "mcq", label: "Multiple Choice" },
    { value: "true_false", label: "True/False" },
    { value: "select_all", label: "Select All" },
    { value: "fill_blank", label: "Fill in Blank" },
    { value: "code_write", label: "Code Write" },
    { value: "code_explain", label: "Code Explain" },
    { value: "code_problem", label: "Code Problem" }
  ]

  const evaluationModes = [
    { value: "auto", label: "Auto", color: "bg-green-100 text-green-800" },
    { value: "ai", label: "AI", color: "bg-blue-100 text-blue-800" },
    { value: "manual", label: "Manual", color: "bg-orange-100 text-orange-800" }
  ]

  const gradingModes = [
    { value: "graded", label: "Graded", color: "bg-green-100 text-green-800" },
    { value: "no_grade", label: "No Grade", color: "bg-gray-100 text-gray-800" }
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

  const fetchWeights = async () => {
    setLoading(true)
    try {
      const headers = getSessionHeaders()
      console.log("[ManageScoresPanel] Fetching weights with headers:", headers)
      const response = await fetch(`/api/${userType}/question-type-weights`, {
        headers
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error("[ManageScoresPanel] Failed to fetch weights:", response.status, errorText)
        throw new Error(`Failed to fetch weights: ${response.status} ${errorText}`)
      }
      
      const data = await response.json()
      console.log("[ManageScoresPanel] Fetched weights:", data.weights?.length || 0)
      setWeights(data.weights || [])
    } catch (error) {
      console.error("Failed to fetch weights:", error)
      toast({
        title: "Error",
        description: "Failed to fetch question type weights",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWeights()
  }, [])

  const getWeightsForAssessment = (assessmentType: string) => {
    return weights.filter(w => w.assessment_type === assessmentType)
  }

  const startEditing = (weight: QuestionTypeWeight) => {
    setEditingId(weight.id)
    setEditingValues({
      points_value: weight.points_value,
      percentage_weight: weight.percentage_weight,
      evaluation_mode: weight.evaluation_mode,
      grading_mode: weight.grading_mode
    })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingValues({})
  }

  const saveWeight = async (id: number) => {
    setSaving(true)
    try {
      const headers = getSessionHeaders()
      const response = await fetch(`/api/${userType}/question-type-weights`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          id,
          ...editingValues
        })
      })
      
      if (!response.ok) {
        throw new Error("Failed to update weight")
      }
      
      await fetchWeights()
      setEditingId(null)
      setEditingValues({})
      
      toast({
        title: "Success",
        description: "Question type weight updated successfully",
      })
    } catch (error) {
      console.error("Failed to update weight:", error)
      toast({
        title: "Error",
        description: "Failed to update question type weight",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const createWeight = async () => {
    setSaving(true)
    try {
      const headers = getSessionHeaders()
      const payload = {
        question_type: "mcq",
        assessment_type: activeTab,
        points_value: 1.0,
        percentage_weight: 0.0,
        evaluation_mode: "auto",
        grading_mode: "graded"
      }
      console.log("[ManageScoresPanel] Creating weight with payload:", payload)
      console.log("[ManageScoresPanel] Headers:", headers)
      
      const response = await fetch(`/api/${userType}/question-type-weights`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error("[ManageScoresPanel] Failed to create weight:", response.status, errorText)
        throw new Error(`Failed to create weight: ${response.status} ${errorText}`)
      }
      
      const data = await response.json()
      console.log("[ManageScoresPanel] Created weight:", data)
      await fetchWeights()
      
      toast({
        title: "Success",
        description: "Question type weight created successfully",
      })
    } catch (error: any) {
      console.error("Failed to create weight:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create question type weight",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const getEvaluationModeColor = (mode: string) => {
    const evalMode = evaluationModes.find(m => m.value === mode)
    return evalMode?.color || "bg-gray-100 text-gray-800"
  }

  const getGradingModeColor = (mode: string) => {
    const gradeMode = gradingModes.find(m => m.value === mode)
    return gradeMode?.color || "bg-gray-100 text-gray-800"
  }

  const getQuestionTypeLabel = (type: string) => {
    const questionType = questionTypes.find(t => t.value === type)
    return questionType?.label || type
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Manage Scores by Question Type</CardTitle>
          <CardDescription>Loading question type weights...</CardDescription>
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
        <CardTitle>Manage Scores by Question Type</CardTitle>
        <CardDescription>
          Configure point values, weights, and evaluation modes for different question types across assessment types.
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
                  <h3 className="text-lg font-medium">{type.label} Assessment Weights</h3>
                  <Button onClick={createWeight} disabled={saving} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Question Type
                  </Button>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Question Type</TableHead>
                      <TableHead>Points Value</TableHead>
                      <TableHead>Weight (%)</TableHead>
                      <TableHead>Evaluation Mode</TableHead>
                      <TableHead>Grading Mode</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getWeightsForAssessment(type.value).map((weight) => (
                      <TableRow key={weight.id}>
                        <TableCell className="font-medium">
                          {getQuestionTypeLabel(weight.question_type)}
                        </TableCell>
                        <TableCell>
                          {editingId === weight.id ? (
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              value={editingValues.points_value || 0}
                              onChange={(e) => setEditingValues(prev => ({
                                ...prev,
                                points_value: parseFloat(e.target.value)
                              }))}
                              className="w-20"
                            />
                          ) : (
                            weight.points_value
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === weight.id ? (
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              value={editingValues.percentage_weight || 0}
                              onChange={(e) => setEditingValues(prev => ({
                                ...prev,
                                percentage_weight: parseFloat(e.target.value)
                              }))}
                              className="w-20"
                            />
                          ) : (
                            `${weight.percentage_weight}%`
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === weight.id ? (
                            <Select
                              value={editingValues.evaluation_mode || "auto"}
                              onValueChange={(value) => setEditingValues(prev => ({
                                ...prev,
                                evaluation_mode: value
                              }))}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {evaluationModes.map((mode) => (
                                  <SelectItem key={mode.value} value={mode.value}>
                                    {mode.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={getEvaluationModeColor(weight.evaluation_mode)}>
                              {weight.evaluation_mode}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === weight.id ? (
                            <Select
                              value={editingValues.grading_mode || "graded"}
                              onValueChange={(value) => setEditingValues(prev => ({
                                ...prev,
                                grading_mode: value
                              }))}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {gradingModes.map((mode) => (
                                  <SelectItem key={mode.value} value={mode.value}>
                                    {mode.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={getGradingModeColor(weight.grading_mode)}>
                              {weight.grading_mode}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(weight.updated_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {editingId === weight.id ? (
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={() => saveWeight(weight.id)}
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
                              onClick={() => startEditing(weight)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {getWeightsForAssessment(type.value).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No question type weights configured for {type.label} assessments.
                    <br />
                    <Button onClick={createWeight} className="mt-2" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Question Type
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}
