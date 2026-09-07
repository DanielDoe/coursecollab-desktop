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
import { AlertCircle, Eye, EyeOff } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { AnimatePresence } from "framer-motion"
import {
  DesktopAuthBackLink,
  DesktopAuthPanelBody,
  DesktopAuthPanelCard,
  DesktopAuthUniversityHeader,
  desktopAuth,
} from "@/components/auth/desktop-auth-primitives"
import { DesktopAuthFormSwitch, DesktopAuthStagger } from "@/components/auth/desktop-auth-motion"
import { DesktopWebSignupLink } from "@/components/auth/DesktopWebSignupLink"
import { DESKTOP_WEB_SIGNUP_PATHS, effectiveRememberMeForClient, isDesktopAuthLoginOnly, openWebAppPath } from "@/lib/desktop-auth-policy"
import { captureRefreshTokenFromResponse, withDesktopRefreshInit } from "@/lib/desktop-refresh-token"
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
  variant?: "default" | "desktop"
  backHref?: string
  backLabel?: string
}

export function StudentAuthForm({
  university,
  expired,
  variant = "default",
  backHref,
  backLabel = "Back",
}: Props) {
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

  const isDesktop = variant === "desktop"
  const desktopLoginOnly = isDesktopAuthLoginOnly(variant)
  const loginRememberMe = effectiveRememberMeForClient(rememberMe)
  const inputClass = isDesktop
    ? desktopAuth.input
    : "h-12 rounded-xl border-[var(--border)] bg-[var(--cc-surface)] text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)]"
  const actionButtonClass = isDesktop
    ? desktopAuth.button
    : "w-full h-12 rounded-2xl font-semibold text-white"
  const alertClass = isDesktop ? desktopAuth.alert : "rounded-xl"

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
      rememberMe: effectiveRememberMeForClient(data.rememberMe ?? rememberMe),
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

    const didRemember = effectiveRememberMeForClient(data.rememberMe ?? rememberMe)
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
      const res = await fetch(
        "/api/auth/student/login",
        withDesktopRefreshInit({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            universityId: university.id,
            identifier: id,
            password: pw,
            rememberMe: loginRememberMe,
            courseId: course?.courseId,
            section: course?.section,
          }),
        }),
      )
      captureRefreshTokenFromResponse(res)
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
        rememberMe: effectiveRememberMeForClient(data.rememberMe),
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
    if (desktopLoginOnly && next === "activate") {
      openWebAppPath(DESKTOP_WEB_SIGNUP_PATHS.student)
      return
    }
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

  const mainContent = (
    <>
      {!isDesktop ? (
      <div
        className={cn(
          "flex gap-4",
          "flex-col items-center text-center gap-3",
        )}
      >
        {university.logo ? (
          <UniversityLogo university={university} size="md" />
        ) : null}
        <div>
          {!universityHasFullWordmark(university) ? (
            <p
              className="font-bold uppercase tracking-widest text-[10px]"
              style={{ color: university.primary_color }}
            >
              {university.short_name}
            </p>
          ) : null}
          <h2 className="mt-1 text-xl font-bold text-[var(--cc-text)]">
            {mode === "login" ? "Student Login" : "Activate Account"}
          </h2>
          {!universityHasFullWordmark(university) ? (
            <p className="mt-1 text-sm text-[var(--cc-text-secondary)]">{university.name}</p>
          ) : null}
        </div>
      </div>
      ) : null}

      {isDesktop ? (
        <DesktopAuthUniversityHeader
          media={
            university.logo ? (
              <UniversityLogo university={university} size="md" variant="compact" />
            ) : undefined
          }
          name={university.name}
          hint={
            mode === "login" && !info
              ? "Use your Student ID or email and the temporary password from your welcome email."
              : undefined
          }
        />
      ) : null}

      {expired ? (
        <div
          className={cn(
            alertClass,
            "border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 flex gap-2 text-sm text-amber-900 dark:text-amber-100",
          )}
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Your session expired. Please sign in again.</span>
        </div>
      ) : null}

      {info ? (
        <div
          className={cn(
            alertClass,
            "border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 p-3 flex gap-2 text-sm text-sky-950 dark:text-sky-100",
          )}
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="whitespace-pre-line">{info}</span>
        </div>
      ) : null}

      {error ? (
        <div
          className={cn(
            alertClass,
            "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm p-3 whitespace-pre-line",
          )}
        >
          {error}
        </div>
      ) : null}

      {mode === "login" && !info && !isDesktop ? (
        <div
          className={cn(
            alertClass,
            "border border-violet-200/70 dark:border-violet-500/30 bg-violet-50/80 dark:bg-violet-500/10 p-3 flex gap-2 text-sm text-[var(--cc-text-secondary)]",
          )}
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--cc-accent)]" />
          <span>
            <strong className="font-semibold text-[var(--cc-text)]">Enrolled by your instructor?</strong> Sign in with
            your Student ID or email and the <strong className="font-semibold text-[var(--cc-text)]">temporary password</strong>{" "}
            from your welcome email. CourseCollab will prompt you to set a new password — you do not need account
            activation.
          </span>
        </div>
      ) : null}

      {isDesktop ? (
        <div className="relative overflow-x-clip">
          <AnimatePresence mode="popLayout" initial={false}>
          {mode === "login" ? (
            <DesktopAuthFormSwitch key="login" switchKey="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="student-identifier" className={desktopAuth.label}>
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
                    <Label htmlFor="student-password" className={desktopAuth.label}>
                      Password
                    </Label>
                    <Link
                      href="/student/forgot-password"
                      className="text-[13px] font-medium text-[var(--cc-accent)] hover:text-[var(--cc-accent-dark)] hover:underline"
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
                  <Label htmlFor="remember-me" className="cursor-pointer text-[13px] font-normal text-[var(--cc-text-secondary)]">
                    Remember me
                  </Label>
                </div>
                <div className={desktopAuth.actionStack}>
                  <Button
                    type="submit"
                    disabled={loading}
                    className={cn(actionButtonClass, "rounded-md")}
                    style={{ backgroundColor: university.primary_color }}
                  >
                    {loading ? <Spinner size="sm" /> : "Login"}
                  </Button>
                  {backHref ? <DesktopAuthBackLink href={backHref} label={backLabel} className="mt-0" /> : null}
                </div>
                {mode === "login" && !info ? (
                  desktopLoginOnly ? (
                    <DesktopWebSignupLink
                      path={DESKTOP_WEB_SIGNUP_PATHS.student}
                      prompt="New student?"
                      label="Create account on web"
                    />
                  ) : (
                  <p className="mt-3 text-center text-[12px] text-[var(--cc-text-muted)]">
                    <button
                      type="button"
                      onClick={() => switchAuthMode("activate")}
                      className="font-medium text-[var(--cc-accent)] hover:underline"
                    >
                      Set password manually
                    </button>
                  </p>
                  )
                ) : null}
              </form>
            </DesktopAuthFormSwitch>
          ) : (
            <DesktopAuthFormSwitch key="activate" switchKey="activate">
              <form onSubmit={handleActivate} className="space-y-4">
                <div
                  className={cn(
                    alertClass,
                    "border border-amber-200/70 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 p-3 text-sm text-[var(--cc-text-secondary)]",
                  )}
                >
                  Only use this if your instructor did <strong className="font-semibold text-[var(--cc-text)]">not</strong>{" "}
                  enroll you or you were not sent a temporary password. Most students should{" "}
                  <button
                    type="button"
                    onClick={() => switchAuthMode("login")}
                    className="font-semibold text-[var(--cc-accent)] underline underline-offset-2"
                  >
                    sign in instead
                  </button>
                  .
                </div>
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
                <div className={desktopAuth.actionStack}>
                  <Button
                    type="submit"
                    disabled={loading}
                    className={cn(actionButtonClass, "rounded-md")}
                    style={{ backgroundColor: university.primary_color }}
                  >
                    {loading ? <Spinner size="sm" /> : "Activate & Sign In"}
                  </Button>
                  {backHref ? <DesktopAuthBackLink href={backHref} label={backLabel} className="mt-0" /> : null}
                </div>
              </form>
            </DesktopAuthFormSwitch>
          )}
        </AnimatePresence>
        </div>
      ) : mode === "login" ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="student-identifier" className={isDesktop ? desktopAuth.label : "text-[var(--cc-text)]"}>
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
              <Label htmlFor="student-password" className={isDesktop ? desktopAuth.label : "text-[var(--cc-text)]"}>
                Password
              </Label>
              <Link
                href="/student/forgot-password"
                className={cn(
                  "font-medium text-[var(--cc-accent)] hover:text-[var(--cc-accent-dark)] hover:underline",
                  isDesktop ? "text-[13px]" : "text-xs",
                )}
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

          <div className={desktopAuth.actionStack}>
            <Button
              type="submit"
              disabled={loading}
              className={actionButtonClass}
              style={{ backgroundColor: university.primary_color }}
            >
              {loading ? <Spinner size="sm" /> : "Login"}
            </Button>
            {backHref ? <DesktopAuthBackLink href={backHref} label={backLabel} className="mt-0" /> : null}
          </div>
          {!isDesktop && mode === "login" && !info ? (
            <p className="mt-3 text-center text-xs text-[var(--cc-text-muted)]">
              <button
                type="button"
                onClick={() => switchAuthMode("activate")}
                className="font-medium text-[var(--cc-accent)] underline underline-offset-2"
              >
                Set password manually
              </button>
            </p>
          ) : null}
        </form>
      ) : (
        <form onSubmit={handleActivate} className="space-y-4">
          <div
            className={cn(
              alertClass,
              "border border-amber-200/70 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 p-3 text-sm text-[var(--cc-text-secondary)]",
            )}
          >
            Only use this if your instructor did <strong className="font-semibold text-[var(--cc-text)]">not</strong>{" "}
            enroll you or you were not sent a temporary password. Most students should{" "}
            <button
              type="button"
              onClick={() => switchAuthMode("login")}
              className="font-semibold text-[var(--cc-accent)] underline underline-offset-2"
            >
              sign in instead
            </button>
            .
          </div>
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
          <div className={desktopAuth.actionStack}>
            <Button
              type="submit"
              disabled={loading}
              className={actionButtonClass}
              style={{ backgroundColor: university.primary_color }}
            >
              {loading ? <Spinner size="sm" /> : "Activate & Sign In"}
            </Button>
            {backHref ? <DesktopAuthBackLink href={backHref} label={backLabel} className="mt-0" /> : null}
          </div>
        </form>
      )}
    </>
  )

  if (isDesktop) {
    return (
      <DesktopAuthPanelBody>
        <DesktopAuthPanelCard>
          <DesktopAuthStagger className="space-y-5">{mainContent}</DesktopAuthStagger>
        </DesktopAuthPanelCard>
      </DesktopAuthPanelBody>
    )
  }

  return <div className="space-y-6">{mainContent}</div>
}
