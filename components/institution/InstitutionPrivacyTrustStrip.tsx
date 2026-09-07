import Link from "next/link"
import { Lock, ShieldCheck } from "lucide-react"
import { INSTITUTION_PRIVACY_TRUST } from "@/lib/institutions/privacy-trust"
import { landingCardClass } from "@/components/landing/landing-section-layout"
import { cn } from "@/lib/utils"

export function InstitutionPrivacyTrustStrip({
  variant = "marketing",
  className,
}: {
  variant?: "marketing" | "compact"
  className?: string
}) {
  const { title, summary, points, links } = INSTITUTION_PRIVACY_TRUST

  if (variant === "compact") {
    return (
      <div className={cn(landingCardClass, "border-[var(--cc-accent-border)] bg-[color-mix(in_srgb,var(--cc-accent-soft)_35%,var(--cc-surface))] p-5 sm:p-6", className)}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--cc-accent-soft)]">
            <ShieldCheck className="h-4 w-4 text-[var(--cc-accent)]" aria-hidden />
          </span>
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-bold text-[var(--cc-text)]">{title}</p>
            <p className="text-sm leading-relaxed text-[var(--cc-text-secondary)]">{summary}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
              {links.map((link) => (
                <Link key={link.href} href={link.href} className="text-[var(--cc-accent)] hover:underline">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <aside
      className={cn(
        landingCardClass,
        "border-[var(--cc-accent-border)] bg-[color-mix(in_srgb,var(--cc-accent-soft)_28%,var(--cc-surface))] p-6 sm:p-8",
        className,
      )}
      aria-labelledby="institution-privacy-trust-title"
    >
      <div className="mx-auto max-w-3xl text-center">
        <span className="mx-auto mb-4 inline-flex size-11 items-center justify-center rounded-full bg-[var(--cc-accent-soft)]">
          <Lock className="h-5 w-5 text-[var(--cc-accent)]" aria-hidden />
        </span>
        <h2 id="institution-privacy-trust-title" className="text-lg font-extrabold text-[var(--cc-text)] sm:text-xl">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--cc-text-secondary)] sm:text-base">{summary}</p>
      </div>
      <ul className="mx-auto mt-6 grid max-w-4xl gap-4 sm:grid-cols-3">
        {points.map((point) => (
          <li key={point.title} className="rounded-xl border border-[var(--border)] bg-[var(--cc-surface)] p-4">
            <p className="text-sm font-bold text-[var(--cc-text)]">{point.title}</p>
            <p className="mt-2 text-xs leading-relaxed text-[var(--cc-text-secondary)] sm:text-sm">{point.body}</p>
          </li>
        ))}
      </ul>
      <p className="mx-auto mt-5 max-w-3xl text-center text-xs text-[var(--cc-text-muted)]">
        Full details in our{" "}
        {links.map((link, i) => (
          <span key={link.href}>
            {i > 0 ? " and " : null}
            <Link href={link.href} className="font-semibold text-[var(--cc-accent)] hover:underline">
              {link.label}
            </Link>
          </span>
        ))}
        .
      </p>
    </aside>
  )
}
