"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { Calendar, ChevronRight, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SolidListThumb } from "@/lib/student-color-hunt-theme"

type ThumbSize = "list" | "compact"

export function SolidListThumbTile({
  thumb,
  icon: Icon,
  size = "list",
}: {
  thumb: SolidListThumb
  icon: LucideIcon
  size?: ThumbSize
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center shadow-sm",
        size === "list" ? "size-14 rounded-[14px]" : "size-9 rounded-[10px]",
      )}
      style={{ backgroundColor: thumb.fill, color: thumb.icon }}
    >
      <Icon className={size === "list" ? "h-6 w-6" : "h-4 w-4"} strokeWidth={2} aria-hidden />
    </div>
  )
}

export function SignatureListCard({
  title,
  subtitle,
  meta,
  trailingValue,
  trailingValueColor,
  statusLabel,
  statusColor,
  statusPositive,
  icon: Icon,
  thumb,
  href,
  onClick,
  showChevron = true,
  className,
}: {
  title: string
  subtitle?: string
  meta?: string
  trailingValue?: string | number
  trailingValueColor?: string
  statusLabel?: string
  statusColor?: string
  statusPositive?: boolean
  icon: LucideIcon
  thumb: SolidListThumb
  href?: string
  onClick?: () => void
  showChevron?: boolean
  className?: string
}) {
  const interactive = Boolean(href || onClick)
  const resolvedStatusColor = statusColor ?? thumb.fill

  const body = (
    <>
      <SolidListThumbTile thumb={thumb} icon={Icon} />

      <div className="min-w-0 flex-1 space-y-0.5 overflow-hidden py-0.5">
        <p className="text-sm font-semibold leading-snug text-[var(--cc-text)] [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">
          {title}
        </p>
        {subtitle ? (
          <p className="truncate text-xs text-[var(--cc-text-muted)]">{subtitle}</p>
        ) : null}
        {meta ? (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3 shrink-0 text-[var(--cc-text-muted)]" aria-hidden />
            <p className="truncate text-xs text-[var(--cc-text-muted)]">{meta}</p>
          </div>
        ) : null}
        {statusLabel ? (
          <div className="flex items-center gap-1.5 pt-0.5">
            {statusPositive ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: resolvedStatusColor }} aria-hidden />
            ) : (
              <span
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ backgroundColor: resolvedStatusColor }}
                aria-hidden
              />
            )}
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: resolvedStatusColor }}>
              {statusLabel}
            </span>
          </div>
        ) : null}
      </div>

      {trailingValue != null && trailingValue !== "" ? (
        <p
          className="shrink-0 text-sm font-bold tabular-nums"
          style={{ color: trailingValueColor ?? thumb.fill }}
        >
          {trailingValue}
        </p>
      ) : null}

      {showChevron && interactive ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--cc-text-muted)]" aria-hidden />
      ) : null}
    </>
  )

  const cardClass = cn(
    "flex h-[88px] w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
    interactive && "transition-colors hover:bg-[var(--muted)]/30",
    className,
  )

  if (href) {
    return (
      <Link href={href} className={cardClass}>
        {body}
      </Link>
    )
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(cardClass, "text-left")}>
        {body}
      </button>
    )
  }

  return <div className={cardClass}>{body}</div>
}

export const signatureListStyles = {
  list: "flex flex-col gap-2",
} as const
