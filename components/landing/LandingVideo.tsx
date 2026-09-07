"use client"

import * as React from "react"

import { useLandingMotionEnabled } from "@/components/landing/LandingMotionProvider"
import { cn } from "@/lib/utils"

type LandingVideoProps = {
  /** Asset basename in /videos/landing (expects <name>.webm, <name>.mp4, <name>-poster.jpg) */
  src: string
  className?: string
  /** Extra classes on the <video> itself (defaults to absolute cover) */
  videoClassName?: string
  /** Render a static poster instead of video, e.g. to save mobile bandwidth */
  staticOnly?: boolean
}

export function LandingVideo({ src, className, videoClassName, staticOnly = false }: LandingVideoProps) {
  const motionEnabled = useLandingMotionEnabled()
  const base = `/videos/landing/${src}`
  const poster = `${base}-poster.jpg`

  if (staticOnly || !motionEnabled) {
    return (
      <div className={cn("pointer-events-none", className)} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poster} alt="" className={cn("absolute inset-0 h-full w-full object-cover", videoClassName)} />
      </div>
    )
  }

  return (
    <div className={cn("pointer-events-none", className)} aria-hidden>
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={poster}
        className={cn("absolute inset-0 h-full w-full object-cover", videoClassName)}
      >
        <source src={`${base}.webm`} type="video/webm" />
        <source src={`${base}.mp4`} type="video/mp4" />
      </video>
    </div>
  )
}
