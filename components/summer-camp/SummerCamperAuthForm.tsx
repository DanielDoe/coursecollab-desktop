"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Sun, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { setStudentSession } from "@/lib/auth"
import { appendNativeAppQuery } from "@/lib/mobile-native-app"
import { SUMMER_CAMP_DASHBOARD_BASE } from "@/lib/summer-camp/camper-nav"
import { isSummerProgramRole, type SummerProgramRole } from "@/lib/summer-camp/program-roles"
import { MfaLoginStep, parseMfaLoginResponse, type MfaLoginState } from "@/components/auth/MfaLoginStep"
import { cn } from "@/lib/utils"
import { DesktopAuthBackLink, DesktopAuthPageHeader, desktopAuth } from "@/components/auth/desktop-auth-primitives"
import { DesktopWebSignupLink } from "@/components/auth/DesktopWebSignupLink"
import { DESKTOP_WEB_SIGNUP_PATHS, isDesktopAuthLoginOnly } from "@/lib/desktop-auth-policy"

export function SummerCamperAuthForm({
  nativeApp = false,
  variant = "default",
  backHref,
  backLabel = "Back",
}: {
  nativeApp?: boolean
  variant?: "default" | "desktop"
  backHref?: string
  backLabel?: string
}) {
  const router = useRouter()
  const isDesktop = variant === "desktop"
  const desktopLoginOnly = isDesktopAuthLoginOnly(variant)
  const [tab, setTab] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [school, setSchool] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [programRole, setProgramRole] = useState<SummerProgramRole>("summer_student")

  const [success, setSuccess] = useState("")
  const [mfaState, setMfaState] = useState<MfaLoginState | null>(null)
  const inputClass = isDesktop
    ? cn(desktopAuth.input, "mt-1 rounded-md border border-[var(--border)]")
    : "mt-1 h-10 rounded-md border border-[var(--border)]"
  const labelClass = isDesktop ? desktopAuth.label : undefined
  const submitClass = isDesktop ? cn(desktopAuth.button, "rounded-md") : "h-10 w-full rounded-md"

  const finishLogin = (s: Record<string, unknown>) => {
    const role = String(s.student_program_role ?? "summer_student")
    const programRole: SummerProgramRole = isSummerProgramRole(role) ? role : "summer_student"
    setStudentSession({
      id: String(s.student_id),
      name: String(s.full_name),
      section: "SUMMER_CAMP",
      databaseId: String(s.id),
      isSummerCamper: true,
      studentProgramRole: programRole,
    })
    const onboarded = localStorage.getItem("cc_summer_camp_onboarded")
    const dest = onboarded ? SUMMER_CAMP_DASHBOARD_BASE : `${SUMMER_CAMP_DASHBOARD_BASE}/onboarding`
    router.push(nativeApp ? appendNativeAppQuery(dest) : dest)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")
    try {
      const res = await fetch("/api/summer-camp/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Login failed")
      const mfa = parseMfaLoginResponse(data as Record<string, unknown>)
      if (mfa) {
        setMfaState(mfa)
        return
      }
      finishLogin(data.student)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")
    try {
      const res = await fetch("/api/summer-camp/request-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, school, password, confirmPassword, programRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Request failed")
      setSuccess(data.message)
      if (data.autoApproved) {
        const loginRes = await fetch("/api/summer-camp/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        })
        const loginData = await loginRes.json()
        if (loginRes.ok) finishLogin(loginData.student)
        else setTab("login")
      } else {
        setTab("login")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed")
    } finally {
      setLoading(false)
    }
  }

  if (mfaState) {
    return (
      <div className="w-full max-w-md mx-auto">
        <MfaLoginStep
          state={mfaState}
          portalLabel="CourseCollab Summer"
          onBack={() => setMfaState(null)}
          onComplete={(data) => {
            setMfaState(null)
            finishLogin(data.student as Record<string, unknown>)
          }}
        />
      </div>
    )
  }

  return (
    <div className={cn("w-full", isDesktop ? "max-w-none" : "max-w-md mx-auto")}>
      {isDesktop ? (
        <DesktopAuthPageHeader
          icon={Sun}
          iconClassName="bg-amber-500/15 text-amber-600 dark:text-amber-400"
          title="Summer Camp"
          subtitle="Sign in with your camp email"
        />
      ) : (
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 mb-4 size-14">
          <Sun className="h-7 w-7" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Summer Camp
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
          Sign in with your camp email
        </p>
      </div>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mb-4 border-emerald-500/30 bg-emerald-500/10">
          <AlertDescription className="text-emerald-800 dark:text-emerald-200">{success}</AlertDescription>
        </Alert>
      )}

      {desktopLoginOnly ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label htmlFor="loginEmail" className={labelClass}>Email</Label>
            <Input
              id="loginEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="loginPassword" className={labelClass}>Password</Label>
              <Link
                href={
                  nativeApp
                    ? appendNativeAppQuery("/student/login/summer-camp/forgot-password")
                    : "/student/login/summer-camp/forgot-password"
                }
                className={cn(desktopAuth.footerLink, "text-[13px] no-underline hover:underline")}
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative mt-1">
              <Input
                id="loginPassword"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={cn(inputClass, "pr-11")}
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
          <div className={desktopAuth.actionStack}>
            <Button
              type="submit"
              className={submitClass}
              disabled={loading}
              style={isDesktop ? { background: "var(--cc-accent)" } : { background: "var(--cc-accent)" }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
            {backHref ? <DesktopAuthBackLink href={backHref} label={backLabel} className="mt-0" /> : null}
          </div>
          <div className="border-t border-[var(--border)] pt-3">
            <DesktopWebSignupLink
              path={DESKTOP_WEB_SIGNUP_PATHS.summerCamp}
              prompt="Need a camper account?"
              label="Create account on web"
            />
          </div>
        </form>
      ) : (
      <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "register")}>
        <TabsList
          className={cn(
            "grid w-full grid-cols-2 mb-6",
            isDesktop && "h-10 rounded-[10px] border border-[var(--border)] bg-[var(--cc-surface)] p-1",
          )}
        >
          <TabsTrigger value="login" className={cn(isDesktop && desktopAuth.segmentedTrigger)}>
            Sign in
          </TabsTrigger>
          <TabsTrigger value="register" className={cn(isDesktop && desktopAuth.segmentedTrigger)}>
            Create account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="loginEmail" className={labelClass}>Email</Label>
              <Input
                id="loginEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="loginPassword" className={labelClass}>Password</Label>
                {isDesktop ? (
                  <Link
                    href={
                      nativeApp
                        ? appendNativeAppQuery("/student/login/summer-camp/forgot-password")
                        : "/student/login/summer-camp/forgot-password"
                    }
                    className={cn(desktopAuth.footerLink, "text-[13px] no-underline hover:underline")}
                  >
                    Forgot password?
                  </Link>
                ) : null}
              </div>
              <div className="relative mt-1">
                <Input
                  id="loginPassword"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={cn(inputClass, "pr-11")}
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
            <div className={desktopAuth.actionStack}>
              <Button
                type="submit"
                className={submitClass}
                disabled={loading}
                style={isDesktop ? { background: "var(--cc-accent)" } : { background: "var(--cc-accent)" }}
              >
                {loading ? "Signing in…" : "Sign in"}
              </Button>
              {backHref ? <DesktopAuthBackLink href={backHref} label={backLabel} className="mt-0" /> : null}
            </div>
            {!isDesktop ? (
            <p className="mt-3 text-center text-sm">
              <Link
                href={
                  nativeApp
                    ? appendNativeAppQuery("/student/login/summer-camp/forgot-password")
                    : "/student/login/summer-camp/forgot-password"
                }
                className="text-[var(--cc-accent)] hover:underline"
              >
                Forgot password?
              </Link>
            </p>
            ) : null}
          </form>
        </TabsContent>

        <TabsContent value="register">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <Label htmlFor="fullName" className={labelClass}>Full name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <Label htmlFor="regEmail" className={labelClass}>Email</Label>
              <Input id="regEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <Label htmlFor="school" className={labelClass}>School / University</Label>
              <Input id="school" value={school} onChange={(e) => setSchool(e.target.value)} required className={inputClass} placeholder="e.g. Prairie View A&M University" />
            </div>
            <div>
              <Label className={labelClass}>Enrollment type</Label>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setProgramRole("summer_student")}
                  className={cn(
                    "border p-3 text-left text-sm transition-colors",
                    isDesktop ? "rounded-[10px] border-[var(--border)]" : "rounded-xl",
                    programRole === "summer_student"
                      ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)]"
                      : isDesktop
                        ? "bg-[var(--cc-surface)] hover:bg-[var(--cc-accent-soft)]/50"
                        : "border-slate-200 dark:border-white/10",
                  )}
                >
                  <span className="font-semibold block">Summer Student</span>
                  <span className="text-xs text-muted-foreground">Research training and coursework</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProgramRole("summer_camper")}
                  className={cn(
                    "border p-3 text-left text-sm transition-colors",
                    isDesktop ? "rounded-[10px] border-[var(--border)]" : "rounded-xl",
                    programRole === "summer_camper"
                      ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)]"
                      : isDesktop
                        ? "bg-[var(--cc-surface)] hover:bg-[var(--cc-accent-soft)]/50"
                        : "border-slate-200 dark:border-white/10",
                  )}
                >
                  <span className="font-semibold block">Summer Camper</span>
                  <span className="text-xs text-muted-foreground">Same access — residential camp participant</span>
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="regPassword" className={labelClass}>Password</Label>
              <Input id="regPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className={inputClass} />
            </div>
            <div>
              <Label htmlFor="confirmPassword" className={labelClass}>Confirm password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={inputClass} />
            </div>
            <div className={desktopAuth.actionStack}>
              <Button
                type="submit"
                className={submitClass}
                disabled={loading}
                style={isDesktop ? { background: "var(--cc-accent)" } : { background: "var(--cc-accent)" }}
              >
                {loading ? "Submitting…" : "Create account"}
              </Button>
              {backHref ? <DesktopAuthBackLink href={backHref} label={backLabel} className="mt-0" /> : null}
            </div>
            <p className={cn("mt-3 text-center text-[12px]", isDesktop ? desktopAuth.hint : "text-[var(--cc-text-muted)]")}>
              Summer campers and summer students use the same training platform. An admin may review your request before approval.
            </p>
          </form>
        </TabsContent>
      </Tabs>
      )}

    </div>
  )
}
