"use client"

import { useId } from "react"
import { motion } from "framer-motion"

/** Ring fully visible — viewBox padded so circle encloses bottle */
const RING = { cx: 50, cy: 96, r: 97 }
const VB = { minX: RING.cx - RING.r - 6, minY: -28, w: (RING.r + 6) * 2, h: 228 }

const SHAPES = {
  body: { x: 16, y: 48, w: 68, h: 128, rx: 14 },
  cap: { x: 26, y: 30, w: 48, h: 18, rx: 6 },
  lid: { x: 38, y: 12, w: 24, h: 14, rx: 5 },
  loop: { x: 76, y: 34, w: 16, h: 7, rx: 3.5 },
  /** Fillable chamber only (below shoulder curve, above bottom curve) */
  inner: { x: 20, y: 62, w: 60, h: 100, rx: 10 },
  shine: { x: 66, y: 62, h: 98 },
} as const

const SW = 4.2
const CIRC = 2 * Math.PI * RING.r

/** Gentle slosh — repeats every few seconds */
const BOTTLE_SHAKE = {
  rotate: [0, -4, 4, -3, 3, -2, 2, 0],
  x: [0, -3, 3, -2, 2, -1, 1, 0],
}
const BOTTLE_SHAKE_TRANSITION = {
  duration: 0.65,
  repeat: Infinity,
  repeatDelay: 2.5,
  ease: "easeInOut" as const,
}

const viewBox = `${VB.minX} ${VB.minY} ${VB.w} ${VB.h}`

/** Bubbles spawn at the cap and float up past the ring */
const RISING_BUBBLES = [
  { cx: 44, delay: 0, r: 3.8, drift: -6, duration: 2.6 },
  { cx: 50, delay: 0.4, r: 3.2, drift: 0, duration: 2.3 },
  { cx: 56, delay: 0.85, r: 4.2, drift: 5, duration: 2.8 },
  { cx: 47, delay: 1.25, r: 2.8, drift: -4, duration: 2.4 },
  { cx: 53, delay: 1.65, r: 3.5, drift: 4, duration: 2.5 },
  { cx: 49, delay: 2.05, r: 2.5, drift: -3, duration: 2.2 },
  { cx: 51, delay: 2.45, r: 3, drift: 3, duration: 2.7 },
] as const

const BUBBLE_SPAWN_Y = 16
const BUBBLE_RISE_Y = -12

const HTML_BUBBLES = [
  { left: "46%", delay: 0, size: 9, drift: -14 },
  { left: "50%", delay: 0.35, size: 7, drift: 0 },
  { left: "54%", delay: 0.7, size: 10, drift: 12 },
  { left: "48%", delay: 1.05, size: 6, drift: -8 },
  { left: "52%", delay: 1.4, size: 8, drift: 10 },
  { left: "49%", delay: 1.75, size: 5, drift: -6 },
  { left: "51%", delay: 2.1, size: 7, drift: 7 },
] as const

function RisingHtmlBubbles({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-visible">
      {HTML_BUBBLES.map((b, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full border border-cyan-100/80 bg-cyan-200/50 shadow-[0_0_10px_rgba(34,211,238,0.55)]"
          style={{
            left: b.left,
            top: "20%",
            width: b.size,
            height: b.size,
            marginLeft: -b.size / 2,
          }}
          initial={{ y: 0, opacity: 0, scale: 0.35 }}
          animate={{
            y: [0, -55, -95],
            x: [0, b.drift * 0.45, b.drift],
            opacity: [0, 1, 0.85, 0],
            scale: [0.35, 1.15, 1, 0.65],
          }}
          transition={{
            duration: 2.4 + (i % 3) * 0.25,
            delay: b.delay,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  )
}

type WaterBreakBottleProps = {
  progress: number
  ringProgress: number
}

export function ReferenceWaterBottle({ progress, ringProgress }: WaterBreakBottleProps) {
  const uid = useId().replace(/:/g, "")
  const fill = Math.max(0, Math.min(1, progress))
  const { inner } = SHAPES
  const waterTop = inner.y + inner.h - fill * inner.h

  return (
    <div className="relative flex h-[16rem] w-[11rem] items-center justify-center overflow-visible sm:h-[17.5rem] sm:w-[12rem]">
      {/* Timer ring — stays still */}
      <svg
        viewBox={viewBox}
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id={`wb-ring-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="45%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
          <filter id={`wb-ring-glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g transform={`rotate(-90 ${RING.cx} ${RING.cy})`}>
          <circle
            cx={RING.cx}
            cy={RING.cy}
            r={RING.r}
            fill="none"
            stroke="rgba(148,163,184,0.28)"
            strokeWidth="2"
          />
          <motion.circle
            cx={RING.cx}
            cy={RING.cy}
            r={RING.r}
            fill="none"
            stroke={`url(#wb-ring-${uid})`}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            filter={`url(#wb-ring-glow-${uid})`}
            animate={{ strokeDashoffset: CIRC * (1 - ringProgress) }}
            transition={{ type: "spring", stiffness: 48, damping: 15 }}
          />
        </g>
      </svg>

      {/* Bottle — shakes / sloshes */}
      <motion.div
        className="absolute inset-0 h-full w-full"
        style={{ transformOrigin: "50% 52%" }}
        animate={BOTTLE_SHAKE}
        transition={BOTTLE_SHAKE_TRANSITION}
      >
        <svg
          viewBox={viewBox}
          className="h-full w-full overflow-visible drop-shadow-[0_8px_32px_rgba(34,211,238,0.12)]"
          aria-hidden
        >
          <defs>
            <clipPath id={`wb-inner-${uid}`}>
              <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} rx={inner.rx} />
            </clipPath>
            <linearGradient id={`wb-water-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7eece8" />
              <stop offset="45%" stopColor="#2dd4bf" />
              <stop offset="100%" stopColor="#0e7490" />
            </linearGradient>
            <radialGradient id={`wb-glow-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(45,212,191,0.18)" />
              <stop offset="100%" stopColor="rgba(45,212,191,0)" />
            </radialGradient>
            <filter id={`wb-bubble-glow-${uid}`} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="1.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <ellipse cx={RING.cx} cy={RING.cy} rx="42" ry="78" fill={`url(#wb-glow-${uid})`} />

          <g clipPath={`url(#wb-inner-${uid})`}>
            {fill > 0.01 && (
              <rect
                x={inner.x}
                y={waterTop}
                width={inner.w}
                height={Math.max(0, inner.y + inner.h - waterTop)}
                fill={`url(#wb-water-${uid})`}
                opacity={0.85}
              />
            )}
          </g>

          <rect
            x={SHAPES.loop.x}
            y={SHAPES.loop.y}
            width={SHAPES.loop.w}
            height={SHAPES.loop.h}
            rx={SHAPES.loop.rx}
            fill="rgba(251,146,60,0.35)"
            stroke="#fb923c"
            strokeWidth={SW * 0.85}
          />
          <rect
            x={SHAPES.lid.x}
            y={SHAPES.lid.y}
            width={SHAPES.lid.w}
            height={SHAPES.lid.h}
            rx={SHAPES.lid.rx}
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(255,255,255,0.92)"
            strokeWidth={SW}
          />
          <rect
            x={SHAPES.cap.x}
            y={SHAPES.cap.y}
            width={SHAPES.cap.w}
            height={SHAPES.cap.h}
            rx={SHAPES.cap.rx}
            fill="rgba(255,255,255,0.03)"
            stroke="rgba(255,255,255,0.92)"
            strokeWidth={SW}
          />
          <rect
            x={SHAPES.body.x}
            y={SHAPES.body.y}
            width={SHAPES.body.w}
            height={SHAPES.body.h}
            rx={SHAPES.body.rx}
            fill="rgba(253,232,224,0.07)"
            stroke="rgba(255,255,255,0.94)"
            strokeWidth={SW}
          />
          <line
            x1={SHAPES.shine.x}
            y1={SHAPES.shine.y}
            x2={SHAPES.shine.x}
            y2={SHAPES.shine.y + SHAPES.shine.h}
            stroke="rgba(186,230,253,0.45)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {fill > 0.01 &&
            RISING_BUBBLES.map((b, i) => (
              <motion.circle
                key={i}
                fill="rgba(165,243,252,0.72)"
                stroke="rgba(224,242,254,0.95)"
                strokeWidth={0.6}
                filter={`url(#wb-bubble-glow-${uid})`}
                initial={{ cx: b.cx, cy: BUBBLE_SPAWN_Y, opacity: 0, r: b.r * 0.35 }}
                animate={{
                  cx: [b.cx, b.cx + b.drift * 0.55, b.cx + b.drift],
                  cy: [BUBBLE_SPAWN_Y, (BUBBLE_SPAWN_Y + BUBBLE_RISE_Y) / 2, BUBBLE_RISE_Y],
                  opacity: [0, 1, 0.75, 0],
                  r: [b.r * 0.4, b.r * 1.05, b.r * 1.15, b.r * 0.7],
                }}
                transition={{
                  duration: b.duration,
                  delay: b.delay,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
              />
            ))}
        </svg>
      </motion.div>

      <RisingHtmlBubbles active={fill > 0.01} />
    </div>
  )
}
