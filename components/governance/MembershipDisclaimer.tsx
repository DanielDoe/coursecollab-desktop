"use client"

import { BookOpen, Info, ShieldCheck, Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import { solidListThumb } from "@/lib/student-color-hunt-theme"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

type MembershipDisclaimerVariant = "student" | "instructor" | "compact"

const MEMBERSHIP_CHIPS = ["Tools & AI", "Analytics", "Playground"] as const
const INSTRUCTOR_CHIPS = ["Attempts", "Retakes", "Deadlines", "Grading"] as const

const dismissBtn =
  "absolute z-10 rounded-xl p-2 text-[var(--cc-text-muted)] transition-all hover:bg-[var(--muted)] hover:text-[var(--cc-text)]"

export function MembershipDisclaimer({
  variant = "student",
  className,
  showTitle = true,
  onDismiss,
}: {
  variant?: MembershipDisclaimerVariant
  className?: string
  showTitle?: boolean
  onDismiss?: () => void
}) {
  const isCompact = variant === "compact"
  const isInstructor = variant === "instructor"
  const thumb = solidListThumb(isInstructor ? 0 : 4)
  const title = isInstructor ? "Membership vs academic policy" : "Membership ≠ grading policy"

  if (isCompact) {
    return (
      <div
        className={cn(
          "relative rounded-2xl border border-[var(--border)] bg-[var(--card)]",
          onDismiss ? "pr-11 sm:pr-12" : undefined,
          className,
        )}
      >
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className={cn(dismissBtn, "top-2.5 right-2.5 rounded-lg p-1.5")}
            aria-label="Dismiss membership policy notice"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        <div className="flex gap-3 p-3.5">
          <SolidListThumbTile thumb={thumb} icon={Info} size="compact" />
          <p className={cn("text-xs leading-relaxed", PORTAL_TEXT)}>
            Membership unlocks platform tools — not extra quiz attempts, retakes, or grading rules unless your
            instructor enables them for the course.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-[var(--border)] bg-[var(--card)]",
        "p-4 sm:p-5",
        onDismiss ? "pr-11 sm:pr-14" : undefined,
        className,
      )}
    >
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className={cn(dismissBtn, "top-3 right-3")}
          aria-label="Dismiss membership policy notice"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start sm:gap-4">
        <SolidListThumbTile
          thumb={thumb}
          icon={isInstructor ? ShieldCheck : Info}
          size="list"
        />

        <div className="min-w-0 flex-1 space-y-3">
          {showTitle ? (
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={cn("text-lg font-semibold tracking-tight sm:text-xl", PORTAL_TEXT)}>{title}</h3>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide"
                style={{
                  backgroundColor: `${thumb.fill}22`,
                  color: thumb.fill,
                }}
              >
                Policy
              </span>
            </div>
          ) : null}

          {isInstructor ? (
            <p className={cn("text-sm leading-relaxed", PORTAL_TEXT)}>
              Memberships unlock optional learning tools. Attempts, deadlines, retakes, and grading stay under your
              control unless Assessment Governance allows membership benefits for the course.
            </p>
          ) : (
            <>
              <p className={cn("text-sm sm:text-base leading-relaxed", PORTAL_TEXT)}>
                Membership unlocks optional platform features. Your instructor still sets attempts, retakes, deadlines,
                and grading for everyone in the course.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-3.5 sm:p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <SolidListThumbTile thumb={solidListThumb(0)} icon={Sparkles} size="compact" />
                    <div>
                      <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Membership includes</p>
                      <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Optional platform tools</p>
                    </div>
                  </div>
                  <ul className="space-y-2.5">
                    {MEMBERSHIP_CHIPS.map((chip) => (
                      <li key={chip} className="flex items-center gap-2.5">
                        <span
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: solidListThumb(0).fill }}
                          aria-hidden
                        />
                        <span className={cn("text-sm font-medium", PORTAL_TEXT)}>{chip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-3.5 sm:p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <SolidListThumbTile thumb={solidListThumb(4)} icon={BookOpen} size="compact" />
                    <div>
                      <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Instructor controls</p>
                      <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Same rules for every student</p>
                    </div>
                  </div>
                  <ul className="space-y-2.5">
                    {INSTRUCTOR_CHIPS.map((chip) => (
                      <li key={chip} className="flex items-center gap-2.5">
                        <span
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: solidListThumb(4).fill }}
                          aria-hidden
                        />
                        <span className={cn("text-sm font-medium", PORTAL_TEXT)}>{chip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
