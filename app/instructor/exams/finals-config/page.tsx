"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import {
  Loader2,
  Play,
  Eye,
  Settings,
  BarChart3,
  Shield,
  Clock,
  FileText,
  Code,
  CheckCircle2,
  AlertCircle,
  Sparkles
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useSessionCatalog } from "@/components/session-catalog-provider"

export default function FinalsConfigPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { codes, selectOptions } = useSessionCatalog()
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [examName, setExamName] = useState("Spring 2025 Final Exam")
  const [availableFrom, setAvailableFrom] = useState("")
  const [availableUntil, setAvailableUntil] = useState("")
  const [selectedSessions, setSelectedSessions] = useState<string[]>([])
  const [previewData, setPreviewData] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [instructorId, setInstructorId] = useState<string | null>(null)
  const selectedSessionsInitRef = useRef(false)

  useEffect(() => {
    if (!codes.length || selectedSessionsInitRef.current) return
    selectedSessionsInitRef.current = true
    setSelectedSessions([...codes])
  }, [codes])

  useEffect(() => {
    // Get instructor ID from localStorage (same way as quiz management)
    const instructorIdFromStorage = localStorage.getItem("instructorId")
    if (instructorIdFromStorage) {
      setInstructorId(instructorIdFromStorage)
    } else {
      // Fallback: try to get from instructorSession
      const instructorSession = localStorage.getItem("instructorSession")
      if (instructorSession) {
        try {
          const session = JSON.parse(instructorSession)
          setInstructorId(session.id || session.instructorId || "1")
        } catch {
          setInstructorId("1")
        }
      } else {
        setInstructorId("1")
      }
    }
  }, [])

  const handleGenerateExam = async (testMode = false) => {
    if (!instructorId) {
      toast({
        title: "Error",
        description: "Instructor ID not found. Please log in again.",
        variant: "destructive"
      })
      return
    }

    setGenerating(true)
    try {
      const response = await instructorApiFetch("/api/instructor/exams/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          instructorId,
          examName,
          testMode,
          sessionCodes: selectedSessions,
          availableFrom: availableFrom || undefined,
          availableUntil: availableUntil || undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate exam")
      }

      if (testMode) {
        setPreviewData(data)
        setShowPreview(true)
        toast({
          title: "Preview Generated",
          description: `Test generation successful. ${data.summary.totalQuestions} questions, ${data.summary.totalPoints} points.`,
        })
      } else {
        toast({
          title: "Exam Generated Successfully",
          description: `Final exam created with ${data.summary.totalQuestions} questions (${data.summary.totalPoints} points).`,
        })
        router.push(`/instructor/quizzes?assessment_type=final`)
      }
    } catch (error: any) {
      console.error("Error generating exam:", error)
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate exam. Please try again.",
        variant: "destructive"
      })
    } finally {
      setGenerating(false)
    }
  }

  const toggleSession = (session: string) => {
    setSelectedSessions(prev =>
      prev.includes(session)
        ? prev.filter(s => s !== session)
        : [...prev, session]
    )
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-1.5 sm:gap-2 break-words">
            <FileText className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 shrink-0" />
            <span className="sm:hidden">Final Generator</span>
            <span className="hidden sm:inline">Final Exam Generator</span>
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1 sm:mt-2 break-words">
            <span className="sm:hidden">Generate exams from Question Bank</span>
            <span className="hidden sm:inline">Automatically generate final exams from the Question Bank</span>
          </p>
        </div>
      </div>

      <Tabs defaultValue="generate" className="space-y-4 sm:space-y-6">
        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:flex h-auto">
          <TabsTrigger value="generate" className="text-xs sm:text-sm px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-md">
            <span className="sm:hidden">Generate</span>
            <span className="hidden sm:inline">Generate Exam</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs sm:text-sm px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-md">
            Settings
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs sm:text-sm px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-md">
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4 sm:space-y-6">
          <Card className="rounded-xl sm:rounded-2xl overflow-hidden">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg md:text-xl break-words">Exam Configuration</CardTitle>
              <CardDescription className="text-xs sm:text-sm break-words mt-0.5 sm:mt-1">
                Configure your final exam settings and generate the exam
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0">
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="examName" className="text-xs sm:text-sm break-words">Exam Name</Label>
                <Input
                  id="examName"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="Spring 2025 Final Exam"
                  className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="availableFrom" className="text-xs sm:text-sm break-words">Available From</Label>
                  <Input
                    id="availableFrom"
                    type="datetime-local"
                    value={availableFrom}
                    onChange={(e) => setAvailableFrom(e.target.value)}
                    className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="availableUntil" className="text-xs sm:text-sm break-words">Available Until</Label>
                  <Input
                    id="availableUntil"
                    type="datetime-local"
                    value={availableUntil}
                    onChange={(e) => setAvailableUntil(e.target.value)}
                    className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm break-words">Assign to Sessions</Label>
                <div className="flex gap-2 flex-wrap">
                  {selectOptions.map(({ value: session, label }) => (
                    <Button
                      key={session}
                      variant={selectedSessions.includes(session) ? "default" : "outline"}
                      onClick={() => toggleSession(session)}
                      size="sm"
                      className="text-xs sm:text-sm h-9 sm:h-8 min-h-[44px] sm:min-h-0 rounded-lg sm:rounded-xl"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 sm:pt-6 space-y-3 sm:space-y-4">
                <h3 className="font-semibold flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base break-words">
                  <Shield className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                  <span className="break-words">Anti-Cheat Configuration</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div className="flex items-center justify-between">
                    <span className="break-words">Shuffle Questions</span>
                    <Badge variant="outline" className="text-xs sm:text-sm shrink-0">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="break-words">Shuffle Options</span>
                    <Badge variant="outline" className="text-xs sm:text-sm shrink-0">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="break-words">Disable Copy/Paste</span>
                    <Badge variant="outline" className="text-xs sm:text-sm shrink-0">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="break-words">Fullscreen Required</span>
                    <Badge variant="outline" className="text-xs sm:text-sm shrink-0">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="break-words">Tab Change Detection</span>
                    <Badge variant="outline" className="text-xs sm:text-sm shrink-0">Max 5 changes</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="break-words">Auto-Save</span>
                    <Badge variant="outline" className="text-xs sm:text-sm shrink-0">Every 30s</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="break-words">Right-Click Block</span>
                    <Badge variant="outline" className="text-xs sm:text-sm shrink-0">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="break-words">Heartbeat Tracking</span>
                    <Badge variant="outline" className="text-xs sm:text-sm shrink-0">Every 10s</Badge>
                  </div>
                  <div className="flex items-center justify-between sm:col-span-2">
                    <span className="break-words">MATLAB Exception</span>
                    <Badge variant="outline" className="text-xs sm:text-sm shrink-0">Auto-disabled</Badge>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 pt-3 sm:pt-4">
                <Button
                  onClick={() => handleGenerateExam(true)}
                  disabled={generating}
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0"
                >
                  {generating ? (
                    <Loader2 className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                  ) : (
                    <Eye className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  )}
                  <span className="sm:hidden">Preview</span>
                  <span className="hidden sm:inline">Preview Exam</span>
                </Button>
                <Button
                  onClick={() => handleGenerateExam(false)}
                  disabled={generating}
                  size="sm"
                  className="flex-1 rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0"
                >
                  {generating ? (
                    <Loader2 className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  )}
                  <span className="sm:hidden">Generate</span>
                  <span className="hidden sm:inline">Generate & Deploy</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl sm:rounded-2xl overflow-hidden">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg md:text-xl break-words">Exam Specifications</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="text-center p-3 sm:p-4 bg-muted rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold break-words">23</div>
                  <div className="text-xs sm:text-sm text-muted-foreground break-words">
                    <span className="sm:hidden">Questions</span>
                    <span className="hidden sm:inline">Total Questions</span>
                  </div>
                </div>
                <div className="text-center p-3 sm:p-4 bg-muted rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold break-words">100</div>
                  <div className="text-xs sm:text-sm text-muted-foreground break-words">
                    <span className="sm:hidden">Points</span>
                    <span className="hidden sm:inline">Total Points</span>
                  </div>
                </div>
                <div className="text-center p-3 sm:p-4 bg-muted rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold break-words">60</div>
                  <div className="text-xs sm:text-sm text-muted-foreground break-words">Minutes</div>
                </div>
              </div>

              <div className="mt-4 sm:mt-6 space-y-2 sm:space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs sm:text-sm md:text-base break-words">MCQ / True-False / Select-All</div>
                    <div className="text-xs sm:text-sm text-muted-foreground break-words">15 questions</div>
                  </div>
                  <Badge className="text-xs sm:text-sm shrink-0 w-fit mt-2 sm:mt-0">60 pts</Badge>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs sm:text-sm md:text-base break-words">C++ Code-Write</div>
                    <div className="text-xs sm:text-sm text-muted-foreground break-words">6 questions (5 min each)</div>
                  </div>
                  <Badge className="text-xs sm:text-sm shrink-0 w-fit mt-2 sm:mt-0">30 pts</Badge>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs sm:text-sm md:text-base break-words">MATLAB Code-Write with Plots</div>
                    <div className="text-xs sm:text-sm text-muted-foreground break-words">2 questions (5 min each)</div>
                  </div>
                  <Badge className="text-xs sm:text-sm shrink-0 w-fit mt-2 sm:mt-0">10 pts</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="rounded-xl sm:rounded-2xl overflow-hidden">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg md:text-xl break-words">Difficulty Weighting</CardTitle>
              <CardDescription className="text-xs sm:text-sm break-words mt-0.5 sm:mt-1">
                Adjust the difficulty distribution for question selection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm break-words">Easy Questions</Label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <Input type="number" defaultValue={20} min={0} max={100} className="w-full sm:w-24 h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl" />
                  <span className="text-xs sm:text-sm text-muted-foreground break-words">% (3 points each)</span>
                </div>
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm break-words">Medium Questions</Label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <Input type="number" defaultValue={50} min={0} max={100} className="w-full sm:w-24 h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl" />
                  <span className="text-xs sm:text-sm text-muted-foreground break-words">% (4 points each)</span>
                </div>
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm break-words">Hard Questions</Label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <Input type="number" defaultValue={30} min={0} max={100} className="w-full sm:w-24 h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl" />
                  <span className="text-xs sm:text-sm text-muted-foreground break-words">% (5 points each)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card className="rounded-xl sm:rounded-2xl overflow-hidden">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg md:text-xl break-words">Exam Analytics</CardTitle>
              <CardDescription className="text-xs sm:text-sm break-words mt-0.5 sm:mt-1">
                View performance metrics for generated exams
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <p className="text-xs sm:text-sm text-muted-foreground break-words">Analytics will be available after exams are taken.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl sm:rounded-2xl">
          <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <DialogTitle className="text-base sm:text-lg md:text-xl break-words">Exam Preview</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm break-words">
              Review the generated exam before deploying
            </DialogDescription>
          </DialogHeader>
          {previewData && (
            <div className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="text-center p-3 sm:p-4 bg-muted rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold break-words">{previewData.summary.totalQuestions}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground break-words">Questions</div>
                </div>
                <div className="text-center p-3 sm:p-4 bg-muted rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold break-words">{previewData.summary.totalPoints}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground break-words">Points</div>
                </div>
                <div className="text-center p-3 sm:p-4 bg-muted rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold break-words">{previewData.summary.totalTimeMinutes}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground break-words">Minutes</div>
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <h4 className="font-semibold text-sm sm:text-base break-words">Question Breakdown</h4>
                <div className="space-y-1 text-xs sm:text-sm">
                  <div className="break-words">MCQ/True-False: {previewData.summary.mcqCount} questions</div>
                  <div className="break-words">C++ Code-Write: {previewData.summary.cppCount} questions</div>
                  <div className="break-words">MATLAB Code-Write: {previewData.summary.matlabCount} questions</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 pt-3 sm:pt-4">
                <Button
                  onClick={() => {
                    setShowPreview(false)
                    handleGenerateExam(false)
                  }}
                  size="sm"
                  className="flex-1 rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0"
                >
                  <span className="sm:hidden">Deploy</span>
                  <span className="hidden sm:inline">Deploy This Exam</span>
                </Button>
                <Button
                  onClick={() => setShowPreview(false)}
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

