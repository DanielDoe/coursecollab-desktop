"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { CodebenchBadgeId } from "@/lib/codebench-badge-catalog"

type MarkProps = {
  className?: string
}

function Frame({
  children,
  className,
  variant = "shield",
}: {
  children: ReactNode
  className?: string
  variant?: "shield" | "hex" | "medal" | "tile"
}) {
  const clip =
    variant === "hex"
      ? "polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0% 50%)"
      : variant === "medal"
        ? "circle(46% at 50% 50%)"
        : variant === "tile"
          ? "polygon(8% 0%, 92% 0%, 100% 8%, 100% 92%, 92% 100%, 8% 100%, 0% 92%, 0% 8%)"
          : "polygon(50% 0%, 92% 12%, 100% 38%, 82% 100%, 18% 100%, 0% 38%, 8% 12%)"

  return (
    <div
      className={cn(
        "relative flex size-full items-center justify-center overflow-hidden",
        className,
      )}
      style={{ clipPath: clip }}
    >
      <div className="absolute inset-0 bg-white/15" />
      <div className="absolute inset-[10%] rounded-[inherit] bg-black/10" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

function Svg({ children, viewBox = "0 0 64 64" }: { children: ReactNode; viewBox?: string }) {
  return (
    <svg viewBox={viewBox} className="size-14 drop-shadow-md sm:size-16" fill="none" aria-hidden>
      {children}
    </svg>
  )
}

const MARKS: Record<CodebenchBadgeId, (p: MarkProps) => ReactNode> = {
  loops_master: () => (
    <Frame variant="hex">
      <Svg>
        <circle cx="32" cy="32" r="14" stroke="currentColor" strokeWidth="3" opacity="0.35" />
        <path
          d="M32 18a14 14 0 0 1 12 7M46 32a14 14 0 0 1-7 12M32 46a14 14 0 0 1-12-7M18 32a14 14 0 0 1 7-12"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path d="M42 18l6 2-2 6M22 46l-6-2 2-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Frame>
  ),
  bug_hunter: () => (
    <Frame variant="tile">
      <Svg>
        <ellipse cx="32" cy="34" rx="11" ry="13" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="32" cy="22" r="7" fill="currentColor" opacity="0.25" stroke="currentColor" strokeWidth="2.5" />
        <path d="M21 28l-8-4M43 28l8-4M20 38l-8 2M44 38l8 2M20 46l-6 6M44 46l6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="29" cy="21" r="1.5" fill="currentColor" />
        <circle cx="35" cy="21" r="1.5" fill="currentColor" />
      </Svg>
    </Frame>
  ),
  clean_code: () => (
    <Frame variant="medal">
      <Svg>
        <path d="M20 40L28 20h4l8 20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24 32h12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M40 22l8 10-8 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
        <path d="M16 42h32" stroke="currentColor" strokeWidth="2" opacity="0.35" />
      </Svg>
    </Frame>
  ),
  oop_apprentice: () => (
    <Frame variant="shield">
      <Svg>
        <rect x="18" y="16" width="28" height="14" rx="3" stroke="currentColor" strokeWidth="2.5" fill="currentColor" opacity="0.15" />
        <rect x="14" y="34" width="16" height="14" rx="2.5" stroke="currentColor" strokeWidth="2.5" fill="currentColor" opacity="0.12" />
        <rect x="34" y="34" width="16" height="14" rx="2.5" stroke="currentColor" strokeWidth="2.5" fill="currentColor" opacity="0.12" />
        <path d="M32 30v4M22 34v-2c0-2 4-4 10-4s10 2 10 4v2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </Svg>
    </Frame>
  ),
  pointer_pathfinder: () => (
    <Frame variant="hex">
      <Svg>
        <circle cx="22" cy="22" r="5" stroke="currentColor" strokeWidth="2.5" fill="currentColor" opacity="0.2" />
        <path d="M26 26l14 14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M36 44l8-2-2-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 40h10M40 18v10" stroke="currentColor" strokeWidth="2" opacity="0.4" strokeLinecap="round" />
      </Svg>
    </Frame>
  ),
  recursion_king: () => (
    <Frame variant="medal">
      <Svg>
        <path
          d="M32 14c10 0 16 7 16 14 0 6-4 10-9 12"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M32 50c-10 0-16-7-16-14 0-6 4-10 9-12"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M36 38l7 2-2 7M28 26l-7-2 2-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="32" cy="32" r="4" fill="currentColor" opacity="0.35" />
      </Svg>
    </Frame>
  ),
  stl_expert: () => (
    <Frame variant="tile">
      <Svg>
        <rect x="16" y="14" width="32" height="36" rx="3" stroke="currentColor" strokeWidth="2.5" fill="currentColor" opacity="0.12" />
        <path d="M22 24h20M22 32h16M22 40h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M40 40h6v6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      </Svg>
    </Frame>
  ),
  arrays_ace: () => (
    <Frame variant="hex">
      <Svg>
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={14 + i * 10}
            y={20 + (i % 2) * 4}
            width="8"
            height="22"
            rx="2"
            stroke="currentColor"
            strokeWidth="2.2"
            fill="currentColor"
            opacity={0.12 + i * 0.06}
          />
        ))}
        <path d="M14 48h36" stroke="currentColor" strokeWidth="2" opacity="0.35" strokeLinecap="round" />
      </Svg>
    </Frame>
  ),
  first_blood: () => (
    <Frame variant="shield">
      <Svg>
        <path d="M32 12l4 14h14l-11 9 4 14-11-8-11 8 4-14-11-9h14z" stroke="currentColor" strokeWidth="2.5" fill="currentColor" opacity="0.18" strokeLinejoin="round" />
        <circle cx="32" cy="30" r="3" fill="currentColor" />
      </Svg>
    </Frame>
  ),
  rising_coder: () => (
    <Frame variant="tile">
      <Svg>
        <path d="M14 44l12-14 8 6 16-18" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M42 18h8v8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 48h36" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      </Svg>
    </Frame>
  ),
  perfectionist: () => (
    <Frame variant="medal">
      <Svg>
        <circle cx="32" cy="32" r="16" stroke="currentColor" strokeWidth="2.5" opacity="0.35" />
        <circle cx="32" cy="32" r="10" stroke="currentColor" strokeWidth="2.5" opacity="0.55" />
        <circle cx="32" cy="32" r="4" fill="currentColor" />
        <path d="M32 12v4M32 48v4M12 32h4M48 32h4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </Svg>
    </Frame>
  ),
  high_scorer: () => (
    <Frame variant="shield">
      <Svg>
        <path
          d="M32 14l4.2 9.5 10.3 1-7.8 7 2.3 10.2L32 36.5l-8.9 5.2 2.3-10.2-7.8-7 10.3-1z"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="currentColor"
          opacity="0.2"
          strokeLinejoin="round"
        />
        <circle cx="32" cy="50" r="2.5" fill="currentColor" opacity="0.5" />
      </Svg>
    </Frame>
  ),
  challenge_starter: () => (
    <Frame variant="tile">
      <Svg>
        <path d="M18 16h6v32M24 16c10 0 10 8 20 8v16c-10 0-10-8-20-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" opacity="0.12" />
        <circle cx="18" cy="50" r="3" fill="currentColor" />
      </Svg>
    </Frame>
  ),
  challenge_champ: () => (
    <Frame variant="medal">
      <Svg>
        <circle cx="32" cy="26" r="12" stroke="currentColor" strokeWidth="2.5" fill="currentColor" opacity="0.15" />
        <path d="M24 36l-4 16 12-6 12 6-4-16" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" fill="currentColor" opacity="0.12" />
        <path d="M28 24h8M32 20v8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </Svg>
    </Frame>
  ),
  practice_pro: () => (
    <Frame variant="hex">
      <Svg>
        <rect x="18" y="14" width="28" height="36" rx="3" stroke="currentColor" strokeWidth="2.5" fill="currentColor" opacity="0.12" />
        <path d="M24 24h16M24 32h16M24 40h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M40 42l6-2-1 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Frame>
  ),
  streak_3: () => (
    <Frame variant="shield">
      <Svg>
        <path d="M34 12c2 10-6 12-6 22 0 6 4 10 8 10-8 0-16-6-16-16 0-8 6-12 8-16 2 4 4 6 6 0z" fill="currentColor" opacity="0.25" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <text x="32" y="48" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="700" opacity="0.9">
          3
        </text>
      </Svg>
    </Frame>
  ),
  streak_7: () => (
    <Frame variant="hex">
      <Svg>
        <path d="M28 12c2 8-4 10-4 18 0 5 3 8 7 8-7 0-14-5-14-14 0-7 5-10 7-14 2 3 3 5 4 2z" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="2.2" />
        <path d="M40 16c1.5 7-3 9-3 16 0 4 2.5 7 6 7-6 0-12-4-12-12 0-6 4-9 6-12 1.5 2.5 2.5 4 3 1z" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="2.2" />
        <text x="32" y="50" textAnchor="middle" fill="currentColor" fontSize="11" fontWeight="700">
          7
        </text>
      </Svg>
    </Frame>
  ),
  streak_14: () => (
    <Frame variant="tile">
      <Svg>
        <path d="M22 14c2 8-4 10-4 18 0 5 3 8 7 8" stroke="currentColor" strokeWidth="2.5" fill="currentColor" opacity="0.15" />
        <path d="M32 12c2 9-5 11-5 20 0 5 3.5 9 8 9" stroke="currentColor" strokeWidth="2.5" fill="currentColor" opacity="0.2" />
        <path d="M42 16c1.5 7-3 9-3 15 0 4 2 7 5 7" stroke="currentColor" strokeWidth="2.5" fill="currentColor" opacity="0.28" />
        <text x="32" y="50" textAnchor="middle" fill="currentColor" fontSize="11" fontWeight="700">
          14
        </text>
      </Svg>
    </Frame>
  ),
  streak_30: () => (
    <Frame variant="medal">
      <Svg>
        <path d="M32 10c3 10-6 13-6 24 0 7 5 12 10 12-10 0-18-7-18-18 0-9 7-14 10-18 2 4 3 6 4 0z" fill="currentColor" opacity="0.28" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="32" cy="32" r="5" fill="currentColor" opacity="0.35" />
        <text x="32" y="52" textAnchor="middle" fill="currentColor" fontSize="10" fontWeight="700">
          30
        </text>
      </Svg>
    </Frame>
  ),
  xp_collector: () => (
    <Frame variant="hex">
      <Svg>
        <path d="M32 12l14 10v20L32 52 18 42V22z" stroke="currentColor" strokeWidth="2.5" fill="currentColor" opacity="0.18" strokeLinejoin="round" />
        <path d="M32 22l8 5v10l-8 5-8-5V27z" stroke="currentColor" strokeWidth="2.2" fill="currentColor" opacity="0.25" />
        <circle cx="32" cy="32" r="3" fill="currentColor" />
      </Svg>
    </Frame>
  ),
}

export function BadgeMark({
  badgeId,
  className,
}: {
  badgeId: string
  className?: string
}) {
  const Mark = MARKS[badgeId as CodebenchBadgeId]
  if (!Mark) {
    return (
      <div className={cn("flex size-full items-center justify-center", className)}>
        <Frame variant="medal">
          <Svg>
            <circle cx="32" cy="32" r="12" stroke="currentColor" strokeWidth="3" />
            <path d="M32 24v10M32 40h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </Svg>
        </Frame>
      </div>
    )
  }
  return (
    <div className={cn("flex size-full items-center justify-center p-3", className)}>
      <Mark />
    </div>
  )
}
