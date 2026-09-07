"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { RECOMMENDATION_PURPOSES, purposeLabel } from "@/lib/recommendation-letters-shared"

/** Ring + blur + tinted shadow — use on triggers in recommendation flows (course, instructor, purpose). */
export function recommendSelectTriggerCn(extra?: string) {
  return cn(
    "!w-full min-w-0 justify-between rounded-xl border border-slate-200/90 bg-white/95 shadow-sm shadow-black/[0.03] backdrop-blur-sm",
    "px-3.5 py-2 h-11 min-h-11 text-sm text-slate-900 dark:text-slate-100 transition-[color,border-color,box-shadow] duration-200 ease-out",
    "hover:border-sky-600/42 hover:bg-white hover:shadow-md hover:shadow-sky-600/14",
    "focus-visible:border-sky-600/60 focus-visible:!ring-sky-600/35 focus-visible:!ring-[3px] focus-visible:ring-offset-0",
    "data-[state=open]:border-sky-600/52 data-[state=open]:bg-white data-[state=open]:shadow-md data-[state=open]:shadow-sky-600/22",
    "dark:border-white/[0.12] dark:bg-slate-950/58 dark:text-slate-50",
    "dark:hover:border-sky-300/45 dark:data-[state=open]:border-sky-300/50 dark:data-[state=open]:shadow-[0_8px_32px_-12px_rgba(0,0,0,0.55)]",
    "[&>[data-slot=select-value]_span]:truncate [&>[data-slot=select-value]_span]:text-left [&_[data-slot=select-placeholder]]:text-slate-400 dark:[&_[data-slot=select-placeholder]]:text-slate-500",
    "[&>*:last-child_svg]:shrink-0 [&>*:last-child_svg]:text-sky-600/85 dark:[&>*:last-child_svg]:text-sky-300/90",
    "[&>*:last-child_svg]:transition-transform [&>*:last-child_svg]:duration-300 [&>*:last-child_svg]:ease-[cubic-bezier(0.34,1.56,0.64,1)]",
    "data-[state=open]:[&>*:last-child_svg]:rotate-180",
    extra,
  )
}

/** Popover panel for dropdown lists */
export function recommendSelectContentCn(extra?: string) {
  return cn(
    "rounded-xl border border-slate-200/90 bg-[#fffefc]/[0.99] backdrop-blur-xl backdrop-saturate-150 dark:border-sky-300/16 dark:bg-slate-900/[0.99]",
    "shadow-[0_18px_50px_-12px_rgba(88,44,131,0.22),0_8px_16px_-8px_rgba(15,23,42,0.1)] dark:shadow-[0_22px_48px_-8px_rgba(0,0,0,0.55)]",
    "!p-1.5 max-h-[min(320px,var(--radix-select-content-available-height))]",
    extra,
  )
}

/** List row — keyboard + hover */
export function recommendSelectItemCn(extra?: string) {
  return cn(
    "rounded-[0.55rem] !py-2.5 !pl-2 !pr-8 text-[13px] leading-snug whitespace-normal break-words",
    "outline-none cursor-pointer motion-safe:transition-[background,color] motion-safe:duration-150",
    "data-[highlighted]:bg-sky-600/13 data-[highlighted]:text-sky-900",
    "dark:data-[highlighted]:bg-sky-600/35 dark:data-[highlighted]:text-sky-200",
    extra,
  )
}

export function RecommendationPurposeSelect(props: {
  id?: string
  /** Current purpose key (`scholarship`, `other`, …). Pair `id` with `<Label htmlFor>`. */
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}) {
  const { id, value, onChange, disabled, className } = props

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className={recommendSelectTriggerCn(className)}>
        <SelectValue placeholder="Purpose" />
      </SelectTrigger>
      <SelectContent position="popper" sideOffset={6} align="start" className={recommendSelectContentCn()}>
        {RECOMMENDATION_PURPOSES.map((p) => (
          <SelectItem key={p} value={p} className={recommendSelectItemCn()}>
            {purposeLabel(p)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
