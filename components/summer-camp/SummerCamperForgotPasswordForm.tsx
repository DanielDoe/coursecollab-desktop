"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
      <div className="w-full max-w-md mx-auto text-center space-y-4">
        <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Request submitted</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">{success}</p>
        <Button asChild className="w-full" style={{ background: "#582c83" }}>
          <Link href="/student/login/summer-camp">Back to sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 mb-4">
          <Sun className="h-7 w-7" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Reset password</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
          Enter your camp email and choose a new password. An admin will approve the change.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="resetEmail">Email</Label>
          <Input
            id="resetEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1"
            autoComplete="email"
          />
        </div>
        <div>
          <Label htmlFor="newPassword">New password</Label>
          <div className="relative mt-1">
            <Input
              id="newPassword"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="pr-11"
              autoComplete="new-password"
            />
            <button
              type="button"
              className="absolute right-1 top-1/2 -translate-y-1/2 flex size-9 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <Label htmlFor="confirmNewPassword">Confirm new password</Label>
          <Input
            id="confirmNewPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1"
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading} style={{ background: "#582c83" }}>
          <KeyRound className="h-4 w-4 mr-2" />
          {loading ? "Submitting…" : "Submit reset request"}
        </Button>
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
          Your new password is stored securely and applied only after admin approval.
        </p>
      </form>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
        <Link
          href="/student/login/summer-camp"
          className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
