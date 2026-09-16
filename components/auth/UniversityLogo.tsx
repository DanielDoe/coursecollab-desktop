import { GraduationCap } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { isOtherUniversity, type UniversityRecord } from "@/lib/universities-shared"

/** Official UH stacked wordmark PNG (800×544). */
export const UH_LOGO_PATH = "/universities/university-of-houston-logo.png"
/** White knocked out — for dark auth surfaces. */
export const UH_LOGO_TRANSPARENT_PATH = "/universities/university-of-houston-logo-transparent.png"
export const UH_MARK_TRANSPARENT_PATH = "/universities/university-of-houston-mark-transparent.png"
const UH_LOGO_WIDTH = 800
const UH_LOGO_HEIGHT = 544

/** PVAMU PVM monogram (official mark). */
export const PVAMU_LOGO_PATH = "/universities/pvamu-pvm-mark.png"
const PVAMU_LOGO_WIDTH = 512
const PVAMU_LOGO_HEIGHT = 512

/** PVAMU PVM monogram mark — readable on dark backgrounds at small sizes. */
export const PVAMU_MARK_PATH = "/universities/pvamu-pvm-mark.png"

export type UniversityLogoVariant = "full" | "compact"

export function universityHasFullWordmark(university: Pick<UniversityRecord, "short_name">): boolean {
  const sn = university.short_name.toUpperCase()
  return sn === "UH" || sn === "PVAMU"
}

function universityKey(university: Pick<UniversityRecord, "short_name">): "UH" | "PVAMU" | null {
  const sn = university.short_name.toUpperCase()
  if (sn === "UH") return "UH"
  if (sn === "PVAMU") return "PVAMU"
  return null
}

function UhCompactLogo({
  university,
  size,
  className,
}: {
  university: Pick<UniversityRecord, "name">
  size: "sm" | "md" | "lg"
  className?: string
}) {
  const px = size === "sm" ? 44 : size === "lg" ? 56 : 48
  return (
    <Image
      src={UH_MARK_TRANSPARENT_PATH}
      alt={university.name}
      width={px}
      height={px}
      className={cn("shrink-0 object-contain w-auto", className)}
      style={{ width: "auto", height: `${px}px` }}
    />
  )
}

function UhFullLogo({
  university,
  size,
  className,
}: {
  university: Pick<UniversityRecord, "name">
  size: "sm" | "md" | "lg"
  className?: string
}) {
  const widthPx = size === "sm" ? 112 : size === "lg" ? 176 : 144
  const heightPx = Math.round((widthPx * UH_LOGO_HEIGHT) / UH_LOGO_WIDTH)
  const markPx = size === "sm" ? 52 : size === "lg" ? 80 : 64

  return (
    <>
      <Image
        src={UH_LOGO_PATH}
        alt={university.name}
        width={widthPx}
        height={heightPx}
        className={cn("h-auto w-auto max-w-full shrink-0 rounded-lg dark:hidden", className)}
        style={{ width: widthPx, height: "auto" }}
        priority
      />
      <div className={cn("hidden dark:flex flex-col items-center gap-1.5", className)}>
        <Image
          src={UH_MARK_TRANSPARENT_PATH}
          alt={university.name}
          width={markPx}
          height={markPx}
          className="h-auto w-auto object-contain"
          style={{ width: "auto", height: `${markPx}px` }}
        />
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">University of</p>
        <p className="text-[1.65rem] font-bold uppercase leading-none tracking-wide text-[#E8193A]">Houston</p>
      </div>
    </>
  )
}

function PvamuCompactLogo({
  university,
  size,
  className,
}: {
  university: Pick<UniversityRecord, "name">
  size: "sm" | "md" | "lg"
  className?: string
}) {
  const px = size === "sm" ? 44 : size === "lg" ? 56 : 48
  return (
    <Image
      src={PVAMU_MARK_PATH}
      alt={university.name}
      width={px}
      height={px}
      className={cn("shrink-0 rounded-full", className)}
      style={{ width: px, height: px }}
    />
  )
}

function PvamuFullLogo({
  university,
  size,
  className,
}: {
  university: Pick<UniversityRecord, "name">
  size: "sm" | "md" | "lg"
  className?: string
}) {
  const markPx = size === "sm" ? 52 : size === "lg" ? 80 : 64

  return (
    <>
      <Image
        src={PVAMU_LOGO_PATH}
        alt={university.name}
        width={markPx}
        height={markPx}
        className={cn("h-auto w-auto shrink-0 object-contain dark:hidden", className)}
        style={{ width: "auto", height: `${markPx}px` }}
        priority
      />
      <div className={cn("hidden dark:flex flex-col items-center gap-2", className)}>
        <Image
          src={PVAMU_MARK_PATH}
          alt={university.name}
          width={markPx}
          height={markPx}
          className="rounded-full"
          style={{ width: markPx, height: markPx }}
        />
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">Prairie View</p>
        <p className="text-xl font-bold uppercase leading-none tracking-wide text-[#FFB81C]">A&amp;M University</p>
      </div>
    </>
  )
}

export function UniversityLogo({
  university,
  className,
  size = "md",
  variant = "full",
}: {
  university: Pick<UniversityRecord, "logo" | "short_name" | "name"> & { primary_color?: string }
  className?: string
  size?: "sm" | "md" | "lg"
  variant?: UniversityLogoVariant
}) {
  const key = universityKey(university)

  if (key === "UH") {
    return variant === "compact" ? (
      <UhCompactLogo university={university} size={size} className={className} />
    ) : (
      <UhFullLogo university={university} size={size} className={className} />
    )
  }

  if (key === "PVAMU") {
    return variant === "compact" ? (
      <PvamuCompactLogo university={university} size={size} className={className} />
    ) : (
      <PvamuFullLogo university={university} size={size} className={className} />
    )
  }

  const dims = size === "sm" ? "h-10 w-10" : size === "lg" ? "h-16 w-16" : "h-14 w-14"
  const px = size === "sm" ? 20 : size === "lg" ? 28 : 24
  const color = university.primary_color ?? "#582c83"

  if (isOtherUniversity(university)) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--cc-accent)_22%,var(--border))] bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]",
          dims,
          className,
        )}
        aria-hidden
      >
        <GraduationCap style={{ width: px, height: px }} />
      </span>
    )
  }

  const logoSrc = university.logo
  if (logoSrc) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-white",
          dims,
          className,
        )}
      >
        <Image src={logoSrc} alt={university.name} fill className="object-contain p-2" sizes="64px" />
      </div>
    )
  }

  const initials = university.short_name.replace(/[^A-Z0-9]/gi, "").slice(0, 3).toUpperCase() || "U"
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl text-[11px] font-bold tracking-wide text-white",
        dims,
        className,
      )}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {initials}
    </span>
  )
}
