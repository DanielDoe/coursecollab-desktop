"use client"

import { useEffect, useState } from "react"

/** RMS-based level 0–1 from a MediaStream (same path as MediaRecorder). */
export function useMicLevelMeter(stream: MediaStream | null | undefined, active: boolean) {
  const [level, setLevel] = useState(0)

  useEffect(() => {
    const tracks = stream?.getAudioTracks() ?? []
    if (!active || tracks.length === 0) {
      setLevel(0)
      return
    }

    const Ctx = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : undefined
    if (!Ctx) {
      setLevel(0)
      return
    }

    let ctx: AudioContext | null = null
    let raf = 0
    let cancelled = false

    const run = async () => {
      if (!stream) return
      try {
        ctx = new Ctx()
        if (ctx.state === "suspended") await ctx.resume()
        const src = ctx.createMediaStreamSource(stream)
        const an = ctx.createAnalyser()
        an.fftSize = 512
        an.smoothingTimeConstant = 0.75
        src.connect(an)
        const data = new Uint8Array(an.fftSize)

        const tick = () => {
          if (cancelled || !ctx) return
          an.getByteTimeDomainData(data)
          let sum = 0
          for (let i = 0; i < data.length; i++) {
            const v = (data[i]! - 128) / 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / data.length)
          const norm = Math.min(1, rms * 4)
          setLevel((prev) => prev * 0.82 + norm * 0.18)
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch {
        setLevel(0)
      }
    }

    void run()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      void ctx?.close()
    }
  }, [stream, active])

  return level
}
