"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  GraduationCap,
  Loader2,
  Mail,
  Search,
  Sparkles,
  Users,
} from "lucide-react"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import { Button } from "@/components/ui/button"
import { DeviceDuo } from "@/components/landing/device-frames"
import { universityHasFullWordmark } from "@/components/auth/UniversityLogo"
import type { AccessRequestStatusPayload } from "@/components/auth/AccessRequestStatusPanel"
import { ACCESS_EMAIL_INBOX_HINT } from "@/lib/access-governance/email-inbox-hint"
import { courseUsesLabSections } from "@/lib/course-section-model"
import type { UniversityRecord } from "@/lib/universities-shared"
import { cn } from "@/lib/utils"
import {
  STUDENT_SIGNUP_DEVICE_DUO,
  STUDENT_SIGNUP_STEP_CAPTIONS,
  type StudentSignupStep,
} from "./student-signup-artwork"

type CatalogSection = {
  id: number
  code: string
  description: string | null
}

type CatalogCourse = {
  id: number
  courseCode: string
  courseTitle: string
  instructorName: string | null
  sections: CatalogSection[]
}

type Props = {
  university: UniversityRecord
}

const underlineInput =
  "mt-1.5 w-full border-0 border-b border-[#2b2140] bg-transparent px-1 py-1.5 text-lg font-semibold outline-none placeholder:font-normal placeholder:text-zinc-400 dark:border-[color-mix(in_srgb,var(--cc-accent)_45%,white)] dark:text-white dark:placeholder:text-zinc-500"

const headerBackClass =
  "inline-flex shrink-0 items-center gap-0.5 rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm font-semibold text-[#1c1826] shadow-sm transition-colors hover:bg-zinc-100 dark:border-white/30 dark:bg-white/10 dark:text-white dark:backdrop-blur-sm dark:hover:bg-white/15"

export function StudentSignupExperience({ university }: Props) {
  const accent = university.primary_color || "#582c83"

  const [step, setStep] = useState<StudentSignupStep>("course")
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [catalogError, setCatalogError] = useState("")
  const [activeTermLabel, setActiveTermLabel] = useState<string | null>(null)
  const [courses, setCourses] = useState<CatalogCourse[]>([])
  const [courseQuery, setCourseQuery] = useState("")
  const [selectedCourseId, setSelectedCourseId] = useState("")
  const [selectedSectionCode, setSelectedSectionCode] = useState("")
  const [fullName, setFullName] = useState("")
  const [studentId, setStudentId] = useState("")
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [accessStatus, setAccessStatus] = useState<AccessRequestStatusPayload | null>(null)

  const selectedCourse = useMemo(
    () => courses.find((c) => String(c.id) === selectedCourseId) ?? null,
    [courses, selectedCourseId],
  )

  const lectureSections = useMemo(() => selectedCourse?.sections ?? [], [selectedCourse])

  const showSectionStep = Boolean(
    selectedCourse && courseUsesLabSections(selectedCourse.courseCode) && lectureSections.length > 1,
  )

  const progressSteps = useMemo(
    () => (showSectionStep ? (["course", "section", "profile"] as const) : (["course", "profile"] as const)),
    [showSectionStep],
  )

  const progressIndex = step === "verify" ? progressSteps.length : Math.max(0, progressSteps.indexOf(step as (typeof progressSteps)[number]))

  const filteredCourses = useMemo(() => {
    const q = courseQuery.trim().toLowerCase()
    if (!q) return courses
    return courses.filter(
      (c) =>
        c.courseTitle.toLowerCase().includes(q) ||
        c.courseCode.toLowerCase().includes(q) ||
        (c.instructorName ?? "").toLowerCase().includes(q),
    )
  }, [courseQuery, courses])

  const stepCaption = STUDENT_SIGNUP_STEP_CAPTIONS[step]

  useEffect(() => {
    let mounted = true
    void (async () => {
      setLoadingCatalog(true)
      setCatalogError("")
      try {
        const res = await fetch(
          `/api/student/enrollment-catalog?universityId=${encodeURIComponent(String(university.id))}`,
        )
        const data = await res.json()
        if (!mounted) return
        if (!res.ok) throw new Error(data.error || "Failed to load courses")
        setCourses(Array.isArray(data.courses) ? data.courses : [])
        setActiveTermLabel(typeof data.activeTerm?.label === "string" ? data.activeTerm.label : null)
      } catch (err) {
        if (!mounted) return
        setCatalogError(err instanceof Error ? err.message : "Failed to load courses")
        setCourses([])
      } finally {
        if (mounted) setLoadingCatalog(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [university.id])

  useEffect(() => {
    if (!selectedCourse) {
      setSelectedSectionCode("")
      return
    }
    if (lectureSections.length === 1) {
      setSelectedSectionCode(lectureSections[0].code)
      return
    }
    setSelectedSectionCode((prev) =>
      prev && lectureSections.some((s) => s.code === prev) ? prev : "",
    )
  }, [selectedCourse, lectureSections])

  function goBack() {
    setError("")
    if (step === "verify") return
    if (step === "profile") {
      setStep(showSectionStep ? "section" : "course")
      return
    }
    if (step === "section") {
      setStep("course")
    }
  }

  function continueFromCourse() {
    setError("")
    if (!selectedCourse) {
      setError("Choose the course you want to join.")
      return
    }
    setStep(showSectionStep ? "section" : "profile")
  }

  function continueFromSection() {
    setError("")
    if (!selectedSectionCode.trim()) {
      setError("Choose your lecture section.")
      return
    }
    setStep("profile")
  }

  async function submitRequest() {
    setError("")
    if (!selectedCourse || !selectedSectionCode.trim()) {
      setError("Select your course and section.")
      return
    }
    if (!fullName.trim() || !studentId.trim() || !email.trim()) {
      setError("Complete every field.")
      return
    }
    if (!email.trim().includes("@")) {
      setError("Enter a valid university email.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/student/request-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          studentId: studentId.trim(),
          section: selectedSectionCode.trim(),
          email: email.trim(),
          universityId: university.id,
          courseId: selectedCourse.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not submit access request")

      setAccessStatus({
        lifecycle: "pending_email_verification",
        accountType: "student",
        request: {
          fullName: fullName.trim(),
          email: email.trim(),
          section: selectedSectionCode.trim(),
        },
      })
      setStep("verify")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your request.")
    } finally {
      setSubmitting(false)
    }
  }

  const stepEyebrow =
    step === "course"
      ? "Step 1 · Your class"
      : step === "section"
        ? "Step 2 · Your section"
        : step === "profile"
          ? `Step ${showSectionStep ? 3 : 2} · About you`
          : "Almost there"

  const stepTitle =
    step === "course"
      ? "Which course are you joining?"
      : step === "section"
        ? "Pick your lecture section"
        : step === "profile"
          ? "Tell us who you are"
          : "Check your inbox"

  return (
    <div
      className="cc-brand-surface flex min-h-[100dvh] flex-col bg-[#f4f2ee] text-[#1c1826] dark:bg-zinc-950 dark:text-white"
      style={
        {
          ["--student-signup-accent" as string]: accent,
        } as React.CSSProperties
      }
    >
      <header className="z-10 h-16 shrink-0 border-b border-black/[0.06] bg-white/90 backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/90">
        <div className="flex h-full w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
          <Link href="/" className="shrink-0" aria-label="CourseCollab home">
            <CourseCollabLogo
              size="sm"
              withWordmark
              className="shrink-0"
              wordmarkClassName="text-[#1c1826] dark:text-white"
            />
          </Link>
          {step === "verify" || step === "course" ? (
            <Link href="/auth/student" className={headerBackClass}>
              <ChevronLeft className="size-4" aria-hidden />
              Back
            </Link>
          ) : (
            <button type="button" onClick={goBack} className={headerBackClass}>
              <ChevronLeft className="size-4" aria-hidden />
              Back
            </button>
          )}
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 items-start overflow-x-clip px-4 py-5 sm:items-center sm:px-6 lg:overflow-visible lg:px-10 lg:pr-16 xl:pr-24">
        <div className="mx-auto flex w-full max-w-[84rem] items-center justify-center gap-6 xl:gap-10">
          <section className="relative z-10 flex w-full max-w-[32rem] shrink-0 flex-col rounded-[24px] border border-black/[0.04] bg-white p-5 shadow-[0_18px_48px_rgba(40,20,80,0.08)] sm:p-7 dark:border-white/10 dark:bg-zinc-900 dark:shadow-[0_18px_48px_rgba(0,0,0,0.35)]">
            <div key={step} className="cc-step-enter flex flex-1 flex-col">
              {step !== "verify" ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">{stepEyebrow}</p>
                  <h1 className="mt-2 text-[1.75rem] font-semibold tracking-tight text-[#1c1826] dark:text-white sm:text-[2.05rem]">
                    {stepTitle}
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-300">
                    {step === "course"
                      ? "Choose the course your instructor set up on CourseCollab. Your request goes directly to them for approval."
                      : step === "section"
                        ? "Select the section code from your syllabus so you join the right lecture group."
                        : "Use your roster name and university email. Your instructor uses these to confirm enrollment."}
                  </p>
                  {activeTermLabel ? (
                    <p className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-white/10 dark:bg-zinc-800/60 dark:text-zinc-300">
                      <Sparkles className="size-3.5" aria-hidden />
                      {activeTermLabel}
                    </p>
                  ) : null}

                  {!universityHasFullWordmark(university) ? (
                    <p
                      className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em]"
                      style={{ color: accent }}
                    >
                      {university.name}
                    </p>
                  ) : null}
                </>
              ) : null}

              {error ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                  <p>{error}</p>
                  {error.toLowerCase().includes("already exists") ? (
                    <p className="mt-2">
                      <Link href="/auth/student" className="font-semibold underline underline-offset-2">
                        Go to Sign in
                      </Link>
                    </p>
                  ) : null}
                </div>
              ) : null}

              {catalogError ? (
                <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                  {catalogError}
                </p>
              ) : null}

              {step === "course" ? (
                <div className="mt-6 space-y-4">
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                    <input
                      value={courseQuery}
                      onChange={(e) => setCourseQuery(e.target.value)}
                      placeholder="Search courses…"
                      className="h-11 w-full rounded-2xl border border-zinc-200 bg-zinc-50 pl-10 pr-3 text-sm outline-none transition-colors focus:border-[color-mix(in_srgb,var(--student-signup-accent)_40%,#d4d4d8)] dark:border-white/10 dark:bg-zinc-800/50 dark:text-white"
                    />
                  </label>

                  {loadingCatalog ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
                      <Loader2 className="size-4 animate-spin" />
                      Loading courses…
                    </div>
                  ) : filteredCourses.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                      No courses at {university.short_name ?? university.name} are open for requests right now.
                      Ask your instructor for an invitation link.
                    </div>
                  ) : (
                    <div className="max-h-[min(22rem,48vh)] space-y-2 overflow-y-auto pr-0.5">
                      {filteredCourses.map((course) => {
                        const active = String(course.id) === selectedCourseId
                        return (
                          <button
                            key={course.id}
                            type="button"
                            onClick={() => {
                              setSelectedCourseId(String(course.id))
                              setError("")
                            }}
                            className={cn(
                              "group flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all",
                              active
                                ? "border-[color-mix(in_srgb,var(--student-signup-accent)_45%,#d4d4d8)] bg-[color-mix(in_srgb,var(--student-signup-accent)_8%,white)] shadow-sm dark:bg-[color-mix(in_srgb,var(--student-signup-accent)_16%,#18181b)]"
                                : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900 dark:hover:bg-zinc-800/70",
                            )}
                          >
                            <span
                              className={cn(
                                "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
                                active ? "text-white" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
                              )}
                              style={active ? { backgroundColor: accent } : undefined}
                            >
                              <BookOpen className="size-4" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold text-[#1c1826] dark:text-white">
                                {course.courseTitle}
                              </span>
                              <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                                {course.courseCode}
                                {course.instructorName ? ` · ${course.instructorName}` : ""}
                              </span>
                              <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                                <Users className="size-3" aria-hidden />
                                {course.sections.length} section{course.sections.length === 1 ? "" : "s"}
                              </span>
                            </span>
                            {active ? (
                              <CheckCircle2 className="size-5 shrink-0" style={{ color: accent }} aria-hidden />
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : null}

              {step === "section" && selectedCourse ? (
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-zinc-800/40">
                    <p className="font-semibold text-[#1c1826] dark:text-white">{selectedCourse.courseTitle}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{selectedCourse.courseCode}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {lectureSections.map((section) => {
                      const active = selectedSectionCode === section.code
                      return (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => {
                            setSelectedSectionCode(section.code)
                            setError("")
                          }}
                          className={cn(
                            "rounded-2xl border px-4 py-4 text-left transition-all",
                            active
                              ? "border-[color-mix(in_srgb,var(--student-signup-accent)_45%,#d4d4d8)] bg-[color-mix(in_srgb,var(--student-signup-accent)_10%,white)] shadow-sm dark:bg-[color-mix(in_srgb,var(--student-signup-accent)_18%,#18181b)]"
                              : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900 dark:hover:bg-zinc-800/70",
                          )}
                        >
                          <span className="block text-lg font-semibold tracking-tight text-[#1c1826] dark:text-white">
                            {section.code}
                          </span>
                          {section.description && section.description !== section.code ? (
                            <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                              {section.description}
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {step === "profile" && selectedCourse ? (
                <div className="mt-6 space-y-5">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-[color-mix(in_srgb,var(--student-signup-accent)_32%,transparent)] dark:bg-[color-mix(in_srgb,var(--student-signup-accent)_14%,#18181b)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                      Joining
                    </p>
                    <p className="mt-1 font-semibold text-[#1c1826] dark:text-white">{selectedCourse.courseTitle}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">
                      {selectedCourse.courseCode}
                      {selectedSectionCode ? ` · ${selectedSectionCode}` : ""}
                    </p>
                  </div>

                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Full name</span>
                    <input
                      id="signup-full-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="As it appears on your roster"
                      className={underlineInput}
                      autoComplete="name"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">Student ID</span>
                    <input
                      id="signup-student-id"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="From your syllabus"
                      className={underlineInput}
                      autoComplete="off"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">
                      University email
                    </span>
                    <input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@school.edu"
                      className={underlineInput}
                      autoComplete="email"
                    />
                  </label>

                  <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                    After email verification, your instructor approves the request. Then sign in with your university
                    credentials.
                  </p>
                </div>
              ) : null}

              {step === "verify" && accessStatus ? (
                <div className="flex flex-col">
                  <div className="relative overflow-hidden rounded-[22px] border border-[color-mix(in_srgb,var(--student-signup-accent)_22%,#e4e4e7)] bg-gradient-to-br from-[color-mix(in_srgb,var(--student-signup-accent)_10%,white)] via-white to-zinc-50 p-5 dark:border-white/10 dark:from-[color-mix(in_srgb,var(--student-signup-accent)_18%,#09090b)] dark:via-zinc-900 dark:to-zinc-950 sm:p-6">
                    <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-[color-mix(in_srgb,var(--student-signup-accent)_16%,transparent)] blur-2xl" />
                    <div className="relative flex items-start gap-4">
                      <span
                        className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
                        style={{ background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 65%, #000))` }}
                      >
                        <Mail className="size-6 animate-pulse" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h1 className="text-2xl font-semibold tracking-tight text-[#1c1826] dark:text-white sm:text-[1.85rem]">
                            Verify your email
                          </h1>
                          <span className="rounded-full border border-amber-300/60 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100">
                            Student
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                          We sent a verification link to{" "}
                          <span className="font-semibold text-[#1c1826] dark:text-white">
                            {accessStatus.request?.email}
                          </span>
                          . Open it to continue — then your instructor can approve your enrollment.
                        </p>
                      </div>
                    </div>

                    <div className="relative mt-5 rounded-2xl border border-zinc-200/80 bg-white/80 px-4 py-3 backdrop-blur-sm dark:border-white/10 dark:bg-zinc-900/70">
                      <dl className="space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-zinc-500 dark:text-zinc-400">Name</dt>
                          <dd className="font-medium text-[#1c1826] dark:text-white">{accessStatus.request?.fullName}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-zinc-500 dark:text-zinc-400">Course / section</dt>
                          <dd className="font-medium text-[#1c1826] dark:text-white">{accessStatus.request?.section}</dd>
                        </div>
                      </dl>
                    </div>

                    <ol className="relative mt-5 space-y-3">
                      {[
                        { label: "Verify your email", done: false, active: true },
                        { label: "Instructor approval", done: false, active: false },
                        { label: "Sign in & activate", done: false, active: false },
                      ].map((item) => (
                        <li key={item.label} className="flex items-center gap-3 text-sm">
                          <span
                            className={cn(
                              "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                              item.active
                                ? "border-transparent text-white"
                                : "border-zinc-200 text-zinc-400 dark:border-white/10 dark:text-zinc-500",
                            )}
                            style={item.active ? { backgroundColor: accent } : undefined}
                          >
                            {item.done ? "✓" : item.active ? "1" : "·"}
                          </span>
                          <span
                            className={cn(
                              item.active
                                ? "font-semibold text-[#1c1826] dark:text-white"
                                : "text-zinc-500 dark:text-zinc-400",
                            )}
                          >
                            {item.label}
                          </span>
                        </li>
                      ))}
                    </ol>

                    <p className="relative mt-4 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2.5 text-xs leading-relaxed text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100">
                      {ACCESS_EMAIL_INBOX_HINT}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <Button asChild variant="outline" className="h-11 flex-1 rounded-full">
                      <Link href="/student/help">Help</Link>
                    </Button>
                    <Button
                      asChild
                      className="h-11 flex-1 rounded-full font-semibold text-white"
                      style={{ backgroundColor: accent }}
                    >
                      <Link href="/auth/student">Back to sign in</Link>
                    </Button>
                  </div>
                </div>
              ) : null}

              {step !== "verify" ? (
                <div className="mt-6 flex flex-col-reverse items-stretch gap-3 border-t border-zinc-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
                  {step === "course" ? (
                    <Link
                      href="/auth/university?change=1&next=signup"
                      className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                    >
                      Not your school?
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={goBack}
                      className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                    >
                      Back
                    </button>
                  )}

                  <Button
                    type="button"
                    disabled={
                      submitting ||
                      (step === "course" && (!selectedCourseId || loadingCatalog)) ||
                      (step === "section" && !selectedSectionCode)
                    }
                    className="h-12 rounded-full px-7 font-semibold text-white hover:opacity-95"
                    style={{ backgroundColor: accent }}
                    onClick={() => {
                      if (step === "course") continueFromCourse()
                      else if (step === "section") continueFromSection()
                      else void submitRequest()
                    }}
                  >
                    {submitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : step === "profile" ? (
                      <>
                        Submit access request
                        <ArrowRight className="ml-2 size-4" />
                      </>
                    ) : (
                      "Continue"
                    )}
                  </Button>
                </div>
              ) : null}
            </div>
          </section>

          <aside className="cc-art-enter pointer-events-none relative hidden min-w-0 flex-1 lg:block">
            <div
              className="pointer-events-none absolute inset-x-[-8%] top-[6%] bottom-[-2%] rounded-full blur-3xl"
              style={{
                background: `radial-gradient(closest-side, color-mix(in srgb, ${accent} 20%, transparent), transparent 72%)`,
              }}
              aria-hidden
            />
            <div className="relative flex min-h-[min(520px,72vh)] flex-col justify-center pl-2 pr-2 xl:pl-6 xl:pr-4">
              <div className="mb-5 flex items-start gap-2.5 text-sm text-zinc-500 dark:text-zinc-400">
                <GraduationCap className="mt-0.5 size-4 shrink-0" style={{ color: accent }} aria-hidden />
                <p className="max-w-sm leading-relaxed">{stepCaption}</p>
              </div>
              {/* Same DeviceDuo pairing as the career-member wizard — one composition,
                  larger flex footprint, no per-step image swaps. */}
              <DeviceDuo
                web={STUDENT_SIGNUP_DEVICE_DUO.web}
                phone={STUDENT_SIGNUP_DEVICE_DUO.phone}
                overlap
                webSizes="(max-width: 1280px) 42vw, 680px"
                phoneSizes="(max-width: 1280px) 13vw, 200px"
              />
            </div>
          </aside>
        </div>
      </main>

      {step !== "verify" ? (
        <div
          className="pointer-events-none z-10 flex shrink-0 justify-center pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          aria-hidden
        >
          <div className="flex w-[7.5rem] gap-2 sm:w-40">
            {progressSteps.map((s, i) => (
              <div
                key={s}
                className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-600"
              >
                <span
                  className="absolute inset-0 origin-left rounded-full bg-[#1c1826] transition-transform duration-500 ease-out motion-reduce:transition-none dark:bg-white"
                  style={{ transform: `scaleX(${i <= progressIndex ? 1 : 0})` }}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
