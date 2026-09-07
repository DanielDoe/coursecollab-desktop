"use client"

import { useEffect, useState } from "react"
import {
  ChevronDown,
  Shield,
  Trophy,
  CheckCircle2,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CampScaledImage } from "@/components/summer-camp/CampScaledImage"
import { CampZoomableImage } from "@/components/summer-camp/CampZoomableImage"
import { cn } from "@/lib/utils"

export function CampOdMissionBlock() {
  const completed = [
    "Learned Artificial Intelligence",
    "Learned Computer Vision",
    "Learned Edge Computing",
    "Built Your Raspberry Pi",
    "Installed OpenCV",
    "Verified Your Camera",
    "Built a Computer Vision Environment",
  ]
  const objectives = [
    "Understand Object Detection",
    "Run the Detection System",
    "Test Multiple Objects",
    "Investigate Performance",
    "Complete Deployment Checkpoint",
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
      <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Mission Briefing</p>
      <p className="font-bold text-lg text-slate-900 dark:text-white mt-1">Your Edge AI System Is Ready</p>
      <ul className="space-y-1">
        {completed.map((c) => (
          <li key={c} className="text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />{c}
          </li>
        ))}
      </ul>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Today your Raspberry Pi will begin recognizing objects in real time. This is the moment where everything
        you&apos;ve learned comes together.
      </p>
      <div className="space-y-2">
        <p className="text-sm font-semibold">Mission Objectives</p>
        {objectives.map((obj, i) => (
          <button
            key={obj}
            type="button"
            onClick={() => toggle(i)}
            className={cn(
              "w-full text-left rounded-lg border px-3 py-2 text-sm flex items-center gap-3",
              checked.has(i) ? "border-emerald-500 bg-emerald-500/10" : "border-slate-200 dark:border-slate-700",
            )}
          >
            <span className={cn(
              "size-5 rounded border flex items-center justify-center text-xs shrink-0",
              checked.has(i) ? "bg-emerald-500 text-white border-emerald-500" : "border-slate-300",
            )}>
              {checked.has(i) ? "✓" : ""}
            </span>
            {obj}
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Reward</p>
          <p className="text-sm font-bold text-amber-800 dark:text-amber-200">350 XP · Edge AI Explorer Badge</p>
        </div>
        <Trophy className="h-7 w-7 text-amber-500" />
      </div>
    </div>
  )
}

export function CampOpeningChallengeBlock() {
  const objects = ["Person", "Dog", "Backpack", "Bottle", "Laptop"]
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Can AI Recognize Objects?</p>
      <div className="relative h-36 rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex flex-wrap items-center justify-center gap-2 p-4">
        {objects.map((o) => (
          <Badge key={o} variant="outline" className="text-xs">{o}</Badge>
        ))}
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        How quickly could <strong>you</strong> identify these objects? Most humans answer: <strong>Immediately</strong>.
      </p>
      <p className="text-sm font-medium text-violet-700 dark:text-violet-300">
        Now the challenge: Can a Raspberry Pi do the same thing?
      </p>
    </div>
  )
}

export function CampAiAccuracyPollBlock() {
  const options = ["Poor", "Fair", "Good", "Excellent"]
  const [choice, setChoice] = useState<string | null>(null)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">How accurate do you think AI will be?</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setChoice(opt)}
            className={cn(
              "px-4 py-2 rounded-lg border text-sm",
              choice === opt ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700",
            )}
          >
            {opt}
          </button>
        ))}
      </div>
      {choice && (
        <p className="text-sm text-slate-500">Prediction saved — compare with your results after running detection!</p>
      )}
    </div>
  )
}

export function CampOdDefinitionBlock() {
  const flow = ["Input Image", "AI Detection System", "Person (98%)", "Bottle (95%)", "Laptop (92%)"]
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">What Is Object Detection?</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        A Computer Vision task that identifies <strong>what objects exist</strong> and <strong>where they are located</strong>.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {flow.map((s, i, arr) => (
          <div key={s} className="flex items-center gap-2">
            <span className="px-2 py-1 rounded border border-violet-500/30 text-xs">{s}</span>
            {i < arr.length - 1 && <ChevronDown className="h-3 w-3 rotate-[-90deg] text-violet-400" />}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CampOdResultVisualizationBlock({ content }: { content?: Record<string, unknown> }) {
  const detections = [
    { label: "Person", score: 98, top: "12%", left: "8%", w: "28%", h: "50%", color: "border-red-500" },
    { label: "Dog", score: 96, top: "48%", left: "55%", w: "22%", h: "30%", color: "border-emerald-500" },
    { label: "Bottle", score: 92, top: "60%", left: "15%", w: "12%", h: "28%", color: "border-blue-500" },
  ]
  const [show, setShow] = useState(false)
  const originalUrl = String(content?.originalImageUrl ?? content?.imageUrl ?? "").trim() || undefined
  return (
    <div className="rounded-xl border border-dashboard-v2-border overflow-hidden">
      <div className="grid sm:grid-cols-2">
        <div className="p-3 border-b sm:border-b-0 sm:border-r border-dashboard-v2-border">
          <p className="text-xs font-medium text-slate-500 mb-2">Original Image</p>
          <CampScaledImage
            src={originalUrl}
            alt="Original scene"
            placeholder="Original scene"
            aspectClass="aspect-video"
            className="h-32"
            imgClassName="object-cover"
          />
        </div>
        <div className="p-3">
          <p className="text-xs font-medium text-slate-500 mb-2">Detection Result</p>
          <div className="relative h-32 rounded overflow-hidden bg-slate-800">
            {originalUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={originalUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
            ) : null}
            {show && detections.map((d) => (
              <div
                key={d.label}
                className={cn("absolute border-2 rounded-sm", d.color)}
                style={{ top: d.top, left: d.left, width: d.w, height: d.h }}
              >
                <span className="absolute -top-4 left-0 text-[9px] font-bold bg-black/80 text-white px-1 rounded whitespace-nowrap">
                  {d.label} {d.score}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="p-3 border-t border-dashboard-v2-border flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {["Bounding Boxes", "Labels", "Confidence Scores"].map((t) => (
            <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => setShow(true)}>{show ? "Detected!" : "Run detection preview"}</Button>
      </div>
    </div>
  )
}

export function CampManualBoundingBoxBlock({ content }: { content?: Record<string, unknown> }) {
  const targets = ["Person", "Dog", "Backpack"]
  const [drawn, setDrawn] = useState<Set<string>>(new Set())
  const [revealed, setRevealed] = useState(false)
  const sceneUrl = String(content?.imageUrl ?? "").trim() || undefined
  const toggle = (t: string) =>
    setDrawn((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Draw Bounding Boxes</p>
      <p className="text-sm text-slate-500">Tap each object type to mark where you would draw a box.</p>
      <div className="relative h-36 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700">
        {sceneUrl ? (
          <CampZoomableImage
            src={sceneUrl}
            alt="Scene for bounding box exercise"
            className="absolute inset-0 h-full w-full"
            imgClassName="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        {revealed && (
          <>
            <div className="absolute border-2 border-emerald-500 rounded-sm" style={{ top: "40%", left: "10%", width: "25%", height: "35%" }} />
            <div className="absolute border-2 border-red-500 rounded-sm" style={{ top: "15%", left: "50%", width: "20%", height: "45%" }} />
            <div className="absolute border-2 border-blue-500 rounded-sm" style={{ top: "50%", left: "60%", width: "30%", height: "30%" }} />
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {targets.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            className={cn(
              "px-3 py-1.5 rounded-full border text-sm",
              drawn.has(t) ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <Button size="sm" variant="outline" onClick={() => setRevealed(true)}>Reveal AI-generated boxes</Button>
      {revealed && (
        <p className="text-sm text-emerald-600">Compare your boxes with the AI — location matters for self-driving cars, security, and robots.</p>
      )}
    </div>
  )
}

export function CampConfidenceCompareBlock() {
  const [choice, setChoice] = useState<string | null>(null)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Which prediction is more reliable?</p>
      <div className="flex gap-3">
        {[
          { id: "high", label: "Bottle (95%)" },
          { id: "low", label: "Bottle (40%)" },
        ].map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setChoice(o.id)}
            className={cn(
              "flex-1 rounded-lg border px-4 py-3 text-sm font-medium",
              choice === o.id
                ? o.id === "high" ? "border-emerald-500 bg-emerald-500/10" : "border-amber-500 bg-amber-500/10"
                : "border-slate-200 dark:border-slate-700",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {choice === "high" && (
        <p className="text-sm text-emerald-600">Correct — 95% means the AI is highly confident. Remember: confidence is NOT certainty.</p>
      )}
      {choice === "low" && (
        <p className="text-sm text-amber-600">55% is less reliable — the model is uncertain about this detection.</p>
      )}
    </div>
  )
}

export function CampConfidenceVisualBlock() {
  const [mode, setMode] = useState<"high" | "low">("high")
  useEffect(() => {
    const t = setInterval(() => setMode((m) => (m === "high" ? "low" : "high")), 2500)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div className={cn("rounded-xl border p-4 text-center transition-all", mode === "high" ? "border-emerald-500 bg-emerald-500/10 scale-[1.02]" : "border-slate-200 dark:border-slate-700 opacity-60")}>
        <p className="font-semibold text-sm">High Confidence</p>
        <p className="text-3xl font-bold text-emerald-600 mt-2">98%</p>
        <p className="text-xs text-slate-500 mt-1">Solid bounding box, clear label</p>
      </div>
      <div className={cn("rounded-xl border p-4 text-center transition-all", mode === "low" ? "border-amber-500 bg-amber-500/10 scale-[1.02]" : "border-slate-200 dark:border-slate-700 opacity-60")}>
        <p className="font-semibold text-sm">Low Confidence</p>
        <p className="text-3xl font-bold text-amber-600 mt-2">55%</p>
        <p className="text-xs text-slate-500 mt-1">Fuzzy detection, may be wrong</p>
      </div>
    </div>
  )
}

export function CampModelClassGalleryBlock() {
  const classes = [
    "Person", "Dog", "Cat", "Bottle", "Chair", "Car", "Laptop", "Cell Phone", "Backpack", "Cup",
  ]
  const [explored, setExplored] = useState<Set<string>>(new Set())
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Supported Object Classes</p>
      <p className="text-sm text-slate-500">Our pre-trained model has learned thousands of categories. Explore some examples:</p>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {classes.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setExplored((prev) => new Set(prev).add(c))}
            className={cn(
              "rounded-lg border p-2 text-center text-xs",
              explored.has(c) ? "border-violet-500 bg-violet-500/10" : "border-slate-200 dark:border-slate-700",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <p className="text-xs text-violet-600 font-medium">Key Insight: We are not training today — we use a pre-trained model.</p>
    </div>
  )
}

export function CampRunDetectionBlock({ content }: { content?: Record<string, unknown> }) {
  const [predicted, setPredicted] = useState("")
  const [launched, setLaunched] = useState(false)
  const exampleUrl = String(content?.imageUrl ?? "").trim() || undefined
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5 space-y-4">
      {exampleUrl ? (
        <CampScaledImage
          src={exampleUrl}
          alt="Example object detection output"
          placeholder="Detection example"
          aspectClass="aspect-video"
          imgClassName="object-cover"
        />
      ) : null}
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Follow the provided project instructions to launch object detection on your Raspberry Pi.
      </p>
      <div>
        <p className="text-sm font-medium mb-2">Before running — what object will the AI detect first?</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {["Person", "Bottle", "Laptop", "Backpack", "Phone"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setPredicted(opt)}
              className={cn(
                "px-3 py-1.5 rounded-full border text-sm",
                predicted === opt ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700",
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
      <Button size="sm" onClick={() => setLaunched(true)}>I launched object detection</Button>
      {launched && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-center space-y-2">
          <Sparkles className="h-8 w-8 text-emerald-500 mx-auto" />
          <p className="font-bold text-emerald-800 dark:text-emerald-200">
            🎉 Your Raspberry Pi is now performing Edge AI inference in real time!
          </p>
          <p className="text-xs text-slate-500">
            You should see a camera feed, bounding boxes, object labels, and confidence scores.
          </p>
        </div>
      )}
    </div>
  )
}

export function CampDetectionDataTableBlock() {
  const examples = [
    { object: "Bottle", detected: "Yes", score: "95%", correct: "Yes" },
    { object: "Laptop", detected: "Yes", score: "92%", correct: "Yes" },
    { object: "Cup", detected: "Yes", score: "61%", correct: "Partially" },
  ]
  const testObjects = ["Bottle", "Phone", "Laptop", "Backpack", "Person", "Chair", "Book", "Cup"]
  const [rows, setRows] = useState<Record<string, { detected: string; score: string; correct: string }>>({})
  const update = (obj: string, field: string, value: string) =>
    setRows((r) => ({ ...r, [obj]: { ...r[obj], detected: r[obj]?.detected ?? "", score: r[obj]?.score ?? "", correct: r[obj]?.correct ?? "", [field]: value } }))
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Real-Time Detection Data Collection</p>
      <p className="text-sm text-slate-500">Point the camera at different objects and record your results.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 pr-2">Object</th>
              <th className="text-left py-2 px-1">Detected?</th>
              <th className="text-left py-2 px-1">Confidence</th>
              <th className="text-left py-2 pl-1">Correct?</th>
            </tr>
          </thead>
          <tbody>
            {testObjects.map((obj) => (
              <tr key={obj} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-2 font-medium">{obj}</td>
                <td className="py-2 px-1">
                  <select
                    className="text-xs rounded border border-slate-200 dark:border-slate-700 bg-transparent px-1 py-0.5"
                    value={rows[obj]?.detected ?? ""}
                    onChange={(e) => update(obj, "detected", e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </td>
                <td className="py-2 px-1">
                  <input
                    type="text"
                    placeholder="%"
                    className="w-14 text-xs rounded border border-slate-200 dark:border-slate-700 bg-transparent px-1 py-0.5"
                    value={rows[obj]?.score ?? ""}
                    onChange={(e) => update(obj, "score", e.target.value)}
                  />
                </td>
                <td className="py-2 pl-1">
                  <select
                    className="text-xs rounded border border-slate-200 dark:border-slate-700 bg-transparent px-1 py-0.5"
                    value={rows[obj]?.correct ?? ""}
                    onChange={(e) => update(obj, "correct", e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="Yes">Yes</option>
                    <option value="Partially">Partially</option>
                    <option value="No">No</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
        <p className="text-xs font-medium text-slate-500 mb-2">Example results:</p>
        {examples.map((ex) => (
          <p key={ex.object} className="text-xs text-slate-600 dark:text-slate-400">
            {ex.object} · {ex.score} · {ex.correct}
          </p>
        ))}
      </div>
    </div>
  )
}

export function CampConfuseAiBlock() {
  const tests = [
    { label: "Different Lighting", prediction: "Accuracy may decrease in low light" },
    { label: "Different Distances", prediction: "Small/far objects are harder to detect" },
    { label: "Partially Hidden Objects", prediction: "Occlusion reduces confidence" },
    { label: "Multiple Objects", prediction: "Crowded scenes can cause missed detections" },
  ]
  const [active, setActive] = useState<number | null>(null)
  const [notes, setNotes] = useState("")
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Try to Confuse the AI</p>
      <p className="text-sm text-slate-500">Test each condition and record what happened.</p>
      {tests.map((t, i) => (
        <button
          key={t.label}
          type="button"
          onClick={() => setActive(active === i ? null : i)}
          className={cn(
            "w-full text-left rounded-lg border px-3 py-2.5",
            active === i ? "border-violet-500 bg-violet-500/10" : "border-slate-200 dark:border-slate-700",
          )}
        >
          <p className="text-sm font-medium">{t.label}</p>
          {active === i && (
            <p className="text-xs text-violet-600 mt-1">Prediction: {t.prediction}</p>
          )}
        </button>
      ))}
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Record your observations..."
        rows={3}
        className="resize-none text-sm"
      />
      <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
        Key Insight: AI performance depends on data quality.
      </p>
    </div>
  )
}

export function CampOdPipelineAnimBlock({ content }: { content?: Record<string, unknown> }) {
  const steps = ["Camera", "OpenCV Captures Frame", "Object Detection Model", "Detection Results", "Bounding Boxes", "Display on Screen"]
  const [frame, setFrame] = useState(0)
  const imageUrl = String(content?.imageUrl ?? "").trim() || undefined
  useEffect(() => {
    const t = setInterval(() => setFrame((f) => (f + 1) % steps.length), 1200)
    return () => clearInterval(t)
  }, [steps.length])
  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Detection Pipeline — Frame by Frame</p>
      {imageUrl ? (
        <CampScaledImage
          src={imageUrl}
          alt="Detection pipeline"
          placeholder="Pipeline diagram"
          aspectClass="aspect-video"
          imgClassName="object-contain p-2 bg-white dark:bg-slate-900"
        />
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={cn(
              "px-2 py-1.5 rounded-lg border text-xs",
              frame === i ? "border-violet-500 bg-violet-500/15 font-medium" : "border-slate-200 dark:border-slate-700 text-slate-500",
            )}>{s}</span>
            {i < steps.length - 1 && <ChevronDown className="h-3 w-3 rotate-[-90deg] text-violet-400" />}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CampOdJourneyBlock() {
  const steps = ["AI", "Computer Vision", "Edge Computing", "Raspberry Pi", "Object Detection"]
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5">
      <p className="font-semibold text-slate-900 dark:text-white mb-4">Camp Connection — Everything Works Together</p>
      <div className="relative pl-4 border-l-2 border-emerald-500/40 space-y-3">
        {steps.map((step, i) => (
          <div key={step} className="relative">
            <span className={cn(
              "absolute -left-[21px] top-0.5 size-3 rounded-full border-2",
              i === steps.length - 1 ? "bg-emerald-500 border-emerald-500" : "bg-white dark:bg-slate-900 border-emerald-400",
            )} />
            <p className={cn("text-sm", i === steps.length - 1 ? "font-bold text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-slate-300")}>
              {step}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CampOdSecurityDesignBlock({
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
  const key = String(content.profileKey ?? "odSecurityDesign")
  const saved = (camperProfile?.[key] ?? {}) as Record<string, string | string[]>
  const objectOptions = (content.objectOptions as string[]) ?? [
    "People", "Vehicles", "Backpacks", "Bicycles", "Deliveries", "Other",
  ]
  const [objects, setObjects] = useState<string[]>(
    Array.isArray(saved.objects) ? (saved.objects as string[]) : [],
  )
  const [draft, setDraft] = useState({
    problem: String(saved.problem ?? ""),
    desiredAction: String(saved.desiredAction ?? ""),
    impact: String(saved.impact ?? ""),
  })
  const [saving, setSaving] = useState(false)
  const toggle = (o: string) =>
    setObjects((prev) => (prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]))
  const fields = [
    { key: "problem" as const, label: "Problem", placeholder: "What security challenge does your campus face?" },
    { key: "desiredAction" as const, label: "Desired Action", placeholder: "Alert security, log event, open gate..." },
    { key: "impact" as const, label: "Impact", placeholder: "How would this improve campus safety?" },
  ]
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-violet-500" />
        <p className="font-semibold text-slate-900 dark:text-white">Smart Campus Security Design</p>
      </div>
      <p className="text-sm text-slate-500">What should your AI detect?</p>
      <div className="flex flex-wrap gap-2">
        {objectOptions.map((o) => (
          <button
            key={o}
            type="button"
            disabled={readOnly}
            onClick={() => toggle(o)}
            className={cn(
              "px-3 py-1.5 rounded-full border text-sm",
              objects.includes(o) ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700",
            )}
          >
            {o}
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
          disabled={saving || objects.length === 0 || !draft.problem.trim()}
          onClick={async () => {
            setSaving(true)
            try {
              await onSaveProfile({ [key]: { ...draft, objects } })
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? "Saving…" : "Save design proposal"}
        </Button>
      )}
    </div>
  )
}

export function CampOdInvestigationBlock() {
  const experiments = [
    {
      title: "Experiment 1 — Distance Test",
      prompt: "Move objects very close, at medium distance, and far away. Record results.",
    },
    {
      title: "Experiment 2 — Lighting Test",
      prompt: "Try a bright room, dim room, and side lighting. Observe performance.",
    },
    {
      title: "Experiment 3 — Multiple Objects",
      prompt: "Place a bottle, phone, and laptop together. Can the system detect all of them?",
    },
    {
      title: "Experiment 4 — Partial Visibility",
      prompt: "Cover part of an object. Can the AI still recognize it?",
    },
  ]
  const [active, setActive] = useState<number | null>(null)
  const [rows, setRows] = useState<Record<string, { detected: string; score: string; notes: string }>>({})
  const objects = ["Bottle", "Phone", "Laptop", "Person", "Backpack", "Chair"]
  const update = (obj: string, field: string, value: string) =>
    setRows((r) => ({
      ...r,
      [obj]: { detected: r[obj]?.detected ?? "", score: r[obj]?.score ?? "", notes: r[obj]?.notes ?? "", [field]: value },
    }))

  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Object Detection Investigation</p>
      <p className="text-sm text-slate-500">Now let&apos;s think like engineers. Complete each experiment and record your observations.</p>
      {experiments.map((exp, i) => (
        <button
          key={exp.title}
          type="button"
          onClick={() => setActive(active === i ? null : i)}
          className={cn(
            "w-full text-left rounded-lg border px-3 py-2.5",
            active === i ? "border-violet-500 bg-violet-500/10" : "border-slate-200 dark:border-slate-700",
          )}
        >
          <p className="text-sm font-medium">{exp.title}</p>
          {active === i && <p className="text-xs text-violet-600 mt-1">{exp.prompt}</p>}
        </button>
      ))}
      <div className="overflow-x-auto">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">Observation Table</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 pr-2">Object</th>
              <th className="text-left py-2 px-1">Detected?</th>
              <th className="text-left py-2 px-1">Confidence Score</th>
              <th className="text-left py-2 pl-1">Notes</th>
            </tr>
          </thead>
          <tbody>
            {objects.map((obj) => (
              <tr key={obj} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-2 font-medium">{obj}</td>
                <td className="py-2 px-1">
                  <select
                    className="text-xs rounded border border-slate-200 dark:border-slate-700 bg-transparent px-1 py-0.5"
                    value={rows[obj]?.detected ?? ""}
                    onChange={(e) => update(obj, "detected", e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </td>
                <td className="py-2 px-1">
                  <input
                    type="text"
                    placeholder="%"
                    className="w-14 text-xs rounded border border-slate-200 dark:border-slate-700 bg-transparent px-1 py-0.5"
                    value={rows[obj]?.score ?? ""}
                    onChange={(e) => update(obj, "score", e.target.value)}
                  />
                </td>
                <td className="py-2 pl-1">
                  <input
                    type="text"
                    placeholder="Notes"
                    className="w-full min-w-[80px] text-xs rounded border border-slate-200 dark:border-slate-700 bg-transparent px-1 py-0.5"
                    value={rows[obj]?.notes ?? ""}
                    onChange={(e) => update(obj, "notes", e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
        Engineering Insight: AI performance depends heavily on lighting, distance, image quality, and object visibility.
      </p>
    </div>
  )
}

export function CampOdDesignChallengeBlock({
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
  const key = String(content.profileKey ?? "odFinalProjectConcept")
  const saved = (camperProfile?.[key] ?? {}) as Record<string, string>
  const problemOptions = (content.problemOptions as string[]) ?? [
    "Smart Security Camera",
    "Smart Recycling Assistant",
    "Smart Parking System",
    "Wildlife Monitoring Camera",
    "Smart Agriculture Monitor",
    "Campus Safety System",
  ]
  const [selectedProblem, setSelectedProblem] = useState(String(saved.selectedProblem ?? ""))
  const [draft, setDraft] = useState({
    problem: String(saved.problem ?? ""),
    objectsToDetect: String(saved.objectsToDetect ?? ""),
    actionTaken: String(saved.actionTaken ?? ""),
    whoBenefits: String(saved.whoBenefits ?? ""),
  })
  const [saving, setSaving] = useState(false)
  const fields = [
    { key: "problem" as const, label: "Problem", placeholder: "What problem are you solving?" },
    { key: "objectsToDetect" as const, label: "Objects To Detect", placeholder: "Person, bottle, vehicle…" },
    { key: "actionTaken" as const, label: "Action Taken", placeholder: "Alert, log, open gate…" },
    { key: "whoBenefits" as const, label: "Who Benefits", placeholder: "Students, staff, community…" },
  ]

  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Edge AI Design Challenge</p>
      <p className="text-sm text-slate-500">Imagine you are designing your own Edge AI system. Choose a problem:</p>
      <div className="flex flex-wrap gap-2">
        {problemOptions.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={readOnly}
            onClick={() => {
              setSelectedProblem(opt)
              setDraft((d) => ({ ...d, problem: d.problem || opt }))
            }}
            className={cn(
              "px-3 py-1.5 rounded-full border text-xs",
              selectedProblem === opt ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700",
            )}
          >
            {opt}
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
      <p className="text-xs text-violet-600">Save your design idea — this may become your final project.</p>
      {!readOnly && onSaveProfile && (
        <Button
          size="sm"
          disabled={saving || !draft.problem.trim()}
          onClick={async () => {
            setSaving(true)
            try {
              await onSaveProfile({ [key]: { ...draft, selectedProblem } })
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? "Saving…" : "Save design idea"}
        </Button>
      )}
    </div>
  )
}

export function CampMissionAccomplishedBlock() {
  return (
    <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 p-5 sm:p-6 text-center space-y-4">
      <Trophy className="h-12 w-12 text-amber-500 mx-auto" />
      <p className="font-bold text-xl text-emerald-900 dark:text-emerald-100">Mission Accomplished</p>
      <p className="text-sm text-slate-700 dark:text-slate-300">
        You have successfully deployed your first Edge AI application.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {["+350 XP", "Edge AI Explorer Badge", "First Edge AI Deployment Certificate"].map((r) => (
          <Badge key={r} variant="outline" className="border-emerald-500/40">
            {r}
          </Badge>
        ))}
      </div>
      <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 text-left text-sm text-violet-800 dark:text-violet-200">
        <p className="font-medium mb-1">Unlocked — Final Projects</p>
        <ul className="space-y-0.5 text-xs">
          <li>✓ Smart Object Detection Camera</li>
          <li>✓ Smart Campus Safety Assistant</li>
          <li>✓ Smart Recycling Assistant</li>
        </ul>
      </div>
    </div>
  )
}
