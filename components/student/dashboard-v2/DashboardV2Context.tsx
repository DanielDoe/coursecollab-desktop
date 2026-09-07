"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import {
  fetchDashboardBannerPrefs,
  getStudentDatabaseIdFromClient,
  readClientWelcomeDismissed,
  writeClientWelcomeDismissed,
} from "@/lib/student-dashboard-banner-prefs"

interface DashboardV2ContextValue {
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  tourOpen: boolean
  setTourOpen: (open: boolean) => void
  /** True when welcome card is dismissed; BannerPromo is hidden when true */
  welcomeCardDismissed: boolean
  setWelcomeCardDismissed: (dismissed: boolean) => void
  /** Replaces numeric "2" style segment in AI Notetaker breadcrumbs when set */
  aiNotetakerBreadcrumbTitle: string | null
  setAiNotetakerBreadcrumbTitle: (title: string | null) => void
  /** Short label for summer camp module crumb, e.g. "M0 · Welcome" */
  campModuleBreadcrumbTitle: string | null
  setCampModuleBreadcrumbTitle: (title: string | null) => void
  /** Extra-immersive camp module view (browser fullscreen) */
  campModuleFullscreen: boolean
  setCampModuleFullscreen: (on: boolean) => void
  /** Cora workspace immersive — hide breadcrumbs, Cora nav, collapse platform sidebar */
  coraImmersive: boolean
  setCoraImmersive: (on: boolean) => void
  /** Global command palette / search (Create button, ⌘K, header search) */
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
}

const DashboardV2Context = createContext<DashboardV2ContextValue | null>(null)

export function DashboardV2Provider({ children }: { children: ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const [welcomeCardDismissed, setWelcomeCardDismissed] = useState(false)
  const [aiNotetakerBreadcrumbTitle, setAiNotetakerBreadcrumbTitle] = useState<string | null>(null)
  const [campModuleBreadcrumbTitle, setCampModuleBreadcrumbTitle] = useState<string | null>(null)
  const [campModuleFullscreen, setCampModuleFullscreen] = useState(false)
  const [coraImmersive, setCoraImmersive] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const studentDbId = getStudentDatabaseIdFromClient()
    if (!studentDbId) return

    const localDismissed = readClientWelcomeDismissed(studentDbId)
    if (localDismissed) {
      setWelcomeCardDismissed(true)
      return
    }

    let cancelled = false
    void fetchDashboardBannerPrefs(studentDbId).then((prefs) => {
      if (cancelled) return
      if (prefs?.welcomeDismissed) {
        writeClientWelcomeDismissed(studentDbId)
        setWelcomeCardDismissed(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])
  return (
    <DashboardV2Context.Provider
      value={{
        mobileSidebarOpen,
        setMobileSidebarOpen,
        sidebarCollapsed,
        setSidebarCollapsed,
        tourOpen,
        setTourOpen,
        welcomeCardDismissed,
        setWelcomeCardDismissed,
        aiNotetakerBreadcrumbTitle,
        setAiNotetakerBreadcrumbTitle,
        campModuleBreadcrumbTitle,
        setCampModuleBreadcrumbTitle,
        campModuleFullscreen,
        setCampModuleFullscreen,
        coraImmersive,
        setCoraImmersive,
        searchOpen,
        setSearchOpen,
      }}
    >
      {children}
    </DashboardV2Context.Provider>
  )
}

export function useDashboardV2() {
  const ctx = useContext(DashboardV2Context)
  return ctx ?? {
    mobileSidebarOpen: false,
    setMobileSidebarOpen: () => {},
    sidebarCollapsed: false,
    setSidebarCollapsed: () => {},
    tourOpen: false,
    setTourOpen: () => {},
    welcomeCardDismissed: false,
    setWelcomeCardDismissed: () => {},
    aiNotetakerBreadcrumbTitle: null,
    setAiNotetakerBreadcrumbTitle: () => {},
    campModuleBreadcrumbTitle: null,
    setCampModuleBreadcrumbTitle: () => {},
    campModuleFullscreen: false,
    setCampModuleFullscreen: () => {},
    coraImmersive: false,
    setCoraImmersive: () => {},
    searchOpen: false,
    setSearchOpen: () => {},
  }
}
