"use client"

import { useEffect, useState } from "react"
import {
  ChevronDown,
  Cpu,
  Camera,
  Monitor,
  Keyboard,
  Mouse,
  HardDrive,
  Plug,
  Zap,
  Wifi,
  Terminal,
  FolderOpen,
  Settings,
  Globe,
  Trophy,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CampScaledImage } from "@/components/summer-camp/CampScaledImage"
import { mergeInteractiveImages } from "@/lib/summer-camp/ai-edge-interactive-defaults"
import { readStepImage } from "@/lib/summer-camp/interactive-block-images"
import { readMediaItemImage } from "@/lib/summer-camp/interactive-media-items"
import { cn } from "@/lib/utils"

export function CampPiSetupMissionBlock() {
  const objectives = [
    "Verify hardware",
    "Assemble Raspberry Pi",
    "Install Raspberry Pi OS",
    "Configure device settings",
    "Boot successfully",
    "Verify camera operation",
    "Complete setup checkpoint",
  ]
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const toggle = (label: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })

  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 sm:p-5 space-y-4">
      <div>
        <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Mission Briefing</p>
        <p className="font-bold text-lg text-slate-900 dark:text-white mt-1">Welcome, Engineer!</p>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
          Today you will transform your Raspberry Pi from a collection of hardware components into a fully functioning
          Edge Computing computer.
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
          By the end of this module you will have a working Raspberry Pi capable of supporting Computer Vision and AI
          applications. This is a major milestone — every future project in this camp will run on the system you build
          today.
        </p>
      </div>
      <div className="rounded-lg border border-dashboard-v2-border bg-dashboard-v2-card/60 p-3 space-y-2">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Mission Objectives</p>
        <div className="space-y-1.5">
          {objectives.map((obj) => (
            <button
              key={obj}
              type="button"
              onClick={() => toggle(obj)}
              className={cn(
                "w-full text-left text-sm flex items-center gap-2 rounded-md px-2 py-1.5",
                checked.has(obj) ? "text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-400",
              )}
            >
              <span className={cn("text-base leading-none", checked.has(obj) ? "text-emerald-500" : "text-slate-400")}>
                {checked.has(obj) ? "☑" : "☐"}
              </span>
              {obj}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Reward</p>
          <p className="text-sm font-bold text-amber-800 dark:text-amber-200">+250 XP · 🏆 Edge Device Builder Badge</p>
        </div>
        <Trophy className="h-8 w-8 text-amber-500" />
      </div>
    </div>
  )
}

export function CampHardwareInventoryBlock() {
  const items = [
    { label: "Raspberry Pi 4", icon: Cpu },
    { label: "MicroSD Card", icon: HardDrive },
    { label: "Camera Module", icon: Camera },
    { label: "HDMI Cable", icon: Monitor },
    { label: "Monitor", icon: Monitor },
    { label: "Keyboard", icon: Keyboard },
    { label: "Mouse", icon: Mouse },
    { label: "Power Adapter", icon: Plug },
  ]
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const toggle = (label: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Hardware Inventory Checklist</p>
      <p className="text-sm text-slate-500">Verify you have each component before beginning.</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {items.map((item) => {
          const Icon = item.icon
          const done = checked.has(item.label)
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => toggle(item.label)}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-sm flex items-center gap-2 text-left",
                done ? "border-emerald-500 bg-emerald-500/10" : "border-slate-200 dark:border-slate-700",
              )}
            >
              <Icon className="h-4 w-4 text-violet-500 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {done && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            </button>
          )
        })}
      </div>
      {checked.size === items.length && (
        <p className="text-sm text-emerald-600 font-medium">Kit complete — ready for assembly!</p>
      )}
    </div>
  )
}

export function CampHardwareKitLayoutBlock({ content }: { content?: Record<string, unknown> }) {
  const merged = mergeInteractiveImages("hardware_kit_layout", content ?? {})
  const imageUrl = String(merged.imageUrl ?? "").trim() || undefined
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5">
      <p className="font-semibold text-slate-900 dark:text-white mb-3">Complete Kit Layout</p>
      {imageUrl ? (
        <CampScaledImage
          src={imageUrl}
          alt="Complete Raspberry Pi kit layout"
          placeholder="Top-down kit photo"
          aspectClass="aspect-[4/3]"
          imgClassName="object-contain p-2 bg-white dark:bg-slate-900"
        />
      ) : (
        <div className="h-40 rounded-lg bg-slate-100 dark:bg-slate-800 flex flex-wrap items-center justify-center gap-4 p-4">
          {[Cpu, HardDrive, Camera, Monitor, Keyboard, Mouse, Plug].map((Icon, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Icon className="h-6 w-6 text-violet-500" />
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500 text-center mt-2">
        {imageUrl ? "Top-down view of all required hardware" : "[Top-down view of all required hardware]"}
      </p>
    </div>
  )
}

export function CampBootProcessBlock() {
  const steps = ["Power", "Bootloader", "Operating System", "Desktop Environment", "Applications"]
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % steps.length), 1400)
    return () => clearInterval(t)
  }, [steps.length])
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">What happens when you turn on a computer?</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={cn(
              "px-3 py-2 rounded-lg border text-sm transition-all",
              active === i ? "border-violet-500 bg-violet-500/15 font-medium" : "border-slate-200 dark:border-slate-700 text-slate-500",
            )}>{s}</span>
            {i < steps.length - 1 && <ChevronDown className="h-3 w-3 rotate-[-90deg] text-violet-400" />}
          </div>
        ))}
      </div>
      <p className="text-sm text-center text-slate-600 dark:text-slate-400">
        Raspberry Pi needs <strong>Hardware</strong> × <strong>Operating System</strong> before it can run AI applications.
      </p>
    </div>
  )
}

export function CampPiAssemblyStepsBlock({ content }: { content?: Record<string, unknown> }) {
  const merged = mergeInteractiveImages("pi_assembly_steps", content ?? {})
  const steps = [
    { n: 1, title: "Insert MicroSD Card", why: "Contains the operating system, programs, and files.", icon: HardDrive },
    { n: 2, title: "Connect HDMI Cable", why: "Provides visual output to your monitor.", icon: Monitor },
    { n: 3, title: "Connect Keyboard", why: "Allows you to type commands and configure the Pi.", icon: Keyboard },
    { n: 4, title: "Connect Mouse", why: "Enables graphical desktop navigation.", icon: Mouse },
    { n: 5, title: "Connect Camera Module", why: "CSI ribbon cable — orientation matters! Incorrect installation prevents camera detection.", icon: Camera, warn: true },
    { n: 6, title: "Connect Power", why: "DO NOT power on until all components are connected.", icon: Zap, warn: true },
  ]
  const [open, setOpen] = useState(0)
  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const Icon = s.icon
        return (
          <button
            key={s.n}
            type="button"
            onClick={() => setOpen(open === i ? -1 : i)}
            className={cn(
              "w-full text-left rounded-xl border p-4 flex gap-3",
              open === i
                ? s.warn ? "border-amber-500 bg-amber-500/10" : "border-violet-500 bg-violet-500/10"
                : "border-dashboard-v2-border bg-dashboard-v2-card",
            )}
          >
            <span className="size-7 rounded-full bg-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-bold flex items-center justify-center shrink-0">
              {s.n}
            </span>
            <div className="flex-1">
              <p className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Icon className="h-4 w-4 text-violet-500" />
                {s.title}
              </p>
              {open === i && (
                <>
                  <CampScaledImage
                    src={readStepImage(merged, String(s.n))}
                    alt={s.title}
                    placeholder="Assembly step image"
                    aspectClass="aspect-video"
                    className="mt-2"
                    imgClassName="object-contain p-2 bg-white dark:bg-slate-900"
                  />
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2"><strong>Why?</strong> {s.why}</p>
                </>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function CampCameraOrientationBlock({ content }: { content?: Record<string, unknown> }) {
  const merged = mergeInteractiveImages("camera_orientation", content ?? {})
  const [choice, setChoice] = useState<string | null>(null)
  const correctUrl =
    readMediaItemImage(merged, "correctImageUrl") ??
    (String(merged.correctImageUrl ?? "").trim() || undefined)
  const incorrectUrl =
    readMediaItemImage(merged, "incorrectImageUrl") ??
    (String(merged.incorrectImageUrl ?? "").trim() || undefined)
  const items = merged.mediaItems as Array<{ id: string }> | undefined
  const hasMediaItems = Array.isArray(items) && items.length > 0
  const showCorrect = !hasMediaItems || items.some((row) => row.id === "correctImageUrl")
  const showIncorrect = !hasMediaItems || items.some((row) => row.id === "incorrectImageUrl")
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Camera Ribbon Cable Orientation</p>
      <p className="text-sm text-slate-500">Identify the correct vs incorrect camera connection.</p>
      <div className={cn("grid gap-3", showCorrect && showIncorrect ? "sm:grid-cols-2" : "grid-cols-1")}>
        {showCorrect ? (
        <button
          type="button"
          onClick={() => setChoice("correct")}
          className={cn(
            "rounded-lg border p-4 text-center",
            choice === "correct" ? "border-emerald-500 bg-emerald-500/10" : "border-slate-200 dark:border-slate-700",
          )}
        >
          {correctUrl ? (
            <CampScaledImage
              src={correctUrl}
              alt="Correct camera ribbon orientation"
              placeholder="Correct orientation"
              aspectClass="aspect-video"
              className="mb-2"
              imgClassName="object-contain p-1 bg-white dark:bg-slate-900"
            />
          ) : (
            <div className="h-20 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
              <Camera className="h-8 w-8 text-emerald-500" />
            </div>
          )}
          <p className="text-sm font-medium">Correct — contacts face board</p>
        </button>
        ) : null}
        {showIncorrect ? (
        <button
          type="button"
          onClick={() => setChoice("incorrect")}
          className={cn(
            "rounded-lg border p-4 text-center",
            choice === "incorrect" ? "border-red-500 bg-red-500/10" : "border-slate-200 dark:border-slate-700",
          )}
        >
          {incorrectUrl ? (
            <CampScaledImage
              src={incorrectUrl}
              alt="Incorrect camera ribbon orientation"
              placeholder="Incorrect orientation"
              aspectClass="aspect-video"
              className="mb-2"
              imgClassName="object-contain p-1 bg-white dark:bg-slate-900"
            />
          ) : (
            <div className="h-20 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
              <Camera className="h-8 w-8 text-red-500 rotate-180" />
            </div>
          )}
          <p className="text-sm font-medium">Incorrect — cable reversed</p>
        </button>
        ) : null}
      </div>
      {choice === "correct" && (
        <p className="text-sm text-emerald-600">Correct! Blue side faces the Ethernet port on most Pi models.</p>
      )}
      {choice === "incorrect" && (
        <p className="text-sm text-red-600">That orientation will prevent camera detection — try the correct option.</p>
      )}
    </div>
  )
}

export function CampOsInstallTrackerBlock() {
  const steps = [
    "Open Raspberry Pi Imager",
    "Choose Raspberry Pi OS",
    "Select Storage Device",
    "Write Image",
    "Wait for Installation",
  ]
  const [done, setDone] = useState<Set<number>>(new Set())
  const toggle = (i: number) =>
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Raspberry Pi Imager Workflow</p>
      <div className="h-24 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-400 mb-2">
        [Raspberry Pi Imager screenshot placeholder]
      </div>
      {steps.map((s, i) => (
        <button
          key={s}
          type="button"
          onClick={() => toggle(i)}
          className={cn(
            "w-full text-left rounded-lg border px-3 py-2.5 text-sm flex items-center gap-3",
            done.has(i) ? "border-emerald-500 bg-emerald-500/10" : "border-slate-200 dark:border-slate-700",
          )}
        >
          <span className={cn(
            "size-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0",
            done.has(i) ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600",
          )}>
            {done.has(i) ? "✓" : i + 1}
          </span>
          {s}
        </button>
      ))}
      {done.size === steps.length && (
        <p className="text-sm text-emerald-600 font-medium">OS installation complete!</p>
      )}
    </div>
  )
}

export function CampLedIndicatorsBlock() {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const questions = [
    { id: "red", prompt: "Red LED indicates:", options: ["Power connected", "SD card activity", "WiFi connected"], answer: "Power connected" },
    { id: "green", prompt: "Green LED indicates:", options: ["Power connected", "SD card read/write activity", "Camera active"], answer: "SD card read/write activity" },
  ]
  const allAnswered = questions.every((q) => answers[q.id])
  const allCorrect = questions.every((q) => answers[q.id] === q.answer)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">First Boot — What do the LEDs indicate?</p>
      <div className="flex gap-4 justify-center">
        <div className="text-center">
          <span className="size-4 rounded-full bg-red-500 inline-block" />
          <p className="text-xs mt-1 text-slate-500">Red LED</p>
        </div>
        <div className="text-center">
          <span className="size-4 rounded-full bg-emerald-500 inline-block animate-pulse" />
          <p className="text-xs mt-1 text-slate-500">Green LED</p>
        </div>
      </div>
      {questions.map((q) => (
        <div key={q.id}>
          <p className="text-sm font-medium mb-2">{q.prompt}</p>
          <div className="flex flex-wrap gap-2">
            {q.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                className={cn(
                  "px-3 py-1.5 rounded-full border text-xs",
                  answers[q.id] === opt ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700",
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
      {allAnswered && (
        <p className={cn("text-sm", allCorrect ? "text-emerald-600" : "text-amber-600")}>
          {allCorrect
            ? "Correct! Red = power, Green = SD activity. Watch for the welcome screen on your monitor."
            : "Review: Red LED means power is connected; Green LED blinks during SD card activity."}
        </p>
      )}
    </div>
  )
}

export function CampPiConfigTourBlock() {
  const steps = [
    { label: "Country Selection", icon: Globe, detail: "Set your region for keyboard layout and locale." },
    { label: "Time Zone", icon: Globe, detail: "Ensures logs and timestamps are correct." },
    { label: "Password Setup", icon: Settings, detail: "Secure your Pi — never leave default credentials." },
    { label: "WiFi Configuration", icon: Wifi, detail: "Connect to your network for updates and remote access." },
    { label: "Software Update", icon: Zap, detail: "Security patches, bug fixes, performance, and compatibility." },
  ]
  const [active, setActive] = useState(0)
  const s = steps[active]
  const Icon = s.icon
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Initial Configuration Wizard</p>
      <div className="flex flex-wrap gap-2">
        {steps.map((step, i) => (
          <button
            key={step.label}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "px-2.5 py-1 rounded-lg border text-xs",
              active === i ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700",
            )}
          >
            {step.label}
          </button>
        ))}
      </div>
      <div className="h-28 rounded-lg bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center">
        <Icon className="h-8 w-8 text-violet-500" />
        <p className="text-[10px] text-slate-400 mt-2">[Configuration screen placeholder]</p>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400"><strong>{s.label}:</strong> {s.detail}</p>
    </div>
  )
}

export function CampDesktopTourBlock({ content }: { content?: Record<string, unknown> }) {
  const merged = mergeInteractiveImages("desktop_tour", content ?? {})
  const imageUrl = String(merged.imageUrl ?? "").trim() || undefined
  const targets = [
    { id: "terminal", label: "Terminal", icon: Terminal },
    { id: "files", label: "File Manager", icon: FolderOpen },
    { id: "wifi", label: "WiFi Status", icon: Wifi },
    { id: "settings", label: "Settings", icon: Settings },
  ]
  const [found, setFound] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setFound((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Raspberry Pi Desktop Tour</p>
      {imageUrl ? (
        <CampScaledImage
          src={imageUrl}
          alt="Raspberry Pi desktop"
          placeholder="Desktop screenshot"
          aspectClass="aspect-video"
          imgClassName="object-contain p-1 bg-slate-900"
        />
      ) : (
      <div className="h-32 rounded-lg bg-gradient-to-b from-sky-900/30 to-slate-800 flex flex-col justify-end p-3 relative">
        <div className="h-6 bg-slate-700/80 rounded flex items-center px-2 gap-3">
          {targets.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className={cn(
                  "p-1 rounded transition-colors",
                  found.has(t.id) ? "bg-emerald-500/30 ring-1 ring-emerald-500" : "hover:bg-white/10",
                )}
                title={`Find: ${t.label}`}
              >
                <Icon className="h-3.5 w-3.5 text-white" />
              </button>
            )
          })}
        </div>
        <p className="text-[10px] text-slate-400 text-center mt-2">Click taskbar icons to find each component</p>
      </div>
      )}
      <div className="flex flex-wrap gap-2">
        {targets.map((t) => (
          <Badge
            key={t.id}
            variant="outline"
            className={cn(found.has(t.id) ? "border-emerald-500 text-emerald-700" : "opacity-50")}
          >
            {found.has(t.id) ? "✓" : "○"} {t.label}
          </Badge>
        ))}
      </div>
      {found.size === targets.length && (
        <p className="text-sm text-emerald-600 font-medium flex items-center gap-2">
          <Trophy className="h-4 w-4" /> Desktop Explorer — you found everything!
        </p>
      )}
    </div>
  )
}

export function CampTerminalCommandsBlock() {
  const commands = [
    { cmd: "pwd", meaning: "Print Working Directory", output: "/home/pi", hint: "Shows your current folder path" },
    { cmd: "ls", meaning: "List Files", output: "Desktop  Documents  Downloads", hint: "Lists files and folders in the current directory" },
    { cmd: "whoami", meaning: "Display Current User", output: "pi", hint: "Shows which user account is logged in" },
  ]
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [ranAll, setRanAll] = useState(false)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Meet the Terminal</p>
      <p className="text-sm text-slate-500">Engineers use command lines alongside graphical interfaces. Predict each output, then reveal.</p>
      {commands.map((c) => (
        <div key={c.cmd} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
          <code className="text-sm font-mono bg-slate-900 text-emerald-400 px-2 py-1 rounded">{c.cmd}</code>
          <p className="text-xs text-slate-500">{c.meaning}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRevealed((prev) => new Set(prev).add(c.cmd))}
          >
            {revealed.has(c.cmd) ? "Output:" : "Reveal output"}
          </Button>
          {revealed.has(c.cmd) && (
            <pre className="text-xs font-mono bg-slate-950 text-emerald-300 p-2 rounded">{c.output}</pre>
          )}
        </div>
      ))}
      <Button
        size="sm"
        disabled={revealed.size < commands.length}
        onClick={() => setRanAll(true)}
      >
        I ran all three commands on my Pi
      </Button>
      {ranAll && (
        <p className="text-sm text-violet-600">Great! Upload a terminal screenshot at the checkpoint below.</p>
      )}
    </div>
  )
}

export function CampCameraVerifyBlock({ content }: { content?: Record<string, unknown> }) {
  const merged = mergeInteractiveImages("camera_verify", content ?? {})
  const [step, setStep] = useState(0)
  const steps = [
    { cmd: "rpicam-hello --list-cameras", desc: "List connected cameras", result: "Available cameras: 0 : imx219 [3280x2464]" },
    { cmd: "rpicam-hello -t 10000", desc: "10-second camera preview test", result: "Preview window opens for 10 seconds" },
  ]
  const [verified, setVerified] = useState(false)
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Verifying Camera Installation</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        No camera = no object detection. Run these commands in the terminal.
      </p>
      {steps.map((s, i) => (
        <button
          key={s.cmd}
          type="button"
          onClick={() => setStep(i)}
          className={cn(
            "w-full text-left rounded-lg border p-3",
            step === i ? "border-emerald-500 bg-emerald-500/10" : "border-slate-200 dark:border-slate-700",
          )}
        >
          <code className="text-xs font-mono text-emerald-700 dark:text-emerald-300">{s.cmd}</code>
          <p className="text-xs text-slate-500 mt-1">{s.desc}</p>
          {step === i && (
            <p className="text-xs text-emerald-600 mt-2 font-medium">Expected: {s.result}</p>
          )}
        </button>
      ))}
      <CampScaledImage
        src={(readStepImage(merged, String(step)) ?? String(merged.imageUrl ?? "").trim()) || undefined}
        alt={step === 0 ? "Camera list command output" : "Live camera preview"}
        placeholder={step === 0 ? "Camera list screenshot" : "Camera preview screenshot"}
        aspectClass="aspect-video"
        imgClassName="object-contain p-2 bg-slate-900"
      />
      <Button size="sm" variant="outline" onClick={() => setVerified(true)}>
        My camera preview worked
      </Button>
      {verified && (
        <p className="text-sm text-emerald-600 font-medium">Camera verified! Upload your screenshot at the checkpoint below.</p>
      )}
    </div>
  )
}

export function CampPiImagerWorkflowBlock({ content }: { content?: Record<string, unknown> }) {
  const merged = mergeInteractiveImages("pi_imager_workflow", content ?? {})
  const phases = [
    {
      id: "install",
      label: "Section 2 — Installing Raspberry Pi OS",
      steps: [
        {
          title: "Step 1 — Download Raspberry Pi Imager",
          action: "Visit https://www.raspberrypi.com/software/",
          lookFor: "Locate the Raspberry Pi Imager download button for your operating system.",
          why: "Raspberry Pi Imager prepares the MicroSD card that will become your Raspberry Pi's operating system.",
        },
        {
          title: "Step 2 — Install Raspberry Pi Imager",
          action: "Install the downloaded application on your computer.",
          lookFor: "The Raspberry Pi Imager application should appear in your Applications folder (or Start menu on Windows).",
          why: "You must install the software before you can write Raspberry Pi OS to the MicroSD card.",
        },
        {
          title: "Step 3 — Launch Raspberry Pi Imager",
          lookFor:
            "Notice the setup workflow: Device · Operating System · Storage · Customization · Writing.",
          why: "These are the major steps required to prepare the Raspberry Pi.",
        },
      ],
    },
    {
      id: "device",
      label: "Section 3 — Configure Raspberry Pi Imager",
      steps: [
        {
          title: "Select Raspberry Pi Device",
          action: "Choose Raspberry Pi 4",
          lookFor: "Confirm Raspberry Pi 4 is selected in the device menu.",
          why: "Selecting the correct device ensures compatibility with the operating system image.",
        },
        {
          title: "Select Raspberry Pi OS",
          action: "Select Raspberry Pi OS (64-bit)",
          lookFor: "Choose the recommended 64-bit Raspberry Pi OS image.",
          why: "Recommended by the Raspberry Pi Foundation · Supports our Computer Vision projects · Better long-term compatibility · Supports modern software libraries.",
        },
        {
          title: "Select Storage Device",
          lookFor: "Verify that the correct MicroSD card is selected.",
          why: "Selecting the wrong storage device may erase important files.",
          warning: "Always verify the storage device before proceeding.",
        },
      ],
    },
    {
      id: "customize",
      label: "Section 4 — Customize Raspberry Pi Settings",
      steps: [
        {
          title: "Configure Hostname",
          action: "Examples: student-pi, yourname-pi, summercamp-pi",
          lookFor: "Enter a unique network name for your Raspberry Pi.",
          why: "Unique hostnames make devices easier to identify in classrooms and labs.",
        },
        {
          title: "Configure Localization",
          action: "Set Country, Time Zone, and Keyboard Layout",
          lookFor: "Verify regional settings match your location.",
          why: "Correct localization ensures correct time, keyboard behavior, and regional settings.",
        },
        {
          title: "Create User Account",
          action: "Create a username and password",
          lookFor: "Enter credentials you will use to log in on first boot.",
          why: "Choose a password you can remember but others cannot easily guess.",
        },
      ],
    },
    {
      id: "write",
      label: "Section 5 — Writing Raspberry Pi OS",
      steps: [
        {
          title: "Review Configuration",
          lookFor: "Verify Raspberry Pi 4, Raspberry Pi OS (64-bit), and the correct storage device.",
          why: "Engineering best practice: confirm selections before writing the image.",
        },
        {
          title: "Confirm Installation",
          lookFor: "Read the warning that the selected storage device will be erased.",
          why: "Data erased during this step cannot be recovered.",
          warning: "Always verify the storage device before proceeding.",
        },
        {
          title: "Writing Raspberry Pi OS",
          action: "Click WRITE",
          lookFor: "Watch the progress bar while the operating system is copied onto the MicroSD card.",
          why: "Behind the scenes, Raspberry Pi Imager is writing thousands of system files that allow the Raspberry Pi to boot and operate. This may take several minutes.",
        },
        {
          title: "Verification Process",
          lookFor: "Wait while the software verifies the installation.",
          why: "Verification ensures the operating system was copied correctly. Corrupted installations often cause boot failures.",
        },
        {
          title: "Installation Complete",
          lookFor: "Wait for the completion screen when installation finishes.",
          why: "Your Raspberry Pi operating system is now ready to boot.",
        },
      ],
    },
  ]
  const [phase, setPhase] = useState(0)
  const [openStep, setOpenStep] = useState(0)
  const current = phases[phase]

  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Raspberry Pi Imager Guide</p>
      <div className="flex flex-wrap gap-2">
        {phases.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setPhase(i)
              setOpenStep(0)
            }}
            className={cn(
              "px-3 py-1.5 rounded-lg border text-xs font-medium",
              phase === i ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {current.steps.map((step, i) => (
          <button
            key={step.title}
            type="button"
            onClick={() => setOpenStep(openStep === i ? -1 : i)}
            className={cn(
              "w-full text-left rounded-lg border p-3",
              openStep === i ? "border-violet-500 bg-violet-500/10" : "border-slate-200 dark:border-slate-700",
            )}
          >
            <p className="text-sm font-medium text-slate-900 dark:text-white">{step.title}</p>
            {openStep === i && (
              <div className="mt-3 space-y-2">
                <CampScaledImage
                  src={readStepImage(merged, `${current.id}:${i}`)}
                  alt={step.title}
                  placeholder="Guide screenshot"
                  aspectClass="aspect-video"
                  imgClassName="object-contain p-2 bg-white dark:bg-slate-900"
                />
                {step.action && (
                  <p className="text-xs text-violet-700 dark:text-violet-300">
                    <strong>Student Action:</strong> {step.action}
                  </p>
                )}
                {step.lookFor && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    <strong>What To Look For:</strong> {step.lookFor}
                  </p>
                )}
                {step.why && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    <strong>Why This Matters:</strong> {step.why}
                  </p>
                )}
                {step.warning && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">⚠ {step.warning}</p>
                )}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export function CampPiTroubleshootingBlock() {
  const scenarios = [
    {
      title: "No Display",
      causes: ["HDMI Issue", "Power Issue", "SD Card Issue"],
      correct: ["HDMI Issue", "Power Issue", "SD Card Issue"],
    },
    {
      title: "Camera Not Found",
      causes: ["Ribbon Cable", "Camera Disabled", "Loose Connection"],
      correct: ["Ribbon Cable", "Camera Disabled", "Loose Connection"],
    },
    {
      title: "No WiFi",
      causes: ["Wrong Password", "Network Issue", "Weak Signal"],
      correct: ["Wrong Password", "Network Issue", "Weak Signal"],
    },
  ]
  const [active, setActive] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const scenario = scenarios[active]
  const toggle = (cause: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(cause)) next.delete(cause)
      else next.add(cause)
      return next
    })
  const isCorrect =
    scenario.correct.every((c) => selected.has(c)) && selected.size === scenario.correct.length
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Engineering Troubleshooting</p>
      <div className="flex flex-wrap gap-2">
        {scenarios.map((s, i) => (
          <button
            key={s.title}
            type="button"
            onClick={() => { setActive(i); setSelected(new Set()) }}
            className={cn(
              "px-3 py-1.5 rounded-full border text-xs",
              active === i ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700",
            )}
          >
            {s.title}
          </button>
        ))}
      </div>
      <p className="text-sm font-medium">{scenario.title} — select all possible causes:</p>
      <div className="flex flex-wrap gap-2">
        {scenario.causes.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => toggle(c)}
            className={cn(
              "px-3 py-1.5 rounded-full border text-sm",
              selected.has(c) ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      {selected.size > 0 && (
        <p className={cn("text-sm", isCorrect ? "text-emerald-600" : "text-amber-600")}>
          {isCorrect ? "All causes identified — good troubleshooting!" : "Select all likely causes for this scenario."}
        </p>
      )}
    </div>
  )
}

export function CampMissionSuccessBlock() {
  const accomplished = [
    "Assembled Raspberry Pi Hardware",
    "Installed Raspberry Pi OS",
    "Configured Device Settings",
    "Booted Your Raspberry Pi",
    "Verified Camera Connectivity",
    "Prepared Your Edge Computing Platform",
  ]
  return (
    <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 p-4 sm:p-6 space-y-4 text-center">
      <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
      <p className="font-bold text-lg text-emerald-900 dark:text-emerald-100">Mission Success</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">Congratulations! You have:</p>
      <ul className="text-left space-y-1.5 max-w-sm mx-auto">
        {accomplished.map((a) => (
          <li key={a} className="text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <span className="text-emerald-600">✓</span>{a}
          </li>
        ))}
      </ul>
      <Badge className="bg-emerald-600 text-white text-sm px-4 py-1">Edge Device Ready</Badge>
      <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 text-left text-sm text-violet-800 dark:text-violet-200">
        <p className="font-medium mb-1">Unlocked — Module 9</p>
        <p className="text-xs">
          Module 9: OpenCV Setup &amp; Computer Vision Environment — install the software libraries that allow your
          Raspberry Pi to process images, detect faces, and begin performing real Computer Vision tasks.
        </p>
      </div>
    </div>
  )
}
