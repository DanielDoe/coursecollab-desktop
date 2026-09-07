"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import { Eye, EyeOff, ArrowRight, Lock, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { appendNativeAppQuery } from "@/lib/mobile-native-app"
import { useNativeApp } from "@/hooks/use-native-app"
import { cn } from "@/lib/utils"
import {
  parseAccessLifecycleFromLoginError,
} from "@/components/auth/AccessRequestStatusPanel"
import { redirectToAccessStatusPage } from "@/lib/access-governance/access-status-session"

interface InstructorLoginFormProps {
  /** When true, renders only the form card for embedding on landing page */
  compact?: boolean
  /** Prefix for input ids when embedded (avoids duplicate ids) */
  idPrefix?: string
  /** Optional className for the root card */
  className?: string
  title?: string
  subtitle?: string
  nativeApp?: boolean
}

export function InstructorLoginForm({
  compact = false,
  idPrefix = "",
  className,
  title = "Instructor & TA sign in",
  subtitle = "Instructors and teaching assistants use the same portal",
  nativeApp = false,
}: InstructorLoginFormProps) {
  const router = useRouter()
  const detectedNative = useNativeApp()
  const isNative = nativeApp || detectedNative
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/instructor/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username.trim(),
          password: formData.password,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        const session = data.faculty ?? data.instructor
        localStorage.setItem("instructorSession", JSON.stringify(session))
        localStorage.setItem("instructorId", session.id.toString())
        window.dispatchEvent(new Event("instructor-session-updated"))
        if (session.requiresPasswordChange || !session.hasChangedPassword) {
          router.push(isNative ? appendNativeAppQuery("/faculty/change-password") : "/faculty/change-password")
        } else {
          router.push(isNative ? appendNativeAppQuery("/faculty/login?step=course") : "/faculty/login?step=course")
        }
      } else {
        const lifecycle = parseAccessLifecycleFromLoginError(data)
        if (lifecycle && redirectToAccessStatusPage(router, lifecycle, "faculty")) {
          return
        }
        setError(data.error || "Login failed")
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const inputClass =
    "rounded-xl border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 dark:focus:border-violet-500 transition-colors"
  const labelClass = "text-sm font-medium text-slate-700 dark:text-slate-300"

  const formCard = (
    <div
      className={cn(
        "w-full rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-none overflow-hidden",
        className
      )}
    >
      <div className="px-6 sm:px-8 pt-8 pb-6 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
        <div className="flex justify-center mb-4">
          <CourseCollabLogo size="sm" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white text-center">
          {title}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-center text-sm mt-1">
          {subtitle}
        </p>
      </div>

      <div className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm p-3">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}username`} className={labelClass}>
              Username
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                id={`${idPrefix}username`}
                name="username"
                type="text"
                placeholder="Enter your username"
                value={formData.username}
                onChange={handleInputChange}
                disabled={isLoading}
                className={cn(inputClass, "pl-10")}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}password`} className={labelClass}>
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                id={`${idPrefix}password`}
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleInputChange}
                disabled={isLoading}
                className={cn(inputClass, "pl-10 pr-10")}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-right">
              <a
                href="/instructor/help"
                className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
              >
                Need help?
              </a>
            </p>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600 text-white shadow-lg shadow-violet-900/20 py-4 text-base font-semibold transition-all hover:shadow-violet-900/30"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Signing in…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Continue to Dashboard
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600 dark:text-slate-400">
          New faculty member?{" "}
          <Link
            href={isNative ? appendNativeAppQuery("/faculty/signup") : "/faculty/signup"}
            className="font-medium text-violet-600 dark:text-violet-400 hover:underline"
          >
            Request an account
          </Link>
        </p>
      </div>
    </div>
  )

  return formCard
}
