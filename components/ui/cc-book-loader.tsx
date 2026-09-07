import { cn } from "@/lib/utils"

const STAGE = 160
const STAGE_H = 120

const BOX: Record<"xs" | "sm" | "md" | "lg", number> = {
  xs: 28,
  sm: 44,
  md: 88,
  lg: 160,
}

export function CcBookLoader({
  size = "md",
  className,
  label = "Loading",
}: {
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
  label?: string
}) {
  const box = BOX[size]
  const scale = box / STAGE

  return (
    <div
      className={cn("cc-book-loader", className)}
      style={{ width: box, height: Math.round(STAGE_H * scale) }}
      role="status"
      aria-label={label}
    >
      <div className="cc-book-loader-stage" style={{ transform: `scale(${scale})` }}>
        <div className="cc-book-loader-cover">
          <div className="cc-book-loader-page" />
          <div className="cc-book-loader-spine" />
        </div>
      </div>
    </div>
  )
}
