"use client"


import { studentApiFetch } from "@/lib/auth"
import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { motion } from "framer-motion"
import Link from "next/link"
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  KeyRound,
  ShieldCheck,
  UserCheck,
} from "lucide-react"
import { authCardClass, authGhostBackButtonClass } from "@/components/auth/AuthShell"
import { desktopAuth } from "@/components/auth/desktop-auth-primitives"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import { appendNativeAppQuery } from "@/lib/mobile-native-app"
import { useNativeApp } from "@/hooks/use-native-app"
import { cn } from "@/lib/utils"

/**
 * Brand-locked, so it renders identically for every visitor regardless of the
 * theme saved in the app. All colour comes from the --cc-* tokens that
 * `cc-brand-surface` pins to PVAMU purple + gold (see globals.css) — this page
 * previously hardcoded indigo/purple gradients and green success states that
 * matched neither the brand nor the rest of the auth flow.
 */
const SHELL =
  "cc-brand-surface cc-brand-auth relative min-h-screen flex flex-col bg-[var(--cc-background)]"

/** Ambient aurora wash behind the centered column — CSS-only, never intercepts input. */
function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_-12%,color-mix(in_srgb,var(--cc-accent)_8%,transparent),transparent),radial-gradient(ellipse_50%_40%_at_88%_110%,color-mix(in_srgb,var(--cc-brand-gold)_5%,transparent),transparent)]"
    />
  )
}

/**
 * Shared between the form and the confirmation state — it used to be duplicated.
 * Rendered centered above the card; hidden inside the native app shell, which
 * provides its own chrome (see `[data-native-auth-chrome]` in globals.css).
 */
function AuthHeader() {
  return (
    <div data-native-auth-chrome className="mb-6 flex flex-col items-center gap-2 text-center">
      <Link href="/" className="transition-opacity hover:opacity-80">
        <CourseCollabLogo size="sm" withWordmark />
      </Link>
      <span className="text-xs font-semibold uppercase tracking-widest text-[var(--cc-text-muted)]">
        Account recovery
      </span>
    </div>
  )
}

/**
 * The page's real job is setting expectations: this reset is not instant, it
 * needs a human to approve it. Three labelled steps carry that faster than the
 * paragraph of warning text this replaced.
 */
function ApprovalSteps({ activeIndex }: { activeIndex: number }) {
  const steps = [
    { icon: KeyRound, label: "Submit request" },
    { icon: UserCheck, label: "Staff reviews" },
    { icon: ShieldCheck, label: "Reset password" },
  ]

  return (
    <ol className="flex items-stretch gap-1.5" aria-label="Password reset steps">
      {steps.map((step, i) => {
        const done = i < activeIndex
        const active = i === activeIndex
        return (
          <li key={step.label} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span
              className={`h-1 rounded-full ${
                done || active ? "bg-[var(--cc-accent)]" : "bg-[var(--cc-accent-soft)]"
              }`}
              aria-hidden
            />
            <span className="flex items-center gap-1.5">
              <step.icon
                className={`h-3.5 w-3.5 shrink-0 ${
                  done || active ? "text-[var(--cc-accent)]" : "text-[var(--cc-text-muted)]"
                }`}
                aria-hidden
              />
              <span
                className={`truncate text-[11px] font-semibold ${
                  done || active ? "text-[var(--cc-text)]" : "text-[var(--cc-text-muted)]"
                }`}
              >
                {step.label}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

const fieldClass =
  "h-10 rounded-lg border-[var(--border)] bg-[var(--cc-surface)] text-[14px] text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus-visible:border-[var(--cc-accent)] focus-visible:ring-2 focus-visible:ring-[var(--cc-accent-soft-strong)]"

const labelClass = "text-[13px] font-medium text-[var(--cc-text)]"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const isNativeApp = useNativeApp()
  const loginPath = isNativeApp ? appendNativeAppQuery("/student/login") : "/student/login"
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    studentId: "",
    fullName: "",
    email: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await studentApiFetch("/api/student/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit request")
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className={SHELL}>
        <AuroraBackground />
        <main
          className={`relative flex flex-1 items-center justify-center px-4 py-10 sm:py-14${
            isNativeApp ? " native-app-compact" : ""
          }`}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-[420px]"
          >
            <AuthHeader />
            <div className={authCardClass}>
              <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--cc-success)_16%,transparent)]">
                <CheckCircle2 className="h-6 w-6 text-[var(--cc-success)]" aria-hidden />
              </span>

              <h1 className="text-[21px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--cc-text)]">
                Request submitted
              </h1>
              <p className="mt-1.5 text-[14px] leading-snug text-[var(--cc-text-secondary)]">
                It&rsquo;s with your instructor or an administrator now. You&rsquo;ll be notified
                once it&rsquo;s approved, then you can set a new password.
              </p>

              <div className="mt-6">
                <ApprovalSteps activeIndex={1} />
              </div>

              <div className="mt-6 flex items-start gap-2.5 rounded-2xl bg-[var(--cc-accent-soft)] px-4 py-3.5">
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cc-accent)]"
                  aria-hidden
                />
                <p className="text-[13px] leading-relaxed text-[var(--cc-text-secondary)]">
                  Requests are checked against your student record, so only you can recover your
                  account. Most are reviewed within 1&ndash;2 business days.
                </p>
              </div>

              <Button
                className="mt-5 h-10 w-full rounded-lg bg-[var(--cc-accent)] text-[14px] font-semibold text-white transition-colors hover:bg-[var(--cc-accent-hover)]"
                onClick={() => router.push(loginPath)}
              >
                Back to login
              </Button>
            </div>
            <p className="mt-auto pt-8 pb-6 text-center text-[11px] text-[var(--cc-text-muted)]">CourseCollab Desktop</p>
          </motion.div>
        </main>
      </div>
    )
  }

  return (
    <div className={SHELL}>
      <AuroraBackground />

      <main
        className={`relative flex flex-1 items-center justify-center px-4 py-10 sm:py-14${
          isNativeApp ? " native-app-compact" : ""
        }`}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[420px]"
        >
          <AuthHeader />
          <div className={authCardClass}>
            <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)]">
              <KeyRound className="h-6 w-6 text-[var(--cc-accent)]" aria-hidden />
            </span>

            <h1 className="text-[21px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--cc-text)]">
              Reset your password
            </h1>
            <p className="mt-1.5 text-[14px] leading-snug text-[var(--cc-text-secondary)]">
              For security, a member of staff approves password resets. Send your request and
              we&rsquo;ll take it from there.
            </p>

            <div className="mt-6">
              <ApprovalSteps activeIndex={0} />
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="studentId" className={labelClass}>
                  Student ID
                </Label>
                <Input
                  id="studentId"
                  placeholder="e.g. 30585 or mlawson13"
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  required
                  disabled={loading}
                  autoComplete="username"
                  className={fieldClass}
                />

                {/*
                  This used to be four dense lines of prose under the field —
                  the single most intimidating thing on the page. Same guidance,
                  folded away until someone actually needs it.
                */}
                <details className="group rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-accent-soft)_55%,transparent)] px-3.5 py-2.5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[13px] font-semibold text-[var(--cc-accent)] [&::-webkit-details-marker]:hidden">
                    Which ID should I use?
                    <ChevronDown
                      className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <ul className="mt-2.5 space-y-1.5 text-[13px] leading-relaxed text-[var(--cc-text-secondary)]">
                    <li className="flex gap-2">
                      <span className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-[var(--cc-accent)]" />
                      Your <strong className="font-semibold text-[var(--cc-text)]">PVAMU
                      student number</strong> or <strong className="font-semibold text-[var(--cc-text)]">Canvas
                      SIS ID</strong>
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-[var(--cc-accent)]" />
                      Your <strong className="font-semibold text-[var(--cc-text)]">SIS
                      login</strong> — the part of your email before @pvamu.edu
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-[var(--cc-accent)]" />
                      A Canvas <strong className="font-semibold text-[var(--cc-text)]">p123…</strong>{" "}
                      ID — the digits alone work too
                    </li>
                  </ul>
                </details>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName" className={labelClass}>
                  Full name
                </Label>
                <Input
                  id="fullName"
                  placeholder="Last, First"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                  disabled={loading}
                  autoComplete="name"
                  className={fieldClass}
                />
                <p className="text-xs text-[var(--cc-text-muted)]">
                  Must match the roster exactly.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className={labelClass}>
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@pvamu.edu"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={loading}
                  autoComplete="email"
                  className={fieldClass}
                />
              </div>

              {error && (
                <Alert variant="destructive" className="rounded-xl">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className={desktopAuth.actionStack}>
                <Button
                  type="submit"
                  className="h-9 w-full rounded-md bg-[var(--cc-accent)] text-[13px] font-semibold text-white transition-colors hover:bg-[var(--cc-accent-hover)] disabled:opacity-70"
                  disabled={loading}
                >
                  {loading ? "Submitting…" : "Submit request"}
                </Button>
                <Link href={loginPath} className={cn(authGhostBackButtonClass)}>
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Back to login
                </Link>
              </div>
            </form>
          </div>

          <p className="mt-auto pt-8 pb-6 text-center text-[11px] text-[var(--cc-text-muted)]">CourseCollab Desktop</p>
        </motion.div>
      </main>
    </div>
  )
}
