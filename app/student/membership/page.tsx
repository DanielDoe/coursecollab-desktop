"use client"


import { studentApiFetch } from "@/lib/auth"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Crown,
  Star,
  Award,
  Check,
  X,
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Zap,
  Shield,
  Users,
  Calendar,
  CreditCard,
  Gift,
  Sparkles,
  Target,
  Rocket,
  Diamond,
  Flame,
  Heart,
  Lock,
  Unlock,
  TrendingUp,
  BarChart3,
  BookOpen,
  MessageSquare,
  Code,
  Brain,
} from "lucide-react"
import Link from "next/link"
import { MembershipLayout } from "@/components/membership/MembershipLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CoraCreditPacksPanel } from "@/components/cora/CoraCreditPacksPanel"
import { CoraUsagePanel } from "@/components/cora/CoraUsagePanel"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { useSmartHomeLink } from "@/hooks/useSmartHomeLink"
import { MEMBERSHIP_PLANS, type BillingCadence } from "@/lib/membership-constants"
import { calculateSemesterSavings } from "@/lib/semester-utils-client"
import { resolveStudentBillingCadence } from "@/lib/student-billing-eligibility"
import { StudentSemesterDiscountPrice } from "@/components/student/membership/StudentSemesterDiscountPrice"
import { InstitutionalAccessBanner } from "@/components/membership/InstitutionalAccessBanner"

interface MembershipTier {
  id: string
  name: string
  description: string
  price: number
  originalPrice?: number
  features: string[]
  limitations: string[]
  color: string
  icon: React.ReactNode
  popular?: boolean
  current?: boolean
}

interface UserMembership {
  tier: string
  effectiveFeatureTier?: string
  status: "active" | "expired" | "cancelled"
  expiresAt: string
  autoRenew: boolean
  usage: {
    quizzes: number
    lectures: number
    forumPosts: number
    aiChats: number
  }
  limits: {
    quizzes: number
    lectures: number
    forumPosts: number
    aiChats: number
  }
}

function MembershipPageContent() {
  const router = useRouter()
  const homeLink = useSmartHomeLink()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [userMembership, setUserMembership] = useState<UserMembership | null>(null)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [studentDbId, setStudentDbId] = useState<string | null>(null)
  // Default Trailblazer to semester (most popular option)
  const [selectedCadence, setSelectedCadence] = useState<Record<string, BillingCadence>>({
    Explorer: "semester",
    Trailblazer: "semester",
  })
  const [semesterOnlyBilling, setSemesterOnlyBilling] = useState(true)
  const [institutionalAccess, setInstitutionalAccess] = useState<{
    providedBy?: string | null
    expiresAt?: string | null
    personalTier?: string | null
    sponsoredFeatureTier?: string | null
  } | null>(null)

  const membershipTiers: MembershipTier[] = [
    {
      id: "Scholar",
      name: "Scholar",
      description: "Perfect for getting started with the basics",
      price: 0,
      features: [
        "CodeBench IDE, run/compile, Daily Challenge",
        "1 quiz attempt per assessment",
        "Access to all lecture materials",
        "Forum participation",
        "250 Cora Credits / month",
        "Cora explanations & study help",
        "3 Playground credits per week",
        "Basic support",
      ],
      limitations: [
        "No leaderboard access",
        "Limited Cora (explanations & study help)",
        "Cora in CodeBench requires Explorer or Trailblazer",
        "No early access features",
        "No Save and Finish Later",
      ],
      color: "from-slate-400 to-slate-600",
      icon: <Award className="h-6 w-6" />,
    },
    {
      id: "Explorer",
      name: "Explorer",
      description: "Study smarter with Cora and CodeBench.",
      price: 5.99,
      features: [
        "2 quiz attempts per assessment (1 retake)",
        "Save and Finish Later",
        "1 past-due rollover per assessment (24h window)",
        "Access to all lecture materials",
        "Leaderboard participation",
        "3,000 Cora Credits / month",
        "Cora in CodeBench (explain, debug, improve)",
        "5 Playground credits per week",
        "Priority support",
      ],
      limitations: [
        "No early access features",
        "Lower Cora credit allowance than Trailblazer",
      ],
      color: "from-blue-500 to-cyan-600",
      icon: <Star className="h-6 w-6" />,
    },
    {
      id: "Trailblazer",
      name: "Trailblazer",
      description: "Your complete AI-powered learning experience.",
      price: 9.99,
      features: [
        "3 quiz attempts per assessment",
        "Save and Finish Later",
        "Access to all lecture materials",
        "Leaderboard participation",
        "7,500 Cora Credits / month + Cora Lite after allowance",
        "Unlimited Playground access",
        "Cora in CodeBench with the same tools as Explorer",
        "Early access to new features",
        "Priority support",
        "Achievement Badges & Progress Milestones",
        "Attempt history & solution review",
        "Smart study recommendations",
      ],
      limitations: [],
      color: "from-purple-500 to-indigo-600",
      icon: <Crown className="h-6 w-6" />,
      popular: true, // Trailblazer is now the most popular
    },
  ]

  const fetchMembershipData = useCallback(async () => {
    try {
      const studentId = sessionStorage.getItem("studentDatabaseId")
      setStudentDbId(studentId)
      const response = await studentApiFetch(`/api/student/membership?studentId=${studentId}`)
      
      if (response.ok) {
        const data = await response.json()
        setUserMembership(data.membership)
        if (data.institutionalAccess?.active) {
          setInstitutionalAccess(data.institutionalAccess)
        }

        membershipTiers.forEach((tier) => {
          tier.current = tier.id === (data.membership.effectiveFeatureTier ?? data.membership.tier)
        })

        const semesterOnly = data.billing?.semesterOnly ?? true
        setSemesterOnlyBilling(semesterOnly)
        if (semesterOnly) {
          setSelectedCadence({ Explorer: "semester", Trailblazer: "semester" })
        } else if (data.membership.tier === "Explorer") {
          setSelectedCadence((prev) => ({ ...prev, Trailblazer: "monthly" }))
        }
      } else {
        throw new Error("Failed to fetch membership data")
      }
    } catch (error) {
      console.error("Failed to fetch membership:", error)
      toast({
        title: "Error",
        description: "Failed to load membership information",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast])

  useEffect(() => {
    const studentId = sessionStorage.getItem("studentDatabaseId")
    if (!studentId) {
      router.push("/student/login")
      return
    }
    fetchMembershipData()
  }, [router, fetchMembershipData])

  const handleUpgrade = async (tierId: string, billingCadence?: BillingCadence) => {
    setUpgrading(tierId)
    try {
      const studentId = sessionStorage.getItem("studentDatabaseId")
      
      if (!studentId) {
        toast({
          title: "Error",
          description: "Please log in to upgrade your membership",
          variant: "destructive",
        })
        setUpgrading(null)
        return
      }

      // Use selected cadence - prioritize passed parameter, then state, then default
      // Default: Trailblazer -> semester, others -> monthly
      const cadence = resolveStudentBillingCadence(
        tierId,
        billingCadence || selectedCadence[tierId],
        semesterOnlyBilling,
      )

      const payload = { studentId: parseInt(studentId), tier: tierId, billingCadence: cadence }
      console.log("[Membership Upgrade] Request:", payload)

      const response = await studentApiFetch("/api/student/membership/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      console.log("[Membership Upgrade] Response:", response.status, response.statusText)

      const text = await response.text()
      let data: Record<string, unknown>
      try {
        data = JSON.parse(text)
      } catch {
        console.error("[Membership Upgrade] Non-JSON response:", text?.substring(0, 300))
        throw new Error(`Server error: ${text || response.statusText}`)
      }

      if (!response.ok) {
        console.log("[Membership Upgrade] Error response:", data)
      }

      if (response.ok) {
        // Check if payment is required
        if (data.requiresPayment && data.clientSecret) {
          // Store clientSecret in sessionStorage for checkout page
          sessionStorage.setItem("checkoutClientSecret", data.clientSecret)
          sessionStorage.setItem("checkoutSessionId", data.sessionId || "")
          // Redirect to checkout page with the tier and billing cadence
          router.push(`/student/membership/checkout?plan=${tierId}&cadence=${cadence}`)
          return
        } else {
          // Free tier or subscription updated - no payment needed
          toast({
            title: "Success",
            description: data.message || "Membership updated successfully!",
          })
          fetchMembershipData()
        }
      } else {
        // Handle specific error cases
        if (data.needsEmail) {
          toast({
            title: "Email Required",
            description: "Please add your email address in your profile before purchasing a membership",
            variant: "destructive",
          })
          router.push("/student/profile")
        } else if (data.code === "ALREADY_SUBSCRIBED" && data.redirectToManage) {
          toast({
            title: "Already Subscribed",
            description: (data.message as string) || "You already have an active membership. Redirecting to manage...",
          })
          router.push("/student/membership/manage")
        } else {
          const errorMessage = data.error || data.details || `Failed to upgrade membership (${response.status})`
          const hint = data.hint ? ` ${data.hint}` : ""
          console.error("[Membership Upgrade] API Error Response:", {
            status: response.status,
            statusText: response.statusText,
            statusCode: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            data: data,
            dataString: JSON.stringify(data, null, 2),
          })
          
          // Log specific error details if available
          if (data.code) {
            console.error("[Membership Upgrade] Error Code:", data.code)
          }
          if (data.type) {
            console.error("[Membership Upgrade] Error Type:", data.type)
          }
          if (data.details) {
            console.error("[Membership Upgrade] Error Details:", data.details)
          }
          
          toast({
            title: "Error",
            description: errorMessage + hint,
            variant: "destructive",
          })
        }
      }
    } catch (error: any) {
      console.error("[Membership Upgrade] Failed to upgrade:", error)
      const errorMessage = error.message || "Failed to upgrade membership. Please try again or contact support."
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setUpgrading(null)
    }
  }

  const getTierColor = (tier: string) => {
    const tierData = membershipTiers.find(t => t.id === tier)
    return tierData?.color || "from-slate-400 to-slate-600"
  }

  const getTierIcon = (tier: string) => {
    const tierData = membershipTiers.find(t => t.id === tier)
    return tierData?.icon || <Award className="h-6 w-6" />
  }

  if (loading) {
    return (
      <MembershipLayout showBack={false}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: "rgba(88,44,131,0.15)" }}>
            <Crown className="h-8 w-8 text-[#582c83] animate-pulse" />
          </div>
          <p className="text-slate-600 dark:text-slate-400">Loading membership...</p>
        </div>
      </MembershipLayout>
    )
  }

  const displayFeatureTier =
    userMembership?.effectiveFeatureTier ?? userMembership?.tier ?? "Scholar"

  return (
    <MembershipLayout
      showBack={true}
      backHref={homeLink}
      backLabel="Back to Dashboard"
    >
      <div className="space-y-6 sm:space-y-8">
        {institutionalAccess ? (
          <div className="max-w-7xl mx-auto">
            <InstitutionalAccessBanner
              title={`Your access is currently sponsored by ${institutionalAccess.providedBy ?? "your institution"}.`}
              providedBy={institutionalAccess.providedBy}
              expiresAt={institutionalAccess.expiresAt}
              personalTier={institutionalAccess.personalTier ?? userMembership?.tier}
              sponsoredFeatureTier={institutionalAccess.sponsoredFeatureTier}
            />
          </div>
        ) : null}

        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-7 md:space-y-8">
          {/* Hero Section - Enterprise Grade */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-2xl p-6 sm:p-8 md:p-10 text-white"
            style={{ background: "linear-gradient(135deg, #582c83 0%, #6d3a9e 50%, #7a4eba 100%)" }}
          >
            {/* Animated Background */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxLjUiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
            </div>
            
            <div className="relative z-10">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sm:gap-6 md:gap-8">
                <div className="space-y-3 sm:space-y-4 md:space-y-6 flex-1 min-w-0 w-full">
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4 md:gap-6">
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ duration: 0.5, type: "spring" }}
                      className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-xl sm:rounded-2xl md:rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-2xl"
                    >
                      <Crown className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 lg:h-12 lg:w-12 text-white" />
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <motion.h1
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold bg-gradient-to-r from-white via-blue-50 to-purple-50 bg-clip-text text-transparent break-words leading-tight"
                      >
                        <span className="sm:hidden">Premium</span>
                        <span className="hidden sm:inline">Premium Membership</span>
                      </motion.h1>
                      <motion.p
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="text-blue-100 text-sm sm:text-base md:text-lg lg:text-xl mt-2 sm:mt-3 break-words"
                      >
                        <span className="sm:hidden">Unlock premium features</span>
                        <span className="hidden sm:inline">Unlock enterprise-grade features and accelerate your learning journey</span>
                      </motion.p>
                    </div>
                  </div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-wrap"
                  >
                    <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 text-xs sm:text-sm md:text-base font-medium min-h-[32px] sm:min-h-0">
                      <span className="sm:hidden">Current: {displayFeatureTier}</span>
                      <span className="hidden sm:inline">Current: {displayFeatureTier}</span>
                    </Badge>
                    <Badge className={`${userMembership?.status === "active" ? "bg-emerald-500/20 text-emerald-100 border-emerald-300/30" : "bg-amber-500/20 text-amber-100 border-amber-300/30"} backdrop-blur-sm px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 text-xs sm:text-sm md:text-base font-medium min-h-[32px] sm:min-h-0`}>
                      {userMembership?.status === "active" ? "✓ Active" : "Inactive"}
                    </Badge>
                    <Badge className="bg-yellow-400 text-yellow-950 border-yellow-300 px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 text-xs sm:text-sm md:text-base font-semibold min-h-[32px] sm:min-h-0">
                      $10 off Explorer & Trailblazer this semester
                    </Badge>
                  </motion.div>
                </div>
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.5, type: "spring" }}
                  className="hidden lg:block shrink-0"
                >
                  <div className="relative w-32 h-32 md:w-40 md:h-40">
                    <div className="absolute inset-0 rounded-full bg-white/10 backdrop-blur-md animate-pulse"></div>
                    <div className="absolute inset-4 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                      <Sparkles className="h-16 w-16 md:h-20 md:w-20 text-white" />
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Current Membership Status */}
          {userMembership && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              {/* Background gradient with animated pattern */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 dark:from-indigo-900/20 dark:via-purple-900/20 dark:to-pink-900/20 rounded-2xl sm:rounded-3xl blur-3xl"></div>
              
              <Card className="relative border-0 shadow-2xl bg-gradient-to-br from-white via-white to-indigo-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950/30 backdrop-blur-xl rounded-2xl sm:rounded-3xl overflow-hidden">
                {/* Animated header with gradient */}
                <CardHeader className={`relative bg-gradient-to-r ${getTierColor(displayFeatureTier)} p-4 sm:p-6 md:p-8 lg:p-10 overflow-hidden`}>
                  {/* Animated background pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.3),transparent_50%)]"></div>
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_25%,rgba(255,255,255,0.1)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.1)_75%,rgba(255,255,255,0.1))] bg-[length:20px_20px]"></div>
                  </div>
                  
                  <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 md:gap-6">
                    <div className="flex items-center gap-3 sm:gap-4 md:gap-5 w-full sm:w-auto">
                      {/* Large animated icon */}
                      <motion.div 
                        className={`w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-xl sm:rounded-2xl md:rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-2xl ring-2 sm:ring-4 ring-white/30 shrink-0`}
                        animate={{ 
                          rotate: [0, 5, -5, 0],
                          scale: [1, 1.05, 1]
                        }}
                        transition={{ 
                          duration: 3,
                          repeat: Infinity,
                          repeatType: "reverse"
                        }}
                      >
                        <div className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 lg:h-12 lg:w-12 text-white">
                        {getTierIcon(displayFeatureTier)}
                        </div>
                      </motion.div>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                          <CardTitle className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-white drop-shadow-lg break-words">
                            {displayFeatureTier}
                          </CardTitle>
                          <Badge className={`bg-white/20 backdrop-blur-sm text-white border-white/40 px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold w-fit ${
                            userMembership.status === "active" ? "animate-pulse" : ""
                          }`}>
                            {userMembership.status === "active" ? "✓ Active" : "Inactive"}
                          </Badge>
                        </div>
                        <CardDescription className="text-white/90 text-xs sm:text-sm md:text-base font-medium">
                          <span className="sm:hidden">Your plan</span>
                          <span className="hidden sm:inline">Your current membership plan</span>
                        </CardDescription>
                      </div>
                    </div>
                    
                    {/* Status indicator - hidden on mobile */}
                    <div className="hidden sm:flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2 text-white/90">
                        <div className={`w-2 h-2 rounded-full ${userMembership.status === "active" ? "bg-emerald-300 animate-pulse" : "bg-amber-300"}`}></div>
                        <span className="text-xs sm:text-sm font-medium">
                          {userMembership.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="p-4 sm:p-6 md:p-8 lg:p-10">
                  {/* Usage Stats with modern cards */}
                  <div className="mb-4 sm:mb-6 md:mb-8">
                    <h3 className="text-base sm:text-lg md:text-xl font-bold text-slate-800 dark:text-white mb-3 sm:mb-4 md:mb-6 flex items-center gap-2">
                      <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="sm:hidden">Usage</span>
                      <span className="hidden sm:inline">Usage Overview</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                      {[
                        { 
                          label: "Quizzes", 
                          used: userMembership.usage.quizzes, 
                          limit: userMembership.limits.quizzes,
                          icon: "📝",
                          color: "from-blue-500 to-cyan-500"
                        },
                        { 
                          label: "Lectures", 
                          used: userMembership.usage.lectures, 
                          limit: userMembership.limits.lectures,
                          icon: "🎓",
                          color: "from-purple-500 to-pink-500"
                        },
                        { 
                          label: "Forum Posts", 
                          used: userMembership.usage.forumPosts, 
                          limit: userMembership.limits.forumPosts,
                          icon: "💬",
                          color: "from-green-500 to-emerald-500"
                        },
                        { 
                          label: "AI Chats", 
                          used: userMembership.usage.aiChats, 
                          limit: userMembership.limits.aiChats,
                          icon: "🤖",
                          color: "from-orange-500 to-red-500"
                        }
                      ].map((stat, index) => {
                        const percentage = stat.limit === -1 ? 100 : (stat.used / stat.limit) * 100
                        const isUnlimited = stat.limit === -1
                        
                        return (
                          <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                            className="group relative bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-5 border border-slate-200/50 dark:border-slate-700/50 hover:shadow-lg transition-all duration-300 hover:scale-105"
                          >
                            <div className="flex items-center justify-between mb-2 sm:mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xl sm:text-2xl">{stat.icon}</span>
                                <span className="text-xs sm:text-sm md:text-base font-semibold text-slate-700 dark:text-slate-200">
                                  {stat.label}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5 sm:space-y-2">
                              <div className="flex items-baseline justify-between">
                                <span className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800 dark:text-white">
                                  {isUnlimited ? "∞" : stat.used}
                        </span>
                                <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                                  {isUnlimited ? "Unlimited" : `of ${stat.limit}`}
                        </span>
                      </div>
                              {!isUnlimited && (
                                <div className="relative h-1.5 sm:h-2 md:h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <motion.div
                                    className={`absolute inset-y-0 left-0 bg-gradient-to-r ${stat.color} rounded-full`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percentage}%` }}
                                    transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                      />
                    </div>
                              )}
                      </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                  
                  {/* Expiration/Status Info */}
                  {userMembership.expiresAt && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.7 }}
                      className="mb-4 sm:mb-6 md:mb-8 p-3 sm:p-4 md:p-5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 rounded-lg sm:rounded-xl md:rounded-2xl border border-indigo-200/50 dark:border-indigo-800/50"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 md:gap-4">
                        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
                            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs sm:text-sm md:text-base font-semibold text-slate-700 dark:text-slate-200">
                              <span className="sm:hidden">{userMembership.autoRenew ? "Auto-renew" : "Expires"}</span>
                              <span className="hidden sm:inline">{userMembership.autoRenew ? "Auto-renewal enabled" : "Membership expires"}</span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              <span className="sm:hidden">{userMembership.autoRenew ? "Will renew" : "End date"}</span>
                              <span className="hidden sm:inline">{userMembership.autoRenew 
                                ? "Your membership will automatically renew" 
                                : "Your access will end on this date"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-base sm:text-lg md:text-xl font-bold text-indigo-600 dark:text-indigo-400 w-full sm:w-auto text-right sm:text-left">
                          {new Date(userMembership.expiresAt).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                  
                  {/* Action Button */}
                  {(userMembership.tier === "Explorer" || userMembership.tier === "Trailblazer") && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.8 }}
                    >
                      <Button
                        onClick={() => router.push("/student/membership/manage")}
                        className="w-full text-white shadow-lg hover:shadow-xl transition-all duration-300 min-h-[44px] sm:min-h-[56px] h-auto py-3 sm:py-4 text-sm sm:text-base md:text-lg font-semibold rounded-xl md:rounded-2xl"
                        style={{ backgroundColor: "#582c83" }}
                      >
                        <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 mr-2 shrink-0" />
                        <span className="sm:hidden">Manage</span>
                        <span className="hidden sm:inline">Manage Subscription</span>
                        <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 ml-2 shrink-0" />
                      </Button>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          <div id="cora-usage" className="scroll-mt-24">
            <CoraUsagePanel
              userId={studentDbId}
              role="student"
              className="mt-2"
              historyHref="/student/dashboard-v2/settings/cora-usage"
            />
          </div>

          <CoraCreditPacksPanel
            audience="student"
            buyerId={studentDbId}
            className="mt-2"
          />

          {/* Membership Plans */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="text-center mb-4 sm:mb-6 md:mb-8">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800 dark:text-white mb-2 sm:mb-3 md:mb-4 break-words px-2">
                <span className="sm:hidden">Choose Plan</span>
                <span className="hidden sm:inline">Choose Your Plan</span>
              </h2>
              <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm md:text-base lg:text-lg break-words px-4">
                <span className="sm:hidden">Upgrade to unlock features</span>
                <span className="hidden sm:inline">Upgrade anytime to unlock more features and accelerate your learning</span>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6 lg:gap-8">
              {membershipTiers.map((tier, index) => (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="relative"
                >
                  {tier.popular && (
                    <div className="absolute -top-3 sm:-top-4 left-1/2 transform -translate-x-1/2 z-10">
                      <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 dark:from-yellow-500 dark:to-orange-600 text-white px-2 sm:px-3 md:px-4 py-0.5 sm:py-1 text-xs sm:text-sm font-semibold">
                        <Flame className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1 shrink-0" />
                        <span className="hidden sm:inline">Most Popular</span>
                        <span className="sm:hidden">Popular</span>
                      </Badge>
                    </div>
                  )}
                  
                  <Card className={`border-0 shadow-xl backdrop-blur-sm overflow-hidden transition-all duration-300 hover:shadow-2xl rounded-xl sm:rounded-2xl ${
                    tier.current 
                      ? "ring-2 ring-indigo-500 dark:ring-indigo-600 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20" 
                      : "bg-white/90 dark:bg-slate-800/90"
                  } ${tier.popular ? "md:scale-105" : ""}`}>
                    <CardHeader className={`bg-gradient-to-r ${tier.color} text-white p-4 sm:p-5 md:p-6`}>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          <div className="h-5 w-5 sm:h-6 sm:w-6 shrink-0">{tier.icon}</div>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-lg sm:text-xl font-bold break-words">{tier.name}</CardTitle>
                            <CardDescription className="text-white/80 text-xs sm:text-sm break-words">{tier.description}</CardDescription>
                          </div>
                        </div>
                        {tier.current && (
                          <Badge className="bg-white/20 text-white border-white/30 text-xs sm:text-sm px-2 sm:px-3 py-1 shrink-0">
                            <span className="sm:hidden">Current</span>
                            <span className="hidden sm:inline">Current Plan</span>
                          </Badge>
                        )}
                      </div>
                      {/* Pricing - show both monthly and semester for paid tiers */}
                      {tier.id === "Scholar" ? (
                      <div className="text-center">
                        <div className="text-3xl sm:text-4xl font-bold mb-1 sm:mb-2 break-words">
                            Free
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 sm:space-y-4">
                          {!semesterOnlyBilling && (
                          <div 
                            className={`p-2.5 sm:p-3 md:p-4 rounded-lg sm:rounded-xl border-2 cursor-pointer transition-all relative min-h-[60px] sm:min-h-[70px] flex flex-col justify-center ${
                              selectedCadence[tier.id] === "monthly" || (!selectedCadence[tier.id] && tier.id !== "Trailblazer")
                                ? "border-white/50 bg-white/10 ring-2 ring-white/30"
                                : "border-white/20 bg-white/5"
                            }`}
                            onClick={() => {
                              console.log("[Membership Page] Monthly option clicked for:", tier.id)
                              setSelectedCadence({ ...selectedCadence, [tier.id]: "monthly" })
                            }}
                          >
                            {(selectedCadence[tier.id] === "monthly" || (!selectedCadence[tier.id] && tier.id !== "Trailblazer")) && (
                              <div className="absolute top-2 right-2">
                                <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                              </div>
                            )}
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs sm:text-sm md:text-base font-semibold">Monthly</span>
                              <span className="text-xs text-white/80 hidden sm:inline">Billed monthly</span>
                            </div>
                            <div className="text-xl sm:text-2xl md:text-3xl font-bold">
                              ${tier.price}
                              <span className="text-sm sm:text-base md:text-lg font-normal">/month</span>
                            </div>
                          </div>
                          )}
                          {/* Semester Option */}
                          {(() => {
                            const plan = MEMBERSHIP_PLANS.find(p => p.id === tier.id)
                            if (!plan || !plan.semesterPriceInCents) return null
                            const savings = calculateSemesterSavings(plan)
                            return (
                              <div 
                                className={`p-2.5 sm:p-3 md:p-4 rounded-lg sm:rounded-xl border-2 cursor-pointer transition-all relative min-h-[60px] sm:min-h-[70px] flex flex-col justify-center ${
                                  selectedCadence[tier.id] === "semester" || (tier.id === "Trailblazer" && !selectedCadence[tier.id])
                                    ? "border-yellow-400/70 bg-yellow-400/20 ring-2 ring-yellow-400/30"
                                    : "border-white/20 bg-white/5"
                                }`}
                                onClick={() => {
                                  console.log("[Membership Page] Semester option clicked for:", tier.id)
                                  setSelectedCadence({ ...selectedCadence, [tier.id]: "semester" })
                                }}
                              >
                                {(selectedCadence[tier.id] === "semester" || (tier.id === "Trailblazer" && !selectedCadence[tier.id])) && (
                                  <>
                                    <Badge className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-yellow-900 text-[10px] sm:text-xs md:text-sm font-bold px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 shadow-lg z-10">
                                      <span className="hidden sm:inline">{tier.id === "Trailblazer" ? "⭐ Most Popular" : "⭐ Best Value"}</span>
                                      <span className="sm:hidden">{tier.id === "Trailblazer" ? "⭐ Popular" : "⭐ Value"}</span>
                                    </Badge>
                                    <div className="absolute top-2 right-2 z-10">
                                      <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-900 font-bold" />
                                    </div>
                                  </>
                                )}
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs sm:text-sm md:text-base font-semibold">Semester</span>
                                  <span className="text-xs text-white/80 hidden sm:inline">One-time payment</span>
                                </div>
                                <StudentSemesterDiscountPrice
                                  tier={tier.id as "Explorer" | "Trailblazer"}
                                  inverted
                                  className="mt-0.5"
                                />
                                {savings.savings > 0 && (
                                  <div className="mt-1 text-[10px] sm:text-xs md:text-sm text-green-200 font-medium">
                                    <span className="sm:hidden">Save ${savings.savings.toFixed(2)}</span>
                                    <span className="hidden sm:inline">Save ${savings.savings.toFixed(2)} vs monthly</span>
                          </div>
                        )}
                      </div>
                            )
                          })()}
                        </div>
                      )}
                    </CardHeader>
                    
                    <CardContent className="p-3 sm:p-4 md:p-5 lg:p-6">
                      <div className="space-y-2.5 sm:space-y-3 md:space-y-4">
                        <div className="space-y-1.5 sm:space-y-2 md:space-y-3">
                          <h4 className="font-semibold text-xs sm:text-sm md:text-base text-slate-800 dark:text-white break-words">Features</h4>
                          {tier.features.map((feature, featureIndex) => (
                            <div key={featureIndex} className="flex items-start gap-2 sm:gap-2.5 md:gap-3">
                              <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />
                              <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 break-words leading-relaxed">{feature}</span>
                            </div>
                          ))}
                        </div>

                        {tier.limitations.length > 0 && (
                          <div className="space-y-1.5 sm:space-y-2 md:space-y-3">
                            <h4 className="font-semibold text-xs sm:text-sm md:text-base text-slate-800 dark:text-white break-words">Limitations</h4>
                            {tier.limitations.map((limitation, limitationIndex) => (
                              <div key={limitationIndex} className="flex items-start gap-2 sm:gap-2.5 md:gap-3">
                                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 break-words leading-relaxed">{limitation}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 sm:mt-4 md:mt-5 lg:mt-6 space-y-2 sm:space-y-3">
                        {tier.current ? (
                          <Button 
                            disabled 
                            className="w-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg sm:rounded-xl min-h-[44px] sm:min-h-[40px] h-auto py-2.5 sm:py-2 text-xs sm:text-sm"
                          >
                            <Check className="h-4 w-4 mr-2 shrink-0" />
                            <span className="sm:hidden">Current</span>
                            <span className="hidden sm:inline">Current Plan</span>
                          </Button>
                        ) : (
                          <Button
                            onClick={() => {
                              // Get the current selected cadence for this tier
                              const currentCadence = resolveStudentBillingCadence(
                                tier.id,
                                selectedCadence[tier.id],
                                semesterOnlyBilling,
                              )
                              console.log("[Membership Page] Upgrade clicked:", {
                                tier: tier.id,
                                selectedCadence: selectedCadence[tier.id],
                                currentCadence,
                                allSelectedCadence: selectedCadence
                              })
                              handleUpgrade(tier.id, currentCadence)
                            }}
                            disabled={upgrading === tier.id}
                            className={`w-full bg-gradient-to-r ${tier.color} hover:opacity-90 text-white rounded-lg sm:rounded-xl min-h-[44px] sm:min-h-[40px] h-auto py-2.5 sm:py-2 text-xs sm:text-sm font-semibold shadow-lg hover:shadow-xl transition-all`}
                          >
                            {upgrading === tier.id ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 shrink-0"></div>
                                <span>Upgrading...</span>
                              </>
                            ) : (
                              <>
                                <Rocket className="h-4 w-4 mr-2 shrink-0" />
                                {tier.price === 0 ? (
                                  <span className="sm:hidden">Downgrade</span>
                                ) : (() => {
                                  const currentCadence = resolveStudentBillingCadence(
                                tier.id,
                                selectedCadence[tier.id],
                                semesterOnlyBilling,
                              )
                                  return (
                                    <>
                                      <span className="sm:hidden">Upgrade</span>
                                      <span className="hidden sm:inline">Upgrade to {currentCadence === "semester" ? "Semester" : "Monthly"}</span>
                                    </>
                                  )
                                })()}
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Why Upgrade Section - Enterprise Grade Redesign */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="relative"
          >
            <div className="relative overflow-hidden rounded-xl sm:rounded-2xl md:rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 dark:from-slate-950 dark:via-indigo-950 dark:to-purple-950 p-4 sm:p-6 md:p-8 lg:p-12 xl:p-16">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                  backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                  backgroundSize: '40px 40px'
                }}></div>
                  </div>
              
              {/* Content */}
              <div className="relative z-10">
                <div className="text-center mb-6 sm:mb-8 md:mb-12">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.7 }}
                    className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-3 sm:mb-4 md:mb-6"
                  >
                    <Rocket className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 text-white" />
                  </motion.div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-white mb-2 sm:mb-3 md:mb-4 px-2">
                    <span className="sm:hidden">Why Premium?</span>
                    <span className="hidden sm:inline">Why Choose Premium?</span>
                  </h2>
                  <p className="text-sm sm:text-base md:text-lg lg:text-xl text-indigo-200 max-w-2xl mx-auto px-4">
                    <span className="sm:hidden">Unlock enterprise features</span>
                    <span className="hidden sm:inline">Unlock your full potential with enterprise-grade features designed to accelerate your learning journey</span>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
                  {[
                    {
                      icon: Brain,
                      title: "AI-Powered Intelligence",
                      description: "Get instant, personalized explanations and study plans powered by advanced AI",
                      gradient: "from-blue-500 to-cyan-600",
                      delay: 0.8
                    },
                    {
                      icon: TrendingUp,
                      title: "Advanced Analytics",
                      description: "Track your progress with detailed insights, performance metrics, and predictive analytics",
                      gradient: "from-emerald-500 to-teal-600",
                      delay: 0.9
                    },
                    {
                      icon: Zap,
                      title: "Unlimited Access",
                      description: "No limits on AI tutor sessions, playground credits, or code compilation",
                      gradient: "from-amber-500 to-orange-600",
                      delay: 1.0
                    },
                    {
                      icon: Shield,
                      title: "Priority Support",
                      description: "Get priority access to new features, expert support, and exclusive resources",
                      gradient: "from-purple-500 to-pink-600",
                      delay: 1.1
                    }
                  ].map((benefit, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: benefit.delay }}
                      className="group relative"
                    >
                      <div className="relative h-full p-4 sm:p-6 md:p-8 rounded-lg sm:rounded-xl md:rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                        <div className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-lg sm:rounded-xl md:rounded-2xl bg-gradient-to-br ${benefit.gradient} flex items-center justify-center mb-3 sm:mb-4 md:mb-6 group-hover:scale-110 transition-transform duration-300`}>
                          <benefit.icon className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-white" />
                    </div>
                        <h3 className="text-base sm:text-lg md:text-xl font-bold text-white mb-2 sm:mb-3 break-words">
                          {benefit.title}
                        </h3>
                        <p className="text-xs sm:text-sm md:text-base text-indigo-200 leading-relaxed break-words">
                          {benefit.description}
                    </p>
                  </div>
                    </motion.div>
                  ))}
                    </div>

                {/* CTA Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 1.2 }}
                  className="mt-6 sm:mt-8 md:mt-10 lg:mt-12 text-center"
                >
                  <div className="inline-flex items-center gap-2 sm:gap-3 px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 md:py-4 rounded-lg sm:rounded-xl md:rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 max-w-full">
                    <Diamond className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-yellow-400 shrink-0" />
                    <span className="text-xs sm:text-sm md:text-base lg:text-lg font-semibold text-white break-words">
                      <span className="sm:hidden">Join thousands accelerating learning</span>
                      <span className="hidden sm:inline">Join thousands of students already accelerating their learning</span>
                    </span>
                  </div>
                </motion.div>
                  </div>
                </div>
          </motion.div>
        </div>
      </div>
    </MembershipLayout>
  )
}

export default MembershipPageContent