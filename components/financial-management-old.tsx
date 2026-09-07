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
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

interface Donation {
  id: number
  amount: number
  donorName: string
  donorEmail: string | null
  message: string | null
  isAnonymous: boolean
  status: string
  createdAt: string
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

export function FinancialManagement() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<FinancialData | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterTier, setFilterTier] = useState<string>("all")

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
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

        {/* Tabs */}
        <Tabs defaultValue="donations" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl p-2">
            <TabsTrigger 
              value="donations" 
              className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white"
            >
              <Heart className="h-4 w-4 mr-2" />
              Donations ({filteredDonations.length})
            </TabsTrigger>
            <TabsTrigger 
              value="memberships"
              className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white"
            >
              <Crown className="h-4 w-4 mr-2" />
              Memberships ({filteredMemberships.length})
            </TabsTrigger>
          </TabsList>

          {/* Donations Tab */}
          <TabsContent value="donations" className="space-y-4">
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDonations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12 text-slate-500">
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
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Memberships Tab */}
          <TabsContent value="memberships" className="space-y-4">
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMemberships.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-12 text-slate-500">
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
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </div>
  )
}
