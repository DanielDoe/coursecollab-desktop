"use client"

import { SummerCamperAuthForm } from "@/components/summer-camp/SummerCamperAuthForm"
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
    <div className="min-h-[100dvh] w-full bg-slate-50 dark:bg-[#0B1120] flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-32 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl" />
      </div>
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl p-6 sm:p-8 shadow-xl">
        <SummerCamperAuthForm />
      </div>
    </div>
  )
}
