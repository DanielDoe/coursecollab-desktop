"use client"

import { useState } from "react"
import Link from "next/link"
import { CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DesktopAuthBackLink, desktopAuth } from "@/components/auth/desktop-auth-primitives"
import { cn } from "@/lib/utils"

export function SummerCamperForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")
    try {
      const res = await fetch("/api/summer-camp/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, confirmPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to submit request")
      setSuccess(data.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="w-full">
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <h1 className={desktopAuth.title}>Request submitted</h1>
        <p className={cn(desktopAuth.subtitle, "mt-1")}>{success}</p>
        <div className={desktopAuth.actionStack}>
          <Button asChild className={desktopAuth.button}>
            <Link href="/student/login/summer-camp">Back to sign in</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <h1 className={desktopAuth.title}>Reset password</h1>
      <p className={cn(desktopAuth.subtitle, "mt-1")}>
        Enter your camp email and a new password. An admin must approve the change.
      </p>

      {error ? (
        <Alert variant="destructive" className={cn(desktopAuth.alert, "mt-4")}>
          <AlertDescription className="text-[13px]">{error}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <Label htmlFor="resetEmail" className={desktopAuth.label}>
            Email
          </Label>
          <Input
            id="resetEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={cn(desktopAuth.input, "mt-1.5")}
            autoComplete="email"
          />
        </div>
        <div>
          <Label htmlFor="newPassword" className={desktopAuth.label}>
            New password
          </Label>
          <div className="relative mt-1.5">
            <Input
              id="newPassword"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className={cn(desktopAuth.input, "pr-10")}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <Label htmlFor="confirmNewPassword" className={desktopAuth.label}>
            Confirm new password
          </Label>
          <Input
            id="confirmNewPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className={cn(desktopAuth.input, "mt-1.5")}
            autoComplete="new-password"
          />
        </div>
        <div className={desktopAuth.actionStack}>
          <Button type="submit" className={desktopAuth.button} disabled={loading}>
            <KeyRound className="mr-2 h-3.5 w-3.5" />
            {loading ? "Submitting…" : "Submit reset request"}
          </Button>
          <DesktopAuthBackLink href="/student/login/summer-camp" label="Back to sign in" />
        </div>
        <p className="text-[12px] text-[var(--cc-text-muted)]">
          Your new password is applied only after admin approval.
        </p>
      </form>
    </div>
  )
}
