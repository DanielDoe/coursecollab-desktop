"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import { 
  Bell, 
  User, 
  Settings, 
  LogOut, 
  ChevronDown,
  HelpCircle,
  Sun,
  Moon,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { getInstructorData } from "@/lib/auth"
import { logoutFaculty } from "@/lib/faculty-auth-flow"
import { InstructorNotificationBell } from "@/components/instructor-notification-bell"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"

function profileDisplayName(name?: string | null, username?: string | null) {
  return name?.trim() || username?.trim() || "Instructor"
}

export function InstructorHeader() {
  const { isDark, setAppearanceMode } = useAppearance()
  const [displayName, setDisplayName] = useState("Instructor")
  const theme = isDark ? "dark" : "light"

  useEffect(() => {
    const loadProfile = () => {
      const data = getInstructorData()
      setDisplayName(profileDisplayName(data?.name, data?.username))
    }
    loadProfile()
    window.addEventListener("instructor-session-updated", loadProfile)
    return () => window.removeEventListener("instructor-session-updated", loadProfile)
  }, [])

  const handleLogout = () => {
    logoutFaculty()
  }

  return (
    <header className="border-b border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-slate-900/70 sticky top-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
      <div className="container mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          {/* Logo and Navigation */}
          <div className="flex items-center space-x-8">
            <Link href="/instructor/dashboard-v2" className="flex items-center hover:opacity-80 transition-opacity group">
              <CourseCollabLogo size="md" tone="emerald" withWordmark />
            </Link>
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-4">
            {/* Theme Toggle */}
            <AnimatedThemeToggler
              theme={theme}
              onThemeChange={(next) => setAppearanceMode(next)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </AnimatedThemeToggler>

            {/* Notifications */}
            <InstructorNotificationBell />

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl px-3 h-10 transition-all"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <span className="hidden md:block text-slate-700 dark:text-slate-300 font-medium">
                    {displayName}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2">
                <div className="px-3 py-2 mb-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{displayName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Faculty account</p>
                </div>
                <DropdownMenuItem asChild>
                  <Link href="/instructor/profile" className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                    <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900">
                      <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm font-medium">Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/instructor/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all">
                    <div className="p-1.5 rounded-md bg-indigo-100 dark:bg-indigo-900">
                      <Settings className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span className="text-sm font-medium">Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/instructor/help-center" className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all">
                    <div className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-900">
                      <HelpCircle className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-sm font-medium">Help & Support</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/instructor/dashboard-v2" className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all text-emerald-700 dark:text-emerald-300">
                    <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-900">
                      <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="text-sm font-medium">Switch to Dashboard 2.0</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-2" />
                <DropdownMenuItem 
                  onClick={handleLogout} 
                  className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-all"
                >
                  <div className="p-1.5 rounded-md bg-red-100 dark:bg-red-900">
                    <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <span className="text-sm font-medium">Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}