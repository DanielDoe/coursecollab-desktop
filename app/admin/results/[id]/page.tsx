"use client"

import { QuizResults } from "@/components/quiz-results"
import { GraduationCap, LogOut, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { logoutAdmin } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function AdminViewResultPage({ params }: { params: { id: string } }) {
  const router = useRouter()

  useEffect(() => {
    const adminId = sessionStorage.getItem("adminId")
    if (!adminId) {
      router.push("/admin/login")
    }
  }, [router])

  const handleLogout = () => {
    logoutAdmin()
  }

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
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => router.push("/admin/results")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Results
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-foreground">Student Quiz Report (Admin View)</h2>
          <p className="text-muted-foreground">Viewing student's quiz results</p>
        </div>
        <QuizResults attemptId={params.id} isAdminView={true} userType="admin" />
      </main>
    </div>
  )
}
