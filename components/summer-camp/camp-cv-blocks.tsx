"use client"

import { useEffect, useState } from "react"
import { ChevronDown, Eye, Cpu, Calculator, Clock, TrafficCone, Ruler, Film, ScanFace, Bot, Mail, SpellCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CampScaledImage } from "@/components/summer-camp/CampScaledImage"
import { CampModernSurface } from "@/components/summer-camp/camp-modern-blocks"
import { useCampPresentation } from "@/components/summer-camp/camp-presentation-context"

export function CampVisionObserveBlock({ content }: { content: Record<string, unknown> }) {
  const objects = (content.objects as string[]) ?? ["Dog", "Person", "Car", "Tree", "Traffic Light"]
  const [answer, setAnswer] = useState("")
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <CampScaledImage
        src="/summer-camp/shared/od-smart-city.png"
        alt="Isometric city scene with objects for computer vision observation"
        aspectClass="aspect-[16/9]"
      />
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">What do YOU see?</p>
      <Textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Type what you notice in the scene…"
        rows={2}
        className="resize-none"
      />
      <Button size="sm" variant="outline" disabled={!answer.trim()} onClick={() => setRevealed(true)}>
        Reveal
      </Button>
      {revealed && (
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 text-sm space-y-2">
          <p className="font-semibold text-violet-800 dark:text-violet-200">
            Humans instantly understand objects, relationships, and context.
          </p>
          <p className="text-slate-600 dark:text-slate-400">
            Computers do not naturally see {objects.join(", ")} — they must <strong>learn</strong> from data.
          </p>
        </div>
      )}
    </div>
  )
}

export function CampVisionPipelineCompareBlock() {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4">
        <p className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white mb-3">
          <Eye className="h-4 w-4 text-blue-500" /> Human Vision
        </p>
        {["Human Eye", "Brain", "Understanding"].map((s, i) => (
          <div key={s} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span className="px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 flex-1">{s}</span>
            {i < 2 && <ChevronDown className="h-3 w-3 rotate-[-90deg] text-slate-400" />}
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4">
        <p className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white mb-3">
          <Cpu className="h-4 w-4 text-violet-500" /> Computer Vision
        </p>
        {["Camera", "Image Data", "AI Model", "Understanding"].map((s, i) => (
          <div key={s} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-1">
            <span className="px-2 py-1 rounded bg-violet-500/10 border border-violet-500/20 flex-1">{s}</span>
            {i < 3 && <ChevronDown className="h-3 w-3 rotate-[-90deg] text-slate-400" />}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CampPixelZoomBlock() {
  const [zoom, setZoom] = useState(0)
  const levels = ["Full Image 🖼️", "Pixel Grid", "Single Pixel"]
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 text-center space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Zoom Into an Image</p>
      <div
        className={cn(
          "mx-auto rounded-lg border border-dashboard-v2-border bg-gradient-to-br from-orange-200 to-amber-300 dark:from-orange-900/40 dark:to-amber-900/40 transition-all",
          zoom === 0 && "h-32 w-48",
          zoom === 1 && "h-32 w-48 grid grid-cols-8 grid-rows-6 gap-px p-1",
          zoom === 2 && "h-16 w-16",
        )}
      >
        {zoom === 1 &&
          Array.from({ length: 48 }).map((_, i) => (
            <div key={i} className="bg-orange-400/60 dark:bg-orange-600/60 rounded-[1px]" />
          ))}
      </div>
      <p className="text-sm text-violet-600 dark:text-violet-400 font-medium">{levels[zoom]}</p>
      <div className="flex justify-center gap-2">
        <Button size="sm" variant="outline" disabled={zoom === 0} onClick={() => setZoom((z) => z - 1)}>Zoom out</Button>
        <Button size="sm" variant="outline" disabled={zoom === 2} onClick={() => setZoom((z) => z + 1)}>Zoom in</Button>
      </div>
    </div>
  )
}

export function CampRgbToolBlock() {
  const [r, setR] = useState(255)
  const [g, setG] = useState(0)
  const [b, setB] = useState(0)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Interactive RGB Tool</p>
      <div
        className="h-24 rounded-xl border border-dashboard-v2-border mx-auto max-w-xs"
        style={{ backgroundColor: `rgb(${r},${g},${b})` }}
      />
      <p className="text-center text-sm text-slate-600 dark:text-slate-400">
        R={r} G={g} B={b}
      </p>
      {[
        { label: "Red", value: r, set: setR, color: "bg-red-500" },
        { label: "Green", value: g, set: setG, color: "bg-green-500" },
        { label: "Blue", value: b, set: setB, color: "bg-blue-500" },
      ].map((ch) => (
        <div key={ch.label} className="flex items-center gap-3">
          <span className="text-xs w-12 text-slate-600">{ch.label}</span>
          <input
            type="range"
            min={0}
            max={255}
            value={ch.value}
            onChange={(e) => ch.set(Number(e.target.value))}
            className="flex-1 accent-violet-500"
          />
          <span className="text-xs w-8 text-right">{ch.value}</span>
        </div>
      ))}
    </div>
  )
}

export function CampDogVsMatrixBlock() {
  const [view, setView] = useState<"human" | "computer">("human")
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant={view === "human" ? "default" : "outline"} onClick={() => setView("human")}>Humans See</Button>
        <Button size="sm" variant={view === "computer" ? "default" : "outline"} onClick={() => setView("computer")}>Computer Sees</Button>
      </div>
      {view === "human" ? (
        <div className="text-center py-8">
          <span className="text-6xl">🐕</span>
          <p className="text-xl font-bold mt-3 text-slate-900 dark:text-white">Dog</p>
        </div>
      ) : (
        <div className="rounded-lg bg-slate-950 p-3 font-mono text-[10px] text-emerald-400 overflow-x-auto max-h-32">
          {[
            [142, 88, 201, 55, 190, 77, 133, 210, 45, 168, 92, 155],
            [201, 55, 142, 88, 77, 190, 210, 45, 133, 92, 168, 55],
            [88, 142, 55, 201, 190, 77, 45, 210, 92, 133, 155, 168],
            [55, 201, 88, 142, 77, 190, 133, 45, 168, 92, 210, 77],
            [142, 55, 201, 88, 190, 77, 210, 133, 45, 155, 92, 168],
            [201, 88, 55, 142, 77, 190, 45, 210, 133, 92, 168, 55],
          ].map((row, ri) => (
            <div key={ri}>{row.map((v, ci) => <span key={ci}>{v} </span>)}</div>
          ))}
          <p className="text-slate-500 mt-2 font-sans text-xs">Thousands of numbers (pixel values)…</p>
        </div>
      )}
    </div>
  )
}

export function CampCvFeaturePipelineBlock() {
  const steps = ["Dog Image", "Pixel Matrix", "Feature Extraction", "Prediction"]
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % steps.length), 1800)
    return () => clearInterval(t)
  }, [steps.length])
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5">
      <p className="font-semibold text-slate-900 dark:text-white mb-3">What Does a Computer Actually See?</p>
      <div className="flex flex-wrap items-center gap-2 justify-center">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={cn(
              "px-3 py-1.5 rounded-lg border text-sm",
              active === i ? "border-violet-500 bg-violet-500/15 font-medium" : "border-slate-200 dark:border-slate-700 text-slate-500",
            )}>{s}</span>
            {i < steps.length - 1 && <ChevronDown className="h-3 w-3 rotate-[-90deg] text-slate-400" />}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-3 text-center">The model learns patterns, edges, shapes, textures, and colors.</p>
    </div>
  )
}

export function CampCatDogCompareBlock() {
  const [showAi, setShowAi] = useState(false)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Compare: Cat vs Dog</p>
      <div className="grid grid-cols-2 gap-4 text-center">
        <div><span className="text-5xl">🐈</span><p className="text-sm mt-2">Pointed ears, whiskers, slender face</p></div>
        <div><span className="text-5xl">🐕</span><p className="text-sm mt-2">Floppy ears, broader snout, varied size</p></div>
      </div>
      <Button size="sm" variant="outline" onClick={() => setShowAi(true)}>Show AI-learned features</Button>
      {showAi && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">
          AI highlights: ear shape, nose width, fur texture patterns, body proportions.
        </div>
      )}
    </div>
  )
}

export function CampCvTasksBlock() {
  const [open, setOpen] = useState<string | null>("classification")
  const tasks = [
    {
      id: "classification",
      title: "Image Classification",
      question: "What is in the image?",
      example: "Image → AI → Dog (one label)",
      note: "Output: one label",
    },
    {
      id: "detection",
      title: "Object Detection",
      question: "What objects are present and where?",
      example: "Person, Car, Dog, Traffic Light + Bounding Boxes",
      note: "⭐ This is the task our final project uses.",
    },
    {
      id: "segmentation",
      title: "Image Segmentation",
      question: "Which pixels belong to each object?",
      example: "Road, Person, Vehicle, Tree — pixel-level masks",
      note: "Each object receives pixel-level labeling",
    },
  ]
  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setOpen(open === t.id ? null : t.id)}
          className={cn(
            "w-full text-left rounded-xl border p-4 transition-colors",
            open === t.id ? "border-violet-500 bg-violet-500/10" : "border-dashboard-v2-border bg-dashboard-v2-card",
          )}
        >
          <p className="font-semibold text-slate-900 dark:text-white">{t.title}</p>
          <p className="text-sm text-slate-500">{t.question}</p>
          {open === t.id && (
            <div className="mt-3 space-y-2 text-sm">
              <div className="h-20 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-400">[Example image]</div>
              <p className="text-slate-700 dark:text-slate-300">{t.example}</p>
              <p className={cn("text-xs", t.id === "detection" ? "text-violet-600 font-medium" : "text-slate-500")}>{t.note}</p>
            </div>
          )}
        </button>
      ))}
    </div>
  )
}

export function CampBoundingBoxDemoBlock() {
  const boxes = [
    { label: "Person", top: "15%", left: "10%", w: "25%", h: "45%", color: "border-red-500" },
    { label: "Car", top: "40%", left: "45%", w: "40%", h: "35%", color: "border-blue-500" },
    { label: "Dog", top: "55%", left: "5%", w: "20%", h: "25%", color: "border-emerald-500" },
  ]
  return (
    <div className="rounded-xl border border-dashboard-v2-border overflow-hidden">
      <div className="relative h-48 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800">
        {boxes.map((b) => (
          <div
            key={b.label}
            className={cn("absolute border-2 rounded-sm", b.color)}
            style={{ top: b.top, left: b.left, width: b.w, height: b.h }}
          >
            <span className="absolute -top-5 left-0 text-[10px] font-bold bg-black/70 text-white px-1 rounded">{b.label}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-center text-slate-500 p-2">Interactive detection example — bounding boxes</p>
    </div>
  )
}

export function CampTaskSortBlock({ content }: { content: Record<string, unknown> }) {
  const inPresentation = useCampPresentation()
  const examples = (content.examples as Array<{ text: string; task: string }>) ?? [
    { text: "Is this a cat or dog?", task: "Classification" },
    { text: "Draw boxes around all cars", task: "Detection" },
    { text: "Color each pixel of the road", task: "Segmentation" },
    { text: "Label the entire image as sunset", task: "Classification" },
    { text: "Find all pedestrians and bikes", task: "Detection" },
  ]
  const tasks = (content.tasks as string[]) ?? ["Classification", "Detection", "Segmentation"]
  const [assignments, setAssignments] = useState<Record<number, string>>({})
  const [checked, setChecked] = useState(false)
  const allAssigned = examples.every((_, i) => assignments[i])
  const isCorrect = examples.every((ex, i) => assignments[i] === ex.task)

  const exampleIcons = [Calculator, Clock, TrafficCone, Ruler, Film, ScanFace, Bot, Mail, SpellCheck]
  const taskColors: Record<string, string> = {
    "Traditional Software": "hover:bg-slate-500/10 data-[active=true]:bg-slate-600 data-[active=true]:text-white",
    "Artificial Intelligence": "hover:bg-violet-500/10 data-[active=true]:bg-violet-600 data-[active=true]:text-white",
    "Generally Safe to Share": "hover:bg-emerald-500/10 data-[active=true]:bg-emerald-600 data-[active=true]:text-white",
    "Safe to Share": "hover:bg-emerald-500/10 data-[active=true]:bg-emerald-600 data-[active=true]:text-white",
    "Keep Private": "hover:bg-rose-500/10 data-[active=true]:bg-rose-600 data-[active=true]:text-white",
    Classification: "hover:bg-blue-500/10 data-[active=true]:bg-blue-600 data-[active=true]:text-white",
    Detection: "hover:bg-amber-500/10 data-[active=true]:bg-amber-600 data-[active=true]:text-white",
    Segmentation: "hover:bg-emerald-500/10 data-[active=true]:bg-emerald-600 data-[active=true]:text-white",
  }

  return (
    <CampModernSurface className="space-y-4">
      <p className={cn("text-lg font-bold", inPresentation ? "text-slate-900" : "text-slate-900 dark:text-white")}>
        {String(content.title ?? "Sort into the correct category")}
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {examples.map((ex, i) => {
          const Icon = exampleIcons[i % exampleIcons.length]
          return (
            <div
              key={ex.text}
              className={cn(
                "rounded-xl p-4 ring-1 space-y-3 hover:shadow-md transition-shadow",
                inPresentation
                  ? "bg-white ring-slate-200/70"
                  : "bg-white/80 dark:bg-white/[0.04] ring-slate-200/70 dark:ring-white/10",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="size-10 shrink-0 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <Icon className={cn("h-5 w-5", inPresentation ? "text-violet-600" : "text-violet-600 dark:text-violet-400")} />
                </div>
                <p className={cn("text-sm font-medium leading-snug pt-1", inPresentation ? "text-slate-900" : "text-slate-900 dark:text-white")}>
                  {ex.text}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {tasks.map((t) => (
                  <button
                    key={t}
                    type="button"
                    data-active={assignments[i] === t}
                    onClick={() => {
                      setAssignments((a) => ({ ...a, [i]: t }))
                      setChecked(false)
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold ring-1 transition-all duration-200",
                      inPresentation
                        ? "text-slate-700 bg-white ring-slate-200/70"
                        : "ring-slate-200/70 dark:ring-white/10 text-slate-700 dark:text-slate-200",
                      taskColors[t] ?? "hover:bg-violet-500/10 data-[active=true]:bg-violet-600 data-[active=true]:text-white",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <Button size="sm" disabled={!allAssigned} onClick={() => setChecked(true)}>
        Check answers
      </Button>
      {checked && (
        <p
          className={cn(
            "text-sm font-medium",
            isCorrect
              ? inPresentation
                ? "text-emerald-700"
                : "text-emerald-600 dark:text-emerald-400"
              : inPresentation
                ? "text-amber-800"
                : "text-amber-600 dark:text-amber-400",
          )}
        >
          {isCorrect ? "Perfect! You understand the categories." : "Review the definitions above and try again."}
        </p>
      )}
    </CampModernSurface>
  )
}

export function CampDetectionScoresBlock({ content }: { content?: Record<string, unknown> }) {
  const objects = [
    { label: "Person", score: 98 },
    { label: "Bottle", score: 95 },
    { label: "Laptop", score: 92 },
  ]
  const imageUrl = String(content?.imageUrl ?? "").trim() || undefined
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Object Detection Output</p>
      <CampScaledImage
        src={imageUrl}
        alt="Detection output example"
        placeholder="Detection image"
        aspectClass="aspect-video"
        className="mb-3"
        imgClassName="object-cover"
      />
      {objects.map((o) => (
        <div key={o.label} className="flex items-center justify-between text-sm">
          <span className="font-medium">{o.label}</span>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">{o.score}%</Badge>
        </div>
      ))}
    </div>
  )
}

export function CampDetectionViewerBlock() {
  const [playing, setPlaying] = useState(false)
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => setFrame((f) => (f + 1) % 3), 800)
    return () => clearInterval(t)
  }, [playing])
  const positions = [
    { top: "20%", left: "15%" },
    { top: "35%", left: "50%" },
    { top: "50%", left: "25%" },
  ]
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Interactive Detection Viewer</p>
      <div className="relative h-40 rounded-lg bg-slate-800 overflow-hidden">
        {playing && (
          <div
            className="absolute border-2 border-yellow-400 w-16 h-20 transition-all duration-500"
            style={{ top: positions[frame].top, left: positions[frame].left }}
          />
        )}
        <p className="absolute bottom-2 left-2 text-xs text-slate-400">[Placeholder detection video]</p>
      </div>
      <Button size="sm" onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play detection demo"}</Button>
    </div>
  )
}

export function CampOdUseCasesBlock({ content }: { content: Record<string, unknown> }) {
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

export function CampHumanVsAiBlock() {
  const samples = ["🐕", "🚗", "🧑", "🌳", "🚦", "🐈", "🚲", "📦", "🏠", "✈️"]
  const aiLabels = ["Dog", "Car", "Person", "Tree", "Light", "Cat", "Bicycle", "Package", "Building", "Plane"]
  const [revealed, setRevealed] = useState(false)
  const [startTime] = useState(Date.now())
  const [doneTime, setDoneTime] = useState<number | null>(null)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Vision Challenge — Human vs AI</p>
      <p className="text-sm text-slate-500">Identify objects in these 10 images, then reveal AI predictions.</p>
      <div className="grid grid-cols-5 gap-2">
        {samples.map((emoji, i) => (
          <div key={i} className="aspect-square rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-2xl">
            {emoji}
            {revealed && <span className="text-[9px] text-violet-600 mt-1">{aiLabels[i]}</span>}
          </div>
        ))}
      </div>
      <Button size="sm" onClick={() => { setRevealed(true); setDoneTime(Date.now()) }}>
        Reveal AI predictions
      </Button>
      {revealed && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200 space-y-1">
          <p><strong>Key lesson:</strong> AI can be powerful — but AI is not perfect.</p>
          <p>AI processed 10 images in ~0.1s. Humans took ~{doneTime ? Math.max(1, Math.round((doneTime - startTime) / 1000)) : "?"}s.</p>
        </div>
      )}
    </div>
  )
}

export function CampVisionDesignBlock({
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
  const options = (content.options as string[]) ?? ["People", "Animals", "Vehicles", "Packages", "Plants", "Other"]
  const key = String(content.profileKey ?? "visionSystemDesign")
  const saved = (camperProfile?.[key] ?? {}) as { selected?: string[]; description?: string }
  const [selected, setSelected] = useState<string[]>(saved.selected ?? [])
  const [description, setDescription] = useState(saved.description ?? "")
  const [saving, setSaving] = useState(false)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">{String(content.title ?? "Design Your AI Camera")}</p>
      <p className="text-sm text-slate-500">What should your camera detect?</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={readOnly}
            onClick={() => setSelected((s) => (s.includes(opt) ? s.filter((x) => x !== opt) : [...s, opt]))}
            className={cn(
              "px-3 py-1.5 rounded-full border text-sm",
              selected.includes(opt) ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700",
            )}
          >
            {opt}
          </button>
        ))}
      </div>
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What would your camera detect and why?"
        rows={3}
        disabled={readOnly}
        className="resize-none"
      />
      {!readOnly && onSaveProfile && (
        <Button
          size="sm"
          disabled={saving || selected.length === 0}
          onClick={async () => {
            setSaving(true)
            try {
              await onSaveProfile({ [key]: { selected, description } })
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? "Saving…" : "Save vision system design"}
        </Button>
      )}
    </div>
  )
}

export function CampSegmentationDemoBlock() {
  return (
    <div className="rounded-xl border border-dashboard-v2-border overflow-hidden h-40 relative">
      <div className="absolute inset-0 grid grid-cols-4">
        <div className="bg-red-500/40" title="Road" />
        <div className="bg-blue-500/40" title="Person" />
        <div className="bg-green-500/40" title="Vehicle" />
        <div className="bg-yellow-500/40" title="Tree" />
      </div>
      <p className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-1 rounded">Segmentation map — pixel-level labels</p>
    </div>
  )
}
