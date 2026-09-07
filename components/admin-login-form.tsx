"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import { Eye, EyeOff, AlertCircle, Lock, Shield, User } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { setAdminSession } from "@/lib/auth"
import { MfaLoginStep, parseMfaLoginResponse, type MfaLoginState } from "@/components/auth/MfaLoginStep"
import { appendNativeAppQuery } from "@/lib/mobile-native-app"
import { useNativeApp } from "@/hooks/use-native-app"
import { cn } from "@/lib/utils"
import { DesktopAuthBackLink, DesktopAuthPageHeader, desktopAuth } from "@/components/auth/desktop-auth-primitives"

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
})

type LoginFormData = z.infer<typeof loginSchema>

interface AdminLoginFormProps {
  compact?: boolean
  idPrefix?: string
  className?: string
  nativeApp?: boolean
  variant?: "default" | "desktop"
  backHref?: string
  backLabel?: string
}

export function AdminLoginForm({
  idPrefix = "",
  className,
  nativeApp = false,
  variant = "default",
  backHref,
  backLabel = "Back",
}: AdminLoginFormProps) {
  const router = useRouter()
  const detectedNative = useNativeApp()
  const isNative = nativeApp || detectedNative
  const { toast } = useToast()

  const [formData, setFormData] = useState<LoginFormData>({ username: "", password: "" })
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({})
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loginAttempts, setLoginAttempts] = useState(0)
  const [isLocked, setIsLocked] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [mfaState, setMfaState] = useState<MfaLoginState | null>(null)

  const validateForm = (data: LoginFormData): boolean => {
    try {
      loginSchema.parse(data)
      setErrors({})
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof LoginFormData, string>> = {}
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as keyof LoginFormData] = err.message
          }
        })
        setErrors(newErrors)
      }
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError("")

    if (isLocked) {
      setSubmitError("Too many failed attempts. Please try again in 15 minutes.")
      return
    }

    if (!validateForm(formData)) return

    setLoading(true)
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const data = await response.json()
        const mfa = parseMfaLoginResponse(data as Record<string, unknown>)
        if (mfa) {
          setMfaState(mfa)
          return
        }
        setAdminSession({
          id: String(data.admin.id),
          username: data.admin.username,
          name: data.admin.full_name || data.admin.username,
          platformRole: data.admin.platformRole ?? "PLATFORM_ADMIN",
        })
        router.push(isNative ? appendNativeAppQuery("/admin/dashboard-v2") : "/admin/dashboard-v2")
        return
      }

      const errorData = await response.json()
      setLoginAttempts((prev) => {
        const next = prev + 1
        if (next >= 5) {
          setIsLocked(true)
          setTimeout(() => {
            setIsLocked(false)
            setLoginAttempts(0)
          }, 15 * 60 * 1000)
        }
        return next
      })
      setSubmitError(errorData.error || "Login failed")
    } catch {
      setSubmitError("Network error. Please try again.")
      toast({
        title: "Connection error",
        description: "Could not reach the server. Check your connection and try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (name in errors) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
    if (submitError) setSubmitError("")
  }

  const isDesktop = variant === "desktop"
  const inputClass = isDesktop
    ? desktopAuth.input
    : "rounded-xl border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 dark:focus:border-violet-500 transition-colors pl-10"
  const labelClass = isDesktop ? desktopAuth.label : "text-sm font-medium text-slate-700 dark:text-slate-300"

  if (mfaState) {
    return (
      <div className={cn(isDesktop ? "w-full" : "w-full rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 backdrop-blur-xl p-6 sm:p-8", className)}>
        <MfaLoginStep
          state={mfaState}
          portalLabel="CourseCollab Admin"
          onBack={() => setMfaState(null)}
          onComplete={(data) => {
            setMfaState(null)
            setAdminSession({
              id: String((data.admin as { id: number }).id),
              username: (data.admin as { username: string }).username,
              name: (data.admin as { username: string }).username,
              platformRole: (data.admin as { platformRole?: string }).platformRole ?? "PLATFORM_ADMIN",
            })
            router.push(isNative ? appendNativeAppQuery("/admin/dashboard-v2") : "/admin/dashboard-v2")
          }}
        />
      </div>
    )
  }

  return (
    <div className={cn(isDesktop ? "w-full space-y-5" : "w-full rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-none overflow-hidden", className)}>
      {isDesktop ? (
        <DesktopAuthPageHeader
          icon={Shield}
          title="Admin sign in"
          subtitle="Secure access to CourseCollab administration"
        />
      ) : (
      <div className="px-6 sm:px-8 pt-8 pb-6 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
        <div className="flex justify-center mb-4">
          <CourseCollabLogo size="sm" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white text-center font-semibold">
          Admin sign in
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-center text-sm mt-1">
          Secure access to CourseCollab administration
        </p>
      </div>
      )}

      <div className={cn(!isDesktop && "p-6 sm:p-8")}>
        <form onSubmit={handleSubmit} className={cn(isDesktop ? "space-y-4" : "space-y-5")}>
          {submitError && (
            <div className={cn("bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm p-3 flex items-start gap-2", isDesktop ? "rounded-[10px]" : "rounded-xl")}>
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {loginAttempts > 0 && !isLocked && !submitError && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm p-3">
              {loginAttempts} failed attempt{loginAttempts > 1 ? "s" : ""}.
              {5 - loginAttempts > 0 ? ` ${5 - loginAttempts} attempts remaining.` : ""}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}username`} className={labelClass}>
              Username
            </Label>
            <div className="relative">
              {!isDesktop ? (
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              ) : null}
              <Input
                id={`${idPrefix}username`}
                name="username"
                type="text"
                placeholder="Enter your username"
                value={formData.username}
                onChange={handleInputChange}
                disabled={loading || isLocked}
                className={cn(inputClass, !isDesktop && "pl-10", errors.username && "border-red-500")}
                required
              />
            </div>
            {errors.username && (
              <p className="text-red-500 text-sm flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.username}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}password`} className={labelClass}>
              Password
            </Label>
            <div className="relative">
              {!isDesktop ? (
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              ) : null}
              <Input
                id={`${idPrefix}password`}
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleInputChange}
                disabled={loading || isLocked}
                className={cn(inputClass, !isDesktop && "pl-10", "pr-10", errors.password && "border-red-500")}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={isLocked}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-sm flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.password}
              </p>
            )}
          </div>

          <div className={cn(isDesktop ? desktopAuth.actionStack : "space-y-2 pt-1")}>
            <Button
              type="submit"
              disabled={loading || isLocked}
              className={cn(
                isDesktop
                  ? cn(desktopAuth.button, "rounded-md")
                  : "w-full rounded-xl bg-violet-600 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600 text-white font-semibold shadow-lg shadow-violet-900/20 py-4 text-base hover:shadow-violet-900/30",
              )}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" />
                  Signing in…
                </span>
              ) : (
                isDesktop ? "Sign in" : "Continue to Dashboard"
              )}
            </Button>
            {backHref ? <DesktopAuthBackLink href={backHref} label={backLabel} className="mt-0" /> : null}
          </div>
        </form>
      </div>
    </div>
  )
}
