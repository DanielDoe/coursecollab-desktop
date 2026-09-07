"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, Loader2, Megaphone, Layers, FileText, Library, Calendar, BookOpen, Presentation, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"
import { buildAdminApiHeaders } from "@/lib/admin-api-headers"
import type { CoraActionProposal } from "@/lib/cora/confirmations/action-proposals"
import type { ConfirmCoraActionResult } from "@/lib/cora/confirmations/confirm-action"
import { useQueryClient } from "@tanstack/react-query"
import { invalidateAfterCoraAction } from "@/lib/data/cora-sync"

type Portal = "faculty" | "student" | "admin"

type Props = {
  proposal: CoraActionProposal
  portal: Portal
  className?: string
  onConfirmed?: (result: ConfirmCoraActionResult) => void
  onCancelled?: () => void
}

function entityIcon(entityType: CoraActionProposal["preview"]["entityType"]) {
  switch (entityType) {
    case "announcement":
      return Megaphone
    case "question":
      return Library
    case "flashcard_deck":
      return Layers
    case "note":
      return FileText
    case "calendar_events":
      return Calendar
    case "syllabus":
      return BookOpen
    case "lecture":
      return Presentation
    case "account":
      return Shield
    default:
      return Check
  }
}

function resolveEntityHref(portal: Portal, route?: string, entityId?: number | string): string | null {
  if (!route) return null
  if (route.startsWith("http") || route.startsWith("/")) {
    if (portal === "faculty") {
      if (route === "/module/announcements") {
        return "/faculty/dashboard/communication/announcements"
      }
      if (route === "/module/question-bank") {
        return "/faculty/dashboard/assessments/quizzes/question-bank"
      }
    }
    if (portal === "student") {
      if (route.startsWith("/flashcards/")) {
        return `/student/dashboard-v2/flashcards`
      }
      if (route.startsWith("/notes/")) {
        return entityId
          ? `/student/dashboard-v2/notes?noteId=${entityId}`
          : `/student/dashboard-v2/notes`
      }
      if (route.includes("calendar")) {
        return "/student/dashboard-v2/calendar"
      }
    }
    return route
  }
  return route
}

export function CoraActionCard({ proposal, portal, className, onConfirmed, onCancelled }: Props) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<"idle" | "confirming" | "done" | "cancelled" | "error">("idle")
  const [result, setResult] = useState<ConfirmCoraActionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const Icon = entityIcon(proposal.preview.entityType)
  const confirmEndpoint =
    portal === "faculty"
      ? "/api/instructor/cora/actions/confirm"
      : portal === "admin"
        ? "/api/admin/cora/actions/confirm"
        : "/api/cora/actions/confirm"

  const confirm = async () => {
    if (status === "confirming" || status === "done") return
    setStatus("confirming")
    setError(null)
    try {
      const headers =
        portal === "faculty"
          ? buildInstructorApiHeaders({ "Content-Type": "application/json" })
          : portal === "admin"
            ? buildAdminApiHeaders({ "Content-Type": "application/json" })
            : { "Content-Type": "application/json" }
      const res = await fetch(confirmEndpoint, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ proposal }),
      })
      const data = (await res.json().catch(() => ({}))) as ConfirmCoraActionResult & {
        error?: string
      }
      if (!res.ok || !data.success) {
        const msg = data.error || data.message || "Confirmation failed."
        setError(msg)
        setStatus("error")
        return
      }
      setResult(data)
      setStatus("done")
      invalidateAfterCoraAction(queryClient, {
        tool: data.tool ?? proposal.tool,
        entityType: data.entity?.type ?? proposal.preview?.entityType,
      })
      onConfirmed?.(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirmation failed.")
      setStatus("error")
    }
  }

  if (status === "cancelled") return null

  if (status === "done" && result) {
    const href = resolveEntityHref(portal, result.entity?.route, result.entity?.id)
    return (
      <div
        className={cn(
          "mb-4 max-w-md rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
            <Check className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--cc-text)]">{result.message}</p>
            {result.entity?.title ? (
              <p className="mt-1 text-xs text-[var(--cc-text-muted)]">{result.entity.title}</p>
            ) : null}
            {href ? (
              <Link
                href={href}
                className="mt-2 inline-flex text-xs font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
              >
                Open
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "mb-4 max-w-md rounded-2xl border border-[var(--border)] bg-[var(--muted)]/40 px-4 py-3 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--cc-text)]">{proposal.preview.title}</p>
          {proposal.preview.summary ? (
            <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">{proposal.preview.summary}</p>
          ) : null}
          {proposal.preview.fields.length > 0 ? (
            <dl className="mt-3 space-y-1.5">
              {proposal.preview.fields.map((field) => (
                <div key={field.label} className="flex gap-2 text-xs">
                  <dt className="w-20 shrink-0 text-[var(--cc-text-muted)]">{field.label}</dt>
                  <dd className="min-w-0 flex-1 whitespace-pre-wrap text-[var(--cc-text)]">
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-full"
              disabled={status === "confirming"}
              onClick={() => {
                setStatus("cancelled")
                onCancelled?.()
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              disabled={status === "confirming"}
              onClick={() => void confirm()}
            >
              {status === "confirming" ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Working…
                </>
              ) : (
                proposal.preview.confirmLabel
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
