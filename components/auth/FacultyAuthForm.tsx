"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { UniversityLogo, universityHasFullWordmark } from "@/components/auth/UniversityLogo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-context"
import type { UniversityRecord } from "@/lib/universities-shared"
import { cn } from "@/lib/utils"
import { ctaInkOnFill } from "@/lib/appearance/chrome-ink"
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  User,
} from "lucide-react"
import { CcBookLoader } from "@/components/ui/cc-book-loader"
import { Spinner } from "@/components/ui/spinner"
import {
  clearRememberedFacultyAuth,
  persistRememberedFacultyAuth,
  readRememberedFacultyCourseKey,
  readRememberedFacultyLogin,
} from "@/lib/remembered-auth"
import {
  applyFacultySkipCourseScope,
  facultyCourseSelectValue,
  facultyOfferingKey,
} from "@/lib/faculty-course-session-sync"
import type { FacultyCourseOffering } from "@/lib/faculty-course-offerings-shared"
import { staffRoleLabel } from "@/lib/faculty-portal-nav-config"
import { appendNativeAppQuery } from "@/lib/mobile-native-app"
import {
  enterFacultyDashboard,
  fetchFacultyOfferingsForSession,
  finalizeFacultyCourseSelection,
  findOfferingByKey,
  formatFacultyOfferingLabel,
  readFacultySession,
  tryAutoProceedAfterFacultyLogin,
} from "@/lib/faculty-auth-flow"
import { clearFacultyExplicitSignOutFlag } from "@/lib/faculty-session-restore-client"
import { effectiveRememberMeForClient, isDesktopAppShell } from "@/lib/desktop-auth-policy"
import {
  DesktopAuthPanelBody,
  DesktopAuthPanelCard,
  DesktopAuthStepProgress,
  DesktopAuthUniversityHeader,
  desktopAuth,
} from "@/components/auth/desktop-auth-primitives"
import { DesktopAuthStagger } from "@/components/auth/desktop-auth-motion"
import { MfaLoginStep, parseMfaLoginResponse, type MfaLoginState } from "@/components/auth/MfaLoginStep"

type WizardStep = "login" | "course"

type Props = {
  university: UniversityRecord
  initialStep?: WizardStep
  nativeApp?: boolean
  expired?: boolean
  signedOut?: boolean
  variant?: "default" | "desktop"
  backHref?: string
  backLabel?: string
}

/** Keep trailing Roman numerals (e.g. "Engineering I") on the same line in narrow cards. */
function facultyCourseTitleDisplay(title: string): string {
  return title.replace(/\s+([IVXLCDM]+)$/i, "\u00A0$1")
}

const stepMotion = {
  initial: { opacity: 0.92, x: '16%' },
  animate: { opacity: 1, x: 0, pointerEvents: 'auto' as const },
  exit: { opacity: 0.88, x: '-10%', pointerEvents: 'none' as const },
}

function StepIndicator({ step, accent }: { step: WizardStep; accent: string }) {
  const steps = [
    { id: "login" as const, label: "Sign in", icon: KeyRound },
    { id: "course" as const, label: "Choose course", icon: BookOpen },
  ]
  const currentIndex = step === "login" ? 0 : 1
  const ink = ctaInkOnFill(accent)

  return (
    <ol className="flex items-center justify-center gap-3 sm:gap-4" aria-label="Sign-in progress">
      {steps.map((item, index) => {
        const current = index === currentIndex
        const done = index < currentIndex
        const Icon = item.icon
        return (
          <li key={item.id} className="flex items-center gap-3 sm:gap-4">
            <div className="flex flex-col items-center gap-1.5 min-w-[5.25rem]">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border shadow-sm",
                  current
                    ? "border-transparent"
                    : done
                      ? "border-transparent bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                      : "border-[var(--border)] bg-[var(--cc-surface)] text-[var(--cc-text-muted)]",
                )}
                style={current ? { backgroundColor: accent, color: ink } : undefined}
                aria-current={current ? "step" : undefined}
              >
                <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              </span>
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-[0.12em] text-center",
                  current
                    ? "text-[var(--cc-text)]"
                    : done
                      ? "text-[var(--cc-accent)]"
                      : "text-[var(--cc-text-muted)]",
                )}
              >
                {item.label}
              </span>
            </div>
            {index < steps.length - 1 ? (
              <div className="mb-5 h-px w-10 sm:w-14 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{
                    backgroundColor: accent,
                    width: done ? "100%" : "0%",
                  }}
                />
              </div>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function FacultyOtherSignInNav({ backHref }: { backHref: string }) {
  const portalHub = isDesktopAppShell() ? "/auth/welcome?change=1" : "/auth/university?change=1"

  return (
    <div className="border-t border-[var(--border)] pt-4">
      <p className="text-center text-[12px] leading-relaxed text-[var(--cc-text-secondary)]">
        <Link href="/auth/student" className="font-semibold text-[var(--cc-accent)] hover:underline">
          Student sign in
        </Link>
        <span aria-hidden className="mx-1.5 text-[var(--cc-text-muted)]">
          ·
        </span>
        <Link href={backHref} className="font-medium text-[var(--cc-accent)] hover:underline">
          Change university
        </Link>
        <span aria-hidden className="mx-1.5 text-[var(--cc-text-muted)]">
          ·
        </span>
        <Link href={portalHub} className="font-medium text-[var(--cc-accent)] hover:underline">
          More options
        </Link>
      </p>
    </div>
  )
}

export function FacultyAuthForm({
  university,
  initialStep = "login",
  nativeApp = false,
  expired,
  signedOut,
  variant = "default",
  backHref,
  backLabel = "Back",
}: Props) {
  const router = useRouter()
  const { setSelectedUniversity } = useAuth()
  const [step, setStep] = useState<WizardStep>(initialStep)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState<boolean>(() => readRememberedFacultyLogin()?.rememberMe ?? true)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [offerings, setOfferings] = useState<FacultyCourseOffering[]>([])
  const [activeTermLabel, setActiveTermLabel] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState("")
  const [coursesLoading, setCoursesLoading] = useState(false)
  const [mfaState, setMfaState] = useState<MfaLoginState | null>(null)

  const accent = university.primary_color || "#582c83"
  const accentInk = ctaInkOnFill(accent)
  const isDesktop = variant === "desktop"
  const resolvedBackHref = backHref ?? "/auth/university?change=1&next=faculty"
  const loginRememberMe = effectiveRememberMeForClient(rememberMe)
  const inputClass = isDesktop
    ? desktopAuth.input
    : "h-12 rounded-xl border-[var(--border)] bg-[var(--cc-background)] pl-11 text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] shadow-none focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]/35"
  const inputWithIconClass = isDesktop
    ? inputClass
    : cn(inputClass, "pl-11")
  const actionButtonClass = isDesktop
    ? desktopAuth.button
    : "h-12 w-full gap-2 rounded-xl font-semibold shadow-sm"
  const alertClass = isDesktop ? desktopAuth.alert : "rounded-xl"

  useEffect(() => {
    const remembered = readRememberedFacultyLogin()
    if (remembered?.username) setUsername(remembered.username)
    if (signedOut) setPassword("")
  }, [signedOut])

  const loadCourseStep = useCallback(async () => {
    const session = readFacultySession()
    if (!session) {
      setStep("login")
      return
    }
    setCoursesLoading(true)
    setError("")
    try {
      const data = await fetchFacultyOfferingsForSession()
      setOfferings(data.offerings)
      setActiveTermLabel(data.activeTermLabel)
      const rememberedKey = readRememberedFacultyCourseKey() ?? facultyCourseSelectValue(session)
      if (rememberedKey && findOfferingByKey(data.offerings, rememberedKey)) {
        setSelectedKey(rememberedKey)
      } else if (data.offerings.length === 1) {
        setSelectedKey(
          facultyOfferingKey(
            data.offerings[0].course_id,
            data.offerings[0].academic_term_id ?? null,
            data.offerings[0].session_id ?? null,
          ),
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load courses")
    } finally {
      setCoursesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (signedOut) return
    if (initialStep === "course") {
      void loadCourseStep()
      return
    }
    const session = readFacultySession()
    if (
      session &&
      !session.requiresPasswordChange &&
      session.hasChangedPassword !== false &&
      session.selectedCourseId == null &&
      session.courseScopeSkipped !== true
    ) {
      setStep("course")
      void loadCourseStep()
    }
  }, [initialStep, loadCourseStep, signedOut])

  const selectedOffering = useMemo(
    () => (selectedKey ? findOfferingByKey(offerings, selectedKey) : undefined),
    [offerings, selectedKey],
  )

  const persistRemembered = useCallback(
    (courseKey?: string | null) => {
      const didRemember = effectiveRememberMeForClient(rememberMe)
      persistRememberedFacultyAuth({
        university,
        username: username.trim(),
        rememberMe: didRemember,
        courseKey: didRemember ? courseKey : null,
      })
    },
    [rememberMe, university, username],
  )

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError("Enter your username and password.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await instructorApiFetch("/api/instructor/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: username.trim(),
          password,
          rememberMe: loginRememberMe,
          universityId: university.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Login failed")

      const mfa = parseMfaLoginResponse(data as Record<string, unknown>)
      if (mfa) {
        setMfaState(mfa)
        return
      }

      const session = (data.faculty ?? data.instructor) as Record<string, unknown>
      clearFacultyExplicitSignOutFlag()
      setSelectedUniversity(university)
      const sessionWithUniversity = {
        ...session,
        selectedUniversityId: university.id,
      }
      persistRemembered(readRememberedFacultyCourseKey())

      const outcome = await tryAutoProceedAfterFacultyLogin(router, sessionWithUniversity, { nativeApp })
      if (outcome === "course") {
        setStep("course")
        await loadCourseStep()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  const handleCourseContinue = async () => {
    if (!selectedKey || !selectedOffering) {
      setError("Choose a course to continue, or skip to enter without a course.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const session = readFacultySession()
      if (!session) {
        setStep("login")
        return
      }
      const finalized = await finalizeFacultyCourseSelection(session, selectedOffering)
      persistRemembered(selectedKey)
      enterFacultyDashboard(router, finalized, { nativeApp })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save selection")
      setLoading(false)
    }
  }

  const handleSkipCourse = () => {
    setLoading(true)
    setError("")
    try {
      const session = readFacultySession()
      if (!session) {
        setStep("login")
        return
      }
      const skipped = applyFacultySkipCourseScope(session)
      persistRemembered(null)
      enterFacultyDashboard(router, skipped, { nativeApp })
    } catch {
      setError("Could not continue")
      setLoading(false)
    }
  }

  const proceedAfterMfa = async (data: Record<string, unknown>) => {
    setMfaState(null)
    const session = (data.faculty ?? data.instructor) as Record<string, unknown>
    clearFacultyExplicitSignOutFlag()
    setSelectedUniversity(university)
    const sessionWithUniversity = {
      ...session,
      selectedUniversityId: university.id,
    }
    persistRemembered(readRememberedFacultyCourseKey())
    const outcome = await tryAutoProceedAfterFacultyLogin(router, sessionWithUniversity, { nativeApp })
    if (outcome === "course") {
      setStep("course")
      await loadCourseStep()
    }
  }

  if (mfaState) {
    return (
      <div className="space-y-6">
        <MfaLoginStep
          state={mfaState}
          portalLabel={`${university.short_name ?? university.name} Faculty`}
          onBack={() => setMfaState(null)}
          onComplete={(data) => void proceedAfterMfa(data)}
        />
      </div>
    )
  }

  const panelContent = (
    <div
      className={cn(
        step === "course" && nativeApp && "flex min-h-0 flex-1 flex-col",
        isDesktop && step === "course"
          ? "flex min-h-0 flex-1 flex-col gap-5 overflow-hidden"
          : cn("space-y-5", isDesktop && "space-y-5"),
      )}
    >
      {!isDesktop ? (
      <div className="flex flex-col items-center gap-4 text-center">
        <UniversityLogo university={university} size="md" variant="full" />
        <div className="space-y-1.5">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ backgroundColor: `${accent}18`, color: accent }}
          >
            Faculty portal
          </span>
          {!universityHasFullWordmark(university) ? (
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
              {university.short_name}
            </p>
          ) : null}
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--cc-text)]">Faculty sign in</h2>
          <p className="text-sm text-[var(--cc-text-secondary)]">
            {universityHasFullWordmark(university)
              ? "Continue to your courses and teaching tools."
              : university.name}
          </p>
        </div>
      </div>
      ) : null}

      {isDesktop ? (
        <DesktopAuthUniversityHeader
          className={step === "course" ? "mb-0 shrink-0" : undefined}
          media={<UniversityLogo university={university} size="md" variant="compact" />}
          name={university.name}
          hint={
            step === "login"
              ? "Continue to your courses and teaching tools."
              : undefined
          }
        />
      ) : null}

      {isDesktop ? (
        <DesktopAuthStepProgress
          className={step === "course" ? "shrink-0" : undefined}
          step={step === "login" ? 1 : 2}
          total={2}
          label={step === "login" ? "Sign in" : "Choose course"}
        />
      ) : (
        <StepIndicator step={step} accent={accent} />
      )}

      {expired ? (
        <div
          className={cn(
            alertClass,
            isDesktop
              ? cn(desktopAuth.alert, desktopAuth.alertWarning)
              : cn("border p-3 text-sm", desktopAuth.alertWarning),
            "flex items-start gap-2",
          )}
          role="status"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <span>Your session expired. Please sign in again.</span>
        </div>
      ) : null}

      {error ? (
        <div
          className={cn(
            alertClass,
            isDesktop
              ? cn(desktopAuth.alert, desktopAuth.alertError)
              : cn("border p-3 text-sm", desktopAuth.alertError),
            "flex items-start gap-2",
          )}
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      <div
        className={cn(
          "relative overflow-x-clip",
          isDesktop && step === "course" && "flex min-h-0 flex-1 flex-col overflow-hidden",
        )}
      >
      <AnimatePresence mode="popLayout" initial={false}>
        {step === "login" ? (
          <motion.div
            key="login"
            {...stepMotion}
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            className="space-y-4"
          >
            <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="faculty-username" className={isDesktop ? desktopAuth.label : "text-[var(--cc-text)]"}>
                  Username
                </Label>
                <div className="relative">
                  {!isDesktop ? (
                  <User
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  ) : null}
                  <Input
                    id="faculty-username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    className={inputWithIconClass}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="faculty-password" className={isDesktop ? desktopAuth.label : "text-[var(--cc-text)]"}>
                    Password
                  </Label>
                  <Link
                    href="/instructor/help"
                    className={cn(
                      "font-medium text-[var(--cc-accent)] hover:text-[var(--cc-accent-dark)] hover:underline",
                      isDesktop ? "text-[13px]" : "text-xs",
                    )}
                  >
                    Need help?
                  </Link>
                </div>
                <div className="relative">
                  {!isDesktop ? (
                  <Lock
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  ) : null}
                  <Input
                    id="faculty-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn(inputWithIconClass, "pr-11")}
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
                  id="faculty-remember-me"
                  checked={rememberMe}
                  onCheckedChange={(v) => {
                    const next = v === true
                    setRememberMe(next)
                    if (!next) clearRememberedFacultyAuth()
                  }}
                />
                <Label htmlFor="faculty-remember-me" className="cursor-pointer text-[13px] font-normal text-[var(--cc-text-secondary)]">
                  Remember me
                </Label>
              </div>

              <div className={desktopAuth.actionStack}>
                <Button
                  type="submit"
                  disabled={loading}
                  className={cn(actionButtonClass, isDesktop && "rounded-md")}
                  style={{ backgroundColor: accent, color: accentInk }}
                >
                  {loading ? <Spinner size="sm" /> : "Continue"}
                  {!loading && !isDesktop ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
                </Button>
              </div>
            </form>

            <FacultyOtherSignInNav backHref={resolvedBackHref} />
          </motion.div>
        ) : (
          <motion.div
            key="course"
            {...stepMotion}
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
          >
            <div className="shrink-0 space-y-1 text-center">
              <h3 className="text-lg font-bold text-[var(--cc-text)]">Select a course</h3>
              <p className="text-sm text-[var(--cc-text-secondary)]">
                {coursesLoading
                  ? "Loading your courses…"
                  : offerings.length === 0
                    ? "No courses assigned yet. Skip to open the dashboard and add one later."
                    : activeTermLabel
                      ? `Courses in ${activeTermLabel} appear first. You can change course anytime from the header.`
                      : "Choose a course to scope your tools. You can change it later in the app."}
              </p>
            </div>

            <div
              className={cn(
                "min-h-0 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]",
                isDesktop
                  ? "max-h-[min(15rem,34dvh)] rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-background)_50%,var(--cc-surface))] p-3 [scrollbar-gutter:stable]"
                  : "flex-1",
              )}
            >
              <div className="space-y-2.5">
                {coursesLoading ? (
                  <div className="flex justify-center py-8">
                    <CcBookLoader size="md" label="Loading courses" />
                  </div>
                ) : (
                  offerings.map((offering) => {
                    const key = facultyOfferingKey(
                      offering.course_id,
                      offering.academic_term_id ?? null,
                      offering.session_id ?? null,
                    )
                    const active = selectedKey === key
                    return (
                      <motion.button
                        key={key}
                        type="button"
                        layout
                        whileHover={
                          active
                            ? { y: -1, scale: 1.005 }
                            : {
                                y: -3,
                                scale: 1.015,
                                boxShadow:
                                  "0 10px 28px -12px color-mix(in srgb, var(--cc-accent) 55%, transparent), 0 0 0 1px color-mix(in srgb, var(--cc-accent) 28%, transparent)",
                              }
                        }
                        whileTap={{ y: 0, scale: 0.985 }}
                        transition={{ type: "spring", stiffness: 420, damping: 28, mass: 0.7 }}
                        disabled={loading}
                        onClick={() => setSelectedKey(key)}
                        className={cn(
                          "group w-full border-2 px-4 py-3.5 text-left",
                          isDesktop ? "rounded-[10px]" : "rounded-2xl",
                          "transition-[border-color,background-color,box-shadow] duration-200 ease-out",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]",
                          active
                            ? "border-[var(--cc-accent)] bg-[color-mix(in_srgb,var(--cc-accent)_10%,var(--cc-surface))] shadow-md ring-1 ring-[color-mix(in_srgb,var(--cc-accent)_35%,transparent)]"
                            : "border-[var(--border)] bg-[var(--card)] hover:border-[color-mix(in_srgb,var(--cc-accent)_55%,var(--border))] hover:bg-[color-mix(in_srgb,var(--cc-accent)_6%,var(--card))]",
                        )}
                      >
                        <span className="relative block">
                          <ChevronRight
                            aria-hidden
                            className={cn(
                              "pointer-events-none absolute right-0 top-0.5 h-4 w-4 text-[var(--cc-accent)] transition-all duration-200 ease-out",
                              active
                                ? "translate-x-0 opacity-100"
                                : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-70",
                            )}
                          />
                          <span className="block pr-5 font-semibold text-pretty leading-snug text-[var(--cc-text)] transition-colors duration-200 group-hover:text-[var(--cc-accent)]">
                            {facultyCourseTitleDisplay(offering.course_title)}
                          </span>
                          <span className="mt-1 block text-xs text-[var(--cc-text-secondary)]">
                            {formatFacultyOfferingLabel(offering)}
                          </span>
                          {offering.staff_role ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "mt-2 rounded-lg border-[var(--border)] bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]",
                                "group-hover:border-[color-mix(in_srgb,var(--cc-accent)_40%,var(--border))] group-hover:text-[var(--cc-accent)]",
                              )}
                            >
                              {staffRoleLabel(offering.staff_role)}
                            </Badge>
                          ) : null}
                        </span>
                      </motion.button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="shrink-0 space-y-2 border-t border-[var(--border)] bg-[var(--cc-surface)] pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || coursesLoading}
                  onClick={handleSkipCourse}
                  className={cn(
                    "flex-1 border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)]",
                    isDesktop ? "h-10 rounded-md" : "h-12 rounded-2xl",
                  )}
                >
                  Skip for now
                </Button>
                <Button
                  type="button"
                  disabled={loading || coursesLoading || !selectedKey}
                  onClick={() => void handleCourseContinue()}
                  className={cn(
                    "flex-1 gap-2 font-semibold shadow-sm !text-white",
                    isDesktop ? cn(desktopAuth.button, "w-auto flex-1 rounded-md") : "h-12 rounded-xl",
                  )}
                  style={{ backgroundColor: accent, color: "#FFFFFF" }}
                >
                  {loading ? <Spinner size="sm" /> : "Open dashboard"}
                  {!loading && !isDesktop ? <ArrowRight className="h-4 w-4" /> : null}
                </Button>
              </div>

              <button
                type="button"
                onClick={() => setStep("login")}
                className="flex h-9 w-full items-center justify-center text-[13px] font-medium text-[var(--cc-text-secondary)] hover:bg-[var(--cc-accent-soft)] hover:text-[var(--cc-text)] rounded-md"
              >
                Back to sign in
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  )

  if (isDesktop) {
    const courseStepLayout = step === "course"

    return (
      <DesktopAuthPanelBody
        className={courseStepLayout ? "min-h-0 justify-start overflow-hidden" : undefined}
      >
        <DesktopAuthPanelCard
          className={
            courseStepLayout
              ? "flex max-h-[min(calc(100dvh-12rem),44rem)] min-h-0 flex-col overflow-hidden"
              : undefined
          }
        >
          {courseStepLayout ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{panelContent}</div>
          ) : (
            <DesktopAuthStagger className="space-y-5">{panelContent}</DesktopAuthStagger>
          )}
        </DesktopAuthPanelCard>
      </DesktopAuthPanelBody>
    )
  }

  return panelContent
}
