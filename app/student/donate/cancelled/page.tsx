"use client"

import { motion } from "framer-motion"
import { XCircle, ArrowLeft, Heart } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StudentProfileDropdown } from "@/components/student-profile-dropdown"
import { useSmartHomeLink } from "@/hooks/useSmartHomeLink"
import { GraduationCap } from "lucide-react"

export default function DonationCancelledPage() {
  const router = useRouter()
  const homeLink = useSmartHomeLink()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/20 dark:border-gray-800/50 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={homeLink} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">CourseCollab</h1>
          </Link>
          <StudentProfileDropdown />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto"
        >
          <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
            <CardContent className="p-8 text-center space-y-6">
              <div className="mx-auto w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                <XCircle className="h-12 w-12 text-amber-600" />
              </div>
              
              <div>
                <CardTitle className="text-3xl font-bold mb-2">Donation Cancelled</CardTitle>
                <CardDescription className="text-lg">
                  Your donation was not completed
                </CardDescription>
              </div>

              <p className="text-slate-600 dark:text-slate-300">
                No worries! You can try again anytime. Donations are completely voluntary and not required to use CourseCollab.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button onClick={() => router.push("/student/donate")} className="flex-1">
                  <Heart className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Button onClick={() => router.push(homeLink)} variant="outline" className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  )
}

