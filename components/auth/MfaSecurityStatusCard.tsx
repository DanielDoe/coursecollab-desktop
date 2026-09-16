"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { AuthUserType } from "@/lib/auth-refresh-tokens"

const TRUST_OPTIONS = [
  { value: "1", label: "1 day" },
  { value: "7", label: "1 week (default)" },
  { value: "14", label: "2 weeks" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
]

type Props = {
  userType: AuthUserType
  userId: number | string
  /** Shown on authenticator label, e.g. email */
  accountName?: string
  /** Authenticator issuer label */
  issuer?: string
}

type EnrollPreview = {
  enrollmentToken: string
  qrDataUrl: string
  manualKey: string
}

export function MfaSecurityStatusCard({
  userType,
  userId,
  accountName,
  issuer = "CourseCollab",
}: Props) {
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [unusedRecoveryCodes, setUnusedRecoveryCodes] = useState(0)
  const [trustDurationDays, setTrustDurationDays] = useState("7")
  const [savingTrust, setSavingTrust] = useState(false)
  const [trustSaved, setTrustSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [enroll, setEnroll] = useState<EnrollPreview | null>(null)
  const [setupCode, setSetupCode] = useState("")
  const [showManualKey, setShowManualKey] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [disableCode, setDisableCode] = useState("")
  const [confirmDisable, setConfirmDisable] = useState(false)

  const statusParams = useCallback(() => {
    return new URLSearchParams({
      userType,
      userId: String(userId),
    })
  }, [userType, userId])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/auth/mfa/status?${statusParams()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load")
      setEnabled(Boolean(data.enabled))
      setUnusedRecoveryCodes(Number(data.unusedRecoveryCodes ?? 0))
      setTrustDurationDays(String(data.trustDurationDays ?? 7))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load MFA status")
    } finally {
      setLoading(false)
    }
  }, [statusParams])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const saveTrustDuration = async (value: string) => {
    setTrustDurationDays(value)
    setTrustSaved(false)
    setSavingTrust(true)
    try {
      const res = await fetch(`/api/auth/mfa/status?${statusParams()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trustDurationDays: Number(value) }),
      })
      if (res.ok) {
        setTrustSaved(true)
        setTimeout(() => setTrustSaved(false), 2500)
      }
    } finally {
      setSavingTrust(false)
    }
  }

  const startEnroll = async () => {
    setBusy(true)
    setError("")
    setMessage("")
    setRecoveryCodes(null)
    try {
      const res = await fetch("/api/auth/mfa/settings/enroll/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userType,
          userId: Number(userId),
          accountName: accountName || `user-${userId}`,
          issuer,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not start setup")
      setEnroll({
        enrollmentToken: data.enrollmentToken,
        qrDataUrl: data.qrDataUrl,
        manualKey: data.manualKey,
      })
      setSetupCode("")
      setShowManualKey(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start setup")
      setEnabled(false)
    } finally {
      setBusy(false)
    }
  }

  const confirmEnroll = async () => {
    if (!enroll || setupCode.replace(/\s/g, "").length !== 6) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/auth/mfa/settings/enroll/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userType,
          userId: Number(userId),
          enrollmentToken: enroll.enrollmentToken,
          code: setupCode.replace(/\s/g, ""),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not enable two-factor")
      setEnabled(true)
      setEnroll(null)
      setSetupCode("")
      setRecoveryCodes(Array.isArray(data.recoveryCodes) ? data.recoveryCodes : null)
      setMessage(data.message || "Two-factor authentication is on.")
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not enable two-factor")
    } finally {
      setBusy(false)
    }
  }

  const cancelEnroll = () => {
    setEnroll(null)
    setSetupCode("")
    setError("")
    setEnabled(false)
  }

  const disableMfa = async () => {
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const res = await fetch("/api/auth/mfa/settings/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userType,
          userId: Number(userId),
          code: disableCode.replace(/\s/g, ""),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not turn off two-factor")
      setEnabled(false)
      setConfirmDisable(false)
      setDisableCode("")
      setRecoveryCodes(null)
      setMessage(data.message || "Two-factor authentication is off.")
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not turn off two-factor")
    } finally {
      setBusy(false)
    }
  }

  const onToggle = (next: boolean) => {
    setError("")
    setMessage("")
    if (next) {
      setEnabled(true) // optimistic UI while QR loads
      void startEnroll()
      return
    }
    setConfirmDisable(true)
    setDisableCode("")
  }

  return (
    <Card className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-5 text-emerald-600" />
          Two-factor authentication
        </CardTitle>
        <CardDescription>
          Off by default. Turn it on to require an authenticator app at sign-in. You can turn it off
          anytime here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-2">
            <Loader2 className="size-4 animate-spin" />
            Loading security status…
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--sidebar-accent)]/10 px-3.5 py-3">
              <div>
                <p className="font-medium text-[var(--cc-text)]">Require authenticator at login</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {enabled && !enroll
                    ? "Enabled — you will verify with your app after password."
                    : enroll
                      ? "Finish setup with the QR code below."
                      : "Disabled — password-only sign-in."}
                </p>
              </div>
              <Switch
                checked={enabled || Boolean(enroll)}
                onCheckedChange={onToggle}
                disabled={busy || Boolean(enroll)}
                aria-label="Toggle two-factor authentication"
              />
            </div>

            {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
            {message ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p> : null}

            {enroll ? (
              <div className="space-y-3 rounded-xl border border-[var(--border)] p-3">
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                  <div className="rounded-xl bg-white p-2 shadow-sm ring-1 ring-black/5 shrink-0">
                    <Image
                      src={enroll.qrDataUrl}
                      alt="Scan with authenticator app"
                      width={140}
                      height={140}
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
                    <p className="font-medium">Scan with your authenticator</p>
                    <p className="text-xs text-muted-foreground">
                      Google Authenticator, Authy, or 1Password. Then enter the 6-digit code.
                    </p>
                    <button
                      type="button"
                      className="text-xs font-medium text-[var(--cc-accent)] underline-offset-2 hover:underline"
                      onClick={() => setShowManualKey((v) => !v)}
                    >
                      {showManualKey ? "Hide setup key" : "Can’t scan? Use setup key"}
                    </button>
                    {showManualKey ? (
                      <code className="block break-all rounded-lg bg-[var(--muted)] px-2 py-1.5 text-xs">
                        {enroll.manualKey}
                      </code>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-2">
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={6}
                    value={setupCode}
                    onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="h-10 tracking-[0.3em] text-center font-mono"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy || setupCode.length !== 6}
                      onClick={() => void confirmEnroll()}
                    >
                      {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                      Enable two-factor
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={cancelEnroll}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {recoveryCodes?.length ? (
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
                <p className="font-medium text-amber-900 dark:text-amber-100">Save these backup codes</p>
                <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                  Each code works once if you lose your authenticator. Store them somewhere safe.
                </p>
                <ul className="grid grid-cols-2 gap-1 font-mono text-xs">
                  {recoveryCodes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <Button type="button" size="sm" variant="outline" onClick={() => setRecoveryCodes(null)}>
                  Done
                </Button>
              </div>
            ) : null}

            {confirmDisable ? (
              <div className="space-y-2 rounded-xl border border-[var(--border)] p-3">
                <p className="font-medium">Turn off two-factor?</p>
                <p className="text-xs text-muted-foreground">
                  Enter a current authenticator code to confirm. Future sign-ins will only need your
                  password until you enable it again.
                </p>
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-10 tracking-[0.3em] text-center font-mono"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy || disableCode.length !== 6}
                    onClick={() => void disableMfa()}
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                    Turn off
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setConfirmDisable(false)
                      setDisableCode("")
                    }}
                  >
                    Keep enabled
                  </Button>
                </div>
              </div>
            ) : null}

            {enabled && !enroll && !confirmDisable ? (
              <>
                <p className="text-emerald-700 dark:text-emerald-400 font-medium">Enabled on your account</p>
                <p className="text-muted-foreground">
                  {unusedRecoveryCodes > 0
                    ? `${unusedRecoveryCodes} unused backup code${unusedRecoveryCodes === 1 ? "" : "s"} remaining.`
                    : "No backup codes left — re-enable two-factor to generate new ones, or contact support."}
                </p>
                <div className="space-y-2 pt-1 border-t border-[var(--border)]">
                  <p className="font-medium text-[var(--cc-text)]">Remember this device</p>
                  <p className="text-muted-foreground text-xs">
                    After you verify with your authenticator, you won&apos;t need a code again on this
                    browser until the period below expires.
                  </p>
                  <div className="flex items-center gap-2">
                    <Select
                      value={trustDurationDays}
                      onValueChange={(v) => void saveTrustDuration(v)}
                      disabled={savingTrust}
                    >
                      <SelectTrigger className="h-9 w-full max-w-xs rounded-lg">
                        <SelectValue placeholder="Trust duration" />
                      </SelectTrigger>
                      <SelectContent>
                        {TRUST_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {savingTrust ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground shrink-0" />
                    ) : trustSaved ? (
                      <span className="text-xs text-emerald-600 shrink-0">Saved</span>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
