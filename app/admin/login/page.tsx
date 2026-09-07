"use client"

import { AdminLoginForm } from "@/components/admin-login-form"
import { DesktopAuthPanel, DesktopAuthPanelBody, DesktopAuthPanelCard } from "@/components/auth/desktop-auth-primitives"
import { DesktopAuthShell } from "@/components/auth/DesktopAuthShell"
import { useNativeApp } from "@/hooks/use-native-app"
import { isNativeAppSearchParams } from "@/lib/mobile-native-app"
import { useSearchParams } from "next/navigation"

export default function AdminLoginPage() {
  const searchParams = useSearchParams()
  const uaNative = useNativeApp()
  const isNativeApp = isNativeAppSearchParams(searchParams) || uaNative

  if (isNativeApp) {
    return (
      <div className="native-app-shell cc-brand-surface cc-brand-auth min-h-[100dvh] w-full flex items-center justify-center">
        <div className="w-full max-w-md mx-auto px-4 py-6">
          <AdminLoginForm nativeApp />
        </div>
      </div>
    )
  }

  return (
    <DesktopAuthShell sidebarTagline="Platform administration for CourseCollab operators.">
      <DesktopAuthPanel>
        <DesktopAuthPanelBody>
          <DesktopAuthPanelCard>
            <AdminLoginForm variant="desktop" backHref="/auth/welcome" />
          </DesktopAuthPanelCard>
        </DesktopAuthPanelBody>
      </DesktopAuthPanel>
    </DesktopAuthShell>
  )
}
