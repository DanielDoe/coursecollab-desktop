"use client"

import { Suspense, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Building2, Check, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react"
import { AuthGlassCard, AuthShell } from "@/components/auth/AuthShell"
import { INSTITUTION_PLANS, getInstitutionPlan } from "@/lib/institution-plans"
import { cn } from "@/lib/utils"
import { landingPrimaryButtonClass } from "@/components/landing/landing-section-layout"

const FIELD =
  "h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--cc-background)] px-3.5 text-sm text-[var(--cc-text)] outline-none focus:border-[var(--cc-accent)]"

const PERKS = [
  "Track demo and quote requests from one workspace",
  "Complete organization profile before procurement",
  "Manage faculty, students, and Cora after license activation",
  "No card is charged when you create a workspace",
]

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
    <AuthShell backHref="/institutions" contentMaxWidth="max-w-5xl">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
        <div className="hidden rounded-3xl border border-[var(--border)] bg-[var(--cc-accent-soft)] p-8 lg:flex lg:flex-col">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--cc-surface)] text-[var(--cc-accent)]">
            <Building2 className="h-6 w-6" />
          </span>
          <h2 className="mt-6 text-2xl font-extrabold tracking-tight text-[var(--cc-text)]">
            Institution workspace
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--cc-text-secondary)]">
            Enterprise buyers get a workspace immediately. Course Collab reviews the request, then activates the paid license. Student and faculty access stay off until that happens.
          </p>
          <ul className="mt-6 space-y-3">
            {PERKS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-[var(--cc-text-secondary)]">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--cc-surface)]">
                  <Check className="h-3.5 w-3.5 text-[var(--cc-accent)]" strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-auto pt-8 text-xs text-[var(--cc-text-muted)]">
            Platform administrators use a different sign-in. This portal is for the institution that holds the contract.
          </p>
        </div>

        <AuthGlassCard>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--cc-accent)]">Institutions</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--cc-text)]">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--cc-text-secondary)]">{subtitle}</p>

          <form className="mt-6 space-y-3.5" onSubmit={(e) => void submit(e)}>
            {mode === "signup" ? (
              <>
                <label className="block text-xs font-semibold text-[var(--cc-text-muted)]">
                  Institution name
                  <input required className={cn(FIELD, "mt-1.5")} value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} />
                </label>
                <label className="block text-xs font-semibold text-[var(--cc-text-muted)]">
                  Your name
                  <input required className={cn(FIELD, "mt-1.5")} value={contactName} onChange={(e) => setContactName(e.target.value)} />
                </label>
              </>
            ) : null}
            <label className="block text-xs font-semibold text-[var(--cc-text-muted)]">
              Work email
              <input required type="email" className={cn(FIELD, "mt-1.5")} value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block text-xs font-semibold text-[var(--cc-text-muted)]">
              Password
              <span className="relative mt-1.5 block">
                <input
                  required
                  minLength={mode === "signup" ? 10 : undefined}
                  type={showPassword ? "text" : "password"}
                  className={cn(FIELD, "pr-12")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "At least 10 characters" : undefined}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 text-[var(--cc-text-muted)]"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>
            {mode === "signup" ? (
              <>
                <label className="block text-xs font-semibold text-[var(--cc-text-muted)]">
                  Confirm password
                  <input required type={showPassword ? "text" : "password"} className={cn(FIELD, "mt-1.5")} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </label>
                <label className="block text-xs font-semibold text-[var(--cc-text-muted)]">
                  Package of interest
                  <select className={cn(FIELD, "mt-1.5")} value={desiredPlan} onChange={(e) => setDesiredPlan(e.target.value)}>
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
            {error ? <p className="text-sm text-[var(--cc-danger)]">{error}</p> : null}
            <button type="submit" disabled={busy} className={cn(landingPrimaryButtonClass, "w-full")}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create workspace"}
            </button>
          </form>

          <div className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-[var(--cc-text-muted)]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cc-accent)]" />
            {mode === "signup"
              ? "This creates a prospect workspace so you can follow the request. It does not provision students or charge a card."
              : "A demo request alone does not create a password. Create a workspace, or sign in if CourseCollab already added you."}
          </div>

          <p className="mt-5 text-sm text-[var(--cc-text-secondary)]">
            {mode === "login" ? (
              <>
                New here?{" "}
                <Link href={signupHref} className="font-semibold text-[var(--cc-accent)] hover:underline">
                  Create institution workspace
                </Link>
              </>
            ) : (
              <>
                Already have a workspace?{" "}
                <Link href="/institution/login" className="font-semibold text-[var(--cc-accent)] hover:underline">
                  Sign in
                </Link>
              </>
            )}
          </p>
          <p className="mt-2 text-xs text-[var(--cc-text-muted)]">
            <Link href="/institutions" className="hover:underline">Institution packages</Link>
            {" · "}
            <Link href="/faculty/login" className="hover:underline">Faculty</Link>
            {" · "}
            <Link href="/student/login" className="hover:underline">Student</Link>
            {" · "}
            <Link href="/admin/login" className="hover:underline">Platform admin</Link>
          </p>
        </AuthGlassCard>
      </div>
    </AuthShell>
  )
}

export function InstitutionAuthView({ mode }: { mode: "login" | "signup" }) {
  return (
    <Suspense fallback={<AuthShell backHref="/institutions"><div className="min-h-[40vh]" /></AuthShell>}>
      <InstitutionAuthInner mode={mode} />
    </Suspense>
  )
}
