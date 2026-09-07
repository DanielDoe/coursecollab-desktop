"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"

type InstitutionDashboardContextValue = {
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  institutionName: string
  role: string
}

const InstitutionDashboardContext = createContext<InstitutionDashboardContextValue | null>(null)

export function InstitutionDashboardProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [institutionName, setInstitutionName] = useState("Institution")
  const [role, setRole] = useState("")

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/institution/me", { credentials: "include" })
      if (res.status === 401) {
        router.push("/institution/login")
        return
      }
      if (res.ok) {
        const data = await res.json()
        setInstitutionName(data.institutionName ?? "Institution")
        setRole(String(data.role ?? "").replaceAll("_", " "))
      }
    })()
  }, [router])

  return (
    <InstitutionDashboardContext.Provider
      value={{
        mobileSidebarOpen,
        setMobileSidebarOpen,
        sidebarCollapsed,
        setSidebarCollapsed,
        institutionName,
        role,
      }}
    >
      {children}
    </InstitutionDashboardContext.Provider>
  )
}

export function useInstitutionDashboard() {
  const ctx = useContext(InstitutionDashboardContext)
  if (!ctx) throw new Error("useInstitutionDashboard must be used within InstitutionDashboardProvider")
  return ctx
}
