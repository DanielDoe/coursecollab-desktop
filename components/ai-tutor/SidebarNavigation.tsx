"use client"

import { Home, MessageSquare, Code, TrendingUp, Settings, Sparkles } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface SidebarItem {
  id: string
  label: string
  icon: React.ReactNode
  active?: boolean
}

interface SidebarNavigationProps {
  activeItem?: string
  onItemClick?: (itemId: string) => void
}

const menuItems: SidebarItem[] = [
  { id: "overview", label: "Overview", icon: <Home className="w-5 h-5" /> },
  { id: "chat", label: "AI Chat", icon: <MessageSquare className="w-5 h-5" /> },
  { id: "practice", label: "Practice Hub", icon: <Code className="w-5 h-5" /> },
  { id: "progress", label: "My Progress", icon: <TrendingUp className="w-5 h-5" /> },
  { id: "tools", label: "AI Tools", icon: <Sparkles className="w-5 h-5" /> },
  { id: "preferences", label: "Preferences", icon: <Settings className="w-5 h-5" /> },
]

export function SidebarNavigation({ activeItem = "chat", onItemClick }: SidebarNavigationProps) {
  return (
    <div className="w-64 bg-white border-r border-slate-200 h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">AI Tutor</h2>
            <p className="text-xs text-slate-500">Learning Assistant</p>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = activeItem === item.id
          return (
            <motion.button
              key={item.id}
              onClick={() => onItemClick?.(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                isActive
                  ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md shadow-purple-200/40"
                  : "text-slate-700 hover:bg-slate-50"
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className={cn(isActive ? "text-white" : "text-slate-600")}>
                {item.icon}
              </span>
              <span className="font-medium text-sm">{item.label}</span>
            </motion.button>
          )
        })}
      </nav>
    </div>
  )
}
