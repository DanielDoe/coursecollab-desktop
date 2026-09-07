"use client"

import { useState, useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { User, Lock, Moon, Sun, HelpCircle, Settings, LogOut } from "lucide-react"
import { logoutAdmin, getAdminData } from "@/lib/auth"
import { useTheme } from "@/hooks/use-theme"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { runThemeReveal } from "@/components/ui/animated-theme-toggler"
import { useRouter } from "next/navigation"
import { initialsFromName } from "@/lib/initials-from-name"

export function AdminProfileDropdown() {
  const router = useRouter()
  const { theme } = useTheme()
  const { setAppearanceMode } = useAppearance()
  const [adminData, setAdminData] = useState<{
    username: string | null
  }>({ username: null })
  const [mounted, setMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    console.log("[v0] AdminProfileDropdown: Component mounted")
    setMounted(true)
    const data = getAdminData()
    if (data) {
      console.log("[v0] AdminProfileDropdown: Admin data loaded", { username: data.username })
      setAdminData({
        username: data.username,
      })
    } else {
      console.log("[v0] AdminProfileDropdown: No admin data found")
    }
  }, [])

  useEffect(() => {
    console.log("[v0] AdminProfileDropdown: isOpen changed to", isOpen)

    const handleClickOutside = (event: MouseEvent) => {
      console.log("[v0] AdminProfileDropdown: Click outside detected", {
        target: event.target,
        dropdownRef: dropdownRef.current,
        contains: dropdownRef.current?.contains(event.target as Node),
      })

      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        console.log("[v0] AdminProfileDropdown: Closing dropdown due to outside click")
        setIsOpen(false)
      }
    }

    if (isOpen) {
      console.log("[v0] AdminProfileDropdown: Adding mousedown listener")
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      if (isOpen) {
        console.log("[v0] AdminProfileDropdown: Removing mousedown listener")
      }
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const getInitials = (username: string | null) => initialsFromName(username ?? "", "AD")

  const handleLogout = () => {
    console.log("[v0] AdminProfileDropdown: Logout clicked")
    setIsOpen(false)
    logoutAdmin()
  }

  const handleNavigation = (path: string) => {
    console.log("[v0] AdminProfileDropdown: Navigation clicked", { path })
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
          <AvatarFallback className="bg-primary text-primary-foreground">AD</AvatarFallback>
        </Avatar>
      </Button>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        className="relative h-10 w-10 rounded-full"
        onClick={() => {
          console.log("[v0] AdminProfileDropdown: Avatar button clicked, current isOpen:", isOpen)
          setIsOpen(!isOpen)
        }}
      >
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-primary text-primary-foreground">
            {getInitials(adminData.username)}
          </AvatarFallback>
        </Avatar>
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-popover border border-border rounded-md shadow-lg z-50">
          <div className="p-4 border-b border-border">
            <p className="text-sm font-medium leading-none">{adminData.username || "Admin User"}</p>
            <p className="text-xs leading-none text-muted-foreground mt-1">Role: Admin</p>
          </div>

          <div className="py-1">
            <button
              onClick={() => {
                console.log("[v0] AdminProfileDropdown: Profile button clicked")
                handleNavigation("/admin/profile")
              }}
              className="w-full flex items-center px-4 py-2 text-sm hover:bg-accent transition-colors"
            >
              <User className="mr-2 h-4 w-4" />
              <span>Edit Profile</span>
            </button>

            <button
              onClick={() => {
                console.log("[v0] AdminProfileDropdown: Reset password button clicked")
                handleNavigation("/admin/reset-password")
              }}
              className="w-full flex items-center px-4 py-2 text-sm hover:bg-accent transition-colors"
            >
              <Lock className="mr-2 h-4 w-4" />
              <span>Reset Password</span>
            </button>

            <button
              onClick={(e) => {
                handleThemeToggle(e)
              }}
              className="w-full flex items-center px-4 py-2 text-sm hover:bg-accent transition-colors"
            >
              {theme === "light" ? (
                <>
                  <Moon className="mr-2 h-4 w-4" />
                  <span>Dark Mode</span>
                </>
              ) : (
                <>
                  <Sun className="mr-2 h-4 w-4" />
                  <span>Light Mode</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                console.log("[v0] AdminProfileDropdown: Help button clicked")
                handleNavigation("/admin/help")
              }}
              className="w-full flex items-center px-4 py-2 text-sm hover:bg-accent transition-colors"
            >
              <HelpCircle className="mr-2 h-4 w-4" />
              <span>Help / Support</span>
            </button>

            <button
              onClick={() => {
                console.log("[v0] AdminProfileDropdown: Settings button clicked")
                handleNavigation("/admin/settings")
              }}
              className="w-full flex items-center px-4 py-2 text-sm hover:bg-accent transition-colors"
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>System Settings</span>
            </button>
          </div>

          <div className="border-t border-border py-1">
            <button
              onClick={() => {
                console.log("[v0] AdminProfileDropdown: Logout button clicked")
                handleLogout()
              }}
              className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-accent transition-colors"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
