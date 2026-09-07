import Image from "next/image"
import { cn } from "@/lib/utils"

export const COURSE_COLLAB_LOGO = {
  /** Icon-only mark (preferred in UI) — transparent PNG */
  mark: "/brand/course-collab-mark.png",
  /** Full lockup with wordmark (emails / marketing only) */
  full: "/brand/course-collab-logo.png",
} as const

const LOGO_ASPECT = {
  mark: 1,
  full: 1,
} as const

/** Target display size: landing sm = 40px, topbars/login md = 44px. */
const SIZE_HEIGHT = {
  xs: 32,
  sm: 40,
  md: 44,
  lg: 48,
  xl: 56,
} as const

const FRAME_TONE = {
  /** Follows global appearance settings (--cc-accent*) */
  theme:
    "border-[var(--cc-accent-border,var(--border))] bg-[var(--cc-accent-soft,transparent)]",
  violet:
    "border-[var(--cc-accent-border,var(--border))] bg-[var(--cc-accent-soft,transparent)]",
  primary:
    "border-[var(--cc-accent-border,var(--border))] bg-[var(--cc-accent-soft,transparent)]",
  emerald:
    "border-[var(--cc-accent-border,var(--border))] bg-[var(--cc-accent-soft,transparent)]",
  indigo:
    "border-[var(--cc-accent-border,var(--border))] bg-[var(--cc-accent-soft,transparent)]",
} as const

/** Border + inner padding subtracted from outer frame so icon fills the badge. */
const FRAME_INSET = 4

const WORDMARK_SIZE = {
  xs: "text-sm",
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
  xl: "text-2xl",
} as const

type LogoVariant = keyof typeof COURSE_COLLAB_LOGO
type LogoSize = keyof typeof SIZE_HEIGHT
type FrameTone = keyof typeof FRAME_TONE

type CourseCollabLogoProps = {
  variant?: LogoVariant
  size?: LogoSize
  height?: number
  className?: string
  frameClassName?: string
  /** Rounded border ring; background stays transparent */
  framed?: boolean
  tone?: FrameTone
  priority?: boolean
  /** Show "CourseCollab" text beside the mark */
  withWordmark?: boolean
  wordmarkClassName?: string
}

export function CourseCollabLogo({
  variant = "mark",
  size = "md",
  height,
  className,
  frameClassName,
  framed = true,
  tone = "violet",
  priority,
  withWordmark = false,
  wordmarkClassName,
}: CourseCollabLogoProps) {
  const frameSide = height ?? SIZE_HEIGHT[size]
  const h = framed ? frameSide - FRAME_INSET : frameSide
  const aspect = LOGO_ASPECT[variant]
  const w = Math.round(h * aspect)

  const image = framed ? (
    <Image
      src={COURSE_COLLAB_LOGO[variant]}
      alt="CourseCollab"
      fill
      priority={priority}
      className="object-contain"
      sizes={`${frameSide}px`}
    />
  ) : (
    <Image
      src={COURSE_COLLAB_LOGO[variant]}
      alt="CourseCollab"
      width={w}
      height={h}
      priority={priority}
      className={cn("shrink-0 object-contain", className)}
      sizes={`${w}px`}
    />
  )

  const mark = framed ? (
    <span
      data-course-collab-logo
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-xl border bg-transparent p-0.5",
        FRAME_TONE[tone],
        frameClassName,
        !withWordmark && className,
      )}
      style={{ width: frameSide, height: frameSide }}
    >
      {image}
    </span>
  ) : (
    image
  )

  if (!withWordmark) return mark

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2", className)}>
      {mark}
      <span
        className={cn(
          "font-bold tracking-tight text-[var(--cc-text,var(--foreground))]",
          WORDMARK_SIZE[size],
          wordmarkClassName,
        )}
      >
        CourseCollab
      </span>
    </span>
  )
}
