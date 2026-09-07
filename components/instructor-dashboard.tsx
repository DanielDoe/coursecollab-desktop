"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { dbTimeToCDT, formatQuizTime } from "@/lib/timezone"
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
  Brain,
  Pin,
  Clock,
  Search,
  X,
  GripVertical,
  PinOff,
  Zap,
  PlusCircle,
  Library,
  History,
  BarChart3,
  Settings,
  Shield,
  Database,
  Activity,
  TrendingUp,
  UserCheck,
  Calendar,
  Target,
  Award,
  HelpCircle,
  Monitor,
  FileBarChart,
  ScrollText,
  LogOut,
  Megaphone,
  DollarSign,
  Gamepad2,
  Gem,
} from "lucide-react"
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
import { usePersistedState, useScrollRestoration } from "@/hooks/use-persisted-state"

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
      iconBg: "bg-green-100/80",
      iconColor: "text-green-700",
      pinColor: "text-green-700 hover:text-green-800",
      cardGlow: "hover:shadow-green-200/40"
    },
    "orange-500": {
      iconBg: "bg-orange-100/80",
      iconColor: "text-orange-700",
      pinColor: "text-orange-700 hover:text-orange-800",
      cardGlow: "hover:shadow-orange-200/40"
    },
    "red-500": {
      iconBg: "bg-red-100/80",
      iconColor: "text-red-700",
      pinColor: "text-red-700 hover:text-red-800",
      cardGlow: "hover:shadow-red-200/40"
    },
    "indigo-500": {
      iconBg: "bg-indigo-100/80",
      iconColor: "text-indigo-700",
      pinColor: "text-indigo-700 hover:text-indigo-800",
      cardGlow: "hover:shadow-indigo-200/40"
    },
    "pink-500": {
      iconBg: "bg-pink-100/80",
      iconColor: "text-pink-700",
      pinColor: "text-pink-700 hover:text-pink-800",
      cardGlow: "hover:shadow-pink-200/40"
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
    "amber-500": {
      iconBg: "bg-amber-100/80",
      iconColor: "text-amber-700",
      pinColor: "text-amber-700 hover:text-amber-800",
      cardGlow: "hover:shadow-amber-200/40"
    },
    "rose-500": {
      iconBg: "bg-rose-100/80",
      iconColor: "text-rose-700",
      pinColor: "text-rose-700 hover:text-rose-800",
      cardGlow: "hover:shadow-rose-200/40"
    },
  }

  return colorMap[color] || colorMap.accent
}

function SortableModuleCard({ module, onToggleFavorite, viewMode }: { 
  module: Module
  onToggleFavorite: (id: string) => void
  viewMode: "grid" | "list"
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const colorClasses = getModuleColorClasses(module.color)

  const router = useRouter()
  
  const handleClick = () => {
    if (module.disabled) return
    router.push(module.href)
  }

  if (viewMode === "list") {
    return (
      <motion.div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group relative",
          isDragging && "z-50 opacity-50"
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Card className={cn(
          "cursor-pointer transition-all duration-200 border-l-4",
          module.disabled ? "opacity-50 cursor-not-allowed" : "hover:shadow-lg",
          colorClasses.cardGlow,
          module.borderColor ? `border-l-${module.borderColor}` : "border-l-purple-500"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1">
                <div className={cn("p-2 rounded-lg", colorClasses.iconBg)}>
                  <module.icon className={cn("h-5 w-5", colorClasses.iconColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {module.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                    {module.description}
                  </p>
                </div>
                <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{module.usageCount} uses</span>
                  {module.lastAccessed && (
                    <>
                      <span>•</span>
                      <span>{formatQuizTime(module.lastAccessed)}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleFavorite(module.id)
                  }}
                  className={cn("opacity-0 group-hover:opacity-100 transition-opacity", colorClasses.pinColor)}
                >
                  {module.isFavorite ? (
                    <Pin className="h-4 w-4 fill-current" />
                  ) : (
                    <PinOff className="h-4 w-4" />
                  )}
                </Button>
                <div
                  {...attributes}
                  {...listeners}
                  className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                >
                  <GripVertical className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group" draggable={false}>
      <Card
        onClick={handleClick}
        className={cn(
          "min-h-[180px] flex flex-col justify-between transition-all duration-300 cursor-pointer",
          "bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]",
          "hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] hover:scale-[1.02] hover:-translate-y-1",
          colorClasses.cardGlow,
          "rounded-2xl overflow-hidden",
          module.disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <CardHeader className="p-6 space-y-3 flex-1 flex flex-col justify-between">
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
              <module.icon className={cn("h-6 w-6", colorClasses.iconColor)} />
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
                className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed"
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

export function InstructorDashboard() {
  const router = useRouter()
  
  // Use persisted state for dashboard preferences
  const [searchTerm, setSearchTerm] = usePersistedState("instructor-dashboard-search", "")
  const [viewMode, setViewMode] = usePersistedState<"grid" | "list">("instructor-dashboard-view", "grid")
  const [showFavoritesOnly, setShowFavoritesOnly] = usePersistedState("instructor-dashboard-favorites", false)
  
  // Restore scroll position
  useScrollRestoration("instructor-dashboard")
  
  // Non-persisted state
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [recentActivity, setRecentActivity] = useState<any[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Instructor modules (same access as admin)
  const defaultModules: Module[] = [
    {
      id: "quizzes",
      title: "Manage Quizzes",
      description: "Create, edit, and manage quizzes and assessments",
      icon: ClipboardList,
      href: "/instructor/quizzes",
      color: "blue-500",
      borderColor: "border-2 border-blue-500/30",
      bgGradient: "bg-gradient-to-br from-blue-500/5 to-transparent",
      isFavorite: true,
      displayOrder: 1,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "question-bank",
      title: "Question Bank",
      description: "Manage and organize question database",
      icon: Library,
      href: "/instructor/question-bank",
      color: "purple-500",
      borderColor: "border-2 border-purple-500/30",
      bgGradient: "bg-gradient-to-br from-purple-500/5 to-transparent",
      isFavorite: true,
      displayOrder: 2,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "students",
      title: "Manage Students",
      description: "Manage student accounts and progress",
      icon: UsersRound,
      href: "/instructor/students",
      color: "green-500",
      borderColor: "border-2 border-green-500/30",
      bgGradient: "bg-gradient-to-br from-green-500/5 to-transparent",
      isFavorite: true,
      displayOrder: 3,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "results",
      title: "Results & Analytics",
      description: "View student performance and analytics",
      icon: BarChart3,
      href: "/instructor/results",
      color: "orange-500",
      borderColor: "border-2 border-orange-500/30",
      bgGradient: "bg-gradient-to-br from-orange-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 4,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "sessions",
      title: "Academic Sessions",
      description: "Manage academic terms and sessions",
      icon: Calendar,
      href: "/instructor/sessions",
      color: "indigo-500",
      borderColor: "border-2 border-indigo-500/30",
      bgGradient: "bg-gradient-to-br from-indigo-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 5,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "groups",
      title: "Manage Groups",
      description: "Create and manage student groups",
      icon: FolderKanban,
      href: "/instructor/groups",
      color: "pink-500",
      borderColor: "border-2 border-pink-500/30",
      bgGradient: "bg-gradient-to-br from-pink-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 6,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "projects",
      title: "Manage Projects",
      description: "Manage team projects and assignments",
      icon: Target,
      href: "/instructor/projects",
      color: "cyan-500",
      borderColor: "border-2 border-cyan-500/30",
      bgGradient: "bg-gradient-to-br from-cyan-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 7,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "homeworks",
      title: "Manage Homeworks",
      description: "Create and manage homework assignments",
      icon: FileText,
      href: "/instructor/homeworks",
      color: "emerald-500",
      borderColor: "border-2 border-emerald-500/30",
      bgGradient: "bg-gradient-to-br from-emerald-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 8,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "mid-semester-exams",
      title: "Mid-Semester",
      description: "Manage mid-semester examinations",
      icon: GraduationCap,
      href: "/instructor/mid-semester-exams",
      color: "amber-500",
      borderColor: "border-2 border-amber-500/30",
      bgGradient: "bg-gradient-to-br from-amber-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 9,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "final-exams",
      title: "Finals",
      description: "Manage final examinations and grades",
      icon: Award,
      href: "/instructor/final-exams",
      color: "rose-500",
      borderColor: "border-2 border-rose-500/30",
      bgGradient: "bg-gradient-to-br from-rose-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 10,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "ai-tutor",
      title: "Manage AI Tutor",
      description: "Monitor student interactions, analyze performance, and configure AI settings",
      icon: Bot,
      href: "/instructor/ai-tutor",
      color: "purple-500",
      borderColor: "border-2 border-purple-500/30",
      bgGradient: "bg-gradient-to-br from-purple-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 11,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "lectures",
      title: "Manage Lectures",
      description: "Manage lecture content and materials",
      icon: Presentation,
      href: "/instructor/lectures",
      color: "blue-500",
      borderColor: "border-2 border-blue-500/30",
      bgGradient: "bg-gradient-to-br from-blue-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 12,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "practice-management",
      title: "Manage Practice Hub",
      description: "Manage student practice sessions, topics, and monitor progress",
      icon: Brain,
      href: "/instructor/practice-management",
      color: "teal-500",
      borderColor: "border-2 border-teal-500/30",
      bgGradient: "bg-gradient-to-br from-teal-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 13,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "office-hours",
      title: "Office Hours",
      description: "Manage student office hour requests",
      icon: Clock,
      href: "/instructor/office-hours",
      color: "indigo-500",
      borderColor: "border-2 border-indigo-500/30",
      bgGradient: "bg-gradient-to-br from-indigo-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 14,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "notifications",
      title: "Notifications",
      description: "Send announcements and notifications",
      icon: MessageSquare,
      href: "/instructor/notifications",
      color: "green-500",
      borderColor: "border-2 border-green-500/30",
      bgGradient: "bg-gradient-to-br from-green-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 14,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "playground",
      title: "Manage Playground",
      description: "Manage student playground sessions, select questions, and monitor performance",
      icon: Gamepad2,
      href: "/instructor/playground",
      color: "purple-500",
      borderColor: "border-2 border-purple-500/30",
      bgGradient: "bg-gradient-to-br from-purple-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 14,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "analytics",
      title: "Advanced Analytics",
      description: "Detailed performance analytics and reports",
      icon: TrendingUp,
      href: "/instructor/analytics",
      color: "orange-500",
      borderColor: "border-2 border-orange-500/30",
      bgGradient: "bg-gradient-to-br from-orange-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 15,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "reports",
      title: "Reports",
      description: "Generate comprehensive reports",
      icon: FileBarChart,
      href: "/instructor/reports",
      color: "indigo-500",
      borderColor: "border-2 border-indigo-500/30",
      bgGradient: "bg-gradient-to-br from-indigo-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 16,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "financials",
      title: "Manage Financials",
      description: "Manage memberships, donations, and track income",
      icon: DollarSign,
      href: "/instructor/financials",
      color: "emerald-500",
      borderColor: "border-2 border-emerald-500/30",
      bgGradient: "bg-gradient-to-br from-emerald-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 17,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "system-monitor",
      title: "System Monitor",
      description: "Monitor system health and performance",
      icon: Monitor,
      href: "/instructor/system-monitor",
      color: "red-500",
      borderColor: "border-2 border-red-500/30",
      bgGradient: "bg-gradient-to-br from-red-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 18,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "logs",
      title: "System Logs",
      description: "View and manage system logs",
      icon: ScrollText,
      href: "/instructor/logs",
      color: "pink-500",
      borderColor: "border-2 border-pink-500/30",
      bgGradient: "bg-gradient-to-br from-pink-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 17,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "announcements-v2",
      title: "Announcements",
      description: "Create and manage course announcements",
      icon: Megaphone,
      href: "/instructor/announcements-v2",
      color: "red-500",
      borderColor: "border-2 border-red-500/30",
      bgGradient: "bg-gradient-to-br from-red-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 18,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "classroom-points",
      title: "Classroom Points",
      description: "Award and manage student classroom points",
      icon: Award,
      href: "/instructor/classroom-points",
      color: "purple-500",
      borderColor: "border-2 border-purple-500/30",
      bgGradient: "bg-gradient-to-br from-purple-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 19,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "attendance",
      title: "Attendance",
      description: "QR-based attendance tracking and analytics",
      icon: Calendar,
      href: "/instructor/attendance",
      color: "indigo-500",
      borderColor: "border-2 border-indigo-500/30",
      bgGradient: "bg-gradient-to-br from-indigo-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 20,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "grades",
      title: "Manage Grades",
      description: "Manage student grades, analytics, and grade configurations",
      icon: GraduationCap,
      href: "/instructor/grades",
      color: "purple-500",
      borderColor: "border-2 border-purple-500/30",
      bgGradient: "bg-gradient-to-br from-purple-500/5 to-transparent",
      isFavorite: true,
      displayOrder: 4,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "trade-center",
      title: "Trade Center",
      description: "Configure and monitor student engagement trades",
      icon: Gem,
      href: "/instructor/trade-center",
      color: "purple-500",
      borderColor: "border-2 border-purple-500/30",
      bgGradient: "bg-gradient-to-br from-purple-500/5 to-transparent",
      isFavorite: true,
      displayOrder: 5,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "help-center",
      title: "Help Center",
      description: "Documentation and support resources",
      icon: HelpCircle,
      href: "/instructor/help-center",
      color: "cyan-500",
      borderColor: "border-2 border-cyan-500/30",
      bgGradient: "bg-gradient-to-br from-cyan-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 19,
      usageCount: 0,
      lastAccessed: null,
    },
    {
      id: "settings",
      title: "Settings",
      description: "Configure system settings and preferences",
      icon: Settings,
      href: "/instructor/settings",
      color: "emerald-500",
      borderColor: "border-2 border-emerald-500/30",
      bgGradient: "bg-gradient-to-br from-emerald-500/5 to-transparent",
      isFavorite: false,
      displayOrder: 20,
      usageCount: 0,
      lastAccessed: null,
    },
  ]

  useEffect(() => {
    const initializeAndLoad = async () => {
      try {
        // Initialize notifications table first
        await fetch("/api/setup/instructor-notifications", { method: "POST" })
      } catch (error) {
        console.error("Error initializing notifications:", error)
      }
      
      // Then load all data
      loadModules()
      loadStats()
      loadRecentActivity()
    }
    
    initializeAndLoad()
  }, [])

  const loadModules = async () => {
    try {
      // For now, use default modules. In the future, load from API
      setModules(defaultModules)
    } catch (error) {
      console.error("Error loading modules:", error)
      setModules(defaultModules)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/dashboard/stats?instructorId=1")
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error("Error loading stats:", error)
    }
  }

  const loadRecentActivity = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/recent-activity?instructorId=1")
      if (response.ok) {
        const data = await response.json()
        setRecentActivity(data.recentActivity || [])
      }
    } catch (error) {
      console.error("Error loading recent activity:", error)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      setModules((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over?.id)

        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleToggleFavorite = (moduleId: string) => {
    setModules((prevModules) =>
      prevModules.map((module) =>
        module.id === moduleId
          ? { ...module, isFavorite: !module.isFavorite }
          : module
      )
    )
  }

  const filteredModules = modules.filter((module) => {
    const matchesSearch = module.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         module.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFavorites = !showFavoritesOnly || module.isFavorite
    return matchesSearch && matchesFavorites
  })

  const handleModuleClick = (module: Module) => {
    if (module.disabled) return
    router.push(module.href)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading instructor dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10">
      <div className="text-center space-y-3">
        <h2 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-800 via-indigo-600 to-amber-500 dark:from-purple-300 dark:via-indigo-400 dark:to-amber-400">
          Instructor Dashboard
        </h2>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Welcome back, <span className="font-semibold text-slate-800 dark:text-slate-200">Instructor</span> • Manage your courses and students
        </p>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Total Quizzes
                </CardTitle>
                <ClipboardList className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.totalQuizzes}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {stats.activeQuizzes} active
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Total Students
                </CardTitle>
                <UsersRound className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.totalStudents}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {stats.activeUsers} active
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Total Attempts
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.totalAttempts}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Quiz completions
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Upcoming
                </CardTitle>
                <Calendar className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.upcomingAssessments}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Assessments
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Search and Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search modules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 rounded-xl"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm("")}
                className="absolute right-1 top-1 h-8 w-8 p-0 rounded-xl"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button
            variant={showFavoritesOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className="rounded-xl"
          >
            <Pin className="h-4 w-4 mr-2" />
            Favorites Only
          </Button>
        </div>
        <ViewToggle view={viewMode} onViewChange={setViewMode} />
      </div>

      {/* Modules Grid/List */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={filteredModules.map((m) => m.id)}
          strategy={viewMode === "grid" ? rectSortingStrategy : verticalListSortingStrategy}
        >
          <AnimatePresence mode="wait">
            {viewMode === "grid" ? (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
              >
                {filteredModules.map((module, index) => (
                  <motion.div
                    key={module.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    onClick={() => handleModuleClick(module)}
                  >
                    <SortableModuleCard
                      module={module}
                      onToggleFavorite={handleToggleFavorite}
                      viewMode={viewMode}
                    />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {filteredModules.map((module, index) => (
                  <motion.div
                    key={module.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    onClick={() => handleModuleClick(module)}
                  >
                    <SortableModuleCard
                      module={module}
                      onToggleFavorite={handleToggleFavorite}
                      viewMode={viewMode}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </SortableContext>
      </DndContext>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl">
            <CardHeader className="p-6">
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-500" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Latest student quiz attempts and activities
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="space-y-3">
                {recentActivity.slice(0, 5).map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-xl">
                        <ClipboardList className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {activity.student_name} completed "{activity.title}"
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {dbTimeToCDT(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {activity.score}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Empty State */}
      {filteredModules.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            No modules found
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            {searchTerm ? "Try adjusting your search terms." : "No modules available."}
          </p>
        </div>
      )}
    </div>
  )
}