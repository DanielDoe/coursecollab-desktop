"use client"


import { studentApiFetch } from "@/lib/auth"
import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import {
  Receipt,
  Download,
  RotateCcw,
  Loader2,
  CheckCircle2,
  Clock,
  CreditCard,
  Filter,
  RefreshCw,
  XCircle,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme, studentModuleSpinnerClass } from "@/lib/student-module-themes"
import { portalOutlineButtonClass } from "@/lib/portal-module-themes"

const settingsTheme = getStudentModuleTheme("purchases")

type Purchase = {
  id: string
  chargeId?: string
  amount: number
  amountCents: number
  currency: string
  status: string
  paidAt: string
  description: string
  invoicePdf?: string
  hostedInvoiceUrl?: string
  subscriptionId?: string
  canRequestRefund: boolean
  refundWindowDays: number
  refundRequestStatus?: string | null
}

type Subscription = {
  id: string
  status: string
  planName: string
  amount: number
  currency: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  created: string
}

const TIME_FILTERS = [
  { value: "all", label: "All time" },
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 2 weeks" },
  { value: "30", label: "Last 1 month" },
  { value: "90", label: "Last 3 months" },
] as const

export default function PurchaseHistoryPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelingSubId, setCancelingSubId] = useState<string | null>(null)
  const [refundReason, setRefundReason] = useState("")
  const [submittingRefund, setSubmittingRefund] = useState<string | null>(null)
  const [refundDialogOpen, setRefundDialogOpen] = useState(false)
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null)
  const [timeFilter, setTimeFilter] = useState<string>("all")

  const filteredPurchases = useMemo(() => {
    if (timeFilter === "all") return purchases
    const days = parseInt(timeFilter, 10)
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    return purchases.filter((p) => new Date(p.paidAt).getTime() >= cutoff)
  }, [purchases, timeFilter])

  const fetchData = () => {
    const dbId = sessionStorage.getItem("studentDatabaseId")
    if (!dbId) return
    return studentApiFetch(`/api/student/purchases?studentId=${dbId}`)
      .then((r) => (r.ok ? r.json() : { purchases: [], subscriptions: [] }))
      .then((data) => {
        setPurchases(data.purchases || [])
        setSubscriptions(data.subscriptions || [])
      })
      .catch(() => {
        setPurchases([])
        setSubscriptions([])
      })
  }

  useEffect(() => {
    const dbId = sessionStorage.getItem("studentDatabaseId")
    if (!dbId) {
      router.push("/student/login")
      return
    }
    fetchData().finally(() => setLoading(false))
  }, [router])

  const handleRequestRefund = async (purchase: Purchase) => {
    const dbId = sessionStorage.getItem("studentDatabaseId")
    if (!dbId) return

    setSubmittingRefund(purchase.id)
    try {
      const res = await studentApiFetch("/api/student/purchases/refund-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: dbId,
          stripeInvoiceId: purchase.id.startsWith("in_") ? purchase.id : undefined,
          stripeChargeId: purchase.chargeId || (purchase.id.startsWith("ch_") ? purchase.id : undefined),
          amountCents: purchase.amountCents,
          reason: refundReason,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit refund request")
      }

      toast({
        title: "Refund Request Submitted",
        description: data.message || "We'll review your request within 1-2 business days.",
      })
      setRefundDialogOpen(false)
      setSelectedPurchase(null)
      setRefundReason("")
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit",
        variant: "destructive",
      })
    } finally {
      setSubmittingRefund(null)
    }
  }

  const openRefundDialog = (purchase: Purchase) => {
    setSelectedPurchase(purchase)
    setRefundReason("")
    setRefundDialogOpen(true)
  }

  const handleCancelSubscription = async (sub: Subscription) => {
    const dbId = sessionStorage.getItem("studentDatabaseId")
    if (!dbId) return

    setCancelingSubId(sub.id)
    try {
      const res = await fetch("/api/membership/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: dbId, subscriptionId: sub.id }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to cancel")
      }

      toast({
        title: "Subscription Canceled",
        description: data.message || "Your subscription will end at the end of the billing period.",
      })
      fetchData()
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to cancel",
        variant: "destructive",
      })
    } finally {
      setCancelingSubId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <Loader2 className={cn("h-8 w-8 animate-spin", settingsTheme.page.iconText)} />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dashboard-v2-fg tracking-tight">
            Purchase History
          </h1>
          <p className="text-dashboard-v2-muted mt-1">
            View your billing history and manage purchases
          </p>
        </div>
        <Select value={timeFilter} onValueChange={setTimeFilter}>
          <SelectTrigger className="w-full sm:w-[180px] rounded-lg dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-100">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by time" />
          </SelectTrigger>
          <SelectContent className="dark:bg-slate-900 dark:border-slate-700">
            {TIME_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active Subscriptions */}
      {subscriptions.filter((s) => s.status === "active" || s.status === "trialing").length > 0 && (
        <Card className="rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-slate-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className={cn("h-5 w-5", settingsTheme.page.iconText)} />
              Active Subscriptions
            </CardTitle>
            <CardDescription>
              Manage your subscriptions. Cancel any duplicate or unwanted subscription.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {subscriptions
              .filter((s) => s.status === "active" || s.status === "trialing")
              .map((sub) => (
                <div
                  key={sub.id}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border",
                    settingsTheme.page.border,
                    settingsTheme.page.softBg,
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white">
                      {sub.planName} — ${sub.amount.toFixed(2)}/month
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1">
                      <Clock className="h-3.5 w-3.5" />
                      {sub.cancelAtPeriodEnd
                        ? `Ends ${new Date(sub.currentPeriodEnd).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}`
                        : `Next billing: ${new Date(sub.currentPeriodEnd).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}`}
                    </p>
                    {subscriptions.filter((s) => s.status === "active" || s.status === "trialing").length > 1 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        Duplicate detected — cancel this one to avoid double billing
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/30 shrink-0"
                    onClick={() => handleCancelSubscription(sub)}
                    disabled={!!cancelingSubId || sub.cancelAtPeriodEnd}
                  >
                    {cancelingSubId === sub.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-1.5" />
                    )}
                    {sub.cancelAtPeriodEnd ? "Ending soon" : "Cancel"}
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-slate-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className={cn("h-5 w-5", settingsTheme.page.iconText)} />
            Past Payments
          </CardTitle>
          <CardDescription>
            Invoices and one-time payments. Request refunds within 7 days. Use the filter to narrow by time range.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400">
              <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No purchases yet</p>
              <Button
                variant="link"
                className="mt-2"
                onClick={() => router.push("/student/dashboard-v2/membership")}
              >
                View membership plans
              </Button>
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="py-8 text-center text-slate-500 dark:text-slate-400">
              <Filter className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No purchases in this time range</p>
              <p className="text-sm mt-1">Try selecting &quot;All time&quot; or a different range</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPurchases.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-slate-800/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white">
                      ${p.amount.toFixed(2)} — {p.description}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(p.paidAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.invoicePdf && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="rounded-lg"
                      >
                        <a href={p.invoicePdf} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-1.5" />
                          Invoice
                        </a>
                      </Button>
                    )}
                    {p.refundRequestStatus ? (
                      <span className="text-xs text-slate-500 capitalize">
                        Refund {p.refundRequestStatus}
                      </span>
                    ) : p.canRequestRefund ? (
                      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn("rounded-lg", portalOutlineButtonClass(settingsTheme))}
                            onClick={() => openRefundDialog(p)}
                          >
                            <RotateCcw className="h-4 w-4 mr-1.5" />
                            Request Refund
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-2xl dark:bg-slate-900 dark:border-slate-700">
                          <DialogHeader>
                            <DialogTitle>Request Refund</DialogTitle>
                            <DialogDescription>
                              Request a full refund for ${selectedPurchase?.amount.toFixed(2)}. We offer a 7-day
                              money-back guarantee. Your request will be reviewed within 1-2 business days.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-2 py-2">
                            <Label htmlFor="reason">Reason (optional)</Label>
                            <Textarea
                              id="reason"
                              placeholder="e.g., Duplicate charge, changed my mind..."
                              value={refundReason}
                              onChange={(e) => setRefundReason(e.target.value)}
                              className="rounded-lg"
                              rows={3}
                            />
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setRefundDialogOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => selectedPurchase && handleRequestRefund(selectedPurchase)}
                              disabled={!!submittingRefund}
                              className={cn("text-white", settingsTheme.page.cta)}
                            >
                              {submittingRefund ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <RotateCcw className="h-4 w-4 mr-2" />
                              )}
                              Submit Request
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <span className="text-xs text-slate-500">
                        Refund window closed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className={cn("rounded-xl border p-4", settingsTheme.page.border, settingsTheme.page.softBg)}>
        <div className="flex gap-3">
          <CheckCircle2 className={cn("h-5 w-5 shrink-0 mt-0.5", settingsTheme.page.iconText)} />
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">7-Day Money-Back Guarantee</p>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              Not satisfied? Request a full refund within 7 days of purchase. See duplicate
              subscriptions? Cancel the extra one above. Contact support for questions.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
