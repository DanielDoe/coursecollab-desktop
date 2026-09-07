"use client"

import { cn } from "@/lib/utils"
import { CORA_NAME } from "@/lib/cora/constants"

const MARK_SIZE = {
  xs: "h-7 w-5",
  sm: "h-10 w-7",
  md: "h-14 w-10",
  lg: "h-[4.5rem] w-12",
  xl: "h-24 w-16",
} as const

const ICON_SIZE = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-7 w-7",
  xl: "h-9 w-9",
} as const

type MarkSize = keyof typeof MARK_SIZE

const MARK_FILTER =
  "[filter:drop-shadow(0_1px_0_rgba(15,23,42,0.06))_drop-shadow(0_4px_10px_rgba(15,23,42,0.16))] dark:[filter:drop-shadow(0_2px_8px_rgba(0,0,0,0.5))_drop-shadow(0_0_14px_rgba(94,200,248,0.16))]"

type CoraBotMarkProps = {
  size?: MarkSize
  className?: string
  decorative?: boolean
  idle?: boolean
}

/** Transparent 3D Cora graduate mark. White body stays readable on light and dark. */
export function CoraBotMark({ size = "md", className, decorative = true, idle = false }: CoraBotMarkProps) {
  return (
    <span className={cn("relative inline-flex flex-col items-center", className)}>
      <img
        src="/cora/cora-grad-bot.png"
        alt={decorative ? "" : CORA_NAME}
        aria-hidden={decorative || undefined}
        draggable={false}
        className={cn("select-none object-contain object-center", MARK_SIZE[size], MARK_FILTER, idle && "cora-bot-idle")}
      />
      {idle ? (
        <span
          aria-hidden
          className="cora-bot-ground-shadow pointer-events-none mt-0.5 h-1.5 w-[70%] rounded-[100%] bg-[color-mix(in_srgb,var(--cc-text)_22%,transparent)] dark:bg-black/50"
        />
      ) : null}
    </span>
  )
}

type CoraBotIconProps = {
  size?: MarkSize
  className?: string
  title?: string
}

/** Compact SVG derived from the graduate bot — use at 14–36px. */
export function CoraBotIcon({ size = "md", className, title }: CoraBotIconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", ICON_SIZE[size], className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <ellipse className="fill-[#f4f4f6] stroke-[color-mix(in_srgb,var(--cc-text)_16%,transparent)] dark:fill-[#f7f7f8] dark:stroke-white/10" cx="16" cy="24.2" rx="6.2" ry="4.6" strokeWidth="0.6" />
      <ellipse className="fill-[#f4f4f6] stroke-[color-mix(in_srgb,var(--cc-text)_16%,transparent)] dark:fill-[#f7f7f8] dark:stroke-white/10" cx="8.4" cy="22.6" rx="2.1" ry="2.6" strokeWidth="0.5" />
      <ellipse className="fill-[#f4f4f6] stroke-[color-mix(in_srgb,var(--cc-text)_16%,transparent)] dark:fill-[#f7f7f8] dark:stroke-white/10" cx="23.6" cy="22.6" rx="2.1" ry="2.6" strokeWidth="0.5" />
      <circle className="fill-[#f4f4f6] stroke-[color-mix(in_srgb,var(--cc-text)_16%,transparent)] dark:fill-[#f7f7f8] dark:stroke-white/10" cx="16" cy="15.4" r="7.4" strokeWidth="0.6" />
      <rect className="fill-[#17171a] dark:fill-[#0d0d10]" x="10.2" y="13.4" width="11.6" height="4.4" rx="2.2" />
      <path d="M12.6 16.4c.7-1.1 1.8-1.1 2.4 0" className="stroke-[#4bb8f0] dark:stroke-[#7dd3fc]" strokeWidth="1.15" strokeLinecap="round" />
      <path d="M17 16.4c.7-1.1 1.8-1.1 2.4 0" className="stroke-[#4bb8f0] dark:stroke-[#7dd3fc]" strokeWidth="1.15" strokeLinecap="round" />
      <path className="fill-[#141416] dark:fill-[#070709]" d="M8.4 9.6 16 7.2l7.6 2.4-7.6 2.2L8.4 9.6Z" />
      <rect className="fill-[#141416] dark:fill-[#070709]" x="10.6" y="8.7" width="10.8" height="1.5" rx="0.4" />
      <circle className="fill-[#141416] dark:fill-[#070709]" cx="16" cy="8.1" r="1" />
      <path d="M16 8.2c2.2.15 3.8 1.4 4.1 3.6" className="stroke-[#e8b84a]" strokeWidth="1.15" strokeLinecap="round" />
      <circle className="fill-[#e8b84a]" cx="20.2" cy="12.4" r="1.05" />
    </svg>
  )
}
