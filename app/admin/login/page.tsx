"use client"

import { AdminLoginForm } from "@/components/admin-login-form"
import { useNativeApp } from "@/hooks/use-native-app"
import { isNativeAppSearchParams } from "@/lib/mobile-native-app"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import { ArrowLeft } from "lucide-react"

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
    <div className="cc-brand-surface cc-brand-auth min-h-screen text-[var(--cc-text)] flex flex-col">
      {/* Subtle grid background — matches student / instructor login */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.4] dark:opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgb(0 0 0 / 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(0 0 0 / 0.03) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      />
      <div
        className="fixed top-0 right-0 w-[80vw] max-w-[600px] h-[60vh] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 70% 20%, rgba(88,44,131,0.06), transparent 50%)",
        }}
      />

      <header data-native-auth-chrome className="relative z-10 border-b border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4 sm:hidden" />
            <CourseCollabLogo size="sm" />
          </Link>
          <Link
            href="/"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col lg:flex-row items-stretch min-h-0">
        {/* Left panel — admin module previews */}
        <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center px-6 xl:px-10 py-12 bg-slate-50/80 dark:bg-slate-900/50 border-r border-slate-200/80 dark:border-white/10 overflow-y-auto">
          <div className="w-full max-w-xl mx-auto text-center mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400 mb-2">
              Inside CourseCollab
            </p>
            <h2 className="text-2xl xl:text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight mb-2">
              Your administration hub in one place
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Students, assessments, analytics, finances & more.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 w-full max-w-xl mx-auto">
            {/* Students */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-sm p-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] overflow-hidden">
              <div className="rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 p-2.5">
                <div className="h-2 w-20 rounded bg-slate-300 dark:bg-slate-600 mb-2" />
                <div className="space-y-1.5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="size-5 rounded-full bg-slate-200 dark:bg-slate-600 shrink-0" />
                      <div className="h-2 flex-1 rounded bg-slate-200 dark:bg-slate-700 max-w-[80%]" />
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 mt-1.5 text-center">
                Students
              </p>
            </div>
            {/* Analytics */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-sm p-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] overflow-hidden">
              <div className="rounded-xl overflow-hidden bg-slate-900/95 dark:bg-slate-950 p-2.5">
                <div className="h-2 w-14 rounded bg-slate-700 mb-2" />
                <div className="h-14 flex items-end gap-1">
                  {[40, 65, 50, 82, 70, 90].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t min-w-[6px] bg-gradient-to-t from-violet-600 to-violet-500 origin-bottom"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
              <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 mt-1.5 text-center">
                Analytics
              </p>
            </div>
            {/* Quizzes */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-sm p-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] overflow-hidden">
              <div className="rounded-xl overflow-hidden bg-slate-900/95 dark:bg-slate-950 p-2.5">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[9px] text-slate-400">Quiz bank</span>
                  <span className="text-[8px] text-slate-500">24 active</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                  <div className="h-full w-[72%] rounded-full bg-violet-600/70 origin-left" />
                </div>
              </div>
              <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 mt-1.5 text-center">
                Assessments
              </p>
            </div>
            {/* Financials */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-sm p-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] overflow-hidden">
              <div className="rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5">
                <div className="flex justify-between text-[9px] text-slate-500 dark:text-slate-400 mb-2">
                  <span>Revenue</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">+12%</span>
                </div>
                <div className="h-10 flex items-end gap-1">
                  {[45, 60, 55, 75, 68].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t bg-violet-500/40 min-w-[5px] origin-bottom" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
              <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 mt-1.5 text-center">
                Financials
              </p>
            </div>
            {/* System monitor */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-sm p-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] overflow-hidden">
              <div className="rounded-xl overflow-hidden bg-slate-900/95 dark:bg-slate-950 p-2.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span className="text-[9px] text-slate-400">All systems operational</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="h-6 rounded bg-slate-700/80" />
                  <div className="h-6 rounded bg-slate-700/80" />
                </div>
              </div>
              <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 mt-1.5 text-center">
                System Monitor
              </p>
            </div>
            {/* Recommendations */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-sm p-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] overflow-hidden">
              <div className="rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 p-2.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="size-5 rounded bg-violet-500/20 flex items-center justify-center">
                    <span className="text-[8px] text-violet-600 dark:text-violet-400 font-bold">3</span>
                  </div>
                  <div className="h-2 flex-1 rounded bg-slate-200 dark:bg-slate-700 max-w-[70%]" />
                </div>
                <div className="space-y-1">
                  <div className="h-2 rounded bg-slate-100 dark:bg-slate-800 w-full" />
                  <div className="h-2 rounded bg-slate-100 dark:bg-slate-800 w-4/5" />
                </div>
              </div>
              <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 mt-1.5 text-center">
                Recommendations
              </p>
            </div>
            {/* Question bank */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-sm p-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] overflow-hidden">
              <div className="rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 p-2.5">
                <div className="flex gap-2 mb-2">
                  <div className="h-7 flex-1 rounded-lg bg-slate-200 dark:bg-slate-700" />
                  <div className="h-7 w-14 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-violet-600 dark:text-violet-400">48</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full w-[55%] rounded-full bg-amber-500/60 origin-left" />
                </div>
              </div>
              <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 mt-1.5 text-center">
                Question Bank
              </p>
            </div>
            {/* Settings */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-sm p-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] overflow-hidden">
              <div className="rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5">
                <div className="h-2 w-16 rounded bg-slate-200 dark:bg-slate-700 mb-2" />
                <div className="space-y-1.5">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-5 w-8 rounded bg-violet-500/20 shrink-0" />
                      <div className="h-2 flex-1 rounded bg-slate-100 dark:bg-slate-800" />
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 mt-1.5 text-center">
                Settings
              </p>
            </div>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="flex-1 lg:w-1/2 flex items-center justify-center px-4 py-8 sm:py-12 lg:py-16 overflow-y-auto overflow-x-hidden">
          <div className="w-full max-w-md">
            <AdminLoginForm />
          </div>
        </div>
      </main>
    </div>
  )
}
