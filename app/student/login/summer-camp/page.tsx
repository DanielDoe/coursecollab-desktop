"use client"

import { SummerCamperAuthForm } from "@/components/summer-camp/SummerCamperAuthForm"
import { DesktopAuthPanel, DesktopAuthPanelBody, DesktopAuthPanelCard } from "@/components/auth/desktop-auth-primitives"
import { DesktopAuthShell } from "@/components/auth/DesktopAuthShell"
import { useNativeApp } from "@/hooks/use-native-app"
import { isNativeAppSearchParams } from "@/lib/mobile-native-app"
import { useSearchParams } from "next/navigation"

export default function SummerCamperLoginPage() {
  const searchParams = useSearchParams()
  const uaNative = useNativeApp()
  const isNativeApp = isNativeAppSearchParams(searchParams) || uaNative

  if (isNativeApp) {
    return (
      <div className="native-app-shell min-h-[100dvh] w-full bg-[#F8FAFC] dark:bg-slate-950 flex items-center justify-center">
        <div className="w-full max-w-md mx-auto px-4 py-6">
          <SummerCamperAuthForm nativeApp />
        </div>
      </div>
    )
  }

  return (
    <DesktopAuthShell sidebarTagline="Sign in with your camp email. New campers can create an account on the web app.">
      <DesktopAuthPanel>
        <DesktopAuthPanelBody>
          <DesktopAuthPanelCard>
            <SummerCamperAuthForm variant="desktop" backHref="/auth/welcome" />
          </DesktopAuthPanelCard>
        </DesktopAuthPanelBody>
      </DesktopAuthPanel>
    </DesktopAuthShell>
  )
}
