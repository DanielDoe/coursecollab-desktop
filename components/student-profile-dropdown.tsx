"use client"

import { useState, useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { User, Lock, Moon, Sun, HelpCircle, LogOut, Crown, Heart, Award, Star, Palette } from "lucide-react"
import { logoutStudent, getStudentData, studentApiFetch } from "@/lib/auth"
import { useTheme } from "@/hooks/use-theme"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { runThemeReveal } from "@/components/ui/animated-theme-toggler"
import { useRouter } from "next/navigation"
import { MEMBERSHIP_PLANS, type MembershipTier } from "@/lib/membership-constants"
import { initialsFromName } from "@/lib/initials-from-name"

export function StudentProfileDropdown() {
  const router = useRouter()
  const { theme } = useTheme()
  const { setAppearanceMode } = useAppearance()
  const [studentData, setStudentData] = useState<{
    name: string | null
    section: string | null
  }>({ name: null, section: null })
  const [membershipTier, setMembershipTier] = useState<MembershipTier | null>(null)
  const [mounted, setMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    console.log("[v0] StudentProfileDropdown: Component mounted")
    setMounted(true)
    const data = getStudentData()
    if (data) {
      console.log("[v0] StudentProfileDropdown: Student data loaded", { name: data.name, section: data.section })
      setStudentData({
        name: data.name,
        section: data.section,
      })
    } else {
      console.log("[v0] StudentProfileDropdown: No student data found")
    }

    // Fetch membership tier
    const fetchMembership = async () => {
      try {
        const studentId = sessionStorage.getItem("studentDatabaseId")
        if (!studentId) return

        const response = await studentApiFetch(`/api/student/membership?studentId=${studentId}`)
        if (response.ok) {
          const data = await response.json()
          setMembershipTier(data.membership?.tier || "Scholar")
        }
      } catch (error) {
        console.error("[v0] StudentProfileDropdown: Failed to fetch membership", error)
        // Default to Scholar if fetch fails
        setMembershipTier("Scholar")
      }
    }

    fetchMembership()
  }, [])

  useEffect(() => {
    console.log("[v0] StudentProfileDropdown: isOpen changed to", isOpen)

    const handleClickOutside = (event: MouseEvent) => {
      console.log("[v0] StudentProfileDropdown: Click outside detected", {
        target: event.target,
        dropdownRef: dropdownRef.current,
        contains: dropdownRef.current?.contains(event.target as Node),
      })

      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        console.log("[v0] StudentProfileDropdown: Closing dropdown due to outside click")
        setIsOpen(false)
      }
    }

    if (isOpen) {
      console.log("[v0] StudentProfileDropdown: Adding mousedown listener")
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      if (isOpen) {
        console.log("[v0] StudentProfileDropdown: Removing mousedown listener")
      }
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const getInitials = (name: string | null) => initialsFromName(name ?? "", "ST")

  const handleLogout = () => {
    console.log("[v0] StudentProfileDropdown: Logout clicked")
    setIsOpen(false)
    logoutStudent()
  }

  const handleNavigation = (path: string) => {
    console.log("[v0] StudentProfileDropdown: Navigation clicked", { path })
    setIsOpen(false)
    router.push(path)
  }

  const handleThemeToggle = (e: ReactMouseEvent<HTMLButtonElement>) => {
    const next = theme === "dark" ? "light" : "dark"
    runThemeReveal({
      origin: e.currentTarget.getBoundingClientRect(),
      nextTheme: next,
      applyTheme: () => {
        document.documentElement.classList.toggle("dark", next === "dark")
        setAppearanceMode(next)
      },
    })
  }

  if (!mounted) {
    return (
      <Button variant="ghost" className="relative h-10 w-10 rounded-full" disabled>
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-primary text-primary-foreground">ST</AvatarFallback>
        </Avatar>
      </Button>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        className="relative h-11 w-11 rounded-xl hover:bg-slate-100/80 transition-all duration-200"
        onClick={() => {
          console.log("[v0] StudentProfileDropdown: Avatar button clicked, current isOpen:", isOpen)
          setIsOpen(!isOpen)
        }}
      >
        <Avatar className="h-11 w-11">
          <AvatarFallback className="bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)] font-semibold shadow-sm">
            {getInitials(studentData.name)}
          </AvatarFallback>
        </Avatar>
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-72 bg-white/85 dark:bg-slate-800/85 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/60 rounded-2xl shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_25px_rgba(0,0,0,0.4)] z-50 overflow-hidden">
          <div className="p-6 border-b border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-base font-semibold tracking-tight text-slate-800 dark:text-slate-200">{studentData.name || "Student"}</p>
              {membershipTier && (() => {
                const plan = MEMBERSHIP_PLANS.find(p => p.id === membershipTier)
                if (!plan) return null
                
                const getTierConfig = () => {
                  switch (membershipTier) {
                    case "Trailblazer":
                      return {
                        icon: Crown,
                        bgColor: "bg-gradient-to-r from-purple-500 to-indigo-600",
                        textColor: "text-white",
                        borderColor: "border-purple-400/30",
                      }
                    case "Explorer":
                      return {
                        icon: Star,
                        bgColor: "bg-gradient-to-r from-blue-500 to-cyan-600",
                        textColor: "text-white",
                        borderColor: "border-blue-400/30",
                      }
                    case "Scholar":
                    default:
                      return {
                        icon: Award,
                        bgColor: "bg-gradient-to-r from-slate-400 to-slate-600",
                        textColor: "text-white",
                        borderColor: "border-slate-400/30",
                      }
                  }
                }
                
                const config = getTierConfig()
                const Icon = config.icon
                
                return (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bgColor} ${config.textColor} border ${config.borderColor} shadow-sm`}
                    title={plan.displayName}
                    aria-label={`Membership tier: ${plan.displayName}`}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{plan.name}</span>
                  </span>
                )
              })()}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {studentData.section ? `Section ${studentData.section}` : "No section assigned"}
            </p>
          </div>

          <div className="py-2">
            <button
              onClick={() => {
                console.log("[v0] StudentProfileDropdown: Profile button clicked")
                handleNavigation("/student/dashboard-v2/settings")
              }}
              className="w-full flex items-center px-6 py-3 text-sm hover:bg-slate-50/80 dark:hover:bg-slate-700/80 transition-all duration-200 text-slate-700 dark:text-slate-300"
            >
              <User className="mr-3 h-4 w-4" />
              <span>Settings</span>
            </button>

            <button
              onClick={() => {
                console.log("[v0] StudentProfileDropdown: Membership button clicked")
                handleNavigation("/student/dashboard-v2/membership")
              }}
              className="w-full flex items-center px-6 py-3 text-sm hover:bg-slate-50/80 dark:hover:bg-slate-700/80 transition-all duration-200 text-slate-700 dark:text-slate-300"
            >
              <Crown className="mr-3 h-4 w-4 text-amber-600" />
              <span>Membership & plans</span>
            </button>

            <button
              onClick={() => {
                console.log("[v0] StudentProfileDropdown: Donate button clicked")
                handleNavigation("/student/donate")
              }}
              className="w-full flex items-center px-6 py-3 text-sm hover:bg-slate-50/80 dark:hover:bg-slate-700/80 transition-all duration-200 text-slate-700 dark:text-slate-300"
            >
              <Heart className="mr-3 h-4 w-4 text-red-500" />
              <span>Support Development</span>
            </button>

            <button
              onClick={() => {
                console.log("[v0] StudentProfileDropdown: Reset password button clicked")
                handleNavigation("/student/reset-password")
              }}
              className="w-full flex items-center px-6 py-3 text-sm hover:bg-slate-50/80 dark:hover:bg-slate-700/80 transition-all duration-200 text-slate-700 dark:text-slate-300"
            >
              <Lock className="mr-3 h-4 w-4" />
              <span>Reset Password</span>
            </button>

            <button
              onClick={() => handleNavigation("/student/dashboard-v2/settings/appearance")}
              className="w-full flex items-center px-6 py-3 text-sm hover:bg-slate-50/80 dark:hover:bg-slate-700/80 transition-all duration-200 text-slate-700 dark:text-slate-300"
            >
              <Palette className="mr-3 h-4 w-4" />
              <span>Appearance & themes</span>
            </button>

            <button
              onClick={(e) => {
                handleThemeToggle(e)
              }}
              className="w-full flex items-center px-6 py-3 text-sm hover:bg-slate-50/80 dark:hover:bg-slate-700/80 transition-all duration-200 text-slate-700 dark:text-slate-300"
            >
              {theme === "light" ? (
                <>
                  <Moon className="mr-3 h-4 w-4" />
                  <span>Dark Mode</span>
                </>
              ) : (
                <>
                  <Sun className="mr-3 h-4 w-4" />
                  <span>Light Mode</span>
                </>
              )}
            </button>

            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log("[v0] StudentProfileDropdown: Help button clicked")
                handleNavigation("/student/help")
              }}
              onTouchEnd={(e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log("[v0] StudentProfileDropdown: Help button touched")
                handleNavigation("/student/help")
              }}
              className="w-full flex items-center px-6 py-3 text-sm hover:bg-slate-50/80 dark:hover:bg-slate-700/80 transition-all duration-200 text-slate-700 dark:text-slate-300 touch-manipulation"
            >
              <HelpCircle className="mr-3 h-4 w-4" />
              <span>Help / Support</span>
            </button>
          </div>

          <div className="border-t border-slate-200/60 dark:border-slate-700/60 py-2">
            <button
              onClick={() => {
                console.log("[v0] StudentProfileDropdown: Logout button clicked")
                handleLogout()
              }}
              className="w-full flex items-center px-6 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-900/20 transition-all duration-200"
            >
              <LogOut className="mr-3 h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
