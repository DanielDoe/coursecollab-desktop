"use client"
import { CreateQuizFromBank } from "@/components/create-quiz-from-bank"
import { GraduationCap, LogOut } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { logoutAdmin } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default function CreateQuizFromBankPage() {
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
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto space-y-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Create Quiz from Question Bank</h1>
            <p className="text-muted-foreground mt-1">Select questions from your bank to create a new quiz</p>
          </div>
          <Link href="/admin/dashboard">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>
        <CreateQuizFromBank />
      </div>
    </div>
  )
}
