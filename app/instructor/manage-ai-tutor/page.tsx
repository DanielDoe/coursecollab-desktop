"use client"

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
  Crown,
  PieChart,
  LineChart,
  BarChart,
  Server,
  Database as DatabaseIcon,
  Cpu,
  HardDrive,
  FileSearch,
  Calendar as CalendarIcon,
  UserCheck,
  Mail,
  FileX,
  AlertTriangle,
  Info,
  Bug,
  Lightbulb,
  ExternalLink,
  ChevronRight,
  Phone,
  Video,
  MessageCircle,
  Play,
  Gamepad2,
  Code,
  Terminal,
  Bot,
  MessageSquare as MessageSquareIcon,
  Sparkles,
  Wand2,
  RefreshCw,
  RotateCcw,
  Trophy,
  TrendingDown,
  Target as TargetIcon,
  ArrowRight,
  Shuffle,
  Layers,
  MessageCircle as MessageCircleIcon,
  User,
  Send,
  Volume2,
  VolumeX
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

export function InstructorManageAITutorPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [aiStats, setAiStats] = useState({
    totalSessions: 0,
    activeUsers: 0,
    averageRating: 0,
    totalQuestions: 0
  })

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setIsLoading(false), 1000)
  }, [])

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
        <h1 className="text-3xl font-bold mb-2">Manage AI Tutor</h1>
        <p className="text-blue-100">
          Configure AI tutor settings, monitor conversations, and analyze student interactions.
        </p>
      </div>

      {/* AI Tutor Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <MessageCircleIcon className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">2,847</div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              +23% from last month
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">189</div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Currently using AI tutor
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">4.7</div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Out of 5 stars
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Questions Answered</CardTitle>
            <Bot className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">12,456</div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              This month
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-blue-500" />
                  <span>Recent Activity</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        Student asked about binary search algorithm
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        2 minutes ago
                      </p>
                    </div>
                    <Badge variant="outline" className="text-green-600 border-green-600">RESOLVED</Badge>
                  </div>
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        Student requested help with data structures
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        5 minutes ago
                      </p>
                    </div>
                    <Badge variant="outline" className="text-blue-600 border-blue-600">ACTIVE</Badge>
                  </div>
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        Student rated AI response 5 stars
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        8 minutes ago
                      </p>
                    </div>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600">RATED</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-green-500" />
                  <span>Performance Metrics</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Response Time</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={85} className="w-24" />
                      <span className="text-sm font-medium">1.2s</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Accuracy Rate</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={92} className="w-24" />
                      <span className="text-sm font-medium">92%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Student Satisfaction</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={94} className="w-24" />
                      <span className="text-sm font-medium">94%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="conversations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageCircleIcon className="h-5 w-5 text-purple-500" />
                <span>Recent Conversations</span>
              </CardTitle>
              <CardDescription>
                Monitor and review student-AI interactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">Sarah Johnson</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Asked about algorithm complexity analysis</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-green-600 border-green-600">Completed</Badge>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">Michael Chen</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Requested help with data structure implementation</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-blue-600 border-blue-600">Active</Badge>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">Emily Rodriguez</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Asked for clarification on system design concepts</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-green-600 border-green-600">Completed</Badge>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5 text-blue-500" />
                <span>AI Tutor Configuration</span>
              </CardTitle>
              <CardDescription>
                Configure AI tutor behavior and response settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ai-model">AI Model</Label>
                <Select defaultValue="gpt-5-mini">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-5-mini">GPT-5 Mini (Recommended)</SelectItem>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    <SelectItem value="claude-3">Claude-3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="response-style">Response Style</Label>
                <Select defaultValue="helpful">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="helpful">Helpful & Detailed</SelectItem>
                    <SelectItem value="concise">Concise & Direct</SelectItem>
                    <SelectItem value="encouraging">Encouraging & Supportive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-response-length">Max Response Length</Label>
                <Input id="max-response-length" type="number" defaultValue="500" />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="enable-code-examples" defaultChecked />
                <Label htmlFor="enable-code-examples">Enable code examples</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="enable-step-by-step" defaultChecked />
                <Label htmlFor="enable-step-by-step">Enable step-by-step explanations</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="enable-hints" defaultChecked />
                <Label htmlFor="enable-hints">Enable hints before full answers</Label>
              </div>
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-orange-500" />
                <span>AI Tutor Analytics</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">94%</div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Response Accuracy</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">1.2s</div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Avg Response Time</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">4.7</div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Avg Rating</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">89%</div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Student Satisfaction</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

