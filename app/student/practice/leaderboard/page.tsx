"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "@/hooks/use-toast"
import { GamifiedLeaderboard } from "@/components/gamified-leaderboard"

export default function PracticeLeaderboardPage() {
  const router = useRouter()
  const [studentId, setStudentId] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const studentIdHeader = localStorage.getItem("studentId")
    if (!studentIdHeader) {
      router.push("/student/login")
      return
    }
    setStudentId(studentIdHeader)
    setLoading(false)
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading leaderboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/student/practice")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Practice
          </Button>
          
          <Button
            variant="outline"
            onClick={fetchLeaderboard}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Page Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Practice Leaderboard
          </h1>
          <p className="text-muted-foreground text-lg">
            Compete with your peers and climb the ranks!
          </p>
        </motion.div>

        {/* Gamified Leaderboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <GamifiedLeaderboard studentId={studentId} />
        </motion.div>
      </div>
    </div>
  )
}
