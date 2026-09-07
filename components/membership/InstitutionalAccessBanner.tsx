"use client"

export function InstitutionalAccessBanner(props: {
  title: string
  providedBy?: string | null
  expiresAt?: string | null
  personalTier?: string | null
  sponsoredFeatureTier?: string | null
}) {
  const expiry = props.expiresAt
    ? new Date(props.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null
  return (
    <div className="rounded-xl border border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)] px-4 py-4 sm:px-5">
      <p className="text-sm font-semibold text-[var(--cc-accent-dark)]">{props.title}</p>
      {props.providedBy ? (
        <p className="mt-1 text-sm text-[var(--cc-text)]">Provided by: {props.providedBy}</p>
      ) : (
        <p className="mt-1 text-sm text-[var(--cc-text)]">Institutional Access</p>
      )}
      {props.sponsoredFeatureTier ? (
        <p className="mt-1 text-sm text-[var(--cc-text)]">
          Includes {props.sponsoredFeatureTier}-level platform features while coverage is active.
        </p>
      ) : null}
      {expiry ? (
        <p className="mt-1 text-xs text-[var(--cc-text-muted)]">Coverage through {expiry}</p>
      ) : null}
      {props.personalTier && props.personalTier !== "Scholar" && props.personalTier !== "Free" ? (
        <p className="mt-2 text-xs text-[var(--cc-text-muted)]">
          Your personal {props.personalTier} membership remains independent. If institutional coverage ends, that purchase still applies.
        </p>
      ) : (
        <p className="mt-2 text-xs text-[var(--cc-text-muted)]">
          You do not need an individual paid membership while this coverage is active. This access is sponsored by your institution — it is not free.
        </p>
      )}
    </div>
  )
}
