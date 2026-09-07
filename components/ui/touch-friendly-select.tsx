"use client"

import { useEffect, useState } from "react"
import { isPhoneOrTabletDevice } from "@/lib/device-utils"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type TouchFriendlySelectOption = {
  value: string
  label: string
  disabled?: boolean
}

type TouchFriendlySelectProps = {
  value: string
  onValueChange: (value: string) => void
  options: TouchFriendlySelectOption[]
  placeholder?: string
  id?: string
  /** Applied to both native select and Radix trigger */
  triggerClassName?: string
  contentClassName?: string
  /** Optional icon rendered inside Radix trigger only (native uses aria-label via placeholder) */
  icon?: React.ReactNode
}

/**
 * Uses native <select> on phones/tablets (incl. iPadOS desktop UA) where Radix Select
 * often fails to open or scroll on touch; desktop keeps Radix for consistent styling.
 */
export function TouchFriendlySelect({
  value,
  onValueChange,
  options,
  placeholder,
  id,
  triggerClassName,
  contentClassName,
  icon,
}: TouchFriendlySelectProps) {
  const [useNative, setUseNative] = useState(false)

  useEffect(() => {
    setUseNative(isPhoneOrTabletDevice())
  }, [])

  if (useNative) {
    return (
      <div className={cn("relative min-w-0", triggerClassName?.includes("w-full") ? "w-full" : "")}>
        {icon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400">
            {icon}
          </span>
        ) : null}
        <select
          id={id}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          aria-label={placeholder}
          className={cn(
            "flex w-full min-w-0 appearance-none rounded-2xl border px-3 py-2 text-sm font-medium",
            "h-9 sm:h-10 min-h-[44px] touch-manipulation cursor-pointer",
            "bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-700/60",
            "text-slate-900 dark:text-slate-100",
            icon ? "pl-9" : "",
            triggerClassName,
          )}
        >
          {placeholder && (value === "" || !options.some((o) => o.value === value)) ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} className={triggerClassName}>
        {icon}
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
