"use client"

import { useState, useEffect } from "react"
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
  PieChart,
  Activity,
  Trash2,
  Edit,
  X,
  Receipt,
  Wallet,
  AlertCircle,
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

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

interface FinancialData {
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

export function FinancialManagement() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<FinancialData | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterTier, setFilterTier] = useState<string>("all")
  const [activeTab, setActiveTab] = useState("overview")
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Donation | Membership | null>(null)
  const [editForm, setEditForm] = useState<any>({})

  useEffect(() => {
    fetchFinancialData()
  }, [])

  const fetchFinancialData = async () => {
    try {
      setLoading(true)
      const adminSession = localStorage.getItem("adminSession")
      const adminId = localStorage.getItem("adminId")
      const instructorId = sessionStorage.getItem("instructorId") || localStorage.getItem("instructorId")
      
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
      
      const response = await fetch("/api/admin/financials", {
        headers,
      })

      if (response.ok) {
        const financialData = await response.json()
        setData(financialData)
      } else {
        throw new Error("Failed to fetch financial data")
      }
    } catch (error) {
      console.error("Failed to fetch financial data:", error)
      toast({
        title: "Error",
        description: "Failed to load financial data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (item: Donation | Membership) => {
    setEditingItem(item)
    if ('donorName' in item) {
      // Donation
      setEditForm({
        amount: item.amount,
        donorName: item.donorName,
        donorEmail: item.donorEmail || "",
        message: item.message || "",
        status: item.status,
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
      const endpoint = isDonation
        ? `/api/admin/financials/donations/${editingItem.id}`
        : `/api/admin/financials/memberships/${editingItem.id}`

      const adminSession = localStorage.getItem("adminSession")
      const adminId = localStorage.getItem("adminId")
      const instructorId = sessionStorage.getItem("instructorId") || localStorage.getItem("instructorId")
      
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
          description: `${isDonation ? 'Donation' : 'Membership'} updated successfully`,
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

  const handleDelete = (item: Donation | Membership) => {
    setEditingItem(item)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!editingItem) return

    try {
      const isDonation = 'donorName' in editingItem
      const endpoint = isDonation
        ? `/api/admin/financials/donations/${editingItem.id}`
        : `/api/admin/financials/memberships/${editingItem.id}`

      const adminSession = localStorage.getItem("adminSession")
      const adminId = localStorage.getItem("adminId")
      const instructorId = sessionStorage.getItem("instructorId") || localStorage.getItem("instructorId")
      
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
          description: `${isDonation ? 'Donation' : 'Membership'} deleted successfully`,
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

  return (
    <div className="container mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
            <DollarSign className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Financial Management
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Track donations, memberships, and platform revenue
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={fetchFinancialData}
            variant="outline"
            className="border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all rounded-xl"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => router.push("/instructor/dashboard")}
            variant="outline"
            className="border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all rounded-xl"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Side Menu + Content Layout */}
      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        {/* Side Menu */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-2"
        >
          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm p-3">
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                
                return (
                  <motion.button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                        : "hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg transition-colors",
                      isActive ? "bg-white/20" : item.bgColor
                    )}>
                      <Icon className={cn("h-4 w-4", isActive ? "text-white" : item.color)} />
                    </div>
                    <span className="font-medium text-sm">{item.label}</span>
                  </motion.button>
                )
              })}
            </div>
          </div>
        </motion.div>

        {/* Content Area */}
        <div className="space-y-6">
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
            </>
          )}

          {/* Donations Tab */}
          {activeTab === "donations" && (
            <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">Donations</CardTitle>
                    <CardDescription>View and manage all platform donations</CardDescription>
                  </div>
                  <Button onClick={() => exportToCSV("donations")} variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-6">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search donations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 max-w-sm border-slate-200 dark:border-slate-700"
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
                  <Table>
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
                          <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                            <Heart className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                            <p>No donations found</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredDonations.map((donation) => (
                          <TableRow key={donation.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                            <TableCell className="font-medium">{donation.id}</TableCell>
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
                            </TableCell>
                            <TableCell>
                              {new Date(donation.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(donation)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(donation)}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
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
                  <Button onClick={() => exportToCSV("memberships")} variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-6">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search memberships..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 max-w-sm border-slate-200 dark:border-slate-700"
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
                  <Table>
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
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(membership)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(membership)}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
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
              </CardContent>
            </Card>
          )}

          {/* Expenses Tab */}
          {activeTab === "expenses" && (
            <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl">Expenses</CardTitle>
                <CardDescription>Track platform expenses (Coming soon)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-slate-500">
                  <Receipt className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p>Expense tracking will be available soon</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Deletions Tab */}
          {activeTab === "deletions" && (
            <div className="space-y-6">
              <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-2xl">Deleted Donations</CardTitle>
                  <CardDescription>View soft-deleted donation records</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                          <TableHead className="font-semibold">ID</TableHead>
                          <TableHead className="font-semibold">Amount</TableHead>
                          <TableHead className="font-semibold">Donor</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="font-semibold">Deleted At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.deletedDonations.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-12 text-slate-500">
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
                                  <div className="font-medium">{donation.donorName}</div>
                                  {donation.donorEmail && (
                                    <div className="text-xs text-slate-500">{donation.donorEmail}</div>
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
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-2xl">Deleted Memberships</CardTitle>
                  <CardDescription>View soft-deleted membership records</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                          <TableHead className="font-semibold">ID</TableHead>
                          <TableHead className="font-semibold">Student</TableHead>
                          <TableHead className="font-semibold">Tier</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="font-semibold">Deleted At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.deletedMemberships.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-12 text-slate-500">
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
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
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
            <DialogTitle>Edit {editingItem && 'donorName' in editingItem ? 'Donation' : 'Membership'}</DialogTitle>
            <DialogDescription>
              Update the details below and click save to apply changes.
            </DialogDescription>
          </DialogHeader>
          {editingItem && 'donorName' in editingItem ? (
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
                />
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

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {editingItem && 'donorName' in editingItem ? 'Donation' : 'Membership'}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this {editingItem && 'donorName' in editingItem ? 'donation' : 'membership'}? This action will soft-delete the record.
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
    </div>
  )
}

