"use client"

import Link from "next/link"
import { Clock, XCircle, ShieldOff, Mail, HelpCircle, LogOut, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { AccessAccountType, AccountLifecycleStatus } from "@/lib/access-governance/types"
import { ACCESS_EMAIL_INBOX_HINT } from "@/lib/access-governance/email-inbox-hint"

export type AccessRequestStatusPayload = {
  lifecycle: AccountLifecycleStatus | "not_found"
  accountType?: AccessAccountType
  request?: {
    id?: number
    fullName?: string
    email?: string | null
    section?: string | null
    organization?: string | null
    program?: string | null
    submittedAt?: string
    emailVerified?: boolean
  }
  rejectionReason?: string | null
}

function accountTypeLabel(type?: AccessAccountType): string {
  switch (type) {
    case "faculty":
      return "Faculty"
    case "career_member":
      return "Career Member"
    case "summer_student":
      return "Summer Student"
    case "student":
      return "Student"
    default:
      return "CourseCollab"
  }
}

function formatDate(iso?: string): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

function StatusBadge({
  tone,
  children,
}: {
  tone: "amber" | "emerald" | "red" | "slate"
  children: React.ReactNode
}) {
  const tones = {
    amber: "access-status-badge--amber",
    emerald: "access-status-badge--emerald",
    red: "border-red-300/60 bg-red-50 text-red-900 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-100",
    slate:
      "border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-surface)_88%,transparent)] text-[var(--cc-text)]",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] py-2.5 last:border-0">
      <dt className="shrink-0 text-sm text-[var(--cc-text-muted)]">{label}</dt>
      <dd className="text-right text-sm font-medium text-[var(--cc-text)]">{value}</dd>
    </div>
  )
}

export function AccessRequestStatusPanel({
  payload,
  onSignOut,
  className,
  supportHref = "/help",
  updateHref,
}: {
  payload: AccessRequestStatusPayload
  onSignOut?: () => void
  className?: string
  supportHref?: string
  updateHref?: string
}) {
  const typeLabel = accountTypeLabel(payload.accountType)
  const pending = payload.lifecycle === "pending_approval"
  const rejected = payload.lifecycle === "rejected"
  const suspended = payload.lifecycle === "suspended"
  const deactivated = payload.lifecycle === "deactivated"
  const pendingEmail = payload.lifecycle === "pending_email_verification"

  const title = pendingEmail
    ? "Verify your email"
    : pending
      ? "Access request pending"
      : rejected
        ? "Access request not approved"
        : suspended
          ? "Account suspended"
          : deactivated
            ? "Account deactivated"
            : "Account unavailable"

  const Icon = pendingEmail ? Mail : pending ? Clock : rejected ? XCircle : ShieldOff

  const iconTone = pendingEmail || pending
    ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200"
    : rejected
      ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200"
      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200"

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-5 flex items-start gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
            iconTone,
          )}
        >
          <Icon className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-[var(--cc-text)]">{title}</h2>
            <StatusBadge tone={pendingEmail || pending ? "amber" : rejected ? "red" : "slate"}>
              {typeLabel}
            </StatusBadge>
          </div>
          <p className="text-sm text-[var(--cc-text-secondary)]">
            {pendingEmail
              ? "Check your inbox to continue"
              : pending
                ? "Waiting for reviewer approval"
                : rejected
                  ? "Request was not approved"
                  : "Account access is restricted"}
          </p>
        </div>
      </div>

      {pendingEmail && (
        <div className="mb-5 space-y-3">
          <p className="text-sm leading-relaxed text-[var(--cc-text-secondary)]">
            We sent a verification link to{" "}
            <span className="font-semibold text-[var(--cc-text)]">
              {payload.request?.email ?? "your email"}
            </span>
            . Open it to continue your access request.
          </p>
          <div className="access-status-callout--amber rounded-xl px-4 py-3">
            <p className="text-sm leading-relaxed">{ACCESS_EMAIL_INBOX_HINT}</p>
          </div>
        </div>
      )}

      {pending && !pendingEmail && (
        <p className="mb-5 text-sm leading-relaxed text-[var(--cc-text-secondary)]">
          Your account has been submitted and is waiting for approval. You cannot use CourseCollab
          until an authorized reviewer approves your request.
        </p>
      )}

      {rejected && (
        <p className="mb-5 text-sm leading-relaxed text-[var(--cc-text-secondary)]">
          Your access request was reviewed and not approved.
          {payload.rejectionReason ? (
            <>
              {" "}
              Reason:{" "}
              <span className="font-semibold text-[var(--cc-text)]">{payload.rejectionReason}</span>
            </>
          ) : null}
        </p>
      )}

      {(suspended || deactivated) && (
        <p className="mb-5 text-sm leading-relaxed text-[var(--cc-text-secondary)]">
          This account is not active. Contact your instructor or platform support for help.
        </p>
      )}

      {payload.request && (
        <dl className="mb-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-surface)_86%,transparent)] px-4">
          {payload.request.fullName && (
            <DetailRow label="Name" value={payload.request.fullName} />
          )}
          {payload.request.organization && (
            <DetailRow label="Institution" value={payload.request.organization} />
          )}
          {payload.request.section && (
            <DetailRow label="Course / section" value={payload.request.section} />
          )}
          {payload.request.program && (
            <DetailRow label="Program" value={payload.request.program} />
          )}
          {payload.request.submittedAt && (
            <DetailRow label="Submitted" value={formatDate(payload.request.submittedAt)} />
          )}
          {payload.request.emailVerified != null && (
            <DetailRow
              label="Email verified"
              value={
                payload.request.emailVerified ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Yes
                  </span>
                ) : (
                  <StatusBadge tone="amber">Pending</StatusBadge>
                )
              }
            />
          )}
        </dl>
      )}

      {payload.accountType === "career_member" && pending && (
        <p className="mb-4 text-xs text-[var(--cc-text-muted)]">
          Career Member approval does not grant course enrollment.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {updateHref && (rejected || pending) && (
          <Button asChild variant="outline" className="access-status-action-outline flex-1 rounded-xl">
            <Link href={updateHref}>Update request</Link>
          </Button>
        )}
        <Button asChild variant="outline" className="access-status-action-outline flex-1 rounded-xl">
          <Link href={supportHref}>
            <HelpCircle className="mr-2 h-4 w-4" />
            Help
          </Link>
        </Button>
        {onSignOut && (
          <Button
            type="button"
            variant="ghost"
            className="flex-1 rounded-xl text-[var(--cc-text-secondary)] hover:text-[var(--cc-text)]"
            onClick={onSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        )}
      </div>
    </div>
  )
}

/** Parse login API error body into status panel payload. */
export function parseAccessLifecycleFromLoginError(data: unknown): AccessRequestStatusPayload | null {
  if (!data || typeof data !== "object") return null
  const row = data as Record<string, unknown>
  const lifecycle = row.lifecycle
  if (typeof lifecycle !== "string") return null
  const allowed = [
    "pending_approval",
    "pending_email_verification",
    "rejected",
    "suspended",
    "deactivated",
  ]
  if (!allowed.includes(lifecycle)) return null
  const request = row.request as AccessRequestStatusPayload["request"] | undefined
  return {
    lifecycle: lifecycle as AccountLifecycleStatus,
    accountType: row.accountType as AccessAccountType | undefined,
    request,
    rejectionReason: row.rejectionReason != null ? String(row.rejectionReason) : null,
  }
}
