"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Code,
  FileCode,
  TestTube,
  GitBranch,
  HelpCircle,
  Languages,
  Video,
  Monitor,
  Loader2,
  CheckCircle,
  Copy,
  Download,
  Sparkles,
  Play,
  AlertCircle
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface AdvancedAIFeaturesProps {
  studentId?: string
}

export function AdvancedAIFeatures({ studentId }: AdvancedAIFeaturesProps) {
  const { toast } = useToast()
  const [activeFeature, setActiveFeature] = useState<string>("code-review")
  
  // Code Review
  const [codeInput, setCodeInput] = useState("")
  const [reviewResult, setReviewResult] = useState<any>(null)
  const [reviewing, setReviewing] = useState(false)

  // Test Generator
  const [testCode, setTestCode] = useState("")
  const [generatedTests, setGeneratedTests] = useState<string>("")
  const [generatingTests, setGeneratingTests] = useState(false)

  // Diagram Generator
  const [diagramPrompt, setDiagramPrompt] = useState("")
  const [generatedDiagram, setGeneratedDiagram] = useState("")
  const [generatingDiagram, setGeneratingDiagram] = useState(false)

  // Assignment Helper
  const [assignmentQuestion, setAssignmentQuestion] = useState("")
  const [hints, setHints] = useState<string[]>([])
  const [currentHintLevel, setCurrentHintLevel] = useState(0)
  const [generatingHint, setGeneratingHint] = useState(false)

  // Multi-language
  const [selectedLanguage, setSelectedLanguage] = useState("en")
  const [textToTranslate, setTextToTranslate] = useState("")
  const [translatedText, setTranslatedText] = useState("")
  const [translating, setTranslating] = useState(false)

  // Code Review Feature
  const runCodeReview = async () => {
    if (!codeInput.trim()) {
      toast({
        title: "No Code Provided",
        description: "Please paste your code first",
        variant: "destructive"
      })
      return
    }

    // Check credits before proceeding
    const studentDbId = studentId || sessionStorage.getItem("studentDatabaseId")
    if (studentDbId) {
      try {
        const creditsResponse = await fetch(`/api/ai-tutor/credits?studentId=${studentDbId}`)
        if (creditsResponse.ok) {
          const creditsData = await creditsResponse.json()
          if (!creditsData.isUnlimited && creditsData.credits < 50) {
            toast({
              title: "Insufficient Credits",
              description: `You need 50 credits for code review. You have ${creditsData.credits} credits remaining.`,
              variant: "destructive"
            })
            return
          }
        }
      } catch (error) {
        console.error("Failed to check credits:", error)
      }
    }

    setReviewing(true)
    setReviewResult(null)

    try {
      const response = await fetch("/api/ai-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Please review this C++ code for:\n1. Bugs and errors\n2. Optimization opportunities\n3. Best practices\n4. Code style improvements\n5. Potential issues\n\nProvide specific suggestions with line numbers when possible.\n\n\`\`\`cpp\n${codeInput}\n\`\`\``,
          studentId: studentDbId,
          context: { topic: "Code Review" }
        })
      })

      const data = await response.json()
      if (response.ok && !data.accessDenied) {
        setReviewResult({
          review: data.response,
          detectedIssues: extractIssueCount(data.response)
        })
        toast({
          title: "Code Review Complete!",
          description: "AI has analyzed your code"
        })
      } else if (data.accessDenied) {
        toast({
          title: "Access Denied",
          description: data.response || "You don't have access to this feature",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to review code",
        variant: "destructive"
      })
    } finally {
      setReviewing(false)
    }
  }

  // Test Case Generator
  const generateTests = async () => {
    if (!testCode.trim()) {
      toast({
        title: "No Code Provided",
        description: "Please paste the code you want to test",
        variant: "destructive"
      })
      return
    }

    // Check credits before proceeding
    const studentDbId = studentId || sessionStorage.getItem("studentDatabaseId")
    if (studentDbId) {
      try {
        const creditsResponse = await fetch(`/api/ai-tutor/credits?studentId=${studentDbId}`)
        if (creditsResponse.ok) {
          const creditsData = await creditsResponse.json()
          if (!creditsData.isUnlimited && creditsData.credits < 50) {
            toast({
              title: "Insufficient Credits",
              description: `You need 50 credits for test generation. You have ${creditsData.credits} credits remaining.`,
              variant: "destructive"
            })
            return
          }
        }
      } catch (error) {
        console.error("Failed to check credits:", error)
      }
    }

    setGeneratingTests(true)
    setGeneratedTests("")

    try {
      const response = await fetch("/api/ai-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Generate comprehensive unit tests for this C++ code. Include:\n1. Normal test cases\n2. Edge cases\n3. Error cases\n4. Boundary conditions\n\nProvide complete test code with assertions.\n\n\`\`\`cpp\n${testCode}\n\`\`\``,
          studentId: studentDbId,
          context: { topic: "Testing" }
        })
      })

      const data = await response.json()
      if (response.ok && !data.accessDenied) {
        setGeneratedTests(data.response)
        toast({
          title: "Tests Generated!",
          description: "Unit tests created for your code"
        })
      } else if (data.accessDenied) {
        toast({
          title: "Access Denied",
          description: data.response || "You don't have access to this feature",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate tests",
        variant: "destructive"
      })
    } finally {
      setGeneratingTests(false)
    }
  }

  // Diagram Generator
  const generateDiagram = async () => {
    if (!diagramPrompt.trim()) {
      toast({
        title: "No Description",
        description: "Please describe what you want to visualize",
        variant: "destructive"
      })
      return
    }

    // Check credits before proceeding
    const studentDbId = studentId || sessionStorage.getItem("studentDatabaseId")
    if (studentDbId) {
      try {
        const creditsResponse = await fetch(`/api/ai-tutor/credits?studentId=${studentDbId}`)
        if (creditsResponse.ok) {
          const creditsData = await creditsResponse.json()
          if (!creditsData.isUnlimited && creditsData.credits < 30) {
            toast({
              title: "Insufficient Credits",
              description: `You need 30 credits for diagram generation. You have ${creditsData.credits} credits remaining.`,
              variant: "destructive"
            })
            return
          }
        }
      } catch (error) {
        console.error("Failed to check credits:", error)
      }
    }

    setGeneratingDiagram(true)
    setGeneratedDiagram("")

    try {
      const response = await fetch("/api/ai-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Create a detailed ASCII flowchart/diagram for: ${diagramPrompt}\n\nUse:\n- Boxes: ┌─┐│└┘\n- Arrows: → ↓ ← ↑\n- Decision diamonds\n- Clear labels\n\nMake it visually clear and educational. Then explain each part of the diagram.`,
          studentId: studentDbId,
          context: { topic: "Visualization" }
        })
      })

      const data = await response.json()
      if (response.ok && !data.accessDenied) {
        setGeneratedDiagram(data.response)
        toast({
          title: "Diagram Generated!",
          description: "Visual representation created"
        })
      } else if (data.accessDenied) {
        toast({
          title: "Access Denied",
          description: data.response || "You don't have access to this feature",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate diagram",
        variant: "destructive"
      })
    } finally {
      setGeneratingDiagram(false)
    }
  }

  // Assignment Helper
  const getNextHint = async () => {
    if (!assignmentQuestion.trim()) {
      toast({
        title: "No Question",
        description: "Please describe your assignment problem",
        variant: "destructive"
      })
      return
    }

    // Check credits before proceeding
    const studentDbId = studentId || sessionStorage.getItem("studentDatabaseId")
    if (studentDbId) {
      try {
        const creditsResponse = await fetch(`/api/ai-tutor/credits?studentId=${studentDbId}`)
        if (creditsResponse.ok) {
          const creditsData = await creditsResponse.json()
          if (!creditsData.isUnlimited && creditsData.credits < 20) {
            toast({
              title: "Insufficient Credits",
              description: `You need 20 credits for assignment hints. You have ${creditsData.credits} credits remaining.`,
              variant: "destructive"
            })
            return
          }
        }
      } catch (error) {
        console.error("Failed to check credits:", error)
      }
    }

    setGeneratingHint(true)

    const hintLevels = [
      "Give me a general hint about the approach, without revealing the solution",
      "Give me a more specific hint about the first step I should take",
      "Show me pseudocode structure without the actual implementation",
      "Explain the key concept I need to understand to solve this"
    ]

    try {
      const response = await fetch("/api/ai-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Assignment Question: ${assignmentQuestion}\n\nHint Level ${currentHintLevel + 1}: ${hintLevels[currentHintLevel]}\n\nIMPORTANT: Do NOT provide the complete solution. Only give hints that help the student think through the problem themselves.`,
          studentId: studentDbId,
          context: { topic: "Assignment Help" }
        })
      })

      const data = await response.json()
      if (response.ok && !data.accessDenied) {
        setHints(prev => [...prev, data.response])
        setCurrentHintLevel(prev => prev + 1)
        toast({
          title: `Hint ${currentHintLevel + 1} Revealed!`,
          description: "Try to solve it with this hint first"
        })
      } else if (data.accessDenied) {
        toast({
          title: "Access Denied",
          description: data.response || "You don't have access to this feature",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate hint",
        variant: "destructive"
      })
    } finally {
      setGeneratingHint(false)
    }
  }

  // Multi-language Translation
  const translateExplanation = async () => {
    if (!textToTranslate.trim()) {
      toast({
        title: "No Text",
        description: "Please enter text to translate",
        variant: "destructive"
      })
      return
    }

    // Check credits before proceeding
    const studentDbId = studentId || sessionStorage.getItem("studentDatabaseId")
    if (studentDbId) {
      try {
        const creditsResponse = await fetch(`/api/ai-tutor/credits?studentId=${studentDbId}`)
        if (creditsResponse.ok) {
          const creditsData = await creditsResponse.json()
          if (!creditsData.isUnlimited && creditsData.credits < 15) {
            toast({
              title: "Insufficient Credits",
              description: `You need 15 credits for translation. You have ${creditsData.credits} credits remaining.`,
              variant: "destructive"
            })
            return
          }
        }
      } catch (error) {
        console.error("Failed to check credits:", error)
      }
    }

    setTranslating(true)
    setTranslatedText("")

    const languageNames: Record<string, string> = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'zh': 'Chinese',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese'
    }

    try {
      const response = await fetch("/api/ai-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Translate this programming explanation to ${languageNames[selectedLanguage]}. Keep technical terms in English (like 'variable', 'loop', 'function') but explain the concepts in ${languageNames[selectedLanguage]}:\n\n${textToTranslate}`,
          studentId: studentDbId,
          context: { topic: "Translation" }
        })
      })

      const data = await response.json()
      if (response.ok && !data.accessDenied) {
        setTranslatedText(data.response)
        toast({
          title: "Translation Complete!",
          description: `Translated to ${languageNames[selectedLanguage]}`
        })
      } else if (data.accessDenied) {
        toast({
          title: "Access Denied",
          description: data.response || "You don't have access to this feature",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to translate",
        variant: "destructive"
      })
    } finally {
      setTranslating(false)
    }
  }

  const extractIssueCount = (review: string): number => {
    const lines = review.toLowerCase()
    let count = 0
    if (lines.includes('bug') || lines.includes('error')) count++
    if (lines.includes('optimization')) count++
    if (lines.includes('improvement') || lines.includes('suggest')) count++
    return count
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Copied to clipboard!" })
  }

  return (
    <div className="space-y-6">
      {/* Feature Selector */}
      <Tabs value={activeFeature} onValueChange={setActiveFeature}>
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
          <TabsTrigger value="code-review" className="text-xs sm:text-sm">
            <Code className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Review</span>
          </TabsTrigger>
          <TabsTrigger value="test-gen" className="text-xs sm:text-sm">
            <TestTube className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Tests</span>
          </TabsTrigger>
          <TabsTrigger value="diagram" className="text-xs sm:text-sm">
            <GitBranch className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Diagram</span>
          </TabsTrigger>
          <TabsTrigger value="assignment" className="text-xs sm:text-sm">
            <HelpCircle className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Hints</span>
          </TabsTrigger>
          <TabsTrigger value="translate" className="text-xs sm:text-sm">
            <Languages className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Translate</span>
          </TabsTrigger>
          <TabsTrigger value="video" className="text-xs sm:text-sm">
            <Video className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Video</span>
          </TabsTrigger>
          <TabsTrigger value="live-debug" className="text-xs sm:text-sm">
            <Monitor className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Live</span>
          </TabsTrigger>
        </TabsList>

        {/* Code Review Tab */}
        <TabsContent value="code-review" className="space-y-4">
          <Card className="border-2 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="w-5 h-5 text-blue-600" />
                AI Code Review
              </CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Get optimization suggestions, bug detection, and best practice recommendations
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Paste your C++ code here for AI review..."
                className="font-mono min-h-[300px] bg-slate-900 text-green-400"
              />
              
              <Button
                onClick={runCodeReview}
                disabled={reviewing || !codeInput.trim()}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
              >
                {reviewing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing Code...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Review My Code
                  </>
                )}
              </Button>

              {reviewResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold">Review Complete</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(reviewResult.review)}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                  </div>

                  <Card className="bg-white dark:bg-slate-900">
                    <CardContent className="p-4 prose prose-sm max-w-none dark:prose-invert">
                      <div className="whitespace-pre-wrap">{reviewResult.review}</div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Generator Tab */}
        <TabsContent value="test-gen" className="space-y-4">
          <Card className="border-2 border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="w-5 h-5 text-green-600" />
                Unit Test Generator
              </CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                AI creates comprehensive test cases for your functions
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={testCode}
                onChange={(e) => setTestCode(e.target.value)}
                placeholder="Paste your function(s) here..."
                className="font-mono min-h-[200px] bg-slate-900 text-green-400"
              />
              
              <Button
                onClick={generateTests}
                disabled={generatingTests || !testCode.trim()}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600"
              >
                {generatingTests ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Tests...
                  </>
                ) : (
                  <>
                    <TestTube className="w-4 h-4 mr-2" />
                    Generate Unit Tests
                  </>
                )}
              </Button>

              {generatedTests && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <Badge className="bg-green-600">Tests Generated</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generatedTests)}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy Tests
                    </Button>
                  </div>

                  <Card className="bg-white dark:bg-slate-900">
                    <CardContent className="p-4">
                      <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                        {generatedTests}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Diagram Generator Tab */}
        <TabsContent value="diagram" className="space-y-4">
          <Card className="border-2 border-purple-200 dark:border-purple-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-purple-600" />
                Flowchart & Diagram Generator
              </CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Visualize algorithms, data structures, and program flow
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={diagramPrompt}
                onChange={(e) => setDiagramPrompt(e.target.value)}
                placeholder="Describe what you want to visualize... (e.g., 'bubble sort algorithm', 'linked list structure', 'binary search tree')"
                className="min-h-[120px]"
              />

              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDiagramPrompt("bubble sort algorithm")}
                >
                  Bubble Sort
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDiagramPrompt("binary search tree insertion")}
                >
                  BST Insert
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDiagramPrompt("recursion call stack")}
                >
                  Recursion
                </Button>
              </div>
              
              <Button
                onClick={generateDiagram}
                disabled={generatingDiagram || !diagramPrompt.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
              >
                {generatingDiagram ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Diagram...
                  </>
                ) : (
                  <>
                    <GitBranch className="w-4 h-4 mr-2" />
                    Generate Diagram
                  </>
                )}
              </Button>

              {generatedDiagram && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <Badge className="bg-purple-600">Visual Explanation</Badge>

                  <Card className="bg-slate-900 text-green-400 border-slate-700">
                    <CardContent className="p-6">
                      <pre className="font-mono text-sm whitespace-pre overflow-x-auto">
                        {generatedDiagram}
                      </pre>
                    </CardContent>
                  </Card>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(generatedDiagram)}
                    className="w-full"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy Diagram
                  </Button>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assignment Helper Tab */}
        <TabsContent value="assignment" className="space-y-4">
          <Card className="border-2 border-orange-200 dark:border-orange-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-orange-600" />
                Assignment Helper (Guided Hints)
              </CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Get progressive hints without revealing the solution - academic integrity maintained
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={assignmentQuestion}
                onChange={(e) => setAssignmentQuestion(e.target.value)}
                placeholder="Describe your assignment problem... (e.g., 'Write a function to reverse a string')"
                className="min-h-[150px]"
              />
              
              <div className="flex items-center gap-2">
                <Button
                  onClick={getNextHint}
                  disabled={generatingHint || !assignmentQuestion.trim() || currentHintLevel >= 4}
                  className="flex-1 bg-gradient-to-r from-orange-600 to-red-600"
                >
                  {generatingHint ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Hint...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Get Hint {currentHintLevel + 1}/4
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setHints([])
                    setCurrentHintLevel(0)
                  }}
                  disabled={hints.length === 0}
                >
                  Reset
                </Button>
              </div>

              {hints.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Hints Revealed: {hints.length}/4</Badge>
                    {currentHintLevel >= 4 && (
                      <Badge className="bg-orange-600">All hints used</Badge>
                    )}
                  </div>

                  {hints.map((hint, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/20 dark:to-yellow-950/20 border border-orange-200 dark:border-orange-800">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-2 mb-2">
                            <Badge className="bg-orange-600">Hint {index + 1}</Badge>
                          </div>
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            {hint}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}

              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Academic Integrity:</strong> This tool provides hints to help you learn, not complete solutions. 
                    Always try to solve problems yourself first!
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Translation Tab */}
        <TabsContent value="translate" className="space-y-4">
          <Card className="border-2 border-cyan-200 dark:border-cyan-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="w-5 h-5 text-cyan-600" />
                Multi-Language Explanations
              </CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Get programming concepts explained in your native language
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">🇬🇧 English</SelectItem>
                  <SelectItem value="es">🇪🇸 Spanish</SelectItem>
                  <SelectItem value="fr">🇫🇷 French</SelectItem>
                  <SelectItem value="de">🇩🇪 German</SelectItem>
                  <SelectItem value="zh">🇨🇳 Chinese</SelectItem>
                  <SelectItem value="ar">🇸🇦 Arabic</SelectItem>
                  <SelectItem value="hi">🇮🇳 Hindi</SelectItem>
                  <SelectItem value="pt">🇧🇷 Portuguese</SelectItem>
                  <SelectItem value="ru">🇷🇺 Russian</SelectItem>
                  <SelectItem value="ja">🇯🇵 Japanese</SelectItem>
                </SelectContent>
              </Select>

              <Textarea
                value={textToTranslate}
                onChange={(e) => setTextToTranslate(e.target.value)}
                placeholder="Enter programming concept or explanation to translate..."
                className="min-h-[150px]"
              />
              
              <Button
                onClick={translateExplanation}
                disabled={translating || !textToTranslate.trim()}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600"
              >
                {translating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Translating...
                  </>
                ) : (
                  <>
                    <Languages className="w-4 h-4 mr-2" />
                    Translate
                  </>
                )}
              </Button>

              {translatedText && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/20 dark:to-blue-950/20 border border-cyan-200 dark:border-cyan-800">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <Badge className="bg-cyan-600">Translated</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(translatedText)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                        {translatedText}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Video Explanations Tab */}
        <TabsContent value="video" className="space-y-4">
          <Card className="border-2 border-pink-200 dark:border-pink-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-pink-600" />
                Video Tutorial Generator
              </CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                AI creates video tutorial scripts with timestamps
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 space-y-4">
                <Video className="w-16 h-16 text-pink-500 mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Video Tutorials Coming Soon</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                    AI will generate complete video tutorial scripts with:
                  </p>
                  <ul className="text-sm text-slate-600 dark:text-slate-400 mt-3 space-y-1">
                    <li>✓ Timestamped sections</li>
                    <li>✓ Visual cue suggestions</li>
                    <li>✓ Code demonstration scripts</li>
                    <li>✓ Practice problem integration</li>
                  </ul>
                </div>
                <Badge variant="outline">Feature in Development</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Live Debug Mode Tab */}
        <TabsContent value="live-debug" className="space-y-4">
          <Card className="border-2 border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-red-600" />
                Live Debug Mode
              </CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Real-time coding assistance with AI watching your screen
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 space-y-4">
                <Monitor className="w-16 h-16 text-red-500 mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Live Debug Coming Soon</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                    This advanced feature will allow:
                  </p>
                  <ul className="text-sm text-slate-600 dark:text-slate-400 mt-3 space-y-1">
                    <li>✓ Screen sharing integration</li>
                    <li>✓ Real-time code analysis</li>
                    <li>✓ Live suggestions as you type</li>
                    <li>✓ Collaborative debugging</li>
                  </ul>
                </div>
                <Badge variant="outline">Requires WebRTC Integration</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

