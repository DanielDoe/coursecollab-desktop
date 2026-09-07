"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { CheckCircle, Heart, Sparkles, ArrowLeft, Crown, Zap, BookOpen, Trophy } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StudentProfileDropdown } from "@/components/student-profile-dropdown"
import { useSmartHomeLink } from "@/hooks/useSmartHomeLink"
import { useToast } from "@/components/ui/use-toast"
import { GraduationCap } from "lucide-react"

export default function DonationSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const homeLink = useSmartHomeLink()
  const { toast } = useToast()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isNavigating, setIsNavigating] = useState(false)
  const [donationVerified, setDonationVerified] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [returnPath, setReturnPath] = useState<string | null>(null)

  useEffect(() => {
    // Check for return path from retake modal
    const storedReturnPath = sessionStorage.getItem("retakeModalReturnPath")
    if (storedReturnPath) {
      setReturnPath(storedReturnPath)
    }
    
    // Ensure session is maintained - check both sessionStorage and localStorage
    const studentId = sessionStorage.getItem("studentDatabaseId") || localStorage.getItem("studentDatabaseId")
    
    // Restore session if needed (e.g., after Stripe redirect)
    if (!studentId) {
      // Try to restore from localStorage backup
      const backupStudentId = localStorage.getItem("studentDatabaseId")
      const backupSection = localStorage.getItem("studentSection")
      
      if (backupStudentId && backupSection) {
        sessionStorage.setItem("studentDatabaseId", backupStudentId)
        sessionStorage.setItem("studentSection", backupSection)
      } else {
        // If no session at all, redirect to login but preserve the success state
        const session = searchParams.get("session_id")
        if (session) {
          sessionStorage.setItem("donationSuccessSession", session)
          router.push(`/student/login?redirect=/student/donate/success?session_id=${session}`)
          return
        }
      }
    }

    const session = searchParams.get("session_id")
    if (session) {
      setSessionId(session)
      
      // Verify donation payment and poll until confirmed
      const verifyDonation = async () => {
        const currentStudentId = sessionStorage.getItem("studentDatabaseId") || localStorage.getItem("studentDatabaseId")
        if (!currentStudentId || !session) {
          return
        }

        setIsVerifying(true)
        
        // Poll for donation status - check multiple times as webhook might be delayed
        let attempts = 0
        const maxAttempts = 10 // Check for up to 30 seconds (10 attempts * 3 seconds)
        
        const checkDonationStatus = async (): Promise<boolean> => {
          try {
            // First, sync pending donations to check if webhook already processed it
            await fetch('/api/donations/sync-pending', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                studentId: currentStudentId,
                transactionId: session,
              }),
            })
            
            // Then check the status
            const response = await fetch(`/api/donations/check-status?transaction_id=${session}&student_id=${currentStudentId}`)
            const data = await response.json()
            
            console.log('[Donation Success] Status check result:', data)
            
            if (data.found && data.status === 'completed') {
              setDonationVerified(true)
              setIsVerifying(false)
              console.log('[Donation Success] ✅ Donation confirmed and updated to completed')
              
              // Refresh membership data to ensure access is immediately available
              await refreshMembershipData(currentStudentId)
              
              toast({
                title: "💜 Thank You!",
                description: "Your donation has been confirmed and processed successfully!",
              })
              return true
            } else if (data.found && data.verified && data.updated) {
              setDonationVerified(true)
              setIsVerifying(false)
              console.log('[Donation Success] ✅ Donation verified and updated to completed')
              
              // Refresh membership data to ensure access is immediately available
              await refreshMembershipData(currentStudentId)
              
              toast({
                title: "💜 Thank You!",
                description: "Your donation has been confirmed and processed successfully!",
              })
              return true
            } else if (data.found && data.status === 'pending') {
              // Still pending, will check again
              console.log(`[Donation Success] ⏳ Donation still pending (attempt ${attempts + 1}/${maxAttempts})`)
              return false
            } else {
              // Not found or error - show success anyway
              setDonationVerified(true)
              setIsVerifying(false)
              toast({
                title: "💜 Thank You!",
                description: "Thank you for supporting CourseCollab Development!",
              })
              return true
            }
          } catch (error) {
            console.error('[Donation Success] Failed to check donation status:', error)
            return false
          }
        }
        
        // Initial check after 2 seconds (give webhook time to process)
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Poll until confirmed or max attempts reached
        while (attempts < maxAttempts) {
          const confirmed = await checkDonationStatus()
          if (confirmed) {
            return
          }
          
          attempts++
          if (attempts < maxAttempts) {
            // Wait 3 seconds before next check
            await new Promise(resolve => setTimeout(resolve, 3000))
          }
        }
        
        // Max attempts reached - show success message anyway
        setIsVerifying(false)
        setDonationVerified(true)
        toast({
          title: "💜 Thank You!",
          description: "Your payment is being processed. The donation will be confirmed shortly.",
        })
        console.log('[Donation Success] Max attempts reached - donation may be confirmed later via webhook')
      }

      verifyDonation()
    }
  }, [searchParams, toast, router])

  // Function to refresh membership data from API
  const refreshMembershipData = async (studentId: string) => {
    try {
      const response = await studentApiFetch(`/api/student/membership/refresh?studentId=${studentId}`)
      if (response.ok) {
        const data = await response.json()
        // Update sessionStorage with latest tier (even though donation doesn't change tier, it grants access)
        // The APIs check hasActiveDonationTrial directly, so access will work immediately
        // But we can update sessionStorage for consistency
        if (data.tier) {
          sessionStorage.setItem("studentMembershipTier", data.tier)
          localStorage.setItem("studentMembershipTier", data.tier)
        }
        console.log('[Donation Success] ✅ Membership data refreshed')
      }
    } catch (error) {
      console.error('[Donation Success] Failed to refresh membership data:', error)
    }
  }

  const handleBackToAssessment = () => {
    if (returnPath) {
      setIsNavigating(true)
      // Clear the return path from storage
      sessionStorage.removeItem("retakeModalReturnPath")
      // Use window.location to ensure full page navigation and refresh retake access
      window.location.href = returnPath
    } else {
      handleBackToDashboard()
    }
  }

  const handleBackToDashboard = () => {
    setIsNavigating(true)
    // Clear the return path from storage
    sessionStorage.removeItem("retakeModalReturnPath")
    // Use window.location to ensure full page navigation and maintain session
    window.location.href = homeLink || "/student/dashboard"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/20 dark:border-gray-800/50 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={homeLink || "/student/dashboard"} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
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
              <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-r from-purple-500 to-pink-600 flex items-center justify-center">
                <Heart className="h-12 w-12 text-white" />
              </div>
              
              <div>
                <CardTitle className="text-3xl font-bold mb-2">Thank You for Your Support! 💜</CardTitle>
                <CardDescription className="text-lg">
                  Your generous donation helps us continue building amazing features for students
                </CardDescription>
              </div>

              <div className="flex items-center justify-center gap-2 text-purple-600 dark:text-purple-400">
                <Sparkles className="h-5 w-5" />
                <p className="font-semibold">We truly appreciate your generosity!</p>
                <Sparkles className="h-5 w-5" />
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 p-6 rounded-lg text-left space-y-3 border border-purple-200 dark:border-purple-800">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Crown className="h-5 w-5 text-purple-600" />
                  Perks You Can Enjoy:
                </h3>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span><strong>Supporter Badge</strong> - Show your support with a special 💜 badge on your profile</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span><strong>14-Day Trailblazer Trial</strong> - Enjoy premium features including unlimited quiz attempts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span><strong>Unlimited Quiz Attempts</strong> - Take quizzes, homeworks, mid-semester, and final exams multiple times</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span><strong>AI Tutor Access</strong> - Get instant help with unlimited questions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span><strong>7 Playground Credits</strong> - Extra credits to use Playground for practice sessions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span><strong>CodeBench IDE</strong> - Practice coding in our integrated development environment</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span><strong>Early Access</strong> - Get early access to new features</span>
                  </li>
                </ul>
              </div>

              {isVerifying && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Verifying your donation... This may take a few moments.
                    </p>
                  </div>
                </div>
              )}

              {donationVerified && !isVerifying && (
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <p className="text-sm text-green-800 dark:text-green-200 font-semibold">
                      ✅ Donation confirmed! Your perks are now active.
                    </p>
                  </div>
                  {returnPath && (
                    <p className="text-xs text-green-700 dark:text-green-300 ml-8">
                      You can now retake assessments! Click "Back to Assessment" below to continue.
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                {returnPath ? (
                  <Button 
                    onClick={handleBackToAssessment} 
                    className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                    disabled={isNavigating || isVerifying}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {isNavigating ? "Loading..." : "Back to Assessment"}
                  </Button>
                ) : (
                  <Button 
                    onClick={handleBackToDashboard} 
                    className="flex-1"
                    disabled={isNavigating || isVerifying}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {isNavigating ? "Loading..." : "Back to Dashboard"}
                  </Button>
                )}
                <Button 
                  onClick={() => router.push("/student/donate")} 
                  variant="outline" 
                  className="flex-1"
                  disabled={isVerifying}
                >
                  <Heart className="mr-2 h-4 w-4" />
                  Donate Again
                </Button>
              </div>

              {sessionId && (
                <p className="text-xs text-muted-foreground">
                  Transaction ID: {sessionId}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  )
}

