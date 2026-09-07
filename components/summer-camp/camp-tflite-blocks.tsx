"use client"

import { useEffect, useState } from "react"
import {
  Brain,
  ChevronDown,
  FolderTree,
  GitBranch,
  Package,
  Terminal,
  Trophy,
  CheckCircle2,
  Wifi,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function CampTfliteMissionBlock() {
  const completed = ["Hardware Installed", "Raspberry Pi OS Installed", "Camera Verified"]
  const objectives = [
    "Update system",
    "Install dependencies",
    "Install TensorFlow Lite",
    "Verify installation",
    "Download AI resources",
    "Run first AI test",
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
        <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Mission Briefing</p>
        <p className="font-bold text-lg text-slate-900 dark:text-white mt-1">Your Raspberry Pi Is About To Become Intelligent</p>
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">So far:</p>
        <ul className="space-y-1">
          {completed.map((c) => (
            <li key={c} className="text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />{c}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Today we install the software that allows our Raspberry Pi to run Artificial Intelligence.
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
        <p className="text-sm font-bold text-amber-800 dark:text-amber-200">300 XP · AI Environment Builder Badge</p>
        <Trophy className="h-7 w-7 text-amber-500" />
      </div>
    </div>
  )
}

export function CampGiantModelPollBlock() {
  const [choice, setChoice] = useState<string | null>(null)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">
        Our Raspberry Pi is much smaller than a cloud server. Can we run giant AI models directly?
      </p>
      <div className="flex gap-3">
        {[
          { id: "yes", label: "Yes" },
          { id: "no", label: "Not Efficiently", correct: true },
        ].map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setChoice(o.id)}
            className={cn(
              "flex-1 rounded-lg border px-4 py-3 text-sm font-medium",
              choice === o.id
                ? o.correct ? "border-emerald-500 bg-emerald-500/10" : "border-amber-500 bg-amber-500/10"
                : "border-slate-200 dark:border-slate-700",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {choice === "no" && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Correct — that is why <strong>TensorFlow Lite</strong> exists for edge devices.
        </p>
      )}
      {choice === "yes" && (
        <p className="text-sm text-amber-600">Giant models need data-center GPUs. Edge devices need lightweight frameworks.</p>
      )}
    </div>
  )
}

export function CampTfliteWhyBlock() {
  const targets = ["Raspberry Pi", "Smartphones", "Embedded Devices", "Edge Devices"]
  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Why TensorFlow Lite Exists</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        A lightweight AI framework designed for devices with limited power and memory.
      </p>
      <div className="flex flex-wrap gap-2">
        {targets.map((t) => (
          <Badge key={t} variant="outline" className="border-violet-500/40">{t}</Badge>
        ))}
      </div>
      <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">
        TensorFlow Lite allows AI models to run efficiently on small devices.
      </p>
    </div>
  )
}

export function CampTrainingVsInferenceBlock() {
  const [mode, setMode] = useState<"training" | "inference">("training")
  useEffect(() => {
    const t = setInterval(() => setMode((m) => (m === "training" ? "inference" : "training")), 3000)
    return () => clearInterval(t)
  }, [])
  const flows = {
    training: ["Millions of Images", "Model Learns", "Saved Model"],
    inference: ["New Image", "Model", "Prediction"],
  }
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Training vs Inference</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className={cn("rounded-lg border p-3", mode === "training" ? "border-sky-500 bg-sky-500/10" : "border-slate-200 dark:border-slate-700 opacity-70")}>
          <p className="font-semibold text-sm">Training</p>
          <p className="text-xs text-slate-500 mt-1">Learning patterns from data — usually on powerful computers.</p>
        </div>
        <div className={cn("rounded-lg border p-3", mode === "inference" ? "border-emerald-500 bg-emerald-500/10" : "border-slate-200 dark:border-slate-700 opacity-70")}>
          <p className="font-semibold text-sm">Inference</p>
          <p className="text-xs text-slate-500 mt-1">Using a trained model to make predictions — what our Pi does.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {flows[mode].map((s, i, arr) => (
          <div key={s} className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg border border-violet-500/30 text-sm font-medium">{s}</span>
            {i < arr.length - 1 && <ChevronDown className="h-3 w-3 rotate-[-90deg] text-violet-400" />}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CampInferencePollBlock() {
  const [choice, setChoice] = useState<string | null>(null)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Our Raspberry Pi performs:</p>
      <div className="flex gap-3">
        {[
          { id: "training", label: "Training" },
          { id: "inference", label: "Inference", correct: true },
        ].map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setChoice(o.id)}
            className={cn(
              "flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium",
              choice === o.id
                ? o.correct ? "border-emerald-500 bg-emerald-500/10" : "border-amber-500 bg-amber-500/10"
                : "border-slate-200 dark:border-slate-700",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {choice === "inference" && (
        <p className="text-sm text-emerald-600">Correct — the Pi runs inference using pre-trained models, not training.</p>
      )}
      {choice === "training" && (
        <p className="text-sm text-amber-600">Training needs massive datasets and GPUs. The Pi uses already-trained models.</p>
      )}
    </div>
  )
}

export function CampCommandLessonBlock({
  content,
}: {
  content: Record<string, unknown>
}) {
  const command = String(content.command ?? "sudo apt-get update")
  const predictQuestion = String(content.predictQuestion ?? "What does this command do?")
  const reveal = String(content.reveal ?? "It updates the package index.")
  const steps = (content.steps as string[]) ?? ["Open Terminal", `Run: ${command}`]
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      {steps.map((s, i) => (
        <p key={s} className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <span className="size-6 rounded-full bg-violet-500/20 text-violet-700 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
          {s}
        </p>
      ))}
      <div className="rounded-lg bg-slate-950 p-3 flex items-center gap-2">
        <Terminal className="h-4 w-4 text-emerald-400 shrink-0" />
        <code className="text-sm font-mono text-emerald-300">{command}</code>
      </div>
      <p className="text-sm font-medium">{predictQuestion}</p>
      <Button size="sm" variant="outline" onClick={() => setRevealed(true)}>
        {revealed ? "Answer" : "Reveal answer"}
      </Button>
      {revealed && <p className="text-sm text-emerald-700 dark:text-emerald-300">{reveal}</p>}
    </div>
  )
}

export function CampGitQuizBlock() {
  const [choice, setChoice] = useState<number | null>(null)
  const options = [
    "Downloading and managing code",
    "Playing videos",
    "Connecting cameras",
    "Updating WiFi",
  ]
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <GitBranch className="h-5 w-5 text-violet-500" />
        <p className="font-semibold text-slate-900 dark:text-white">What is Git used for?</p>
      </div>
      <code className="block text-xs font-mono bg-slate-950 text-emerald-300 p-2 rounded mb-2">
        git clone https://github.com/tensorflow/examples --depth 1
      </code>
      {options.map((opt, i) => (
        <button
          key={opt}
          type="button"
          onClick={() => setChoice(i)}
          className={cn(
            "w-full text-left rounded-lg border px-3 py-2.5 text-sm",
            choice === i
              ? i === 0 ? "border-emerald-500 bg-emerald-500/10" : "border-amber-500 bg-amber-500/10"
              : "border-slate-200 dark:border-slate-700",
          )}
        >
          {String.fromCharCode(65 + i)}. {opt}
        </button>
      ))}
      {choice === 0 && (
        <p className="text-sm text-emerald-600">Correct — Git downloads and manages code repositories.</p>
      )}
      {choice != null && choice !== 0 && (
        <p className="text-sm text-amber-600">Git is a version control tool for downloading and managing source code.</p>
      )}
    </div>
  )
}

export function CampFolderPathBlock() {
  const path = ["Home (~)", "examples", "lite", "examples", "object_detection", "raspberry_pi"]
  const [active, setActive] = useState(0)
  const fullPath = "~/examples/lite/examples/object_detection/raspberry_pi"
  const [selected, setSelected] = useState<string | null>(null)
  const options = [
    "~/examples/object_detection",
    "~/examples/lite/examples/object_detection/raspberry_pi",
    "~/raspberry_pi/object_detection",
    "~/lite/object_detection",
  ]
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <FolderTree className="h-4 w-4 text-violet-500" /> Navigate to Object Detection Project
      </p>
      <code className="block text-xs font-mono bg-slate-950 text-emerald-300 p-2 rounded">
        cd ~/examples/lite/examples/object_detection/raspberry_pi
      </code>
      <div className="space-y-1 pl-2 border-l-2 border-violet-500/30">
        {path.map((p, i) => (
          <button
            key={p}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "block text-sm py-1 pl-2",
              active === i ? "text-violet-700 dark:text-violet-300 font-medium" : "text-slate-500",
            )}
          >
            {p}
          </button>
        ))}
      </div>
      <p className="text-sm font-medium">Identify the correct path:</p>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => setSelected(opt)}
          className={cn(
            "w-full text-left rounded-lg border px-3 py-2 text-xs font-mono",
            selected === opt
              ? opt === fullPath ? "border-emerald-500 bg-emerald-500/10" : "border-amber-500 bg-amber-500/10"
              : "border-slate-200 dark:border-slate-700",
          )}
        >
          {opt}
        </button>
      ))}
      {selected === fullPath && (
        <p className="text-sm text-emerald-600">Correct path! You are ready to run setup.sh.</p>
      )}
    </div>
  )
}

export function CampSetupScriptBlock() {
  const steps = ["Setup Script (setup.sh)", "Downloads Packages", "Configures Environment", "Ready for AI"]
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % steps.length), 1500)
    return () => clearInterval(t)
  }, [steps.length])
  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 sm:p-5 space-y-4">
      <code className="block text-sm font-mono bg-slate-950 text-emerald-300 p-2 rounded">sh setup.sh</code>
      <p className="text-sm text-slate-600 dark:text-slate-400">Downloads TensorFlow Lite Runtime, Python packages, and AI support libraries.</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={cn(
              "px-3 py-1.5 rounded-lg border text-xs",
              active === i ? "border-violet-500 bg-violet-500/15 font-medium" : "border-slate-200 dark:border-slate-700 text-slate-500",
            )}>{s}</span>
            {i < steps.length - 1 && <ChevronDown className="h-3 w-3 rotate-[-90deg] text-violet-400" />}
          </div>
        ))}
      </div>
      <p className="text-xs text-center text-amber-600 dark:text-amber-400">
        Estimated time: 10–20 minutes depending on internet speed
      </p>
    </div>
  )
}

export function CampLibAtlasBlock() {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <code className="block text-sm font-mono bg-slate-950 text-emerald-300 p-2 rounded">
        sudo apt-get install libatlas-base-dev
      </code>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Provides optimized mathematical operations. AI models perform thousands of calculations.
      </p>
      <p className="text-xs font-medium text-violet-600 dark:text-violet-400">
        Engineering Insight: AI is fundamentally mathematics running at scale.
      </p>
      <Button size="sm" variant="outline" onClick={() => setRevealed(true)}>
        Why might faster math improve AI performance?
      </Button>
      {revealed && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Faster matrix math means quicker inference — more frames per second and lower latency on the Pi.
        </p>
      )}
    </div>
  )
}

export function CampAiModelVisualizerBlock() {
  const [active, setActive] = useState(false)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">What Is a Model?</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        A <strong>model</strong> is a trained AI system containing learned knowledge.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-center">
          <p className="text-xs text-slate-500 mb-2">Input</p>
          <Brain className="h-8 w-8 text-violet-500 mx-auto" />
          <p className="text-sm font-medium mt-2">Image</p>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
          <p className="text-xs text-slate-500 mb-2">Output</p>
          <div className="flex flex-wrap justify-center gap-1 mt-2">
            {["Person", "Car", "Dog"].map((l) => (
              <Badge key={l} variant="outline" className="text-[10px]">{l}</Badge>
            ))}
          </div>
        </div>
      </div>
      <Button size="sm" onClick={() => setActive(true)}>Run Object Detection (preview)</Button>
      {active && (
        <div className="grid sm:grid-cols-2 gap-2">
          <div className="h-24 rounded bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-400">Before — Original</div>
          <div className="h-24 rounded bg-slate-800 flex items-center justify-center text-xs text-emerald-400 border-2 border-emerald-500">After — Bounding Boxes</div>
        </div>
      )}
      <p className="text-xs text-violet-600">Soon we will run a pre-trained object detection model on your Pi.</p>
    </div>
  )
}

export function CampVerifyInstallBlock() {
  const criteria = [
    "No installation errors",
    "Required packages installed",
    "Environment configured",
  ]
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const toggle = (c: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Verify Installation</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">How do we know TensorFlow Lite works? We test it.</p>
      <div className="h-20 rounded-lg bg-slate-800 flex items-center justify-center text-xs text-slate-400">
        [Verification command screenshot placeholder]
      </div>
      {criteria.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => toggle(c)}
          className={cn(
            "w-full text-left rounded-lg border px-3 py-2 text-sm flex items-center gap-2",
            checked.has(c) ? "border-emerald-500 bg-emerald-500/10" : "border-slate-200 dark:border-slate-700",
          )}
        >
          <span className={checked.has(c) ? "text-emerald-600" : "text-slate-400"}>{checked.has(c) ? "✓" : "○"}</span>
          {c}
        </button>
      ))}
      {checked.size === criteria.length && (
        <p className="text-sm text-emerald-600 font-medium">All success criteria met — upload your screenshot!</p>
      )}
    </div>
  )
}

export function CampFirstAiDemoBlock() {
  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 sm:p-6 space-y-4 text-center">
      <p className="font-semibold text-slate-900 dark:text-white">First AI Prediction Demonstration</p>
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        {["Image", "TensorFlow Lite Model", "Detected Objects"].map((s, i, arr) => (
          <div key={s} className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg border border-violet-500/30">{s}</span>
            {i < arr.length - 1 && <ChevronDown className="h-3 w-3 rotate-[-90deg] text-violet-400" />}
          </div>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-slate-500 mb-2">Before</p>
          <div className="h-28 rounded bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-400">Original Image</div>
        </div>
        <div className="rounded-lg border border-emerald-500/30 p-3">
          <p className="text-xs text-emerald-600 mb-2">After</p>
          <div className="h-28 rounded bg-slate-800 flex items-center justify-center text-xs text-emerald-400">Object Detection Results</div>
        </div>
      </div>
      <p className="text-sm font-medium text-violet-700 dark:text-violet-300">
        This is exactly what your Raspberry Pi will soon perform in real time.
      </p>
    </div>
  )
}

export function CampTfliteTroubleshootingBlock() {
  const pairs = [
    { problem: "Internet Connection Issues", solution: "Verify WiFi", icon: Wifi },
    { problem: "Missing Dependencies", solution: "Re-run installation commands", icon: Package },
    { problem: "Repository Download Failed", solution: "Verify Git installation", icon: GitBranch },
    { problem: "Permission Errors", solution: "Check syntax · Use sudo when required", icon: AlertTriangle },
  ]
  const [active, setActive] = useState<number | null>(null)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-2">
      <p className="font-semibold text-slate-900 dark:text-white">Common Installation Problems</p>
      <p className="text-sm text-slate-500 mb-3">Tap each problem to reveal the solution.</p>
      {pairs.map((p, i) => {
        const Icon = p.icon
        return (
          <button
            key={p.problem}
            type="button"
            onClick={() => setActive(active === i ? null : i)}
            className={cn(
              "w-full text-left rounded-lg border px-3 py-2.5 flex items-start gap-3",
              active === i ? "border-violet-500 bg-violet-500/10" : "border-slate-200 dark:border-slate-700",
            )}
          >
            <Icon className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">{p.problem}</p>
              {active === i && (
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                  <strong>Solution:</strong> {p.solution}
                </p>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function CampAiEnvironmentStatusBlock() {
  const built = [
    { label: "Camera", done: true },
    { label: "Raspberry Pi", done: true },
    { label: "Operating System", done: true },
    { label: "TensorFlow Lite", done: true },
    { label: "AI Environment", done: true },
  ]
  return (
    <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 p-4 sm:p-6 space-y-4">
      <p className="font-bold text-lg text-emerald-900 dark:text-emerald-100 text-center">What Have We Built?</p>
      <div className="flex flex-wrap justify-center gap-2">
        {built.map((b) => (
          <Badge key={b.label} className="bg-emerald-600 text-white px-3 py-1">
            ✓ {b.label}
          </Badge>
        ))}
      </div>
      <p className="text-sm text-center text-slate-700 dark:text-slate-300">
        Your Raspberry Pi is now capable of running <strong>AI inference</strong>.
      </p>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-center">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">What Is Missing?</p>
        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">Real-Time Object Detection — that is our next mission.</p>
      </div>
    </div>
  )
}
