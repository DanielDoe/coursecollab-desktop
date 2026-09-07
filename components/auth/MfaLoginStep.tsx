"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import {
  AlertCircle,
  ArrowRight,
  Check,
  Copy,
  ShieldCheck,
  Smartphone,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CcBookLoader } from "@/components/ui/cc-book-loader"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { captureRefreshTokenFromResponse, withDesktopRefreshInit } from "@/lib/desktop-refresh-token"

export type MfaLoginState = {
  challengeToken: string
  requiresSetup: boolean
}

type EnrollData = {
  qrDataUrl: string
  manualKey: string
  accountName: string
  issuer: string
}

type Props = {
  state: MfaLoginState
  portalLabel?: string
  onComplete: (data: Record<string, unknown>) => void | Promise<void>
  onBack: () => void
  className?: string
}

const MIN_COMPLETE_SPLASH_MS = 450
const AUTH_APPS = ["Google Authenticator", "Authy", "1Password"]

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-[var(--border)]" />
      <span className="shrink-0 text-xs font-medium text-[var(--cc-text-muted)]">{label}</span>
      <div className="h-px flex-1 bg-[var(--border)]" />
    </div>
  )
}

const btnPrimary =
  "h-10 w-full rounded-lg bg-[var(--cc-accent)] text-white hover:bg-[var(--cc-accent-hover)] font-semibold text-[14px]"
const btnOutline =
  "h-10 w-full rounded-lg border-[var(--border)] bg-transparent text-[var(--cc-text-secondary)] hover:bg-[var(--cc-accent-soft)] text-[13px] font-medium"

function normalizeCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6)
}

async function holdCompleteLoginSplash(startedAt: number) {
  const elapsed = Date.now() - startedAt
  if (elapsed < MIN_COMPLETE_SPLASH_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_COMPLETE_SPLASH_MS - elapsed))
  }
}

export function AuthProgressPanel({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 sm:py-14" aria-live="polite" aria-busy="true">
      <CcBookLoader size="md" label={label} />
      <div className="text-center space-y-1">
        <p className="text-[14px] font-semibold text-[var(--cc-text)]">{label}</p>
        <p className="text-[13px] text-[var(--cc-text-muted)]">This usually takes a moment…</p>
      </div>
    </div>
  )
}

export { holdCompleteLoginSplash }

export function MfaLoginStep({ state, portalLabel = "CourseCollab", onComplete, onBack, className }: Props) {
  const [enroll, setEnroll] = useState<EnrollData | null>(null)
  const [code, setCode] = useState("")
  const [recoveryCode, setRecoveryCode] = useState("")
  const [useRecovery, setUseRecovery] = useState(false)
  const [preparingQr, setPreparingQr] = useState(false)
  const [authenticating, setAuthenticating] = useState(false)
  const [completingLogin, setCompletingLogin] = useState(false)
  const [error, setError] = useState("")
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [copied, setCopied] = useState<"key" | "codes" | null>(null)
  const [showManualKey, setShowManualKey] = useState(false)
  const submitLock = useRef(false)
  const codeInputRef = useRef<HTMLInputElement>(null)

  const loadEnrollment = useCallback(async () => {
    setPreparingQr(true)
    setError("")
    try {
      const res = await fetch("/api/auth/mfa/enroll/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken: state.challengeToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not start setup")
      setEnroll(data as EnrollData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed")
    } finally {
      setPreparingQr(false)
    }
  }, [state.challengeToken])

  useEffect(() => {
    if (state.requiresSetup) void loadEnrollment()
  }, [state.requiresSetup, loadEnrollment])

  const submitVerify = useCallback(async () => {
    if (submitLock.current) return
    submitLock.current = true
    setAuthenticating(true)
    setError("")
    try {
      const res = await fetch(
        "/api/auth/mfa/verify",
        withDesktopRefreshInit({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            challengeToken: state.challengeToken,
            code: useRecovery ? undefined : code,
            recoveryCode: useRecovery ? recoveryCode : undefined,
          }),
        }),
      )
      captureRefreshTokenFromResponse(res)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Invalid code")
      setCompletingLogin(true)
      const startedAt = Date.now()
      await Promise.resolve(onComplete(data as Record<string, unknown>))
      await holdCompleteLoginSplash(startedAt)
    } catch (err) {
      setCompletingLogin(false)
      setAuthenticating(false)
      setCode("")
      setError(err instanceof Error ? err.message : "Verification failed")
      requestAnimationFrame(() => codeInputRef.current?.focus())
    } finally {
      submitLock.current = false
    }
  }, [code, onComplete, recoveryCode, state.challengeToken, useRecovery])

  const submitEnroll = useCallback(async () => {
    if (submitLock.current) return
    submitLock.current = true
    setAuthenticating(true)
    setError("")
    try {
      const res = await fetch(
        "/api/auth/mfa/enroll/confirm",
        withDesktopRefreshInit({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ challengeToken: state.challengeToken, code }),
        }),
      )
      captureRefreshTokenFromResponse(res)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Invalid code")
      if (Array.isArray(data.recoveryCodes) && data.recoveryCodes.length > 0) {
        setRecoveryCodes(data.recoveryCodes as string[])
        ;(window as unknown as { __mfaLoginPayload?: Record<string, unknown> }).__mfaLoginPayload = data
      } else {
        setCompletingLogin(true)
        const startedAt = Date.now()
        await Promise.resolve(onComplete(data as Record<string, unknown>))
        await holdCompleteLoginSplash(startedAt)
      }
    } catch (err) {
      setCompletingLogin(false)
      setAuthenticating(false)
      setCode("")
      setError(err instanceof Error ? err.message : "Setup failed")
      requestAnimationFrame(() => codeInputRef.current?.focus())
    } finally {
      submitLock.current = false
    }
  }, [code, onComplete, state.challengeToken])

  const runSubmit = useCallback(() => {
    if (useRecovery) {
      if (!recoveryCode.trim()) return
      void submitVerify()
      return
    }
    if (code.length !== 6) return
    void (state.requiresSetup ? submitEnroll() : submitVerify())
  }, [code.length, recoveryCode, state.requiresSetup, submitEnroll, submitVerify, useRecovery])

  // Auto-submit when 6 digits entered (authenticator code only)
  useEffect(() => {
    if (useRecovery || authenticating || submitLock.current) return
    if (code.length !== 6) return
    if (state.requiresSetup && !enroll) return
    runSubmit()
  }, [authenticating, code, enroll, runSubmit, state.requiresSetup, useRecovery])

  const finishAfterRecoveryCodes = async () => {
    const payload = (window as unknown as { __mfaLoginPayload?: Record<string, unknown> }).__mfaLoginPayload
    delete (window as unknown as { __mfaLoginPayload?: Record<string, unknown> }).__mfaLoginPayload
    if (!payload) return
    setAuthenticating(true)
    setCompletingLogin(true)
    const startedAt = Date.now()
    try {
      await Promise.resolve(onComplete(payload))
      await holdCompleteLoginSplash(startedAt)
    } catch (err) {
      setCompletingLogin(false)
      setAuthenticating(false)
      setError(err instanceof Error ? err.message : "Login failed")
    }
  }

  const copyText = async (text: string, kind: "key" | "codes") => {
    await navigator.clipboard.writeText(text)
    setCopied(kind)
    setTimeout(() => setCopied(null), 2000)
  }

  if (recoveryCodes) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </span>
            <h2 className="text-lg font-bold text-[var(--cc-text)]">Save your backup codes</h2>
          </div>
          <p className="text-sm text-center text-[var(--cc-text-secondary)] leading-snug max-w-sm mx-auto">
            Each code works once — store them now. This device is trusted for 1 week; change in Settings → Security.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-4 font-mono text-sm text-[var(--cc-text)]">
          {recoveryCodes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" className={btnOutline} onClick={() => void copyText(recoveryCodes.join("\n"), "codes")}>
            {copied === "codes" ? <Check className="mr-2 h-4 w-4 text-emerald-600" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied === "codes" ? "Copied" : "Copy all codes"}
          </Button>
          <Button type="button" className={btnPrimary} onClick={() => void finishAfterRecoveryCodes()}>
            Continue to dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  if (authenticating) {
    return (
      <div className={cn(className)}>
        <AuthProgressPanel
          label={
            completingLogin
              ? "Logging in…"
              : state.requiresSetup
                ? "Setting up two-factor…"
                : "Authenticating…"
          }
        />
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-1.5">
        <div className="flex items-center justify-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--cc-accent-soft)]">
            <ShieldCheck className="h-4 w-4 text-[var(--cc-accent)]" />
          </span>
          <h2 className="text-lg font-bold text-[var(--cc-text)]">
            {state.requiresSetup ? "Set up authenticator" : "Verify it’s you"}
          </h2>
        </div>
        <p className="text-sm text-center text-[var(--cc-text-secondary)] leading-snug max-w-sm mx-auto">
          {state.requiresSetup
            ? `Scan the QR code, then enter the 6-digit code to finish enabling two-factor for ${portalLabel}.`
            : "Enter the 6-digit code from your authenticator. This device can be trusted — change duration in Settings."}
        </p>
      </div>

      {state.requiresSetup ? (
        <>
          {preparingQr && !enroll ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CcBookLoader size="sm" label="Preparing QR code" />
              <p className="text-sm text-[var(--cc-text-muted)]">Preparing QR code…</p>
            </div>
          ) : null}

          {enroll ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                <div className="rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-black/5 shrink-0">
                  <Image
                    src={enroll.qrDataUrl}
                    alt="Scan with authenticator app"
                    width={152}
                    height={152}
                    unoptimized
                  />
                </div>
                <div className="flex-1 space-y-2 text-center sm:text-left min-w-0">
                  <p className="flex items-center justify-center sm:justify-start gap-1.5 text-sm font-medium text-[var(--cc-text)]">
                    <Smartphone className="h-4 w-4 text-[var(--cc-accent)]" />
                    Scan with your authenticator
                  </p>
                  <p className="text-xs text-[var(--cc-text-muted)]">
                    Add account → scan QR. Works with {AUTH_APPS.join(", ")}.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowManualKey((v) => !v)}
                    className="text-xs font-medium text-[var(--cc-accent)] hover:underline"
                  >
                    {showManualKey ? "Hide setup key" : "Can’t scan? Use setup key"}
                  </button>
                  <p className="text-xs text-[var(--cc-text-muted)] leading-snug pt-1">
                    After setup, this device is trusted for 1 week by default. Change how long in Settings → Security.
                  </p>
                </div>
              </div>

              {showManualKey ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/15 p-3 space-y-2">
                  <p className="text-xs text-[var(--cc-text-muted)]">
                    Account: <span className="text-[var(--cc-text)]">{enroll.accountName}</span>
                  </p>
                  <div className="flex gap-2">
                    <code className="flex-1 break-all rounded-lg bg-[var(--cc-surface)] px-3 py-2 text-xs font-mono">
                      {enroll.manualKey}
                    </code>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 shrink-0 rounded-lg"
                      onClick={() => void copyText(enroll.manualKey, "key")}
                    >
                      {copied === "key" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {state.requiresSetup && !useRecovery ? (
        <SectionDivider label="Enter the 6-digit code" />
      ) : null}

      {!useRecovery ? (
        <div className="space-y-2">
          {!state.requiresSetup ? (
            <Label htmlFor="mfa-code" className="text-sm font-medium text-[var(--cc-text)]">
              Authentication code
            </Label>
          ) : null}
          <Input
            ref={codeInputRef}
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            maxLength={6}
            value={code}
            onChange={(e) => {
              setError("")
              setCode(normalizeCode(e.target.value))
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && code.length === 6) runSubmit()
            }}
            className="h-10 rounded-lg border-[var(--border)] bg-[var(--cc-surface)] text-center text-[16px] font-semibold tracking-[0.35em] tabular-nums"
          />
          <p className="text-xs text-center text-[var(--cc-text-muted)]">
            {code.length === 6 ? "Verifying automatically…" : "Refreshes every 30 seconds"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="recovery-code" className="text-sm font-medium text-[var(--cc-text)]">
            Backup recovery code
          </Label>
          <Input
            id="recovery-code"
            value={recoveryCode}
            onChange={(e) => {
              setError("")
              setRecoveryCode(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && recoveryCode.trim()) runSubmit()
            }}
            placeholder="XXXXXX-XXXXXX"
            className="h-10 rounded-lg border-[var(--border)] bg-[var(--cc-surface)] font-mono text-center tracking-wider"
          />
        </div>
      )}

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {useRecovery ? (
          <Button
            type="button"
            disabled={!recoveryCode.trim()}
            onClick={runSubmit}
            className={btnPrimary}
          >
            Verify & sign in
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : null}

        {!state.requiresSetup ? (
          <button
            type="button"
            className="text-sm text-[var(--cc-accent)] hover:underline py-1"
            onClick={() => {
              setUseRecovery((v) => !v)
              setError("")
              setCode("")
            }}
          >
            {useRecovery ? "Use authenticator code instead" : "Use a backup recovery code"}
          </button>
        ) : null}

        <Button type="button" variant="outline" onClick={onBack} className={btnOutline}>
          Back to sign in
        </Button>
      </div>
    </div>
  )
}

export function parseMfaLoginResponse(data: Record<string, unknown>): MfaLoginState | null {
  if (!data.mfaRequired || !data.challengeToken) return null
  return {
    challengeToken: String(data.challengeToken),
    requiresSetup: Boolean(data.requiresSetup),
  }
}
