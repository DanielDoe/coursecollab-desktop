import type { CSSProperties, ReactNode } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

export function SlideShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-full w-full flex-col px-4 py-3 pb-14 sm:px-5 sm:py-4 sm:pb-16 lg:px-7 lg:py-5 lg:pb-[4.5rem] xl:px-9",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-[0.28em] text-[#EAAA00] xl:text-[14px] 2xl:text-[15px]">
      {children}
    </p>
  )
}

export function SlideTitle({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h2
      className={cn(
        "font-sans text-[1.55rem] font-extrabold leading-[1.12] tracking-tight text-[#fbf8ff] sm:text-[2.25rem] lg:text-[2.55rem] xl:text-[2.85rem] 2xl:text-[3.15rem]",
        className,
      )}
    >
      {children}
    </h2>
  )
}

export function Subhead({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        "mt-2 max-w-4xl text-[15px] leading-relaxed text-white/82 sm:text-[17px] lg:text-[18px] xl:text-[20px] 2xl:text-[22px]",
        className,
      )}
    >
      {children}
    </p>
  )
}

export function Thesis({ children }: { children: ReactNode }) {
  return (
    <p className="mt-auto shrink-0 border-t border-white/15 pt-3 text-[15px] font-medium leading-snug text-[#F6D56A] sm:pt-4 sm:text-[17px] lg:text-[18px] xl:text-[20px] 2xl:text-[22px]">
      {children}
    </p>
  )
}

export function Shot({
  src,
  alt,
  className,
  priority,
  fill,
}: {
  src: string
  alt: string
  className?: string
  priority?: boolean
  fill?: boolean
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl shadow-[0_28px_60px_-28px_rgba(0,0,0,0.7)] ring-1 ring-white/12",
        fill && "relative min-h-[168px] flex-1 h-full",
        className,
      )}
    >
      {fill ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          className="object-cover object-top"
          sizes="(max-width: 1024px) 92vw, 720px"
        />
      ) : (
        <Image
          src={src}
          alt={alt}
          width={1600}
          height={1000}
          priority={priority}
          className="h-auto w-full object-cover object-top"
          sizes="(max-width: 1024px) 92vw, 720px"
        />
      )}
    </div>
  )
}

export function Card({
  children,
  className,
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      style={style}
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.035] p-3.5 sm:p-4 xl:p-5 2xl:p-6",
        className,
      )}
    >
      {children}
    </div>
  )
}
