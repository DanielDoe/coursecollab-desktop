"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Heart,
  Crown,
  Calendar,
  Download,
  RefreshCw,
  Search,
  Filter,
  ArrowLeft,
  Sparkles,
  BarChart3,
  ChartPie,
  Activity,
  Trash2,
  Edit,
  X,
  Receipt,
  Wallet,
  AlertCircle,
  EyeOff,
  UserX,
  Plus,
  Eye,
  Info,
  CreditCard,
  RotateCcw,
  Landmark,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface Donation {
  id: number
  amount: number
  donorName: string
  donorEmail: string | null
  message: string | null
  isAnonymous: boolean
  status: string
  createdAt: string
  transactionId?: string | null
  paymentMethod?: string | null
  errorMessage?: string | null
  failedAt?: string | null
  studentName: string | null
  studentNumber: string | null
}

interface Membership {
  id: number
  studentId: number
  studentName: string
  studentNumber: string
  tier: string
  status: string
  expiresAt: string | null
  autoRenew: boolean
  monthlyPrice: number
  createdAt: string
  updatedAt: string
}

interface Expense {
  id: number
  category: string
  description: string
  amount: number
  expenseDate: string
  vendor: string | null
  invoiceNumber: string | null
  notes: string | null
  status: string
  paymentMethod: string | null
  receiptUrl: string | null
  createdAt: string
  updatedAt: string
  createdBy: number | null
  createdByName: string | null
  deletedAt?: string | null
}

interface FinancialData {
  meta?: {
    membershipRevenueSource: "stripe_invoices" | "database"
    syncStripe: boolean
  }
  donations: Donation[]
  memberships: Membership[]
  deletedDonations: Donation[]
  deletedMemberships: Membership[]
  totals: {
    donations: number
    membershipRevenue: number
    total: number
  }
  monthlyBreakdown: {
    donations: Array<{ month: string; count: number; total: number }>
    memberships: Array<{ month: string; count: number; total: number }>
  }
}

const navItems = [
  {
    id: "overview",
    label: "Overview",
    icon: BarChart3,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    id: "donations",
    label: "Donations",
    icon: Heart,
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  {
    id: "memberships",
    label: "Memberships",
    icon: Crown,
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  {
    id: "expenses",
    label: "Expenses",
    icon: Receipt,
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  {
    id: "deletions",
    label: "Deleted Items",
    icon: Trash2,
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
]

export function FinancialManagement({ embedInDashboard = false }: { embedInDashboard?: boolean } = {}) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<FinancialData | null>(null)
  const dataRef = useRef<FinancialData | null>(null)
  const fetchControllerRef = useRef<AbortController | null>(null)
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isFetchingRef = useRef(false) // Keep latest data in ref for closure access
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [deletedExpenses, setDeletedExpenses] = useState<Expense[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterTier, setFilterTier] = useState<string>("all")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [activeTab, setActiveTab] = useState("overview")
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [createExpenseDialogOpen, setCreateExpenseDialogOpen] = useState(false)
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false)
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false)
  const [itemToPermanentlyDelete, setItemToPermanentlyDelete] = useState<{ type: 'donation' | 'membership' | 'expense', id: number } | null>(null)
  const [editingItem, setEditingItem] = useState<Donation | Membership | Expense | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [syncingPending, setSyncingPending] = useState(false)
  const [syncingMemberships, setSyncingMemberships] = useState(false)
  const [viewDetailsDialogOpen, setViewDetailsDialogOpen] = useState(false)
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null)
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false)
  const [resolvingDonation, setResolvingDonation] = useState(false)
  const [resolveAction, setResolveAction] = useState<'complete' | 'fail' | null>(null)
  const [resolveReason, setResolveReason] = useState("")
  const [expenseForm, setExpenseForm] = useState<any>({
    category: "Other",
    description: "",
    amount: "",
    expenseDate: new Date().toISOString().split('T')[0],
    vendor: "",
    invoiceNumber: "",
    notes: "",
    status: "paid",
    paymentMethod: "",
    receiptUrl: "",
  })

  // Load financials once on mount. Do not tie this to activeTab — switching Overview/Donations/Memberships
  // was re-running the full /api/admin/financials request every time (heavy Stripe + DB) and flooding dev logs.
  useEffect(() => {
    fetchFinancialData(true)
    return () => {
      fetchControllerRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Donations tab: optional Stripe pending sync (slow interval). No full financials refetch on tab change.
  useEffect(() => {
    let syncInterval: NodeJS.Timeout | null = null
    let initialDonationSyncTimer: NodeJS.Timeout | null = null
    let isTabVisible = !document.hidden

    if (activeTab === "donations") {
      initialDonationSyncTimer = setTimeout(() => {
        syncPendingDonations(true)
      }, 2000)
    }

    const startSyncPolling = () => {
      if (syncInterval) clearInterval(syncInterval)
      if (!isTabVisible || activeTab !== "donations") return

      syncInterval = setInterval(() => {
        if (!document.hidden && activeTab === "donations" && !isFetchingRef.current) {
          syncPendingDonations(true)
        }
      }, 120000)
    }

    const stopAllIntervals = () => {
      if (syncInterval) {
        clearInterval(syncInterval)
        syncInterval = null
      }
    }

    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden
      if (document.hidden) {
        stopAllIntervals()
      } else {
        startSyncPolling()
      }
    }

    startSyncPolling()
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      if (initialDonationSyncTimer) clearTimeout(initialDonationSyncTimer)
      stopAllIntervals()
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const sendReminderNotifications = async () => {
    try {
      const response = await fetch('/api/donations/send-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to send reminder notifications")
      }

      toast({
        title: "✅ Reminders Sent",
        description: `Sent ${result.sent} reminder notification(s) to students with pending donations.`,
      })

      return result
    } catch (error: any) {
      toast({
        title: "❌ Failed to Send Reminders",
        description: error.message || "Failed to send reminder notifications",
        variant: "destructive",
      })
      throw error
    }
  }

  const syncPendingDonations = async (silent: boolean = false) => {
    if (syncingPending) return // Prevent multiple simultaneous syncs
    
    setSyncingPending(true)
    try {
      const response = await fetch('/api/donations/sync-pending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // Sync all recent pending donations
      })

      const result = await response.json()

      if (response.ok) {
        const updated = result.updated || 0
        const checked = result.checked || 0
        
        if (updated > 0) {
          if (!silent) {
            toast({
              title: "✅ Sync Complete",
              description: `Updated ${updated} pending donation(s) to completed status.`,
            })
          }
          // Refresh data after sync
          await fetchFinancialData()
        }
        return { updated, checked }
      } else {
        throw new Error(result.error || "Failed to sync pending donations")
      }
    } catch (error: any) {
      if (!silent) {
        toast({
          title: "Error",
          description: error.message || "Failed to sync pending donations",
          variant: "destructive",
        })
      }
      return { updated: 0, checked: 0 }
    } finally {
      setSyncingPending(false)
    }
  }

  const fetchFinancialData = async (showLoading = false, syncStripe = false) => {
    // Cancel any in-flight requests (but allow initial load to proceed)
    if (fetchControllerRef.current && dataRef.current) {
      fetchControllerRef.current.abort()
    }
    
    // Prevent duplicate concurrent fetches (but allow if no data exists yet)
    if (isFetchingRef.current && dataRef.current) {
      return
    }
    
    isFetchingRef.current = true
    const controller = new AbortController()
    fetchControllerRef.current = controller
    
    try {
      if (showLoading || !dataRef.current) {
        setLoading(true)
      }
      const adminSession = localStorage.getItem("adminSession")
      const adminId = localStorage.getItem("adminId")
      
      // Try to get instructor ID from multiple sources
      let instructorId = localStorage.getItem("instructorId") || sessionStorage.getItem("instructorId")
      
      // If no instructor ID, try to get it from instructorSession
      if (!instructorId) {
        const instructorSessionStr = localStorage.getItem("instructorSession")
        if (instructorSessionStr) {
          try {
            const instructorSession = JSON.parse(instructorSessionStr)
            instructorId = instructorSession?.id?.toString()
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
      
      const headers: Record<string, string> = {}
      if (adminSession) {
        headers["Authorization"] = adminSession
      }
      if (adminId) {
        headers["x-admin-id"] = adminId
      }
      if (instructorId) {
        headers["x-instructor-id"] = instructorId
      }
      
      // If neither admin nor instructor credentials found, show helpful error
      if (!adminSession && !adminId && !instructorId) {
        throw new Error("No authentication found. Please log in as admin or instructor.")
      }
      
      // Admin routes support both admin and instructor authentication
      const apiRoute = "/api/admin/financials"

      // Add cache-busting timestamp to ensure fresh data
      const timestamp = new Date().getTime()
      const urlWithCache = `${apiRoute}?t=${timestamp}${syncStripe ? "&syncStripe=true" : ""}`
      
      const response = await fetch(urlWithCache, {
        method: "GET",
        headers,
        cache: 'no-store',
        signal: controller.signal,
      })

      if (response.ok) {
        try {
          const financialData = await response.json()
          dataRef.current = financialData
          setData(financialData)
          if (syncStripe) {
            toast({
              title: "Stripe revenue reconciled",
              description: "Membership totals reflect paid invoices from Stripe.",
            })
          }

          // Fetch expenses separately (admin routes support both admin and instructor)
          try {
            const expensesRoute = "/api/admin/financials/expenses"
            const expensesResponse = await fetch(expensesRoute, { 
              headers,
              signal: controller.signal,
            })
            if (expensesResponse.ok) {
              const expensesData = await expensesResponse.json()
              setExpenses(expensesData.expenses || [])
              setDeletedExpenses(expensesData.deletedExpenses || [])
            }
          } catch (e) {
            // Don't fail the entire request if expenses fail
            setExpenses([])
            setDeletedExpenses([])
          }
        } catch (parseError) {
          if (!controller.signal.aborted) {
            throw new Error("Failed to parse financial data response")
          }
        }
      } else {
        if (controller.signal.aborted) return
        
        const errorText = await response.text().catch(() => `Unable to read response body`)
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText || `HTTP ${response.status}` }
        }
        throw new Error(errorData.error || errorData.details || `Failed to fetch financial data (${response.status}: ${response.statusText})`)
      }
    } catch (error: any) {
      // Don't show error toast for aborted requests
      if (error?.name === 'AbortError') {
        return
      }
      
      // Extract meaningful error message
      let errorMessage = "Failed to load financial data. Please check your authentication and try again."
      if (error?.message) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error?.error) {
        errorMessage = error.error
      } else if (error?.details) {
        errorMessage = error.details
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      
      // Set empty data structure so UI doesn't break
      setData({
        donations: [],
        memberships: [],
        deletedDonations: [],
        deletedMemberships: [],
        totals: {
          donations: 0,
          membershipRevenue: 0,
          total: 0,
        },
        monthlyBreakdown: {
          donations: [],
          memberships: [],
        },
      })
    } finally {
      isFetchingRef.current = false
      setLoading(false)
    }
  }

  const handleEdit = (item: Donation | Membership | Expense) => {
    setEditingItem(item)
    if ('donorName' in item) {
      // Donation
      setEditForm({
        amount: item.amount,
        donorName: item.donorName,
        donorEmail: item.donorEmail || "",
        message: item.message || "",
        status: item.status,
        isAnonymous: item.isAnonymous || false,
      })
    } else if ('category' in item) {
      // Expense
      setEditForm({
        category: item.category,
        description: item.description,
        amount: item.amount,
        expenseDate: new Date(item.expenseDate).toISOString().split('T')[0],
        vendor: item.vendor || "",
        invoiceNumber: item.invoiceNumber || "",
        notes: item.notes || "",
        status: item.status,
        paymentMethod: item.paymentMethod || "",
        receiptUrl: item.receiptUrl || "",
      })
    } else {
      // Membership
      setEditForm({
        tier: item.tier,
        status: item.status,
        expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString().split('T')[0] : "",
        autoRenew: item.autoRenew,
      })
    }
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingItem) return

    try {
      const isDonation = 'donorName' in editingItem
      const isExpense = 'category' in editingItem
      
      let endpoint = ""
      if (isDonation) {
        endpoint = `/api/admin/financials/donations/${editingItem.id}`
      } else if (isExpense) {
        // Admin routes support both admin and instructor
        endpoint = `/api/admin/financials/expenses/${editingItem.id}`
      } else {
        endpoint = `/api/admin/financials/memberships/${editingItem.id}`
      }

      const adminSession = localStorage.getItem("adminSession")
      const adminId = localStorage.getItem("adminId")
      let instructorId = localStorage.getItem("instructorId") || sessionStorage.getItem("instructorId")
      
      if (!instructorId) {
        const instructorSessionStr = localStorage.getItem("instructorSession")
        if (instructorSessionStr) {
          try {
            const instructorSession = JSON.parse(instructorSessionStr)
            instructorId = instructorSession?.id?.toString()
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
      
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (adminSession) {
        headers["Authorization"] = adminSession
      }
      if (adminId) {
        headers["x-admin-id"] = adminId
      }
      if (instructorId) {
        headers["x-instructor-id"] = instructorId
      }

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers,
        body: JSON.stringify(editForm),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `${isDonation ? 'Donation' : isExpense ? 'Expense' : 'Membership'} updated successfully`,
        })
        setEditDialogOpen(false)
        setEditingItem(null)
        fetchFinancialData()
      } else {
        throw new Error("Failed to update")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update item",
        variant: "destructive",
      })
    }
  }

  const handleDelete = (item: Donation | Membership | Expense) => {
    setEditingItem(item)
    setDeleteDialogOpen(true)
  }

  const handleCreateExpense = () => {
    setExpenseForm({
      category: "Other",
      description: "",
      amount: "",
      expenseDate: new Date().toISOString().split('T')[0],
      vendor: "",
      invoiceNumber: "",
      notes: "",
      status: "paid",
      paymentMethod: "",
      receiptUrl: "",
    })
    setCreateExpenseDialogOpen(true)
  }

  const handleSaveExpense = async () => {
    try {
      const adminSession = localStorage.getItem("adminSession")
      const adminId = localStorage.getItem("adminId")
      let instructorId = localStorage.getItem("instructorId") || sessionStorage.getItem("instructorId")
      
      if (!instructorId) {
        const instructorSessionStr = localStorage.getItem("instructorSession")
        if (instructorSessionStr) {
          try {
            const instructorSession = JSON.parse(instructorSessionStr)
            instructorId = instructorSession?.id?.toString()
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
      
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (adminSession) {
        headers["Authorization"] = adminSession
      }
      if (adminId) {
        headers["x-admin-id"] = adminId
      }
      if (instructorId) {
        headers["x-instructor-id"] = instructorId
      }

      // Admin routes support both admin and instructor authentication
      const apiRoute = "/api/admin/financials/expenses"

      const response = await fetch(apiRoute, {
        method: "POST",
        headers,
        body: JSON.stringify(expenseForm),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Expense created successfully",
        })
        setCreateExpenseDialogOpen(false)
        setExpenseForm({
          category: "Other",
          description: "",
          amount: "",
          expenseDate: new Date().toISOString().split('T')[0],
          vendor: "",
          invoiceNumber: "",
          notes: "",
          status: "paid",
          paymentMethod: "",
          receiptUrl: "",
        })
        fetchFinancialData()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create expense")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create expense",
        variant: "destructive",
      })
    }
  }

  const handleConfirmDelete = async () => {
    if (!editingItem) return

    try {
      const isDonation = 'donorName' in editingItem
      const isExpense = 'category' in editingItem
      
      let endpoint = ""
      if (isDonation) {
        endpoint = `/api/admin/financials/donations/${editingItem.id}`
      } else if (isExpense) {
        // Admin routes support both admin and instructor
        endpoint = `/api/admin/financials/expenses/${editingItem.id}`
      } else {
        endpoint = `/api/admin/financials/memberships/${editingItem.id}`
      }

      const adminSession = localStorage.getItem("adminSession")
      const adminId = localStorage.getItem("adminId")
      let instructorId = localStorage.getItem("instructorId") || sessionStorage.getItem("instructorId")
      
      if (!instructorId) {
        const instructorSessionStr = localStorage.getItem("instructorSession")
        if (instructorSessionStr) {
          try {
            const instructorSession = JSON.parse(instructorSessionStr)
            instructorId = instructorSession?.id?.toString()
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
      
      const headers: Record<string, string> = {}
      if (adminSession) {
        headers["Authorization"] = adminSession
      }
      if (adminId) {
        headers["x-admin-id"] = adminId
      }
      if (instructorId) {
        headers["x-instructor-id"] = instructorId
      }

      const response = await fetch(endpoint, {
        method: "DELETE",
        headers,
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `${isDonation ? 'Donation' : isExpense ? 'Expense' : 'Membership'} deleted successfully`,
        })
        setDeleteDialogOpen(false)
        setEditingItem(null)
        fetchFinancialData()
      } else {
        throw new Error("Failed to delete")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      })
    }
  }

  const handlePermanentDelete = async (type: 'donation' | 'membership' | 'expense', id: number) => {
    setItemToPermanentlyDelete({ type, id })
    setPermanentDeleteDialogOpen(true)
  }

  const handleRestore = async (type: 'donation' | 'membership' | 'expense', id: number) => {
    try {
      const endpoint = type === 'donation' 
        ? `/api/admin/financials/donations/${id}/restore`
        : type === 'membership'
        ? `/api/admin/financials/memberships/${id}/restore`
        : `/api/admin/financials/expenses/${id}/restore`

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-instructor-id": localStorage.getItem("instructorId") || "",
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to restore")
      }

      toast({
        title: "Item Restored",
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} restored successfully`,
      })

      fetchFinancialData(false) // Don't show loading state on restore
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to restore item",
        variant: "destructive",
      })
    }
  }

  const confirmPermanentDelete = async () => {
    if (!itemToPermanentlyDelete) return

    const { type, id } = itemToPermanentlyDelete

    try {
      let endpoint = ""
      if (type === 'donation') {
        endpoint = `/api/admin/financials/donations/${id}?permanent=true`
      } else if (type === 'expense') {
        endpoint = `/api/admin/financials/expenses/${id}?permanent=true`
      } else {
        endpoint = `/api/admin/financials/memberships/${id}?permanent=true`
      }

      const adminSession = localStorage.getItem("adminSession")
      const adminId = localStorage.getItem("adminId")
      let instructorId = localStorage.getItem("instructorId") || sessionStorage.getItem("instructorId")
      
      if (!instructorId) {
        const instructorSessionStr = localStorage.getItem("instructorSession")
        if (instructorSessionStr) {
          try {
            const instructorSession = JSON.parse(instructorSessionStr)
            instructorId = instructorSession?.id?.toString()
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
      
      const headers: Record<string, string> = {}
      if (adminSession) {
        headers["Authorization"] = adminSession
      }
      if (adminId) {
        headers["x-admin-id"] = adminId
      }
      if (instructorId) {
        headers["x-instructor-id"] = instructorId
      }

      const response = await fetch(endpoint, {
        method: "DELETE",
        headers,
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `${type.charAt(0).toUpperCase() + type.slice(1)} permanently deleted`,
        })
        setPermanentDeleteDialogOpen(false)
        setItemToPermanentlyDelete(null)
        fetchFinancialData(false) // Don't show loading state on delete
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to permanently delete")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to permanently delete item",
        variant: "destructive",
      })
    }
  }

  const handleDeleteAllDeletedItems = async () => {
    const totalDeleted = (data?.deletedDonations?.length || 0) + 
                        (data?.deletedMemberships?.length || 0) + 
                        deletedExpenses.length

    if (totalDeleted === 0) {
      toast({
        title: "No items to delete",
        description: "There are no deleted items to permanently delete.",
        variant: "default",
      })
      setDeleteAllDialogOpen(false)
      return
    }

    try {
      const adminSession = localStorage.getItem("adminSession")
      const adminId = localStorage.getItem("adminId")
      let instructorId = localStorage.getItem("instructorId") || sessionStorage.getItem("instructorId")
      
      if (!instructorId) {
        const instructorSessionStr = localStorage.getItem("instructorSession")
        if (instructorSessionStr) {
          try {
            const instructorSession = JSON.parse(instructorSessionStr)
            instructorId = instructorSession?.id?.toString()
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
      
      const headers: Record<string, string> = {}
      if (adminSession) {
        headers["Authorization"] = adminSession
      }
      if (adminId) {
        headers["x-admin-id"] = adminId
      }
      if (instructorId) {
        headers["x-instructor-id"] = instructorId
      }

      // Delete all deleted donations
      const donationPromises = (data?.deletedDonations || []).map((donation: any) =>
        fetch(`/api/admin/financials/donations/${donation.id}?permanent=true`, {
          method: "DELETE",
          headers,
        })
      )

      // Delete all deleted memberships
      const membershipPromises = (data?.deletedMemberships || []).map((membership: any) =>
        fetch(`/api/admin/financials/memberships/${membership.id}?permanent=true`, {
          method: "DELETE",
          headers,
        })
      )

      // Delete all deleted expenses
      const expensePromises = deletedExpenses.map((expense) =>
        fetch(`/api/admin/financials/expenses/${expense.id}?permanent=true`, {
          method: "DELETE",
          headers,
        })
      )

      // Execute all deletions in parallel
      const results = await Promise.allSettled([
        ...donationPromises,
        ...membershipPromises,
        ...expensePromises,
      ])

      const successful = results.filter((r) => r.status === "fulfilled" && r.value.ok).length
      const failed = results.length - successful

      if (successful > 0) {
        toast({
          title: "Success",
          description: `Permanently deleted ${successful} item(s)${failed > 0 ? ` (${failed} failed)` : ""}`,
        })
        setDeleteAllDialogOpen(false)
        fetchFinancialData(false) // Don't show loading state on delete
      } else {
        throw new Error("Failed to delete all items")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to permanently delete all items",
        variant: "destructive",
      })
    }
  }

  const filteredDonations = data?.donations.filter((d) => {
    const matchesSearch =
      d.donorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.donorEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.studentName?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = filterStatus === "all" || d.status === filterStatus
    return matchesSearch && matchesStatus
  }) || []

  const filteredMemberships = data?.memberships.filter((m) => {
    const matchesSearch =
      m.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.studentNumber.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTier = filterTier === "all" || m.tier === filterTier
    const matchesStatus = filterStatus === "all" || m.status === filterStatus
    return matchesSearch && matchesTier && matchesStatus
  }) || []

  const filteredExpenses = expenses.filter((e) => {
    const matchesSearch =
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.vendor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.category.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = filterCategory === "all" || e.category === filterCategory
    const matchesStatus = filterStatus === "all" || e.status === filterStatus
    return matchesSearch && matchesCategory && matchesStatus
  })

  const exportToCSV = (type: "donations" | "memberships") => {
    const items = type === "donations" ? filteredDonations : filteredMemberships
    const headers =
      type === "donations"
        ? ["ID", "Amount", "Donor Name", "Email", "Student", "Status", "Date"]
        : ["ID", "Student", "Tier", "Status", "Monthly Price", "Expires", "Auto Renew", "Created"]

    const rows = items.map((item: any) => {
      if (type === "donations") {
        return [
          item.id,
          `$${item.amount.toFixed(2)}`,
          item.donorName,
          item.donorEmail || "",
          item.studentName || "N/A",
          item.status,
          new Date(item.createdAt).toLocaleDateString(),
        ]
      } else {
        return [
          item.id,
          `${item.studentName} (${item.studentNumber})`,
          item.tier,
          item.status,
          `$${item.monthlyPrice.toFixed(2)}`,
          item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : "N/A",
          item.autoRenew ? "Yes" : "No",
          new Date(item.createdAt).toLocaleDateString(),
        ]
      }
    })

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${type}-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)

    toast({
      title: "Export Successful",
      description: `${type} data exported to CSV`,
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <RefreshCw className="h-10 w-10 animate-spin text-indigo-600 mx-auto" />
          <p className="text-slate-600 dark:text-slate-400">Loading financial data...</p>
        </div>
      </div>
    )
  }

  const sidebarTheme = embedInDashboard
    ? { active: "bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-medium", inactive: "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5" }
    : { active: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md", inactive: "hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300" };

  return (
    <div className={cn("w-full max-w-full min-w-0 overflow-x-hidden", !embedInDashboard && "container mx-auto px-6 py-8")}>
      {!embedInDashboard && (
        <div className="flex items-center justify-end gap-2 mb-4">
          <Button
            onClick={() => router.push("/instructor/dashboard")}
            variant="outline"
            size="sm"
            className="border-slate-200 hover:bg-slate-50 hover:border-slate-300"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      )}

      {/* Side Menu + Content Layout */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Sidebar */}
        <div className="w-full lg:w-56 shrink-0">
          <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-200/60 dark:border-white/[0.08] flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Financial</p>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => fetchFinancialData(false, false)}
                  className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  title="Refresh from database (fast — no live Stripe invoice calls)"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => fetchFinancialData(true, true)}
                  className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  title="Reconcile membership revenue from Stripe (slow — one API round-trip per paid membership)"
                >
                  <Landmark className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-1.5">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                const isDeletions = item.id === "deletions"
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors",
                      isDeletions
                        ? isActive
                          ? "bg-red-500/15 dark:bg-red-500/25 text-red-700 dark:text-red-300 font-medium"
                          : "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                        : isActive
                          ? sidebarTheme.active
                          : sidebarTheme.inactive
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="min-w-0 flex-1 w-full max-w-full space-y-4 sm:space-y-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <Heart className="h-4 w-4 text-green-600" />
                      Total Donations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-4xl font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(data?.totals.donations || 0)}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                          {data?.donations.filter(d => d.status === 'completed').length || 0} completed donations
                        </p>
                      </div>
                      <div className="p-4 rounded-2xl bg-green-100 dark:bg-green-900/30">
                        <Heart className="h-8 w-8 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <Crown className="h-4 w-4 text-blue-600" />
                      Membership Revenue
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(data?.totals.membershipRevenue || 0)}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                          {data?.memberships.length || 0} active memberships
                        </p>
                      </div>
                      <div className="p-4 rounded-2xl bg-blue-100 dark:bg-blue-900/30">
                        <Crown className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-indigo-600" />
                      Total Income
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
                          {formatCurrency(data?.totals.total || 0)}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                          Combined revenue
                        </p>
                      </div>
                      <div className="p-4 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30">
                        <TrendingUp className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts and Visualizations */}
              {data && data.monthlyBreakdown && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                  {/* Monthly Revenue Trend */}
                  <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-indigo-600" />
                        Monthly Revenue Trend
                      </CardTitle>
                      <CardDescription>Donations and membership revenue over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(data.monthlyBreakdown?.donations?.length > 0 || data.monthlyBreakdown?.memberships?.length > 0) ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={(() => {
                            // Combine donations and memberships by month
                            const donations = data.monthlyBreakdown?.donations || []
                            const memberships = data.monthlyBreakdown?.memberships || []
                            const months = new Set([
                              ...donations.map(d => d.month),
                              ...memberships.map(m => m.month)
                            ])
                            return Array.from(months).sort().map(month => {
                              const donation = donations.find(d => d.month === month) || { total: 0, count: 0 }
                              const membership = memberships.find(m => m.month === month) || { total: 0, count: 0 }
                              return {
                                month: new Date(month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                                donations: donation.total || 0,
                                memberships: membership.total || 0,
                                total: (donation.total || 0) + (membership.total || 0)
                              }
                            })
                          })()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="month" stroke="#64748b" />
                            <YAxis stroke="#64748b" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#fff', 
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                              }}
                              formatter={(value: any) => formatCurrency(value)}
                            />
                            <Legend />
                            <Area type="monotone" dataKey="donations" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                            <Area type="monotone" dataKey="memberships" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-slate-400">
                          <div className="text-center">
                            <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No monthly data yet</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Revenue Breakdown */}
                  <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <ChartPie className="h-5 w-5 text-purple-600" />
                        Revenue Breakdown
                      </CardTitle>
                      <CardDescription>Donations vs Membership Revenue</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(data.totals?.total || 0) > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <RechartsPieChart>
                            <Pie
                              data={[
                                { name: "Donations", value: data.totals?.donations || 0, color: "#10b981" },
                                { name: "Memberships", value: data.totals?.membershipRevenue || 0, color: "#3b82f6" },
                              ]}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {[
                                { name: "Donations", value: data.totals?.donations || 0, color: "#10b981" },
                                { name: "Memberships", value: data.totals?.membershipRevenue || 0, color: "#3b82f6" },
                              ].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value: any) => formatCurrency(value)}
                              contentStyle={{ 
                                backgroundColor: '#fff', 
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                              }}
                            />
                            <Legend />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-slate-400">
                          <div className="text-center">
                            <ChartPie className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No revenue data yet</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Monthly Donations Chart */}
                  <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Heart className="h-5 w-5 text-green-600" />
                        Monthly Donations
                      </CardTitle>
                      <CardDescription>Donation count and amount by month</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(data.monthlyBreakdown?.donations?.length || 0) > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={(data.monthlyBreakdown?.donations || []).map(d => ({
                            month: new Date(d.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                            amount: d.total || 0,
                            count: d.count || 0
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="month" stroke="#64748b" />
                            <YAxis yAxisId="left" stroke="#64748b" />
                            <YAxis yAxisId="right" orientation="right" stroke="#64748b" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#fff', 
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                              }}
                              formatter={(value: any, name: string) => 
                                name === 'amount' ? formatCurrency(value) : `${value} donation${value !== 1 ? 's' : ''}`
                              }
                            />
                            <Legend />
                            <Bar yAxisId="left" dataKey="amount" fill="#10b981" radius={[8, 8, 0, 0]} name="Amount" />
                            <Bar yAxisId="right" dataKey="count" fill="#34d399" radius={[8, 8, 0, 0]} name="Count" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-slate-400">
                          <div className="text-center">
                            <Heart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No donation data yet</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Monthly Memberships Chart */}
                  <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Crown className="h-5 w-5 text-blue-600" />
                        Monthly Memberships
                      </CardTitle>
                      <CardDescription>Membership count and revenue by month</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(data.monthlyBreakdown?.memberships?.length || 0) > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={(data.monthlyBreakdown?.memberships || []).map(m => ({
                            month: new Date(m.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                            revenue: m.total || 0,
                            count: m.count || 0
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="month" stroke="#64748b" />
                            <YAxis yAxisId="left" stroke="#64748b" />
                            <YAxis yAxisId="right" orientation="right" stroke="#64748b" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#fff', 
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                              }}
                              formatter={(value: any, name: string) => 
                                name === 'revenue' ? formatCurrency(value) : `${value} membership${value !== 1 ? 's' : ''}`
                              }
                            />
                            <Legend />
                            <Bar yAxisId="left" dataKey="revenue" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Revenue" />
                            <Bar yAxisId="right" dataKey="count" fill="#60a5fa" radius={[8, 8, 0, 0]} name="Count" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-slate-400">
                          <div className="text-center">
                            <Crown className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No membership data yet</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Recent Activity Timeline */}
                  <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Activity className="h-5 w-5 text-purple-600" />
                        Recent Activity
                      </CardTitle>
                      <CardDescription>Latest donations and membership changes</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {[...((data.donations || []).slice(0, 5).map(d => ({...d, type: 'donation' as const, createdAt: d.createdAt}))),
                          ...((data.memberships || []).slice(0, 5).map(m => ({...m, type: 'membership' as const, createdAt: m.createdAt})))
                        ]
                          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                          .slice(0, 10)
                          .map((item, index) => (
                            <div key={`${item.type}-${item.id}`} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                              <div className={`p-2 rounded-lg ${item.type === 'donation' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                                {item.type === 'donation' ? (
                                  <Heart className="h-5 w-5 text-green-600 dark:text-green-400" />
                                ) : (
                                  <Crown className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="font-semibold text-slate-800 dark:text-slate-200">
                                  {item.type === 'donation' 
                                    ? `$${formatCurrency((item as Donation).amount)} donation from ${(item as Donation).donorName}`
                                    : `${(item as Membership).tier} membership for ${(item as Membership).studentName}`
                                  }
                                </div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                  {new Date(item.createdAt).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </div>
                              </div>
                              <Badge variant={item.type === 'donation' ? 'default' : 'secondary'}>
                                {item.type === 'donation' ? 'Donation' : 'Membership'}
                              </Badge>
                            </div>
                          ))}
                        {[...(data.donations || []).slice(0, 5), ...(data.memberships || []).slice(0, 5)].length === 0 && (
                          <div className="text-center py-12 text-slate-400">
                            <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No recent activity</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}

          {/* Donations Tab */}
          {activeTab === "donations" && (
            <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl sm:rounded-2xl shadow-sm">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-xl sm:text-2xl">Donations</CardTitle>
                    <CardDescription>View and manage all platform donations</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center shrink-0">
                    {syncingPending && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Auto-syncing pending donations...</span>
                      </div>
                    )}
                    <Button 
                      onClick={async () => {
                        try {
                          await sendReminderNotifications()
                        } catch (error) {
                          // Error already handled in function
                        }
                      }}
                      variant="outline" 
                      size="sm" 
                      className="gap-2 border-amber-300 hover:bg-amber-50 hover:border-amber-400 text-amber-600"
                      title="Send reminder notifications to students with pending donations"
                    >
                      <AlertCircle className="h-4 w-4" />
                      Send Reminders
                    </Button>
                    <Button 
                      onClick={() => syncPendingDonations(false)} 
                      variant="outline" 
                      size="sm" 
                      className="gap-2"
                      disabled={syncingPending}
                      title="Manually sync pending donations (auto-sync runs every 60 seconds)"
                    >
                      <RefreshCw className={`h-4 w-4 ${syncingPending ? 'animate-spin' : ''}`} />
                      {syncingPending ? "Syncing..." : "Sync Now"}
                    </Button>
                    <Button onClick={() => exportToCSV("donations")} variant="outline" size="sm" className="gap-2">
                      <Download className="h-4 w-4" />
                      Export CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
                  <div className="flex-1 min-w-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search donations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 w-full sm:max-w-sm border-slate-200 dark:border-slate-700"
                      />
                    </div>
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="overflow-x-auto min-w-0">
                    <Table className="min-w-[640px]">
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                        <TableHead className="font-semibold">ID</TableHead>
                        <TableHead className="font-semibold">Amount</TableHead>
                        <TableHead className="font-semibold">Donor</TableHead>
                        <TableHead className="font-semibold">Student</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDonations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                            <Heart className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                            <p>No donations found</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredDonations.map((donation, index) => (
                          <TableRow key={donation.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                            <TableCell className="font-medium">{index + 1}</TableCell>
                            <TableCell className="font-semibold text-green-600 dark:text-green-400">
                              {formatCurrency(donation.amount)}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{donation.donorName}</div>
                                {donation.donorEmail && (
                                  <div className="text-xs text-slate-500">{donation.donorEmail}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {donation.studentName ? (
                                <div>
                                  <div className="font-medium">{donation.studentName}</div>
                                  <div className="text-xs text-slate-500">{donation.studentNumber}</div>
                                </div>
                              ) : (
                                <span className="text-slate-400">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  donation.status === "completed"
                                    ? "default"
                                    : donation.status === "pending"
                                    ? "secondary"
                                    : "destructive"
                                }
                                className="rounded-full"
                              >
                                {donation.status}
                              </Badge>
                              {donation.errorMessage && (
                                <div className="mt-1 text-xs text-red-600 dark:text-red-400 max-w-[200px] truncate" title={donation.errorMessage}>
                                  ⚠️ {donation.errorMessage}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {new Date(donation.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedDonation(donation)
                                    setViewDetailsDialogOpen(true)
                                  }}
                                  className="h-9 w-9 p-0 border-slate-300 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-600"
                                  title="View payment details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(donation)}
                                  className="h-9 w-9 p-0 border-slate-300 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                                  title="Edit donation"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(donation)}
                                  className="h-9 w-9 p-0 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 hover:text-red-700"
                                  title="Delete donation"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Memberships Tab */}
          {activeTab === "memberships" && (
            <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">Memberships</CardTitle>
                    <CardDescription>View and manage all active memberships</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      onClick={async () => {
                        try {
                          setSyncingMemberships(true)
                          
                          // Sync all memberships from Stripe (this will find all students with subscriptions)
                          const response = await fetch('/api/admin/memberships/sync-stripe', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                          })
                          const result = await response.json()
                          if (!response.ok) {
                            throw new Error(result.error || "Failed to sync memberships")
                          }
                          
                          // Check for issues in the results
                          const issuesFound: string[] = []
                          if (result.errors && result.errors.length > 0) {
                            issuesFound.push(`${result.errors.length} error(s) during sync`)
                          }
                          
                          // Check Bartley specifically if he was processed
                          const bartleyDetail = result.details?.find((d: any) => 
                            d.student?.toLowerCase().includes('bartley') || 
                            d.student?.toLowerCase().includes('daylen')
                          )
                          
                          let statusMessage = `Processed ${result.summary.processed} students: ${result.summary.updated} updated, ${result.summary.created} created.`
                          
                          if (bartleyDetail) {
                            statusMessage += ` Bartley Daylen: ${bartleyDetail.action} to ${bartleyDetail.tier || 'Scholar'}.`
                          } else {
                            // Check Bartley's status separately
                            try {
                              const checkResponse = await fetch('/api/admin/memberships/check-status', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email: 'dbartley@pvamu.edu' })
                              })
                              const checkResult = await checkResponse.json()
                              
                              if (checkResponse.ok && checkResult.student) {
                                const bartleyIssues: string[] = []
                                if (!checkResult.summary.hasMembership) bartleyIssues.push('No membership record')
                                if (!checkResult.summary.tierMatches) bartleyIssues.push('Tier mismatch')
                                if (!checkResult.summary.stripeMatches && checkResult.stripe?.subscriptions?.length > 0) {
                                  bartleyIssues.push(`Stripe shows ${checkResult.detectedPlan} but DB shows ${checkResult.student.membershipTier}`)
                                }
                                
                                if (bartleyIssues.length > 0) {
                                  statusMessage += ` Bartley Daylen issues: ${bartleyIssues.join(', ')}.`
                                } else {
                                  statusMessage += ` Bartley Daylen: ${checkResult.student.membershipTier} (${checkResult.membership?.status || 'active'}).`
                                }
                              }
                            } catch (checkError) {
                            }
                          }
                          
                          if (issuesFound.length > 0) {
                            toast({
                              title: "⚠️ Sync Complete with Issues",
                              description: statusMessage,
                              variant: "destructive",
                              duration: 10000,
                            })
                          } else {
                            toast({
                              title: "✅ Sync Complete",
                              description: statusMessage,
                              duration: 8000,
                            })
                          }
                          
                          fetchFinancialData()
                        } catch (error: any) {
                          toast({
                            title: "❌ Sync Failed",
                            description: error.message || "Failed to sync memberships from Stripe",
                            variant: "destructive",
                          })
                        } finally {
                          setSyncingMemberships(false)
                        }
                      }}
                      variant="outline" 
                      size="sm" 
                      className="gap-2"
                      disabled={syncingMemberships}
                      title="Sync all memberships from Stripe and check for any issues"
                    >
                      <RefreshCw className={`h-4 w-4 ${syncingMemberships ? 'animate-spin' : ''}`} />
                      {syncingMemberships ? "Syncing..." : "Sync from Stripe"}
                    </Button>
                    <Button onClick={() => exportToCSV("memberships")} variant="outline" size="sm" className="gap-2">
                      <Download className="h-4 w-4" />
                      Export CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search memberships..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 w-full sm:max-w-sm border-slate-200 dark:border-slate-700"
                      />
                    </div>
                  </div>
                  <Select value={filterTier} onValueChange={setFilterTier}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tiers</SelectItem>
                      <SelectItem value="Scholar">Scholar</SelectItem>
                      <SelectItem value="Explorer">Explorer</SelectItem>
                      <SelectItem value="Trailblazer">Trailblazer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="overflow-x-auto min-w-0">
                    <Table className="min-w-[720px]">
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                        <TableHead className="font-semibold">ID</TableHead>
                        <TableHead className="font-semibold">Student</TableHead>
                        <TableHead className="font-semibold">Tier</TableHead>
                        <TableHead className="font-semibold">Monthly Price</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Expires</TableHead>
                        <TableHead className="font-semibold">Auto Renew</TableHead>
                        <TableHead className="font-semibold">Created</TableHead>
                        <TableHead className="font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMemberships.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-12 text-slate-500">
                            <Crown className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                            <p>No memberships found</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredMemberships.map((membership) => (
                          <TableRow key={membership.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                            <TableCell className="font-medium">{membership.id}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{membership.studentName}</div>
                                <div className="text-xs text-slate-500">{membership.studentNumber}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  membership.tier === "Trailblazer"
                                    ? "default"
                                    : membership.tier === "Explorer"
                                    ? "secondary"
                                    : "outline"
                                }
                                className="rounded-full"
                              >
                                {membership.tier}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-blue-600 dark:text-blue-400">
                              {formatCurrency(membership.monthlyPrice)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  membership.status === "active"
                                    ? "default"
                                    : membership.status === "expired"
                                    ? "secondary"
                                    : "destructive"
                                }
                                className="rounded-full"
                              >
                                {membership.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {membership.expiresAt
                                ? new Date(membership.expiresAt).toLocaleDateString()
                                : "N/A"}
                            </TableCell>
                            <TableCell>
                              {membership.autoRenew ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                                  Yes
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="rounded-full">No</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {new Date(membership.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(membership)}
                                  className="h-9 w-9 p-0 border-slate-300 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                                  title="Edit membership"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(membership)}
                                  className="h-9 w-9 p-0 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 hover:text-red-700"
                                  title="Delete membership"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Expenses Tab */}
          {activeTab === "expenses" && (
            <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl sm:rounded-2xl shadow-sm">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-xl sm:text-2xl">Expenses</CardTitle>
                    <CardDescription>Track platform costs and expenses</CardDescription>
                  </div>
                  <Button onClick={handleCreateExpense} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Expense
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <Input
                      placeholder="Search expenses..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full sm:max-w-sm"
                    />
                  </div>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="AI">AI Usage</SelectItem>
                      <SelectItem value="Database">Database</SelectItem>
                      <SelectItem value="Web Hosting">Web Hosting</SelectItem>
                      <SelectItem value="API Services">API Services</SelectItem>
                      <SelectItem value="Storage">Storage</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="overflow-x-auto min-w-0">
                    <Table className="min-w-[720px]">
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                        <TableHead className="font-semibold">ID</TableHead>
                        <TableHead className="font-semibold">Category</TableHead>
                        <TableHead className="font-semibold">Description</TableHead>
                        <TableHead className="font-semibold">Amount</TableHead>
                        <TableHead className="font-semibold">Vendor</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExpenses.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                            <Receipt className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                            <p>No expenses found</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredExpenses.map((expense) => (
                          <TableRow key={expense.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                            <TableCell className="font-medium">{expense.id}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="rounded-full">
                                {expense.category}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{expense.description}</div>
                                {expense.invoiceNumber && (
                                  <div className="text-xs text-slate-500">Invoice: {expense.invoiceNumber}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold text-red-600 dark:text-red-400">
                              {formatCurrency(expense.amount)}
                            </TableCell>
                            <TableCell>{expense.vendor || "N/A"}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  expense.status === "paid"
                                    ? "default"
                                    : expense.status === "pending"
                                    ? "secondary"
                                    : "destructive"
                                }
                                className="rounded-full"
                              >
                                {expense.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(expense.expenseDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(expense)}
                                  className="h-9 w-9 p-0 border-slate-300 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                                  title="Edit expense"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(expense)}
                                  className="h-9 w-9 p-0 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 hover:text-red-700"
                                  title="Delete expense"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Deletions Tab */}
          {activeTab === "deletions" && (
            <div className="space-y-6">
              {/* Delete All Button */}
              <Card className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl shadow-sm">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-semibold text-red-900 dark:text-red-100 mb-1">
                        Permanently Delete All Deleted Items
                      </h3>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        This will permanently delete all soft-deleted donations, memberships, and expenses. This action cannot be undone.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="lg"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDeleteAllDialogOpen(true)
                      }}
                      disabled={
                        (data?.deletedDonations?.length || 0) === 0 &&
                        (data?.deletedMemberships?.length || 0) === 0 &&
                        deletedExpenses.length === 0
                      }
                      className="shrink-0"
                    >
                      <Trash2 className="h-5 w-5 mr-2" />
                      Delete All Deleted Items
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl sm:rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl sm:text-2xl">Deleted Donations</CardTitle>
                  <CardDescription>View soft-deleted donation records</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto min-w-0">
                    <Table className="min-w-[560px]">
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                          <TableHead className="font-semibold">ID</TableHead>
                          <TableHead className="font-semibold">Amount</TableHead>
                          <TableHead className="font-semibold">Donor</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="font-semibold">Deleted At</TableHead>
                          <TableHead className="font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.deletedDonations.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                              <Trash2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                              <p>No deleted donations</p>
                            </TableCell>
                          </TableRow>
                        ) : (
                          data?.deletedDonations.map((donation) => (
                            <TableRow key={donation.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 opacity-60">
                              <TableCell className="font-medium">{donation.id}</TableCell>
                              <TableCell className="font-semibold text-green-600 dark:text-green-400">
                                {formatCurrency(donation.amount)}
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{donation.donorName}</span>
                                    {donation.isAnonymous && (
                                      <Badge variant="outline" className="text-xs px-1.5 py-0.5 border-slate-300 text-slate-600">
                                        <EyeOff className="h-3 w-3 mr-1" />
                                        Anonymous
                                      </Badge>
                                    )}
                                  </div>
                                  {donation.donorEmail && !donation.isAnonymous && (
                                    <div className="text-xs text-slate-500">{donation.donorEmail}</div>
                                  )}
                                  {donation.isAnonymous && (
                                    <div className="text-xs text-slate-400 italic">Email hidden for privacy</div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="rounded-full">
                                  {donation.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {donation.deletedAt ? new Date(donation.deletedAt).toLocaleDateString() : "N/A"}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant="default"
                                    size="sm"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handleRestore('donation', donation.id)
                                    }}
                                    className="h-8 text-xs bg-green-600 hover:bg-green-700"
                                  >
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Restore
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handlePermanentDelete('donation', donation.id)
                                    }}
                                    className="h-8 text-xs"
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Delete Now
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl sm:text-2xl">Deleted Memberships</CardTitle>
                  <CardDescription>View soft-deleted membership records</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto min-w-0">
                    <Table className="min-w-[560px]">
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                          <TableHead className="font-semibold">ID</TableHead>
                          <TableHead className="font-semibold">Student</TableHead>
                          <TableHead className="font-semibold">Tier</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="font-semibold">Deleted At</TableHead>
                          <TableHead className="font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.deletedMemberships.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                              <Trash2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                              <p>No deleted memberships</p>
                            </TableCell>
                          </TableRow>
                        ) : (
                          data?.deletedMemberships.map((membership) => (
                            <TableRow key={membership.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 opacity-60">
                              <TableCell className="font-medium">{membership.id}</TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{membership.studentName}</div>
                                  <div className="text-xs text-slate-500">{membership.studentNumber}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="rounded-full">
                                  {membership.tier}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="rounded-full">
                                  {membership.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {membership.deletedAt ? new Date(membership.deletedAt).toLocaleDateString() : "N/A"}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant="default"
                                    size="sm"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handleRestore('membership', membership.id)
                                    }}
                                    className="h-8 text-xs bg-green-600 hover:bg-green-700"
                                  >
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Restore
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handlePermanentDelete('membership', membership.id)
                                    }}
                                    className="h-8 text-xs"
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Delete Now
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl sm:text-2xl">Deleted Expenses</CardTitle>
                  <CardDescription>View soft-deleted expense records</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto min-w-0">
                    <Table className="min-w-[560px]">
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                          <TableHead className="font-semibold">ID</TableHead>
                          <TableHead className="font-semibold">Category</TableHead>
                          <TableHead className="font-semibold">Description</TableHead>
                          <TableHead className="font-semibold">Amount</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="font-semibold">Deleted At</TableHead>
                          <TableHead className="font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deletedExpenses.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                              <Trash2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                              <p>No deleted expenses</p>
                            </TableCell>
                          </TableRow>
                        ) : (
                          deletedExpenses.map((expense) => (
                            <TableRow key={expense.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 opacity-60">
                              <TableCell className="font-medium">{expense.id}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="rounded-full">
                                  {expense.category}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{expense.description}</div>
                                  {expense.invoiceNumber && (
                                    <div className="text-xs text-slate-500">Invoice: {expense.invoiceNumber}</div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-semibold text-red-600 dark:text-red-400">
                                {formatCurrency(expense.amount)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    expense.status === "paid"
                                      ? "default"
                                      : expense.status === "pending"
                                      ? "secondary"
                                      : "destructive"
                                  }
                                  className="rounded-full"
                                >
                                  {expense.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {expense.deletedAt ? new Date(expense.deletedAt).toLocaleDateString() : "N/A"}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant="default"
                                    size="sm"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handleRestore('expense', expense.id)
                                    }}
                                    className="h-8 text-xs bg-green-600 hover:bg-green-700"
                                  >
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Restore
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handlePermanentDelete('expense', expense.id)
                                    }}
                                    className="h-8 text-xs"
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Delete Now
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editingItem && 'donorName' in editingItem ? 'Donation' : editingItem && 'category' in editingItem ? 'Expense' : 'Membership'}</DialogTitle>
            <DialogDescription>
              Update the details below and click save to apply changes.
            </DialogDescription>
          </DialogHeader>
          {editingItem && 'category' in editingItem ? (
            <div className="space-y-4">
              <div>
                <Label>Category *</Label>
                <Select value={editForm.category} onValueChange={(value) => setEditForm({ ...editForm, category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AI">AI Usage</SelectItem>
                    <SelectItem value="Database">Database</SelectItem>
                    <SelectItem value="Web Hosting">Web Hosting</SelectItem>
                    <SelectItem value="API Services">API Services</SelectItem>
                    <SelectItem value="Storage">Storage</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description *</Label>
                <Input
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="e.g., OpenAI API usage for November"
                />
              </div>
              <div>
                <Label>Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Expense Date *</Label>
                <Input
                  type="date"
                  value={editForm.expenseDate}
                  onChange={(e) => setEditForm({ ...editForm, expenseDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Vendor</Label>
                <Input
                  value={editForm.vendor}
                  onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })}
                  placeholder="e.g., OpenAI, Vercel, Neon"
                />
              </div>
              <div>
                <Label>Invoice Number</Label>
                <Input
                  value={editForm.invoiceNumber}
                  onChange={(e) => setEditForm({ ...editForm, invoiceNumber: e.target.value })}
                />
              </div>
              <div>
                <Label>Status *</Label>
                <Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Method</Label>
                <Input
                  value={editForm.paymentMethod}
                  onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                  placeholder="e.g., Credit Card, PayPal"
                />
              </div>
              <div>
                <Label>Receipt URL</Label>
                <Input
                  type="url"
                  value={editForm.receiptUrl}
                  onChange={(e) => setEditForm({ ...editForm, receiptUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label>Notes</Label>
                <textarea
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Additional notes..."
                />
              </div>
            </div>
          ) : editingItem && 'donorName' in editingItem ? (
            <div className="space-y-4">
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label>Donor Name</Label>
                <Input
                  value={editForm.donorName}
                  onChange={(e) => setEditForm({ ...editForm, donorName: e.target.value })}
                />
              </div>
              <div>
                <Label>Donor Email</Label>
                <Input
                  type="email"
                  value={editForm.donorEmail}
                  onChange={(e) => setEditForm({ ...editForm, donorEmail: e.target.value })}
                  disabled={editForm.isAnonymous}
                />
                {editForm.isAnonymous && (
                  <p className="text-xs text-slate-500 mt-1">Email is hidden for anonymous donations</p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isAnonymous"
                  checked={editForm.isAnonymous}
                  onCheckedChange={(checked) => {
                    setEditForm({
                      ...editForm,
                      isAnonymous: checked,
                      donorName: checked ? "Anonymous" : editForm.donorName,
                    })
                  }}
                />
                <Label htmlFor="isAnonymous" className="text-sm font-normal cursor-pointer">
                  Mark as anonymous donation
                </Label>
              </div>
              <div>
                <Label>Message</Label>
                <Textarea
                  value={editForm.message}
                  onChange={(e) => setEditForm({ ...editForm, message: e.target.value })}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Tier</Label>
                <Select value={editForm.tier} onValueChange={(value) => setEditForm({ ...editForm, tier: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Scholar">Scholar</SelectItem>
                    <SelectItem value="Explorer">Explorer</SelectItem>
                    <SelectItem value="Trailblazer">Trailblazer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expires At</Label>
                <Input
                  type="date"
                  value={editForm.expiresAt}
                  onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoRenew"
                  checked={editForm.autoRenew}
                  onChange={(e) => setEditForm({ ...editForm, autoRenew: e.target.checked })}
                />
                <Label htmlFor="autoRenew">Auto Renew</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Donation Details Dialog */}
      <Dialog open={viewDetailsDialogOpen} onOpenChange={setViewDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-purple-600" />
              Donation Payment Details
            </DialogTitle>
            <DialogDescription>
              Complete payment information for this donation
            </DialogDescription>
          </DialogHeader>
          
          {selectedDonation && (
            <div className="space-y-6 py-4">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Amount</Label>
                  <div className="mt-1 text-lg font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(selectedDonation.amount)}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Status</Label>
                  <div className="mt-1">
                    <Badge
                      variant={
                        selectedDonation.status === "completed"
                          ? "default"
                          : selectedDonation.status === "pending"
                          ? "secondary"
                          : "destructive"
                      }
                      className="rounded-full"
                    >
                      {selectedDonation.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Donor Information */}
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 block">Donor Information</Label>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-slate-500">Name: </span>
                    <span className="font-medium">{selectedDonation.donorName}</span>
                    {selectedDonation.isAnonymous && (
                      <Badge variant="outline" className="ml-2 text-xs">Anonymous</Badge>
                    )}
                  </div>
                  {selectedDonation.donorEmail && (
                    <div>
                      <span className="text-sm text-slate-500">Email: </span>
                      <span className="font-medium">{selectedDonation.donorEmail}</span>
                    </div>
                  )}
                  {selectedDonation.message && (
                    <div>
                      <span className="text-sm text-slate-500">Message: </span>
                      <span className="font-medium">{selectedDonation.message}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Student Information */}
              {selectedDonation.studentName && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 block">Student Information</Label>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-slate-500">Name: </span>
                      <span className="font-medium">{selectedDonation.studentName}</span>
                    </div>
                    {selectedDonation.studentNumber && (
                      <div>
                        <span className="text-sm text-slate-500">Student ID: </span>
                        <span className="font-medium">{selectedDonation.studentNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Method */}
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 block">Payment Method</Label>
                <div className="flex items-center gap-2">
                  {selectedDonation.paymentMethod ? (
                    <Badge variant="outline" className="rounded-full text-base px-4 py-2">
                      {selectedDonation.paymentMethod === 'apple_pay' ? '🍎 Apple Pay' :
                       selectedDonation.paymentMethod === 'google_pay' ? '📱 Google Pay' :
                       selectedDonation.paymentMethod === 'stripe_card' ? '💳 Card (Stripe)' :
                       selectedDonation.paymentMethod === 'stripe' ? '💳 Stripe' :
                       selectedDonation.paymentMethod}
                    </Badge>
                  ) : selectedDonation.status === 'completed' ? (
                    <Badge variant="outline" className="rounded-full text-base px-4 py-2 text-slate-500">
                      💳 Card (Payment method not recorded)
                    </Badge>
                  ) : (
                    <span className="text-slate-400 text-sm">Not available</span>
                  )}
                </div>
              </div>

              {/* Transaction Information */}
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 block">Transaction Information</Label>
                <div className="space-y-2">
                  {selectedDonation.transactionId && (
                    <div>
                      <span className="text-sm text-slate-500">Transaction ID: </span>
                      <span className="font-mono text-sm font-medium break-all">{selectedDonation.transactionId}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-sm text-slate-500">Date: </span>
                    <span className="font-medium">
                      {new Date(selectedDonation.createdAt).toLocaleString('en-US', {
                        timeZone: 'America/Chicago',
                        dateStyle: 'long',
                        timeStyle: 'short'
                      })}
                    </span>
                  </div>
                  {selectedDonation.failedAt && (
                    <div>
                      <span className="text-sm text-slate-500">Failed At: </span>
                      <span className="font-medium text-red-600">
                        {new Date(selectedDonation.failedAt).toLocaleString('en-US', {
                          timeZone: 'America/Chicago',
                          dateStyle: 'long',
                          timeStyle: 'short'
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Error Information */}
              {selectedDonation.errorMessage && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2 block flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Error Information
                  </Label>
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-800 dark:text-red-200">{selectedDonation.errorMessage}</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                      This donation did not complete successfully. The student has been notified.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex items-center justify-between">
            <div className="flex-1">
              {selectedDonation && selectedDonation.status === "pending" && (
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                  <span>This donation is pending. You can manually resolve it below.</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {selectedDonation && selectedDonation.status === "pending" && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setResolveAction('fail')
                      setResolveDialogOpen(true)
                    }}
                    className="border-red-300 hover:bg-red-50 hover:border-red-400 text-red-600"
                  >
                    Mark as Failed
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setResolveAction('complete')
                      setResolveDialogOpen(true)
                    }}
                    className="border-green-300 hover:bg-green-50 hover:border-green-400 text-green-600"
                  >
                    Mark as Completed
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => setViewDetailsDialogOpen(false)}>
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Donation Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resolveAction === 'complete' ? 'Mark Donation as Completed' : 'Mark Donation as Failed'}
            </DialogTitle>
            <DialogDescription>
              {resolveAction === 'complete' 
                ? 'This will verify the payment with Stripe and mark the donation as completed. The student will receive a confirmation notification.'
                : 'This will mark the donation as failed. The student will receive a notification about the failed payment.'}
            </DialogDescription>
          </DialogHeader>
          
          {resolveAction === 'fail' && (
            <div className="space-y-2">
              <Label htmlFor="resolve-reason">Reason (optional)</Label>
              <Textarea
                id="resolve-reason"
                placeholder="e.g., Payment abandoned, Payment failed, etc."
                value={resolveReason}
                onChange={(e) => setResolveReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {resolveAction === 'complete' && selectedDonation && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> This will verify the payment status with Stripe. The donation will only be marked as completed if the payment is actually paid in Stripe.
              </p>
              {selectedDonation.transactionId && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  Transaction ID: {selectedDonation.transactionId}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setResolveDialogOpen(false)
                setResolveAction(null)
                setResolveReason("")
              }}
              disabled={resolvingDonation}
            >
              Cancel
            </Button>
            <Button
              variant={resolveAction === 'complete' ? 'default' : 'destructive'}
              onClick={async () => {
                if (!selectedDonation) return
                
                setResolvingDonation(true)
                try {
                  const response = await fetch(`/api/donations/${selectedDonation.id}/resolve`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: resolveAction,
                      reason: resolveReason || undefined
                    })
                  })

                  const result = await response.json()

                  if (!response.ok) {
                    throw new Error(result.error || 'Failed to resolve donation')
                  }

                  toast({
                    title: "✅ Donation Resolved",
                    description: result.message || `Donation has been marked as ${resolveAction === 'complete' ? 'completed' : 'failed'}.`,
                  })

                  // Refresh data
                  await fetchFinancialData()
                  
                  // Close dialogs
                  setResolveDialogOpen(false)
                  setViewDetailsDialogOpen(false)
                  setResolveAction(null)
                  setResolveReason("")
                } catch (error: any) {
                  toast({
                    title: "❌ Failed to Resolve",
                    description: error.message || "An error occurred while resolving the donation.",
                    variant: "destructive",
                  })
                } finally {
                  setResolvingDonation(false)
                }
              }}
              disabled={resolvingDonation}
            >
              {resolvingDonation ? 'Resolving...' : resolveAction === 'complete' ? 'Mark as Completed' : 'Mark as Failed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {editingItem && 'donorName' in editingItem ? 'Donation' : editingItem && 'category' in editingItem ? 'Expense' : 'Membership'}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this {editingItem && 'donorName' in editingItem ? 'donation' : editingItem && 'category' in editingItem ? 'expense' : 'membership'}? This action will soft-delete the record.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Expense Dialog */}
      <Dialog open={createExpenseDialogOpen} onOpenChange={setCreateExpenseDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Expense</DialogTitle>
            <DialogDescription>
              Record a new platform expense. Fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category *</Label>
              <Select value={expenseForm.category} onValueChange={(value) => setExpenseForm({ ...expenseForm, category: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AI">AI Usage</SelectItem>
                  <SelectItem value="Database">Database</SelectItem>
                  <SelectItem value="Web Hosting">Web Hosting</SelectItem>
                  <SelectItem value="API Services">API Services</SelectItem>
                  <SelectItem value="Storage">Storage</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description *</Label>
              <Input
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                placeholder="e.g., OpenAI API usage for November"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Expense Date *</Label>
                <Input
                  type="date"
                  value={expenseForm.expenseDate}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Vendor</Label>
              <Input
                value={expenseForm.vendor}
                onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
                placeholder="e.g., OpenAI, Vercel, Neon"
              />
            </div>
            <div>
              <Label>Invoice Number</Label>
              <Input
                value={expenseForm.invoiceNumber}
                onChange={(e) => setExpenseForm({ ...expenseForm, invoiceNumber: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status *</Label>
                <Select value={expenseForm.status} onValueChange={(value) => setExpenseForm({ ...expenseForm, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Method</Label>
                <Input
                  value={expenseForm.paymentMethod}
                  onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}
                  placeholder="e.g., Credit Card, PayPal"
                />
              </div>
            </div>
            <div>
              <Label>Receipt URL</Label>
              <Input
                type="url"
                value={expenseForm.receiptUrl}
                onChange={(e) => setExpenseForm({ ...expenseForm, receiptUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>Notes</Label>
              <textarea
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={expenseForm.notes}
                onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                placeholder="Additional notes about this expense..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateExpenseDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveExpense}
              disabled={!expenseForm.category || !expenseForm.description || !expenseForm.amount || !expenseForm.expenseDate}
            >
              Create Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation Dialog */}
      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              Permanently Delete All Deleted Items?
            </AlertDialogTitle>
            <div className="space-y-2 pt-2">
              <AlertDialogDescription className="font-semibold">
                Are you sure you want to permanently delete ALL deleted items? This action cannot be undone.
              </AlertDialogDescription>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mt-3">
                <div className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">Items to be deleted:</div>
                <ul className="text-sm text-red-800 dark:text-red-200 space-y-1 list-disc list-inside">
                  <li>{data?.deletedDonations?.length || 0} deleted donation(s)</li>
                  <li>{data?.deletedMemberships?.length || 0} deleted membership(s)</li>
                  <li>{deletedExpenses.length} deleted expense(s)</li>
                </ul>
                <div className="text-sm font-semibold text-red-900 dark:text-red-100 mt-3">
                  Total: {(data?.deletedDonations?.length || 0) + (data?.deletedMemberships?.length || 0) + deletedExpenses.length} item(s)
                </div>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAllDeletedItems}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Single Item Confirmation Dialog */}
      <AlertDialog open={permanentDeleteDialogOpen} onOpenChange={setPermanentDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              Permanently Delete {itemToPermanentlyDelete?.type ? itemToPermanentlyDelete.type.charAt(0).toUpperCase() + itemToPermanentlyDelete.type.slice(1) : 'Item'}?
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2">
              Are you sure you want to permanently delete this {itemToPermanentlyDelete?.type || 'item'}? 
              This action cannot be undone and the record will be completely removed from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToPermanentlyDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPermanentDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
