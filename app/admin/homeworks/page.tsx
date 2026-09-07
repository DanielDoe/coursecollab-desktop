"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, BookOpen, Plus, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminHeader } from "@/components/admin-header"

export default function AdminHomeworksPage() {
  const router = useRouter()
  const [adminId, setAdminId] = useState<string | null>(null)
  const [adminUsername, setAdminUsername] = useState("")

  useEffect(() => {
    const id = sessionStorage.getItem("adminId")
    const username = sessionStorage.getItem("adminUsername")

    if (!id) {
      router.push("/admin/login")
      return
    }

    setAdminId(id)
    setAdminUsername(username || "")
  }, [router])

  if (!adminId) {
    return null
  }

  return (
    <div className="min-h-screen bg-secondary">
      <AdminHeader />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/dashboard")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-foreground">Manage Homeworks</h2>
              <p className="text-muted-foreground">Admin: {adminUsername}</p>
            </div>
          </div>
        </div>

        {/* Coming Soon Section */}
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Main Coming Soon Card */}
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Homework Management Coming Soon</CardTitle>
              <CardDescription className="text-base mt-2">
                Advanced homework management tools will be available here soon. You'll be able to create, assign, and
                grade homework assignments.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Placeholder Action Buttons */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="opacity-60 cursor-not-allowed">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Create Assignment</CardTitle>
                    <CardDescription className="text-sm">Add new homework</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card className="opacity-60 cursor-not-allowed">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Upload className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Upload Problems</CardTitle>
                    <CardDescription className="text-sm">Bulk import questions</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card className="opacity-60 cursor-not-allowed">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">View Submissions</CardTitle>
                    <CardDescription className="text-sm">Grade student work</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>

          {/* Placeholder Table */}
          <Card>
            <CardHeader>
              <CardTitle>Homework Assignments</CardTitle>
              <CardDescription>Manage all homework assignments and track student progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">No homework assignments yet</p>
                <p className="text-sm text-muted-foreground">
                  Homework management features including assignment creation, due dates, and grading tools will be
                  available soon.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Feature Preview */}
          <Card className="bg-accent/5 border-accent/20">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                🚀 <strong>Coming Features:</strong> Create assignments with multiple problems, set due dates,
                auto-grading for objective questions, manual grading interface, and detailed analytics on student
                performance.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
