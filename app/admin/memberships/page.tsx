"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Search, Users, DollarSign, TrendingUp, Crown } from "lucide-react"
import { type MembershipTier, MEMBERSHIP_PLANS } from "@/lib/membership-constants"
import { useToast } from "@/hooks/use-toast"

interface MembershipData {
  id: number
  student_id: number
  student_name: string
  student_id_code: string
  plan: MembershipTier
  status: string
  stripe_subscription_id: string | null
  start_date: string
  end_date: string | null
  expires_at: string | null
  created_at: string
}

interface MembershipStats {
  totalMembers: number
  scholarCount: number
  explorerCount: number
  trailblazerCount: number
  monthlyRevenue: number
}

export default function AdminMembershipsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [memberships, setMemberships] = useState<MembershipData[]>([])
  const [filteredMemberships, setFilteredMemberships] = useState<MembershipData[]>([])
  const [stats, setStats] = useState<MembershipStats>({
    totalMembers: 0,
    scholarCount: 0,
    explorerCount: 0,
    trailblazerCount: 0,
    monthlyRevenue: 0,
  })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterTier, setFilterTier] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [activeOnly, setActiveOnly] = useState(true)

  useEffect(() => {
    fetchMemberships()
  }, [activeOnly])

  useEffect(() => {
    filterMemberships()
  }, [searchQuery, filterTier, filterStatus, memberships])

  const fetchMemberships = async () => {
    try {
      const url = activeOnly ? "/api/admin/memberships?activeOnly=true" : "/api/admin/memberships"
      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) throw new Error(data.error)

      setMemberships(data.memberships)
      calculateStats(data.memberships)
    } catch (error) {
      console.error("Failed to fetch memberships:", error)
      toast({
        title: "Error",
        description: "Failed to load memberships data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (data: MembershipData[]) => {
    const scholarCount = data.filter((m) => m.plan === "Scholar").length
    const explorerCount = data.filter((m) => m.plan === "Explorer").length
    const trailblazerCount = data.filter((m) => m.plan === "Trailblazer").length

    const explorerPlan = MEMBERSHIP_PLANS.find((p) => p.id === "Explorer")
    const trailblazerPlan = MEMBERSHIP_PLANS.find((p) => p.id === "Trailblazer")

    const monthlyRevenue =
      explorerCount * ((explorerPlan?.priceInCents || 0) / 100) +
      trailblazerCount * ((trailblazerPlan?.priceInCents || 0) / 100)

    setStats({
      totalMembers: data.length,
      scholarCount,
      explorerCount,
      trailblazerCount,
      monthlyRevenue,
    })
  }

  const filterMemberships = () => {
    let filtered = [...memberships]

    if (searchQuery) {
      filtered = filtered.filter(
        (m) =>
          m.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.student_id_code.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    if (filterTier !== "all") {
      filtered = filtered.filter((m) => m.plan === filterTier)
    }

    if (filterStatus !== "all") {
      if (filterStatus === "expired") {
        filtered = filtered.filter(
          (m) => m.status === "active" && m.expires_at && new Date(m.expires_at) < new Date()
        )
      } else {
        filtered = filtered.filter((m) => m.status === filterStatus)
      }
    }

    setFilteredMemberships(filtered)
  }

  const getTierBadge = (tier: MembershipTier) => {
    const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
    return (
      <Badge variant={tier === "Scholar" ? "secondary" : tier === "Explorer" ? "default" : "default"}>
        {plan?.badge} {tier}
      </Badge>
    )
  }

  const getStatusBadge = (status: string, expiresAt: string | null) => {
    const isExpired = status === "active" && expiresAt && new Date(expiresAt) < new Date()
    const displayStatus = isExpired ? "expired" : status
    const variant = displayStatus === "active" ? "default" : displayStatus === "canceled" || displayStatus === "expired" ? "destructive" : "secondary"
    return <Badge variant={variant}>{displayStatus}</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading memberships...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" onClick={() => router.push("/admin/dashboard")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <h1 className="text-4xl font-bold mb-2">Membership Management</h1>
        <p className="text-muted-foreground">Monitor and manage student subscriptions</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMembers}</div>
            <p className="text-xs text-muted-foreground mt-1">All active students</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Premium Members</CardTitle>
            <Crown className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.explorerCount + stats.trailblazerCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.explorerCount} Explorer, {stats.trailblazerCount} Trailblazer
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.monthlyRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Recurring monthly</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalMembers > 0
                ? (((stats.explorerCount + stats.trailblazerCount) / stats.totalMembers) * 100).toFixed(1)
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground mt-1">Free to paid conversion</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filter Memberships</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or student ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterTier} onValueChange={setFilterTier}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="Scholar">Scholar</SelectItem>
                <SelectItem value="Explorer">Explorer</SelectItem>
                <SelectItem value="Trailblazer">Trailblazer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="activeOnly"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="activeOnly" className="text-sm text-muted-foreground cursor-pointer">
                Active members only
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Memberships Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Memberships</CardTitle>
          <CardDescription>
            Showing {filteredMemberships.length} of {memberships.length} memberships
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Subscription ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMemberships.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No memberships found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMemberships.map((membership) => (
                    <TableRow key={membership.id}>
                      <TableCell className="font-medium">{membership.student_name}</TableCell>
                      <TableCell>{membership.student_id_code}</TableCell>
                      <TableCell>{getTierBadge(membership.plan)}</TableCell>
                      <TableCell>{getStatusBadge(membership.status, membership.expires_at)}</TableCell>
                      <TableCell>
                        {new Date(membership.start_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {membership.stripe_subscription_id ? (
                          <span className="text-muted-foreground">
                            {membership.stripe_subscription_id.slice(0, 20)}...
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
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
  )
}
