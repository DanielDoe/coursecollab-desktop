"use client"

import { studentApiFetch, getStudentAuthHeaders } from "@/lib/auth"
import { useEffect, useState } from "react"
import { Megaphone, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAssessmentType } from "@/context/assessment-type-context"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { ctaInkOnFill } from "@/lib/appearance/chrome-ink"
import { formatCentralDateTime } from "@/lib/timezone"
import { cn } from "@/lib/utils"
import type { RolloverPolicyForModal } from "@/components/rollover-confirm-modal"

/** Bump when copy changes so dismissed students see it again. */
const DISMISS_STORAGE_KEY = "cc_dismiss_banner_extend_self_service_closed_v1"

type Props = {
  /** When provided, skip the policy fetch (e.g. QuizList already loaded it). */
  policy?: RolloverPolicyForModal | null
  className?: string
}

/**
 * Themed announcement strip for semester Extend self-service cutoff.
 * Sits above quiz list + issues (not inside EmbedModuleCard).
 * @see https://tailwindcss.com/plus/ui-blocks/marketing/elements/banners
 */
export function ExtendSelfServiceClosedBanner({ policy: policyProp, className }: Props) {
  const { assessmentType } = useAssessmentType()
  const { tokens } = useAppearance()
  const [fetched, setFetched] = useState<RolloverPolicyForModal | null>(null)
  const [loaded, setLoaded] = useState(policyProp !== undefined)
  const [dismissed, setDismissed] = useState(true)

  const accent = tokens.accent
  const ink = ctaInkOnFill(accent)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_STORAGE_KEY) === "1")
    } catch {
      setDismissed(false)
    }
  }, [])

  useEffect(() => {
    if (policyProp !== undefined) {
      setFetched(policyProp)
      setLoaded(true)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await studentApiFetch("/api/student/rollover/policy")
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data.policy) setFetched(data.policy as RolloverPolicyForModal)
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [policyProp])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, "1")
    } catch {
      /* private mode */
    }
    setDismissed(true)
  }

  const policy = policyProp !== undefined ? policyProp : fetched

  if (dismissed || !loaded || assessmentType === "final") return null
  if (!policy || policy.self_service_open || policy.show_closed_notice === false) return null

  const deadline = formatCentralDateTime(policy.apply_deadline_iso, "MMM d, h:mm a")

  return (
    <div
      role="region"
      aria-label="Extend self-service closed"
      className={cn(
        "relative isolate flex items-center gap-x-6 overflow-hidden rounded-2xl px-4 py-3 pr-12 sm:px-6 sm:pr-14",
        "shadow-sm ring-1 ring-inset ring-black/5 dark:ring-white/10",
        className,
      )}
      style={{ backgroundColor: accent, color: ink }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-[max(-7rem,calc(50%-52rem))] top-1/2 -z-10 -translate-y-1/2 transform-gpu blur-2xl"
      >
        <div
          className="aspect-[577/310] w-[36rem] opacity-30"
          style={{
            background: `linear-gradient(to right, ${tokens.tint}, ${accent})`,
            clipPath:
              "polygon(74.8% 41.9%, 97.2% 73.2%, 100% 34.9%, 92.5% 0.4%, 87.5% 0%, 75% 28.6%, 58.5% 54.6%, 50.1% 56.8%, 46.9% 44%, 48.3% 17.4%, 24.7% 53.9%, 0% 4.9%, 11.9% 58%, 20.1% 87.8%, 46.1% 64.5%, 50.1% 81.6%, 53% 68%, 75.8% 61.9%)",
          }}
        />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute left-[max(45rem,calc(50%+8rem))] top-1/2 -z-10 -translate-y-1/2 transform-gpu blur-2xl"
      >
        <div
          className="aspect-[577/310] w-[36rem] opacity-25"
          style={{
            background: `linear-gradient(to right, ${tokens.tint}, ${accent})`,
            clipPath:
              "polygon(74.8% 41.9%, 97.2% 73.2%, 100% 34.9%, 92.5% 0.4%, 87.5% 0%, 75% 28.6%, 58.5% 54.6%, 50.1% 56.8%, 46.9% 44%, 48.3% 17.4%, 24.7% 53.9%, 0% 4.9%, 11.9% 58%, 20.1% 87.8%, 46.1% 64.5%, 50.1% 81.6%, 53% 68%, 75.8% 61.9%)",
          }}
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-2 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full hover:bg-black/10 dark:hover:bg-white/15"
        style={{ color: ink }}
        onClick={dismiss}
        aria-label="Dismiss notice"
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 sm:before:flex-1 sm:after:flex-1">
        <p className="flex min-w-0 items-start gap-2.5 text-sm/6 sm:items-center">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:mt-0"
            style={{ backgroundColor: "color-mix(in srgb, currentColor 15%, transparent)" }}
          >
            <Megaphone className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 text-left">
            <strong className="font-semibold">Extend (self-service) is closed</strong>
            <svg viewBox="0 0 2 2" aria-hidden className="mx-2 inline h-0.5 w-0.5 fill-current">
              <circle r={1} cx={1} cy={1} />
            </svg>
            for this semester as of {deadline} so grades can be finalized. If you still need access to
            past-due work, contact your instructor.
          </span>
        </p>
      </div>
    </div>
  )
}
