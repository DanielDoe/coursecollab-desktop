"use client"

import { useState } from "react"
import { Camera, CheckCircle2, Eye, Trophy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { CampScaledImage } from "@/components/summer-camp/CampScaledImage"
import { cn } from "@/lib/utils"

export function CampOpencvMissionBlock() {
  const prerequisites = [
    "Raspberry Pi hardware is working",
    "Operating system is installed",
    "Camera has been verified",
  ]
  const objectives = [
    "Update Raspberry Pi",
    "Install dependencies",
    "Create project workspace",
    "Create virtual environment",
    "Install OpenCV",
    "Verify installation",
    "Launch Geany IDE",
    "Prepare for Computer Vision projects",
  ]
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const toggle = (i: number) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 sm:p-5 space-y-4">
      <div>
        <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">
          Mission Briefing
        </p>
        <p className="font-bold text-lg text-slate-900 dark:text-white mt-1">Congratulations, Engineer!</p>
        <ul className="mt-3 space-y-1">
          {prerequisites.map((c) => (
            <li key={c} className="text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {c}
            </li>
          ))}
        </ul>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-3">
          Now it is time to transform your Raspberry Pi into a Computer Vision workstation. Today we will install the
          software tools needed to process images and build AI-powered applications.
        </p>
      </div>
      <div className="rounded-lg border border-dashboard-v2-border bg-dashboard-v2-card/60 p-3 space-y-2">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
          Mission Objectives
        </p>
        {objectives.map((obj, i) => (
          <button
            key={obj}
            type="button"
            onClick={() => toggle(i)}
            className={cn(
              "w-full text-left text-sm flex items-center gap-2 rounded-md px-2 py-1.5",
              checked.has(i) ? "text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-400",
            )}
          >
            <span className={cn("text-base leading-none", checked.has(i) ? "text-emerald-500" : "text-slate-400")}>
              {checked.has(i) ? "☑" : "☐"}
            </span>
            {obj}
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Reward</p>
          <p className="text-sm font-bold text-amber-800 dark:text-amber-200">+250 XP · Computer Vision Explorer Badge</p>
        </div>
        <Trophy className="h-8 w-8 text-amber-500" />
      </div>
    </div>
  )
}

export function CampOpencvPixelsPollBlock({ content }: { content?: Record<string, unknown> }) {
  const [choice, setChoice] = useState<number | null>(null)
  const options = ["Objects", "Pixels", "Words", "Shapes"]
  const correct = 1
  const imageUrl = String(content?.imageUrl ?? "").trim() || undefined

  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      {imageUrl ? (
        <CampScaledImage
          src={imageUrl}
          alt="Pixel grid illustration"
          placeholder="Pixel grid"
          aspectClass="aspect-video"
          imgClassName="object-contain p-2 bg-white dark:bg-slate-900"
        />
      ) : null}
      <div className="flex items-center gap-2">
        <Eye className="h-5 w-5 text-violet-500" />
        <p className="font-semibold text-slate-900 dark:text-white">Think Like An Engineer</p>
        <p className="text-sm text-slate-500">What does a computer actually see?</p>
      </div>
      {options.map((opt, i) => (
        <button
          key={opt}
          type="button"
          onClick={() => setChoice(i)}
          className={cn(
            "w-full text-left rounded-lg border px-3 py-2.5 text-sm",
            choice === i
              ? i === correct
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-amber-500 bg-amber-500/10"
              : "border-slate-200 dark:border-slate-700",
          )}
        >
          {String.fromCharCode(65 + i)}. {opt}
        </button>
      ))}
      {choice === correct && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Correct — computers process images as grids of pixels, not objects or words.
        </p>
      )}
      {choice != null && choice !== correct && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Not quite — think about how a digital photo is stored on your Pi.
        </p>
      )}
    </div>
  )
}

export function CampCvEnvironmentStatusBlock() {
  const built = [
    "Raspberry Pi OS",
    "Python",
    "Virtual Environment",
    "OpenCV",
    "Camera Support",
    "Development Environment",
  ]

  return (
    <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 p-4 sm:p-6 space-y-4">
      <p className="font-bold text-lg text-emerald-900 dark:text-emerald-100 text-center">Section 9 — Environment Ready</p>
      <p className="text-sm text-center text-slate-600 dark:text-slate-400">Congratulations! You now have:</p>
      <div className="flex flex-wrap justify-center gap-2">
        {built.map((label) => (
          <Badge key={label} className="bg-emerald-600 text-white px-3 py-1">
            ✓ {label}
          </Badge>
        ))}
      </div>
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-slate-700 dark:text-slate-300">
        <p className="font-semibold text-emerald-800 dark:text-emerald-200 mb-1">Engineering Milestone</p>
        <p>
          Your Raspberry Pi is now a complete Computer Vision platform. The next module will use this environment to
          run real-time face detection and object detection applications.
        </p>
      </div>
      <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 text-center space-y-1">
        <p className="text-sm font-medium text-violet-800 dark:text-violet-200 flex items-center justify-center gap-2">
          <Camera className="h-4 w-4" />
          Unlocked — Module 10
        </p>
        <p className="text-sm text-violet-700 dark:text-violet-300">
          Running Your First Face Detection &amp; Object Detection Application
        </p>
      </div>
    </div>
  )
}
