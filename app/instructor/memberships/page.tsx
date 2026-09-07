"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import React, { useState, useEffect } from "react"
import Link from "next/link"
import { 
  BookOpen, 
  Users, 
  BarChart3, 
  Database, 
  Brain, 
  Calendar,
  MessageSquare,
  Settings,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity,
  Target,
  Award,
  Zap,
  FileText,
  ClipboardList,
  HelpCircle,
  Shield,
  Monitor,
  LogOut,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Edit,
  Trash2,
  Eye,
  MoreHorizontal,
  Star,
  Crown
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface MembershipTier {
  id: string
  name: string
  description: string
  price: number
  features: string[]
  limitations: string[]
  color: string
  icon: React.ReactNode
  popular?: boolean
}

export function InstructorMembershipsPage() {
  const [memberships, setMemberships] = useState<MembershipTier[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchMemberships()
  }, [])

  const fetchMemberships = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/memberships")
      const data = await response.json()
      
      if (response.ok) {
        setMemberships(data.memberships)
      }
    } catch (error) {
      console.error("Error fetching memberships:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const membershipTiers: MembershipTier[] = [
    {
      id: "Scholar",
      name: "Scholar",
      description: "Perfect for getting started with the basics",
      price: 0,
      features: [
        "1 quiz attempt per assessment",
        "Access to all lecture materials",
        "Forum participation",
        "250 Cora Credits / month",
        "Basic support",
      ],
      limitations: [
        "No leaderboard access",
        "Limited Cora",
        "No CodeBench access",
        "No early access features",
      ],
      color: "from-slate-400 to-slate-600",
      icon: <Award className="h-6 w-6" />,
    },
    {
      id: "Explorer",
      name: "Explorer",
      description: "For students who want to explore more features",
      price: 5.99,
      features: [
        "2 quiz attempts per assessment (1 retake)",
        "1 past-due rollover per assessment (24h window)",
        "Access to all lecture materials",
        "Leaderboard participation",
        "3,000 Cora Credits / month",
        "Priority support",
      ],
      limitations: [
        "No CodeBench access",
        "No early access features",
        "Limited Cora usage",
      ],
      color: "from-blue-500 to-cyan-600",
      icon: <Star className="h-6 w-6" />,
      popular: true,
    },
    {
      id: "Trailblazer",
      name: "Trailblazer",
      description: "The ultimate learning experience with all features unlocked",
      price: 9.99,
      features: [
        "3 quiz attempts per assessment",
        "Access to all lecture materials",
        "Leaderboard participation",
        "7,500 Cora Credits / month + Cora Lite",
        "CodeBench IDE access",
        "Early access to new features",
        "Priority support",
      ],
      limitations: [],
      color: "from-purple-500 to-indigo-600",
      icon: <Crown className="h-6 w-6" />,
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">Membership Management</h1>
        <p className="text-blue-100">
          Manage student membership tiers and upgrade plans.
        </p>
      </div>

      {/* Membership Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">1,247</div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Premium Members</CardTitle>
            <Award className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">423</div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              34% of total members
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">$8,247</div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              +8% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Membership Tiers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Award className="h-5 w-5 text-yellow-500" />
            <span>Membership Tiers</span>
          </CardTitle>
          <CardDescription>
            Configure membership plans and pricing for students
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {membershipTiers.map((tier) => (
              <Card key={tier.id} className={`relative ${tier.popular ? 'ring-2 ring-blue-500' : ''}`}>
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-500 text-white">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="text-center">
                  <div className={`mx-auto w-16 h-16 rounded-full bg-gradient-to-r ${tier.color} flex items-center justify-center mb-4`}>
                    {tier.icon}
                  </div>
                  <CardTitle className="text-xl">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">
                    ${tier.price}
                    {tier.price > 0 && <span className="text-sm font-normal text-slate-500">/month</span>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Features</h4>
                    <ul className="space-y-1">
                      {tier.features.map((feature, index) => (
                        <li key={index} className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {tier.limitations.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Limitations</h4>
                      <ul className="space-y-1">
                        {tier.limitations.map((limitation, index) => (
                          <li key={index} className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                            <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                            {limitation}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Button className="w-full" variant={tier.popular ? "default" : "outline"}>
                    Edit Plan
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Membership Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              <span>Membership Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Scholar</span>
                <div className="flex items-center space-x-2">
                  <Progress value={45} className="w-24" />
                  <span className="text-sm font-medium">45%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Explorer</span>
                <div className="flex items-center space-x-2">
                  <Progress value={35} className="w-24" />
                  <span className="text-sm font-medium">35%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Trailblazer</span>
                <div className="flex items-center space-x-2">
                  <Progress value={20} className="w-24" />
                  <span className="text-sm font-medium">20%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span>Upgrade Activity</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">This Month</span>
                <Badge variant="outline" className="text-green-600 border-green-600">+23</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Last Month</span>
                <Badge variant="outline" className="text-blue-600 border-blue-600">+18</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Conversion Rate</span>
                <Badge variant="outline" className="text-purple-600 border-purple-600">12.5%</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
