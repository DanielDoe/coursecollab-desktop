"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Brain,
  Code,
  BookOpen,
  Gift,
  TrendingUp,
  Info,
  RotateCw,
  ArrowRight,
  AlertCircle,
  Users,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  FileQuestion,
  Loader2,
  Trophy,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import {
  buildUnifiedTimeline,
  TradeHistoryCard,
  type MyTradeHistory,
} from "@/components/trade-center-student-history"
import { CLASSROOM_POINTS_FOR_FULL_GRADE } from "@/lib/classroom-points-grade-scale"
import { getPointsPerEc, type TradeCenterPointCaps } from "@/lib/engagement-points-system"
import { DEFAULT_TRADE_CENTER_CONFIG } from "@/lib/trade-center-shared"
import type { AssessmentPrivilegeSource } from "@/lib/assessment-privilege-governance-shared"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme, studentModuleSpinnerClass } from "@/lib/student-module-themes"
import { StudentModuleHubLayout } from "@/components/student/dashboard-v2/StudentModuleHubLayout"
import { portalOutlineButtonClass, portalStatusBadgeClass } from "@/lib/portal-module-themes"
import {
  PORTAL_CARD,
  PORTAL_CTA,
  PORTAL_NAV_ICON_ACTIVE,
  PORTAL_NAV_ICON_IDLE,
  PORTAL_OUTLINE_BTN,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/appearance/portal-nav-classes"

interface TradeCenterContentProps {
  embedInDashboard?: boolean
}

function formatPointsDisplay(n: number): string {
  const v = Number(n) || 0
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

function gradeCategoryLabel(cat: string): string {
  if (cat === "quiz") return "Quizzes"
  if (cat === "homework") return "Homework"
  if (cat === "midterm") return "Mid-semester"
  if (cat === "final") return "Finals"
  if (cat === "attendance") return "Attendance"
  if (cat === "project") return "Projects"
  if (cat === "classroom") return "Classroom"
  return "Engagement"
}

export function TradeCenterContent({ embedInDashboard = false }: TradeCenterContentProps) {
  const theme = getStudentModuleTheme("trade-center")
  const pageTheme = theme.page
  const iconAccent = pageTheme.iconText
  const panelCard = cn("rounded-2xl border shadow-sm", PORTAL_CARD)
  const peerExchangeCard = cn(panelCard, "flex h-full flex-col p-4 sm:p-5")
  const peerExchangeIconWrap = "rounded-lg bg-[var(--muted)] p-2 ring-1 ring-[var(--border)]"
  const softTile = cn("rounded-xl border", pageTheme.softBg, pageTheme.border)
  const progressTrack = "bg-[var(--muted)] [&_[data-slot=progress-indicator]]:!bg-[var(--cc-accent)]"
  const optionActive = cn(
    "border-2 border-[var(--cc-accent)] bg-[var(--cc-accent-soft)]",
    pageTheme.iconText,
  )
  const optionIdle = cn("border-2 border-[var(--border)] bg-[var(--muted)]", PORTAL_TEXT_MUTED)
  const router = useRouter()
  const [studentId, setStudentId] = useState<number | null>(null)
  const [studentSession, setStudentSession] = useState("")
  const [loading, setLoading] = useState(true)
  const [points, setPoints] = useState<any>(null)
  const [pointsToTrade, setPointsToTrade] = useState("")
  const [trading, setTrading] = useState(false)
  const [donationType, setDonationType] = useState<"DIRECT" | "COMMUNITY">("DIRECT")
  const [donationPoints, setDonationPoints] = useState("")
  const [donating, setDonating] = useState(false)
  const [peers, setPeers] = useState<{ id: number; full_name?: string; student_id: string; display_label?: string }[]>([])
  const [donationRecipientId, setDonationRecipientId] = useState("")
  const [donationSource, setDonationSource] = useState<"practice" | "playground" | "reading" | "total" | "classroom">("total")
  const [requestPeerId, setRequestPeerId] = useState("")
  const [requestPoints, setRequestPoints] = useState("")
  const [requestSource, setRequestSource] = useState<"practice" | "playground" | "reading" | "total" | "classroom">("total")
  const [classroomPeer, setClassroomPeer] = useState<{
    approvedTotal: number
    tradable: number
    minReserve: number
  } | null>(null)
  const [requestMessage, setRequestMessage] = useState("")
  const [requesting, setRequesting] = useState(false)
  const [donationRequests, setDonationRequests] = useState<any[]>([])
  const [pointRequests, setPointRequests] = useState<any[]>([])
  const [syncing, setSyncing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  // Points for rollover (trade grade points for assessment extension)
  const [rolloverData, setRolloverData] = useState<{
    categories: Record<string, { score: number; deduction: number; available: number; weight: number }>
    assessments: { id: number; title: string; assessment_type: string; rollover_hours: number }[]
    costs: { "12": number; "24": number }
  } | null>(null)
  const [rolloverLoading, setRolloverLoading] = useState(false)
  const [rolloverQuizId, setRolloverQuizId] = useState("")
  const [rolloverSourceCategory, setRolloverSourceCategory] = useState("")
  const [rolloverHours, setRolloverHours] = useState<12 | 24>(24)
  const [rolloverTrading, setRolloverTrading] = useState(false)
  const [extraAttemptsData, setExtraAttemptsData] = useState<{
    categories: Record<string, { score: number; deduction: number; available: number; weight: number }>
    assessments: { id: number; title: string; assessment_type: string; available_until: string | null }[]
    costs: { "1": number; "2": number }
  } | null>(null)
  const [extraAttemptsLoading, setExtraAttemptsLoading] = useState(false)
  const [extraAttemptsQuizId, setExtraAttemptsQuizId] = useState("")
  const [extraAttemptsSourceCategory, setExtraAttemptsSourceCategory] = useState("")
  const [extraAttemptsCount, setExtraAttemptsCount] = useState<1 | 2>(1)
  const [extraAttemptsTrading, setExtraAttemptsTrading] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [tradeHistory, setTradeHistory] = useState<MyTradeHistory | null>(null)
  const [tradeConfig, setTradeConfig] = useState<TradeCenterPointCaps>(() => ({
    weekly_practice_cap: DEFAULT_TRADE_CENTER_CONFIG.weekly_practice_cap,
    weekly_playground_cap: DEFAULT_TRADE_CENTER_CONFIG.weekly_playground_cap,
    weekly_reading_cap: DEFAULT_TRADE_CENTER_CONFIG.weekly_reading_cap,
    practice_weight: DEFAULT_TRADE_CENTER_CONFIG.practice_weight,
    playground_weight: DEFAULT_TRADE_CENTER_CONFIG.playground_weight,
    reading_weight: DEFAULT_TRADE_CENTER_CONFIG.reading_weight,
    ec_conversion_multiplier: DEFAULT_TRADE_CENTER_CONFIG.ec_conversion_multiplier,
    max_engagement_credits: DEFAULT_TRADE_CENTER_CONFIG.max_engagement_credits,
    min_donation_points: DEFAULT_TRADE_CENTER_CONFIG.min_donation_points,
  }))
  const [tradingEnabled, setTradingEnabled] = useState(true)
  const [donationsEnabled, setDonationsEnabled] = useState(true)
  const [pointsPerEcFromApi, setPointsPerEcFromApi] = useState(100)
  const [lifetimeEngagementCredits, setLifetimeEngagementCredits] = useState(0)
  const [governance, setGovernance] = useState<{
    source: AssessmentPrivilegeSource
    membershipPlatformPerks: boolean
    tradeCenterRedemptions: boolean
    label: string
  } | null>(null)

  useEffect(() => {
    const data = getStudentData()
    if (!data?.databaseId) {
      router.push("/student/login")
      return
    }
    const init = async () => {
      try {
        const dbId = Number(data.databaseId)
        const session = data.section || ""
        setStudentId(dbId)
        setStudentSession(session)
        if (!dbId || !session) {
          setLoading(false)
          return
        }
        try {
          await studentApiFetch("/api/trade-center/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentId: dbId, session }),
          })
        } catch {
          // ignore background sync failures
        }
        fetchPoints(false, dbId, session)
        studentApiFetch(`/api/trade-center/peers?session=${encodeURIComponent(session)}&excludeId=${dbId}`)
          .then((r) => r.json())
          .then((d) => setPeers(d.peers || []))
          .catch(() => {})
        studentApiFetch(`/api/trade-center/donation-requests?studentId=${dbId}`)
          .then((r) => r.json())
          .then((d) => setDonationRequests(d.requests || []))
          .catch(() => {})
        studentApiFetch(`/api/trade-center/point-requests?studentId=${dbId}`)
          .then((r) => r.json())
          .then((d) => setPointRequests(d.requests || []))
          .catch(() => {})
        studentApiFetch(
          `/api/trade-center/points-for-rollover?studentId=${dbId}&session=${encodeURIComponent(session)}`,
        )
          .then((r) => r.json())
          .then((d) => {
            if (!d.error) setRolloverData(d)
          })
          .catch(() => {})
        studentApiFetch(
          `/api/trade-center/points-for-extra-attempts?studentId=${dbId}&session=${encodeURIComponent(session)}`,
        )
          .then((r) => r.json())
          .then((d) => {
            if (!d.error) setExtraAttemptsData(d)
          })
          .catch(() => {})
        fetchClassroomPeerEligibility(dbId, session)
        studentApiFetch(`/api/trade-center/my-history?studentId=${dbId}`)
          .then((r) => r.json())
          .then((d) => {
            if (!d.error) setTradeHistory(d)
          })
          .catch(() => {})
      } catch {
        router.push("/student/login")
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  const fetchClassroomPeerEligibility = async (overrideStudentId?: number, overrideSession?: string) => {
    const idToUse = overrideStudentId ?? studentId
    const sessionToUse = overrideSession ?? studentSession
    if (!idToUse || !sessionToUse) return
    try {
      const r = await studentApiFetch(
        `/api/trade-center/classroom-transfer-eligibility?studentId=${idToUse}&session=${encodeURIComponent(sessionToUse)}`,
      )
      const d = await r.json()
      if (!d.error) {
        setClassroomPeer({
          approvedTotal: d.approvedTotal ?? 0,
          tradable: d.tradable ?? 0,
          minReserve: d.minReserve ?? CLASSROOM_POINTS_FOR_FULL_GRADE,
        })
      }
    } catch {
      setClassroomPeer(null)
    }
  }

  const fetchPoints = async (showToast = false, overrideStudentId?: number, overrideSession?: string) => {
    const idToUse = overrideStudentId ?? studentId
    const sessionToUse = overrideSession ?? studentSession
    if (!idToUse || !sessionToUse) return
    try {
      const response = await studentApiFetch(
        `/api/trade-center/points?studentId=${idToUse}&session=${sessionToUse}`,
      )
      const data = await response.json()
      if (response.ok) {
        if (data.config) setTradeConfig(data.config)
        if (typeof data.tradingEnabled === "boolean") setTradingEnabled(data.tradingEnabled)
        if (typeof data.donationsEnabled === "boolean") setDonationsEnabled(data.donationsEnabled)
        if (typeof data.pointsPerEc === "number") setPointsPerEcFromApi(data.pointsPerEc)
        if (typeof data.lifetimeEngagementCredits === "number") {
          setLifetimeEngagementCredits(data.lifetimeEngagementCredits)
        }
        if (data.governance) setGovernance(data.governance)
        if (data.points) {
          setPoints(data.points)
          if (showToast) toast({ title: "Points Refreshed", description: "Your points have been updated successfully." })
        } else {
          setPoints({
            practice_points: 0,
            playground_points: 0,
            reading_points: 0,
            total_points: 0,
            engagement_credits: 0,
          })
        }
      } else {
        setPoints({
          practice_points: 0,
          playground_points: 0,
          reading_points: 0,
          total_points: 0,
          engagement_credits: 0,
        })
        if (showToast) toast({ title: "Refresh Failed", description: data.error || "Failed to refresh points.", variant: "destructive" })
      }
    } catch {
      setPoints({ practice_points: 0, playground_points: 0, reading_points: 0, total_points: 0, engagement_credits: 0 })
      if (showToast) toast({ title: "Error", description: "Failed to refresh points.", variant: "destructive" })
    }
  }

  const handleSyncPoints = async () => {
    if (!studentId || !studentSession) return
    setSyncing(true)
    try {
      const response = await studentApiFetch("/api/trade-center/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, session: studentSession }),
      })
      const data = await response.json()
      if (response.ok && data.success) {
        toast({
          title: "Sync Successful! ✅",
          description: data.message || "Activity points synced from all sources.",
        })
        await fetchPoints()
        await fetchClassroomPeerEligibility()
        await refreshTradeHistory()
      } else {
        toast({
          title: "Sync Failed",
          description: data.error || "Could not sync activity points.",
          variant: "destructive",
        })
        await fetchPoints(true)
        await fetchClassroomPeerEligibility()
        await refreshTradeHistory()
      }
    } catch {
      toast({ title: "Syncing Points...", description: "Syncing your activity points from all sources." })
      await fetchPoints(true)
      await fetchClassroomPeerEligibility()
      await refreshTradeHistory()
    } finally {
      setSyncing(false)
    }
  }

  const refreshTradeHistory = async (overrideId?: number) => {
    const id = overrideId ?? studentId
    if (!id) return
    try {
      const r = await studentApiFetch(`/api/trade-center/my-history?studentId=${id}`)
      const d = await r.json()
      if (!d.error) setTradeHistory(d)
    } catch {
      // ignore
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchPoints(true)
    await fetchClassroomPeerEligibility()
    await refreshTradeHistory()
    setRefreshing(false)
  }

  const handleTrade = async () => {
    if (!pointsToTrade || !studentId || !studentSession) return
    const pts = parseInt(pointsToTrade)
    if (isNaN(pts) || pts <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid number of points to trade.", variant: "destructive" })
      return
    }
    const total =
      points?.tradable_points ??
      (Number(points?.total_points ?? 0) + Number(points?.carried_over_points ?? 0))
    if (pts > total) {
      toast({ title: "Insufficient Points", description: "You don't have enough points to trade.", variant: "destructive" })
      return
    }
    setTrading(true)
    try {
      const response = await studentApiFetch("/api/trade-center/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, session: studentSession, pointsToTrade: pts }),
      })
      const data = await response.json()
      if (response.ok && data.success) {
        toast({ title: "Trade Successful! 🎉", description: data.message })
        setPointsToTrade("")
        fetchPoints()
        refreshTradeHistory()
      } else {
        toast({ title: "Trade Failed", description: data.error || "Failed to process trade", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to process trade.", variant: "destructive" })
    } finally {
      setTrading(false)
    }
  }

  const handleDonate = async () => {
    if (!donationPoints || !studentId || !studentSession) return
    const pts = parseInt(donationPoints)
    const minDonation = tradeConfig.min_donation_points ?? 100
    if (isNaN(pts) || pts < minDonation) {
      toast({ title: "Invalid Amount", description: `Minimum donation is ${minDonation} points.`, variant: "destructive" })
      return
    }
    if (!donationRecipientId) {
      toast({ title: "Select Recipient", description: "Please select a peer to donate to.", variant: "destructive" })
      return
    }
    const maxBySource =
      donationSource === "classroom"
        ? classroomPeer?.tradable ?? 0
        : donationSource === "practice"
          ? practicePoints
          : donationSource === "playground"
            ? playgroundPoints
            : donationSource === "reading"
              ? readingPoints
              : totalPoints
    if (pts > maxBySource) {
      toast({ title: "Insufficient Points", description: `You have ${maxBySource} pts from ${donationSource}.`, variant: "destructive" })
      return
    }
    setDonating(true)
    try {
      const response = await studentApiFetch("/api/trade-center/donation-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          session: studentSession,
          recipientId: donationRecipientId,
          points: pts,
          source: donationSource,
        }),
      })
      const data = await response.json()
      if (response.ok && data.success) {
        toast({ title: "Donation Request Submitted! 💝", description: data.message })
        setDonationPoints("")
        setDonationRecipientId("")
        fetchPoints()
        fetchClassroomPeerEligibility()
        refreshTradeHistory()
        studentApiFetch(`/api/trade-center/donation-requests?studentId=${studentId}`)
          .then((r) => r.json())
          .then((d) => setDonationRequests(d.requests || []))
      } else {
        toast({ title: "Donation Failed", description: data.error || "Failed to submit donation request", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to submit donation request.", variant: "destructive" })
    } finally {
      setDonating(false)
    }
  }

  const handleRequestPoints = async () => {
    if (!requestPoints || !studentId || !studentSession) return
    const pts = parseInt(requestPoints)
    if (isNaN(pts) || pts < 100) {
      toast({ title: "Invalid Amount", description: "Minimum request is 100 points.", variant: "destructive" })
      return
    }
    if (!requestPeerId) {
      toast({ title: "Select Peer", description: "Please select a peer to request from.", variant: "destructive" })
      return
    }
    setRequesting(true)
    try {
      const response = await studentApiFetch("/api/trade-center/point-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterId: studentId,
          session: studentSession,
          requesteeId: requestPeerId,
          points: pts,
          source: requestSource,
          message: requestMessage || undefined,
        }),
      })
      const data = await response.json()
      if (response.ok && data.success) {
        toast({ title: "Request Sent! 📤", description: data.message })
        setRequestPoints("")
        setRequestPeerId("")
        setRequestMessage("")
        refreshTradeHistory()
        studentApiFetch(`/api/trade-center/point-requests?studentId=${studentId}`)
          .then((r) => r.json())
          .then((d) => setPointRequests(d.requests || []))
      } else {
        toast({ title: "Request Failed", description: data.error || "Failed to send request", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to send request.", variant: "destructive" })
    } finally {
      setRequesting(false)
    }
  }

  const handleApproveRequest = async (reqId: number) => {
    try {
      const r = await studentApiFetch(`/api/trade-center/point-requests/${reqId}/approve-peer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesteeId: studentId }),
      })
      const d = await r.json()
      if (r.ok && d.success) {
        toast({ title: "Approved", description: d.message })
        studentApiFetch(`/api/trade-center/point-requests?studentId=${studentId}`).then((res) => res.json()).then((data) => setPointRequests(data.requests || []))
        fetchClassroomPeerEligibility()
        refreshTradeHistory()
      } else {
        toast({ title: "Failed", description: d.error || "Could not approve", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Could not approve request.", variant: "destructive" })
    }
  }

  const fetchRolloverData = async () => {
    if (!studentId || !studentSession) return
    setRolloverLoading(true)
    try {
      const r = await studentApiFetch(
        `/api/trade-center/points-for-rollover?studentId=${studentId}&session=${encodeURIComponent(studentSession)}`,
      )
      const d = await r.json()
      if (!d.error) setRolloverData(d)
    } catch {
      // ignore
    } finally {
      setRolloverLoading(false)
    }
  }

  const fetchExtraAttemptsData = async () => {
    if (!studentId || !studentSession) return
    setExtraAttemptsLoading(true)
    try {
      const r = await studentApiFetch(
        `/api/trade-center/points-for-extra-attempts?studentId=${studentId}&session=${encodeURIComponent(studentSession)}`,
      )
      const d = await r.json()
      if (!d.error) setExtraAttemptsData(d)
    } catch {
      // ignore
    } finally {
      setExtraAttemptsLoading(false)
    }
  }

  const handleRolloverTrade = async () => {
    if (!studentId || !studentSession || !rolloverQuizId || !rolloverSourceCategory) return
    const cost = rolloverHours === 12 ? 10 : 20
    const cat = rolloverData?.categories?.[rolloverSourceCategory]
    if (cat && cat.available < cost) {
      toast({ title: "Insufficient points", description: `You need ${cost} pts in ${rolloverSourceCategory}. You have ${cat.available.toFixed(0)}.`, variant: "destructive" })
      return
    }
    setRolloverTrading(true)
    try {
      const r = await studentApiFetch("/api/trade-center/points-for-rollover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          session: studentSession,
          quizId: parseInt(rolloverQuizId, 10),
          hours: rolloverHours,
          sourceCategory: rolloverSourceCategory,
        }),
      })
      const d = await r.json()
      if (r.ok && d.success) {
        toast({
          title: "Rollover granted!",
          description: "Your extension is active. If you don't see Start, refresh the quiz/homework page or go back and return.",
        })
        setRolloverQuizId("")
        setRolloverSourceCategory("")
        fetchRolloverData()
        refreshTradeHistory()
        // Notify quiz/homework lists to refetch (they listen for this event)
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("trade-center-rollover-granted"))
        }
      } else {
        toast({ title: "Trade failed", description: d.error || "Failed to process", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to process trade", variant: "destructive" })
    } finally {
      setRolloverTrading(false)
    }
  }

  const handleExtraAttemptsTrade = async () => {
    if (!studentId || !studentSession || !extraAttemptsQuizId || !extraAttemptsSourceCategory) return
    const cost = extraAttemptsCount === 1 ? 10 : 18
    const cat = extraAttemptsData?.categories?.[extraAttemptsSourceCategory]
    if (cat && cat.available < cost) {
      toast({
        title: "Insufficient points",
        description: `You need ${cost} pts in ${extraAttemptsSourceCategory}. You have ${cat.available.toFixed(0)}.`,
        variant: "destructive",
      })
      return
    }
    setExtraAttemptsTrading(true)
    try {
      const r = await studentApiFetch("/api/trade-center/points-for-extra-attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          session: studentSession,
          quizId: parseInt(extraAttemptsQuizId, 10),
          additionalAttempts: extraAttemptsCount,
          sourceCategory: extraAttemptsSourceCategory,
        }),
      })
      const d = await r.json()
      if (r.ok && d.success) {
        toast({
          title: "Extra attempts granted!",
          description: d.message || "Your additional attempts are active on this assessment.",
        })
        setExtraAttemptsQuizId("")
        setExtraAttemptsSourceCategory("")
        fetchExtraAttemptsData()
        fetchRolloverData()
        refreshTradeHistory()
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("trade-center-rollover-granted"))
        }
      } else {
        toast({ title: "Trade failed", description: d.error || "Failed to process", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to process trade", variant: "destructive" })
    } finally {
      setExtraAttemptsTrading(false)
    }
  }

  const handleRejectRequest = async (reqId: number) => {
    try {
      const r = await studentApiFetch(`/api/trade-center/point-requests/${reqId}/reject-peer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesteeId: studentId }),
      })
      const d = await r.json()
      if (r.ok && d.success) {
        toast({ title: "Declined", description: d.message })
        studentApiFetch(`/api/trade-center/point-requests?studentId=${studentId}`).then((res) => res.json()).then((data) => setPointRequests(data.requests || []))
        refreshTradeHistory()
      } else {
        toast({ title: "Failed", description: d.error || "Could not decline", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Could not decline request.", variant: "destructive" })
    }
  }

  const sourceLabel = (s: string) =>
    s === "practice"
      ? "Practice Hub"
      : s === "playground"
        ? "Playground"
        : s === "reading"
          ? "Lecture Reading"
          : s === "classroom"
            ? "Classroom"
            : "Total"

  const unifiedHistory = useMemo(() => buildUnifiedTimeline(tradeHistory), [tradeHistory])
  const ecHistoryRows = useMemo(() => unifiedHistory.filter((r) => r.cat === "ec"), [unifiedHistory])
  const rolloverHistoryRows = useMemo(() => unifiedHistory.filter((r) => r.cat === "rollover"), [unifiedHistory])
  const extraAttemptsHistoryRows = useMemo(
    () => unifiedHistory.filter((r) => r.cat === "extra_attempts"),
    [unifiedHistory],
  )
  const peerHistoryRows = useMemo(
    () => unifiedHistory.filter((r) => r.cat === "peer" || r.cat === "community"),
    [unifiedHistory]
  )

  const tradeCenterMenuItems = useMemo(
    () => [
      { id: "overview", label: "Overview", icon: TrendingUp },
      { id: "trade-ec", label: "Trade for EC", icon: Sparkles },
      { id: "rollover", label: "Points for Rollover", icon: FileQuestion },
      { id: "extra-attempts", label: "Extra Attempts", icon: RotateCw },
      {
        id: "peers",
        label: "Peer Exchange",
        icon: Users,
        badge:
          donationRequests.length + pointRequests.length > 0
            ? donationRequests.length + pointRequests.length
            : undefined,
      },
    ],
    [donationRequests.length, pointRequests.length],
  )

  if (loading && !embedInDashboard) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className={cn("animate-spin rounded-full h-10 w-10 border-2 border-[var(--border)]", studentModuleSpinnerClass("trade-center"))} />
      </div>
    )
  }

  const carriedOverPoints = Number(points?.carried_over_points ?? 0)
  const weeklyPoints = Number(points?.total_points ?? 0)
  const totalPoints =
    Number(points?.tradable_points ?? 0) ||
    weeklyPoints + carriedOverPoints
  const practicePoints = points?.practice_points || 0
  const playgroundPoints = points?.playground_points || 0
  const readingPoints = points?.reading_points || 0
  const engagementCredits =
    lifetimeEngagementCredits ||
    Number(points?.lifetime_engagement_credits ?? 0) ||
    Number(points?.engagement_credits ?? 0)
  const classroomTradable = classroomPeer?.tradable ?? 0
  const classroomApproved = classroomPeer?.approvedTotal ?? 0
  const classroomMinReserve = classroomPeer?.minReserve ?? CLASSROOM_POINTS_FOR_FULL_GRADE
  const maxEC = tradeConfig.max_engagement_credits ?? DEFAULT_TRADE_CENTER_CONFIG.max_engagement_credits
  const pointsPerEc = pointsPerEcFromApi || getPointsPerEc(tradeConfig.ec_conversion_multiplier)
  const nextEC = Math.floor(totalPoints / pointsPerEc) + 1
  const nextThreshold = nextEC * pointsPerEc
  const needed = Math.max(0, nextThreshold - totalPoints)
  const progress = totalPoints > 0 ? Math.min((totalPoints / nextThreshold) * 100, 100) : 0
  const practiceCap = tradeConfig.weekly_practice_cap
  const playgroundCap = tradeConfig.weekly_playground_cap
  const readingCap = tradeConfig.weekly_reading_cap
  const tradeCenterRedemptionsBlocked = governance != null && !governance.tradeCenterRedemptions

  const governanceBlockedBanner = tradeCenterRedemptionsBlocked ? (
    <div className={cn("flex items-start gap-2 p-4 rounded-xl border text-sm", softTile, PORTAL_TEXT)}>
      <AlertCircle className={cn("h-4 w-4 mt-0.5 shrink-0", iconAccent)} />
      <p>
        Trade Center assessment redemptions (rollover and extra attempts) are not enabled for this course
        ({governance?.label ?? "instructor controlled"}).
        {governance?.membershipPlatformPerks
          ? " Membership platform perks may still apply on assessments where your instructor has enabled them."
          : " Your instructor controls assessment policies."}
      </p>
    </div>
  ) : null

  const syncRefreshButtons = (
    <>
      <Button
        onClick={handleSyncPoints}
        disabled={syncing}
        variant="ghost"
        size="sm"
        className={cn("h-8 gap-1.5", PORTAL_TEXT_MUTED, "hover:text-[var(--cc-text)] hover:bg-[var(--cc-accent-soft)]")}
      >
        <RotateCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Syncing..." : "Sync"}
      </Button>
      <Button
        onClick={handleRefresh}
        disabled={refreshing}
        variant="ghost"
        size="sm"
        className={cn("h-8 gap-1.5", PORTAL_TEXT_MUTED, "hover:text-[var(--cc-text)] hover:bg-[var(--cc-accent-soft)]")}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        {refreshing ? "Refreshing..." : "Refresh"}
      </Button>
    </>
  )

  const tabSectionOuter = embedInDashboard
    ? "w-full min-w-0"
    : "flex flex-col items-center py-6 sm:py-8"
  const tabSectionOuterTall = embedInDashboard
    ? "w-full min-w-0"
    : "flex flex-col items-center py-6 sm:py-10"
  const tabContentWide = embedInDashboard
    ? "w-full min-w-0 space-y-6"
    : "w-full max-w-4xl mx-auto space-y-6"
  const tabContentNarrow = embedInDashboard
    ? "w-full min-w-0 space-y-6"
    : "w-full max-w-xl mx-auto space-y-6"
  const embedTabPanelsScroll = embedInDashboard
    ? "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain min-w-0"
    : ""
  const embedTabsShellClass = embedInDashboard
    ? "flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
    : "w-full min-w-0"

  const tradeCenterTabTriggerClass = embedInDashboard
    ? cn(
        "group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-all justify-start h-auto flex-none min-h-[44px] sm:min-h-0 border border-transparent",
        "data-[state=inactive]:bg-transparent data-[state=inactive]:shadow-none",
        "data-[state=inactive]:text-[var(--cc-drawer-label-secondary)]",
        "data-[state=inactive]:hover:bg-[var(--cc-drawer-nav-hover-bg)] data-[state=inactive]:hover:text-[var(--cc-drawer-label)]",
        "data-[state=active]:bg-[var(--cc-drawer-nav-active-bg)] data-[state=active]:text-[var(--cc-drawer-primary)]",
        "data-[state=active]:border-[var(--cc-drawer-nav-active-border)] data-[state=active]:shadow-sm",
      )
    : "rounded-lg py-2.5 gap-2 text-[var(--cc-text-muted)] data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-slate-50"

  const tradeCenterTabIconClass = embedInDashboard
    ? cn(
        "flex size-9 items-center justify-center rounded-xl shrink-0 transition-all",
        "group-data-[state=active]:bg-[var(--pv-sidebar-active-icon-bg)] group-data-[state=active]:text-[var(--cc-drawer-primary)]",
        "group-data-[state=inactive]:bg-[var(--cc-drawer-icon-well-bg)] group-data-[state=inactive]:text-[var(--cc-drawer-label-secondary)]",
      )
    : ""

  const tradeHubMetaLine = loading ? (
    <span className="inline-block h-4 w-56 animate-pulse rounded bg-[var(--muted)]" />
  ) : (
    <>
      {totalPoints.toLocaleString()} tradable · {weeklyPoints.toLocaleString()} this week
      {carriedOverPoints > 0 ? ` · ${carriedOverPoints.toLocaleString()} carried forward` : ""}
    </>
  )

  const tabPanels = (
        <div className={cn("min-w-0", embedTabPanelsScroll)}>
        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-0">
          <div className={tabSectionOuter}>
            <div className={tabContentWide}>
              {/* Activity Points - centered card */}
              <div className="rounded-2xl bg-[var(--muted)]/30 p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                  <div className="text-center sm:text-left">
                    <h3 className="text-lg font-semibold text-[var(--cc-text)]">Activity Points Summary</h3>
                    <p className="text-sm text-[var(--cc-text-muted)] mt-1">Weekly earning caps reset Monday; untraded points carry forward</p>
                  </div>
                  <div className="flex items-center justify-center sm:justify-end gap-2 shrink-0">
                    {!embedInDashboard ? syncRefreshButtons : null}
                    {!embedInDashboard && (
                      <Button onClick={() => router.push("/student/dashboard")} variant="outline" size="sm" className="h-8 rounded-lg">
                        <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                        Dashboard
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--muted)] text-center">
                    <div className={cn("inline-flex p-2 rounded-lg mb-3", theme.page.iconBg)}>
                      <Brain className={cn("h-5 w-5", theme.page.iconText)} />
                    </div>
                    <p className="text-sm font-medium text-[var(--cc-text)]">Practice Hub</p>
                    <p className="text-2xl font-bold text-[var(--cc-text)] tabular-nums mt-1">{practicePoints}</p>
                    <p className="text-xs text-[var(--cc-text-muted)]">of {practiceCap} max · Hub + sample practice</p>
                    <Progress value={(practicePoints / practiceCap) * 100} className="h-1.5 mt-2 bg-[var(--muted)] [&_[data-slot=progress-indicator]]:!bg-[var(--cc-accent)]" />
                  </div>
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--muted)] text-center">
                    <div className={cn("inline-flex p-2 rounded-lg mb-3", theme.page.iconBg)}>
                      <Code className={cn("h-5 w-5", theme.page.iconText)} />
                    </div>
                    <p className="text-sm font-medium text-[var(--cc-text)]">Playground</p>
                    <p className="text-2xl font-bold text-[var(--cc-text)] tabular-nums mt-1">{playgroundPoints}</p>
                    <p className="text-xs text-[var(--cc-text-muted)]">of {playgroundCap} max · Sessions + score bonus</p>
                    <Progress value={(playgroundPoints / playgroundCap) * 100} className="h-1.5 mt-2 bg-[var(--muted)] [&_[data-slot=progress-indicator]]:!bg-[var(--cc-accent)]" />
                  </div>
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--muted)] text-center">
                    <div className={cn("inline-flex p-2 rounded-lg mb-3", theme.page.iconBg)}>
                      <BookOpen className={cn("h-5 w-5", theme.page.iconText)} />
                    </div>
                    <p className="text-sm font-medium text-[var(--cc-text)]">Lecture Reading</p>
                    <p className="text-2xl font-bold text-[var(--cc-text)] tabular-nums mt-1">{readingPoints}</p>
                    <p className="text-xs text-[var(--cc-text-muted)]">of {readingCap} max · 1 pt per slide opened</p>
                    <Progress value={(readingPoints / readingCap) * 100} className="h-1.5 mt-2 bg-[var(--muted)] [&_[data-slot=progress-indicator]]:!bg-[var(--cc-accent)]" />
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <p className="text-sm font-medium text-[var(--cc-text-muted)]">Tradable activity points</p>
                    <p className="text-2xl font-bold text-[var(--cc-text)] tabular-nums">{totalPoints.toLocaleString()}</p>
                    <p className="text-xs text-[var(--cc-text-muted)] mt-1">
                      {weeklyPoints.toLocaleString()} this week
                      {carriedOverPoints > 0 ? ` + ${carriedOverPoints.toLocaleString()} carried forward` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={cn("px-4 py-2 text-base font-semibold", pageTheme.badge)}>
                      {engagementCredits} / {maxEC} EC earned
                    </Badge>
                    <Button
                      onClick={() => setActiveTab("trade-ec")}
                      variant="ghost"
                      className={cn("rounded-xl", PORTAL_CTA)}
                    >
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Trade for EC
                    </Button>
                  </div>
                </div>
                {needed > 0 && (
                  <div className="mt-4 p-4 rounded-xl bg-[var(--cc-accent-soft)] border border-[var(--cc-accent-border)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[var(--cc-text)]">Progress to Next EC</span>
                      <span className="text-sm font-semibold text-[var(--cc-text)]">{needed} pts remaining</span>
                    </div>
                    <Progress value={progress} className="h-2 [&_[data-slot=progress-indicator]]:!bg-[var(--cc-accent)]" />
                  </div>
                )}
              </div>

              {/* Classroom points — semester cumulative (matches header badge + Classroom Points page) */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 shadow-sm ring-1 ring-[var(--cc-accent-border)]">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("p-2.5 rounded-xl shrink-0", theme.page.iconBg)}>
                      <Trophy className={cn("h-5 w-5", theme.page.iconText)} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--cc-text)]">Classroom Points</h3>
                      <p className="text-sm text-[var(--cc-text)] mt-1 max-w-xl leading-relaxed">
                        Approved participation and solution awards for your section. This total matches the{" "}
                        <span className="font-semibold text-[var(--cc-text)]">pts</span> badge in the
                        header and your Classroom Points page — separate from weekly activity above.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("shrink-0 rounded-xl", portalOutlineButtonClass(theme))}
                    onClick={() => router.push("/student/dashboard-v2/classroom-points")}
                  >
                    View Classroom Points
                  </Button>
                </div>
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--muted)] text-center sm:text-left">
                    <p className="text-sm font-medium text-[var(--cc-text)]">Approved total</p>
                    <p className={cn("text-2xl font-bold tabular-nums mt-1", theme.page.iconText)}>
                      {formatPointsDisplay(classroomApproved)}
                    </p>
                    <p className="text-xs text-[var(--cc-text-muted)] mt-1">Semester · instructor-approved</p>
                  </div>
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--muted)] text-center sm:text-left">
                    <p className="text-sm font-medium text-[var(--cc-text)]">Tradable to peers</p>
                    <p className="text-2xl font-bold text-[var(--cc-text)] tabular-nums mt-1">
                      {formatPointsDisplay(classroomTradable)}
                    </p>
                    <p className="text-xs text-[var(--cc-text-muted)] mt-1">
                      After a {classroomMinReserve}-point reserve for full classroom grade
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--muted)] text-center sm:text-left">
                    <p className="text-sm font-medium text-[var(--cc-text)]">Use in Trade Center</p>
                    <p className="text-sm text-[var(--cc-text)] mt-2 leading-relaxed">
                      Classroom points do not add to weekly activity totals. Trade them in{" "}
                      <button
                        type="button"
                        className={cn("font-semibold underline-offset-2 hover:underline", theme.page.iconText)}
                        onClick={() => setActiveTab("peers")}
                      >
                        Peer Exchange
                      </button>{" "}
                      once you have more than {classroomMinReserve} approved.
                    </p>
                  </div>
                </div>
              </div>

              {/* How Points Work - collapsible info */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className={cn("p-2 rounded-lg", pageTheme.iconBg)}>
                    <Info className={cn("h-4 w-4", iconAccent)} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[var(--cc-text)]">How Points Work</h3>
                    <p className="text-xs text-[var(--cc-text-muted)]">Weekly accumulation · Resets Monday</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--muted)]">
                    <Brain className={cn("h-4 w-4 mt-0.5 shrink-0", theme.page.iconText)} />
                    <div>
                      <p className="text-sm font-medium text-[var(--cc-text)]">Practice Hub + Sample Practice</p>
                      <p className="text-xs text-[var(--cc-text-muted)]">8 pts/Hub attempt + 8/4 pts per sample question, max {practiceCap}/week</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--muted)]">
                    <Code className={cn("h-4 w-4 mt-0.5 shrink-0", theme.page.iconText)} />
                    <div>
                      <p className="text-sm font-medium text-[var(--cc-text)]">Playground</p>
                      <p className="text-xs text-[var(--cc-text-muted)]">12 pts/session + score bonus, max {playgroundCap}/week</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--muted)]">
                    <BookOpen className={cn("h-4 w-4 mt-0.5 shrink-0", theme.page.iconText)} />
                    <div>
                      <p className="text-sm font-medium text-[var(--cc-text)]">Lecture Reading</p>
                      <p className="text-xs text-[var(--cc-text-muted)]">1 pt per slide/page opened, max {readingCap}/week</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-[var(--cc-text-muted)] flex items-start gap-2 mt-3">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Points reset weekly on Monday for new earning caps only — unused tradable points carry forward. Trade {pointsPerEc} pts for 1 EC.
                </p>
              </div>

              <TradeHistoryCard
                title="Your trade activity"
                subtitle="EC conversions, rollover trades, extra attempts, peer exchanges, and requests — newest first"
                rows={unifiedHistory}
                empty="No trade activity yet. Use the other tabs to trade for EC, rollover, extra attempts, or exchange with peers."
                max={15}
              />
            </div>
          </div>
        </TabsContent>

        {/* Trade for EC Tab */}
        <TabsContent value="trade-ec" className="mt-0">
          <div className={tabSectionOuterTall}>
            <div className={tabContentNarrow}>
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="inline-flex p-3 rounded-2xl bg-[var(--cc-accent-soft)] ring-1 ring-[var(--cc-accent-border)]">
                  <Sparkles className="h-8 w-8 text-[var(--cc-accent-dark)]" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--cc-text)]">Convert Points to Engagement Credits</h3>
                <p className="text-sm text-[var(--cc-text-muted)]">{pointsPerEc} activity points = 1 EC (max {maxEC} EC from trades)</p>
              </div>

              {/* Conversion rate pill */}
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--cc-accent-soft)] border border-[var(--cc-accent-border)]">
                  <span className="text-sm font-medium text-[var(--cc-text-muted)]">Rate:</span>
                  <span className="font-semibold text-[var(--cc-accent-dark)]">{pointsPerEc} pts → 1 EC</span>
                </div>
              </div>

              {/* Form card */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="pointsToTrade" className="text-sm font-medium text-[var(--cc-text)]">Points to trade</Label>
                  <Input
                    id="pointsToTrade"
                    type="number"
                    min={pointsPerEc}
                    max={totalPoints}
                    value={pointsToTrade}
                    onChange={(e) => setPointsToTrade(e.target.value)}
                    placeholder={`Min: ${pointsPerEc}`}
                    className="rounded-xl border-[var(--border)] h-12 text-lg"
                  />
                </div>
                {pointsToTrade && parseInt(pointsToTrade) >= pointsPerEc && (
                  <div className="p-4 rounded-xl bg-[var(--cc-accent-soft)] border border-[var(--cc-accent-border)]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--cc-text-muted)]">You will receive</span>
                      <span className="text-xl font-bold text-[var(--cc-accent-dark)]">{Math.floor(parseInt(pointsToTrade) / pointsPerEc)} EC</span>
                    </div>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-[var(--cc-text-muted)]">
                  <div className="flex items-center gap-3">
                    <span>Available: {totalPoints.toLocaleString()} pts</span>
                    <span>Balance: {engagementCredits} / {maxEC} EC</span>
                  </div>
                  <div className="flex items-center gap-1">{syncRefreshButtons}</div>
                </div>
                <Button
                  onClick={handleTrade}
                  disabled={
                    trading ||
                    !tradingEnabled ||
                    !pointsToTrade ||
                    parseInt(pointsToTrade) < pointsPerEc ||
                    parseInt(pointsToTrade) > totalPoints
                  }
                  variant="ghost"
                  className={cn("w-full rounded-xl h-12 font-medium", PORTAL_CTA)}
                >
                  {trading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Execute Trade
                    </>
                  )}
                </Button>
                {engagementCredits >= maxEC && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--cc-accent-soft)] border border-[var(--cc-accent-border)]">
                    <AlertCircle className="h-4 w-4 text-[var(--cc-accent-dark)] mt-0.5 shrink-0" />
                    <p className="text-xs text-[var(--cc-accent-dark)]">Maximum EC reached. Consider donating excess points to support peers in Peer Exchange.</p>
                  </div>
                )}
                {!tradingEnabled && (
                  <div className={cn("flex items-start gap-2 p-3 rounded-xl border", softTile)}>
                    <AlertCircle className={cn("h-4 w-4 mt-0.5 shrink-0", iconAccent)} />
                    <p className="text-xs text-[var(--cc-text)]">EC trading is currently disabled for your section.</p>
                  </div>
                )}
              </div>

              <TradeHistoryCard
                title="EC trade history"
                subtitle={`Trades that converted weekly activity points into engagement credits (${pointsPerEc} pts = 1 EC)`}
                rows={ecHistoryRows}
                empty="You have not traded for EC yet."
                max={12}
              />
            </div>
          </div>
        </TabsContent>

        {/* Points for Rollover Tab */}
        <TabsContent value="rollover" className="mt-0">
          <div className={cn(tabSectionOuterTall, !embedInDashboard && "justify-center")}>
            {rolloverLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-[var(--cc-accent)] mb-4" />
                <p className="text-sm text-[var(--cc-text-muted)]">Loading your grade data...</p>
              </div>
            ) : rolloverData ? (
              <div className={tabContentNarrow}>
                {governanceBlockedBanner}
                {/* Header - centered */}
                <div className="text-center space-y-2">
                  <div className="inline-flex p-3 rounded-2xl bg-[var(--cc-accent-soft)] ring-1 ring-[var(--cc-accent-border)]">
                    <FileQuestion className="h-8 w-8 text-[var(--cc-accent-dark)]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--cc-text)]">Trade Grade Points for Extension</h3>
                  <p className="text-sm text-[var(--cc-text-muted)] max-w-md mx-auto">
                    Use points from any grade category (on the 100% scale) to get extra time on a past-due assessment.
                  </p>
                </div>

                {/* Pricing pills */}
                <div className="flex justify-center gap-4">
                  <div
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-colors cursor-pointer ${
                      rolloverHours === 12
                        ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                        : "border-[var(--border)] bg-[var(--muted)] text-[var(--cc-text-muted)]"
                    }`}
                    onClick={() => setRolloverHours(12)}
                  >
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">12 hr</span>
                    <span className="text-xs opacity-80">= 10 pts</span>
                  </div>
                  <div
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-colors cursor-pointer ${
                      rolloverHours === 24
                        ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                        : "border-[var(--border)] bg-[var(--muted)] text-[var(--cc-text-muted)]"
                    }`}
                    onClick={() => setRolloverHours(24)}
                  >
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">24+ hr</span>
                    <span className="text-xs opacity-80">= 20 pts</span>
                  </div>
                </div>

                {/* Form card */}
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm space-y-5">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border)]">
                    <span className="text-sm font-medium text-[var(--cc-text-muted)]">Trade grade points for extension</span>
                    <div className="flex items-center gap-1">{syncRefreshButtons}</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[var(--cc-text)]">1. Assessment to extend</Label>
                    <Select value={rolloverQuizId} onValueChange={setRolloverQuizId}>
                      <SelectTrigger className="rounded-xl border-[var(--border)] h-11">
                        <SelectValue placeholder="Select assessment..." />
                      </SelectTrigger>
                      <SelectContent>
                        {rolloverData.assessments.map((a) => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            {a.title} ({a.assessment_type.replace("_", " ")})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {rolloverData.assessments.length === 0 && (
                      <p className="text-xs text-[var(--cc-text-muted)]">No past-due assessments with rollover available.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[var(--cc-text)]">2. Extension length</Label>
                    <Select value={String(rolloverHours)} onValueChange={(v) => setRolloverHours(v === "24" ? 24 : 12)}>
                      <SelectTrigger className="rounded-xl border-[var(--border)] h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">12 hours (10 pts)</SelectItem>
                        <SelectItem value="24">24+ hours (20 pts)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[var(--cc-text)]">3. Deduct points from</Label>
                    <Select value={rolloverSourceCategory} onValueChange={setRolloverSourceCategory}>
                      <SelectTrigger className="rounded-xl border-[var(--border)] h-11">
                        <SelectValue placeholder="Select category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(rolloverData.categories).map(([cat, data]) => {
                          const label =
                            cat === "quiz"
                              ? "Quizzes"
                              : cat === "homework"
                                ? "Homework"
                                : cat === "midterm"
                                  ? "Mid-semester"
                                  : cat === "final"
                                    ? "Finals"
                                    : cat === "attendance"
                                      ? "Attendance"
                                      : cat === "project"
                                        ? "Projects"
                                        : cat === "classroom"
                                          ? "Classroom"
                                          : "Engagement"
                          const cost = rolloverHours === 12 ? 10 : 20
                          const canUse = data.available >= cost
                          return (
                            <SelectItem key={cat} value={cat} disabled={!canUse}>
                              {label}: {data.available.toFixed(0)} pts {!canUse && `(need ${cost})`}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleRolloverTrade}
                    disabled={
                      rolloverTrading ||
                      tradeCenterRedemptionsBlocked ||
                      !rolloverQuizId ||
                      !rolloverSourceCategory ||
                      rolloverData.assessments.length === 0
                    }
                    variant="ghost"
                  className={cn("w-full rounded-xl h-12 font-medium", PORTAL_CTA)}
                  >
                    {rolloverTrading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Clock className="h-4 w-4 mr-2" />
                        Apply trade for rollover
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-xs text-[var(--cc-text-muted)] text-center max-w-sm mx-auto">
                  Points are deducted from the 100% scale of the selected category (e.g. 100 → 90). Your weighted grade updates accordingly.
                </p>

                <TradeHistoryCard
                  title="Rollover trade history"
                  subtitle="Grade points you traded for extra time on past-due assessments"
                  rows={rolloverHistoryRows}
                  empty="No rollover trades yet."
                  max={12}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileQuestion className="h-12 w-12 text-[var(--cc-text-muted)] opacity-50 mb-3" />
                <p className="text-sm text-[var(--cc-text-muted)]">Grade data loading...</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Points for Extra Attempts Tab */}
        <TabsContent value="extra-attempts" className="mt-0">
          <div className={cn(tabSectionOuterTall, !embedInDashboard && "justify-center")}>
            {extraAttemptsLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-[var(--cc-accent)] mb-4" />
                <p className="text-sm text-[var(--cc-text-muted)]">Loading your grade data...</p>
              </div>
            ) : extraAttemptsData ? (
              <div className={tabContentNarrow}>
                {governanceBlockedBanner}
                <div className="text-center space-y-2">
                  <div className={cn("inline-flex p-3 rounded-2xl ring-1 ring-[var(--cc-accent-border)]", theme.page.iconBg)}>
                    <RotateCw className={cn("h-8 w-8", theme.page.iconText)} />
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--cc-text)]">Trade Grade Points for Extra Attempts</h3>
                  <p className="text-sm text-[var(--cc-text-muted)] max-w-md mx-auto">
                    Spend points from any grade category (on the 100% scale) to unlock additional attempts on quizzes, homework, or midterms in your section.
                  </p>
                </div>

                <div className="flex justify-center gap-4">
                  <div
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-colors cursor-pointer ${
                      extraAttemptsCount === 1
                        ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                        : "border-[var(--border)] bg-[var(--muted)] text-[var(--cc-text-muted)]"
                    }`}
                    onClick={() => setExtraAttemptsCount(1)}
                  >
                    <RotateCw className="h-4 w-4" />
                    <span className="font-medium">+1 attempt</span>
                    <span className="text-xs opacity-80">= 10 pts</span>
                  </div>
                  <div
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-colors cursor-pointer ${
                      extraAttemptsCount === 2
                        ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                        : "border-[var(--border)] bg-[var(--muted)] text-[var(--cc-text-muted)]"
                    }`}
                    onClick={() => setExtraAttemptsCount(2)}
                  >
                    <RotateCw className="h-4 w-4" />
                    <span className="font-medium">+2 attempts</span>
                    <span className="text-xs opacity-80">= 18 pts</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm space-y-5">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border)]">
                    <span className="text-sm font-medium text-[var(--cc-text-muted)]">Trade grade points for attempts</span>
                    <div className="flex items-center gap-1">{syncRefreshButtons}</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[var(--cc-text)]">1. Assessment</Label>
                    <Select value={extraAttemptsQuizId} onValueChange={setExtraAttemptsQuizId}>
                      <SelectTrigger className="rounded-xl border-[var(--border)] h-11">
                        <SelectValue placeholder="Select assessment..." />
                      </SelectTrigger>
                      <SelectContent>
                        {extraAttemptsData.assessments.map((a) => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            {a.title} ({a.assessment_type.replace("_", " ")})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {extraAttemptsData.assessments.length === 0 && (
                      <p className="text-xs text-[var(--cc-text-muted)]">No assessments available in your section.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[var(--cc-text)]">2. Number of attempts</Label>
                    <Select
                      value={String(extraAttemptsCount)}
                      onValueChange={(v) => setExtraAttemptsCount(v === "2" ? 2 : 1)}
                    >
                      <SelectTrigger className="rounded-xl border-[var(--border)] h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">+1 attempt (10 pts)</SelectItem>
                        <SelectItem value="2">+2 attempts (18 pts)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[var(--cc-text)]">3. Deduct points from</Label>
                    <Select value={extraAttemptsSourceCategory} onValueChange={setExtraAttemptsSourceCategory}>
                      <SelectTrigger className="rounded-xl border-[var(--border)] h-11">
                        <SelectValue placeholder="Select category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(extraAttemptsData.categories).map(([cat, data]) => {
                          const cost = extraAttemptsCount === 1 ? 10 : 18
                          const canUse = data.available >= cost
                          return (
                            <SelectItem key={cat} value={cat} disabled={!canUse}>
                              {gradeCategoryLabel(cat)}: {data.available.toFixed(0)} pts {!canUse && `(need ${cost})`}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleExtraAttemptsTrade}
                    disabled={
                      extraAttemptsTrading ||
                      tradeCenterRedemptionsBlocked ||
                      !extraAttemptsQuizId ||
                      !extraAttemptsSourceCategory ||
                      extraAttemptsData.assessments.length === 0
                    }
                    variant="ghost"
                    className={cn("w-full rounded-xl h-12 font-medium", PORTAL_CTA)}
                  >
                    {extraAttemptsTrading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <RotateCw className="h-4 w-4 mr-2" />
                        Apply trade for extra attempts
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-xs text-[var(--cc-text-muted)] text-center max-w-sm mx-auto">
                  Attempts stack if you trade again. Points are deducted from the 100% scale of the selected category and your weighted grade updates accordingly.
                </p>

                <TradeHistoryCard
                  title="Extra attempts trade history"
                  subtitle="Grade points you traded for additional attempts on assessments"
                  rows={extraAttemptsHistoryRows}
                  empty="No extra attempt trades yet."
                  max={12}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <RotateCw className="h-12 w-12 text-[var(--cc-text-muted)] opacity-50 mb-3" />
                <p className="text-sm text-[var(--cc-text-muted)]">Grade data loading...</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Peer Exchange Tab */}
        <TabsContent value="peers" className="mt-0">
          <div className={tabSectionOuter}>
            <div className={tabContentWide}>
              {/* Header */}
              <div className="text-center space-y-2">
                <div className={cn("inline-flex p-3 rounded-2xl ring-1 ring-[var(--cc-accent-border)]", theme.page.iconBg)}>
                  <Users className={cn("h-8 w-8", theme.page.iconText)} />
                </div>
                <h3 className="text-lg font-semibold text-[var(--cc-text)]">Peer Exchange</h3>
                <p className="text-sm text-[var(--cc-text-muted)] max-w-md mx-auto">
                  Donate activity or <strong>classroom</strong> points to a colleague, or request points from peers. Donations and instructor-finalized transfers need instructor approval. Classroom trades keep a {classroomMinReserve}-point floor—you can only give points above that total.
                </p>
              </div>

              {/* Donate & Request cards */}
              <div className="grid items-stretch gap-4 md:grid-cols-2 md:gap-5">
                {/* Donate to Peer */}
                <div className={peerExchangeCard}>
                  <div className="mb-4 flex min-h-11 items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className={peerExchangeIconWrap}>
                        <Gift className={cn("h-5 w-5", theme.page.iconText)} />
                      </div>
                      <h4 className="font-semibold text-[var(--cc-text)]">Donate to Peer</h4>
                    </div>
                    {!embedInDashboard ? (
                      <div className="flex shrink-0 items-center gap-1">{syncRefreshButtons}</div>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-[var(--cc-text)]">Recipient</Label>
                      <Select value={donationRecipientId} onValueChange={setDonationRecipientId}>
                        <SelectTrigger className="rounded-xl border-[var(--border)] h-11">
                          <SelectValue placeholder="Select a peer..." />
                        </SelectTrigger>
                        <SelectContent>
                          {peers.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.display_label || p.student_id} ({p.student_id})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-[var(--cc-text)]">Points Source</Label>
                      <Select
                        value={donationSource}
                        onValueChange={(v: "practice" | "playground" | "reading" | "total" | "classroom") => setDonationSource(v)}
                      >
                        <SelectTrigger className="rounded-xl border-[var(--border)] h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="practice">Practice Hub ({practicePoints} pts)</SelectItem>
                          <SelectItem value="playground">Playground ({playgroundPoints} pts)</SelectItem>
                          <SelectItem value="reading">Lecture Reading ({readingPoints} pts)</SelectItem>
                          <SelectItem value="total">Activity total ({totalPoints} pts)</SelectItem>
                          <SelectItem value="classroom" disabled={classroomTradable <= 0}>
                            Classroom — {classroomTradable} tradable (approved {classroomApproved}, min reserve {classroomMinReserve})
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="donationPoints" className="text-sm font-medium text-[var(--cc-text)]">Points (min 100)</Label>
                      <Input
                        id="donationPoints"
                        type="number"
                        min="100"
                        max={donationSource === "classroom" ? Math.max(classroomTradable, 100) : totalPoints}
                        value={donationPoints}
                        onChange={(e) => setDonationPoints(e.target.value)}
                        placeholder="100"
                        className="rounded-xl border-[var(--border)] h-11"
                      />
                    </div>
                    <div className="pointer-events-none invisible space-y-2 select-none" aria-hidden>
                      <Label className="text-sm font-medium text-[var(--cc-text)]">Message (optional)</Label>
                      <div className="min-h-[88px] rounded-xl border border-[var(--border)]" />
                    </div>
                    <Button
                      onClick={handleDonate}
                      disabled={donating || !donationPoints || parseInt(donationPoints) < 100 || !donationRecipientId}
                      variant="ghost"
                      className={cn("mt-auto w-full shrink-0 rounded-xl h-11", PORTAL_CTA)}
                    >
                      {donating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Gift className="h-4 w-4 mr-2" />}
                      {donating ? "Submitting..." : "Submit Donation Request"}
                    </Button>
                  </div>
                </div>

                {/* Request Points from Peer */}
                <div className={peerExchangeCard}>
                  <div className="mb-4 flex min-h-11 items-center gap-2">
                    <div className={peerExchangeIconWrap}>
                      <Send className={cn("h-5 w-5", theme.page.iconText)} />
                    </div>
                    <h4 className="font-semibold text-[var(--cc-text)]">Request Points</h4>
                  </div>
                  <div className="flex flex-1 flex-col gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-[var(--cc-text)]">Request From</Label>
                      <Select value={requestPeerId} onValueChange={setRequestPeerId}>
                        <SelectTrigger className="rounded-xl border-[var(--border)] h-11">
                          <SelectValue placeholder="Select a peer..." />
                        </SelectTrigger>
                        <SelectContent>
                          {peers.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.display_label || p.student_id} ({p.student_id})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-[var(--cc-text)]">Points Source</Label>
                      <Select
                        value={requestSource}
                        onValueChange={(v: "practice" | "playground" | "reading" | "total" | "classroom") => setRequestSource(v)}
                      >
                        <SelectTrigger className="rounded-xl border-[var(--border)] h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="practice">Practice Hub</SelectItem>
                          <SelectItem value="playground">Playground</SelectItem>
                          <SelectItem value="reading">Lecture Reading</SelectItem>
                          <SelectItem value="total">Activity total</SelectItem>
                          <SelectItem value="classroom">
                            Classroom (peer needs {CLASSROOM_POINTS_FOR_FULL_GRADE}+ approved, tradable balance)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-[var(--cc-text)]">Points (min 100)</Label>
                      <Input
                        type="number"
                        min="100"
                        value={requestPoints}
                        onChange={(e) => setRequestPoints(e.target.value)}
                        placeholder="100"
                        className="rounded-xl border-[var(--border)] h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-[var(--cc-text)]">Message (optional)</Label>
                      <Textarea
                        value={requestMessage}
                        onChange={(e) => setRequestMessage(e.target.value)}
                        placeholder="e.g. I need a few more points for EC..."
                        rows={3}
                        className="min-h-[88px] resize-none rounded-xl border-[var(--border)]"
                      />
                    </div>
                    <Button
                      onClick={handleRequestPoints}
                      disabled={requesting || !requestPoints || parseInt(requestPoints) < 100 || !requestPeerId}
                      variant="ghost"
                      className={cn("mt-auto w-full shrink-0 rounded-xl h-11", PORTAL_CTA)}
                    >
                      {requesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                      {requesting ? "Sending..." : "Send Request"}
                    </Button>
                  </div>
                </div>
              </div>

              <TradeHistoryCard
                title="Peer exchange history"
                subtitle="Completed transfers, community donations, and all donation/point requests"
                rows={peerHistoryRows}
                empty="No peer or community trade activity yet."
                max={15}
              />

              {/* My Donations & Requests */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
            <h3 className="text-base font-semibold text-[var(--cc-text)] mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" />
              My Donations & Requests
            </h3>
            {(donationRequests.length > 0 || pointRequests.length > 0) ? (
              <div className="space-y-3">
                {donationRequests.slice(0, 10).map((dr: any) => (
                  <div key={`dr-${dr.id}`} className="flex items-center justify-between p-3 rounded-xl bg-[var(--muted)] border border-[var(--border)]">
                    <div>
                      <p className="text-sm font-medium text-[var(--cc-text)]">
                        Donate {dr.points} pts ({sourceLabel(dr.source)}) → <span className="blur-[6px] select-none">Student</span>
                      </p>
                      <p className="text-xs text-[var(--cc-text-muted)] flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {new Date(dr.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge
                      variant={dr.status === "approved" ? "secondary" : dr.status === "rejected" ? "destructive" : "secondary"}
                      className={cn("shrink-0", dr.status === "approved" && portalStatusBadgeClass(theme))}
                    >
                      {dr.status === "pending" && "Pending"}
                      {dr.status === "approved" && <><CheckCircle className="h-3 w-3 mr-1" />Approved</>}
                      {dr.status === "rejected" && <><XCircle className="h-3 w-3 mr-1" />Rejected</>}
                    </Badge>
                  </div>
                ))}
                {pointRequests.slice(0, 10).map((pr: any) => (
                  <div key={`pr-${pr.id}`} className="flex items-center justify-between p-3 rounded-xl bg-[var(--muted)] border border-[var(--border)]">
                    <div>
                      <p className="text-sm font-medium text-[var(--cc-text)]">
                        {pr.requester_id === studentId
                          ? `Request ${pr.points} pts from a classmate`
                          : `A classmate requests ${pr.points} pts from you`}
                      </p>
                      <p className="text-xs text-[var(--cc-text-muted)] flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {new Date(pr.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {pr.requestee_id === studentId && pr.status === "pending" && (
                        <>
                          <Button size="sm" variant="outline" className={cn("rounded-lg h-8", portalOutlineButtonClass(theme))} onClick={() => handleApproveRequest(pr.id)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-lg h-8 text-red-600" onClick={() => handleRejectRequest(pr.id)}>
                            Decline
                          </Button>
                        </>
                      )}
                      {pr.status !== "pending" && (
                        <Badge
                          variant={pr.status.includes("approved") ? "secondary" : pr.status.includes("rejected") ? "destructive" : "secondary"}
                          className={cn(pr.status.includes("approved") && portalStatusBadgeClass(theme))}
                        >
                          {pr.status === "pending_instructor" && "Awaiting instructor"}
                          {pr.status === "approved_by_instructor" && "Approved"}
                          {pr.status === "rejected_by_peer" && "Declined"}
                          {pr.status === "rejected_by_instructor" && "Rejected"}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--cc-text-muted)] py-8 text-center">
                No donations or requests yet. Donate to a peer or request points above.
              </p>
            )}
              </div>
            </div>
          </div>
        </TabsContent>
        </div>
  )

  if (embedInDashboard) {
    return (
      <StudentModuleHubLayout
        moduleId="trade-center"
        title="Trade Center"
        metaLine={tradeHubMetaLine}
        metaSuffix="trade activity points for perks and extensions"
        headerAction={syncRefreshButtons}
        menuView={activeTab}
        onMenuSelect={setActiveTab}
        menuItems={tradeCenterMenuItems}
        loading={loading}
        loadingRows={8}
        scrollMode="panel"
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className={embedTabsShellClass}>
          {tabPanels}
        </Tabs>
      </StudentModuleHubLayout>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-[var(--border)]">
          <TabsTrigger value="overview" className={tradeCenterTabTriggerClass}>
            <TrendingUp className="h-4 w-4 shrink-0" />
            <span className="truncate">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="trade-ec" className={tradeCenterTabTriggerClass}>
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="truncate">Trade for EC</span>
          </TabsTrigger>
          <TabsTrigger value="rollover" className={tradeCenterTabTriggerClass}>
            <FileQuestion className="h-4 w-4 shrink-0" />
            <span className="truncate">Points for Rollover</span>
          </TabsTrigger>
          <TabsTrigger value="extra-attempts" className={tradeCenterTabTriggerClass}>
            <RotateCw className="h-4 w-4 shrink-0" />
            <span className="truncate">Extra Attempts</span>
          </TabsTrigger>
          <TabsTrigger value="peers" className={cn(tradeCenterTabTriggerClass, "flex-wrap")}>
            <Users className="h-4 w-4 shrink-0" />
            <span className="truncate">Peer Exchange</span>
            {(donationRequests.length > 0 || pointRequests.length > 0) && (
              <Badge variant="secondary" className="ml-auto h-5 min-w-5 px-1.5 text-xs shrink-0">
                {donationRequests.length + pointRequests.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        {tabPanels}
      </Tabs>
    </div>
  )
}
