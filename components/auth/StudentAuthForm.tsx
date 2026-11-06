"use client"

import { useEffect, useState } from "react"
import { UniversityLogo, universityHasFullWordmark } from "@/components/auth/UniversityLogo"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { setStudentSession } from "@/lib/auth"
import { useAuth } from "@/lib/auth-context"
import type { UniversityRecord } from "@/lib/universities-shared"
import { cn } from "@/lib/utils"
import { ChevronRight, Eye, EyeOff, Loader2 } from "lucide-react"
import { AuthStatusAlert } from "@/components/auth/AuthStatusAlert"
import {
  persistRememberedStudentAuth,
  readRememberedStudentLogin,
  clearRememberedStudentAuth,
} from "@/lib/remembered-auth"
import { resolveStudentPostLoginPath, syncAppearanceSetupFromServer } from "@/lib/appearance/appearance-setup"
import { StudentSelectCoursePanel } from "@/components/auth/StudentSelectCoursePanel"
import { studentEnrollmentCount } from "@/lib/student-select-course"
import { clearStudentExplicitSignOutFlag } from "@/lib/student-session-restore-client"
import { MfaLoginStep, AuthProgressPanel, holdCompleteLoginSplash, parseMfaLoginResponse, type MfaLoginState } from "@/components/auth/MfaLoginStep"
import { formatStudentLoginErrorMessage, isStudentAlreadyActivatedResponse } from "@/lib/student-login-errors"

type EnrollmentOption = {
  courseId: number
  courseCode: string
  courseTitle: string
  section?: string
  studentRowId?: number
}

type Props = {
  university: UniversityRecord
  expired?: boolean
}

export function StudentAuthForm({ university, expired }: Props) {
  const router = useRouter()
  const { setSelectedUniversity } = useAuth()
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState<boolean>(() => readRememberedStudentLogin()?.rememberMe ?? true)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [mode, setMode] = useState<"login" | "activate">("login")
  const [activatePassword, setActivatePassword] = useState("")
  const [activateConfirm, setActivateConfirm] = useState("")
  const [enrollments, setEnrollments] = useState<EnrollmentOption[] | null>(null)
  const [pendingLogin, setPendingLogin] = useState<{ identifier: string; password: string } | null>(null)
  const [mfaState, setMfaState] = useState<MfaLoginState | null>(null)
  const [completingLogin, setCompletingLogin] = useState(false)

  useEffect(() => {
    const remembered = readRememberedStudentLogin()
    if (remembered?.identifier) {
      setIdentifier(remembered.identifier)
    }
  }, [])

  const inputClass =
    "h-10 rounded-xl border-[var(--border)] bg-[var(--cc-surface)] text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)]"

  const finishLogin = async (data: {
    student: Record<string, unknown>
    effectiveMembershipTier?: string
    hasApprovedResetRequest?: boolean
    resetRequestId?: number | null
    enrollment?: { courseId: number; courseCode: string; courseTitle: string; section: string }
    enrollments?: EnrollmentOption[]
    rememberMe?: boolean
    coursePicked?: boolean
  }) => {
    const s = data.student
    const enrollment = data.enrollment
    clearStudentExplicitSignOutFlag()
    setSelectedUniversity(university)
    setStudentSession({
      id: String(s.student_id),
      name: String(s.full_name),
      section: String(s.section ?? enrollment?.section ?? ""),
      databaseId: String(s.id),
      rememberMe: data.rememberMe ?? rememberMe,
      universityId: university.id,
      universityName: university.name,
      universityShortName: university.short_name,
      courseId: enrollment?.courseId ?? (s.course_id != null ? Number(s.course_id) : undefined),
      courseCode: enrollment?.courseCode,
      courseTitle: enrollment?.courseTitle,
      enrollments: data.enrollments,
      hasChangedPassword: Boolean(s.has_changed_password),
    })

    const membershipTier = data.effectiveMembershipTier || String(s.membership_tier ?? "Scholar")
    sessionStorage.setItem("studentMembershipTier", membershipTier)
    localStorage.setItem("studentMembershipTier", membershipTier)

    const didRemember = data.rememberMe ?? rememberMe
    persistRememberedStudentAuth({
      university,
      identifier: identifier.trim() || String(s.student_id ?? ""),
      rememberMe: didRemember,
    })

    if (data.hasApprovedResetRequest) {
      sessionStorage.setItem("resetRequestId", String(data.resetRequestId))
    }

    const appearanceSetupCompleted = await syncAppearanceSetupFromServer(String(s.id))

    router.push(
      resolveStudentPostLoginPath({
        studentDbId: String(s.id),
        hasChangedPassword: Boolean(s.has_changed_password),
        hasApprovedResetRequest: data.hasApprovedResetRequest,
        appearanceSetupCompleted,
        enrollmentCount: studentEnrollmentCount(data.enrollments),
        courseSelectionCompleted:
          Boolean(data.coursePicked) || studentEnrollmentCount(data.enrollments) < 2,
      }),
    )
  }

  const completeLoginWithSplash = async (data: Parameters<typeof finishLogin>[0]) => {
    setCompletingLogin(true)
    const startedAt = Date.now()
    try {
      await finishLogin(data)
      await holdCompleteLoginSplash(startedAt)
    } catch (err) {
      setCompletingLogin(false)
      throw err
    }
  }

  const submitLogin = async (course?: { courseId: number; section?: string }) => {
    setLoading(true)
    setError("")
    setInfo("")
    try {
      const id = pendingLogin?.identifier ?? identifier
      const pw = pendingLogin?.password ?? password
      const res = await fetch("/api/auth/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          universityId: university.id,
          identifier: id,
          password: pw,
          rememberMe,
          courseId: course?.courseId,
          section: course?.section,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(formatStudentLoginErrorMessage(data))

      if (data.requiresCourseSelection) {
        setEnrollments(data.enrollments ?? [])
        setPendingLogin({ identifier: id, password: pw })
        return
      }

      const mfa = parseMfaLoginResponse(data as Record<string, unknown>)
      if (mfa) {
        setMfaState(mfa)
        return
      }

      await completeLoginWithSplash({
        student: data.student,
        effectiveMembershipTier: data.effectiveMembershipTier,
        hasApprovedResetRequest: data.hasApprovedResetRequest,
        resetRequestId: data.resetRequestId,
        enrollment: data.enrollment,
        enrollments: data.enrollments,
        rememberMe: data.rememberMe,
        coursePicked: Boolean(course),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim() || !password) {
      setError("Enter your student ID or email and password.")
      return
    }
    await submitLogin()
  }

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setInfo("")
    if (!identifier.trim()) {
      setError("Enter your student ID or university email.")
      return
    }
    if (activatePassword.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (activatePassword !== activateConfirm) {
      setError("Passwords do not match.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/auth/student/login", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universityId: university.id,
          identifier,
          newPassword: activatePassword,
          confirmPassword: activateConfirm,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 || isStudentAlreadyActivatedResponse(data)) {
          setMode("login")
          setActivatePassword("")
          setActivateConfirm("")
          setPassword("")
          setError("")
          setInfo(formatStudentLoginErrorMessage(data))
          return
        }
        throw new Error(formatStudentLoginErrorMessage(data))
      }
      setMode("login")
      setPassword(activatePassword)
      setError("")
      setInfo("")
      await submitLogin()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed")
    } finally {
      setLoading(false)
    }
  }

  const switchAuthMode = (next: "login" | "activate") => {
    setMode(next)
    setError("")
    setInfo("")
  }

  if (completingLogin) {
    return <AuthProgressPanel label="Authenticating…" />
  }

  if (mfaState) {
    return (
      <div className="space-y-4">
        {university.logo ? (
          <div className="flex justify-center">
            <UniversityLogo university={university} size="md" />
          </div>
        ) : null}
        <MfaLoginStep
          state={mfaState}
          portalLabel={university.short_name ?? university.name}
          onBack={() => {
            setMfaState(null)
            setError("")
          }}
          onComplete={async (data) => {
            await finishLogin({
              student: data.student as Record<string, unknown>,
              effectiveMembershipTier: data.effectiveMembershipTier as string | undefined,
              hasApprovedResetRequest: data.hasApprovedResetRequest as boolean | undefined,
              resetRequestId: data.resetRequestId as number | null | undefined,
              enrollment: data.enrollment as
                | { courseId: number; courseCode: string; courseTitle: string; section: string }
                | undefined,
              enrollments: data.enrollments as EnrollmentOption[] | undefined,
              rememberMe: data.rememberMe as boolean | undefined,
              coursePicked: true,
            })
          }}
        />
      </div>
    )
  }

  if (enrollments && enrollments.length > 1) {
    return (
      <StudentSelectCoursePanel
        enrollments={enrollments}
        loading={loading}
        error={error}
        onSelect={(course) => void submitLogin({ courseId: course.courseId, section: course.section })}
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center text-center gap-1.5">
        {university.logo ? <UniversityLogo university={university} size="sm" /> : null}
        <div>
          {!universityHasFullWordmark(university) ? (
            <p
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: university.primary_color }}
            >
              {university.short_name}
            </p>
          ) : null}
          <h2 className="text-lg font-bold text-[var(--cc-text)]">
            {mode === "login" ? "Student Login" : "Activate Account"}
          </h2>
          {!universityHasFullWordmark(university) ? (
            <p className="text-xs text-[var(--cc-text-secondary)]">{university.name}</p>
          ) : null}
        </div>
      </div>

      {expired ? (
        <AuthStatusAlert tone="warning" title="Session expired">
          Please sign in again.
        </AuthStatusAlert>
      ) : null}

      {info ? (
        <AuthStatusAlert tone="info">{info}</AuthStatusAlert>
      ) : null}

      {error ? (
        <AuthStatusAlert tone="error" title="Couldn't sign in">
          {error}
        </AuthStatusAlert>
      ) : null}

      {mode === "login" && !info && !error ? (
        <AuthStatusAlert tone="info" title="Enrolled by your instructor?">
          Sign in with your Student ID or email and the temporary password from your welcome email.
        </AuthStatusAlert>
      ) : null}

      {mode === "login" ? (
        <form onSubmit={handleLogin} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="student-identifier" className="text-[var(--cc-text)]">
              Student ID or Email
            </Label>
            <Input
              id="student-identifier"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. P12345678 or mlawson13@pvamu.edu"
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="student-password" className="text-[var(--cc-text)]">
                Password
              </Label>
              <Link
                href="/student/forgot-password"
                className="text-xs font-medium text-[var(--cc-accent)] hover:text-[var(--cc-accent-dark)] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="student-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(inputClass, "pr-11")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cc-text-muted)] hover:text-[var(--cc-text-secondary)]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onCheckedChange={(v) => {
                const next = v === true
                setRememberMe(next)
                if (!next) clearRememberedStudentAuth()
              }}
            />
            <Label htmlFor="remember-me" className="cursor-pointer text-sm font-normal text-[var(--cc-text-secondary)]">
              Remember me
            </Label>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-xl font-semibold text-white"
            style={{ backgroundColor: university.primary_color }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Login"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleActivate} className="space-y-3">
          <AuthStatusAlert tone="warning" title="Most students should sign in">
            Only use this if your instructor did not enroll you or you were not sent a temporary password.{" "}
            <button
              type="button"
              onClick={() => switchAuthMode("login")}
              className="font-semibold underline underline-offset-2"
            >
              Sign in instead
            </button>
            .
          </AuthStatusAlert>
          <div className="space-y-2">
            <Label htmlFor="activate-identifier">Student ID or University Email</Label>
            <Input
              id="activate-identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="From your roster or syllabus"
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="activate-password">Create Password</Label>
            <Input
              id="activate-password"
              type="password"
              value={activatePassword}
              onChange={(e) => setActivatePassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="activate-confirm">Confirm Password</Label>
            <Input
              id="activate-confirm"
              type="password"
              value={activateConfirm}
              onChange={(e) => setActivateConfirm(e.target.value)}
              className={inputClass}
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-xl font-semibold text-white"
            style={{ backgroundColor: university.primary_color }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activate & Sign In"}
          </Button>
        </form>
      )}

      <div className="space-y-2 border-t border-[var(--border)] pt-3">
        {mode === "login" ? (
          <p className="text-center text-[11px] leading-snug text-[var(--cc-text-secondary)]">
            Lost your welcome email or need to pick a password yourself?{" "}
            <button
              type="button"
              onClick={() => switchAuthMode("activate")}
              className="font-semibold text-[var(--cc-accent)] underline underline-offset-2"
            >
              Set password manually
            </button>
          </p>
        ) : (
          <button
            type="button"
            onClick={() => switchAuthMode("login")}
            className="flex w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--cc-accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--cc-accent-dark)] transition-colors hover:bg-[color-mix(in_srgb,var(--cc-accent-soft)_75%,var(--cc-accent)_10%)]"
          >
            Back to sign in with temporary password
          </button>
        )}

        <Link
          href="/auth/student/signup"
          className="flex w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--cc-surface)] px-4 py-2 text-sm font-semibold text-[var(--cc-text)] transition-colors hover:bg-[var(--cc-accent-soft)]"
        >
          New student? Request course access
        </Link>

        <nav
          aria-label="Other sign-in options"
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--cc-surface)]"
        >
          <Link
            href="/auth/university?change=1"
            className="flex items-center justify-between gap-3 px-3.5 py-2 text-sm font-medium text-[var(--cc-text)] transition-colors hover:bg-[var(--cc-accent-soft)]"
          >
            <span>Not your school? Change university</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--cc-accent)]" aria-hidden />
          </Link>
          <Link
            href="/student/login/guest"
            className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-3.5 py-2 text-sm font-medium text-[var(--cc-text)] transition-colors hover:bg-[var(--cc-accent-soft)]"
          >
            <span>
              Career Member
              <span className="block text-[11px] font-normal text-[var(--cc-text-secondary)]">
                Career tools & recommendation letters
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--cc-accent)]" aria-hidden />
          </Link>
        </nav>

        <p className="text-center text-[11px] text-[var(--cc-text-secondary)]">
          Need help? Contact your instructor.
        </p>
      </div>
    </div>
  )
}
