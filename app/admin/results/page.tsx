"use client"

import { ResultsViewer } from "@/components/results-viewer"
import { QuizReviewDashboard } from "@/components/quiz-review-dashboard"
import { GraduationCap, LogOut } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { logoutAdmin } from "@/lib/auth"
import { useState } from "react"

export default function ResultsPage() {
  const handleLogout = () => {
    logoutAdmin()
  }

  const [activeTab, setActiveTab] = useState("reports")

  return (
    <div className="min-h-screen bg-secondary">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <GraduationCap className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-primary">CourseCollab</h1>
            </Link>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-xl grid-cols-2">
            <TabsTrigger value="reports">Quiz Reports</TabsTrigger>
            <TabsTrigger value="review">Quiz Review</TabsTrigger>
          </TabsList>

          <TabsContent value="reports">
            <ResultsViewer />
          </TabsContent>

          <TabsContent value="review">
            <QuizReviewDashboard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
