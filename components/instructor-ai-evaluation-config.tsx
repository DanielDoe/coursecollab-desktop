"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { 
  Bot, 
  Settings, 
  Save, 
  Plus, 
  Trash2, 
  Copy,
  CheckCircle,
  AlertCircle,
  Brain,
  Target,
  FileCode,
  BarChart3
} from "lucide-react"
import { motion } from "framer-motion"

interface ModelConfig {
  model_name: string
  temperature: number
  max_tokens: number
  top_p: number
  frequency_penalty: number
  presence_penalty: number
}

interface EvaluationCriteria {
  criteria_name: string
  weight: number
  description: string
  prompt_template: string
  is_enabled: boolean
}

interface QuestionTypeConfig {
  question_type: string
  specific_prompt: string
  evaluation_rubric: string
  partial_credit_enabled: boolean
  max_attempts: number
}

interface ScoringConfig {
  perfect_score_threshold: number
  good_score_threshold: number
  passing_score_threshold: number
  partial_credit_enabled: boolean
  minimum_partial_score: number
  bonus_points_enabled: boolean
  max_bonus_points: number
}

interface AIConfig {
  id: number
  name: string
  description: string
  is_active: boolean
  modelConfig?: ModelConfig
  criteria: EvaluationCriteria[]
  questionTypeConfigs: QuestionTypeConfig[]
  scoringConfig?: ScoringConfig
}

const DEFAULT_CRITERIA: EvaluationCriteria[] = [
  {
    criteria_name: "Correctness",
    weight: 40,
    description: "Whether the code produces the correct output",
    prompt_template: "Evaluate the correctness of the code solution. Does it produce the expected output for given inputs?",
    is_enabled: true
  },
  {
    criteria_name: "Code Quality",
    weight: 25,
    description: "Code readability, structure, and best practices",
    prompt_template: "Assess code quality including readability, proper naming, structure, and adherence to coding standards.",
    is_enabled: true
  },
  {
    criteria_name: "Efficiency",
    weight: 20,
    description: "Algorithm efficiency and optimization",
    prompt_template: "Evaluate the efficiency of the solution. Consider time and space complexity.",
    is_enabled: true
  },
  {
    criteria_name: "Completeness",
    weight: 15,
    description: "Whether the solution fully addresses the requirements",
    prompt_template: "Check if the solution fully addresses all requirements and edge cases mentioned in the problem.",
    is_enabled: true
  }
]

const DEFAULT_QUESTION_TYPES: QuestionTypeConfig[] = [
  {
    question_type: "code_write",
    specific_prompt: "You are a C++ programming tutor. Evaluate the student's code submission for correctness, quality, efficiency, and completeness. Provide detailed feedback with specific suggestions for improvement.",
    evaluation_rubric: "Evaluate based on: 1) Correctness (40%): Does the code work as intended? 2) Code Quality (25%): Is the code readable and well-structured? 3) Efficiency (20%): Is the solution efficient? 4) Completeness (15%): Does it meet all requirements?",
    partial_credit_enabled: true,
    max_attempts: 3
  },
  {
    question_type: "code_explain",
    specific_prompt: "You are a C++ programming tutor. Evaluate the student's explanation of the given code. Assess their understanding of concepts, accuracy of explanation, and depth of analysis.",
    evaluation_rubric: "Evaluate based on: 1) Accuracy (50%): Is the explanation correct? 2) Completeness (30%): Does it cover all important aspects? 3) Clarity (20%): Is the explanation clear and well-organized?",
    partial_credit_enabled: true,
    max_attempts: 3
  },
  {
    question_type: "code_debug",
    specific_prompt: "You are a C++ programming tutor. Evaluate the student's debugging analysis. Check if they correctly identified the issues and provided appropriate solutions.",
    evaluation_rubric: "Evaluate based on: 1) Issue Identification (60%): Did they correctly identify the problems? 2) Solution Quality (25%): Are their proposed solutions appropriate? 3) Explanation (15%): Is their reasoning clear and logical?",
    partial_credit_enabled: true,
    max_attempts: 3
  },
  {
    question_type: "code_problem",
    specific_prompt: "You are a C++ programming tutor. Evaluate the student's solution to the programming problem. Assess correctness, approach, and implementation quality.",
    evaluation_rubric: "Evaluate based on: 1) Correctness (45%): Does the solution work correctly? 2) Approach (25%): Is the problem-solving approach sound? 3) Implementation (20%): Is the code well-implemented? 4) Edge Cases (10%): Does it handle edge cases?",
    partial_credit_enabled: true,
    max_attempts: 3
  }
]

export function InstructorAIEvaluationConfig() {
  const { toast } = useToast()
  const [configs, setConfigs] = useState<AIConfig[]>([])
  const [selectedConfig, setSelectedConfig] = useState<AIConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true
  })

  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    model_name: "gpt-5-mini",
    temperature: 0.3,
    max_tokens: 1000,
    top_p: 1.0,
    frequency_penalty: 0.0,
    presence_penalty: 0.0
  })

  const [criteria, setCriteria] = useState<EvaluationCriteria[]>(DEFAULT_CRITERIA)
  const [questionTypeConfigs, setQuestionTypeConfigs] = useState<QuestionTypeConfig[]>(DEFAULT_QUESTION_TYPES)
  const [scoringConfig, setScoringConfig] = useState<ScoringConfig>({
    perfect_score_threshold: 90,
    good_score_threshold: 70,
    passing_score_threshold: 60,
    partial_credit_enabled: true,
    minimum_partial_score: 20,
    bonus_points_enabled: false,
    max_bonus_points: 10
  })

  useEffect(() => {
    fetchConfigurations()
  }, [])

  const fetchConfigurations = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/ai-evaluation-config")
      const data = await response.json()
      setConfigs(data.configs || [])
      
      // Set default configuration if available
      if (data.configs && data.configs.length > 0) {
        setSelectedConfig(data.configs[0])
        loadConfiguration(data.configs[0].id)
      }
    } catch (error) {
      console.error("Failed to fetch configurations:", error)
      toast({
        title: "Error",
        description: "Failed to fetch AI configurations",
        variant: "destructive",
      })
    }
  }

  const loadConfiguration = async (configId: number) => {
    try {
      const response = await instructorApiFetch(`/api/instructor/ai-evaluation-config?configId=${configId}`)
      const data = await response.json()
      
      if (data.config) {
        setFormData({
          name: data.config.name,
          description: data.config.description,
          is_active: data.config.is_active
        })
        
        if (data.modelConfig) setModelConfig(data.modelConfig)
        if (data.criteria) setCriteria(data.criteria)
        if (data.questionTypeConfigs) setQuestionTypeConfigs(data.questionTypeConfigs)
        if (data.scoringConfig) setScoringConfig(data.scoringConfig)
      }
    } catch (error) {
      console.error("Failed to load configuration:", error)
      toast({
        title: "Error",
        description: "Failed to load configuration details",
        variant: "destructive",
      })
    }
  }

  const handleSaveConfiguration = async () => {
    setLoading(true)
    try {
      const payload = {
        configId: selectedConfig?.id,
        name: formData.name,
        description: formData.description,
        is_active: formData.is_active,
        modelConfig,
        criteria,
        questionTypeConfigs,
        scoringConfig
      }

      const method = selectedConfig ? "PUT" : "POST"
      const response = await instructorApiFetch("/api/instructor/ai-evaluation-config", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Configuration ${selectedConfig ? "updated" : "created"} successfully`,
        })
        fetchConfigurations()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save configuration")
      }
    } catch (error) {
      console.error("Failed to save configuration:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save configuration",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNew = () => {
    setSelectedConfig(null)
    setFormData({ name: "", description: "", is_active: true })
    setModelConfig({
      model_name: "gpt-5-mini",
      temperature: 0.3,
      max_tokens: 1000,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0
    })
    setCriteria(DEFAULT_CRITERIA)
    setQuestionTypeConfigs(DEFAULT_QUESTION_TYPES)
    setScoringConfig({
      perfect_score_threshold: 90,
      good_score_threshold: 70,
      passing_score_threshold: 60,
      partial_credit_enabled: true,
      minimum_partial_score: 20,
      bonus_points_enabled: false,
      max_bonus_points: 10
    })
    setActiveTab("overview")
  }

  const updateCriteria = (index: number, field: keyof EvaluationCriteria, value: any) => {
    const newCriteria = [...criteria]
    newCriteria[index] = { ...newCriteria[index], [field]: value }
    setCriteria(newCriteria)
  }

  const addCriteria = () => {
    setCriteria([...criteria, {
      criteria_name: "New Criteria",
      weight: 10,
      description: "",
      prompt_template: "",
      is_enabled: true
    }])
  }

  const removeCriteria = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index))
  }

  const updateQuestionTypeConfig = (index: number, field: keyof QuestionTypeConfig, value: any) => {
    const newConfigs = [...questionTypeConfigs]
    newConfigs[index] = { ...newConfigs[index], [field]: value }
    setQuestionTypeConfigs(newConfigs)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-6 w-6" />
            AI Evaluation Configuration
          </CardTitle>
          <CardDescription>
            Configure how the AI evaluates student code submissions and provides feedback
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Configuration Selection */}
          <div className="mb-6">
            <Label className="text-sm font-medium mb-2 block">Select Configuration</Label>
            <div className="flex gap-2 flex-wrap">
              {configs.map((config) => (
                <Button
                  key={config.id}
                  variant={selectedConfig?.id === config.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedConfig(config)
                    loadConfiguration(config.id)
                  }}
                  className="gap-2"
                >
                  {config.is_active && <CheckCircle className="h-4 w-4" />}
                  {config.name}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={handleCreateNew} className="gap-2">
                <Plus className="h-4 w-4" />
                New Configuration
              </Button>
            </div>
          </div>

          {selectedConfig && (
            <div className="mb-4">
              <Badge variant={selectedConfig.is_active ? "default" : "secondary"}>
                {selectedConfig.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview" className="gap-2">
                <Settings className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="model" className="gap-2">
                <Brain className="h-4 w-4" />
                AI Model
              </TabsTrigger>
              <TabsTrigger value="criteria" className="gap-2">
                <Target className="h-4 w-4" />
                Criteria
              </TabsTrigger>
              <TabsTrigger value="question-types" className="gap-2">
                <FileCode className="h-4 w-4" />
                Question Types
              </TabsTrigger>
              <TabsTrigger value="scoring" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Scoring
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Configuration Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Configuration Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter configuration name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="active">Status</Label>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="active"
                          checked={formData.is_active}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                        />
                        <Label htmlFor="active">{formData.is_active ? "Active" : "Inactive"}</Label>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Enter configuration description"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="model" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>AI Model Configuration</CardTitle>
                  <CardDescription>
                    Configure the AI model parameters for code evaluation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="model_name">Model Name</Label>
                      <Input
                        id="model_name"
                        value={modelConfig.model_name}
                        onChange={(e) => setModelConfig({ ...modelConfig, model_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="temperature">Temperature ({modelConfig.temperature})</Label>
                      <Input
                        id="temperature"
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={modelConfig.temperature}
                        onChange={(e) => setModelConfig({ ...modelConfig, temperature: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_tokens">Max Tokens</Label>
                      <Input
                        id="max_tokens"
                        type="number"
                        value={modelConfig.max_tokens}
                        onChange={(e) => setModelConfig({ ...modelConfig, max_tokens: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="top_p">Top P ({modelConfig.top_p})</Label>
                      <Input
                        id="top_p"
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={modelConfig.top_p}
                        onChange={(e) => setModelConfig({ ...modelConfig, top_p: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="criteria" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Evaluation Criteria
                    <Button onClick={addCriteria} size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Criteria
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    Define how the AI evaluates different aspects of code submissions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {criteria.map((criterion, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border rounded-lg p-4 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Criterion {index + 1}</h4>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={criterion.is_enabled}
                            onCheckedChange={(checked) => updateCriteria(index, "is_enabled", checked)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeCriteria(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Criteria Name</Label>
                          <Input
                            value={criterion.criteria_name}
                            onChange={(e) => updateCriteria(index, "criteria_name", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Weight (%)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={criterion.weight}
                            onChange={(e) => updateCriteria(index, "weight", parseFloat(e.target.value))}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          value={criterion.description}
                          onChange={(e) => updateCriteria(index, "description", e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Prompt Template</Label>
                        <Textarea
                          value={criterion.prompt_template}
                          onChange={(e) => updateCriteria(index, "prompt_template", e.target.value)}
                          rows={2}
                        />
                      </div>
                    </motion.div>
                  ))}
                  
                  <div className="text-sm text-muted-foreground">
                    Total Weight: {criteria.reduce((sum, c) => sum + c.weight, 0)}%
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="question-types" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Question Type Configurations</CardTitle>
                  <CardDescription>
                    Configure evaluation settings for different question types
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {questionTypeConfigs.map((config, index) => (
                    <motion.div
                      key={config.question_type}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border rounded-lg p-4 space-y-4"
                    >
                      <h4 className="font-medium capitalize">
                        {config.question_type.replace('_', ' ')} Configuration
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Partial Credit Enabled</Label>
                          <Switch
                            checked={config.partial_credit_enabled}
                            onCheckedChange={(checked) => updateQuestionTypeConfig(index, "partial_credit_enabled", checked)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Max Attempts</Label>
                          <Input
                            type="number"
                            min="1"
                            max="10"
                            value={config.max_attempts}
                            onChange={(e) => updateQuestionTypeConfig(index, "max_attempts", parseInt(e.target.value))}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Specific Prompt</Label>
                        <Textarea
                          value={config.specific_prompt}
                          onChange={(e) => updateQuestionTypeConfig(index, "specific_prompt", e.target.value)}
                          rows={3}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Evaluation Rubric</Label>
                        <Textarea
                          value={config.evaluation_rubric}
                          onChange={(e) => updateQuestionTypeConfig(index, "evaluation_rubric", e.target.value)}
                          rows={3}
                        />
                      </div>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="scoring" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Scoring Configuration</CardTitle>
                  <CardDescription>
                    Configure how scores are calculated and thresholds
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Perfect Score Threshold (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={scoringConfig.perfect_score_threshold}
                        onChange={(e) => setScoringConfig({ ...scoringConfig, perfect_score_threshold: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Good Score Threshold (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={scoringConfig.good_score_threshold}
                        onChange={(e) => setScoringConfig({ ...scoringConfig, good_score_threshold: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Passing Score Threshold (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={scoringConfig.passing_score_threshold}
                        onChange={(e) => setScoringConfig({ ...scoringConfig, passing_score_threshold: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Minimum Partial Score (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={scoringConfig.minimum_partial_score}
                        onChange={(e) => setScoringConfig({ ...scoringConfig, minimum_partial_score: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={scoringConfig.partial_credit_enabled}
                        onCheckedChange={(checked) => setScoringConfig({ ...scoringConfig, partial_credit_enabled: checked })}
                      />
                      <Label>Enable Partial Credit</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={scoringConfig.bonus_points_enabled}
                        onCheckedChange={(checked) => setScoringConfig({ ...scoringConfig, bonus_points_enabled: checked })}
                      />
                      <Label>Enable Bonus Points</Label>
                    </div>
                    
                    {scoringConfig.bonus_points_enabled && (
                      <div className="space-y-2">
                        <Label>Max Bonus Points</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={scoringConfig.max_bonus_points}
                          onChange={(e) => setScoringConfig({ ...scoringConfig, max_bonus_points: parseFloat(e.target.value) })}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end pt-6">
            <Button onClick={handleSaveConfiguration} disabled={loading} className="gap-2">
              <Save className="h-4 w-4" />
              {loading ? "Saving..." : selectedConfig ? "Update Configuration" : "Create Configuration"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
