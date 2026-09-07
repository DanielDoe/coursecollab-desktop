"use client"

import { useCallback, useRef, useState } from "react"
import { AdminLoginForm } from "@/components/admin-login-form"
import { FacultyLoginForm } from "@/components/faculty-login-form"
import { StudentLoginForm } from "@/components/student-login-form"
import { SummerCamperAuthForm } from "@/components/summer-camp/SummerCamperAuthForm"
import { cn } from "@/lib/utils"

const PORTALS = [
  { id: "student", label: "Student" },
  { id: "faculty", label: "Faculty" },
  { id: "summer", label: "Summer" },
  { id: "admin", label: "Admin" },
] as const

export function NativeAppLoginHub() {
  const [active, setActive] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const w = el.clientWidth
    const idx = Math.round(el.scrollLeft / w)
    setActive(Math.min(Math.max(idx, 0), PORTALS.length - 1))
  }, [])

  return (
    <div className="native-app-shell min-h-[100dvh] w-full bg-[#F8FAFC] dark:bg-slate-950 flex flex-col overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth touch-pan-x overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {PORTALS.map((p) => (
          <div
            key={p.id}
            className="min-w-full w-full shrink-0 snap-center snap-always px-4 pt-4 pb-2 overflow-y-auto"
          >
            <div className="w-full max-w-md mx-auto min-h-[70dvh] py-2">
              {p.id === "student" ? <StudentLoginForm nativeApp /> : null}
              {p.id === "faculty" ? <FacultyLoginForm nativeApp /> : null}
              {p.id === "summer" ? <SummerCamperAuthForm nativeApp /> : null}
              {p.id === "admin" ? <AdminLoginForm nativeApp /> : null}
            </div>
          </div>
        ))}
      </div>

      <div className="py-4 px-4 text-center space-y-2 border-t border-slate-200/80 dark:border-white/10 bg-[#F8FAFC]/95 dark:bg-slate-950/95">
        <div className="flex justify-center gap-2">
          {PORTALS.map((p, i) => (
            <span
              key={p.id}
              className={cn(
                "h-2 rounded-full transition-all",
                i === active ? "w-6 bg-[#582c83]" : "w-2 bg-[#582c83]/20",
              )}
            />
          ))}
        </div>
        <p className="text-xs font-medium text-slate-500">← Swipe to change sign-in type →</p>
      </div>
    </div>
  )
}

export function NativeLoginShell({ children }: { children: React.ReactNode; backHref?: string }) {
  return <div className="native-app-compact min-h-[100dvh] bg-[#F8FAFC] dark:bg-slate-950 px-4 py-4">{children}</div>
}
