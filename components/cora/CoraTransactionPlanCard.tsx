"use client"

import { useState } from "react"
import { Check, Loader2, ListOrdered } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import type { CoraTransactionPlan } from "@/lib/cora/confirmations/transaction-plans"

type Props = {
  plan: CoraTransactionPlan
  className?: string
  onConfirmed?: (result: {
    success: boolean
    message: string
    results?: unknown[]
  }) => void
  onCancelled?: () => void
}

export function CoraTransactionPlanCard({
  plan,
  className,
  onConfirmed,
  onCancelled,
}: Props) {
  const [status, setStatus] = useState<"idle" | "confirming" | "done" | "cancelled" | "error">(
    "idle",
  )
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    if (status === "confirming" || status === "done") return
    setStatus("confirming")
    setError(null)
    try {
      const res = await instructorApiFetch("/api/instructor/cora/plans/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildInstructorApiHeaders(),
        },
        body: JSON.stringify({ plan }),
      })
      const data = (await res.json()) as {
        success?: boolean
        message?: string
        error?: string
        results?: unknown[]
      }
      if (!res.ok || !data.success) {
        setStatus("error")
        setError(data.error || data.message || "Could not confirm plan")
        return
      }
      setStatus("done")
      setMessage(data.message || "Plan completed.")
      onConfirmed?.(data as { success: boolean; message: string; results?: unknown[] })
    } catch (e) {
      setStatus("error")
      setError(e instanceof Error ? e.message : "Confirm failed")
    }
  }

  return (
    <div
      className={cn(
        "mb-4 rounded-xl border border-border/80 bg-card/80 p-4 shadow-sm",
        className,
      )}
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
          <ListOrdered className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Transaction plan</p>
          <p className="text-xs text-muted-foreground">{plan.summary}</p>
          {plan.courseLabel ? (
            <p className="mt-1 text-xs text-muted-foreground">{plan.courseLabel}</p>
          ) : null}
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {plan.maxRisk}
        </span>
      </div>

      <ol className="mb-4 space-y-2">
        {plan.operations.map((op, idx) => (
          <li
            key={op.id}
            className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{op.label}</p>
              <p className="text-xs text-muted-foreground">
                {op.tool}
                {op.dependsOn ? ` · after ${op.dependsOn}` : ""}
              </p>
            </div>
            <span className="text-[10px] uppercase text-muted-foreground">{op.risk}</span>
          </li>
        ))}
      </ol>

      {status === "done" ? (
        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <Check className="h-4 w-4" />
          {message}
        </div>
      ) : status === "cancelled" ? (
        <p className="text-sm text-muted-foreground">Plan cancelled.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => void confirm()} disabled={status === "confirming"}>
            {status === "confirming" ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Running…
              </>
            ) : (
              "Confirm plan"
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={status === "confirming"}
            onClick={() => {
              setStatus("cancelled")
              onCancelled?.()
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
