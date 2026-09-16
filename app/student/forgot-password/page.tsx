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
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  KeyRound,
  ShieldCheck,
  UserCheck,
} from "lucide-react"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import { appendNativeAppQuery } from "@/lib/mobile-native-app"
import { useNativeApp } from "@/hooks/use-native-app"

/**
 * Brand-locked, so it renders identically for every visitor regardless of the
 * theme saved in the app. All colour comes from the --cc-* tokens that
 * `cc-brand-surface` pins to PVAMU purple + gold (see globals.css) — this page
 * previously hardcoded indigo/purple gradients and green success states that
 * matched neither the brand nor the rest of the auth flow.
 */
const SHELL = "cc-brand-surface cc-brand-auth min-h-screen flex flex-col"

/** Shared between the form and the confirmation state — it used to be duplicated. */
function AuthHeader() {
  return (
    <header
      data-native-auth-chrome
      className="sticky top-0 z-50 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-surface)_78%,transparent)] backdrop-blur-xl"
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <CourseCollabLogo size="sm" withWordmark />
        </Link>
        <span className="hidden text-xs font-semibold uppercase tracking-widest text-[var(--cc-text-muted)] sm:block">
          Account recovery
        </span>
      </div>
    </header>
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
  "h-11 rounded-xl border-[var(--border)] bg-[var(--cc-surface)] text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus-visible:border-[var(--cc-accent)] focus-visible:ring-2 focus-visible:ring-[var(--cc-accent-soft-strong)]"

const labelClass = "text-[13px] font-semibold text-[var(--cc-text)]"

const cardClass =
  "rounded-3xl border border-[var(--border)] bg-[var(--cc-surface)] p-6 shadow-[0_24px_60px_-32px_color-mix(in_srgb,var(--cc-accent)_45%,transparent)] sm:p-8"

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
        <AuthHeader />
        <main
          className={`flex flex-1 items-center justify-center px-4 py-10 sm:py-14${
            isNativeApp ? " native-app-compact" : ""
          }`}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md"
          >
            <div className={cardClass}>
              <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--cc-success)_16%,transparent)]">
                <CheckCircle2 className="h-7 w-7 text-[var(--cc-success)]" aria-hidden />
              </span>

              <h1 className="text-2xl font-extrabold tracking-tight text-[var(--cc-text)]">
                Request submitted
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--cc-text-secondary)]">
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
                className="mt-6 h-12 w-full rounded-xl bg-[var(--cc-accent)] text-[15px] font-semibold text-white shadow-md transition-colors hover:bg-[var(--cc-accent-hover)]"
                onClick={() => router.push(loginPath)}
              >
                {!isNativeApp ? <ArrowLeft className="mr-2 h-4 w-4" aria-hidden /> : null}
                Back to login
              </Button>
            </div>
          </motion.div>
        </main>
      </div>
    )
  }

  return (
    <div className={SHELL}>
      <AuthHeader />

      <main
        className={`flex flex-1 items-center justify-center px-4 py-10 sm:py-14${
          isNativeApp ? " native-app-compact" : ""
        }`}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className={cardClass}>
            <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-[var(--cc-accent-soft)]">
              <KeyRound className="h-7 w-7 text-[var(--cc-accent)]" aria-hidden />
            </span>

            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--cc-text)]">
              Reset your password
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--cc-text-secondary)]">
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

              <Button
                type="submit"
                className="h-12 w-full rounded-xl bg-[var(--cc-accent)] text-[15px] font-semibold text-white shadow-md transition-colors hover:bg-[var(--cc-accent-hover)] disabled:opacity-70"
                disabled={loading}
              >
                {loading ? "Submitting…" : "Submit request"}
              </Button>
            </form>
          </div>

          <div className="mt-5 text-center">
            <Link
              href={loginPath}
              className="inline-flex min-h-[44px] items-center gap-1.5 px-3 text-sm font-semibold text-[var(--cc-accent)] transition-opacity hover:opacity-80"
            >
              {!isNativeApp ? <ArrowLeft className="h-4 w-4" aria-hidden /> : null}
              Back to login
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
