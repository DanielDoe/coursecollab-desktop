"use client"

import { BookOpen, Shield, ShieldCheck, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

const dismissBtn =
  "absolute z-10 rounded-xl p-2 text-[var(--cc-text-muted)] transition-all hover:bg-[var(--muted)] hover:text-[var(--cc-text)]"

export function CoursePolicyNotice({
  className,
  onDismiss,
}: {
  className?: string
  onDismiss?: () => void
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 sm:p-5 shadow-sm",
        PORTAL_CARD,
        "border-[var(--cc-accent-border)] bg-gradient-to-br from-[var(--cc-accent-soft)] via-[var(--card)] to-[var(--muted)]",
        onDismiss ? "pr-12 sm:pr-14" : undefined,
        className,
      )}
    >
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className={cn(dismissBtn, "top-3 right-3")}
          aria-label="Dismiss course policy notice"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[var(--cc-accent)]/15 blur-3xl" />
      <div className="relative flex gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)] ring-1 ring-[var(--cc-accent-border)] text-[var(--cc-accent-dark)]">
          <Shield className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("font-semibold", PORTAL_TEXT)}>Course Policy Notice</p>
            <span className="inline-flex rounded-full bg-[var(--cc-accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-accent-dark)] ring-1 ring-[var(--cc-accent-border)]">
              Your course
            </span>
          </div>
          <p className={cn("text-sm leading-relaxed", PORTAL_TEXT)}>
            Assessment privileges — attempts, deadlines, retakes, extensions, grading, and accommodations — are set by
            your instructor, not by your membership tier.
          </p>
          <p className={cn("text-sm leading-relaxed", PORTAL_TEXT)}>
            No student receives extra assessment opportunities through CourseCollab membership unless your instructor
            has enabled that for the entire course.
          </p>
        </div>
      </div>
    </div>
  )
}

export function StudentAssessmentGovernanceCard({
  sourceLabel,
  className,
}: {
  sourceLabel: string
  className?: string
}) {
  const isInstructorOnly = sourceLabel === "Instructor controlled only"
  const displayLabel = isInstructorOnly ? "Instructor Controlled Assessment Policies" : sourceLabel

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border p-5 sm:p-6 space-y-4 shadow-sm", PORTAL_CARD, className)}>
      <div className="pointer-events-none absolute -left-6 top-0 h-24 w-24 rounded-full bg-[var(--cc-accent)]/10 blur-3xl" />

      <div className="relative flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)] ring-1 ring-[var(--cc-accent-border)] text-[var(--cc-accent-dark)]">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h2 className={cn("text-lg font-semibold", PORTAL_TEXT)}>Assessment Governance</h2>
          <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
            How this course handles membership vs instructor policy
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)] px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-accent-dark)]">
          This course uses
        </p>
        <p className={cn("mt-1 text-sm font-semibold", PORTAL_TEXT)}>{displayLabel}</p>
      </div>

      <p className={cn("text-sm leading-relaxed", PORTAL_TEXT)}>
        {isInstructorOnly
          ? "Assessment attempts, retakes, deadlines, and grading policies are managed by the instructor and not by CourseCollab membership status."
          : "Assessment attempts, retakes, deadlines, and grading policies are managed by the instructor and not by CourseCollab membership status unless your instructor has enabled membership-based assessment benefits for this course."}
      </p>

      <div className={cn("flex items-start gap-2 rounded-xl border px-3.5 py-3", PORTAL_CARD)}>
        <BookOpen className={cn("h-4 w-4 shrink-0 mt-0.5", PORTAL_TEXT_MUTED)} aria-hidden />
        <p className={cn("text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
          View membership plans for learning tools and platform perks — course assessment rules stay on this page.
        </p>
      </div>
    </div>
  )
}
