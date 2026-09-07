"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  Settings,
  User,
  Shield,
  Bell,
  Palette,
  Database,
  Key,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Info,
  Trash2,
  Users,
  FolderKanban,
  FileText,
  BookOpen,
  Trophy,
  Play,
  MessageSquare,
  Megaphone,
  Loader2,
} from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { STUDENT_DATA_DELETE_CONFIRM_PHRASE, PROTECTED_STUDENT_DATA_TYPES } from "@/lib/student-data-delete-confirm"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
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
import { usePersistedState } from "@/hooks/use-persisted-state"

interface SettingsData {
  profile: {
    name: string
    email: string
    bio: string
    avatar: string
  }
  preferences: {
    theme: "light" | "dark" | "system"
    notifications: boolean
    email_notifications: boolean
    auto_save: boolean
  }
  security: {
    two_factor_enabled: boolean
    session_timeout: number
    password_change_required: boolean
  }
  system: {
    maintenance_mode: boolean
    backup_frequency: string
    log_retention_days: number
  }
}

interface DataStats {
  students: number
  groups: number
  groupMembers: number
  projects: number
  quizzes: number
  homeworks: number
  midsemExams: number
  finalExams: number
  practiceAssessments: number
  quizAttempts: number
  quizAnswers: number
  quizQuestions: number
  practiceAttempts: number
  practiceAnswers: number
  playgroundSessions: number
  playgroundResults: number
  userQuizzes: number
  userQuizAttempts: number
  announcements: number
  lectures: number
  lectureSlides: number
  forumPosts: number
  forumReplies: number
  classroomPoints: number
}

interface DataTypeConfig {
  key: string
  label: string
  icon: any
  color: string
  category: string
  description: string
}

export default function InstructorSettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [activeMenu, setActiveMenu] = usePersistedState<"profile" | "preferences" | "security" | "system" | "data">("settings-menu", "profile")

  const [settings, setSettings] = useState<SettingsData>({
    profile: {
      name: "",
      email: "",
      bio: "",
      avatar: "",
    },
    preferences: {
      theme: "system",
      notifications: true,
      email_notifications: true,
      auto_save: true,
    },
    security: {
      two_factor_enabled: false,
      session_timeout: 30,
      password_change_required: false,
    },
    system: {
      maintenance_mode: false,
      backup_frequency: "daily",
      log_retention_days: 30,
    },
  })

  const [dataStats, setDataStats] = useState<DataStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadingStats, setLoadingStats] = useState(false)
  const [clearingData, setClearingData] = useState<string[]>([])
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [dataClearConfirmPhrase, setDataClearConfirmPhrase] = useState("")
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>([])

  useEffect(() => {
    // Wait for layout to finish authentication check
    const timer = setTimeout(() => {
      const instructorSession = localStorage.getItem("instructorSession")
      if (instructorSession) {
        try {
          // Validate session structure before fetching
          const sessionData = JSON.parse(instructorSession)
          if (sessionData.id) {
            fetchSettings()
            fetchDataStats()
            return
          }
        } catch (e) {
          console.error("[Settings] Error parsing session:", e)
        }
      }
      // No valid session - layout will handle redirect
      setLoading(false)
    }, 200)

    return () => clearTimeout(timer)
  }, [])

  const getAuthHeaders = () => {
    const instructorSession = localStorage.getItem("instructorSession")
    let instructorId = localStorage.getItem("instructorId")
    
    // If instructorId is not in localStorage, try to get it from session
    if (!instructorId && instructorSession) {
      try {
        const sessionData = JSON.parse(instructorSession)
        instructorId = sessionData.id || sessionData.databaseId || null
        if (instructorId) {
          localStorage.setItem("instructorId", instructorId.toString())
        }
      } catch {
        // Session parsing failed, continue without instructorId
      }
    }
    
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    }
    
    if (instructorSession) {
      headers["authorization"] = instructorSession
    }
    if (instructorId) {
      headers["x-instructor-id"] = instructorId
    }
    
    return headers
  }

  const fetchSettings = async () => {
    try {
      const instructorSession = localStorage.getItem("instructorSession")
      if (!instructorSession) {
        setLoading(false)
        return
      }

      // Try to get instructorId from localStorage or parse from session
      let instructorId = localStorage.getItem("instructorId")
      if (!instructorId) {
        try {
          const sessionData = JSON.parse(instructorSession)
          instructorId = sessionData.id || sessionData.databaseId || null
          if (instructorId) {
            localStorage.setItem("instructorId", instructorId.toString())
          }
        } catch (e) {
          console.error("Error parsing session:", e)
          setLoading(false)
          return
        }
      }

      if (!instructorId) {
        setLoading(false)
        return
      }

      const response = await instructorApiFetch(`/api/instructor/settings?instructorId=${instructorId}`, {
        headers: getAuthHeaders(),
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.settings) {
          setSettings(data.settings)
        }
      } else if (response.status === 401) {
        // 401 - don't redirect, layout handles it
        console.warn("Unauthorized access to settings API")
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDataStats = async () => {
    setLoadingStats(true)
    try {
      const response = await instructorApiFetch("/api/instructor/data-management/stats", {
        headers: getAuthHeaders(),
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log("[Settings] Data stats received:", data)
        if (data.stats) {
          setDataStats(data.stats)
        } else {
          console.error("[Settings] No stats in response:", data)
          toast({
            title: "⚠️ Warning",
            description: "Received empty statistics. Check console for details.",
            variant: "destructive",
          })
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error("[Settings] Stats API error:", response.status, errorData)
        toast({
          title: "❌ Error",
          description: `Failed to fetch statistics: ${errorData.error || response.statusText}`,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("[Settings] Error fetching data stats:", error)
      toast({
        title: "❌ Error",
        description: `Failed to fetch statistics: ${error.message || "Network error"}`,
        variant: "destructive",
      })
    } finally {
      setLoadingStats(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      // Get instructorId from localStorage or session
      let instructorId = localStorage.getItem("instructorId")
      if (!instructorId) {
        const instructorSession = localStorage.getItem("instructorSession")
        if (instructorSession) {
          try {
            const sessionData = JSON.parse(instructorSession)
            instructorId = sessionData.id || sessionData.databaseId || null
            if (instructorId) {
              localStorage.setItem("instructorId", instructorId.toString())
            }
          } catch {
            // Session parsing failed
          }
        }
      }

      if (!instructorId) {
        toast({
          title: "❌ Error",
          description: "Unable to identify instructor. Please log in again.",
          variant: "destructive",
        })
        return
      }

      const response = await instructorApiFetch("/api/instructor/settings", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ instructorId, settings }),
      })

      if (response.ok) {
        toast({
          title: "✅ Settings Saved",
          description: "Your settings have been saved successfully",
        })
      } else if (response.status === 401) {
        toast({
          title: "❌ Authentication Error",
          description: "Your session has expired. Please log in again.",
          variant: "destructive",
        })
      } else {
        throw new Error("Failed to save settings")
      }
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({
        title: "❌ Error",
        description: "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleClearData = async () => {
    setClearingData(selectedDataTypes)
    try {
      const response = await instructorApiFetch("/api/instructor/data-management/clear", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ dataTypes: selectedDataTypes, confirmPhrase: dataClearConfirmPhrase }),
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: "✅ Data Cleared",
          description: data.message || "Selected data has been cleared successfully",
        })
        setClearDialogOpen(false)
        setSelectedDataTypes([])
        setDataClearConfirmPhrase("")
        fetchDataStats()
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to clear data")
      }
    } catch (error: any) {
      console.error("Error clearing data:", error)
      toast({
        title: "❌ Clear Failed",
        description: error.message || "Failed to clear data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setClearingData([])
    }
  }

  const updateSettings = (section: keyof SettingsData, updates: Partial<SettingsData[keyof SettingsData]>) => {
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates }
    }))
  }

  const dataTypeConfigs: DataTypeConfig[] = [
    { key: "students", label: "Students", icon: Users, color: "blue", category: "Core", description: "All student accounts and profiles" },
    { key: "groups", label: "Groups", icon: Users, color: "indigo", category: "Collaboration", description: "Student groups and memberships" },
    { key: "projects", label: "Projects", icon: FolderKanban, color: "purple", category: "Collaboration", description: "All project submissions" },
    { key: "quizzes", label: "Quizzes", icon: FileText, color: "green", category: "Assessments", description: "Quiz assessments and questions" },
    { key: "homeworks", label: "Homeworks", icon: BookOpen, color: "amber", category: "Assessments", description: "Homework assignments" },
    { key: "midsemExams", label: "Mid-Semester Exams", icon: FileText, color: "red", category: "Assessments", description: "Mid-semester exam data" },
    { key: "finalExams", label: "Final Exams", icon: FileText, color: "rose", category: "Assessments", description: "Final exam data" },
    { key: "practiceAssessments", label: "Practice Assessments", icon: BookOpen, color: "cyan", category: "Assessments", description: "Practice assessment data" },
    { key: "quizAttempts", label: "Quiz Attempts", icon: FileText, color: "teal", category: "Results", description: "All quiz attempt records" },
    { key: "quizAnswers", label: "Quiz Answers", icon: FileText, color: "emerald", category: "Results", description: "Individual quiz answers" },
    { key: "practiceAttempts", label: "Practice Attempts", icon: BookOpen, color: "sky", category: "Results", description: "Practice quiz attempts" },
    { key: "playgroundSessions", label: "Playground Sessions", icon: Play, color: "pink", category: "Activities", description: "Kahoot-style game sessions (blocked on production without ops approval)" },
    { key: "userQuizzes", label: "User Quizzes", icon: FileText, color: "violet", category: "Activities", description: "Student-created quizzes" },
    { key: "announcements", label: "Announcements", icon: Megaphone, color: "orange", category: "Content", description: "Course announcements" },
    { key: "lectures", label: "Lectures", icon: BookOpen, color: "indigo", category: "Content", description: "Lecture materials and slides" },
    { key: "forumPosts", label: "Forum Posts", icon: MessageSquare, color: "blue", category: "Content", description: "Discussion forum posts and replies" },
    { key: "classroomPoints", label: "Classroom Points", icon: Trophy, color: "yellow", category: "Gamification", description: "Student points and rewards" },
  ]

  const selectedProtectedDataTypes = selectedDataTypes.filter((key) =>
    (PROTECTED_STUDENT_DATA_TYPES as readonly string[]).includes(key),
  )
  const needsStudentDataConfirm = selectedProtectedDataTypes.length > 0

  const getDataCount = (key: string): number => {
    if (!dataStats) return 0
    return dataStats[key as keyof DataStats] || 0
  }

  const groupedDataTypes = dataTypeConfigs.reduce((acc, config) => {
    if (!acc[config.category]) {
      acc[config.category] = []
    }
    acc[config.category].push(config)
    return acc
  }, {} as Record<string, DataTypeConfig[]>)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center mx-auto">
            <Settings className="h-8 w-8 text-white animate-pulse" />
          </div>
          <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Loading Settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="sticky top-0 z-50 border-b border-slate-200/60 dark:border-slate-800/60 backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 shadow-sm"
      >
        <div className="container mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-1">
                Settings
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                Manage your account and system preferences
              </p>
            </motion.div>
            <motion.div 
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              {activeMenu !== "data" && (
                <Button
                  onClick={saveSettings}
                  disabled={saving}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-6 h-10 font-semibold"
                >
                  {saving ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              )}
              <Link href="/instructor/dashboard">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl px-4 h-10 font-medium transition-all"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Side Menu */}
          <motion.div 
            className="w-72 flex-shrink-0"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card className="border-slate-200/60 dark:border-slate-800/60 rounded-2xl shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
              <CardHeader className="pb-4 pt-6">
                <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-200">Navigation</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-4">
                <div className="space-y-1.5 px-2">
                  {[
                    { id: "profile", label: "Profile", icon: User, color: "blue", gradient: "from-blue-500 to-cyan-600" },
                    { id: "preferences", label: "Preferences", icon: Palette, color: "green", gradient: "from-emerald-500 to-teal-600" },
                    { id: "security", label: "Security", icon: Shield, color: "red", gradient: "from-red-500 to-rose-600" },
                    { id: "system", label: "System", icon: Database, color: "purple", gradient: "from-purple-500 to-indigo-600" },
                    { id: "data", label: "Data Management", icon: Trash2, color: "orange", gradient: "from-orange-500 to-amber-600" },
                  ].map((menu, index) => {
                    const Icon = menu.icon
                    const isActive = activeMenu === menu.id
                    return (
                      <motion.button
                        key={menu.id}
                        onClick={() => setActiveMenu(menu.id as any)}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.3 + index * 0.05 }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 text-left rounded-xl transition-all duration-200 relative group ${
                          isActive
                            ? `bg-gradient-to-r ${menu.gradient} text-white shadow-lg shadow-${menu.color}-500/30`
                            : "hover:bg-slate-100/80 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeMenu"
                            className="absolute inset-0 bg-gradient-to-r rounded-xl"
                            style={{ background: `linear-gradient(to right, var(--tw-gradient-stops))` }}
                            initial={false}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        )}
                        <Icon className={`h-5 w-5 relative z-10 ${isActive ? "text-white" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200"}`} />
                        <span className={`font-semibold relative z-10 ${isActive ? "text-white" : ""}`}>{menu.label}</span>
                      </motion.button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Content Area */}
          <motion.div 
            className="flex-1"
            key={activeMenu}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Profile Section */}
            {activeMenu === "profile" && (
              <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-2xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-indigo-500/10 p-6 border-b border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
                      <User className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-200">Profile Information</CardTitle>
                      <CardDescription className="text-slate-600 dark:text-slate-400 mt-1">Update your personal information and account details</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <motion.div 
                      className="space-y-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <Label htmlFor="name" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Full Name</Label>
                      <Input
                        id="name"
                        value={settings.profile.name}
                        onChange={(e) => updateSettings("profile", { name: e.target.value })}
                        className="rounded-xl border-slate-300 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20 h-11"
                        placeholder="Enter your full name"
                      />
                    </motion.div>
                    <motion.div 
                      className="space-y-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                    >
                      <Label htmlFor="email" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={settings.profile.email}
                        onChange={(e) => updateSettings("profile", { email: e.target.value })}
                        className="rounded-xl border-slate-300 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20 h-11"
                        placeholder="your.email@example.com"
                      />
                    </motion.div>
                  </div>
                  <motion.div 
                    className="space-y-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Label htmlFor="bio" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Bio</Label>
                    <textarea
                      id="bio"
                      value={settings.profile.bio}
                      onChange={(e) => updateSettings("profile", { bio: e.target.value })}
                      className="w-full p-4 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
                      rows={4}
                      placeholder="Tell us about yourself..."
                    />
                  </motion.div>
                </CardContent>
              </Card>
            )}

            {/* Preferences Section */}
            {activeMenu === "preferences" && (
              <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-2xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 p-6 border-b border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                      <Palette className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-200">Appearance & Preferences</CardTitle>
                      <CardDescription className="text-slate-600 dark:text-slate-400 mt-1">Customize your experience and interface settings</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="space-y-5">
                    {[
                      {
                        key: "theme",
                        label: "Theme",
                        description: "Choose your preferred theme",
                        type: "select" as const,
                        value: settings.preferences.theme,
                        options: ["light", "dark", "system"],
                        onChange: (value: string) => updateSettings("preferences", { theme: value as "light" | "dark" | "system" })
                      },
                      {
                        key: "notifications",
                        label: "Push Notifications",
                        description: "Receive push notifications",
                        type: "switch" as const,
                        value: settings.preferences.notifications,
                        onChange: (checked: boolean) => updateSettings("preferences", { notifications: checked })
                      },
                      {
                        key: "email_notifications",
                        label: "Email Notifications",
                        description: "Receive email notifications",
                        type: "switch" as const,
                        value: settings.preferences.email_notifications,
                        onChange: (checked: boolean) => updateSettings("preferences", { email_notifications: checked })
                      },
                      {
                        key: "auto_save",
                        label: "Auto Save",
                        description: "Automatically save changes",
                        type: "switch" as const,
                        value: settings.preferences.auto_save,
                        onChange: (checked: boolean) => updateSettings("preferences", { auto_save: checked })
                      },
                    ].map((item, index) => (
                      <motion.div
                        key={item.key}
                        className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + index * 0.05 }}
                      >
                        <div className="flex-1">
                          <Label className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.label}</Label>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.description}</p>
                        </div>
                        {item.type === "select" ? (
                          <select
                            value={item.value as string}
                            onChange={(e) => item.onChange(e.target.value)}
                            className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
                          >
                            {item.options?.map(opt => (
                              <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                            ))}
                          </select>
                        ) : (
                          <Switch
                            checked={item.value as boolean}
                            onCheckedChange={item.onChange}
                          />
                        )}
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Security Section */}
            {activeMenu === "security" && (
              <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-2xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-red-500/10 via-rose-500/10 to-pink-500/10 p-6 border-b border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-200">Security Settings</CardTitle>
                      <CardDescription className="text-slate-600 dark:text-slate-400 mt-1">Manage your account security and authentication</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="space-y-5">
                    {[
                      {
                        key: "two_factor_enabled",
                        label: "Two-Factor Authentication",
                        description: "Add an extra layer of security to your account",
                        type: "switch" as const,
                        value: settings.security.two_factor_enabled,
                        onChange: (checked: boolean) => updateSettings("security", { two_factor_enabled: checked })
                      },
                      {
                        key: "session_timeout",
                        label: "Session Timeout",
                        description: "Minutes before session expires",
                        type: "number" as const,
                        value: settings.security.session_timeout,
                        onChange: (value: number) => updateSettings("security", { session_timeout: value }),
                        min: 5,
                        max: 480
                      },
                      {
                        key: "password_change_required",
                        label: "Password Change Required",
                        description: "Force password change on next login",
                        type: "switch" as const,
                        value: settings.security.password_change_required,
                        onChange: (checked: boolean) => updateSettings("security", { password_change_required: checked })
                      },
                    ].map((item, index) => (
                      <motion.div
                        key={item.key}
                        className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + index * 0.05 }}
                      >
                        <div className="flex-1">
                          <Label className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.label}</Label>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.description}</p>
                        </div>
                        {item.type === "switch" ? (
                          <Switch
                            checked={item.value as boolean}
                            onCheckedChange={item.onChange}
                          />
                        ) : (
                          <Input
                            type="number"
                            value={item.value as number}
                            onChange={(e) => item.onChange(parseInt(e.target.value))}
                            className="w-24 rounded-xl border-slate-300 dark:border-slate-700 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 h-10 text-center font-semibold"
                            min={item.min}
                            max={item.max}
                          />
                        )}
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* System Section */}
            {activeMenu === "system" && (
              <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-2xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 p-6 border-b border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <Database className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-200">System Settings</CardTitle>
                      <CardDescription className="text-slate-600 dark:text-slate-400 mt-1">Manage system-wide settings and configurations</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="space-y-5">
                    {[
                      {
                        key: "maintenance_mode",
                        label: "Maintenance Mode",
                        description: "Put the system in maintenance mode",
                        type: "switch" as const,
                        value: settings.system.maintenance_mode,
                        onChange: (checked: boolean) => updateSettings("system", { maintenance_mode: checked })
                      },
                      {
                        key: "backup_frequency",
                        label: "Backup Frequency",
                        description: "How often to backup data",
                        type: "select" as const,
                        value: settings.system.backup_frequency,
                        options: ["daily", "weekly", "monthly"],
                        onChange: (value: string) => updateSettings("system", { backup_frequency: value })
                      },
                      {
                        key: "log_retention_days",
                        label: "Log Retention",
                        description: "Days to keep system logs",
                        type: "number" as const,
                        value: settings.system.log_retention_days,
                        onChange: (value: number) => updateSettings("system", { log_retention_days: value }),
                        min: 7,
                        max: 365
                      },
                    ].map((item, index) => (
                      <motion.div
                        key={item.key}
                        className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + index * 0.05 }}
                      >
                        <div className="flex-1">
                          <Label className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.label}</Label>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.description}</p>
                        </div>
                        {item.type === "switch" ? (
                          <Switch
                            checked={item.value as boolean}
                            onCheckedChange={item.onChange}
                          />
                        ) : item.type === "select" ? (
                          <select
                            value={item.value as string}
                            onChange={(e) => item.onChange(e.target.value)}
                            className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-medium"
                          >
                            {item.options?.map(opt => (
                              <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            type="number"
                            value={item.value as number}
                            onChange={(e) => item.onChange(parseInt(e.target.value))}
                            className="w-24 rounded-xl border-slate-300 dark:border-slate-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 h-10 text-center font-semibold"
                            min={item.min}
                            max={item.max}
                          />
                        )}
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Data Management Section */}
            {activeMenu === "data" && (
              <div className="space-y-6">
                <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-2xl overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-red-500/10 p-6 border-b border-slate-200/60 dark:border-slate-800/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
                          <Trash2 className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-200">Data Management</CardTitle>
                          <CardDescription className="text-slate-600 dark:text-slate-400 mt-1">View and manage system data across all modules</CardDescription>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={fetchDataStats}
                        disabled={loadingStats}
                        className="rounded-xl border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loadingStats ? "animate-spin" : ""}`} />
                        Refresh
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8">
                    {loadingStats ? (
                      <div className="flex items-center justify-center py-16">
                        <div className="text-center space-y-4">
                          <Loader2 className="h-10 w-10 animate-spin text-orange-600 mx-auto" />
                          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Loading data statistics...</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        {Object.entries(groupedDataTypes).map(([category, types], categoryIndex) => (
                          <motion.div 
                            key={category}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: categoryIndex * 0.1 }}
                          >
                            <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                              <div className="h-1 w-8 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full" />
                              {category}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {types.map((config, index) => {
                                const Icon = config.icon
                                const count = getDataCount(config.key)
                                const isSelected = selectedDataTypes.includes(config.key)
                                const isClearing = clearingData.includes(config.key)

                                return (
                                  <motion.div
                                    key={config.key}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: categoryIndex * 0.1 + index * 0.05 }}
                                  >
                                    <Card
                                      className={`border-2 transition-all duration-200 cursor-pointer rounded-xl overflow-hidden hover:shadow-lg ${
                                        isSelected
                                          ? "border-red-500/80 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 shadow-lg shadow-red-500/20"
                                          : "border-slate-200/60 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 bg-white/80 dark:bg-slate-800/80"
                                      }`}
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedDataTypes(prev => prev.filter(k => k !== config.key))
                                        } else {
                                          setSelectedDataTypes(prev => [...prev, config.key])
                                        }
                                      }}
                                    >
                                      <CardContent className="p-5">
                                        <div className="flex items-center justify-between gap-4">
                                          <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className={`p-3 rounded-xl shadow-sm ${
                                              config.color === "blue" ? "bg-blue-100 dark:bg-blue-900/30" :
                                              config.color === "indigo" ? "bg-indigo-100 dark:bg-indigo-900/30" :
                                              config.color === "purple" ? "bg-purple-100 dark:bg-purple-900/30" :
                                              config.color === "green" ? "bg-green-100 dark:bg-green-900/30" :
                                              config.color === "amber" ? "bg-amber-100 dark:bg-amber-900/30" :
                                              config.color === "red" ? "bg-red-100 dark:bg-red-900/30" :
                                              config.color === "rose" ? "bg-rose-100 dark:bg-rose-900/30" :
                                              config.color === "cyan" ? "bg-cyan-100 dark:bg-cyan-900/30" :
                                              config.color === "teal" ? "bg-teal-100 dark:bg-teal-900/30" :
                                              config.color === "emerald" ? "bg-emerald-100 dark:bg-emerald-900/30" :
                                              config.color === "sky" ? "bg-sky-100 dark:bg-sky-900/30" :
                                              config.color === "pink" ? "bg-pink-100 dark:bg-pink-900/30" :
                                              config.color === "violet" ? "bg-violet-100 dark:bg-violet-900/30" :
                                              config.color === "orange" ? "bg-orange-100 dark:bg-orange-900/30" :
                                              config.color === "yellow" ? "bg-yellow-100 dark:bg-yellow-900/30" :
                                              "bg-slate-100 dark:bg-slate-900/30"
                                            }`}>
                                              <Icon className={`h-5 w-5 ${
                                                config.color === "blue" ? "text-blue-600 dark:text-blue-400" :
                                                config.color === "indigo" ? "text-indigo-600 dark:text-indigo-400" :
                                                config.color === "purple" ? "text-purple-600 dark:text-purple-400" :
                                                config.color === "green" ? "text-green-600 dark:text-green-400" :
                                                config.color === "amber" ? "text-amber-600 dark:text-amber-400" :
                                                config.color === "red" ? "text-red-600 dark:text-red-400" :
                                                config.color === "rose" ? "text-rose-600 dark:text-rose-400" :
                                                config.color === "cyan" ? "text-cyan-600 dark:text-cyan-400" :
                                                config.color === "teal" ? "text-teal-600 dark:text-teal-400" :
                                                config.color === "emerald" ? "text-emerald-600 dark:text-emerald-400" :
                                                config.color === "sky" ? "text-sky-600 dark:text-sky-400" :
                                                config.color === "pink" ? "text-pink-600 dark:text-pink-400" :
                                                config.color === "violet" ? "text-violet-600 dark:text-violet-400" :
                                                config.color === "orange" ? "text-orange-600 dark:text-orange-400" :
                                                config.color === "yellow" ? "text-yellow-600 dark:text-yellow-400" :
                                                "text-slate-600 dark:text-slate-400"
                                              }`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate mb-1">
                                                {config.label}
                                              </p>
                                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                                                {config.description}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-3 flex-shrink-0">
                                            <Badge 
                                              variant="outline" 
                                              className="font-mono font-bold text-xs min-w-[70px] justify-center bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 px-3 py-1.5"
                                            >
                                              {count.toLocaleString()}
                                            </Badge>
                                            {isClearing && (
                                              <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                                            )}
                                            {isSelected && (
                                              <CheckCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                            )}
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  </motion.div>
                                )
                              })}
                            </div>
                          </motion.div>
                        ))}

                        {selectedDataTypes.length > 0 && (
                          <motion.div 
                            className="pt-6 mt-6 border-t-2 border-slate-200 dark:border-slate-700"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <div className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-2 border-red-200 dark:border-red-800/50">
                              <div>
                                <p className="font-bold text-base text-slate-800 dark:text-slate-200 mb-1">
                                  {selectedDataTypes.length} data type{selectedDataTypes.length > 1 ? 's' : ''} selected
                                </p>
                                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                                  ⚠️ This action cannot be undone
                                </p>
                              </div>
                              <Button
                                variant="destructive"
                                onClick={() => setClearDialogOpen(true)}
                                className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-lg hover:shadow-xl rounded-xl px-6 h-11 font-semibold"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Clear Selected
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </motion.div>
        </div>
      </main>

      {/* Clear Data Confirmation Dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={(open) => {
        setClearDialogOpen(open)
        if (!open) setDataClearConfirmPhrase("")
      }}>
        <AlertDialogContent className="rounded-2xl border-slate-200 dark:border-slate-800">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-white" />
              </div>
              <AlertDialogTitle className="text-xl font-bold text-slate-800 dark:text-slate-200">Confirm Data Deletion</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400 space-y-4">
              <p className="font-medium">You are about to permanently delete the following data types:</p>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2 max-h-60 overflow-y-auto">
                {selectedDataTypes.map((key) => {
                  const config = dataTypeConfigs.find(c => c.key === key)
                  const count = getDataCount(key)
                  return (
                    <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{config?.label}</span>
                      <Badge variant="outline" className="font-mono font-bold bg-slate-100 dark:bg-slate-800">
                        {count.toLocaleString()} {count === 1 ? 'record' : 'records'}
                      </Badge>
                    </div>
                  )
                })}
              </div>
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800/50">
                <p className="font-bold text-red-700 dark:text-red-400 text-sm">
                  ⚠️ This action cannot be undone. All selected data will be permanently deleted.
                </p>
              </div>
              {needsStudentDataConfirm && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">
                    Student data delete requires typing: {STUDENT_DATA_DELETE_CONFIRM_PHRASE}
                  </p>
                  <Input
                    value={dataClearConfirmPhrase}
                    onChange={(e) => setDataClearConfirmPhrase(e.target.value)}
                    placeholder={STUDENT_DATA_DELETE_CONFIRM_PHRASE}
                    className="font-mono text-sm"
                  />
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearData}
              disabled={
                needsStudentDataConfirm &&
                dataClearConfirmPhrase !== STUDENT_DATA_DELETE_CONFIRM_PHRASE
              }
              className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white rounded-xl font-semibold shadow-lg"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Yes, Clear Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
