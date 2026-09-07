"use client"


import { studentApiFetch } from "@/lib/auth"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  Heart,
  Coffee,
  Github,
  ExternalLink,
  ArrowLeft,
  GraduationCap,
  Sparkles,
  Code,
  Users,
  Zap,
  Shield,
  Gift,
  CheckCircle,
  User,
  EyeOff,
  UserCircle,
} from "lucide-react"
import Link from "next/link"
import { StudentProfileDropdown } from "@/components/student-profile-dropdown"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/components/ui/use-toast"
import { useSmartHomeLink } from "@/hooks/useSmartHomeLink"
import { Separator } from "@/components/ui/separator"
import { MembershipDisclaimer } from "@/components/governance/MembershipDisclaimer"

function DonatePageContent() {
  const router = useRouter()
  const homeLink = useSmartHomeLink()
  const { toast } = useToast()
  
  const [amount, setAmount] = useState("")
  const [donationMode, setDonationMode] = useState<"self" | "anonymous" | "other">("self")
  const [donorName, setDonorName] = useState("")
  const [donorEmail, setDonorEmail] = useState("")
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [studentProfile, setStudentProfile] = useState<{ full_name: string; email: string } | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)

  const presetAmounts = [5, 10, 25, 50, 100] // Minimum donation is $5

  // Fetch student profile on mount
  useEffect(() => {
    const fetchStudentProfile = async () => {
      try {
        let studentId = sessionStorage.getItem("studentDatabaseId")
        if (!studentId) {
          studentId = localStorage.getItem("studentDatabaseId")
          if (studentId) {
            sessionStorage.setItem("studentDatabaseId", studentId)
          }
        }

        if (studentId) {
          const response = await studentApiFetch(`/api/student/profile?studentId=${studentId}`)
          if (response.ok) {
            const data = await response.json()
            if (data.student) {
              setStudentProfile(data.student)
              // Auto-populate if donating as self
              if (donationMode === "self") {
                setDonorName(data.student.full_name || "")
                setDonorEmail(data.student.email || "")
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch student profile:", error)
      } finally {
        setLoadingProfile(false)
      }
    }

    fetchStudentProfile()
  }, [])

  // Update donor info when mode changes
  useEffect(() => {
    if (donationMode === "self" && studentProfile) {
      setDonorName(studentProfile.full_name || "")
      setDonorEmail(studentProfile.email || "")
    } else if (donationMode === "anonymous") {
      setDonorName("")
      setDonorEmail("")
    } else if (donationMode === "other") {
      setDonorName("")
      setDonorEmail("")
    }
  }, [donationMode, studentProfile])

  const handleDonate = async () => {
    console.log("[Donate] Button clicked", { amount, donationMode, donorName })
    
    if (!amount) {
      console.log("[Donate] No amount selected")
      toast({
        title: "Amount Required",
        description: "Please select a donation amount (minimum $5)",
        variant: "destructive",
      })
      return
    }

    const donationAmount = parseFloat(amount)
    
    if (isNaN(donationAmount) || donationAmount < 5) {
      console.log("[Donate] Invalid amount:", donationAmount)
      toast({
        title: "Minimum Donation Required",
        description: "Please select a donation amount of at least $5 to activate all perks",
        variant: "destructive",
      })
      return
    }

    // Validate based on donation mode
    if (donationMode === "other" && !donorName.trim()) {
      console.log("[Donate] Missing donor name for 'other' mode")
      toast({
        title: "Name Required",
        description: "Please enter the donor's name",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    console.log("[Donate] Starting donation process", { donationAmount, donationMode })
    
    try {
      // Get student ID from sessionStorage or localStorage (backup)
      let studentId = sessionStorage.getItem("studentDatabaseId")
      if (!studentId) {
        studentId = localStorage.getItem("studentDatabaseId")
        // Restore to sessionStorage if found in localStorage
        if (studentId) {
          sessionStorage.setItem("studentDatabaseId", studentId)
          const section = localStorage.getItem("studentSection")
          if (section) {
            sessionStorage.setItem("studentSection", section)
          }
        }
      }
      
      // Also backup to localStorage before redirect
      if (studentId) {
        localStorage.setItem("studentDatabaseId", studentId)
        const section = sessionStorage.getItem("studentSection")
        if (section) {
          localStorage.setItem("studentSection", section)
        }
      }
      
      console.log("[Donate] Calling API with:", {
        amount: donationAmount,
        donorName: donationMode === "anonymous" ? "Anonymous" : (donorName || studentProfile?.full_name || "Anonymous"),
        email: donationMode === "anonymous" ? null : (donorEmail || studentProfile?.email || null),
        studentId: studentId ? parseInt(studentId) : null,
        isAnonymous: donationMode === "anonymous",
      })

      const response = await fetch("/api/create-donation-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: donationAmount,
          donorName: donationMode === "anonymous" ? "Anonymous" : (donorName || studentProfile?.full_name || "Anonymous"),
          email: donationMode === "anonymous" ? null : (donorEmail || studentProfile?.email || null),
          message: message || null,
          studentId: studentId ? parseInt(studentId) : null,
          isAnonymous: donationMode === "anonymous",
        }),
      })

      console.log("[Donate] API response status:", response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        console.error("[Donate] API error:", errorData)
        throw new Error(errorData.error || `Failed to create donation session (${response.status})`)
      }

      const data = await response.json()
      console.log("[Donate] API response data:", data)

      // Redirect to Stripe Checkout
      if (data.url) {
        console.log("[Donate] Redirecting to Stripe:", data.url)
        window.location.href = data.url
      } else {
        console.error("[Donate] No URL in response:", data)
        throw new Error("No checkout URL received from server")
      }
    } catch (error: any) {
      console.error("[Donate] Failed to process donation:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to process donation. Please try again.",
        variant: "destructive",
      })
      setIsSubmitting(false)
    }
  }

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
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-end mb-6">
          <Button variant="ghost" onClick={() => router.push(homeLink)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 text-white"
          >
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Heart className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                        Support CourseCollab Development
                      </h1>
                      <p className="text-blue-100 text-lg">
                        An open-source project built to help students succeed
                      </p>
                    </div>
                  </div>
                </div>
                <div className="hidden lg:block">
                  <div className="w-32 h-32 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                    <Code className="h-16 w-16 text-white/80" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* About Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                  <Github className="h-6 w-6 text-indigo-600" />
                  Open-Source & Community-Driven
                </CardTitle>
                <CardDescription className="text-base">
                  CourseCollab is an open-source educational platform created to help students excel in their courses.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                        <Code className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800 dark:text-white mb-1">Open-Source</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          CourseCollab is built as an open-source project. The code is freely available and contributions are welcome.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                        <Users className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800 dark:text-white mb-1">Student-Focused</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          Created specifically to help students succeed in their courses with tools for learning, practice, and collaboration.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                        <Zap className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800 dark:text-white mb-1">Voluntary Support</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          Donations are completely optional and not required to use CourseCollab. All features remain free and accessible.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                        <Shield className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800 dark:text-white mb-1">Transparent</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          All donations go directly to maintaining and improving the platform. Your support helps keep CourseCollab running.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Donation Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/10">
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                  <Coffee className="h-6 w-6 text-green-600" />
                  Make a Donation
                </CardTitle>
                <CardDescription>
                  Your contribution helps maintain and improve CourseCollab for all students
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <MembershipDisclaimer />
                {/* Amount Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Donation Amount</Label>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Minimum $5 to activate perks</span>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {presetAmounts.map((preset) => (
                      <Button
                        key={preset}
                        variant={amount === preset.toString() ? "default" : "outline"}
                        onClick={() => {
                          setAmount(preset.toString())
                        }}
                        className={`rounded-xl ${
                          amount === preset.toString()
                            ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
                            : ""
                        }`}
                      >
                        ${preset}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    * Minimum donation of $5 USD required to activate all premium perks (14-day Trailblazer access)
                  </p>
                </div>

                <Separator />

                {/* Donation Mode Selection */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Donation Information</Label>
                  <RadioGroup value={donationMode} onValueChange={(value: "self" | "anonymous" | "other") => setDonationMode(value)} className="space-y-3">
                    <div className="flex items-start space-x-3 p-4 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                      <RadioGroupItem value="self" id="self" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="self" className="cursor-pointer flex items-center gap-2 font-medium">
                          <User className="h-4 w-4" />
                          Donate as myself
                        </Label>
                        <p className="text-sm text-slate-500 mt-1">
                          Use your student profile information ({studentProfile?.full_name || "your name"})
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-4 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                      <RadioGroupItem value="anonymous" id="anonymous" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="anonymous" className="cursor-pointer flex items-center gap-2 font-medium">
                          <EyeOff className="h-4 w-4" />
                          Donate anonymously
                        </Label>
                        <p className="text-sm text-slate-500 mt-1">
                          Your donation will be recorded anonymously
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-4 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                      <RadioGroupItem value="other" id="other" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="other" className="cursor-pointer flex items-center gap-2 font-medium">
                          <UserCircle className="h-4 w-4" />
                          Donate on behalf of someone else
                        </Label>
                        <p className="text-sm text-slate-500 mt-1">
                          Enter different name and email for this donation
                        </p>
                      </div>
                    </div>
                  </RadioGroup>

                  {/* Donor Information Fields */}
                  {donationMode === "self" && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
                      <div className="space-y-2">
                        <div>
                          <Label className="text-sm font-medium text-blue-900 dark:text-blue-100">Name</Label>
                          <p className="text-sm text-blue-700 dark:text-blue-300">{studentProfile?.full_name || "Loading..."}</p>
                        </div>
                        {studentProfile?.email && (
                          <div>
                            <Label className="text-sm font-medium text-blue-900 dark:text-blue-100">Email</Label>
                            <p className="text-sm text-blue-700 dark:text-blue-300">{studentProfile.email}</p>
                          </div>
                        )}
                        {!studentProfile?.email && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 italic">
                            No email in your profile. Email will not be included with this donation.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {donationMode === "other" && (
                    <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border">
                      <div>
                        <Label htmlFor="donorName">Donor Name *</Label>
                        <Input
                          id="donorName"
                          placeholder="Enter donor's name"
                          value={donorName}
                          onChange={(e) => setDonorName(e.target.value)}
                          className="rounded-xl"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="donorEmail">Donor Email (Optional)</Label>
                        <Input
                          id="donorEmail"
                          type="email"
                          placeholder="donor.email@example.com"
                          value={donorEmail}
                          onChange={(e) => setDonorEmail(e.target.value)}
                          className="rounded-xl"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Used to send a thank you message (if provided)
                        </p>
                      </div>
                    </div>
                  )}

                  {donationMode === "anonymous" && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                      <p className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                        <EyeOff className="h-4 w-4" />
                        Your donation will be recorded as anonymous. Your student account will still receive the donation perks.
                      </p>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="message">Message (Optional)</Label>
                    <Textarea
                      id="message"
                      placeholder="Leave a message of support..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <Separator />

                {/* Perks Section */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 p-6 rounded-lg text-left space-y-3 border border-purple-200 dark:border-purple-800">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Gift className="h-5 w-5 text-purple-600" />
                    Unlock Premium Features
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                    Support CourseCollab with a minimum donation of $5 USD and get 14 days of premium access to all features including:
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-4">
                    * Perks are activated only after successful payment completion (not pending donations)
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Unlimited quiz attempts</strong> - Take quizzes, homeworks, mid-semester, and final exams multiple times</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span><strong>AI Tutor access</strong> - Get instant help with unlimited questions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span><strong>7 Playground Credits</strong> - Extra credits to use Playground for practice sessions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span><strong>CodeBench IDE</strong> - Practice coding in our integrated development environment</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Early access to new features</strong> - Be the first to try new features</span>
                    </li>
                  </ul>
                </div>

                <Separator />

                {/* Submit Button */}
                <Button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    console.log("[Donate] Button onClick triggered", { isSubmitting, amount, disabled: isSubmitting || !amount })
                    if (!isSubmitting && amount) {
                      handleDonate()
                    } else {
                      console.log("[Donate] Button click ignored - disabled or no amount")
                      if (!amount) {
                        toast({
                          title: "Amount Required",
                          description: "Please select a donation amount (minimum $5)",
                          variant: "destructive",
                        })
                      }
                    }
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    console.log("[Donate] Button onTouchEnd triggered", { isSubmitting, amount })
                    if (!isSubmitting && amount) {
                      handleDonate()
                    } else if (!amount) {
                      toast({
                        title: "Amount Required",
                        description: "Please select a donation amount (minimum $5)",
                        variant: "destructive",
                      })
                    }
                  }}
                  disabled={isSubmitting || !amount}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl py-6 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                  type="button"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Heart className="h-5 w-5 mr-2" />
                      Support CourseCollab Development
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-slate-500">
                  Donations are completely voluntary and not required to use CourseCollab. All features remain free and accessible to all students.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Alternative Support Methods */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl font-bold">Other Ways to Support</CardTitle>
                <CardDescription>
                  There are many ways to contribute to CourseCollab's growth
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                      <Github className="h-5 w-5 text-slate-600" />
                      <h3 className="font-semibold">Contribute Code</h3>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Help improve CourseCollab by contributing to our open-source repository on GitHub.
                    </p>
                  </div>
                  <div className="p-4 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                      <Users className="h-5 w-5 text-slate-600" />
                      <h3 className="font-semibold">Share Feedback</h3>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Help us improve by sharing your ideas, reporting bugs, or suggesting new features.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  )
}

export default DonatePageContent

