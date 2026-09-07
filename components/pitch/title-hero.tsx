"use client"

import { useEffect, useState } from "react"
import { DeviceDuo, type DeviceShot } from "@/components/landing/device-frames"
import { cn } from "@/lib/utils"

const web = (file: string, alt: string): DeviceShot => ({
  src: `/images/landing/web/${file}`,
  alt,
  width: 1600,
  height: 1000,
})
const phone = (file: string, alt: string): DeviceShot => ({
  src: `/images/landing/cora/${file}`,
  alt,
  width: 640,
  height: 1314,
})

const SCENES = [
  {
    id: "cora",
    label: "Cora Assistant",
    web: web("web-cora-assistant.png", "Cora Assistant on desktop"),
    phone: phone("assistant-home.png", "Cora Assistant on iPhone"),
  },
  {
    id: "learn",
    label: "AI Notetaker",
    web: web("web-ai-notetaker.png", "Lecture study guide on desktop"),
    phone: phone("notetaker-home.png", "AI Notetaker on iPhone"),
  },
  {
    id: "practice",
    label: "Practice Hub",
    web: web("web-practice-hub.png", "Practice Hub on desktop"),
    phone: phone("practice-hub.png", "Practice Hub on iPhone"),
  },
  {
    id: "build",
    label: "CodeBench",
    web: web("web-codebench-python.png", "CodeBench IDE on desktop"),
    phone: phone("codebench-editor.png", "CodeBench on iPhone"),
  },
] as const

export function TitleHero() {
  const [scene, setScene] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduceMotion(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    if (reduceMotion) return
    const id = window.setInterval(() => {
      setScene((i) => (i + 1) % SCENES.length)
    }, 5200)
    return () => window.clearInterval(id)
  }, [reduceMotion])

  const active = SCENES[scene]

  return (
    <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
      <div className="relative z-10 w-full pb-4 pt-1 sm:pb-6 sm:pt-2 xl:pb-8 xl:pt-3 pitch-title-float">
        <div className="relative mx-auto h-[220px] w-full min-[400px]:h-[min(34vh,280px)] sm:h-[min(38vh,320px)] md:h-[min(42vh,380px)] lg:h-[min(46vh,440px)] xl:h-[min(56vh,540px)] 2xl:h-[min(60vh,600px)]">
          {SCENES.map((item, i) => (
            <div
              key={item.id}
              aria-hidden={i !== scene}
              className={cn(
                "absolute inset-0 flex items-end justify-center px-1 sm:px-2",
                i === scene ? "z-10 scale-100 opacity-100" : "z-0 scale-[0.98] opacity-0",
                "transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
              )}
            >
              <DeviceDuo
                web={item.web}
                phone={item.phone}
                priority={i === 0}
                webSizes="(max-width: 640px) 88vw, (max-width: 1280px) 88vw, 780px"
                phoneSizes="(max-width: 640px) 20vw, (max-width: 1280px) 20vw, 170px"
                className="max-w-full"
              />
            </div>
          ))}
        </div>

        <div className="mt-2 flex flex-col items-center gap-2 sm:mt-3">
          <p className="text-center text-sm font-semibold tracking-wide text-[#F6D56A] sm:text-[15px]">
            {active.label}
          </p>
          <div className="flex items-center gap-2">
            {SCENES.map((item, i) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Show ${item.label}`}
                aria-current={i === scene ? "true" : undefined}
                onClick={() => setScene(i)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  i === scene ? "w-7 bg-[#EAAA00]" : "w-2 bg-white/25 hover:bg-white/45",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
