"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ClipboardList,
  Lightbulb,
  UsersRound,
  FolderKanban,
  AlertCircle,
  BookOpen,
  FileText,
  GraduationCap,
  Code2,
  Bot,
  Presentation,
  MessageSquare,
  Pin,
  Clock,
  Search,
  X,
  GripVertical,
  PinOff,
  Zap,
  Library,
  History,
  Megaphone,
  Calendar,
  Trophy,
  Crown,
  Heart,
  Gem,
} from "lucide-react"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { usePersistedState, useScrollRestoration } from "@/hooks/use-persisted-state"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ViewToggle } from "@/components/ui/view-toggle"
import { Input } from "@/components/ui/input"
import { motion, AnimatePresence } from "framer-motion"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { UpgradeReminderBanner } from "@/components/upgrade-reminder-banner"

interface Module {
  id: string
  title: string
  description: string
  icon: any
  href: string
  color?: string
  bgGradient?: string
  borderColor?: string
  isFavorite: boolean
  displayOrder: number
  usageCount: number
  lastAccessed: Date | null
  disabled?: boolean
}

function getModuleColorClasses(color?: string) {
  if (!color) {
    return {
      iconBg: "bg-purple-100/80",
      iconColor: "text-purple-700",
      pinColor: "text-purple-700 hover:text-purple-800",
      cardGlow: "hover:shadow-purple-200/40",
    }
  }

  const colorMap: Record<string, { iconBg: string; iconColor: string; pinColor: string; cardGlow: string }> = {
    accent: { 
      iconBg: "bg-purple-100/80", 
      iconColor: "text-purple-700", 
      pinColor: "text-purple-700 hover:text-purple-800",
      cardGlow: "hover:shadow-purple-200/40"
    },
    "blue-500": { 
      iconBg: "bg-blue-100/80", 
      iconColor: "text-blue-700", 
      pinColor: "text-blue-700 hover:text-blue-800",
      cardGlow: "hover:shadow-blue-200/40"
    },
    "purple-500": {
      iconBg: "bg-purple-100/80",
      iconColor: "text-purple-700",
      pinColor: "text-purple-700 hover:text-purple-800",
      cardGlow: "hover:shadow-purple-200/40"
    },
    "green-500": {
      iconBg: "bg-emerald-100/80",
      iconColor: "text-emerald-700",
      pinColor: "text-emerald-700 hover:text-emerald-800",
      cardGlow: "hover:shadow-emerald-200/40"
    },
    "orange-500": {
      iconBg: "bg-amber-100/80",
      iconColor: "text-amber-700",
      pinColor: "text-amber-700 hover:text-amber-800",
      cardGlow: "hover:shadow-amber-200/40"
    },
    "pink-500": { 
      iconBg: "bg-pink-100/80", 
      iconColor: "text-pink-700", 
      pinColor: "text-pink-700 hover:text-pink-800",
      cardGlow: "hover:shadow-pink-200/40"
    },
    "red-500": { 
      iconBg: "bg-red-100/80", 
      iconColor: "text-red-700", 
      pinColor: "text-red-700 hover:text-red-800",
      cardGlow: "hover:shadow-red-200/40"
    },
    "teal-500": { 
      iconBg: "bg-teal-100/80", 
      iconColor: "text-teal-700", 
      pinColor: "text-teal-700 hover:text-teal-800",
      cardGlow: "hover:shadow-teal-200/40"
    },
    "indigo-500": {
      iconBg: "bg-indigo-100/80",
      iconColor: "text-indigo-700",
      pinColor: "text-indigo-700 hover:text-indigo-800",
      cardGlow: "hover:shadow-indigo-200/40"
    },
    "cyan-500": { 
      iconBg: "bg-cyan-100/80", 
      iconColor: "text-cyan-700", 
      pinColor: "text-cyan-700 hover:text-cyan-800",
      cardGlow: "hover:shadow-cyan-200/40"
    },
    "emerald-500": {
      iconBg: "bg-emerald-100/80",
      iconColor: "text-emerald-700",
      pinColor: "text-emerald-700 hover:text-emerald-800",
      cardGlow: "hover:shadow-emerald-200/40"
    },
  }

  return (
    colorMap[color] || {
      iconBg: "bg-purple-100/80",
      iconColor: "text-purple-700",
      pinColor: "text-purple-700 hover:text-purple-800",
      cardGlow: "hover:shadow-purple-200/40"
    }
  )
}

function handleToggleFavorite(moduleId: string) {
  // This function should be defined somewhere in the code
  console.log(`Toggle favorite for module ${moduleId}`)
}

function SortableModuleCard({
  module,
  view,
  onToggleFavorite,
  onModuleClick,
}: {
  module: Module
  view: "grid" | "list"
  onToggleFavorite: (moduleId: string) => void
  onModuleClick: (moduleId: string) => void
}) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: module.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const Icon = module.icon
  const colorClasses = getModuleColorClasses(module.color)

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault()
      e.stopPropagation()
      return
    }

    // track usage
    onModuleClick(module.id)

    // navigate
    router.push(module.href)
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group" draggable={false}>
      <Card
        onClick={handleClick}
        className={cn(
          "min-h-[160px] flex flex-col justify-between transition-all duration-300 cursor-pointer",
          "bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]",
          "hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] hover:scale-[1.02] hover:-translate-y-1",
          colorClasses.cardGlow,
          "rounded-2xl overflow-hidden"
        )}
      >
        <CardHeader className="p-6 space-y-3">
          <div className="flex items-start gap-4">
            {/* Drag Handle */}
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity mt-1"
              onClick={(e) => {
                // Prevent drag handle clicks from opening module
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              <GripVertical className="h-4 w-4 text-slate-400" />
            </div>

            {/* Icon */}
            <div
              className={cn(
                "h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm",
                colorClasses.iconBg
              )}
            >
              <Icon className={cn("h-6 w-6", colorClasses.iconColor)} />
            </div>

            {/* Title + Description */}
            <div className="flex-1 min-w-0">
              <CardTitle 
                className="text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-200 line-clamp-1 mb-1"
                title={module.title}
              >
                {module.title}
              </CardTitle>
              <CardDescription 
                className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed"
                title={module.description}
              >
                {module.description}
              </CardDescription>
            </div>

            {/* Favorite button */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 opacity-0 group-hover:opacity-100 transition-all duration-200 flex-shrink-0",
                "hover:bg-slate-100/80 rounded-xl",
                module.isFavorite && "opacity-100"
              )}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onToggleFavorite(module.id)
              }}
            >
              <Pin
                className={cn(
                  "h-4 w-4 transition-colors",
                  module.isFavorite
                    ? "text-amber-600 fill-amber-100" // PVAMU gold for favorites
                    : "text-slate-400 group-hover:text-slate-600"
                )}
              />
            </Button>
          </div>
        </CardHeader>
      </Card>
    </div>
  )
}

export function StudentDashboard() {
  const router = useRouter()
  usePreventBack("/student/login")
  
  // Use persisted state for dashboard preferences
  const [view, setView] = usePersistedState<"grid" | "list">("student-dashboard-view", "grid")
  const [searchQuery, setSearchQuery] = usePersistedState("student-dashboard-search", "")
  
  // Restore scroll position
  useScrollRestoration("student-dashboard")
  
  // Non-persisted state
  const [studentName, setStudentName] = useState("")
  const [studentSection, setStudentSection] = useState("")
  const [studentId, setStudentId] = useState("")
  const [studentDatabaseId, setStudentDatabaseId] = useState<number | null>(null)
  const [hasChangedPassword, setHasChangedPassword] = useState(true)
  const [loading, setLoading] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [modules, setModules] = useState<Module[]>([])
  const [membershipTier, setMembershipTier] = useState<string>("Scholar")
  const [trialStatus, setTrialStatus] = useState<{
    hasActiveTrial: boolean
    daysRemaining: number
    trialStartDate: string | null
  } | null>(null)
  const [donationStatus, setDonationStatus] = useState<{
    hasActiveDonation: boolean
    donation: {
      id: number
      amount: number
      createdAt: string
      daysRemaining: number
      expiresAt: string
    } | null
  } | null>(null)
  const [donationStatusLoading, setDonationStatusLoading] = useState(true)

  const allModules: Omit<Module, "isFavorite" | "displayOrder" | "usageCount" | "lastAccessed">[] = [
    {
      id: "quizzes",
      title: "Quizzes",
      description: "Take quizzes and view results",
      icon: ClipboardList,
      href: "/student/quizzes",
      color: "pink-500",
      borderColor: "border-2 border-pink-500/30",
      bgGradient: "bg-gradient-to-br from-pink-500/5 to-transparent",
      disabled: !hasChangedPassword,
    },
    {
      id: "quiz-history",
      title: "History",
      description: "Quizzes, homework, mid-semester, finals — attempts and grades",
      icon: History,
      href: "/student/quiz-history",
      color: "purple-500",
      borderColor: "border-2 border-purple-500/30",
      bgGradient: "bg-gradient-to-br from-purple-500/5 to-transparent",
    },
    {
      id: "playground",
      title: "Playground",
      description: "Join Kahoot-style game sessions",
      icon: Zap,
      href: "/student/playground",
      color: "accent",
      borderColor: "border-2 border-accent/30",
      bgGradient: "bg-gradient-to-br from-accent/5 to-transparent",
    },
    {
      id: "practice",
      title: "Practice Hub",
      description: "Generate practice quizzes from question bank",
      icon: Lightbulb,
      href: "/student/practice",
      color: "accent",
      borderColor: "border-2 border-accent/30",
      bgGradient: "bg-gradient-to-br from-accent/5 to-transparent",
      disabled: !hasChangedPassword,
    },
    {
      id: "groups",
      title: "Groups",
      description: "Create and manage your groups",
      icon: UsersRound,
      href: "/student/groups",
      color: "blue-500",
      borderColor: "border-2 border-blue-500/30",
      bgGradient: "bg-gradient-to-br from-blue-500/5 to-transparent",
    },
    {
      id: "projects",
      title: "Projects",
      description: "Manage your group projects",
      icon: FolderKanban,
      href: "/student/projects",
      color: "indigo-500",
      borderColor: "border-2 border-indigo-500/30",
      bgGradient: "bg-gradient-to-br from-indigo-500/5 to-transparent",
    },
    {
      id: "homework",
      title: "Homework",
      description: "Practice assignments and exercises",
      icon: BookOpen,
      href: "/student/homework",
      color: "emerald-500",
      borderColor: "border-2 border-emerald-500/30",
      bgGradient: "bg-gradient-to-br from-emerald-500/5 to-transparent",
    },
    {
      id: "mid-semester-exams",
      title: "Mid-Semester Exams",
      description: "Midterm assessments",
      icon: FileText,
      href: "/student/mid-semester-exams",
      color: "orange-500",
      borderColor: "border-2 border-orange-500/30",
      bgGradient: "bg-gradient-to-br from-orange-500/5 to-transparent",
    },
    {
      id: "final-exams",
      title: "Final Exams",
      description: "Final exams assessments",
      icon: GraduationCap,
      href: "/student/final-exams",
      color: "red-500",
      borderColor: "border-2 border-red-500/30",
      bgGradient: "bg-gradient-to-br from-red-500/5 to-transparent",
    },
    {
      id: "codebench",
      title: "CodeBench C++",
      description: "Write, run, and debug C++ code",
      icon: Code2,
      href: "/student/codebench",
      color: "blue-500",
      borderColor: "border-2 border-blue-500/30",
      bgGradient: "bg-gradient-to-br from-blue-500/5 to-transparent",
    },
    {
      id: "ai-tutor",
      title: "AI Tutor",
      description: "Your personal C++ teaching assistant",
      icon: Bot,
      href: "/student/ai-tutor",
      color: "purple-500",
      borderColor: "border-2 border-purple-500/30",
      bgGradient: "bg-gradient-to-br from-purple-500/5 to-transparent",
    },
    {
      id: "lectures",
      title: "Lectures",
      description: "View lecture notes and materials",
      icon: Presentation,
      href: "/student/lectures",
      color: "green-500",
      borderColor: "border-2 border-green-500/30",
      bgGradient: "bg-gradient-to-br from-green-500/5 to-transparent",
    },
    {
      id: "forum",
      title: "Forum Hub",
      description: "Discussions, requests, and tutoring",
      icon: MessageSquare,
      href: "/student/forum",
      color: "orange-500",
      borderColor: "border-2 border-orange-500/30",
      bgGradient: "bg-gradient-to-br from-orange-500/5 to-transparent",
    },
    {
      id: "classroom-points",
      title: "Classroom Points",
      description: "View your earned classroom points and rank",
      icon: Trophy,
      href: "/student/classroom-points",
      color: "purple-500",
      borderColor: "border-2 border-purple-500/30",
      bgGradient: "bg-gradient-to-br from-purple-500/5 to-transparent",
    },
    {
      id: "attendance",
      title: "Attendance",
      description: "Mark attendance via QR and track your streak",
      icon: Calendar,
      href: "/student/attendance",
      color: "indigo-500",
      borderColor: "border-2 border-indigo-500/30",
      bgGradient: "bg-gradient-to-br from-indigo-500/5 to-transparent",
    },
    {
      id: "announcements",
      title: "Announcements",
      description: "View important course updates and news",
      icon: Megaphone,
      href: "/student/announcements",
      color: "red-500",
      borderColor: "border-2 border-red-500/30",
      bgGradient: "bg-gradient-to-br from-red-500/5 to-transparent",
    },
    {
      id: "calendar",
      title: "Calendar",
      description: "Manage your study schedule with AI assistance",
      icon: Calendar,
      href: "/student/calendar",
      color: "cyan-500",
      borderColor: "border-2 border-cyan-500/30",
      bgGradient: "bg-gradient-to-br from-cyan-500/5 to-transparent",
    },
    {
      id: "grades",
      title: "My Grades",
      description: "View your grades, track performance, and simulate grade scenarios",
      icon: GraduationCap,
      href: "/student/grades",
      color: "indigo-500",
      borderColor: "border-2 border-indigo-500/30",
      bgGradient: "bg-gradient-to-br from-indigo-500/5 to-transparent",
    },
    {
      id: "trade-center",
      title: "Trade Center",
      description: "Trade activity points for Engagement Credits",
      icon: Gem,
      href: "/student/trade-center",
      color: "indigo-500",
      borderColor: "border-2 border-indigo-500/30",
      bgGradient: "bg-gradient-to-br from-indigo-500/5 to-transparent",
    },
  ]

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleViewChange = (newView: "grid" | "list") => {
    setView(newView)
    localStorage.setItem("ui:student:modulesView", newView)
  }

  useEffect(() => {
    const studentData = getStudentData()

    if (!studentData) {
      router.push("/student/login")
      return
    }

    setStudentId(studentData.id)
    setStudentName(studentData.name)
    setStudentSection(studentData.section)
    if (studentData.databaseId) {
      setStudentDatabaseId(Number.parseInt(studentData.databaseId))
    }

    const savedView = localStorage.getItem("ui:student:modulesView") as "grid" | "list" | null
    if (savedView) {
      setView(savedView)
    }

    checkPasswordStatus(studentData.id)
  }, [router])

  const checkPasswordStatus = async (studentId: string) => {
    try {
      const response = await studentApiFetch(`/api/student/info?student_id=${studentId}`)
      const data = await response.json()

      if (response.ok) {
        setHasChangedPassword(data.has_changed_password)
        setStudentDatabaseId(data.student.id)
        const effectiveTier = data.student.membership_tier || "Scholar"
        setMembershipTier(effectiveTier)
        // Store in sessionStorage for other components
        sessionStorage.setItem("studentMembershipTier", effectiveTier)
        
        // Set trial status if available (but not for demo student - demo has unlimited access, not trial)
        const isDemoStudent = data.student.student_id === "DEMO001" || 
                              data.student.section === "BETA" || 
                              data.student.beta_user === true
        
        if (data.trial && !isDemoStudent) {
          setTrialStatus({
            hasActiveTrial: data.trial.hasActiveTrial,
            daysRemaining: data.trial.daysRemaining,
            trialStartDate: data.trial.trialStartDate,
          })
        } else {
          // Demo student doesn't have trial - has unlimited Trailblazer access
          setTrialStatus(null)
        }
        
        // Clear any trial modal flags (no longer using modal)
        sessionStorage.removeItem("showTrialModal")
        sessionStorage.removeItem("trialActivated")
        
        // Fetch donation status for access control (not for banner display)
        if (data.student.id) {
          fetchDonationStatus(data.student.id)
        }
        
        loadModulePreferences(data.student.id)
      }
    } catch (error) {
      console.error("[v0] Failed to check password status:", error)
    } finally {
      setLoading(false)
    }
  }

  // Helper function to check if 7 days have passed since dismissal
  const shouldShowBannerAfterDismissal = (dismissalKey: string): boolean => {
    const dismissalTimestamp = localStorage.getItem(dismissalKey)
    if (!dismissalTimestamp) return true // Never dismissed, show banner
    
    try {
      const dismissalDate = new Date(parseInt(dismissalTimestamp))
      const now = new Date()
      const daysSinceDismissal = (now.getTime() - dismissalDate.getTime()) / (1000 * 60 * 60 * 24)
      
      // Show banner again if 7 days have passed
      return daysSinceDismissal >= 7
    } catch (error) {
      console.error("[Dashboard] Error parsing dismissal timestamp:", error)
      return true // If error, show banner to be safe
    }
  }

  const fetchDonationStatus = async (studentDatabaseId: number) => {
    try {
      setDonationStatusLoading(true)
      const response = await studentApiFetch(`/api/student/donation-status?studentId=${studentDatabaseId}`)
      const data = await response.json()
      
      if (response.ok) {
        setDonationStatus(data)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch donation status:", error)
    } finally {
      setDonationStatusLoading(false)
    }
  }

  // Fetch donation status for access control (donations grant premium access)
  useEffect(() => {
    if (!studentDatabaseId) return
    fetchDonationStatus(studentDatabaseId)
  }, [studentDatabaseId])

  const loadModulePreferences = async (databaseId: number) => {
    try {
      const response = await studentApiFetch(`/api/student/module-preferences?studentId=${databaseId}`)
      const data = await response.json()

      if (response.ok) {
        const preferencesMap = new Map(data.preferences.map((p: any) => [p.module_name, p]))

        const modulesWithPrefs = allModules.map((module, index) => {
          const pref = preferencesMap.get(module.id) as any
          return {
            ...module,
            isFavorite: pref?.is_favorite || false,
            displayOrder: pref?.display_order ?? index,
            usageCount: pref?.usage_count || 0,
            lastAccessed: pref?.last_accessed ? new Date(pref.last_accessed) : null,
          }
        })

        modulesWithPrefs.sort((a, b) => a.displayOrder - b.displayOrder)
        setModules(modulesWithPrefs)
      }
    } catch (error) {
      console.error("[v0] Failed to load module preferences:", error)
      // Fallback to default modules
      setModules(
        allModules.map((module, index) => ({
          ...module,
          isFavorite: false,
          displayOrder: index,
          usageCount: 0,
          lastAccessed: null,
        })),
      )
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = modules.findIndex((m) => m.id === active.id)
      const newIndex = modules.findIndex((m) => m.id === over.id)

      const newModules = arrayMove(modules, oldIndex, newIndex).map((m, index) => ({
        ...m,
        displayOrder: index,
      }))

      setModules(newModules)

      if (!studentDatabaseId) {
        console.error("[v0] Cannot save module order: database ID not available")
        return
      }

      try {
        console.log("[v0] Saving module order for student database ID:", studentDatabaseId)
        const response = await studentApiFetch("/api/student/module-preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: studentDatabaseId,
            preferences: newModules.map((m) => ({
              module_name: m.id,
              display_order: m.displayOrder,
            })),
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          console.error("[v0] Failed to save module order:", error)
        } else {
          console.log("[v0] Module order saved successfully")
        }
      } catch (error) {
        console.error("[v0] Failed to save module order:", error)
      }
    }
  }

  const handleToggleFavorite = async (moduleId: string) => {
    const updatedModules = modules.map((m) => (m.id === moduleId ? { ...m, isFavorite: !m.isFavorite } : m))
    setModules(updatedModules)

    if (!studentDatabaseId) {
      console.error("[v0] Cannot toggle favorite: database ID not available")
      return
    }

    try {
      await studentApiFetch("/api/student/module-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentDatabaseId,
          moduleName: moduleId,
          isFavorite: !modules.find((m) => m.id === moduleId)?.isFavorite,
        }),
      })
    } catch (error) {
      console.error("[v0] Failed to toggle favorite:", error)
    }
  }

  const handleClearRecentlyUsed = async () => {
    // Clear UI
    setModules((prev) =>
      prev.map((m) => ({
        ...m,
        lastAccessed: null,
      })),
    )

    if (!studentDatabaseId) return

    try {
      await studentApiFetch("/api/student/module-preferences/track-usage", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: studentDatabaseId }),
      })
      console.log("[v0] Recently used cleared")
    } catch (error) {
      console.error("[v0] Failed to clear recently used:", error)
    }
  }

  const handleModuleClick = async (moduleId: string) => {
    if (!studentDatabaseId) return

    try {
      await studentApiFetch("/api/student/module-preferences/track-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentDatabaseId,
          moduleName: moduleId,
        }),
      })
    } catch (error) {
      console.error("[v0] Failed to track module usage:", error)
    }
  }

  const filteredModules = modules.filter(
    (module) =>
      module.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      module.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const favoriteModules = filteredModules.filter((m) => m.isFavorite)
  const recentlyUsedModules = filteredModules
    .filter((m) => m.lastAccessed)
    .sort((a, b) => (b.lastAccessed?.getTime() || 0) - (a.lastAccessed?.getTime() || 0))
    .slice(0, 4)
  const regularModules = filteredModules.filter((m) => !m.isFavorite)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10">
      <div className="text-center space-y-3">
        <h2 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-800 via-indigo-600 to-amber-500 dark:from-purple-300 dark:via-indigo-400 dark:to-amber-400">
          Student Dashboard
        </h2>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Welcome back, <span className="font-semibold text-slate-800 dark:text-slate-200">{studentName}</span> • Section {studentSection}
        </p>
      </div>

      {!hasChangedPassword && (
        <Alert variant="destructive" className="border-2">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="text-lg font-semibold">Password Change Required</AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p>
              For security reasons, you must change your default password before accessing quizzes and other features.
            </p>
            <Button
              onClick={() => router.push("/student/change-password")}
              variant="outline"
              className="bg-background hover:bg-background/80"
            >
              Change Password Now
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Upgrade Reminder Banner */}
      {studentDatabaseId && membershipTier !== "Trailblazer" && (
        <UpgradeReminderBanner studentId={studentDatabaseId} />
      )}

      {/* Trial Countdown Banner - Show when trial is active */}
      {trialStatus && trialStatus.hasActiveTrial && trialStatus.daysRemaining > 0 && (
        <div className="w-full rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 p-6 mb-6">
          <div className="flex items-start justify-between w-full gap-6">
            <div className="flex items-start gap-5 flex-1 min-w-0">
              <Gem className="h-8 w-8 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0 w-full">
                <div className="space-y-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      🎉 Free Trial Active!
                    </h3>
                    <span className="text-lg font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 px-5 py-2 rounded-full whitespace-nowrap">
                      {trialStatus.daysRemaining} {trialStatus.daysRemaining === 1 ? 'day' : 'days'} remaining
                    </span>
                  </div>
                  
                  <p className="text-lg font-medium text-blue-800 dark:text-blue-200 leading-relaxed">
                    You're enjoying <strong className="text-blue-900 dark:text-blue-100 font-bold">Trailblazer</strong> access! 
                    Explore all premium features including high-capacity Cora, unlimited Playground, and quiz retakes.
                  </p>
                  
                  <div className="flex gap-4 pt-2">
                    <Button
                      onClick={() => router.push("/student/dashboard-v2/membership")}
                      className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/25"
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      View Plans
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100/80 dark:bg-slate-700/80 rounded-xl">
            <Search className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-200">Your Modules</h3>
        </div>
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {searchOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "300px", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <Input
                    placeholder="Search modules..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9 bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-500 dark:placeholder:text-slate-400"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 rounded-lg"
                    onClick={() => {
                      setSearchOpen(false)
                      setSearchQuery("")
                    }}
                  >
                    <X className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {!searchOpen && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setSearchOpen(true)}
              className="hover:bg-slate-100/80 dark:hover:bg-slate-700/80 rounded-xl"
            >
              <Search className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </Button>
          )}
          <ViewToggle view={view} onViewChange={handleViewChange} />
        </div>
      </div>

      {favoriteModules.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100/80 dark:bg-amber-900/80 rounded-xl">
              <Pin className="h-5 w-5 text-amber-600 dark:text-amber-400 fill-amber-200 dark:fill-amber-800" />
            </div>
            <h4 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-200">Favorites</h4>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {favoriteModules.map((module) => {
              const Icon = module.icon
              const colorClasses = getModuleColorClasses(module.color)

              const handleFavClick = (e: React.MouseEvent) => {
                handleModuleClick(module.id)
                router.push(module.href)
              }

              return (
                <div key={module.id} onClick={handleFavClick} className="cursor-pointer" draggable={false}>
                  <Card
                    className={cn(
                      "min-h-[180px] flex flex-col justify-between transition-all duration-300 group",
                      "bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]",
                      "hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] hover:scale-[1.02] hover:-translate-y-1",
                      colorClasses.cardGlow,
                      "rounded-2xl overflow-hidden"
                    )}
                  >
                    <CardHeader className="p-6 space-y-3">
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            "h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm",
                            colorClasses.iconBg,
                          )}
                        >
                          <Icon className={cn("h-6 w-6", colorClasses.iconColor)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle 
                            className="text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-200 line-clamp-1 mb-1"
                            title={module.title}
                          >
                            {module.title}
                          </CardTitle>
                          <CardDescription 
                            className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed"
                            title={module.description}
                          >
                            {module.description}
                          </CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 opacity-0 group-hover:opacity-100 transition-all duration-200 flex-shrink-0 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 rounded-xl"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleToggleFavorite(module.id)
                          }}
                        >
                          <PinOff className="h-4 w-4 text-amber-600 dark:text-amber-400 fill-amber-100 dark:fill-amber-800" />
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {recentlyUsedModules.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100/80 dark:bg-blue-900/80 rounded-xl">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h4 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-200">Recently Used</h4>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 rounded-xl px-3 py-2"
              onClick={handleClearRecentlyUsed}
            >
              Clear All
            </Button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentlyUsedModules.map((module) => {
              const Icon = module.icon
              const colorClasses = getModuleColorClasses(module.color)

              const handleRecentClick = (e: React.MouseEvent) => {
                handleModuleClick(module.id)
                router.push(module.href)
              }

              return (
                <div key={module.id} onClick={handleRecentClick} className="cursor-pointer" draggable={false}>
                  <Card
                    className={cn(
                      "min-h-[180px] flex flex-col justify-between transition-all duration-300 group",
                      "bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]",
                      "hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] hover:scale-[1.02] hover:-translate-y-1",
                      colorClasses.cardGlow,
                      "rounded-2xl overflow-hidden"
                    )}
                  >
                    <CardHeader className="p-6 space-y-3">
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            "h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm",
                            colorClasses.iconBg,
                          )}
                        >
                          <Icon className={cn("h-6 w-6", colorClasses.iconColor)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle 
                            className="text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-200 line-clamp-1 mb-1"
                            title={module.title}
                          >
                            {module.title}
                          </CardTitle>
                          <CardDescription 
                            className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed"
                            title={module.description}
                          >
                            {module.description}
                          </CardDescription>
                        </div>
                        <Clock className="h-5 w-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                      </div>
                    </CardHeader>
                  </Card>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100/80 dark:bg-purple-900/80 rounded-xl">
            <Library className="h-5 w-5 text-purple-700 dark:text-purple-300" />
          </div>
          <h4 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-200">All Modules</h4>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={regularModules.map((m) => m.id)}
            strategy={view === "grid" ? rectSortingStrategy : verticalListSortingStrategy}
          >
            <div className={view === "grid" ? "grid md:grid-cols-2 lg:grid-cols-4 gap-4" : "flex flex-col gap-4"}>
              {regularModules.map((module) => (
                <SortableModuleCard
                  key={module.id}
                  module={module}
                  view={view}
                  onToggleFavorite={handleToggleFavorite}
                  onModuleClick={handleModuleClick}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}
