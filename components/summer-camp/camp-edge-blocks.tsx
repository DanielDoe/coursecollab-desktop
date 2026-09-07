"use client"

import { useEffect, useState } from "react"
import { ChevronDown, Cloud, Cpu, Zap, Shield, Wifi, HardDrive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CampScaledImage } from "@/components/summer-camp/CampScaledImage"

export function CampCloudFlowBlock() {
  const steps = ["Phone / Device", "Internet", "Cloud Data Center", "Response"]
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % steps.length), 1400)
    return () => clearInterval(t)
  }, [steps.length])
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5">
      <p className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Cloud className="h-4 w-4 text-sky-500" /> Cloud Computing Flow
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={cn(
              "px-3 py-2 rounded-lg border text-sm",
              active === i ? "border-sky-500 bg-sky-500/15 font-medium" : "border-slate-200 dark:border-slate-700 text-slate-500",
            )}>{s}</span>
            {i < steps.length - 1 && <ChevronDown className="h-3 w-3 rotate-[-90deg] text-slate-400" />}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CampCloudBenefitsBlock() {
  const benefits = [
    "Massive computing power",
    "Huge storage",
    "Easy scalability",
    "Accessible anywhere",
  ]
  return (
    <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 sm:p-5">
      <p className="font-semibold text-slate-900 dark:text-white mb-3">Benefits of Cloud Computing</p>
      <ul className="space-y-2">
        {benefits.map((b) => (
          <li key={b} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <span className="text-sky-600">✓</span>{b}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CampLatencyWorkflowBlock() {
  const steps = ["Image", "Internet", "Cloud", "AI Analysis", "Internet", "Response"]
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5">
      <p className="font-semibold text-slate-900 dark:text-white mb-2">Cloud Workflow — &quot;Is there a person in this image?&quot;</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {steps.map((s, i) => (
          <span key={`${s}-${i}`} className="px-2 py-1 rounded text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            {s}
          </span>
        ))}
      </div>
      <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">Total delay: several milliseconds to seconds</p>
    </div>
  )
}

export function CampLatencyDemoBlock() {
  const [mode, setMode] = useState<"fast" | "slow">("fast")
  useEffect(() => {
    const t = setInterval(() => setMode((m) => (m === "fast" ? "slow" : "fast")), 2500)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div className={cn(
        "rounded-xl border p-4 text-center transition-all",
        mode === "fast" ? "border-emerald-500 bg-emerald-500/10 scale-[1.02]" : "border-slate-200 dark:border-slate-700 opacity-60",
      )}>
        <Zap className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
        <p className="font-semibold text-sm">Edge — Fast Response</p>
        <p className="text-2xl font-bold text-emerald-600 mt-1">&lt;10ms</p>
      </div>
      <div className={cn(
        "rounded-xl border p-4 text-center transition-all",
        mode === "slow" ? "border-red-500 bg-red-500/10 scale-[1.02]" : "border-slate-200 dark:border-slate-700 opacity-60",
      )}>
        <Cloud className="h-6 w-6 text-red-500 mx-auto mb-2" />
        <p className="font-semibold text-sm">Cloud — Delayed Response</p>
        <p className="text-2xl font-bold text-red-600 mt-1">1–3 sec</p>
      </div>
    </div>
  )
}

export function CampCloudVsEdgeBlock() {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
        <p className="font-semibold text-slate-900 dark:text-white mb-3">Cloud</p>
        {["Data travels far", "Processing in data center", "Response returns over network"].map((s, i) => (
          <p key={s} className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2 mb-1">
            {i > 0 && <ChevronDown className="h-3 w-3" />}{s}
          </p>
        ))}
      </div>
      <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
        <p className="font-semibold text-slate-900 dark:text-white mb-3">Edge</p>
        {["Processing happens nearby", "Immediate response"].map((s) => (
          <p key={s} className="text-sm text-slate-600 dark:text-slate-400 mb-1">{s}</p>
        ))}
        <p className="text-xs text-violet-600 dark:text-violet-400 mt-2 font-medium">Move intelligence closer to the data.</p>
      </div>
    </div>
  )
}

export function CampEdgeBenefitsBlock() {
  const benefits = [
    { icon: Zap, title: "Lower Latency", desc: "Faster decisions for real-time systems" },
    { icon: Shield, title: "Improved Privacy", desc: "Sensitive data stays local — hospitals, security cameras" },
    { icon: Wifi, title: "Reduced Bandwidth", desc: "Less data sent across networks" },
    { icon: HardDrive, title: "Higher Reliability", desc: "Works when internet connection is poor" },
  ]
  const [open, setOpen] = useState(0)
  return (
    <div className="space-y-2">
      {benefits.map((b, i) => {
        const Icon = b.icon
        return (
          <button
            key={b.title}
            type="button"
            onClick={() => setOpen(open === i ? -1 : i)}
            className={cn(
              "w-full text-left rounded-xl border p-4 flex gap-3",
              open === i ? "border-violet-500 bg-violet-500/10" : "border-dashboard-v2-border bg-dashboard-v2-card",
            )}
          >
            <Icon className="h-5 w-5 text-violet-500 shrink-0" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{b.title}</p>
              {open === i && <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{b.desc}</p>}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function CampEdgeBenefitMatchBlock() {
  const pairs = [
    { app: "Autonomous Vehicle", benefit: "Low Latency" },
    { app: "Healthcare", benefit: "Privacy" },
    { app: "Agriculture", benefit: "Reliability" },
    { app: "Smart Factory", benefit: "Reduced Bandwidth" },
  ]
  const [active, setActive] = useState<number | null>(null)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-2">
      <p className="font-semibold text-slate-900 dark:text-white">Match benefit to application</p>
      {pairs.map((p, i) => (
        <button
          key={p.app}
          type="button"
          onClick={() => setActive(active === i ? null : i)}
          className={cn(
            "w-full text-left rounded-lg border px-3 py-2.5 text-sm",
            active === i ? "border-violet-500 bg-violet-500/10" : "border-slate-200 dark:border-slate-700",
          )}
        >
          <span className="font-medium">{p.app}</span>
          <span className="text-violet-500 mx-2">→</span>
          <span className={active === i ? "text-violet-700 dark:text-violet-300" : "text-slate-400"}>
            {active === i ? p.benefit : "?"}
          </span>
        </button>
      ))}
    </div>
  )
}

export function CampEdgeApplicationsBlock() {
  const apps = [
    {
      title: "Smart Security Cameras",
      desc: "Detect intruders locally",
      imageUrl: "/summer-camp/shared/od-security.png",
    },
    {
      title: "Self-Driving Vehicles",
      desc: "Detect obstacles instantly",
      imageUrl: "/summer-camp/shared/od-self-driving.png",
    },
    {
      title: "Smart Agriculture",
      desc: "Monitor crops locally",
      imageUrl: "/summer-camp/shared/iot-agriculture.png",
    },
    {
      title: "Healthcare Devices",
      desc: "Monitor patients in real time",
      imageUrl: "/summer-camp/shared/edge-healthcare-device.png",
    },
    {
      title: "Industrial Automation",
      desc: "Control machinery immediately",
      imageUrl: "/summer-camp/shared/iot-industry.png",
    },
  ]
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {apps.map((a) => (
        <div key={a.title} className="rounded-xl border border-dashboard-v2-border p-4">
          <CampScaledImage
            src={a.imageUrl}
            alt={a.title}
            aspectClass="aspect-[16/9]"
            className="mb-3"
          />
          <p className="font-semibold text-sm text-slate-900 dark:text-white">{a.title}</p>
          <p className="text-xs text-slate-500 mt-1">{a.desc}</p>
        </div>
      ))}
    </div>
  )
}

export function CampEdgeDeviceGalleryBlock() {
  const devices = [
    { name: "Smart Camera", edge: true, emoji: "📷" },
    { name: "Drone", edge: true, emoji: "🛸" },
    { name: "Robot", edge: true, emoji: "🤖" },
    { name: "Raspberry Pi", edge: true, emoji: "🥧" },
    { name: "Smartphone", edge: true, emoji: "📱" },
    { name: "Keyboard", edge: false, emoji: "⌨️" },
  ]
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Edge Device Gallery</p>
      <div className="grid grid-cols-3 gap-2">
        {devices.map((d) => (
          <div key={d.name} className={cn(
            "rounded-lg border p-3 text-center text-sm",
            revealed && d.edge ? "border-emerald-500 bg-emerald-500/10" : "border-slate-200 dark:border-slate-700",
          )}>
            <span className="text-2xl">{d.emoji}</span>
            <p className="text-xs mt-1 font-medium">{d.name}</p>
            {revealed && d.edge && <Badge className="mt-1 text-[9px] h-4">Edge</Badge>}
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" onClick={() => setRevealed(true)}>Show Edge Devices</Button>
    </div>
  )
}

export function CampPiHardwarePreviewBlock() {
  const ports = [
    { id: "usb", label: "USB", detail: "Keyboard, mouse, storage, camera adapters" },
    { id: "hdmi", label: "HDMI", detail: "Monitor or TV display output" },
    { id: "camera", label: "Camera Port", detail: "CSI ribbon camera for our object detection project" },
    { id: "gpio", label: "GPIO", detail: "Pins for sensors, LEDs, and hardware control" },
    { id: "cpu", label: "CPU", detail: "Runs Linux and TensorFlow Lite inference" },
    { id: "storage", label: "Storage", detail: "microSD card holds OS, models, and code" },
  ]
  const [active, setActive] = useState<string | null>(null)
  const selected = ports.find((p) => p.id === active)
  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Raspberry Pi Hardware Preview</p>
      <div className="h-28 rounded-lg bg-slate-800 flex items-center justify-center relative">
        <Cpu className="h-12 w-12 text-violet-400" />
        <p className="absolute bottom-2 text-[10px] text-slate-500">[Pi board image placeholder]</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {ports.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActive(active === p.id ? null : p.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg border text-xs font-medium",
              active === p.id ? "border-violet-500 bg-violet-500 text-white" : "border-slate-200 dark:border-slate-700",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {selected && <p className="text-sm text-slate-600 dark:text-slate-400"><strong>{selected.label}:</strong> {selected.detail}</p>}
    </div>
  )
}

export function CampCloudEdgeSortBlock({ content }: { content: Record<string, unknown> }) {
  const scenarios = (content.scenarios as Array<{ label: string; answer: string }>) ?? [
    { label: "Netflix Movie Recommendations", answer: "Cloud" },
    { label: "Self-Driving Vehicle Braking", answer: "Edge" },
    { label: "Smart Home Camera Alerts", answer: "Edge" },
    { label: "Large Language Model Training", answer: "Cloud" },
    { label: "Real-Time Object Detection", answer: "Edge" },
  ]
  const [assignments, setAssignments] = useState<Record<number, string>>({})
  const [checked, setChecked] = useState(false)
  const isCorrect = scenarios.every((s, i) => assignments[i] === s.answer)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Cloud or Edge?</p>
      {scenarios.map((s, i) => (
        <div key={s.label} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <p className="text-sm font-medium mb-2">{s.label}</p>
          <div className="flex gap-2">
            {["Cloud", "Edge"].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { setAssignments((a) => ({ ...a, [i]: opt })); setChecked(false) }}
                className={cn(
                  "px-3 py-1 rounded-full border text-xs",
                  assignments[i] === opt
                    ? opt === "Cloud" ? "border-sky-500 bg-sky-500/15" : "border-violet-500 bg-violet-500/15"
                    : "border-slate-200 dark:border-slate-700",
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
      <Button size="sm" disabled={Object.keys(assignments).length < scenarios.length} onClick={() => setChecked(true)}>
        Check answers
      </Button>
      {checked && (
        <p className={cn("text-sm", isCorrect ? "text-emerald-600" : "text-amber-600")}>
          {isCorrect ? "Perfect! You know when to use cloud vs edge." : "Review the scenarios — real-time and privacy favor edge."}
        </p>
      )}
    </div>
  )
}

export function CampEdgeJourneyBlock() {
  const steps = [
    "AI", "Machine Learning", "Deep Learning", "Computer Vision",
    "IoT", "Edge Computing", "Raspberry Pi", "Object Detection",
  ]
  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 sm:p-5">
      <p className="font-semibold text-slate-900 dark:text-white mb-4">Your Camp Journey</p>
      <div className="relative pl-4 border-l-2 border-violet-500/40 space-y-3">
        {steps.map((step, i) => (
          <div key={step} className="relative">
            <span className={cn(
              "absolute -left-[21px] top-0.5 size-3 rounded-full border-2",
              i === steps.length - 1 ? "bg-violet-500 border-violet-500" : "bg-white dark:bg-slate-900 border-violet-400",
            )} />
            <p className={cn("text-sm", i === steps.length - 1 ? "font-bold text-violet-700 dark:text-violet-300" : "text-slate-700 dark:text-slate-300")}>
              {step}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
