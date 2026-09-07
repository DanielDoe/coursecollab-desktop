"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronLeft, GraduationCap, KeyRound, CheckCircle2, Clock, Shield } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { authCardClass, authGhostBackButtonClass } from "@/components/auth/AuthShell"
import { desktopAuth } from "@/components/auth/desktop-auth-primitives"
import { cn } from "@/lib/utils"

const SHELL =
  "relative min-h-screen flex flex-col bg-[var(--cc-background)] text-[var(--cc-text)]"

function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_-12%,color-mix(in_srgb,var(--cc-accent)_8%,transparent),transparent),radial-gradient(ellipse_50%_40%_at_88%_110%,color-mix(in_srgb,var(--cc-brand-gold)_5%,transparent),transparent)]"
    />
  )
}

/** Centered brand mark + context line, shown above the card. */
function BrandHeader() {
  return (
    <div className="mb-6 flex flex-col items-center gap-2 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)]">
        <GraduationCap className="h-5 w-5 text-[var(--cc-accent)]" />
      </div>
      <div>
        <p className="text-[13px] font-semibold text-[var(--cc-text)]">CourseCollab</p>
        <p className="text-[12px] text-[var(--cc-text-muted)]">Career Member account recovery</p>
      </div>
    </div>
  )
}

export default function GuestForgotPasswordPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const response = await fetch("/api/guest/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to submit")
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className={SHELL}>
        <AuroraBackground />
        <main className="relative flex flex-1 items-center justify-center px-4 py-12">
          <div className="flex w-full max-w-[420px] flex-col">
            <BrandHeader />
            <div className={authCardClass}>
              <div className="mb-4 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <h1 className="mb-1.5 text-center text-[21px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--cc-text)]">
                Request sent
              </h1>
              <p className="mb-5 text-center text-[14px] leading-snug text-[var(--cc-text-secondary)]">
                Your instructor can approve the reset from their dashboard. After approval, you will receive a temporary
                password at the email you entered (or they may share it with you directly).
              </p>
              <Alert className="mb-5 rounded-lg border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-accent-soft)_55%,transparent)]">
                <Clock className="h-4 w-4" />
                <AlertDescription className="text-[13px]">
                  Use the temporary password to sign in on the Career Member page, then open Profile to set a new password if you
                  like.
                </AlertDescription>
              </Alert>
              <Button
                className="h-10 w-full rounded-lg bg-[var(--cc-accent)] text-[14px] font-semibold text-white hover:bg-[var(--cc-accent-hover)]"
                onClick={() => router.push("/student/login/guest")}
              >
                Back to Career Member sign in
              </Button>
            </div>
            <p className="mt-auto pt-8 pb-6 text-center text-[11px] text-[var(--cc-text-muted)]">CourseCollab Desktop</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={SHELL}>
      <AuroraBackground />
      <main className="relative flex flex-1 items-center justify-center px-4 py-12">
        <div className="flex w-full max-w-[420px] flex-col">
          <BrandHeader />
          <div className={authCardClass}>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)]">
              <KeyRound className="h-5 w-5 text-[var(--cc-accent)]" />
            </div>
            <h1 className="mb-1 text-[21px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--cc-text)]">
              Forgot password
            </h1>
            <p className="mb-5 text-[14px] leading-snug text-[var(--cc-text-secondary)]">
              Submit a request so your instructor can reset your Career Member password and send you a temporary password.
            </p>
            <Alert className="mb-5 rounded-lg border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-accent-soft)_55%,transparent)]">
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-[12px] sm:text-[13px]">
                Use the same email and full name you used when you created your Career Member account.
              </AlertDescription>
            </Alert>
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="g-email" className="text-[13px] font-medium">
                  Email
                </Label>
                <Input
                  id="g-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-10 rounded-lg text-[14px]"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-name" className="text-[13px] font-medium">
                  Full name
                </Label>
                <Input
                  id="g-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={loading}
                  className="h-10 rounded-lg text-[14px]"
                  autoComplete="name"
                  placeholder="As registered on your Career Member account"
                />
              </div>
              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              ) : null}
              <div className={desktopAuth.actionStack}>
                <Button
                  type="submit"
                  className="h-9 w-full rounded-md bg-[var(--cc-accent)] text-[13px] font-semibold text-white hover:bg-[var(--cc-accent-hover)]"
                  disabled={loading}
                >
                  {loading ? "Submitting…" : "Submit request"}
                </Button>
                <Link href="/student/login/guest" className={cn(authGhostBackButtonClass)}>
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Career Member sign in
                </Link>
              </div>
            </form>
          </div>
          <p className="mt-auto pt-8 pb-6 text-center text-[11px] text-[var(--cc-text-muted)]">CourseCollab Desktop</p>
        </div>
      </main>
    </div>
  )
}
