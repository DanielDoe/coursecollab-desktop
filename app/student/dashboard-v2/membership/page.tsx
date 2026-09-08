"use client"


import { studentApiFetch } from "@/lib/auth"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import {
  Crown,
  Star,
  Award,
  Check,
  X,
  ArrowRight,
  Zap,
  Shield,
  Calendar,
  CreditCard,
  Rocket,
  Diamond,
  Flame,
  TrendingUp,
  Brain,
  ClipboardList,
  GraduationCap,
  MessageSquare,
  Bot,
  Infinity as InfinityIcon,
  type LucideIcon,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { MEMBERSHIP_PLANS, studentSemesterOffer, type BillingCadence } from "@/lib/membership-constants"
import { calculateSemesterSavings } from "@/lib/semester-utils-client"
import { resolveStudentBillingCadence } from "@/lib/student-billing-eligibility"
import { STUDENT_MEMBERSHIP_CHECKOUT_V2, STUDENT_MEMBERSHIP_MANAGE_V2, STUDENT_MEMBERSHIP_V2 } from "@/lib/student-v2-routes"
import { MembershipDisclaimer } from "@/components/governance/MembershipDisclaimer"
import { CoraCreditPacksPanel } from "@/components/cora/CoraCreditPacksPanel"
import { CoraUsagePanel } from "@/components/cora/CoraUsagePanel"
import { CoraCreditBalanceBadge } from "@/components/cora/CoraCreditBalanceBadge"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { solidListThumb } from "@/lib/student-color-hunt-theme"
import { portalOutlineButtonClass } from "@/lib/portal-module-themes"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { StudentSemesterDiscountPrice } from "@/components/student/membership/StudentSemesterDiscountPrice"
import { MembershipDashboardSkeleton } from "@/components/student/membership/MembershipDashboardSkeleton"
import { formatSemesterPrice } from "@/lib/student-membership-catalog"

interface UserMembership {
  tier: string
  status: "active" | "expired" | "cancelled"
  expiresAt: string | null
  autoRenew: boolean
  usage: { quizzes: number; lectures: number; forumPosts: number; aiChats: number }
  limits: { quizzes: number; lectures: number; forumPosts: number; aiChats: number }
}

const membershipTiersData = [
  {
    id: "Scholar" as const,
    name: "Scholar",
    description: "Core course access to get started",
    thumbIndex: 3,
    icon: Award,
    popular: false,
    features: [
      "1 quiz attempt per assessment",
      "Access to all lecture materials",
      "Forum participation",
      "250 Cora Credits / month",
      "3 Playground credits per week",
      "Basic support",
    ],
    limitations: [
      "No leaderboard access",
      "Limited Cora (explanations & study help)",
      "No CodeBench access",
      "No early access features",
      "No Save and Finish Later",
    ],
  },
  {
    id: "Explorer" as const,
    name: "Explorer",
    description: "More attempts, Cora, and study tools",
    thumbIndex: 1,
    icon: Star,
    popular: false,
    features: [
      "2 quiz attempts per assessment (1 retake)",
      "Save and Finish Later",
      "1 past-due rollover per assessment (24h window)",
      "Access to all lecture materials",
      "Leaderboard participation",
      "3,000 Cora Credits / month",
      "5 Playground credits per week",
      "Priority support",
    ],
    limitations: [
      "No CodeBench access",
      "No early access features",
      "Limited Cora usage",
    ],
  },
  {
    id: "Trailblazer" as const,
    name: "Trailblazer",
    description: "Full access — Cora, CodeBench, playground",
    thumbIndex: 0,
    icon: Crown,
    popular: true,
    features: [
      "3 quiz attempts per assessment",
      "Save and Finish Later",
      "3 past-due rollovers per assessment (24h each)",
      "Access to all lecture materials",
      "Leaderboard participation",
      "7,500 Cora Credits / month + Cora Lite after allowance",
      "Unlimited Playground access",
      "CodeBench IDE access",
      "Early access to new features",
      "Priority support",
      "Achievement Badges & Progress Milestones",
      "Attempt history & solution review",
      "Smart study recommendations",
    ],
    limitations: [] as string[],
  },
]

function PaidTierPricingPicker({
  tierId,
  price,
  plan,
  semesterOnlyBilling,
  selectedCadence,
  setSelectedCadence,
}: {
  tierId: string
  price: number
  plan: (typeof MEMBERSHIP_PLANS)[number] | undefined
  semesterOnlyBilling: boolean
  selectedCadence: Record<string, BillingCadence>
  setSelectedCadence: React.Dispatch<React.SetStateAction<Record<string, BillingCadence>>>
}) {
  const semesterSelected =
    selectedCadence[tierId] === "semester" ||
    semesterOnlyBilling ||
    (tierId === "Trailblazer" && !selectedCadence[tierId])
  const monthlySelected =
    !semesterOnlyBilling &&
    (selectedCadence[tierId] === "monthly" || (!selectedCadence[tierId] && tierId !== "Trailblazer"))
  const savings = plan ? calculateSemesterSavings(plan) : null

  return (
    <div className="space-y-2 mb-4">
      {!semesterOnlyBilling && (
        <div
          className={`p-2.5 rounded-lg border cursor-pointer transition-all ${monthlySelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
          onClick={() => setSelectedCadence({ ...selectedCadence, [tierId]: "monthly" })}
        >
          <div className="flex justify-between items-center">
            <span className="text-xs sm:text-sm font-medium">Monthly</span>
            <span className="text-base sm:text-lg font-bold">${price}/mo</span>
          </div>
        </div>
      )}
      {plan?.semesterPriceInCents && savings && (
        <div
          className={cn(
            "relative rounded-lg border p-2.5 transition-all",
            semesterOnlyBilling ? "" : "cursor-pointer",
            semesterSelected ? "border-transparent" : "border-border hover:bg-muted/50",
          )}
          style={
            semesterSelected
              ? {
                  borderColor: `${solidListThumb(2).fill}88`,
                  backgroundColor: `${solidListThumb(2).fill}14`,
                }
              : undefined
          }
          onClick={() => {
            if (!semesterOnlyBilling) setSelectedCadence({ ...selectedCadence, [tierId]: "semester" })
          }}
        >
          {savings.savings > 0 && semesterSelected && !semesterOnlyBilling && (
            <Badge
              className="absolute -top-1 -right-1 border-0 text-[9px] px-1 py-0"
              style={{
                backgroundColor: solidListThumb(2).fill,
                color: solidListThumb(2).icon,
              }}
            >
              Save ${savings.savings.toFixed(0)}
            </Badge>
          )}
          <div className="flex justify-between items-start gap-2">
            <span className="text-xs sm:text-sm font-medium pt-1">Semester</span>
            {studentSemesterOffer(tierId as "Explorer" | "Trailblazer") ? (
              <StudentSemesterDiscountPrice tier={tierId as "Explorer" | "Trailblazer"} className="text-right" />
            ) : (
              <span className="text-base sm:text-lg font-bold">${savings.semesterPrice}/sem</span>
            )}
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            One-time for this semester{studentSemesterOffer(tierId as "Explorer" | "Trailblazer")
              ? ` · was ${formatSemesterPrice(studentSemesterOffer(tierId as "Explorer" | "Trailblazer")!.listCents)}`
              : ""}
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardV2MembershipPage() {
  const router = useRouter()
  const { toast } = useToast()
  const theme = getStudentModuleTheme("membership")
  const pageTheme = theme.page
  const outlineBtn = cn("shrink-0 rounded-xl", portalOutlineButtonClass(theme))
  const [loading, setLoading] = useState(true)
  const [studentDbId, setStudentDbId] = useState<string | null>(null)
  const [userMembership, setUserMembership] = useState<UserMembership | null>(null)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [selectedCadence, setSelectedCadence] = useState<Record<string, BillingCadence>>({
    Explorer: "semester",
    Trailblazer: "semester",
  })
  const [semesterOnlyBilling, setSemesterOnlyBilling] = useState(true)

  const fetchMembershipData = useCallback(async () => {
    const studentId = sessionStorage.getItem("studentDatabaseId")
    if (!studentId) {
      router.push("/student/login")
      return
    }
    setStudentDbId(studentId)
    try {
      const response = await studentApiFetch(`/api/student/membership?studentId=${studentId}`)
      if (response.ok) {
        const data = await response.json()
        setUserMembership(data.membership)
        const semesterOnly = data.billing?.semesterOnly ?? true
        setSemesterOnlyBilling(semesterOnly)
        if (semesterOnly) {
          setSelectedCadence({ Explorer: "semester", Trailblazer: "semester" })
        }
      } else {
        throw new Error("Failed to fetch membership")
      }
    } catch (error) {
      console.error("Failed to fetch membership:", error)
      toast({ title: "Error", description: "Failed to load membership information", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [router, toast])

  useEffect(() => {
    fetchMembershipData()
  }, [fetchMembershipData])

  const handleUpgrade = async (tierId: string, billingCadence?: BillingCadence) => {
    setUpgrading(tierId)
    try {
      const studentId = sessionStorage.getItem("studentDatabaseId")
      if (!studentId) {
        toast({ title: "Error", description: "Please log in to upgrade", variant: "destructive" })
        setUpgrading(null)
        return
      }
      const cadence = resolveStudentBillingCadence(
        tierId,
        billingCadence || selectedCadence[tierId],
        semesterOnlyBilling,
      )
      const response = await studentApiFetch("/api/student/membership/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: parseInt(studentId), tier: tierId, billingCadence: cadence }),
      })
      const text = await response.text()
      let data: Record<string, unknown>
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error(`Server error: ${text || response.statusText}`)
      }
      if (response.ok) {
        if (data.requiresPayment && data.clientSecret) {
          sessionStorage.setItem("checkoutClientSecret", data.clientSecret as string)
          sessionStorage.setItem("checkoutSessionId", (data.sessionId as string) || "")
          router.push(`${STUDENT_MEMBERSHIP_CHECKOUT_V2}?plan=${tierId}&cadence=${cadence}`)
          return
        }
        toast({ title: "Success", description: (data.message as string) || "Membership updated!" })
        fetchMembershipData()
      } else {
        if (data.needsEmail) {
          toast({ title: "Email Required", description: "Add your email in Settings before purchasing", variant: "destructive" })
          router.push("/student/dashboard-v2/settings")
        } else if (data.code === "ALREADY_SUBSCRIBED" && data.redirectToManage) {
          toast({ title: "Already Subscribed", description: (data.message as string) || "You already have an active membership." })
          router.push(STUDENT_MEMBERSHIP_MANAGE_V2)
        } else {
          toast({ title: "Error", description: (data.error as string) || "Failed to upgrade", variant: "destructive" })
        }
      }
    } catch (error: unknown) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to upgrade", variant: "destructive" })
    } finally {
      setUpgrading(null)
    }
  }

  const getTierThumb = (tier: string) => {
    const t = membershipTiersData.find((x) => x.id === tier)
    return solidListThumb(t?.thumbIndex ?? 0)
  }
  const getTierIcon = (tier: string) => {
    const t = membershipTiersData.find((x) => x.id === tier)
    return t ? t.icon : Award
  }

  if (loading) {
    return <MembershipDashboardSkeleton />
  }

  return (
    <div className="min-h-0 w-full pb-8">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-5 md:space-y-6">
        {/* Current plan + page header (merged — was two near-identical cards) */}
        {userMembership ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="rounded-2xl border border-border bg-card shadow-none">
              <CardHeader className="p-4 sm:p-5 md:p-6 pb-3 sm:pb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                    <SolidListThumbTile
                      thumb={getTierThumb(userMembership.tier)}
                      icon={getTierIcon(userMembership.tier)}
                      size="list"
                    />
                    <div className="min-w-0 space-y-2">
                      <div>
                        <h1 className={cn("text-xl sm:text-2xl md:text-3xl font-bold tracking-tight", PORTAL_TEXT)}>
                          Membership & plans
                        </h1>
                        <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>
                          You're on {userMembership.tier} · manage billing, Cora credits, and plan options below.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-xs font-medium">
                          {userMembership.tier}
                        </Badge>
                        <Badge
                          className={`rounded-full px-2.5 py-1 text-xs font-medium border ${
                            userMembership.status === "active"
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {userMembership.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                        <CoraCreditBalanceBadge
                          userId={studentDbId}
                          role="student"
                          usageHref={`${STUDENT_MEMBERSHIP_V2}#cora-usage`}
                        />
                      </div>
                    </div>
                  </div>
                  {(userMembership.tier === "Explorer" || userMembership.tier === "Trailblazer") && (
                    <Button
                      onClick={() => router.push(STUDENT_MEMBERSHIP_MANAGE_V2)}
                      variant="outline"
                      className={outlineBtn}
                    >
                      <CreditCard className="h-4 w-4 mr-1.5" />
                      Manage billing
                      <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 md:p-6 pt-0 space-y-4">
                <div>
                  <h3 className={cn("mb-3 flex items-center gap-2 text-sm font-semibold", PORTAL_TEXT)}>
                    <Zap className={cn("h-4 w-4", pageTheme.iconText)} />
                    Plan allowances
                  </h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                    {(
                      [
                        {
                          label: "Quizzes",
                          used: userMembership.usage.quizzes,
                          limit: userMembership.limits.quizzes,
                          icon: ClipboardList,
                          hint: "Attempts recorded",
                          thumbIndex: 0,
                        },
                        {
                          label: "Lectures",
                          used: userMembership.usage.lectures,
                          limit: userMembership.limits.lectures,
                          icon: GraduationCap,
                          hint: "Course materials",
                          thumbIndex: 1,
                        },
                        {
                          label: "Forum",
                          used: userMembership.usage.forumPosts,
                          limit: userMembership.limits.forumPosts,
                          icon: MessageSquare,
                          hint: "Community posts",
                          thumbIndex: 2,
                        },
                        {
                          label: "AI chats",
                          used: userMembership.usage.aiChats,
                          limit: userMembership.limits.aiChats,
                          icon: Bot,
                          hint: "Legacy chat meter",
                          thumbIndex: 3,
                        },
                      ] as Array<{
                        label: string
                        used: number
                        limit: number
                        icon: LucideIcon
                        hint: string
                        thumbIndex: number
                      }>
                    ).map((stat, index) => {
                      const isUnlimited = stat.limit === -1
                      const pct = isUnlimited
                        ? 0
                        : Math.min(100, (stat.used / Math.max(stat.limit, 1)) * 100)
                      const thumb = solidListThumb(stat.thumbIndex)
                      return (
                        <motion.div
                          key={stat.label}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.08 + index * 0.04 }}
                          className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3.5 sm:p-4"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 space-y-1">
                              <p className={cn("text-[11px] font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                                {stat.label}
                              </p>
                              <p className={cn("text-2xl font-bold tabular-nums tracking-tight", PORTAL_TEXT)}>
                                {isUnlimited ? "∞" : stat.used.toLocaleString()}
                              </p>
                              <p className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>
                                {isUnlimited ? "Unlimited" : `of ${stat.limit} · ${stat.hint}`}
                              </p>
                            </div>
                            <SolidListThumbTile
                              thumb={thumb}
                              icon={isUnlimited ? InfinityIcon : stat.icon}
                              size="compact"
                            />
                          </div>
                          {!isUnlimited ? (
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
                              <motion.div
                                className="h-full rounded-full"
                                style={{ backgroundColor: thumb.fill }}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.55, delay: 0.15 + index * 0.04 }}
                              />
                            </div>
                          ) : (
                            <div className="mt-3 h-1.5 rounded-full bg-[var(--muted)]/80" />
                          )}
                        </motion.div>
                      )
                    })}
                  </div>
                  <p className="mt-3 text-[11px] sm:text-xs text-muted-foreground">
                    Cora Credits meter AI usage — see Overview, Activity, Tokens, and packs below.
                  </p>
                </div>

                {userMembership.expiresAt && (
                  <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#E8E8E8] bg-[#F6F4F8] px-3.5 py-3 sm:flex-row sm:items-center sm:px-4 dark:border-white/10 dark:bg-[#1C1C1C]">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#E8E8E8] bg-white dark:border-white/10 dark:bg-[#2A2A2A]">
                        <Calendar className="h-4 w-4 text-[var(--cc-accent)]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1E1033] dark:text-white">
                          {userMembership.autoRenew ? "Auto-renewal enabled" : "Membership expires"}
                        </p>
                        <p className="text-xs text-[#6B6570] dark:text-[#A8A29E]">
                          {userMembership.autoRenew
                            ? "Your access renews automatically on this date"
                            : "Your access ends on this date"}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-bold tabular-nums text-[#1E1033] sm:text-right sm:text-base dark:text-white">
                      {new Date(userMembership.expiresAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border bg-card p-4 sm:p-5 md:p-6"
          >
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Membership & plans</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your plan, Cora credits, and billing in one place.
            </p>
          </motion.div>
        )}

        <div id="cora-usage" className="scroll-mt-24 space-y-4 sm:space-y-5">
          <CoraUsagePanel userId={studentDbId} role="student" />
          <CoraCreditPacksPanel audience="student" buyerId={studentDbId} />
        </div>

        {/* Membership Plans */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
          <MembershipDisclaimer className="mb-4" />
          <div className="mb-4 text-center">
            <h2 className={cn("text-lg sm:text-xl md:text-2xl font-bold tracking-tight", PORTAL_TEXT)}>
              Choose your plan
            </h2>
            <p className={cn("mt-1 text-xs sm:text-sm px-4", PORTAL_TEXT_MUTED)}>
              {semesterOnlyBilling
                ? "Roster students · one semester bill · upgrade anytime"
                : "Upgrade anytime · monthly or semester billing"}
            </p>
            <p className="mt-2 inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
              Student offer: $10 off Explorer and Trailblazer this semester
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 md:gap-5 items-stretch">
            {membershipTiersData.map((tier, index) => {
              const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier.id)
              const isCurrent = tier.id === (userMembership?.tier || "Scholar")
              const price = plan ? plan.priceInCents / 100 : 0
              const thumb = solidListThumb(tier.thumbIndex)
              return (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                  className="relative h-full"
                >
                  {tier.popular && (
                    <div className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2">
                      <Badge
                        className="border-0 px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold"
                        style={{ backgroundColor: thumb.fill, color: thumb.icon }}
                      >
                        <Flame className="mr-0.5 h-2.5 w-2.5 shrink-0" />
                        Popular
                      </Badge>
                    </div>
                  )}
                  <Card
                    className={cn(
                      "flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-none transition-shadow hover:shadow-md",
                      isCurrent && "ring-2 ring-offset-0",
                    )}
                    style={{
                      borderColor: tier.popular || isCurrent ? `${thumb.fill}66` : undefined,
                      ...(isCurrent ? { ["--tw-ring-color" as string]: thumb.fill } : {}),
                    }}
                  >
                    <CardContent className="flex h-full flex-col p-4 sm:p-5">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <SolidListThumbTile thumb={thumb} icon={tier.icon} size="compact" />
                          <div className="min-w-0">
                            <CardTitle className="text-base font-bold sm:text-lg">{tier.name}</CardTitle>
                            <CardDescription className="text-[11px] sm:text-xs leading-snug">
                              {tier.description}
                            </CardDescription>
                          </div>
                        </div>
                        {isCurrent ? (
                          <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
                            Current
                          </Badge>
                        ) : null}
                      </div>

                      {tier.id === "Scholar" ? (
                        <div className={cn("mb-3 text-2xl font-bold", PORTAL_TEXT)}>Free</div>
                      ) : (
                        <PaidTierPricingPicker
                          tierId={tier.id}
                          price={price}
                          plan={plan}
                          semesterOnlyBilling={semesterOnlyBilling}
                          selectedCadence={selectedCadence}
                          setSelectedCadence={setSelectedCadence}
                        />
                      )}

                      <div className="mb-4 flex-1 space-y-3">
                        <div className="space-y-2">
                          <p className={cn("text-[11px] font-semibold uppercase tracking-wide", PORTAL_TEXT)}>
                            Included
                          </p>
                          <ul className="space-y-2">
                            {tier.features.map((feature) => (
                              <li key={feature} className="flex items-start gap-2">
                                <Check
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                  style={{ color: thumb.fill }}
                                />
                                <span className={cn("text-xs leading-snug sm:text-[13px]", PORTAL_TEXT)}>
                                  {feature}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        {tier.limitations.length > 0 ? (
                          <div className="space-y-2 border-t border-border pt-3">
                            <p className={cn("text-[11px] font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                              Not included
                            </p>
                            <ul className="space-y-2">
                              {tier.limitations.map((limitation) => (
                                <li key={limitation} className="flex items-start gap-2">
                                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  <span className={cn("text-xs leading-snug sm:text-[13px]", PORTAL_TEXT_MUTED)}>
                                    {limitation}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-auto">
                        {isCurrent ? (
                          <Button
                            disabled
                            className="h-auto min-h-[36px] w-full rounded-xl border-0 py-2 text-xs font-semibold text-white disabled:opacity-100 disabled:text-white"
                            style={{ backgroundColor: thumb.fill, color: "#FFFFFF" }}
                          >
                            <Check className="mr-1.5 h-3.5 w-3.5 shrink-0 text-white" />
                            Current plan
                          </Button>
                        ) : (
                          <Button
                            onClick={() =>
                              handleUpgrade(
                                tier.id,
                                resolveStudentBillingCadence(
                                  tier.id,
                                  selectedCadence[tier.id],
                                  semesterOnlyBilling,
                                ),
                              )
                            }
                            disabled={upgrading === tier.id}
                            className="h-auto min-h-[36px] w-full rounded-xl border-0 py-2 text-xs font-semibold hover:opacity-90"
                            style={{ backgroundColor: thumb.fill, color: thumb.icon }}
                          >
                            {upgrading === tier.id ? (
                              <>
                                <div className="mr-2 h-4 w-4 shrink-0 animate-spin rounded-full border-b-2 border-white" />
                                Upgrading…
                              </>
                            ) : tier.id === "Scholar" ? (
                              "Switch to Scholar"
                            ) : (
                              (() => {
                                const cadence = resolveStudentBillingCadence(
                                  tier.id,
                                  selectedCadence[tier.id],
                                  semesterOnlyBilling,
                                )
                                return `Upgrade · ${cadence === "semester" ? "Semester" : "Monthly"}`
                              })()
                            )}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        {/* Why Upgrade Section */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }} className="relative">
          <Card className="border rounded-xl overflow-hidden bg-card">
            <CardContent className="p-3 sm:p-4 md:p-5 lg:p-6 w-full min-w-0 overflow-x-hidden">
              <div className="text-center mb-4 sm:mb-5">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.6 }}
                  className="mb-2 inline-flex"
                >
                  <SolidListThumbTile thumb={solidListThumb(0)} icon={Rocket} size="list" />
                </motion.div>
                <h2 className={cn("text-base sm:text-lg md:text-xl font-bold mb-1 px-2", PORTAL_TEXT)}>
                  <span className="sm:hidden">Why Premium?</span>
                  <span className="hidden sm:inline">Why Choose Premium?</span>
                </h2>
                <p className={cn("text-xs sm:text-sm max-w-xl mx-auto px-2", PORTAL_TEXT_MUTED)}>
                  <span className="sm:hidden">Unlock enterprise features</span>
                  <span className="hidden sm:inline">Unlock your full potential with enterprise-grade features</span>
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {[
                  { icon: Brain, title: "AI-Powered", description: "Instant, personalized explanations", thumbIndex: 0 },
                  { icon: TrendingUp, title: "Analytics", description: "Track progress with insights", thumbIndex: 1 },
                  { icon: Zap, title: "Unlimited Access", description: "No limits on AI tutor, playground", thumbIndex: 2 },
                  { icon: Shield, title: "Priority Support", description: "Expert support & new features", thumbIndex: 3 },
                ].map((benefit, index) => (
                  <motion.div key={index} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.7 + index * 0.05 }} className="group">
                    <div className="h-full p-3 sm:p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/50 transition-colors">
                      <div className="mb-2">
                        <SolidListThumbTile
                          thumb={solidListThumb(benefit.thumbIndex)}
                          icon={benefit.icon}
                          size="compact"
                        />
                      </div>
                      <h3 className={cn("text-xs sm:text-sm font-bold mb-0.5", PORTAL_TEXT)}>{benefit.title}</h3>
                      <p className={cn("text-[10px] sm:text-xs leading-snug", PORTAL_TEXT_MUTED)}>{benefit.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 1 }} className="mt-4 text-center">
                <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] max-w-full">
                  <SolidListThumbTile thumb={solidListThumb(1)} icon={Diamond} size="compact" />
                  <span className={cn("text-xs sm:text-sm font-semibold break-words", PORTAL_TEXT)}>
                    <span className="sm:hidden">Join thousands accelerating learning</span>
                    <span className="hidden sm:inline">Join thousands of students accelerating their learning</span>
                  </span>
                </div>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
