"use client"

import * as React from "react"

import { useLandingMotionEnabled } from "@/components/landing/LandingMotionProvider"
import { cn } from "@/lib/utils"

const STORY_CLIPS = [
  "story-student",
  "story-instructor",
  "story-camp",
  "story-collab",
  "story-graduation",
] as const

const BASE = "/videos/landing"
const CROSSFADE_MS = 750

/**
 * Cinematic story loop — crossfades between scene clips with a subtle Ken Burns zoom.
 * Video elements stay mounted; only opacity/transform animate (avoids playback stalls).
 */
export function HeroStoryVideo({ className }: { className?: string }) {
  const motionEnabled = useLandingMotionEnabled()
  const [active, setActive] = React.useState(0)
  const [clips, setClips] = React.useState<string[]>([...STORY_CLIPS])
  const videoRefs = React.useRef<(HTMLVideoElement | null)[]>([])
  const wrapRefs = React.useRef<(HTMLDivElement | null)[]>([])
  const activeRef = React.useRef(0)

  activeRef.current = active

  const advance = React.useCallback(() => {
    setActive((i) => (i + 1) % clips.length)
  }, [clips.length])

  const handleError = React.useCallback((name: string) => {
    setClips((prev) => (prev.length > 1 ? prev.filter((c) => c !== name) : prev))
  }, [])

  const playClip = React.useCallback(async (index: number, reset = true) => {
    const video = videoRefs.current[index]
    if (!video) return
    if (reset) {
      try {
        video.currentTime = 0
      } catch {
        /* ignore seek errors on unloaded media */
      }
    }
    try {
      await video.play()
    } catch {
      window.setTimeout(() => {
        video.play().catch(() => {})
      }, 120)
    }
  }, [])

  const restartKenBurns = React.useCallback((index: number) => {
    const wrap = wrapRefs.current[index]
    if (!wrap) return
    wrap.classList.remove("hero-video-ken-burns")
    void wrap.offsetWidth
    wrap.classList.add("hero-video-ken-burns")
  }, [])

  React.useEffect(() => {
    if (!motionEnabled) return

    void playClip(active, true)
    restartKenBurns(active)

    const pauseTimer = window.setTimeout(() => {
      videoRefs.current.forEach((video, i) => {
        if (i !== active && video && !video.paused) video.pause()
      })
    }, CROSSFADE_MS)

    return () => window.clearTimeout(pauseTimer)
  }, [active, clips.length, motionEnabled, playClip, restartKenBurns])

  React.useEffect(() => {
    if (!motionEnabled) return

    const recover = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      const idx = activeRef.current
      const video = videoRefs.current[idx]
      if (video && video.paused && !video.ended) {
        video.play().catch(() => {})
      }
    }, 2500)

    return () => window.clearInterval(recover)
  }, [motionEnabled])

  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !motionEnabled) return
      void playClip(activeRef.current, false)
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [motionEnabled, playClip])

  if (!motionEnabled) {
    return (
      <div className={cn("pointer-events-none absolute inset-0", className)} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${BASE}/story-student-poster.jpg`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    )
  }

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      {clips.map((name, i) => {
        const isActive = i === active
        return (
          <div
            key={name}
            className={cn(
              "absolute inset-0 transition-opacity duration-700 ease-out",
              isActive ? "z-10 opacity-100" : "z-0 opacity-0",
            )}
          >
            <div
              ref={(el) => {
                wrapRefs.current[i] = el
              }}
              className="h-full w-full will-change-transform"
            >
              <video
                ref={(el) => {
                  videoRefs.current[i] = el
                }}
                muted
                playsInline
                preload="auto"
                poster={`${BASE}/${name}-poster.jpg`}
                onEnded={() => {
                  if (i === activeRef.current) advance()
                }}
                onError={() => handleError(name)}
                className="h-full w-full object-cover"
              >
                <source src={`${BASE}/${name}.webm`} type="video/webm" />
                <source src={`${BASE}/${name}.mp4`} type="video/mp4" />
              </video>
            </div>
          </div>
        )
      })}
    </div>
  )
}
