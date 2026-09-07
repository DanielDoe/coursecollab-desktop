"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, AlertCircle, CheckCircle2, Lock, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { FACULTY_DEFAULT_PASSWORD } from "@/lib/faculty-default-password"
import { resolveAppearanceGatePath } from "@/lib/appearance/appearance-setup"
import { hydrateFacultySessionUniversityFromRemembered } from "@/lib/remembered-auth"
import { readFacultySession, saveFacultySession, facultySessionNeedsPasswordChange } from "@/lib/faculty-auth-flow"
import { tryRestoreFacultySessionFromRefresh } from "@/lib/faculty-session-restore-client"

export function FacultyChangePasswordForm() {
  const router = useRouter()
  const [instructorId, setInstructorId] = useState<number | null>(null)
  const [displayName, setDisplayName] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const strength = {
    length: newPassword.length >= 8,
    number: /\d/.test(newPassword),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
  }

  useEffect(() => {
    void (async () => {
      await tryRestoreFacultySessionFromRefresh()
      const session = readFacultySession()
      if (!session?.id) {
        router.replace("/faculty/login")
        return
      }
      if (!facultySessionNeedsPasswordChange(session)) {
        router.replace("/faculty/select-course")
        return
      }
      setInstructorId(Number(session.id))
      setDisplayName(String(session.name || session.id))
    })()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!instructorId) return
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match")
      return
    }
    if (!strength.length || !strength.number || !strength.special) {
      setError("Password does not meet security requirements")
      return
    }

    setLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructorId, currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to change password")

      const existing = readFacultySession()
      if (existing) {
        saveFacultySession({
          ...existing,
          hasChangedPassword: true,
          requiresPasswordChange: false,
        })
      }

      setSuccess(true)
      hydrateFacultySessionUniversityFromRemembered()
      // Faculty's first password change is the one moment we know this is a
      // brand-new account, so it is where the theme prompt hangs — same as the
      // student flow. Resolved before the timeout so the 1.5s success message
      // covers the round trip rather than adding to it.
      const next = await resolveAppearanceGatePath({
        audience: "instructor",
        userId: instructorId,
      })
      setTimeout(() => router.push(next), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    "rounded-xl border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)]"

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-500/25 border border-violet-200/60">
          <Lock className="h-7 w-7 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--cc-text)]">Set your password</h1>
          <p className="text-sm text-[var(--cc-text-secondary)]">
            {displayName ? `Welcome, ${displayName}. ` : ""}
            Replace the default faculty password before continuing.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-800 dark:text-emerald-200">
              Password updated. Taking you to course selection…
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label>Current password</Label>
          <div className="relative">
            <Input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={cn(inputClass, "pr-10")}
              required
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              onClick={() => setShowCurrent(!showCurrent)}
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Enter the password you used to sign in (default for new faculty: {FACULTY_DEFAULT_PASSWORD})
          </p>
        </div>

        <div className="space-y-2">
          <Label>New password</Label>
          <div className="relative">
            <Input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={cn(inputClass, "pr-10")}
              required
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              onClick={() => setShowNew(!showNew)}
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Confirm new password</Label>
          <div className="relative">
            <Input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={cn(inputClass, "pr-10")}
              required
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              onClick={() => setShowConfirm(!showConfirm)}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <ul className="text-xs space-y-1 text-[var(--cc-text-secondary)]">
          <li className={strength.length ? "text-emerald-600" : ""}>At least 8 characters</li>
          <li className={strength.number ? "text-emerald-600" : ""}>At least 1 number</li>
          <li className={strength.special ? "text-emerald-600" : ""}>At least 1 special character</li>
        </ul>

        <Button
          type="submit"
          disabled={loading || success}
          className="w-full rounded-xl py-4 font-semibold"
        >
          {loading ? "Updating…" : "Continue to course selection"}
          {!loading && <ArrowRight className="h-4 w-4 ml-2" />}
        </Button>
      </form>
    </div>
  )
}
