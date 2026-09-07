"use client"

import React, { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { AdminNotificationProvider } from "@/lib/admin-notification-context"
import { getAdminData } from "@/lib/auth"

const AUTH_FREE_PATHS = ["/admin/login", "/admin/reset-password", "/admin/select-course"]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [adminId, setAdminId] = useState<string | null>(null)

  useEffect(() => {
    const data = getAdminData()
    if (data) setAdminId(data.id)
  }, [])

  useEffect(() => {
    if (AUTH_FREE_PATHS.includes(pathname ?? "")) {
      setIsLoading(false)
      setIsAuthenticated(false)
      return
    }

    if (isAuthenticated && isLoading === false) {
      return
    }

    const checkAuth = () => {
      try {
        const adminData = getAdminData()
        if (!adminData) {
          if (pathname !== "/admin/login") {
            router.push("/admin/login")
          }
          return
        }

        setIsAuthenticated(true)
        setIsLoading(false)
      } catch (error) {
        console.error("[AdminLayout] Error checking auth:", error)
        if (pathname !== "/admin/login") {
          router.push("/admin/login")
        }
      }
    }

    const timer = setTimeout(checkAuth, 0)
    return () => clearTimeout(timer)
  }, [router, pathname, isAuthenticated, isLoading])

  if (isLoading && !AUTH_FREE_PATHS.includes(pathname ?? "")) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading admin portal...</p>
        </div>
      </div>
    )
  }

  if (AUTH_FREE_PATHS.includes(pathname ?? "")) {
    return <>{children}</>
  }

  if (pathname?.startsWith("/admin/dashboard-v2")) {
    return <AdminNotificationProvider adminId={adminId}>{children}</AdminNotificationProvider>
  }

  return <AdminNotificationProvider adminId={adminId}>{children}</AdminNotificationProvider>
}
