"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { GraduationCap, ArrowLeft, Brain, Users, MessageSquare, TrendingUp } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AdminProfileDropdown } from "@/components/admin-profile-dropdown"

// Mock data for Phase 1
const MOCK_STUDENT_USAGE = [
  {
    id: 1,
    name: "John Doe",
    lastActive: "2 hours ago",
    questions: 15,
    weakTopics: "Arrays, Pointers",
  },
  {
    id: 2,
    name: "Jane Smith",
    lastActive: "5 hours ago",
    questions: 23,
    weakTopics: "Loops, Functions",
  },
  {
    id: 3,
    name: "Bob Johnson",
    lastActive: "1 day ago",
    questions: 8,
    weakTopics: "Classes, Inheritance",
  },
  {
    id: 4,
    name: "Alice Williams",
    lastActive: "3 hours ago",
    questions: 31,
    weakTopics: "Recursion, Data Structures",
  },
]

export default function ManageAITutorPage() {
  const router = useRouter()
  const [adminUsername, setAdminUsername] = useState("")
  const [enableAITutor, setEnableAITutor] = useState(true)
  const [allowCodeDebugging, setAllowCodeDebugging] = useState(true)
  const [allowPracticeGeneration, setAllowPracticeGeneration] = useState(true)

  useEffect(() => {
    const adminId = sessionStorage.getItem("adminId")
    const username = sessionStorage.getItem("adminUsername")

    if (!adminId) {
      router.push("/admin/login")
      return
    }

    setAdminUsername(username || "")
  }, [router])

  return (
    <div className="min-h-screen bg-secondary">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/admin/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <GraduationCap className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-primary">CourseCollab</h1>
            </Link>
            <AdminProfileDropdown />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/dashboard")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="h-8 w-8 text-purple-500" />
            <h2 className="text-3xl font-bold text-foreground">Manage AI Tutor</h2>
          </div>
          <p className="text-muted-foreground">Monitor usage and adjust tutor settings • Admin: {adminUsername}</p>
        </div>

        <Tabs defaultValue="usage" className="space-y-6">
          <TabsList>
            <TabsTrigger value="usage">Student Usage Overview</TabsTrigger>
            <TabsTrigger value="settings">Tutor Settings</TabsTrigger>
            <TabsTrigger value="future">Future Settings</TabsTrigger>
          </TabsList>

          {/* Student Usage Overview Tab */}
          <TabsContent value="usage" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Active Students
                  </CardDescription>
                  <CardTitle className="text-3xl">20</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">Used AI Tutor this week</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Total Questions
                  </CardDescription>
                  <CardTitle className="text-3xl">150</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">Asked this week</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Avg. Questions/Student
                  </CardDescription>
                  <CardTitle className="text-3xl">7.5</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">Per student this week</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Most Common Topic
                  </CardDescription>
                  <CardTitle className="text-xl">Arrays</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">35% of questions</div>
                </CardContent>
              </Card>
            </div>

            {/* Student Usage Table */}
            <Card>
              <CardHeader>
                <CardTitle>Student Activity</CardTitle>
                <CardDescription>Detailed breakdown of student AI Tutor usage</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead className="text-right"># of Questions</TableHead>
                      <TableHead>Weak Topics</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_STUDENT_USAGE.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>{student.lastActive}</TableCell>
                        <TableCell className="text-right">{student.questions}</TableCell>
                        <TableCell className="text-muted-foreground">{student.weakTopics}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tutor Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Tutor Configuration</CardTitle>
                <CardDescription>Control what features are available to students</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enable-tutor" className="text-base">
                      Enable AI Tutor
                    </Label>
                    <p className="text-sm text-muted-foreground">Allow students to access the AI Tutor module</p>
                  </div>
                  <Switch id="enable-tutor" checked={enableAITutor} onCheckedChange={setEnableAITutor} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="code-debugging" className="text-base">
                      Allow Code Debugging Help
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Let students paste code and get debugging assistance
                    </p>
                  </div>
                  <Switch
                    id="code-debugging"
                    checked={allowCodeDebugging}
                    onCheckedChange={setAllowCodeDebugging}
                    disabled={!enableAITutor}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="practice-generation" className="text-base">
                      Allow Practice Generation
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Enable AI to generate practice problems for students
                    </p>
                  </div>
                  <Switch
                    id="practice-generation"
                    checked={allowPracticeGeneration}
                    onCheckedChange={setAllowPracticeGeneration}
                    disabled={!enableAITutor}
                  />
                </div>

                <div className="pt-4">
                  <Button>Save Settings</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Future Settings Tab */}
          <TabsContent value="future" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="opacity-60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Upload Course Materials
                    <span className="text-xs font-normal text-muted-foreground">(Coming Soon)</span>
                  </CardTitle>
                  <CardDescription>Upload lecture notes, slides, and textbook chapters for AI context</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button disabled variant="outline" className="w-full bg-transparent">
                    Upload Materials
                  </Button>
                </CardContent>
              </Card>

              <Card className="opacity-60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Enable Heatmaps
                    <span className="text-xs font-normal text-muted-foreground">(Coming Soon)</span>
                  </CardTitle>
                  <CardDescription>Visualize which topics students struggle with most</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button disabled variant="outline" className="w-full bg-transparent">
                    Configure Heatmaps
                  </Button>
                </CardContent>
              </Card>

              <Card className="opacity-60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Risk Prediction
                    <span className="text-xs font-normal text-muted-foreground">(Coming Soon)</span>
                  </CardTitle>
                  <CardDescription>
                    Identify students at risk of falling behind based on AI interactions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button disabled variant="outline" className="w-full bg-transparent">
                    Setup Predictions
                  </Button>
                </CardContent>
              </Card>

              <Card className="opacity-60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Custom AI Personality
                    <span className="text-xs font-normal text-muted-foreground">(Coming Soon)</span>
                  </CardTitle>
                  <CardDescription>Customize the AI tutor's teaching style and tone</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button disabled variant="outline" className="w-full bg-transparent">
                    Customize Personality
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
