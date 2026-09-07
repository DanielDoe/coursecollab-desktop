"use client"

import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { CORA_NAME } from "@/lib/cora/constants"
import { CORA_BRAND_FONT_CLASS } from "@/lib/cora/brand-font"

const TEXT_SIZE = {
  xs: "text-[13px]",
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-[2.5rem] leading-none",
} as const

const GRADIENT =
  "bg-gradient-to-r from-[#9b87f5] via-[#5b8def] to-[#5ec8f8] bg-clip-text text-transparent dark:from-[#c4b5fd] dark:via-[#818cf8] dark:to-[#67e8f9] dark:drop-shadow-[0_0_14px_rgba(129,140,248,0.28)]"

type CoraLogoProps = {
  size?: keyof typeof TEXT_SIZE
  className?: string
}

/** Compact gradient wordmark for dashboard sidebar / quick modules. */
export function CoraSidebarMark({ className }: { className?: string }) {
  return <CoraLogo size="xs" className={cn("leading-none", className)} />
}

/** 16px Lucide-sized mark for LangSmith-style nav rows. */
export function CoraNavIcon({ className }: { className?: string }) {
  return <Sparkles className={cn("size-4 shrink-0", className)} aria-hidden />
}

/** @deprecated Use CoraSidebarMark — PNG mark replaced by text wordmark. */
export const CoraNavMark = CoraSidebarMark

/** Transparent gradient wordmark — Atyp Display, no tile background. */
export function CoraLogo({ size = "md", className }: CoraLogoProps) {
  return (
    <span
      role="img"
      aria-label={CORA_NAME}
      className={cn(
        "inline-block shrink-0 select-none lowercase",
        CORA_BRAND_FONT_CLASS,
        TEXT_SIZE[size],
        GRADIENT,
        className,
      )}
    >
      cora
    </span>
  )
}

/** Inline brand word for headings — same gradient, inherits surrounding text size. */
export function CoraBrandInline({ className }: { className?: string }) {
  return (
    <span className={cn("lowercase", CORA_BRAND_FONT_CLASS, GRADIENT, className)}>
      cora
    </span>
  )
}
