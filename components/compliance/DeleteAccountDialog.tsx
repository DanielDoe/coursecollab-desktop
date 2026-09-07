"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AccountKind } from "@/lib/compliance/account-deletion-policy"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountKind: AccountKind
  authHeaders: HeadersInit
  onDeleted: () => void
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  accountKind,
  authHeaders,
  onDeleted,
}: Props) {
  const [step, setStep] = useState<"warn" | "confirm">("warn")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setStep("warn")
    setPassword("")
    setError(null)
    setBusy(false)
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          accountKind,
          confirm: true,
          password,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Deletion failed")
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deletion failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Account</DialogTitle>
          <DialogDescription>
            Deleting your CourseCollab account will permanently remove or anonymize eligible
            personal information associated with your account. Course grades, submissions, and
            payment records required for institutional or financial obligations are retained.
          </DialogDescription>
        </DialogHeader>
        {step === "warn" ? (
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => setStep("confirm")}>
              Continue
            </Button>
          </DialogFooter>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delete-account-password">Confirm with your password</Label>
              <Input
                id="delete-account-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
            </div>
            {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setStep("warn")} disabled={busy}>
                Back
              </Button>
              <Button type="button" variant="destructive" onClick={() => void submit()} disabled={busy || !password}>
                {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Delete account
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
