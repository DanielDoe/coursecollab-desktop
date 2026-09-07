"use client"

import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"

type AnimatedCheckOptionProps = {
  id: string
  name: string
  value: string
  label: string
  checked: boolean
  onChange: (value: string) => void
  className?: string
  /** CSS color for stroke + label (defaults to theme accent). */
  color?: string
  size?: string
}

/** Animated SVG checkbox-style option (radio behavior via shared name). */
export function AnimatedCheckOption({
  id,
  name,
  value,
  label,
  checked,
  onChange,
  className,
  color,
  size = "1.25rem",
}: AnimatedCheckOptionProps) {
  return (
    <label
      htmlFor={id}
      className={cn("cc-animated-check", className)}
      style={
        {
          "--checkbox-color": color || "var(--cc-accent)",
          "--checkbox-size": size,
        } as CSSProperties
      }
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
      />
      <div className="checkmark">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden>
          <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1.5" y="1.5" width="21" height="21" rx="5" ry="5" strokeWidth="3" />
            <polyline points="7 10 12 16 22 2" strokeWidth="4" />
          </g>
        </svg>
        <span>{label}</span>
      </div>
    </label>
  )
}
