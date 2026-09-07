"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Lightbulb,
  BookOpen,
  Bug,
  Eye,
  FileText,
  Sparkles,
  Target,
  GraduationCap,
  Code,
  Brain,
  ClipboardList,
  Search,
  Star,
  Clock,
  X
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { portalAccentIconClass } from "@/lib/portal-module-themes"

const aiTutorTheme = getStudentModuleTheme("ai-tutor")

interface Tool {
  id: string
  name: string
  icon: any
  description: string
  category: string
  premium?: boolean
}

const allTools: Tool[] = [
  // General Tools
  {
    id: "concept-explainer",
    name: "Concept Explainer",
    icon: Lightbulb,
    description: "Get adaptive explanations at any difficulty level",
    category: "general"
  },
  {
    id: "mini-lesson",
    name: "Mini Lesson Generator",
    icon: BookOpen,
    description: "Generate focused 2-3 minute lessons with quizzes",
    category: "general"
  },
  {
    id: "study-plan",
    name: "Study Plan Creator",
    icon: Target,
    description: "Create personalized weekly study schedules",
    category: "general"
  },
  // Debugging Tools
  {
    id: "smart-debugger",
    name: "Smart Debugger & Fixer",
    icon: Bug,
    description: "Find bugs, explain root causes, show fixes",
    category: "debugging"
  },
  {
    id: "execution-visualizer",
    name: "Execution Visualizer",
    icon: Eye,
    description: "Visualize code execution with animated traces",
    category: "debugging"
  },
  {
    id: "wrong-code-simulator",
    name: "Wrong Code Simulator",
    icon: Code,
    description: "See common mistakes and why they fail",
    category: "debugging"
  },
  // Code Tools
  {
    id: "doc-generator",
    name: "Documentation Builder",
    icon: FileText,
    description: "Generate README, comments, and UML diagrams",
    category: "code-tools"
  },
  {
    id: "code-quality",
    name: "Code Quality Analyzer",
    icon: Sparkles,
    description: "Analyze style, maintainability, and best practices",
    category: "code-tools"
  },
  {
    id: "example-generator",
    name: "Example Generator",
    icon: Sparkles,
    description: "Generate examples at multiple difficulty levels",
    category: "code-tools"
  },
  // Assessments
  {
    id: "quiz-generator",
    name: "Quiz Generator",
    icon: ClipboardList,
    description: "Create practice quizzes with instant scoring",
    category: "assessments"
  },
  {
    id: "exam-mode",
    name: "Exam Prep Mode",
    icon: GraduationCap,
    description: "Generate exam-style questions and rubrics",
    category: "assessments",
    premium: true
  },
  {
    id: "mock-interviewer",
    name: "AI Mock Interviewer",
    icon: Brain,
    description: "Practice coding interviews with AI",
    category: "assessments",
    premium: true
  }
]

const categories = [
  { id: "general", name: "General Tools", icon: Sparkles },
  { id: "debugging", name: "Debugging", icon: Bug },
  { id: "code-tools", name: "Code Tools", icon: FileText },
  { id: "assessments", name: "Assessments", icon: ClipboardList }
]

interface AIToolsLauncherProps {
  onToolSelect: (toolId: string) => void
  embedInDashboard?: boolean
}

export function AIToolsLauncher({ onToolSelect, embedInDashboard = false }: AIToolsLauncherProps) {
  const [activeCategory, setActiveCategory] = useState("general")
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [recentTools, setRecentTools] = useState<string[]>([])

  const filteredTools = allTools.filter((tool) => {
    const matchesCategory = tool.category === activeCategory
    const matchesSearch = searchQuery === "" || 
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const handleToolClick = (toolId: string) => {
    // Add to recent tools
    setRecentTools((prev) => {
      const filtered = prev.filter((id) => id !== toolId)
      return [toolId, ...filtered].slice(0, 5)
    })
    onToolSelect(toolId)
  }

  const toggleFavorite = (toolId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(toolId)) {
        next.delete(toolId)
      } else {
        next.add(toolId)
      }
      return next
    })
  }

  const recentToolsList = recentTools.map((id) => allTools.find((t) => t.id === id)).filter(Boolean) as Tool[]

  if (embedInDashboard) {
    return (
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
          <Input
            placeholder="Search tools…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 rounded-full border border-[var(--border)] bg-[var(--muted)]/40 pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {categories.map((category) => {
            const Icon = category.icon
            const isActive = activeCategory === category.id
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setActiveCategory(category.id)
                  setSearchQuery("")
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                    : "text-[var(--cc-text-muted)] hover:bg-[var(--muted)]/45",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {category.name}
              </button>
            )
          })}
        </div>

        {recentToolsList.length > 0 && !searchQuery ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--cc-text-muted)] px-0.5">
              Recent
            </p>
            <div className="flex flex-wrap gap-2">
              {recentToolsList.map((tool) => {
                const Icon = tool.icon
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => handleToolClick(tool.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-1.5 text-xs font-medium text-[var(--cc-text)] hover:bg-[var(--muted)]/50"
                  >
                    <Icon className="h-3.5 w-3.5 text-[var(--cc-accent-dark)]" />
                    {tool.name}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          {filteredTools.length === 0 ? (
            <p className="text-sm text-[var(--cc-text-muted)] py-6 text-center rounded-xl bg-[var(--muted)]/30">
              No tools match your search.
            </p>
          ) : (
            filteredTools.map((tool) => {
              const Icon = tool.icon
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => handleToolClick(tool.id)}
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-[var(--muted)]/45"
                >
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", aiTutorTheme.page.iconBg)}>
                    <Icon className={cn("h-4 w-4", aiTutorTheme.page.iconText)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--cc-text)]">{tool.name}</span>
                      {tool.premium ? (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                          Premium
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-[var(--cc-text-muted)] mt-0.5 line-clamp-2">{tool.description}</p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white/85 dark:bg-white/[0.03] backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-200/70 dark:border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={cn("text-2xl font-bold", aiTutorTheme.page.iconText)}>
              AI Tools
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Standalone smart utilities for learning and coding
            </p>
          </div>
          
          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                showSearch 
                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600" 
                  : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
              )}
              title="Search Tools"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
              title="Favorites"
            >
              <Star className="h-4 w-4" />
            </button>
            <button
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
              title="Recent Tools"
            >
              <Clock className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <Input
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mt-2"
                autoFocus
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto scrollbar-hide">
          {categories.map((category) => {
            const Icon = category.icon
            const isActive = activeCategory === category.id
            
            return (
              <button
                key={category.id}
                onClick={() => {
                  setActiveCategory(category.id)
                  setSearchQuery("")
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                  isActive
                    ? cn(aiTutorTheme.page.cta, "shadow-sm")
                    : "bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{category.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tools Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredTools.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Search className="h-12 w-12 text-slate-400 mb-4" />
            <p className="text-slate-600 dark:text-slate-400">No tools found matching your search</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTools.map((tool, idx) => {
              const Icon = tool.icon
              const isFavorite = favorites.has(tool.id)
              
              return (
                <motion.div
                  key={tool.id}
                  role="button"
                  tabIndex={0}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => handleToolClick(tool.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      handleToolClick(tool.id)
                    }
                  }}
                  className={cn(
                    "group relative p-5 rounded-xl border border-slate-200/70 dark:border-white/10",
                    "bg-white/80 dark:bg-white/[0.04] backdrop-blur-sm",
                    "hover:shadow-lg hover:border-[#7a4eba]/40 dark:hover:border-[#7a4eba]/30",
                    "transition-all duration-200",
                    "text-left cursor-pointer",
                  )}
                >
                  {/* Favorite Button */}
                  <button
                    type="button"
                    onClick={(e) => toggleFavorite(tool.id, e)}
                    className={cn(
                      "absolute top-3 right-3 p-1.5 rounded-lg transition-colors z-10",
                      isFavorite
                        ? "text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20"
                        : "text-slate-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 opacity-0 group-hover:opacity-100"
                    )}
                  >
                    <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
                  </button>

                  {/* Icon */}
                  <div className="mb-3">
                    <div className={cn("p-3 rounded-lg w-fit", aiTutorTheme.page.iconBg)}>
                      <Icon className={cn("h-6 w-6", aiTutorTheme.page.iconText)} />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {tool.name}
                      </h3>
                      {tool.premium && (
                        <Badge className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 border-0">
                          PREMIUM
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                      {tool.description}
                    </p>
                  </div>

                  {/* Hover Effect */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500/0 to-pink-500/0 group-hover:from-purple-500/5 group-hover:to-pink-500/5 transition-all duration-200 pointer-events-none" />
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
