"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"
import { useIntentPrefetch } from "@/hooks/data/use-intent-prefetch"

const NAV_SPRING = { type: "spring", stiffness: 340, damping: 30, mass: 0.52 } as const
const HOVER_SPRING = { type: "spring", stiffness: 420, damping: 28, mass: 0.4 } as const
const FADE = { type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] } as const

export type DrawerNavItemProps = {
  href?: string
  label: string
  isActive: boolean
  collapsed: boolean
  onNavigate?: () => void
  onClick?: () => void
  icon?: LucideIcon
  iconNode?: ReactNode
  trailing?: ReactNode
  compact?: boolean
}

export function DrawerNavItem({
  href,
  label,
  isActive,
  collapsed,
  onNavigate,
  onClick,
  icon: Icon,
  iconNode,
  trailing,
  compact,
}: DrawerNavItemProps) {
  const reduceMotion = useReducedMotion()
  const { onIntentEnter, onIntentLeave } = useIntentPrefetch()
  const prefetchHref = href && href !== "#" ? href : null
  const asButton = Boolean(onClick) && !prefetchHref

  const inner = (
    <>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[6px] bg-[var(--cc-drawer-nav-hover-bg)] opacity-0 transition-opacity duration-300 ease-out",
          "group-hover:opacity-100 group-data-[active=true]:opacity-0",
        )}
      />

      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[6px] bg-[var(--cc-drawer-nav-active-bg)]"
        initial={false}
        animate={
          reduceMotion
            ? { opacity: isActive ? 1 : 0 }
            : {
                opacity: isActive ? 1 : 0,
                scale: isActive ? 1 : 0.94,
                x: isActive ? 0 : -8,
              }
        }
        transition={reduceMotion ? FADE : NAV_SPRING}
        style={{ transformOrigin: "left center" }}
      />

      {isActive ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-[color-mix(in_srgb,var(--cc-drawer-primary)_16%,transparent)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={FADE}
        />
      ) : null}

      <span className="relative z-[1] flex w-6 shrink-0 items-center justify-center">
        <motion.span
          className="flex items-center justify-center"
          initial={false}
          animate={
            reduceMotion
              ? undefined
              : {
                  scale: isActive ? 1.08 : 1,
                }
          }
          whileHover={reduceMotion || isActive ? undefined : { scale: 1.06, rotate: -4 }}
          transition={HOVER_SPRING}
        >
          {iconNode ??
            (Icon ? (
              <Icon
                className={cn(
                  "transition-colors duration-300",
                  compact ? "size-4" : "h-[22px] w-[22px]",
                  isActive
                    ? "text-[var(--cc-drawer-primary)]"
                    : "text-[var(--cc-drawer-label-secondary)] group-hover:text-[var(--cc-drawer-label)]",
                )}
                aria-hidden
              />
            ) : null)}
        </motion.span>
      </span>

      {!collapsed ? (
        <motion.span
          className="relative z-[1] min-w-0 flex-1 truncate leading-5"
          initial={false}
          animate={
            reduceMotion
              ? undefined
              : {
                  opacity: 1,
                }
          }
          transition={NAV_SPRING}
        >
          {label}
        </motion.span>
      ) : null}

      {!collapsed && trailing ? <span className="relative z-[1] flex shrink-0 items-center gap-1.5">{trailing}</span> : null}
    </>
  )

  const itemClassName = cn(
    "group relative flex min-h-8 w-full items-center gap-2.5 overflow-hidden rounded-[6px] px-2.5 py-2 text-left text-[13px] font-medium",
    collapsed && "mx-0.5 min-h-9 justify-center px-2 py-2",
    compact && collapsed && "mx-0 h-9 min-h-9 px-0",
    compact && !collapsed && "h-8 min-h-8 py-0",
    isActive ? "text-[var(--cc-drawer-primary)] font-semibold" : "text-[var(--cc-drawer-label)]",
  )

  return (
    <motion.div
      className={cn("relative", compact ? "mx-0" : "mx-1")}
      initial={false}
      whileHover={
        reduceMotion
          ? undefined
          : collapsed
            ? { scale: 1.05 }
            : { x: 4 }
      }
      whileTap={reduceMotion ? undefined : { scale: 0.975 }}
      transition={HOVER_SPRING}
    >
      {asButton ? (
        <button
          type="button"
          title={collapsed ? label : undefined}
          data-active={isActive ? "true" : "false"}
          aria-current={isActive ? "page" : undefined}
          className={itemClassName}
          onClick={onClick}
        >
          {inner}
        </button>
      ) : (
        <Link
          href={href ?? "#"}
          onClick={onNavigate ?? onClick}
          onMouseEnter={() => {
            if (prefetchHref) onIntentEnter(prefetchHref)
          }}
          onMouseLeave={onIntentLeave}
          onFocus={() => {
            if (prefetchHref) onIntentEnter(prefetchHref)
          }}
          title={collapsed ? label : undefined}
          data-active={isActive ? "true" : "false"}
          aria-current={isActive ? "page" : undefined}
          className={itemClassName}
        >
          {inner}
        </Link>
      )}
    </motion.div>
  )
}
