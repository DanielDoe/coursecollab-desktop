"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { LayoutGroup, motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_CARD, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

export type FacultySideMenuTone = "default" | "warning" | "destructive"

export type FacultySideMenuItem = {
  id: string
  label: string
  icon: LucideIcon
  badge?: number | string
  tone?: FacultySideMenuTone
  href?: string
}

function toneItemClass(tone: FacultySideMenuTone | undefined, active: boolean): string | null {
  if (tone === "destructive") {
    return active
      ? "bg-red-500/15 dark:bg-red-500/25 text-red-700 dark:text-red-300 font-medium"
      : "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
  }
  if (tone === "warning") {
    return active
      ? "bg-amber-500/15 dark:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-medium"
      : "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10"
  }
  return null
}

function toneBadgeClass(
  tone: FacultySideMenuTone | undefined,
  active: boolean,
  moduleIconText: string,
): string {
  if (tone === "destructive") {
    return active ? "text-red-600 dark:text-red-400" : "text-red-500/70"
  }
  if (tone === "warning") {
    return active ? "text-amber-600 dark:text-amber-400" : "text-amber-500/70"
  }
  return active ? moduleIconText : "text-[var(--cc-text-muted)]"
}

type FacultyModuleSideMenuProps = {
  moduleId: string
  title: string
  items: FacultySideMenuItem[]
  activeId: string
  onSelect?: (id: string) => void
  footer?: ReactNode
  className?: string
  /** Horizontal scroll on small screens (default true). */
  mobileHorizontal?: boolean
  /** Flat nav when nested inside CardWrapper / embed shell */
  embedded?: boolean
  /** Hide the uppercase section title (breadcrumbs already identify the module). */
  hideTitle?: boolean
  /** Theme tokens, muted gray, custom swatch, or faculty module chrome. */
  accent?: "theme" | "neutral" | { soft: string; ink: string }
}

export function FacultyModuleSideMenu({
  moduleId,
  title,
  items,
  activeId,
  onSelect,
  footer,
  className,
  mobileHorizontal = true,
  embedded = false,
  hideTitle = false,
  accent,
}: FacultyModuleSideMenuProps) {
  const { p: fp } = facultyEmbedChrome(moduleId)

  const renderItem = (item: FacultySideMenuItem) => {
    const isActive = activeId === item.id
    const toneClass = toneItemClass(item.tone, isActive)
    const swatch = typeof accent === "object" && accent != null ? accent : null
    const useTheme = accent === "theme" && !toneClass
    const useNeutral = accent === "neutral" && !toneClass
    const useSwatch = swatch != null && !toneClass
    const className = cn(
      "group relative isolate flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm whitespace-nowrap shrink-0 lg:w-full lg:shrink",
      "transition-[color,transform] duration-200 ease-out",
      !isActive && "hover:translate-x-0.5 hover:text-[var(--cc-text)] active:scale-[0.98]",
      toneClass ??
        (isActive
          ? useNeutral
            ? "font-semibold text-[var(--cc-text)] dark:font-medium dark:text-white"
            : useTheme || !useSwatch
              ? "font-medium text-[var(--cc-accent-dark)] dark:text-[var(--cc-accent)]"
              : "font-medium"
          : "text-[var(--cc-text-muted)]"),
    )
    const pillClass = cn(
      "absolute inset-0 -z-10 rounded-lg",
      toneClass
        ? null
        : useNeutral
          ? "bg-[#F4F6F8] dark:bg-white/12"
          : "bg-[var(--cc-accent-soft)] dark:bg-[var(--cc-accent-soft-strong)]",
    )
    const accentStyle =
      useSwatch && isActive && swatch
        ? { backgroundColor: swatch.soft, color: swatch.ink }
        : undefined

    const inner = (
      <>
        {isActive ? (
          <motion.span
            layoutId={`faculty-sidemenu-pill-${moduleId}`}
            className={pillClass}
            style={useSwatch && swatch ? { backgroundColor: swatch.soft } : undefined}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          />
        ) : (
          <span className="absolute inset-0 -z-10 rounded-lg bg-transparent transition-colors duration-200 group-hover:bg-[var(--muted)]" />
        )}
        <div className="relative flex items-center gap-2 min-w-0">
          <item.icon
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
              isActive && "scale-110",
              !toneClass && (isActive ? fp.iconText : "text-[var(--cc-text)]"),
            )}
          />
          <span className="truncate">{item.label}</span>
        </div>
        {item.badge !== undefined && item.badge !== null && (typeof item.badge !== "number" || item.badge > 0) ? (
          typeof item.badge === "number" ? (
            <span
              className={cn(
                "inline-flex min-h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                item.tone === "destructive"
                  ? "bg-red-500 text-white"
                  : item.tone === "warning"
                    ? "bg-amber-500 text-amber-950"
                    : isActive
                      ? cn(fp.softBg, fp.iconText, "font-semibold")
                      : "bg-[var(--muted)] text-[var(--cc-text-secondary)]",
              )}
            >
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          ) : (
          <span
            className={cn(
              "text-xs tabular-nums shrink-0",
              useNeutral && isActive
                ? "text-[var(--cc-text)]"
                : useTheme && isActive
                  ? "text-[var(--cc-accent-dark)] dark:text-[var(--cc-accent)]"
                  : useSwatch && isActive
                    ? undefined
                    : toneBadgeClass(item.tone, isActive, fp.iconText),
            )}
            style={
              useSwatch && isActive && swatch
                ? { color: swatch.ink }
                : undefined
            }
          >
            {item.badge}
          </span>
          )
        ) : null}
      </>
    )

    if (item.href) {
      return (
        <Link key={item.id} href={item.href} className={className} style={accentStyle}>
          {inner}
        </Link>
      )
    }

    return (
      <button key={item.id} type="button" onClick={() => onSelect?.(item.id)} className={className} style={accentStyle}>
        {inner}
      </button>
    )
  }

  return (
    <div className={cn(embedded ? "min-w-0" : cn(PORTAL_CARD, "overflow-hidden"), className)}>
      {!hideTitle ? (
        <div
          className={cn(
            "px-3 py-2.5",
            embedded ? "px-0 pt-0 pb-2.5" : "border-b border-[var(--border)]",
          )}
        >
          <p className={cn("text-xs font-semibold uppercase tracking-wider", PORTAL_TEXT_MUTED)}>{title}</p>
        </div>
      ) : null}
      <LayoutGroup id={`faculty-sidemenu-${moduleId}`}>
      <nav
        className={cn(
          embedded ? "p-0" : "p-1.5",
          mobileHorizontal
            ? "flex flex-row gap-1 overflow-x-auto lg:flex-col lg:overflow-visible lg:space-y-0.5"
            : "space-y-0.5",
        )}
      >
        {items.map(renderItem)}
      </nav>
      </LayoutGroup>
      {footer ? <div className="border-t border-[var(--border)] p-3">{footer}</div> : null}
    </div>
  )
}
