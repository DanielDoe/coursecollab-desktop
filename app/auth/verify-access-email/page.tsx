"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, AlertCircle, Loader2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AccessStatusShell } from "@/components/auth/access-status-shell"
import {
  saveAccessStatusPayload,
  saveAccessStatusPortal,
  type AccessStatusPortal,
} from "@/lib/access-governance/access-status-session"
import { ACCESS_EMAIL_INBOX_HINT } from "@/lib/access-governance/email-inbox-hint"

function portalLoginHref(portal: AccessStatusPortal): string {
  switch (portal) {
    case "faculty":
      return "/faculty/login"
    case "guest":
      return "/guest"
    default:
      return "/student/login"
  }
}

export default function VerifyAccessEmailPage() {
  const params = useSearchParams()
  const token = params.get("token") ?? ""
  const portalParam = params.get("portal")
  const portal: AccessStatusPortal =
    portalParam === "faculty" || portalParam === "guest" ? portalParam : "student"
  const [state, setState] = useState<"loading" | "ok" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!token) {
      setState("error")
      setMessage("Missing verification token.")
      return
    }
    void (async () => {
      try {
        const res = await fetch("/api/access/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        })
        const data = await res.json()
        if (!res.ok) {
          setState("error")
          setMessage(data.error || "Verification failed.")
          return
        }
        setState("ok")
        setMessage("Your email is verified. We will notify you when your access request is reviewed.")
        saveAccessStatusPortal(portal)
        saveAccessStatusPayload({
          lifecycle: "pending_approval",
          request: { emailVerified: true },
        })
      } catch {
        setState("error")
        setMessage("Network error. Try again later.")
      }
    })()
  }, [token, portal])

  return (
    <AccessStatusShell cardClassName="text-center">
      {state === "loading" && (
        <>
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
            <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
          </div>
          <h1 className="mb-2 text-xl font-semibold text-[var(--cc-text)]">Verifying your email</h1>
          <p className="text-sm text-[var(--cc-text-secondary)]">This usually takes a moment…</p>
        </>
      )}

      {state === "ok" && (
        <>
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
            <CheckCircle2 className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="mb-2 text-xl font-semibold text-[var(--cc-text)]">Email verified</h1>
          <p className="mb-4 text-sm leading-relaxed text-[var(--cc-text-secondary)]">{message}</p>
          <div className="mb-6 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-surface)_86%,transparent)] px-4 py-3 text-left">
            <p className="text-sm leading-relaxed text-[var(--cc-text-secondary)]">
              {ACCESS_EMAIL_INBOX_HINT}
            </p>
          </div>
          <Button asChild className="w-full rounded-xl sm:w-auto">
            <Link href="/auth/access-pending">View request status</Link>
          </Button>
        </>
      )}

      {state === "error" && (
        <>
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <AlertCircle className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="mb-2 text-xl font-semibold text-[var(--cc-text)]">Verification failed</h1>
          <p className="mb-4 text-sm leading-relaxed text-[var(--cc-text-secondary)]">{message}</p>
          <div className="access-status-callout--amber mb-6 flex items-start gap-3 rounded-xl px-4 py-3 text-left">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
            <p className="text-sm leading-relaxed">{ACCESS_EMAIL_INBOX_HINT}</p>
          </div>
          <Button asChild variant="outline" className="access-status-action-outline w-full rounded-xl sm:w-auto">
            <Link href={portalLoginHref(portal)}>Back to sign in</Link>
          </Button>
        </>
      )}
    </AccessStatusShell>
  )
}
