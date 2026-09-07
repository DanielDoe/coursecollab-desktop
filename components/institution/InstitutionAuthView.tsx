"use client"

import { Suspense, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react"
import { AuthGlassCard, AuthShell } from "@/components/auth/AuthShell"
import { DesktopAuthBackLink, desktopAuth } from "@/components/auth/desktop-auth-primitives"
import { INSTITUTION_PLANS, getInstitutionPlan } from "@/lib/institution-plans"
import { cn } from "@/lib/utils"

const FIELD =
  "h-9 w-full rounded-md border border-[var(--border)] bg-[var(--cc-background)] px-3 text-[13px] text-[var(--cc-text)] outline-none focus:border-[var(--cc-accent)] focus:ring-1 focus:ring-[var(--cc-accent)]/25"

function InstitutionAuthInner({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planFromQuery = getInstitutionPlan(searchParams.get("plan"))
  const [institutionName, setInstitutionName] = useState(searchParams.get("institution") ?? "")
  const [contactName, setContactName] = useState(searchParams.get("name") ?? "")
  const [email, setEmail] = useState(searchParams.get("email") ?? "")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [desiredPlan, setDesiredPlan] = useState(planFromQuery?.planKey ?? "")
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const title = mode === "login" ? "Institution sign in" : "Create institution workspace"
  const subtitle =
    mode === "login"
      ? "For university administrators. Faculty and students use their own portals."
      : "Open a workspace to track your request. A license is not activated until a contract is signed."

  const signupHref = useMemo(() => {
    const params = new URLSearchParams()
    if (email) params.set("email", email)
    if (institutionName) params.set("institution", institutionName)
    if (desiredPlan) params.set("plan", desiredPlan)
    const q = params.toString()
    return q ? `/institution/signup?${q}` : "/institution/signup"
  }, [email, institutionName, desiredPlan])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    if (mode === "signup" && password !== confirm) {
      setBusy(false)
      setError("Passwords do not match")
      return
    }
    const path = mode === "login" ? "/api/institution/login" : "/api/institution/signup"
    const payload =
      mode === "login"
        ? { email, password, rememberMe: true }
        : {
            institutionName,
            contactName,
            contactEmail: email,
            password,
            desiredPlan: desiredPlan || null,
            requestKind: searchParams.get("kind") || undefined,
          }
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const body = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(body.error || "Something went wrong")
      return
    }
    router.push("/institution/dashboard")
  }

  return (
    <AuthShell
      showBack={false}
      backHref="/institutions"
      tagline="For institution administrators managing a CourseCollab workspace."
    >
      <AuthGlassCard>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-accent)]">
          Institutions
        </p>
        <h1 className={cn("mt-1.5", desktopAuth.title)}>{title}</h1>
        <p className={cn("mt-1", desktopAuth.subtitle)}>{subtitle}</p>

        <form className="mt-4 space-y-3" onSubmit={(e) => void submit(e)}>
          {mode === "signup" ? (
            <>
              <label className={cn("block", desktopAuth.label)}>
                Institution name
                <input
                  required
                  className={cn(FIELD, "mt-1.5")}
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                />
              </label>
              <label className={cn("block", desktopAuth.label)}>
                Your name
                <input
                  required
                  className={cn(FIELD, "mt-1.5")}
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </label>
            </>
          ) : null}
          <label className={cn("block", desktopAuth.label)}>
            Work email
            <input
              required
              type="email"
              className={cn(FIELD, "mt-1.5")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className={cn("block", desktopAuth.label)}>
            Password
            <span className="relative mt-1.5 block">
              <input
                required
                minLength={mode === "signup" ? 10 : undefined}
                type={showPassword ? "text" : "password"}
                className={cn(FIELD, "pr-10")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "At least 10 characters" : undefined}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-2.5 text-[var(--cc-text-muted)]"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>
          {mode === "signup" ? (
            <>
              <label className={cn("block", desktopAuth.label)}>
                Confirm password
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  className={cn(FIELD, "mt-1.5")}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
              <label className={cn("block", desktopAuth.label)}>
                Package of interest
                <select
                  className={cn(FIELD, "mt-1.5")}
                  value={desiredPlan}
                  onChange={(e) => setDesiredPlan(e.target.value)}
                >
                  <option value="">Select later</option>
                  {INSTITUTION_PLANS.filter((p) => p.active)
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map((plan) => (
                      <option key={plan.planKey} value={plan.planKey}>
                        {plan.displayName}
                      </option>
                    ))}
                </select>
              </label>
            </>
          ) : null}
          {error ? <p className="text-[13px] text-[var(--cc-danger)]">{error}</p> : null}
          <div className={desktopAuth.actionStack}>
            <button
              type="submit"
              disabled={busy}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[var(--cc-accent)] text-[13px] font-semibold text-white transition-colors hover:bg-[var(--cc-accent-hover)] disabled:opacity-70"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create workspace"}
            </button>
            <DesktopAuthBackLink href="/institutions" className="mt-0" />
          </div>
        </form>

        <div className="mt-3 flex items-start gap-2 border-t border-[var(--border)] pt-3 text-[12px] leading-snug text-[var(--cc-text-muted)]">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--cc-accent)]" aria-hidden />
          {mode === "signup"
            ? "Creates a prospect workspace to track your request. Does not provision seats or charge a card."
            : "Demo requests do not create passwords. Create a workspace, or sign in if CourseCollab already added you."}
        </div>

        <p className="mt-3 text-center text-[12px] text-[var(--cc-text-muted)]">
          {mode === "login" ? (
            <>
              New here?{" "}
              <Link href={signupHref} className="font-medium text-[var(--cc-accent)] hover:underline">
                Create institution workspace
              </Link>
            </>
          ) : (
            <>
              Already have access?{" "}
              <Link href="/institution/login" className="font-medium text-[var(--cc-accent)] hover:underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </AuthGlassCard>

      <p className="mt-3 text-center text-[11px] text-[var(--cc-text-muted)]">
        Platform administrators use a different sign-in.
      </p>
    </AuthShell>
  )
}

export function InstitutionAuthView({ mode }: { mode: "login" | "signup" }) {
  return (
    <Suspense
      fallback={
        <AuthShell showBack={false} backHref="/institutions">
          <div className="min-h-[40vh]" />
        </AuthShell>
      }
    >
      <InstitutionAuthInner mode={mode} />
    </Suspense>
  )
}
