export function AiGeneratedBadge({
  label = "Cora response",
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <span
      className={
        className ??
        "inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--muted)]/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--cc-text-muted)]"
      }
    >
      {label}
    </span>
  )
}
