"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { FacultyAccountSetupOverlay } from "@/components/faculty/FacultyAccountSetupOverlay"
import { Button } from "@/components/ui/button"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"
import {
  finalizeFacultyCourseSelection,
  findOfferingByKey,
  readFacultySession,
  saveFacultySession,
  enterFacultyDashboard,
  fetchFacultyOfferingsForSession,
} from "@/lib/faculty-auth-flow"
import type {
  FacultyAccountSetupStepId,
  FacultySetupCheck,
} from "@/lib/faculty-account-setup-shared"

type SetupStatus = "checking" | "running" | "ready" | "error" | "skipped"

export function FacultyAccountSetupScreen() {
  const router = useRouter()
  const [status, setStatus] = useState<SetupStatus>("checking")
  const [step, setStep] = useState<FacultyAccountSetupStepId>("verify_account")
  const [checks, setChecks] = useState<FacultySetupCheck[]>([])
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)

  const runSetup = useCallback(async () => {
    const session = readFacultySession()
    if (!session) {
      router.replace("/faculty/login")
      return
    }

    setStatus("running")
    setError(null)
    setStep("verify_account")

    const stepTimers = [
      { step: "load_courses" as const, delay: 400 },
      { step: "import_course" as const, delay: 900 },
      { step: "link_term" as const, delay: 1400 },
      { step: "sync_permissions" as const, delay: 1900 },
    ]
    const timers = stepTimers.map(({ step: s, delay }) =>
      window.setTimeout(() => setStep(s), delay),
    )

    try {
      const res = await fetch("/api/faculty/account-setup", {
        method: "POST",
        headers: buildInstructorApiHeaders(),
        credentials: "include",
      })
      const data = await res.json()
      timers.forEach(clearTimeout)

      setChecks(Array.isArray(data.checks) ? data.checks : [])
      if (!res.ok || !data.success) {
        setStep(data.step ?? "verify_account")
        setError(String(data.error ?? "Setup could not be completed."))
        setStatus("error")
        return
      }

      setStep("ready")
      setSummary(
        data.checks?.find((c: FacultySetupCheck) => c.id === "ready")?.detail ??
          "Your faculty account is ready.",
      )

      const key = data.recommendedOfferingKey as string | undefined
      if (key) {
        const { offerings } = await fetchFacultyOfferingsForSession()
        const offering = findOfferingByKey(offerings, key)
        if (offering) {
          const finalized = await finalizeFacultyCourseSelection(session, offering)
          saveFacultySession(finalized)
        }
      }

      setStatus("ready")
    } catch {
      timers.forEach(clearTimeout)
      setError("Network error while setting up your account.")
      setStatus("error")
    }
  }, [router])

  useEffect(() => {
    void (async () => {
      const session = readFacultySession()
      if (!session) {
        router.replace("/faculty/login")
        return
      }
      try {
        const res = await fetch("/api/faculty/account-setup", {
          headers: buildInstructorApiHeaders(),
          credentials: "include",
        })
        const data = await res.json()
        if (res.ok && data.needsSetup === false) {
          setStatus("skipped")
          router.replace("/faculty/dashboard")
          return
        }
      } catch {
        /* run setup anyway */
      }
      void runSetup()
    })()
  }, [router, runSetup])

  if (status === "skipped") return null

  if (status === "ready") {
    return (
      <div className="access-status-page cc-brand-surface cc-brand-auth flex min-h-[100dvh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-xl">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-600 dark:text-emerald-400" />
          <h1 className="mb-2 text-xl font-semibold text-[var(--cc-text)]">Account setup complete</h1>
          <p className="mb-6 text-sm text-[var(--cc-text-secondary)]">{summary}</p>
          <ul className="mb-6 space-y-2 rounded-xl border border-[var(--border)] px-4 py-3 text-left text-sm">
            {checks.map((check) => (
              <li key={check.id} className="flex items-center justify-between gap-3">
                <span className="text-[var(--cc-text-muted)]">{check.label}</span>
                <span
                  className={
                    check.ok
                      ? "font-medium text-emerald-700 dark:text-emerald-300"
                      : "font-medium text-red-600"
                  }
                >
                  {check.ok ? "OK" : "Issue"}
                </span>
              </li>
            ))}
          </ul>
          <Button
            className="w-full rounded-xl"
            onClick={() => {
              const session = readFacultySession()
              if (session) enterFacultyDashboard(router, session)
            }}
          >
            Continue to dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <FacultyAccountSetupOverlay
      visible={status === "checking" || status === "running" || status === "error"}
      activeStep={step}
      checks={checks}
      error={error}
      onRetry={runSetup}
    />
  )
}
