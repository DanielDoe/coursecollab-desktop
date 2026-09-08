"use client"

import type { LucideIcon, ReactNode } from "react"
import { Children, isValidElement, type ReactElement } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { DesktopAuthFadeUp, useDesktopAuthMotion } from "@/components/auth/desktop-auth-motion"

export const desktopAuth = {
  title: "text-[18px] leading-[1.35] font-semibold tracking-[-0.01em] text-[var(--cc-text)]",
  subtitle: "text-[13px] leading-snug text-[var(--cc-text-secondary)]",
  label: "text-[13px] font-medium text-[var(--cc-text)]",
  input:
    "h-9 rounded-md border border-[var(--border)] bg-[var(--cc-background)] px-3 text-[13px] text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] shadow-none selection:bg-[var(--cc-auth-field-selection-bg,var(--cc-accent-soft))] selection:text-[var(--cc-auth-field-selection-text,var(--cc-text))] focus-visible:border-[var(--cc-accent)] focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]/25",
  button:
    "h-9 w-full rounded-md bg-[var(--cc-accent)] text-[13px] font-semibold text-white shadow-none transition-colors hover:bg-[var(--cc-accent-hover)] active:scale-[0.995]",
  /** Wrap primary CTA + DesktopAuthBackLink. Keeps Back tight under Sign in / Continue. */
  actionStack: "mt-4 space-y-1.5 border-t border-[var(--border)] pt-4",
  hint: "text-[12px] leading-snug text-[var(--cc-text-secondary)]",
  footerLink: "text-[12px] font-medium text-[var(--cc-accent)] hover:text-[var(--cc-accent-hover)]",
  alert: "rounded-md border p-2.5 text-[13px]",
  /** Brand-locked auth surfaces — use --cc-auth-alert-* (see globals.css), not --cc-sem-danger-*. */
  alertError:
    "border-[var(--cc-auth-alert-error-border)] bg-[var(--cc-auth-alert-error-bg)] text-[var(--cc-auth-alert-error-text)]",
  alertWarning:
    "border-[var(--cc-auth-alert-warning-border)] bg-[var(--cc-auth-alert-warning-bg)] text-[var(--cc-auth-alert-warning-text)]",
  identityMedia: "flex shrink-0 items-center justify-center",
  identityMediaFramed:
    "h-8 w-8 rounded-md bg-[var(--cc-accent-soft)] ring-1 ring-inset ring-[var(--border)]",
  identityContext: "text-[13px] font-medium leading-snug text-[var(--cc-text-secondary)]",
  footerShell: "overflow-hidden rounded-md border border-[var(--border)] bg-[var(--cc-surface)]",
  footerSectionLabel:
    "text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]",
  footerAction:
    "flex w-full items-center rounded-md px-2 py-1.5 text-left text-[12px] font-medium text-[var(--cc-text)] transition-colors hover:bg-[color-mix(in_srgb,var(--cc-accent-soft)_80%,transparent)] hover:text-[var(--cc-accent)]",
  segmentedList:
    "mb-4 grid h-9 w-full grid-cols-2 gap-1 rounded-md border border-[var(--border)] bg-[var(--cc-background)] p-0.5",
  segmentedTrigger:
    "h-full rounded-[5px] text-[12px] font-medium transition-colors data-[state=active]:bg-[var(--cc-surface)] data-[state=active]:text-[var(--cc-text)] data-[state=active]:shadow-sm data-[state=inactive]:text-[var(--cc-text-secondary)] data-[state=inactive]:hover:text-[var(--cc-text)]",
  stepProgress: "text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--cc-text-muted)]",
  panelCard:
    "rounded-lg border border-[var(--border)] bg-[var(--cc-surface)] p-5 text-[var(--cc-text)] shadow-[0_1px_2px_rgba(15,10,40,0.04)] sm:p-5",
  /** Place immediately after Sign in / Continue inside the card — never in shell chrome. */
  backLink:
    "flex h-9 w-full items-center justify-center gap-1 rounded-md text-[13px] font-medium text-[var(--cc-text-muted)] transition-colors hover:bg-[var(--cc-accent-soft)] hover:text-[var(--cc-text)]",
} as const

/** Shared horizontal rhythm — compact centered auth column. */
export const desktopAuthLayout = {
  insetX: "px-4",
  contentWidth: "w-full max-w-[360px]",
  contentColumn: "mx-auto w-full max-w-[360px]",
} as const

/** Removed — do not render a full-width app header on auth screens. */
export function DesktopAuthTitleBar(): null {
  return null
}

type DesktopAuthPageHeaderProps = {
  icon: LucideIcon
  iconClassName?: string
  title: string
  subtitle?: string
  hint?: ReactNode
}

/** Icon-led portal header (Admin, Summer Camp, Career Member). */
export function DesktopAuthPageHeader({
  icon: Icon,
  iconClassName,
  title,
  subtitle,
  hint,
}: DesktopAuthPageHeaderProps) {
  return (
    <DesktopAuthIdentityHeader
      media={<Icon className="h-4 w-4 text-[var(--cc-accent)]" aria-hidden />}
      mediaClassName={cn("bg-[var(--cc-accent-soft)]", iconClassName)}
      title={title}
      hint={subtitle ?? hint}
    />
  )
}

type DesktopAuthIdentityHeaderProps = {
  media?: ReactNode
  mediaClassName?: string
  /** Logo/mark sits inline with the context line instead of in a title icon tile. */
  unframedMedia?: boolean
  eyebrow?: ReactNode
  title?: string
  hint?: ReactNode
  className?: string
}

/** Sign-in page header — typography first, no decorative chrome. */
export function DesktopAuthIdentityHeader({
  media,
  mediaClassName,
  unframedMedia = false,
  eyebrow,
  title,
  hint,
  className,
}: DesktopAuthIdentityHeaderProps) {
  const showInlineLogo = Boolean(unframedMedia && media)

  if (!title && !eyebrow && !hint) return null

  return (
    <header className={cn("space-y-1.5", className)}>
      {title ? (
        <div className="flex items-center gap-2.5">
          {!unframedMedia && media ? (
            <div
              className={cn(
                desktopAuth.identityMedia,
                desktopAuth.identityMediaFramed,
                mediaClassName,
              )}
            >
              {media}
            </div>
          ) : null}
          <h1 className={cn("min-w-0", desktopAuth.title)}>{title}</h1>
        </div>
      ) : null}

      {eyebrow ? (
        <div
          className={cn(
            "flex min-w-0 items-center gap-2.5",
            unframedMedia && !title && "justify-center",
          )}
        >
          {showInlineLogo ? (
            <div className={cn(desktopAuth.identityMedia, mediaClassName)}>{media}</div>
          ) : null}
          <p
            className={cn(
              "min-w-0 text-[13px] font-medium text-[var(--cc-text-secondary)]",
              unframedMedia && !title ? "text-center" : "truncate",
            )}
          >
            {eyebrow}
          </p>
        </div>
      ) : null}

      {hint ? (
        <p
          className={cn(
            desktopAuth.subtitle,
            unframedMedia && !title && "text-center",
          )}
        >
          {hint}
        </p>
      ) : null}
    </header>
  )
}

type DesktopAuthUniversityHeaderProps = {
  media?: ReactNode
  name: ReactNode
  hint?: ReactNode
  className?: string
}

/** Institution mark + name for student/faculty sign-in screens. */
export function DesktopAuthUniversityHeader({
  media,
  name,
  hint,
  className,
}: DesktopAuthUniversityHeaderProps) {
  const { item, reduceMotion } = useDesktopAuthMotion()

  return (
    <motion.header
      className={cn("flex items-start gap-3 text-left", className)}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={item}
    >
      {media ? <div className="mt-0.5 flex shrink-0 items-center justify-center">{media}</div> : null}
      <div className="min-w-0 space-y-1">
        <p className={desktopAuth.title}>{name}</p>
        {hint ? <p className={desktopAuth.subtitle}>{hint}</p> : null}
      </div>
    </motion.header>
  )
}

export type DesktopAuthFooterAction =
  | { kind: "link"; href: string; label: string }
  | { kind: "button"; label: string; onClick: () => void }

export type DesktopAuthFooterSection = {
  title: string
  actions: DesktopAuthFooterAction[]
}

type DesktopAuthFooterProps = {
  sections: DesktopAuthFooterSection[]
  helpText?: string
}

function FooterActionItem({ action }: { action: DesktopAuthFooterAction }) {
  if (action.kind === "link") {
    return (
      <Link href={action.href} className={desktopAuth.footerAction}>
        {action.label}
      </Link>
    )
  }

  return (
    <button type="button" onClick={action.onClick} className={desktopAuth.footerAction}>
      {action.label}
    </button>
  )
}

export function DesktopAuthFooter({ sections, helpText }: DesktopAuthFooterProps) {
  return (
    <footer className={desktopAuth.footerShell}>
      <div
        className={cn(
          "grid grid-cols-1",
          sections.length > 1 && "sm:grid-cols-2 sm:divide-x sm:divide-[var(--border)]",
        )}
      >
        {sections.map((section, index) => (
          <div
            key={section.title}
            className={cn(
              "px-4 py-3.5",
              index > 0 && "border-t border-[var(--border)] sm:border-t-0",
            )}
          >
            <p className={desktopAuth.footerSectionLabel}>{section.title}</p>
            <ul className="mt-2.5 space-y-0.5">
              {section.actions.map((action) => (
                <li key={action.kind === "link" ? action.href : action.label}>
                  <FooterActionItem action={action} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {helpText ? (
        <p className="border-t border-[var(--border)] px-4 py-2.5 text-[12px] leading-relaxed text-[var(--cc-text-muted)]">
          {helpText}
        </p>
      ) : null}
    </footer>
  )
}

type DesktopAuthPanelProps = {
  children: ReactNode
  className?: string
  maxWidthClassName?: string
}

function isPanelFooterChild(child: ReactNode): child is ReactElement<{ children?: ReactNode }> {
  return isValidElement(child) && child.type === DesktopAuthPanelFooter
}

/** Compact in-flow column: card, then optional footer 12px below. Does not stretch to the viewport. */
export function DesktopAuthPanel({
  children,
  className,
  maxWidthClassName,
}: DesktopAuthPanelProps) {
  const items = Children.toArray(children)
  const footerItems = items.filter(isPanelFooterChild)
  const bodyItems = items.filter((child) => !isPanelFooterChild(child))
  const columnClass = cn("w-full", maxWidthClassName)

  return (
    <div className={cn("flex w-full flex-col", className)}>
      <div className={cn(columnClass, "flex w-full flex-col")}>
        {bodyItems}
        {footerItems.length > 0 ? (
          <DesktopAuthFadeUp className="shrink-0 pt-3">{footerItems}</DesktopAuthFadeUp>
        ) : null}
      </div>
    </div>
  )
}

export function DesktopAuthPanelBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn("flex flex-col", className)}>{children}</div>
}

/** Elevated surface for desktop auth form content (logo, fields, actions). */
export function DesktopAuthPanelCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div data-auth-card className={cn(desktopAuth.panelCard, className)}>
      {children}
    </div>
  )
}

export function DesktopAuthPanelFooter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={className}>{children}</div>
}

type DesktopAuthBackLinkProps = {
  href: string
  label?: string
  className?: string
}

/**
 * Always place immediately after the primary Sign in / Continue button, inside the card.
 * The shell must never render Back — this control lives in the form.
 */
export function DesktopAuthBackLink({ href, label = "Back", className }: DesktopAuthBackLinkProps) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className={cn(desktopAuth.backLink, className)}
    >
      <ChevronLeft className="h-4 w-4" aria-hidden />
      {label}
    </button>
  )
}

type DesktopAuthStepProgressProps = {
  step: number
  total: number
  label: string
  className?: string
}

export function DesktopAuthStepProgress({ step, total, label, className }: DesktopAuthStepProgressProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <p className={desktopAuth.stepProgress}>
        Step {step} of {total} · {label}
      </p>
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 w-6 rounded-full transition-colors",
              i < step ? "bg-[var(--cc-accent)]" : "bg-[var(--border)]",
            )}
            aria-hidden
          />
        ))}
      </div>
    </div>
  )
}
