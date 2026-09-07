"use client"

import { useEffect, useState } from "react"
import {
  Brain,
  Camera,
  ChevronDown,
  Cloud,
  Cpu,
  Sparkles,
  Zap,
  Battery,
  HardDrive,
  Server,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function CampSmartCameraPollBlock() {
  const options = [
    { id: "magic", label: "Magic" },
    { id: "human", label: "Human Operator" },
    { id: "edge_ai", label: "Edge AI", correct: true },
    { id: "internet", label: "Faster Internet" },
  ]
  const [choice, setChoice] = useState<string | null>(null)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">How is this possible?</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        A smart camera detects people, vehicles, packages, and suspicious activity — without sending video to the cloud.
      </p>
      <div className="grid sm:grid-cols-2 gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setChoice(o.id)}
            className={cn(
              "rounded-lg border px-3 py-2.5 text-left text-sm",
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
      {choice === "edge_ai" && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">
          <p className="font-bold">Edge AI — The camera itself runs Artificial Intelligence locally.</p>
        </div>
      )}
      {choice && choice !== "edge_ai" && (
        <p className="text-sm text-amber-600">Try again — the intelligence runs on the device itself.</p>
      )}
    </div>
  )
}

export function CampEdgeAiFormulaBlock() {
  const [pulse, setPulse] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setPulse((p) => (p + 1) % 3), 1200)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white text-center">Edge AI Formula</p>
      <div className="flex flex-wrap items-center justify-center gap-3 text-lg font-bold">
        <span className={cn("px-4 py-2 rounded-lg border", pulse === 0 ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700")}>
          AI
        </span>
        <span className="text-violet-500">×</span>
        <span className={cn("px-4 py-2 rounded-lg border", pulse === 1 ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700")}>
          Edge Computing
        </span>
        <span className="text-violet-500">=</span>
        <span className={cn("px-4 py-2 rounded-lg border", pulse === 2 ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "border-slate-200 dark:border-slate-700")}>
          Edge AI
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        {["AI", "Edge Device", "Smart Decisions"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg bg-white/60 dark:bg-slate-900/60 border border-violet-500/20 text-sm">{s}</span>
            {i < 2 && <ChevronDown className="h-3 w-3 rotate-[-90deg] text-violet-400" />}
          </div>
        ))}
      </div>
      <p className="text-xs text-center text-slate-500">Instead of sending data elsewhere, the device itself becomes intelligent.</p>
    </div>
  )
}

export function CampIntelligenceEvolutionBlock() {
  const generations = [
    {
      gen: "Generation 1",
      title: "Traditional Devices",
      desc: "Only collect data — basic cameras, simple sensors, thermometers",
      flow: ["Collect data"],
    },
    {
      gen: "Generation 2",
      title: "Cloud AI",
      desc: "Send data to cloud for AI processing, then receive response",
      flow: ["Collect", "Send to cloud", "AI processing", "Response"],
    },
    {
      gen: "Generation 3",
      title: "Edge AI",
      desc: "Process locally and decide immediately",
      flow: ["Collect", "Process locally", "Decide immediately"],
      highlight: true,
    },
  ]
  const timeline = ["Traditional Systems", "Cloud Computing", "Cloud AI", "Edge AI"]
  const [active, setActive] = useState(2)
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        {generations.map((g, i) => (
          <button
            key={g.gen}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "rounded-xl border p-4 text-left transition-colors",
              active === i
                ? g.highlight
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-violet-500 bg-violet-500/10"
                : "border-dashboard-v2-border bg-dashboard-v2-card",
            )}
          >
            <Badge variant="outline" className="text-[10px] mb-2">{g.gen}</Badge>
            <p className="font-semibold text-sm text-slate-900 dark:text-white">{g.title}</p>
            <p className="text-xs text-slate-500 mt-1">{g.desc}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {g.flow.map((f) => (
                <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">{f}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4">
        <p className="font-semibold text-sm text-slate-900 dark:text-white mb-3">Evolution Timeline</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {timeline.map((t, i) => (
            <div key={t} className="flex items-center gap-2">
              <span className={cn(
                "px-2 py-1 rounded text-xs",
                i === timeline.length - 1 ? "bg-emerald-500/15 border border-emerald-500/30 font-medium" : "border border-slate-200 dark:border-slate-700",
              )}>{t}</span>
              {i < timeline.length - 1 && <ChevronDown className="h-3 w-3 rotate-[-90deg] text-slate-400" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function CampEdgeAiArchitectureBlock() {
  const components = [
    {
      title: "Sensor",
      desc: "Collects data",
      examples: ["Camera", "Microphone", "Temperature Sensor", "GPS", "LiDAR"],
      icon: Camera,
    },
    {
      title: "Edge Device",
      desc: "Processes data",
      examples: ["Raspberry Pi", "Jetson Nano", "Smartphone", "Drone Controller"],
      icon: Cpu,
    },
    {
      title: "AI Model",
      desc: "Provides intelligence",
      examples: ["Object Detection", "Face Recognition", "Speech Recognition", "Anomaly Detection"],
      icon: Brain,
    },
    {
      title: "Decision Engine",
      desc: "Acts on results",
      examples: ["Send Alert", "Stop Vehicle", "Open Gate", "Notify User"],
      icon: Zap,
    },
  ]
  const [open, setOpen] = useState(0)
  const pipeline = ["Sensor", "Edge Device", "AI Model", "Decision", "Action"]
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {components.map((c, i) => {
          const Icon = c.icon
          return (
            <button
              key={c.title}
              type="button"
              onClick={() => setOpen(open === i ? -1 : i)}
              className={cn(
                "w-full text-left rounded-xl border p-4 flex gap-3",
                open === i ? "border-violet-500 bg-violet-500/10" : "border-dashboard-v2-border bg-dashboard-v2-card",
              )}
            >
              <Icon className="h-5 w-5 text-violet-500 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-slate-900 dark:text-white">{c.title}</p>
                <p className="text-xs text-slate-500">{c.desc}</p>
                {open === i && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.examples.map((e) => (
                      <span key={e} className="text-[10px] px-2 py-0.5 rounded-full border border-violet-500/30">{e}</span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
      <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
        <p className="font-semibold text-sm text-slate-900 dark:text-white mb-3 text-center">Edge AI System Flow</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {pipeline.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-lg border border-violet-500/30 text-sm font-medium">{s}</span>
              {i < pipeline.length - 1 && <ChevronDown className="h-3 w-3 rotate-[-90deg] text-violet-400" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function CampEdgeAiChallengesBlock() {
  const challenges = [
    { icon: Cpu, title: "Limited Processing Power", desc: "Edge devices are smaller than cloud servers" },
    { icon: HardDrive, title: "Limited Memory", desc: "Less RAM available for AI models" },
    { icon: Battery, title: "Power Constraints", desc: "Battery-powered devices require efficiency" },
    { icon: Server, title: "Storage Constraints", desc: "Limited space for models and data" },
  ]
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {challenges.map((c) => {
        const Icon = c.icon
        return (
          <div key={c.title} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <Icon className="h-5 w-5 text-amber-600 mb-2" />
            <p className="font-semibold text-sm text-slate-900 dark:text-white">{c.title}</p>
            <p className="text-xs text-slate-500 mt-1">{c.desc}</p>
          </div>
        )
      })}
    </div>
  )
}

export function CampCloudVsPiBlock() {
  const rows = [
    { aspect: "Processing Power", cloud: "Very High", pi: "Moderate" },
    { aspect: "Memory (RAM)", cloud: "Terabytes", pi: "1–8 GB" },
    { aspect: "Power Usage", cloud: "High (data center)", pi: "Low (5–15W)" },
    { aspect: "Cost", cloud: "Expensive at scale", pi: "Affordable (~$35–$80)" },
    { aspect: "Deployment", cloud: "Remote servers", pi: "On-site, local" },
  ]
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Cloud Server vs Raspberry Pi</p>
      <p className="text-sm text-slate-500">Predict the differences, then reveal the comparison.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 pr-2 text-slate-500 font-medium">Aspect</th>
              <th className="text-left py-2 px-2 text-sky-600 font-medium">Cloud Server</th>
              <th className="text-left py-2 pl-2 text-violet-600 font-medium">Raspberry Pi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.aspect} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-2 font-medium">{r.aspect}</td>
                <td className={cn("py-2 px-2", revealed ? "text-sky-700 dark:text-sky-300" : "text-slate-300 blur-sm select-none")}>{r.cloud}</td>
                <td className={cn("py-2 pl-2", revealed ? "text-violet-700 dark:text-violet-300" : "text-slate-300 blur-sm select-none")}>{r.pi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!revealed && (
        <Button size="sm" variant="outline" onClick={() => setRevealed(true)}>Reveal comparison</Button>
      )}
      {revealed && (
        <p className="text-xs text-violet-600 dark:text-violet-400">
          How can AI run on small devices? We will discover <strong>TensorFlow Lite</strong>.
        </p>
      )}
    </div>
  )
}

export function CampCapstonePipelineBlock() {
  const steps = [
    "Camera",
    "Capture Image",
    "Raspberry Pi",
    "TensorFlow Lite Model",
    "Object Detection",
    "Display Results",
  ]
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % steps.length), 1400)
    return () => clearInterval(t)
  }, [steps.length])
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5">
      <p className="font-semibold text-slate-900 dark:text-white mb-4">Our Edge AI Object Detection System</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={cn(
              "px-3 py-2 rounded-lg border text-sm transition-all",
              active === i ? "border-emerald-500 bg-emerald-500/15 font-medium scale-105" : "border-slate-200 dark:border-slate-700 text-slate-500",
            )}>{s}</span>
            {i < steps.length - 1 && <ChevronDown className="h-3 w-3 rotate-[-90deg] text-emerald-400" />}
          </div>
        ))}
      </div>
      <p className="text-xs text-center text-emerald-700 dark:text-emerald-300 mt-4 font-medium">
        This entire process occurs locally — no cloud required.
      </p>
    </div>
  )
}

export function CampCapstoneStepsBlock() {
  const steps = [
    { n: 1, title: "Camera captures frame", detail: "The CSI camera module grabs a live image" },
    { n: 2, title: "Raspberry Pi receives image", detail: "Image data flows into the Pi over the ribbon cable" },
    { n: 3, title: "AI model processes image", detail: "TensorFlow Lite runs inference on the frame" },
    { n: 4, title: "Objects identified", detail: "The model classifies what it sees (person, car, etc.)" },
    { n: 5, title: "Bounding boxes generated", detail: "Boxes drawn around each detected object" },
    { n: 6, title: "Results displayed", detail: "Output shown on monitor with labels and scores" },
  ]
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-2">
      <p className="font-semibold text-slate-900 dark:text-white">Step-by-Step Walkthrough</p>
      {steps.map((s) => (
        <button
          key={s.n}
          type="button"
          onClick={() => setOpen(open === s.n ? null : s.n)}
          className={cn(
            "w-full text-left rounded-lg border px-3 py-2.5 flex items-start gap-3",
            open === s.n ? "border-emerald-500 bg-emerald-500/10" : "border-slate-200 dark:border-slate-700",
          )}
        >
          <span className="size-6 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center shrink-0">
            {s.n}
          </span>
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{s.title}</p>
            {open === s.n && <p className="text-xs text-slate-500 mt-1">{s.detail}</p>}
          </div>
        </button>
      ))}
    </div>
  )
}

export function CampTfliteCompareBlock() {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Cloud className="h-5 w-5 text-sky-500" />
          <p className="font-semibold text-slate-900 dark:text-white">Cloud AI Model</p>
        </div>
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <li>• Large size (hundreds of MB+)</li>
          <li>• Requires powerful GPUs</li>
          <li>• Massive computation</li>
          <li>• Slow to deploy on devices</li>
        </ul>
      </div>
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="h-5 w-5 text-emerald-500" />
          <p className="font-semibold text-slate-900 dark:text-white">TensorFlow Lite</p>
        </div>
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <li>• Compact and efficient</li>
          <li>• Designed for mobile & embedded</li>
          <li>• Edge-friendly inference</li>
          <li>• Runs on Raspberry Pi</li>
        </ul>
      </div>
    </div>
  )
}

export function CampEdgeAiDesignBlock({
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
  const key = String(content.profileKey ?? "edgeAiProjectConcept")
  const saved = (camperProfile?.[key] ?? {}) as Record<string, string>
  const examples = (content.examples as string[]) ?? [
    "Smart Parking",
    "Smart Security",
    "Classroom Occupancy Detection",
    "Smart Traffic Monitoring",
    "Equipment Monitoring",
  ]
  const [draft, setDraft] = useState({
    problem: saved.problem ?? "",
    sensor: saved.sensor ?? "",
    edgeDevice: saved.edgeDevice ?? "",
    aiCapability: saved.aiCapability ?? "",
    actionTaken: saved.actionTaken ?? "",
    benefits: saved.benefits ?? "",
  })
  const [saving, setSaving] = useState(false)
  const fields = [
    { key: "problem" as const, label: "Problem", placeholder: "What problem does your smart campus solve?" },
    { key: "sensor" as const, label: "Sensor", placeholder: "Camera, microphone, motion sensor…" },
    { key: "edgeDevice" as const, label: "Edge Device", placeholder: "Raspberry Pi, Jetson Nano…" },
    { key: "aiCapability" as const, label: "AI Capability", placeholder: "Object detection, face recognition…" },
    { key: "actionTaken" as const, label: "Action Taken", placeholder: "Send alert, open gate, log data…" },
    { key: "benefits" as const, label: "Benefits", placeholder: "Privacy, speed, reliability…" },
  ]
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">
        {String(content.title ?? "Design Your Edge AI Application")}
      </p>
      <p className="text-sm text-slate-500">Choose an application for a smart campus:</p>
      <div className="flex flex-wrap gap-1.5">
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={readOnly}
            onClick={() => setDraft((d) => ({ ...d, problem: d.problem ? d.problem : `Smart campus: ${ex}` }))}
            className="px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-xs hover:border-violet-400"
          >
            {ex}
          </button>
        ))}
      </div>
      {fields.map((f) => (
        <div key={f.key}>
          <p className="text-xs font-medium text-slate-500 mb-1">{f.label}</p>
          <Textarea
            value={draft[f.key]}
            onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
            placeholder={f.placeholder}
            rows={2}
            disabled={readOnly}
            className="resize-none"
          />
        </div>
      ))}
      {!readOnly && onSaveProfile && (
        <Button
          size="sm"
          disabled={saving || !draft.problem.trim()}
          onClick={async () => {
            setSaving(true)
            try {
              await onSaveProfile({ [key]: draft })
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? "Saving…" : "Save project concept"}
        </Button>
      )}
    </div>
  )
}

export function CampEdgeAiFutureBlock() {
  const emerging = [
    "Smart Robots",
    "Smart Factories",
    "Drones",
    "Wearables",
    "Mixed Reality",
    "Autonomous Vehicles",
    "Space Exploration",
  ]
  const careers = [
    "AI Engineer",
    "Machine Learning Engineer",
    "Computer Vision Engineer",
    "Robotics Engineer",
    "Embedded Systems Engineer",
    "Edge AI Researcher",
    "Cyber-Physical Systems Engineer",
  ]
  const [showCareers, setShowCareers] = useState(false)
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5">
        <p className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" /> Emerging Areas
        </p>
        <div className="flex flex-wrap gap-2">
          {emerging.map((e) => (
            <span key={e} className="px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-sm">{e}</span>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setShowCareers(!showCareers)}
          className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 w-full text-left"
        >
          Career Spotlight
          <ChevronDown className={cn("h-4 w-4 transition-transform", showCareers && "rotate-180")} />
        </button>
        {showCareers && (
          <ul className="mt-3 space-y-1.5">
            {careers.map((c) => (
              <li key={c} className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <span className="text-violet-500">•</span>{c}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
