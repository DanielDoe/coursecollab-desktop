"use client"

import { useEffect, useState } from "react"
import { ChevronDown, Wifi, Radio, Cloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { CampScaledImage } from "@/components/summer-camp/CampScaledImage"

export function CampIotNetworkFlowBlock() {
  const steps = ["Person", "Internet", "Device", "Device", "Cloud"]
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % steps.length), 1200)
    return () => clearInterval(t)
  }, [steps.length])
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5">
      <p className="font-semibold text-slate-900 dark:text-white mb-4">IoT: Devices Communicate with Devices</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={`${s}-${i}`} className="flex items-center gap-2">
            <span className={cn(
              "px-3 py-2 rounded-lg border text-sm font-medium",
              active === i ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700 text-slate-500",
            )}>{s}</span>
            {i < steps.length - 1 && <ChevronDown className="h-3 w-3 rotate-[-90deg] text-slate-400" />}
          </div>
        ))}
      </div>
      <CampScaledImage
        src="/summer-camp/shared/iot-network.png"
        alt="Isometric IoT network diagram connecting people, devices, edge hardware, and cloud"
        aspectClass="aspect-[16/9]"
        className="mt-4"
      />
    </div>
  )
}

export function CampSensorGalleryBlock({ content }: { content: Record<string, unknown> }) {
  const sensors = (content.sensors as Array<{ name: string; emoji: string; data: string }>) ?? []
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {sensors.map((s) => (
        <div key={s.name} className="rounded-xl border border-dashboard-v2-border p-3 text-center">
          <div className="h-14 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">{s.emoji}</div>
          <p className="text-sm font-medium mt-2 text-slate-800 dark:text-slate-200">{s.name}</p>
          <p className="text-[10px] text-slate-500">{s.data}</p>
        </div>
      ))}
    </div>
  )
}

export function CampSensorMatchBlock({ content }: { content: Record<string, unknown> }) {
  const pairs = (content.pairs as Array<{ sensor: string; dataType: string }>) ?? [
    { sensor: "Temperature Sensor", dataType: "Degrees Celsius" },
    { sensor: "Camera Sensor", dataType: "Images" },
    { sensor: "Motion Sensor", dataType: "Movement detected" },
    { sensor: "Microphone", dataType: "Audio" },
  ]
  const [active, setActive] = useState<number | null>(null)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-2">
      <p className="font-semibold text-slate-900 dark:text-white">{String(content.title ?? "Match sensor to data type")}</p>
      {pairs.map((p, i) => (
        <button
          key={p.sensor}
          type="button"
          onClick={() => setActive(active === i ? null : i)}
          className={cn(
            "w-full text-left rounded-lg border px-3 py-2.5 text-sm",
            active === i ? "border-violet-500 bg-violet-500/10" : "border-slate-200 dark:border-slate-700",
          )}
        >
          <span className="font-medium">{p.sensor}</span>
          <span className="text-violet-500 mx-2">→</span>
          <span className={active === i ? "text-violet-700 dark:text-violet-300" : "text-slate-400"}>
            {active === i ? p.dataType : "?"}
          </span>
        </button>
      ))}
    </div>
  )
}

export function CampConnectivityMatchBlock() {
  const pairs = [
    { device: "Smart Watch", tech: "Bluetooth", icon: Radio },
    { device: "Home Camera", tech: "WiFi", icon: Wifi },
    { device: "Remote Weather Station", tech: "Cellular", icon: Cloud },
  ]
  const [active, setActive] = useState<number | null>(null)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-2">
      <p className="font-semibold text-slate-900 dark:text-white">Match technology to use case</p>
      {pairs.map((p, i) => {
        const Icon = p.icon
        return (
          <button
            key={p.device}
            type="button"
            onClick={() => setActive(active === i ? null : i)}
            className={cn(
              "w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm",
              active === i ? "border-violet-500 bg-violet-500/10" : "border-slate-200 dark:border-slate-700",
            )}
          >
            <Icon className="h-4 w-4 text-violet-500 shrink-0" />
            <span className="font-medium flex-1 text-left">{p.device}</span>
            <span className="text-violet-500">→</span>
            <span className={active === i ? "text-violet-700 dark:text-violet-300" : "text-slate-400"}>
              {active === i ? p.tech : "?"}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function CampIotComponentsBlock() {
  const components = [
    { n: 1, title: "Sensors", desc: "Collect information — temperature, motion, light, images" },
    { n: 2, title: "Connectivity", desc: "WiFi, Bluetooth, Cellular, Ethernet, LoRa, Satellite" },
    { n: 3, title: "Processing", desc: "Data analyzed on device, in cloud, or both" },
    { n: 4, title: "Action", desc: "Turn on light, send alert, detect object, open gate" },
  ]
  const [open, setOpen] = useState(1)
  return (
    <div className="space-y-2">
      {components.map((c) => (
        <button
          key={c.n}
          type="button"
          onClick={() => setOpen(open === c.n ? 0 : c.n)}
          className={cn(
            "w-full text-left rounded-xl border p-4",
            open === c.n ? "border-violet-500 bg-violet-500/10" : "border-dashboard-v2-border bg-dashboard-v2-card",
          )}
        >
          <p className="font-semibold text-slate-900 dark:text-white">Component {c.n}: {c.title}</p>
          {open === c.n && <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{c.desc}</p>}
        </button>
      ))}
    </div>
  )
}

export function CampIotSystemFlowBlock() {
  const steps = [
    "Camera captures image",
    "Image becomes data",
    "Data transmitted",
    "System analyzes image",
    "User receives alert",
  ]
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % steps.length), 1500)
    return () => clearInterval(t)
  }, [steps.length])
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5">
      <p className="font-semibold text-slate-900 dark:text-white mb-3">Smart Home Security Camera</p>
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={s} className={cn(
            "flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-all",
            active === i ? "border-violet-500 bg-violet-500/15 font-medium" : "border-transparent text-slate-500",
          )}>
            <span className="text-violet-500">{i < steps.length - 1 ? "↓" : "✓"}</span>
            {s}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CampDataExplosionBlock() {
  const scales = [
    { label: "1 Camera", size: "text-sm" },
    { label: "100 Cameras", size: "text-base" },
    { label: "1,000 Cameras", size: "text-lg" },
    { label: "1 Million Cameras", size: "text-2xl font-bold" },
  ]
  const [idx, setIdx] = useState(0)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 text-center space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">The Data Explosion</p>
      <p className={cn("text-violet-600 dark:text-violet-400 transition-all", scales[idx].size)}>
        {scales[idx].label}
      </p>
      <p className="text-sm text-slate-500">= Enormous amounts of data</p>
      <div className="flex justify-center gap-2">
        {scales.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            className={cn("size-2 rounded-full", idx === i ? "bg-violet-500" : "bg-slate-300 dark:bg-slate-600")}
          />
        ))}
      </div>
    </div>
  )
}

export function CampEdgeChoiceBlock() {
  const [choice, setChoice] = useState<string | null>(null)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Self-Driving Vehicle Scenario</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        A child suddenly crosses the road. Which is safer?
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setChoice("A")}
          className={cn(
            "rounded-lg border p-3 text-left text-sm",
            choice === "A" ? "border-red-500 bg-red-500/10" : "border-slate-200 dark:border-slate-700",
          )}
        >
          <p className="font-semibold">Option A</p>
          <p className="text-slate-500 mt-1">Send image to cloud → wait → then brake</p>
        </button>
        <button
          type="button"
          onClick={() => setChoice("B")}
          className={cn(
            "rounded-lg border p-3 text-left text-sm",
            choice === "B" ? "border-emerald-500 bg-emerald-500/10" : "border-slate-200 dark:border-slate-700",
          )}
        >
          <p className="font-semibold">Option B</p>
          <p className="text-slate-500 mt-1">Process image immediately → brake instantly</p>
        </button>
      </div>
      {choice === "B" && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">
          <p className="font-bold">Option B — This idea is called Edge Computing.</p>
          <p className="mt-1">Processing moves closer to the device. Next module: Edge Computing.</p>
        </div>
      )}
      {choice === "A" && (
        <p className="text-sm text-amber-600">Cloud delay is dangerous for real-time safety. Try Option B.</p>
      )}
    </div>
  )
}

export function CampIotAiPipelineBlock() {
  const steps = ["Camera", "Data", "AI Model", "Decision", "Action"]
  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 sm:p-5">
      <p className="font-semibold text-slate-900 dark:text-white mb-3">IoT + AI</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-sm font-medium">{s}</span>
            {i < steps.length - 1 && <ChevronDown className="h-3 w-3 rotate-[-90deg] text-violet-400" />}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 text-center mt-3">AI makes IoT intelligent</p>
    </div>
  )
}

export function CampIotAiExamplesBlock() {
  const examples = [
    { title: "Smart Camera", flow: "Detect Person → Send Alert" },
    { title: "Smart Farm", flow: "Detect Plant Disease → Notify Farmer" },
    { title: "Smart City", flow: "Detect Traffic Congestion → Adjust Signals" },
  ]
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      {examples.map((ex) => (
        <div key={ex.title} className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4">
          <p className="font-semibold text-slate-900 dark:text-white">{ex.title}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{ex.flow}</p>
        </div>
      ))}
    </div>
  )
}

export function CampIotSystemBuilderBlock({
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
  const key = String(content.profileKey ?? "iotSystemDesign")
  const saved = (camperProfile?.[key] ?? {}) as Record<string, string>
  const sensors = (content.sensors as string[]) ?? ["Camera", "Temperature", "Motion", "GPS", "Microphone"]
  const comms = (content.comms as string[]) ?? ["WiFi", "Bluetooth", "Cellular", "Ethernet"]
  const aiCaps = (content.aiCaps as string[]) ?? ["Object Detection", "Anomaly Detection", "Classification", "None"]
  const actions = (content.actions as string[]) ?? ["Alert User", "Turn on Light", "Open Gate", "Log Data"]
  const [draft, setDraft] = useState({
    sensor: saved.sensor ?? "",
    comm: saved.comm ?? "",
    ai: saved.ai ?? "",
    action: saved.action ?? "",
    problem: saved.problem ?? "",
    dataCollected: saved.dataCollected ?? "",
    actionTaken: saved.actionTaken ?? "",
  })
  const [saving, setSaving] = useState(false)
  const pick = (field: keyof typeof draft, value: string) =>
    setDraft((d) => ({ ...d, [field]: d[field] === value ? "" : value }))
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">{String(content.title ?? "Build Your Own IoT System")}</p>
      {[
        { key: "sensor" as const, label: "Sensor", opts: sensors },
        { key: "comm" as const, label: "Communication", opts: comms },
        { key: "ai" as const, label: "AI Capability", opts: aiCaps },
        { key: "action" as const, label: "Action", opts: actions },
      ].map((row) => (
        <div key={row.key}>
          <p className="text-xs font-medium text-slate-500 mb-1.5">{row.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {row.opts.map((o) => (
              <button
                key={o}
                type="button"
                disabled={readOnly}
                onClick={() => pick(row.key, o)}
                className={cn(
                  "px-2.5 py-1 rounded-full border text-xs",
                  draft[row.key] === o ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700",
                )}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      ))}
      {draft.sensor && draft.comm && draft.ai && draft.action && (
        <p className="text-sm text-violet-700 dark:text-violet-300 font-medium text-center">
          {draft.sensor} → {draft.comm} → {draft.ai} → {draft.action}
        </p>
      )}
      <div className="border-t border-dashboard-v2-border pt-3 space-y-2">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Describe your system:</p>
        <Textarea value={draft.problem} onChange={(e) => setDraft((d) => ({ ...d, problem: e.target.value }))} placeholder="What problem does it solve?" rows={2} disabled={readOnly} className="resize-none" />
        <Textarea value={draft.dataCollected} onChange={(e) => setDraft((d) => ({ ...d, dataCollected: e.target.value }))} placeholder="What data does it collect?" rows={2} disabled={readOnly} className="resize-none" />
        <Textarea value={draft.actionTaken} onChange={(e) => setDraft((d) => ({ ...d, actionTaken: e.target.value }))} placeholder="What action does it take?" rows={2} disabled={readOnly} className="resize-none" />
      </div>
      {!readOnly && onSaveProfile && (
        <Button size="sm" disabled={saving || !draft.sensor} onClick={async () => {
          setSaving(true)
          try { await onSaveProfile({ [key]: draft }) } finally { setSaving(false) }
        }}>
          {saving ? "Saving…" : "Save IoT system design"}
        </Button>
      )}
    </div>
  )
}

export function CampIotApplicationsBlock({ content }: { content: Record<string, unknown> }) {
  const sectors =
    (content.sectors as Array<{ title: string; examples: string[]; imageUrl?: string }>) ?? []
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {sectors.map((s) => (
        <div key={s.title} className="rounded-xl border border-dashboard-v2-border p-4">
          <CampScaledImage
            src={s.imageUrl}
            alt={s.title}
            aspectClass="aspect-[16/9]"
            className="mb-3"
          />
          <p className="font-semibold text-slate-900 dark:text-white">{s.title}</p>
          <ul className="mt-2 space-y-1">
            {s.examples.map((e) => (
              <li key={e} className="text-xs text-slate-600 dark:text-slate-400">• {e}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
