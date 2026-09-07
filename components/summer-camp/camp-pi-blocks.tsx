"use client"

import { useEffect, useState } from "react"
import {
  Brain,
  Camera,
  ChevronDown,
  Cpu,
  HardDrive,
  MemoryStick,
  Monitor,
  Plug,
  Shield,
  Zap,
  Leaf,
  Home,
  Bot,
  Factory,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CampScaledImage } from "@/components/summer-camp/CampScaledImage"
import { mergeInteractiveImages } from "@/lib/summer-camp/ai-edge-interactive-defaults"
import { cn } from "@/lib/utils"

export function CampPiHeroBlock({ content }: { content?: Record<string, unknown> }) {
  const merged = mergeInteractiveImages("pi_hero", content ?? {})
  const imageUrl = String(merged.imageUrl ?? "").trim() || undefined
  return (
    <div className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-slate-900/5 overflow-hidden">
      <CampScaledImage
        src={imageUrl}
        alt="Raspberry Pi 4 Model B"
        placeholder="Raspberry Pi hero photo"
        aspectClass="aspect-[16/9] sm:aspect-[2/1]"
        imgClassName="object-contain bg-slate-900 p-2"
        className="rounded-none"
      />
      <div className="p-4 text-center">
        <p className="font-bold text-lg text-slate-900 dark:text-white">Raspberry Pi</p>
        <p className="text-sm text-slate-500">A tiny computer that can run AI</p>
      </div>
    </div>
  )
}

export function CampPiAiPollBlock() {
  const [choice, setChoice] = useState<string | null>(null)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Can this tiny device run Artificial Intelligence?</p>
      <div className="flex gap-3">
        {[
          { id: "yes", label: "Yes", correct: true },
          { id: "no", label: "No" },
        ].map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setChoice(o.id)}
            className={cn(
              "flex-1 rounded-lg border px-4 py-3 text-sm font-medium",
              choice === o.id
                ? o.correct
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-amber-500 bg-amber-500/10"
                : "border-slate-200 dark:border-slate-700",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {choice === "yes" && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm space-y-1 text-emerald-800 dark:text-emerald-200">
          <p className="font-bold">Surprisingly — YES!</p>
          <p>This small computer can run Linux, connect to sensors and cameras, run AI models, detect objects, and control robots. That is exactly what we will do.</p>
        </div>
      )}
      {choice === "no" && (
        <p className="text-sm text-amber-600">Think again — Raspberry Pi runs TensorFlow Lite and real object detection!</p>
      )}
    </div>
  )
}

export function CampDesktopVsPiBlock({ content }: { content?: Record<string, unknown> }) {
  const merged = mergeInteractiveImages("desktop_vs_pi", content ?? {})
  const desktopImageUrl = String(merged.desktopImageUrl ?? "").trim() || undefined
  const piImageUrl = String(merged.piImageUrl ?? "").trim() || undefined
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-slate-500" />
          <p className="font-semibold text-slate-900 dark:text-white">Traditional Desktop</p>
        </div>
        <CampScaledImage
          src={desktopImageUrl}
          alt="Traditional desktop computer with monitor"
          placeholder="Desktop computer photo"
          aspectClass="aspect-[4/3]"
          imgClassName="object-contain bg-white dark:bg-slate-800 p-1"
        />
        <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
          <li>• Large</li>
          <li>• Expensive</li>
          <li>• Power hungry</li>
        </ul>
      </div>
      <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-violet-500" />
          <p className="font-semibold text-slate-900 dark:text-white">Raspberry Pi</p>
        </div>
        <CampScaledImage
          src={piImageUrl}
          alt="Raspberry Pi 4 Model B"
          placeholder="Raspberry Pi photo"
          aspectClass="aspect-[4/3]"
          imgClassName="object-contain bg-slate-900 p-1"
        />
        <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
          <li>• Small</li>
          <li>• Affordable</li>
          <li>• Energy efficient</li>
          <li>• Portable</li>
        </ul>
      </div>
    </div>
  )
}

export function CampPiWhyLoveBlock() {
  const reasons = [
    {
      title: "Affordable",
      desc: "Students can experiment without expensive hardware.",
      icon: Zap,
    },
    {
      title: "Powerful",
      desc: "Runs Linux, supports programming, and runs AI models.",
      icon: Brain,
    },
    {
      title: "Flexible",
      desc: "Connect cameras, sensors, displays, motors, and robots.",
      icon: Plug,
    },
    {
      title: "Large Community",
      desc: "Millions of users worldwide with thousands of tutorials.",
      icon: Shield,
    },
  ]
  const [open, setOpen] = useState(0)
  return (
    <div className="space-y-2">
      {reasons.map((r, i) => {
        const Icon = r.icon
        return (
          <button
            key={r.title}
            type="button"
            onClick={() => setOpen(open === i ? -1 : i)}
            className={cn(
              "w-full text-left rounded-xl border p-4 flex gap-3",
              open === i ? "border-violet-500 bg-violet-500/10" : "border-dashboard-v2-border bg-dashboard-v2-card",
            )}
          >
            <Icon className="h-5 w-5 text-violet-500 shrink-0" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{r.title}</p>
              {open === i && <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{r.desc}</p>}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function CampPiHardwareExplorerBlock({ content }: { content?: Record<string, unknown> }) {
  const merged = mergeInteractiveImages("pi_hardware_explorer", content ?? {})
  const imageUrl = String(merged.imageUrl ?? "").trim() || undefined
  const components = [
    {
      id: "cpu",
      label: "CPU (Processor)",
      icon: Cpu,
      detail: "The brain of the Raspberry Pi. Runs programs, processes AI models, and manages tasks.",
    },
    {
      id: "ram",
      label: "RAM (Memory)",
      icon: MemoryStick,
      detail: "Temporary workspace. Stores active data while programs run.",
    },
    {
      id: "sd",
      label: "MicroSD Card",
      icon: HardDrive,
      detail: "Permanent storage. Contains the operating system, programs, and files.",
    },
    {
      id: "usb",
      label: "USB Ports",
      icon: Plug,
      detail: "Connect keyboard, mouse, and external devices.",
    },
    {
      id: "hdmi",
      label: "HDMI Port",
      icon: Monitor,
      detail: "Connects to a monitor and displays output.",
    },
    {
      id: "power",
      label: "Power Port",
      icon: Zap,
      detail: "Supplies power. Without power, there is no computation.",
    },
    {
      id: "camera",
      label: "Camera Connector",
      icon: Camera,
      detail: "Connects the Raspberry Pi Camera Module for image capture, object detection, and computer vision.",
      highlight: true,
    },
    {
      id: "gpio",
      label: "GPIO Pins",
      icon: Plug,
      detail: "General Purpose Input/Output — interact with sensors, motors, LEDs, and robots.",
    },
  ]
  const [active, setActive] = useState<string | null>("cpu")
  const selected = components.find((c) => c.id === active)
  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Interactive Hardware Explorer</p>
      <div className="relative">
        <CampScaledImage
          src={imageUrl}
          alt="Raspberry Pi board — top view"
          placeholder="Raspberry Pi board photo"
          aspectClass="aspect-[3/2]"
          imgClassName="object-contain bg-slate-900 p-2"
        />
        {selected?.highlight && (
          <Badge className="absolute top-2 right-2 text-[9px] bg-emerald-600">Project Critical</Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {components.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActive(active === c.id ? null : c.id)}
            className={cn(
              "px-2.5 py-1.5 rounded-lg border text-xs font-medium",
              active === c.id
                ? c.highlight
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-violet-500 bg-violet-500 text-white"
                : "border-slate-200 dark:border-slate-700",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      {selected && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <p className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <selected.icon className="h-4 w-4 text-violet-500" />
            {selected.label}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{selected.detail}</p>
        </div>
      )}
    </div>
  )
}

export function CampPiComponentMatchBlock() {
  const slots = [
    { id: "cpu", label: "CPU location", answer: "CPU (Processor)" },
    { id: "ram", label: "RAM chips", answer: "RAM (Memory)" },
    { id: "sd", label: "SD card slot", answer: "MicroSD Card" },
    { id: "camera", label: "CSI ribbon port", answer: "Camera Connector" },
    { id: "gpio", label: "Pin header row", answer: "GPIO Pins" },
    { id: "hdmi", label: "HDMI output", answer: "HDMI Port" },
  ]
  const options = ["CPU (Processor)", "RAM (Memory)", "MicroSD Card", "Camera Connector", "GPIO Pins", "HDMI Port", "USB Ports", "Power Port"]
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)
  const isCorrect = slots.every((s) => assignments[s.id] === s.answer)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Match components to locations</p>
      <p className="text-sm text-slate-500">Assign each component name to the correct board location.</p>
      {slots.map((slot) => (
        <div key={slot.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <p className="text-sm font-medium mb-2">{slot.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {options.map((opt) => (
              <button
                key={`${slot.id}-${opt}`}
                type="button"
                onClick={() => {
                  setAssignments((a) => ({ ...a, [slot.id]: assignments[slot.id] === opt ? "" : opt }))
                  setChecked(false)
                }}
                className={cn(
                  "px-2 py-1 rounded-full border text-[11px]",
                  assignments[slot.id] === opt
                    ? "border-violet-500 bg-violet-500/15"
                    : "border-slate-200 dark:border-slate-700",
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
      <Button size="sm" disabled={slots.some((s) => !assignments[s.id])} onClick={() => setChecked(true)}>
        Check matches
      </Button>
      {checked && (
        <p className={cn("text-sm", isCorrect ? "text-emerald-600" : "text-amber-600")}>
          {isCorrect ? "Perfect! You know where each component lives on the board." : "Review the hardware explorer above and try again."}
        </p>
      )}
    </div>
  )
}

export function CampPiEdgeDiagramBlock() {
  const steps = ["Camera", "Raspberry Pi", "AI Model", "Detection Results"]
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % steps.length), 1400)
    return () => clearInterval(t)
  }, [steps.length])
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5">
      <p className="font-semibold text-slate-900 dark:text-white mb-3">Raspberry Pi as an Edge Device</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={cn(
              "px-3 py-2 rounded-lg border text-sm",
              active === i ? "border-emerald-500 bg-emerald-500/15 font-medium" : "border-slate-200 dark:border-slate-700 text-slate-500",
            )}>{s}</span>
            {i < steps.length - 1 && <ChevronDown className="h-3 w-3 rotate-[-90deg] text-emerald-400" />}
          </div>
        ))}
      </div>
      <p className="text-xs text-center text-emerald-700 dark:text-emerald-300 mt-4 font-medium">
        This is Edge AI — everything happens locally on the Pi.
      </p>
    </div>
  )
}

export function CampPiRealWorldBlock() {
  const apps = [
    { title: "Smart Agriculture", icon: Leaf, examples: ["Crop Monitoring", "Disease Detection", "Environmental Sensing"] },
    { title: "Smart Security", icon: Shield, examples: ["Object Detection", "Intrusion Detection", "Monitoring"] },
    { title: "Robotics", icon: Bot, examples: ["Navigation", "Vision", "Control Systems"] },
    { title: "Smart Homes", icon: Home, examples: ["Automation", "Energy Management", "Security"] },
    { title: "Industrial Systems", icon: Factory, examples: ["Equipment Monitoring", "Predictive Maintenance", "Automation"] },
  ]
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {apps.map((a) => {
        const Icon = a.icon
        return (
          <div key={a.title} className="rounded-xl border border-dashboard-v2-border p-4">
            <div className="h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
              <Icon className="h-6 w-6 text-violet-500" />
            </div>
            <p className="font-semibold text-sm text-slate-900 dark:text-white">{a.title}</p>
            <ul className="mt-2 space-y-0.5">
              {a.examples.map((e) => (
                <li key={e} className="text-xs text-slate-500">• {e}</li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

export function CampCameraModuleBlock({ content }: { content?: Record<string, unknown> }) {
  const merged = mergeInteractiveImages("camera_module", content ?? {})
  const imageUrl = String(merged.imageUrl ?? "").trim() || undefined
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Raspberry Pi Camera Module</p>
      <CampScaledImage
        src={imageUrl}
        alt="Raspberry Pi Camera Module v2 with ribbon cable"
        placeholder="Camera module photo"
        aspectClass="aspect-[4/3]"
        imgClassName="object-contain bg-slate-900 p-2"
      />
      <p className="text-sm text-slate-600 dark:text-slate-400">
        The camera serves as the <strong>eyes</strong> of our Edge AI system — it provides the visual data our AI model needs.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {["Camera", "Image", "AI Model", "Object Detection", "Results"].map((s, i, arr) => (
          <div key={s} className="flex items-center gap-2">
            <span className="px-2 py-1 rounded border border-violet-500/30 text-xs">{s}</span>
            {i < arr.length - 1 && <ChevronDown className="h-3 w-3 rotate-[-90deg] text-violet-400" />}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CampCameraRequiredPollBlock() {
  const [choice, setChoice] = useState<string | null>(null)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">
        Without the camera, could our object detection system work?
      </p>
      <div className="flex gap-3">
        {[
          { id: "yes", label: "Yes" },
          { id: "no", label: "No", correct: true },
        ].map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setChoice(o.id)}
            className={cn(
              "flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium",
              choice === o.id
                ? o.correct
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-amber-500 bg-amber-500/10"
                : "border-slate-200 dark:border-slate-700",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {choice === "no" && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Correct — the camera provides the data; the AI provides the intelligence.
        </p>
      )}
      {choice === "yes" && (
        <p className="text-sm text-amber-600">Object detection needs images from the camera to work.</p>
      )}
    </div>
  )
}

export function CampPiEcosystemBlock({ content }: { content?: Record<string, unknown> }) {
  const merged = mergeInteractiveImages("pi_ecosystem", content ?? {})
  const imageUrl = String(merged.imageUrl ?? "").trim() || undefined
  const devices = [
    { name: "Camera", emoji: "📷", essential: true },
    { name: "Display", emoji: "🖥️" },
    { name: "Keyboard", emoji: "⌨️" },
    { name: "Mouse", emoji: "🖱️" },
    { name: "Temp Sensor", emoji: "🌡️" },
    { name: "Motion Sensor", emoji: "📡" },
    { name: "Robot", emoji: "🤖" },
    { name: "LED", emoji: "💡" },
    { name: "Speaker", emoji: "🔊" },
    { name: "Microphone", emoji: "🎤" },
  ]
  const [connected, setConnected] = useState<Set<string>>(new Set())
  const toggle = (name: string) =>
    setConnected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">What Can We Connect?</p>
      <p className="text-sm text-slate-500">Tap devices to connect them to your Raspberry Pi.</p>
      <div className="relative">
        <CampScaledImage
          src={imageUrl}
          alt="Raspberry Pi with camera module connected"
          placeholder="Raspberry Pi with peripherals"
          aspectClass="aspect-[16/9]"
          imgClassName="object-contain bg-slate-900 p-2"
        />
        {connected.size > 0 && (
          <Badge className="absolute top-2 right-2 text-[10px]">{connected.size} connected</Badge>
        )}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {devices.map((d) => (
          <button
            key={d.name}
            type="button"
            onClick={() => toggle(d.name)}
            className={cn(
              "rounded-lg border p-2 text-center text-xs transition-colors",
              connected.has(d.name)
                ? "border-violet-500 bg-violet-500/15"
                : "border-slate-200 dark:border-slate-700",
            )}
          >
            <span className="text-xl block">{d.emoji}</span>
            {d.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export function CampPiSetupBuilderBlock({
  content,
  camperProfile,
  onSaveProfile,
  readOnly,
}: {
  content: Record<string, unknown>
  camperProfile?: Record<string, unknown>
  onSaveProfile?: (patch: Record<string, unknown>) => Promise<void>
  readOnly?: boolean
}) {
  const key = String(content.profileKey ?? "piSetupDesign")
  const saved = (camperProfile?.[key] ?? {}) as Record<string, string>
  const challenges = (content.challenges as string[]) ?? ["Smart Greenhouse", "Smart Security System"]
  const peripherals = (content.peripherals as string[]) ?? [
    "Camera", "Temperature Sensor", "Motion Sensor", "LED", "Display", "Speaker",
  ]
  const [challenge, setChallenge] = useState(saved.challenge ?? "")
  const [selected, setSelected] = useState<string[]>(
    Array.isArray(saved.peripherals) ? (saved.peripherals as string[]) : [],
  )
  const [notes, setNotes] = useState(saved.notes ?? "")
  const [saving, setSaving] = useState(false)
  const toggle = (p: string) =>
    setSelected((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">
        {String(content.title ?? "Build Your Raspberry Pi Setup")}
      </p>
      <p className="text-sm text-slate-500">Choose a challenge and select peripherals for your system.</p>
      <div className="flex flex-wrap gap-2">
        {challenges.map((c) => (
          <button
            key={c}
            type="button"
            disabled={readOnly}
            onClick={() => setChallenge(c)}
            className={cn(
              "px-3 py-1.5 rounded-full border text-sm",
              challenge === c ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {peripherals.map((p) => (
          <button
            key={p}
            type="button"
            disabled={readOnly}
            onClick={() => toggle(p)}
            className={cn(
              "px-2.5 py-1 rounded-full border text-xs",
              selected.includes(p) ? "border-emerald-500 bg-emerald-500/15" : "border-slate-200 dark:border-slate-700",
            )}
          >
            {p}
          </button>
        ))}
      </div>
      {challenge && selected.length > 0 && (
        <p className="text-sm text-violet-700 dark:text-violet-300 font-medium text-center">
          {challenge}: Pi + {selected.join(" + ")}
        </p>
      )}
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Describe what your system does..."
        rows={2}
        disabled={readOnly}
        className="resize-none"
      />
      {!readOnly && onSaveProfile && (
        <Button
          size="sm"
          disabled={saving || !challenge || selected.length === 0}
          onClick={async () => {
            setSaving(true)
            try {
              await onSaveProfile({ [key]: { challenge, peripherals: selected, notes } })
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? "Saving…" : "Save setup design"}
        </Button>
      )}
    </div>
  )
}

export function CampPiSafetyBlock() {
  const rules = [
    "Handle carefully",
    "Avoid static electricity",
    "Use proper power supply",
    "Disconnect power before hardware modifications",
    "Handle camera cables carefully",
  ]
  const checklist = [
    "I will disconnect power before connecting hardware",
    "I will use the correct power supply",
    "I will handle the camera ribbon cable gently",
    "I will avoid touching GPIO pins while powered on",
  ]
  const [scenario, setScenario] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5">
        <p className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-600" /> Hardware Safety Rules
        </p>
        <ul className="space-y-1.5">
          {rules.map((r) => (
            <li key={r} className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <span className="text-emerald-600">✓</span>{r}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
        <p className="font-semibold text-slate-900 dark:text-white">What should you do before connecting a camera?</p>
        {[
          { id: "power", label: "Disconnect power", correct: true },
          { id: "monitor", label: "Turn monitor off" },
          { id: "sd", label: "Remove SD card" },
          { id: "restart", label: "Restart system" },
        ].map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setScenario(o.id)}
            className={cn(
              "w-full text-left rounded-lg border px-3 py-2.5 text-sm",
              scenario === o.id
                ? o.correct
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-amber-500 bg-amber-500/10"
                : "border-slate-200 dark:border-slate-700",
            )}
          >
            {o.label}
          </button>
        ))}
        {scenario === "power" && (
          <p className="text-sm text-emerald-600">Correct — always disconnect power before hardware changes.</p>
        )}
      </div>
      <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-2">
        <p className="font-semibold text-sm text-slate-900 dark:text-white">Safety Checklist — confirm each item</p>
        {checklist.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() =>
              setConfirmed((prev) => {
                const next = new Set(prev)
                if (next.has(item)) next.delete(item)
                else next.add(item)
                return next
              })
            }
            className={cn(
              "w-full text-left rounded-lg border px-3 py-2 text-xs flex items-center gap-2",
              confirmed.has(item) ? "border-emerald-500 bg-emerald-500/10" : "border-slate-200 dark:border-slate-700",
            )}
          >
            <span className={cn("size-4 rounded border flex items-center justify-center text-[10px]", confirmed.has(item) ? "bg-emerald-500 text-white border-emerald-500" : "border-slate-300")}>
              {confirmed.has(item) ? "✓" : ""}
            </span>
            {item}
          </button>
        ))}
        {confirmed.size === checklist.length && (
          <p className="text-sm text-emerald-600 font-medium">Safety checklist complete!</p>
        )}
      </div>
    </div>
  )
}

export function CampPiProjectWalkthroughBlock() {
  const steps = [
    {
      label: "Camera",
      purpose: "Capture visual data",
      input: "Light / scene",
      output: "Digital image frame",
      role: "Sensor — the eyes of the system",
    },
    {
      label: "Capture Image",
      purpose: "Grab a frame from the camera",
      input: "Live video stream",
      output: "Single image buffer",
      role: "Data acquisition step",
    },
    {
      label: "Raspberry Pi",
      purpose: "Run the Edge AI pipeline",
      input: "Image + AI model",
      output: "Inference results",
      role: "Edge device — local processing",
    },
    {
      label: "TensorFlow Lite",
      purpose: "Run AI inference efficiently",
      input: "Preprocessed image tensor",
      output: "Detection scores + coordinates",
      role: "AI framework optimized for Pi",
    },
    {
      label: "Object Detection",
      purpose: "Identify objects in the frame",
      input: "Model output",
      output: "Labels + confidence scores",
      role: "Core AI capability",
    },
    {
      label: "Bounding Boxes",
      purpose: "Draw boxes around detected objects",
      input: "Detection coordinates",
      output: "Annotated image",
      role: "Visual output for humans",
    },
    {
      label: "Display Results",
      purpose: "Show results on monitor",
      input: "Annotated frame",
      output: "Live detection view",
      role: "Final output to user",
    },
  ]
  const [open, setOpen] = useState(0)
  const s = steps[open]
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Complete Project Architecture</p>
      <div className="flex flex-wrap gap-1.5">
        {steps.map((step, i) => (
          <button
            key={step.label}
            type="button"
            onClick={() => setOpen(i)}
            className={cn(
              "px-2.5 py-1 rounded-lg border text-xs",
              open === i ? "border-emerald-500 bg-emerald-500/15 font-medium" : "border-slate-200 dark:border-slate-700",
            )}
          >
            {step.label}
          </button>
        ))}
      </div>
      {s && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-2 text-sm">
          <p><strong>Purpose:</strong> {s.purpose}</p>
          <p><strong>Input:</strong> {s.input}</p>
          <p><strong>Output:</strong> {s.output}</p>
          <p><strong>Role:</strong> {s.role}</p>
        </div>
      )}
    </div>
  )
}

export function CampPiMissionPreviewBlock() {
  const missions = [
    "Install Raspberry Pi OS",
    "Configure Hardware",
    "Connect Camera",
    "Install TensorFlow Lite",
    "Run AI Models",
    "Build Object Detection System",
  ]
  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Mission Preview — What&apos;s Next</p>
      <ul className="space-y-2">
        {missions.map((m) => (
          <li key={m} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <span className="text-emerald-600">✓</span>{m}
          </li>
        ))}
      </ul>
      <p className="text-sm font-medium text-violet-700 dark:text-violet-300 text-center pt-2">
        You are now one step away from building a real Edge AI system.
      </p>
    </div>
  )
}
