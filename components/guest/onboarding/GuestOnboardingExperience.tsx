"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Briefcase,
  Check,
  FileImage,
  FileText,
  Lock,
  Mail,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DeviceDuo } from "@/components/landing/device-frames"
import { DesktopAuthBackLink, desktopAuth } from "@/components/auth/desktop-auth-primitives"
import { DesktopWebSignupLink } from "@/components/auth/DesktopWebSignupLink"
import { DESKTOP_WEB_SIGNUP_PATHS, isDesktopAuthLoginOnly } from "@/lib/desktop-auth-policy"
import { MfaLoginStep, parseMfaLoginResponse, type MfaLoginState } from "@/components/auth/MfaLoginStep"
import {
  parseAccessLifecycleFromLoginError,
} from "@/components/auth/AccessRequestStatusPanel"
import { redirectToAccessStatusPage } from "@/lib/access-governance/access-status-session"
import { setStudentSession } from "@/lib/auth"
import { CAREER_MEMBER_ACCOUNT, CAREER_MEMBER_PORTAL, CAREER_MEMBER_WORKSPACE } from "@/lib/guest/display"
import { isOtherUniversity, readSessionSelectedUniversity } from "@/lib/universities-shared"
import {
  GUEST_OCCUPATION_OPTIONS,
  GUEST_ONBOARDING_OPTIONS,
  normalizeGuestOnboardingPurpose,
  type GuestOccupation,
} from "@/lib/guest/onboarding"
import { cn } from "@/lib/utils"
import { GUEST_RESUME_ACCEPT, isAllowedGuestResumeFile } from "@/lib/guest/career/resume-file"

type Mode = "create" | "signin"
type CreateStep = "intro" | "about" | "account" | "resume" | "ready"

const STEPS: CreateStep[] = ["intro", "about", "account", "resume"]

function applyGuestSession(
  data: { student: Record<string, unknown>; guestAccessPurpose?: string },
  router: ReturnType<typeof useRouter>,
) {
  const s = data.student
  const gp = normalizeGuestOnboardingPurpose(data.guestAccessPurpose ?? s.guest_access_purpose)
  setStudentSession({
    id: String(s.student_id),
    name: String(s.full_name),
    section: String(s.section ?? "GUEST"),
    databaseId: String(s.id),
    isPlatformGuest: true,
    guestAccessPurpose: gp,
  })
  router.push("/guest")
}

const underlineSelect =
  "h-auto w-auto min-w-[9.5rem] rounded-none border-0 border-b border-[#2b2140] bg-transparent px-0 py-0.5 text-base font-semibold text-[#2b2140] shadow-none focus:ring-0 dark:border-[color-mix(in_srgb,var(--cc-accent)_45%,white)] dark:text-white"

function InlineSelect({
  value,
  onValueChange,
  placeholder,
  options,
}: {
  value: string
  onValueChange: (v: string) => void
  placeholder: string
  options: { id: string; label: string }[]
}) {
  return (
    <Select value={value || undefined} onValueChange={onValueChange}>
      <SelectTrigger className={cn(underlineSelect, "[&>svg]:opacity-40")}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function GuestOnboardingExperience({
  variant = "default",
  backHref,
  backLabel = "Back",
}: {
  variant?: "default" | "desktop"
  backHref?: string
  backLabel?: string
}) {
  const router = useRouter()
  const isDesktop = variant === "desktop"
  const desktopLoginOnly = isDesktopAuthLoginOnly(variant)
  const guestEyebrow = isDesktop
    ? "text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--cc-text-secondary)]"
    : "text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400"
  const guestTitle = isDesktop
    ? desktopAuth.title
    : "text-3xl font-semibold tracking-tight text-[#1c1826] dark:text-white sm:text-[2.15rem]"
  const guestSubtitle = isDesktop
    ? desktopAuth.subtitle
    : "text-sm text-zinc-500 dark:text-zinc-300"
  const guestFieldInput = isDesktop
    ? "mt-1.5 h-10 w-full rounded-md border border-[var(--border)] bg-[var(--cc-surface)] px-3 text-[14px] text-[var(--cc-text)] outline-none placeholder:text-[var(--cc-text-muted)] focus:border-[var(--cc-accent)] focus:ring-1 focus:ring-[var(--cc-accent)]/30"
    : "mt-1.5 w-full border-0 border-b border-[#2b2140] bg-transparent px-1 py-1.5 text-lg font-semibold outline-none placeholder:font-normal placeholder:text-zinc-400 dark:border-[color-mix(in_srgb,var(--cc-accent)_45%,white)]"
  const guestInlineInput = isDesktop
    ? "min-w-[8rem] border-0 border-b border-[var(--border)] bg-transparent px-1 py-0.5 text-[15px] font-medium text-[var(--cc-text)] outline-none placeholder:text-[var(--cc-text-muted)] focus:border-[var(--cc-accent)]"
    : "border-0 border-b border-[#2b2140] bg-transparent px-1 py-0.5 font-semibold text-[#1c1826] outline-none placeholder:font-normal placeholder:text-zinc-400 dark:border-[color-mix(in_srgb,var(--cc-accent)_45%,white)] dark:text-white dark:placeholder:text-zinc-500"
  const guestFooterBorder = isDesktop ? "border-[var(--border)]" : "border-zinc-100 dark:border-white/10"
  const [mode, setMode] = useState<Mode>(desktopLoginOnly ? "signin" : "create")
  const [step, setStep] = useState<CreateStep>("intro")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [mfaState, setMfaState] = useState<MfaLoginState | null>(null)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [occupation, setOccupation] = useState<GuestOccupation | "">("")
  const [organization, setOrganization] = useState(() => {
    const uni = readSessionSelectedUniversity()
    if (!uni || isOtherUniversity(uni)) return ""
    return uni.name
  })
  const [purpose, setPurpose] = useState("career_application")
  const [purposeNote, setPurposeNote] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [resumeText, setResumeText] = useState("")
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [showResumePaste, setShowResumePaste] = useState(false)

  const stepIndex = Math.max(0, STEPS.indexOf(step))
  const greeting = firstName.trim() || "there"

  const purposeSentence = useMemo(() => {
    const opt = GUEST_ONBOARDING_OPTIONS.find((o) => o.id === purpose)
    return opt?.label.toLowerCase() ?? "career support"
  }, [purpose])

  if (mfaState) {
    if (isDesktop) {
      return (
        <MfaLoginStep
          state={mfaState}
          portalLabel={CAREER_MEMBER_PORTAL}
          onBack={() => setMfaState(null)}
          onComplete={(data) => {
            setMfaState(null)
            applyGuestSession(data as { student: Record<string, unknown>; guestAccessPurpose?: string }, router)
          }}
        />
      )
    }
    return (
      <div className="cc-brand-surface flex min-h-[100dvh] items-center justify-center bg-[#f4f2ee] p-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-sm">
          <MfaLoginStep
            state={mfaState}
            portalLabel={CAREER_MEMBER_PORTAL}
            onBack={() => setMfaState(null)}
            onComplete={(data) => {
              setMfaState(null)
              applyGuestSession(data as { student: Record<string, unknown>; guestAccessPurpose?: string }, router)
            }}
          />
        </div>
      </div>
    )
  }

  function goNextFromIntro() {
    setError("")
    if (!firstName.trim() || !lastName.trim()) {
      setError("Tell us your first and last name.")
      return
    }
    setStep("about")
  }

  function goNextFromAbout() {
    setError("")
    if (!occupation) {
      setError("Choose how you’d describe yourself.")
      return
    }
    if (!organization.trim()) {
      setError("Add your school, company, or organization.")
      return
    }
    if (purpose === "other_academic" && purposeNote.trim().length < 2) {
      setError("Add a short note about what you need.")
      return
    }
    setStep("account")
  }

  async function finishAccountAndResume() {
    setError("")
    setLoading(true)
    try {
      const form = new FormData()
      form.set("firstName", firstName.trim())
      form.set("lastName", lastName.trim())
      form.set("occupation", occupation)
      form.set("organization", organization.trim())
      form.set("purpose", purpose)
      if (purpose === "other_academic") form.set("purposeNote", purposeNote.trim())
      form.set("email", email.trim())
      form.set("password", password)
      if (resumeText.trim()) form.set("resumeText", resumeText.trim())
      const universityId = readSessionSelectedUniversity()?.id
      if (universityId) form.set("universityId", String(universityId))
      if (resumeFile) form.set("resume", resumeFile)
      const res = await fetch("/api/guest/register", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not create account")
      setPassword("")
      setPasswordConfirm("")
      if (data.pendingApproval) {
        redirectToAccessStatusPage(
          router,
          {
            lifecycle: "pending_approval",
            accountType: "career_member",
            request: {
              fullName: `${firstName} ${lastName}`.trim(),
              email,
              organization,
              emailVerified: false,
            },
          },
          "guest",
        )
        return
      }
      setStep("ready")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create account")
    } finally {
      setLoading(false)
    }
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!email.includes("@") || !password) {
      setError("Email and password are required.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/guest/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        const lifecycle = parseAccessLifecycleFromLoginError(data)
        if (lifecycle && redirectToAccessStatusPage(router, lifecycle, "guest")) {
          return
        }
        throw new Error(data.error || "Sign in failed")
      }
      const mfa = parseMfaLoginResponse(data as Record<string, unknown>)
      if (mfa) {
        setMfaState(mfa)
        return
      }
      applyGuestSession(data, router)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed")
    } finally {
      setLoading(false)
    }
  }

  function onResumeFile(file: File | null) {
    if (!file) return
    const allowed = isAllowedGuestResumeFile({ name: file.name, type: file.type, size: file.size })
    if (!allowed.ok) {
      setError(allowed.error)
      return
    }
    setError("")
    setResumeFile(file)
  }

  return (
    <div
      className={cn(
        isDesktop
          ? "flex w-full flex-col text-[var(--cc-text)]"
          : "cc-brand-surface flex min-h-[100dvh] flex-col bg-[#f4f2ee] text-[#1c1826] dark:bg-zinc-950 dark:text-white",
      )}
    >
      {!isDesktop ? (
      <header className="z-10 h-16 shrink-0 border-b border-black/[0.06] bg-white dark:border-white/10 dark:bg-zinc-900">
        <div className="flex h-full items-center px-4 sm:px-6">
          <Link href="/" className="shrink-0" aria-label="CourseCollab home">
            <CourseCollabLogo
              size="sm"
              withWordmark
              className="shrink-0"
              wordmarkClassName="text-[#1c1826] dark:text-white"
            />
          </Link>
          <span className="mx-3 hidden h-4 w-px bg-zinc-200 sm:block dark:bg-zinc-700" aria-hidden />
          <span className="hidden text-[15px] text-zinc-500 dark:text-zinc-400 sm:inline">Getting to know you</span>
        </div>
      </header>
      ) : null}

      <main
        className={cn(
          isDesktop
            ? "flex flex-col"
            : "relative flex min-h-0 flex-1 items-start overflow-hidden px-4 py-5 sm:items-center sm:px-6 lg:px-10",
        )}
      >
        <div
          className={cn(
            isDesktop ? "w-full" : "mx-auto flex w-full max-w-[84rem] items-center justify-center gap-6 xl:gap-10",
          )}
        >
        <section
          className={cn(
            isDesktop
              ? "flex w-full flex-col"
              : "relative z-10 flex w-full max-w-[28rem] shrink-0 flex-col rounded-[22px] border border-black/[0.04] bg-white p-5 shadow-[0_14px_36px_rgba(40,20,80,0.06)] sm:p-6 dark:border-white/10 dark:bg-zinc-900",
          )}
        >
          {isDesktop ? (
            <>
              <div className="mb-5 flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]">
                  <Briefcase className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 space-y-1">
                  <h1 className={guestTitle}>Career Member</h1>
                  <p className={guestSubtitle}>
                    Sign in to your career workspace.
                  </p>
                </div>
              </div>
              {!desktopLoginOnly ? (
              <div className="mb-6 grid grid-cols-2 gap-1 rounded-[10px] border border-[var(--border)] bg-[var(--cc-surface)] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setError("")
                    setMode("create")
                    setStep("intro")
                  }}
                  className={cn(
                    "h-9 rounded-[8px] text-[13px] font-medium transition-colors",
                    mode === "create"
                      ? "bg-[var(--cc-accent-soft)] text-[var(--cc-text)]"
                      : "text-[var(--cc-text-secondary)] hover:text-[var(--cc-text)]",
                  )}
                >
                  Create account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError("")
                    setMode("signin")
                  }}
                  className={cn(
                    "h-9 rounded-[8px] text-[13px] font-medium transition-colors",
                    mode === "signin"
                      ? "bg-[var(--cc-accent-soft)] text-[var(--cc-text)]"
                      : "text-[var(--cc-text-secondary)] hover:text-[var(--cc-text)]",
                  )}
                >
                  Sign in
                </button>
              </div>
              ) : null}
            </>
          ) : null}
          {mode === "signin" ? (
            <form onSubmit={signIn} className="flex flex-col">
              {/* Matches the create-account intro: small uppercase eyebrow, large
                  headline, borderless underlined fields. This pane used to run a
                  different visual language entirely — gradient avatar badge,
                  rounded-2xl boxed inputs with leading icons, and a 3-up chip
                  grid — which read as a separate product beside "Start here". */}
              {!isDesktop ? (
              <p className={guestEyebrow}>
                Welcome back
              </p>
              ) : null}
              {!isDesktop ? (
              <h1
                className={cn("mt-2", guestTitle)}
              >
                Good to see you again.
              </h1>
              ) : null}
              {!isDesktop ? (
              <p className={cn("mt-2", guestSubtitle)}>
                Sign in to your {CAREER_MEMBER_WORKSPACE}.
              </p>
              ) : null}

              <div className={cn(isDesktop ? "space-y-4" : "mt-9 space-y-6")}>
                <label className="block">
                  {!isDesktop ? (
                  <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">
                    Email
                  </span>
                  ) : (
                  <span className="text-[13px] font-medium text-[var(--cc-text)]">Email</span>
                  )}
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={guestFieldInput}
                    autoComplete="email"
                    required
                  />
                </label>

                <label className="block">
                  {!isDesktop ? (
                  <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">
                    Password
                  </span>
                  ) : (
                  <span className="text-[13px] font-medium text-[var(--cc-text)]">Password</span>
                  )}
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={guestFieldInput}
                    autoComplete="current-password"
                    required
                  />
                </label>
              </div>

              <Link
                href="/student/forgot-password/guest"
                className={cn(
                  "mt-3 self-start font-medium underline-offset-4 transition-colors hover:underline",
                  isDesktop
                    ? "text-[13px] text-[var(--cc-text-muted)] hover:text-[var(--cc-text-secondary)]"
                    : "text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white",
                )}
              >
                Forgot password?
              </Link>

              {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

              <div className={cn(isDesktop ? desktopAuth.actionStack : "mt-8 space-y-3")}>
                <Button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    "font-semibold text-white",
                    isDesktop
                      ? "h-10 w-full rounded-md bg-[var(--cc-accent)] px-4 hover:bg-[var(--cc-accent-hover)]"
                      : "h-12 w-full rounded-full bg-[#1c1826] px-7 hover:bg-black dark:bg-white dark:text-[#1c1826] dark:hover:bg-zinc-100",
                  )}
                >
                  {loading ? <Spinner size="sm" /> : "Sign in"}
                </Button>
                {backHref ? <DesktopAuthBackLink href={backHref} label={backLabel} className="mt-0" /> : null}
                {!isDesktop ? (
                  <p className="mt-3 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    New here?{" "}
                    <button
                      type="button"
                      className="font-medium text-zinc-700 underline underline-offset-2 transition-colors hover:text-zinc-900 dark:text-zinc-200 dark:hover:text-white"
                      onClick={() => {
                        setError("")
                        setMode("create")
                        setStep("intro")
                      }}
                    >
                      Create an account
                    </button>
                  </p>
                ) : null}
                {desktopLoginOnly ? (
                  <DesktopWebSignupLink
                    path={DESKTOP_WEB_SIGNUP_PATHS.careerMember}
                    prompt="New here?"
                    label="Create account on web"
                  />
                ) : null}
              </div>
            </form>
          ) : (
            <div key={step} className="cc-step-enter flex flex-1 flex-col">
              {step === "intro" ? (
                <>
                  {!isDesktop ? (
                  <p className={guestEyebrow}>Start here</p>
                  ) : null}
                  {!isDesktop ? (
                  <h2 className={cn("mt-2", guestTitle)}>
                    Welcome. Let’s get a quick intro.
                  </h2>
                  ) : null}
                  <p className={cn(isDesktop ? "mt-0" : "mt-2", guestSubtitle)}>
                    Anyone can create a {CAREER_MEMBER_ACCOUNT}. Faculty only review recommendation letter requests.
                  </p>
                  <p className={cn("mt-8 leading-relaxed", isDesktop ? "text-[15px] text-[var(--cc-text)]" : "mt-10 text-lg text-[#2b2140] dark:text-zinc-100")}>
                    Hi, I’m{" "}
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="first name"
                      className={cn(guestInlineInput, isDesktop ? "w-32" : "w-32")}
                      autoComplete="given-name"
                    />{" "}
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="last name"
                      className={cn(guestInlineInput, isDesktop ? "w-36" : "w-36")}
                      autoComplete="family-name"
                    />
                    .
                  </p>
                </>
              ) : null}

              {step === "about" ? (
                <>
                  <h1 className="text-3xl font-semibold tracking-tight text-[#1c1826] dark:text-white sm:text-[2.15rem]">
                    Welcome {greeting}, a little about you
                  </h1>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-300">
                    This helps Cora set up recommendations and career tools around your next step.
                  </p>
                  <div className="mt-8 space-y-6 text-lg leading-relaxed text-[#2b2140] dark:text-zinc-100">
                    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-3">
                      <span>I’m currently a</span>
                      <InlineSelect
                        value={occupation}
                        onValueChange={(v) => setOccupation(v as GuestOccupation)}
                        placeholder="status"
                        options={GUEST_OCCUPATION_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
                      />
                      <span>at</span>
                      <input
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        placeholder="school or organization"
                        className="min-w-[12rem] flex-1 border-0 border-b border-[#2b2140] bg-transparent px-1 py-0.5 font-semibold outline-none placeholder:font-normal placeholder:text-zinc-400 dark:border-[color-mix(in_srgb,var(--cc-accent)_45%,white)]"
                        autoComplete="organization"
                      />
                      .
                    </p>
                    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-3">
                      <span>I’ll use this account for</span>
                      <InlineSelect
                        value={purpose}
                        onValueChange={setPurpose}
                        placeholder="purpose"
                        options={GUEST_ONBOARDING_OPTIONS.map((o) => ({ id: o.id, label: o.label.toLowerCase() }))}
                      />
                      .
                    </p>
                    {purpose === "other_academic" ? (
                      <Textarea
                        value={purposeNote}
                        onChange={(e) => setPurposeNote(e.target.value)}
                        placeholder="A sentence about what you need…"
                        className="min-h-[88px] rounded-2xl text-sm"
                      />
                    ) : null}
                  </div>
                </>
              ) : null}

              {step === "account" ? (
                <>
                  <div className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--cc-accent)] to-[var(--cc-accent-dark)] text-white shadow-md shadow-[color-mix(in_srgb,var(--cc-accent)_25%,transparent)]">
                    <Lock className="size-5" aria-hidden />
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight text-[#1c1826] dark:text-white">Create your login, {greeting}</h1>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-300">
                    Career Member accounts are separate from student and faculty logins — use your school email if you want.
                  </p>
                  <div className="mt-5 space-y-2.5">
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email address"
                        className="h-12 rounded-2xl pl-10"
                        autoComplete="email"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                        <Input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password"
                          className="h-12 rounded-2xl pl-10"
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                        <Input
                          type="password"
                          value={passwordConfirm}
                          onChange={(e) => setPasswordConfirm(e.target.value)}
                          placeholder="Confirm password"
                          className="h-12 rounded-2xl pl-10"
                          autoComplete="new-password"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
                      {[
                        { ok: password.length >= 8, label: "8+ characters" },
                        { ok: Boolean(password) && password === passwordConfirm, label: "Passwords match" },
                        { ok: email.includes("@") && email.includes("."), label: "Valid email" },
                      ].map(({ ok, label }) => (
                        <span
                          key={label}
                          className={cn(
                            "inline-flex items-center gap-1 text-xs transition-colors",
                            ok ? "font-medium text-emerald-600" : "text-zinc-400",
                          )}
                        >
                          <Check className={cn("size-3.5", !ok && "opacity-40")} aria-hidden />
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-5 flex items-start gap-2.5 rounded-2xl bg-zinc-50 px-3.5 py-3 dark:bg-zinc-800/50">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--cc-accent)] dark:text-[color-mix(in_srgb,var(--cc-accent)_40%,white)]" aria-hidden />
                    <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Your account is private. Faculty only ever see the recommendation requests you send them —
                      never your career tools, scans, or documents.
                    </p>
                  </div>
                </>
              ) : null}

              {step === "resume" ? (
                <>
                  <h1 className="text-2xl font-semibold tracking-tight text-[#1c1826] dark:text-white">Add your résumé, {greeting}</h1>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-300">
                    Cora stores the original file and reads it automatically — no pasting needed.
                  </p>
                  <label
                    className="group mt-4 flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--cc-accent-border)] bg-gradient-to-b from-[color-mix(in_srgb,var(--cc-accent)_8%,transparent)] to-[color-mix(in_srgb,var(--cc-accent)_6%,transparent)] px-4 py-6 text-center transition-colors hover:border-[var(--cc-accent)] dark:border-[color-mix(in_srgb,var(--cc-accent)_45%,transparent)] dark:from-[color-mix(in_srgb,var(--cc-accent)_18%,transparent)] dark:to-[color-mix(in_srgb,var(--cc-accent)_10%,transparent)]"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      onResumeFile(e.dataTransfer.files?.[0] ?? null)
                    }}
                  >
                    <span className="mb-2.5 flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--cc-accent)] to-[var(--cc-accent-dark)] text-white shadow-md shadow-[color-mix(in_srgb,var(--cc-accent)_25%,transparent)] transition-transform group-hover:scale-110">
                      <UploadCloud className="size-5" aria-hidden />
                    </span>
                    <span className="text-sm text-[#2b2140] dark:text-zinc-100">
                      Drop your résumé here or <span className="font-semibold text-[var(--cc-accent)] dark:text-[color-mix(in_srgb,var(--cc-accent)_40%,white)]">browse files</span>
                    </span>
                    <span className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                      {["PDF", "Word", "Image", ".txt"].map((kind) => (
                        <span
                          key={kind}
                          className="rounded-md border border-[var(--cc-accent-border)] bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-[var(--cc-accent)] dark:border-[color-mix(in_srgb,var(--cc-accent)_40%,transparent)] dark:bg-[color-mix(in_srgb,var(--cc-accent)_20%,transparent)] dark:text-[color-mix(in_srgb,var(--cc-accent)_40%,white)]"
                        >
                          {kind}
                        </span>
                      ))}
                    </span>
                    <span className="mt-1.5 text-[11px] text-zinc-500">Up to 12 MB</span>
                    <input
                      type="file"
                      accept={GUEST_RESUME_ACCEPT}
                      className="hidden"
                      onChange={(e) => {
                        onResumeFile(e.target.files?.[0] ?? null)
                        e.target.value = ""
                      }}
                    />
                  </label>
                  {resumeFile ? (
                    <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/25">
                      {/\.(png|jpe?g|webp|gif|heic)$/i.test(resumeFile.name) ? (
                        <FileImage className="size-4 shrink-0 text-emerald-600" aria-hidden />
                      ) : (
                        <FileText className="size-4 shrink-0 text-emerald-600" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1 truncate font-medium text-[#2b2140] dark:text-zinc-100">
                        {resumeFile.name}
                      </span>
                      <button
                        type="button"
                        className="rounded-md p-0.5 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300"
                        aria-label="Remove résumé file"
                        onClick={() => setResumeFile(null)}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : null}
                  {showResumePaste || resumeText ? (
                    <Textarea
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
                      placeholder="Optional: paste extra notes or a text résumé"
                      className="mt-2 min-h-[72px] rounded-xl text-sm"
                    />
                  ) : (
                    <button
                      type="button"
                      className="mt-2 text-left text-xs font-medium text-zinc-500 hover:text-zinc-800"
                      onClick={() => setShowResumePaste(true)}
                    >
                      Paste text instead
                    </button>
                  )}
                </>
              ) : null}

              {step === "ready" ? (
                <>
                  <h1 className="text-3xl font-semibold tracking-tight text-[#1c1826] dark:text-white sm:text-[2.15rem]">You're in, {greeting}.</h1>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-300">
                    Your {CAREER_MEMBER_ACCOUNT} is ready. Sign in to open the workspace and start {purposeSentence}.
                    Faculty will only review recommendation letters you request.
                  </p>
                  <div className="mt-8 rounded-2xl bg-zinc-50 px-4 py-3 text-sm dark:bg-zinc-800/50">
                    Sign in with <span className="font-semibold">{email}</span>
                  </div>
                </>
              ) : null}

              {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

              <div className={cn("mt-5 flex flex-col-reverse items-stretch gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between", guestFooterBorder)}>
                {step === "intro" && !isDesktop ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                    onClick={() => {
                      setError("")
                      setMode("signin")
                    }}
                  >
                    I already have an account
                  </button>
                ) : step === "ready" ? (
                  <button type="button" className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white" onClick={() => setMode("signin")}>
                    Use a different email
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                    onClick={() => {
                      setError("")
                      if (step === "about") setStep("intro")
                      else if (step === "account") setStep("about")
                      else if (step === "resume") setStep("account")
                    }}
                  >
                    Back
                  </button>
                )}

                <Button
                  type="button"
                  disabled={loading}
                  className={cn(
                    "font-semibold text-white",
                    isDesktop
                      ? "h-10 rounded-lg bg-[var(--cc-accent)] px-4 hover:bg-[var(--cc-accent-hover)]"
                      : "h-12 rounded-full bg-[#1c1826] px-7 hover:bg-black dark:bg-white dark:text-[#1c1826] dark:hover:bg-zinc-100",
                  )}
                  onClick={() => {
                    if (step === "intro") goNextFromIntro()
                    else if (step === "about") goNextFromAbout()
                    else if (step === "account") {
                      setError("")
                      if (!email.includes("@")) setError("Enter a valid email.")
                      else if (password.length < 8) setError("Password must be at least 8 characters.")
                      else if (password !== passwordConfirm) setError("Passwords do not match.")
                      else setStep("resume")
                    }
                    else if (step === "resume") void finishAccountAndResume()
                    else {
                      setMode("signin")
                    }
                  }}
                >
                  {loading ? <Spinner size="sm" /> : step === "intro" ? (
                    "Continue"
                  ) : step === "about" ? (
                    "Continue"
                  ) : step === "account" ? (
                    "Continue"
                  ) : step === "resume" ? (
                    resumeFile || resumeText.trim() ? "Finish with résumé" : "Skip for now"
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </div>
            </div>
          )}
        </section>

          <aside className={cn("cc-art-enter pointer-events-none hidden min-w-0 flex-1 lg:block", isDesktop && "!hidden")}>
            {/* Same phone + PC pairing the landing page uses for Career AI, via the
                shared DeviceDuo, so the composition and device proportions match
                across the site rather than being tuned separately here. */}
            <DeviceDuo
              web={{
                src: "/images/landing/web/web-career-match.png",
                alt: "Cora Career resume match report on the web, showing a match score, skill bars, top improvements and evidence-backed keyword matches",
                width: 1600,
                height: 1000,
              }}
              phone={{
                src: "/images/landing/cora/career-resume-match.png",
                alt: "Resume Match on mobile with the master resume, opportunity description and recent scan scores",
                width: 640,
                height: 1349,
              }}
              overlap
              webSizes="(max-width: 1280px) 40vw, 640px"
              phoneSizes="(max-width: 1280px) 12vw, 190px"
            />
          </aside>
        </div>
      </main>

      {/* Step indicator. The shell is a flex column with <main> as flex-1, so a
          sibling here sits on the bottom edge without absolute positioning.
          Padded for the iOS home indicator. */}
      {mode === "create" && step !== "ready" ? (
        <div
          className={cn(
            "pointer-events-none z-10 flex shrink-0 justify-center",
            isDesktop ? "pt-4" : "pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))]",
          )}
          aria-hidden
        >
          <div className="flex w-[7.5rem] gap-2 sm:w-36">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-600"
              >
                {/* Fills left-to-right as the step is reached, and unwinds on Back.
                    scaleX rather than a colour swap so the change reads as motion. */}
                <span
                  className="absolute inset-0 origin-left rounded-full bg-[#1c1826] transition-transform duration-500 ease-out motion-reduce:transition-none dark:bg-white"
                  style={{ transform: `scaleX(${i <= stepIndex ? 1 : 0})` }}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
