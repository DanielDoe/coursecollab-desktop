"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, GraduationCap, Loader2, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { redirectToAccessStatusPage } from "@/lib/access-governance/access-status-session"
import { ACCESS_EMAIL_INBOX_HINT } from "@/lib/access-governance/email-inbox-hint"

export function FacultySignupForm({ className }: { className?: string }) {
  const router = useRouter()
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    institution: "",
    jobTitle: "",
    password: "",
    confirmPassword: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: name === "username" ? value.toLowerCase().replace(/\s/g, "") : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      const res = await fetch("/api/faculty/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Signup failed")
        return
      }
      setSuccess(data.message || "Request submitted.")
      redirectToAccessStatusPage(
        router,
        {
          lifecycle: "pending_email_verification",
          accountType: "faculty",
          request: {
            fullName: form.fullName.trim(),
            email: form.email.trim(),
            organization: form.institution.trim(),
            emailVerified: false,
          },
        },
        "faculty",
      )
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const inputClass =
    "rounded-xl border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50"

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-900/80 backdrop-blur-sm shadow-xl shadow-slate-200/40 dark:shadow-none p-6 sm:p-8",
        className,
      )}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="h-11 w-11 rounded-xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
          <GraduationCap className="h-6 w-6 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Request faculty access</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            An administrator must approve your account before you can sign in.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          <p>{success}</p>
          <p className="mt-2 text-emerald-900/80 dark:text-emerald-100/80">{ACCESS_EMAIL_INBOX_HINT}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              placeholder="Daniel Doe"
              required
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="dmdoe"
              required
              autoComplete="username"
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@pvamu.edu"
              required
              autoComplete="email"
              className={inputClass}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="institution">Institution</Label>
            <Input
              id="institution"
              name="institution"
              value={form.institution}
              onChange={handleChange}
              placeholder="Prairie View A&M University"
              required
              className={inputClass}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="jobTitle">Job title</Label>
            <Input
              id="jobTitle"
              name="jobTitle"
              value={form.jobTitle}
              onChange={handleChange}
              placeholder="Assistant Professor"
              required
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                required
                minLength={8}
                autoComplete="new-password"
                className={cn(inputClass, "pr-10")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={form.confirmPassword}
              onChange={handleChange}
              required
              minLength={8}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={isLoading || !!success}
          className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 h-11 font-semibold"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Submit for approval
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        Already have an account?{" "}
        <Link href="/faculty/login" className="font-medium text-violet-600 dark:text-violet-400 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
