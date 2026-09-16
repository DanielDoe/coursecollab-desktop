"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Sun, Eye, EyeOff, LogIn, UserPlus, ArrowLeft } from "lucide-react"
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

export function SummerCamperAuthForm({ nativeApp = false }: { nativeApp?: boolean }) {
  const router = useRouter()
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
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 mb-4">
          <Sun className="h-7 w-7" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Summer Camp</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
          Sign in or create your summer program account
        </p>
      </div>

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

      <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "register")}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="login">Sign in</TabsTrigger>
          <TabsTrigger value="register">Create account</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="loginEmail">Email</Label>
              <Input
                id="loginEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="loginPassword">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="loginPassword"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-11"
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
            <Button type="submit" className="w-full" disabled={loading} style={{ background: "#582c83" }}>
              <LogIn className="h-4 w-4 mr-2" />
              {loading ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-center text-sm">
              <Link
                href={
                  nativeApp
                    ? appendNativeAppQuery("/student/login/summer-camp/forgot-password")
                    : "/student/login/summer-camp/forgot-password"
                }
                className="text-violet-600 dark:text-violet-400 hover:underline"
              >
                Forgot password?
              </Link>
            </p>
          </form>
        </TabsContent>

        <TabsContent value="register">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="regEmail">Email</Label>
              <Input id="regEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="school">School / University</Label>
              <Input id="school" value={school} onChange={(e) => setSchool(e.target.value)} required className="mt-1" placeholder="e.g. Prairie View A&M University" />
            </div>
            <div>
              <Label>Enrollment type</Label>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setProgramRole("summer_student")}
                  className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                    programRole === "summer_student"
                      ? "border-violet-500 bg-violet-500/10"
                      : "border-slate-200 dark:border-white/10"
                  }`}
                >
                  <span className="font-semibold block">Summer Student</span>
                  <span className="text-xs text-muted-foreground">Research training and coursework</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProgramRole("summer_camper")}
                  className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                    programRole === "summer_camper"
                      ? "border-violet-500 bg-violet-500/10"
                      : "border-slate-200 dark:border-white/10"
                  }`}
                >
                  <span className="font-semibold block">Summer Camper</span>
                  <span className="text-xs text-muted-foreground">Same access — residential camp participant</span>
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="regPassword">Password</Label>
              <Input id="regPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="mt-1" />
            </div>
            <Button type="submit" className="w-full" disabled={loading} style={{ background: "#582c83" }}>
              <UserPlus className="h-4 w-4 mr-2" />
              {loading ? "Submitting…" : "Create account"}
            </Button>
            <p className="text-xs text-slate-500 text-center">
              Summer campers and summer students use the same training platform. An admin may review your request before approval.
            </p>
          </form>
        </TabsContent>
      </Tabs>

      {!nativeApp ? (
        <p className="text-center text-sm text-slate-500 mt-6">
          <Link href="/" className="inline-flex items-center gap-1 text-violet-600 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to CourseCollab
          </Link>
        </p>
      ) : null}
    </div>
  )
}
