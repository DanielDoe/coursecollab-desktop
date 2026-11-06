"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { facultyEmbedChrome, type FacultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { cn } from "@/lib/utils"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

export const projectFormInputClass =
  "h-11 rounded-lg border-[var(--border)] bg-[var(--card)] shadow-none transition-colors focus-visible:border-[var(--cc-accent)] focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]/25"

export const projectFormTextareaClass =
  "min-h-[100px] resize-none rounded-lg border-[var(--border)] bg-[var(--card)] shadow-none transition-colors focus-visible:border-[var(--cc-accent)] focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]/25"

export const projectFormSelectTriggerClass = cn(projectFormInputClass, "w-full")

export const projectTabListClass =
  "min-h-11 h-auto w-full sm:w-fit max-w-full flex flex-wrap gap-1 justify-start rounded-xl border border-[var(--border)] !bg-[var(--card)] p-1 shadow-none"

export const projectTabTriggerClass = cn(
  "flex !flex-none items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium shrink-0 border border-transparent shadow-none whitespace-nowrap",
  "text-[var(--cc-text-secondary)] hover:bg-[var(--muted)]/40 hover:text-[var(--cc-text)]",
  "data-[state=active]:border-[var(--cc-accent)]/30 data-[state=active]:bg-[var(--cc-accent)] data-[state=active]:!text-white data-[state=active]:shadow-sm",
)

export const projectCardHeaderClass = "border-b border-[var(--border)] py-4 px-6"
export const projectCardTitleClass = cn("text-base font-semibold", PORTAL_TEXT)
export const projectCardMutedClass = cn("text-sm", PORTAL_TEXT_MUTED, "mt-0.5")
export const projectLabelClass = cn("text-sm font-medium", PORTAL_TEXT)
export const projectHintClass = cn("text-xs", PORTAL_TEXT_MUTED)

export function useProjectFormStyles(moduleId = "projects") {
  const chrome = facultyEmbedChrome(moduleId)
  return {
    chrome,
    card: chrome.card,
    cardHeader: projectCardHeaderClass,
    title: projectCardTitleClass,
    muted: projectCardMutedClass,
    label: projectLabelClass,
    hint: projectHintClass,
    input: projectFormInputClass,
    textarea: projectFormTextareaClass,
  }
}

export function ProjectFormPageHeader({
  title,
  description,
  chrome,
  action,
  icon: Icon,
  status,
}: {
  title: string
  description?: string
  chrome: FacultyEmbedChrome
  action?: ReactNode
  icon?: LucideIcon
  status?: string
}) {
  return (
    <header className="mb-1 flex min-w-0 items-start justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
        <div className={chrome.iconBadge("md")}>
          {Icon ? <Icon className="h-5 w-5 !text-white" strokeWidth={2} /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("text-[11px] font-semibold uppercase tracking-wide", chrome.accentIcon)}>
              Project configuration
            </span>
            {status ? (
              <>
                <span className={PORTAL_TEXT_MUTED} aria-hidden>
                  ·
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 rounded-md border-0 px-1.5 py-0 text-[10px] font-medium capitalize",
                    status === "published"
                      ? "bg-[var(--cc-sem-success)]/10 text-[var(--cc-sem-success)]"
                      : status === "archived"
                        ? "bg-muted text-[var(--cc-text-muted)]"
                        : "bg-muted text-[var(--cc-text-muted)]",
                  )}
                >
                  {status}
                </Badge>
              </>
            ) : null}
          </div>
          <h1 className={cn("truncate text-lg font-semibold leading-snug sm:text-xl", PORTAL_TEXT)}>{title}</h1>
          {description ? <p className={cn("mt-0.5 text-sm", PORTAL_TEXT_MUTED)}>{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}

export function ProjectFormFieldGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-5 sm:grid-cols-2", className)}>{children}</div>
}

export function ProjectFormField({
  label,
  hint,
  children,
  span = 1,
  htmlFor,
}: {
  label: string
  hint?: string
  children: ReactNode
  span?: 1 | 2
  htmlFor?: string
}) {
  return (
    <div className={cn("space-y-2", span === 2 && "sm:col-span-2")}>
      <Label htmlFor={htmlFor} className={projectLabelClass}>
        {label}
      </Label>
      {children}
      {hint ? <p className={projectHintClass}>{hint}</p> : null}
    </div>
  )
}

export function ProjectFormSwitchPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-3", className)}>{children}</div>
}

export function ProjectFormSwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  chrome,
}: {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
  chrome: FacultyEmbedChrome
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{label}</p>
        {description ? <p className={cn("text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{description}</p> : null}
      </div>
      <Switch
        disabled={disabled}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={chrome.switchChecked}
      />
    </div>
  )
}

export function ProjectFormCallout({ children }: { children: ReactNode }) {
  return (
    <p
      className={cn(
        "rounded-lg border border-[var(--border)] bg-muted/30 px-4 py-3 text-sm leading-relaxed",
        PORTAL_TEXT_MUTED,
      )}
    >
      {children}
    </p>
  )
}

export function ProjectFormSegmented({
  options,
  value,
  onChange,
  disabled,
  chrome,
  compact,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  chrome: FacultyEmbedChrome
  compact?: boolean
}) {
  return (
    <div className={cn(projectTabListClass, "inline-flex shrink-0", compact && "min-h-8 p-0.5")}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          className={cn(
            projectTabTriggerClass,
            "justify-center",
            compact && "px-2.5 py-1 text-xs",
            value === opt.value && "border-[var(--cc-accent)]/30 bg-[var(--cc-accent)] !text-white shadow-sm",
          )}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function ProjectFormStickyFooter({
  children,
  className,
}: {
  chrome?: FacultyEmbedChrome
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2 pt-2", className)}>
      {children}
    </div>
  )
}

export function ProjectFormLoading() {
  return (
    <div className="space-y-4 py-2">
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
