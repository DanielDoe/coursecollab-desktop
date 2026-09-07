"use client"

import { motion } from "@/components/student/dashboard-v2/light-motion"
import { cn } from "@/lib/utils"
import { EMBED_CARD, EMBED_INNER_PANEL } from "@/lib/appearance/embed-dashboard-ui"

interface CardWrapperProps {
  children: React.ReactNode
  className?: string
  /** Classes for inner content wrapper (use with flex layouts, e.g. flex-1 min-h-0) */
  contentClassName?: string
  delay?: number
  hover?: boolean
  id?: string
  onClick?: React.MouseEventHandler<HTMLDivElement>
  style?: React.CSSProperties
  /** embed = outer module shell; inner = muted inset panel (no nested borders) */
  variant?: "default" | "embed" | "inner"
}

/** Premium glass card — surfaces follow selected appearance theme */
export function CardWrapper({
  children,
  className,
  contentClassName,
  delay = 0,
  hover = true,
  id,
  onClick,
  style,
  variant = "default",
}: CardWrapperProps) {
  const isEmbed = variant === "embed"
  const isInner = variant === "inner"

  return (
    <motion.div
      id={id}
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: isEmbed || isInner ? 0.2 : 0.6, delay }}
      onClick={onClick}
      style={style}
      className={cn(
        "group relative h-auto",
        isEmbed || isInner ? "overflow-hidden" : hover ? "overflow-hidden" : "overflow-visible",
        isEmbed && cn(EMBED_CARD, "shadow-none"),
        isInner && cn(EMBED_INNER_PANEL, "border-0 shadow-none"),
        !isEmbed &&
          !isInner &&
          cn(
            "border border-[var(--border)] dark:border-white/[0.06]",
            "rounded-2xl sm:rounded-3xl",
            "bg-[var(--card)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.07)]",
            "dark:bg-[var(--card)] dark:shadow-none",
            "transition-[box-shadow,border-color,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
            hover &&
              "hover:scale-[1.005] hover:border-[var(--border)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_12px_36px_rgba(0,0,0,0.45)]",
          ),
        className,
      )}
    >
      {hover && !isEmbed && !isInner ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:group-hover:opacity-100"
          style={{
            // Material state layer — neutral, not accent/gold wash
            background:
              "color-mix(in srgb, var(--cc-text) 4%, transparent)",
          }}
          aria-hidden
        />
      ) : null}
      <div className={cn("relative z-10", contentClassName)}>{children}</div>
    </motion.div>
  )
}
