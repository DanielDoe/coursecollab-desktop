"use client"

import { useEffect, useState } from "react"
import {
  ChevronDown,
  CheckCircle2,
  Eye,
  Sparkles,
  Trophy,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CampScaledImage } from "@/components/summer-camp/CampScaledImage"
import { readGallerySamples } from "@/lib/summer-camp/interactive-media-items"
import { cn } from "@/lib/utils"

export function CampFaceEyeMissionBlock() {
  const completed = [
    "Learned Artificial Intelligence",
    "Learned Computer Vision",
    "Learned Edge Computing",
    "Built Your Raspberry Pi",
    "Installed Raspberry Pi OS",
    "Installed OpenCV",
    "Verified Your Camera",
    "Created a Computer Vision Environment",
  ]
  const objectives = [
    "Understand Face Detection",
    "Understand Eye Detection",
    "Run Face & Eye Detection Demo",
    "Observe Live Results",
    "Investigate Detection Performance",
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
      <div>
        <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">
          Mission Briefing
        </p>
        <p className="font-bold text-lg text-slate-900 dark:text-white mt-1">Your Computer Vision System Is Ready</p>
        <ul className="mt-3 space-y-1">
          {completed.map((c) => (
            <li key={c} className="text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {c}
            </li>
          ))}
        </ul>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-3">
          Today your Raspberry Pi will begin recognizing faces and eyes in real time. This is the first moment where
          your Raspberry Pi is actually &quot;seeing&quot; the world through a camera.
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
          <p className="text-sm font-bold text-amber-800 dark:text-amber-200">+350 XP · 🏆 Edge Vision Explorer Badge</p>
        </div>
        <Trophy className="h-8 w-8 text-amber-500" />
      </div>
    </div>
  )
}

function CampWorkflowBlock({ title, steps }: { title: string; steps: string[] }) {
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % steps.length), 1400)
    return () => clearInterval(t)
  }, [steps.length])

  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={cn(
                "px-2.5 py-1.5 rounded-lg border text-xs transition-all",
                active === i
                  ? "border-violet-500 bg-violet-500/15 font-medium"
                  : "border-slate-200 dark:border-slate-700 text-slate-500",
              )}
            >
              {s}
            </span>
            {i < steps.length - 1 && <ChevronDown className="h-3 w-3 rotate-[-90deg] text-violet-400" />}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CampFaceDetectionWorkflowBlock() {
  return (
    <CampWorkflowBlock
      title="Face Detection Workflow"
      steps={["Camera", "Image Frame", "Face Detection", "Face Located", "Bounding Box Drawn"]}
    />
  )
}

export function CampEyeDetectionWorkflowBlock() {
  return (
    <div className="space-y-2">
      <CampWorkflowBlock
        title="Eye Detection Workflow"
        steps={["Face Region", "Eye Search", "Eye Located", "Eye Bounding Box"]}
      />
      <p className="text-sm text-slate-600 dark:text-slate-400 px-1">
        After a face is found, the system searches inside the face region for eyes. This improves detection accuracy
        and demonstrates hierarchical Computer Vision processing.
      </p>
    </div>
  )
}

export function CampFaceEyeEngineerPollBlock() {
  const [choice, setChoice] = useState<number | null>(null)
  const options = ["Yes", "No"]
  const correct = 1

  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Eye className="h-5 w-5 text-violet-500" />
        <p className="font-semibold text-slate-900 dark:text-white">Think Like An Engineer</p>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">Can computers naturally recognize faces?</p>
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
          Correct — computers must first learn visual patterns before recognizing faces.
        </p>
      )}
      {choice != null && choice !== correct && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Not quite — face recognition requires trained models, not natural human-like perception.
        </p>
      )}
    </div>
  )
}

export function CampFaceEyePipelineBlock({ content }: { content?: Record<string, unknown> }) {
  const steps = [
    "Camera",
    "Video Frame",
    "Face Detection",
    "Eye Detection",
    "Bounding Boxes",
    "Display Results",
  ]
  const imageUrl = String(content?.imageUrl ?? "").trim() || undefined
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setFrame((f) => (f + 1) % steps.length), 1200)
    return () => clearInterval(t)
  }, [steps.length])

  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Detection Pipeline</p>
      {imageUrl ? (
        <CampScaledImage
          src={imageUrl}
          alt="Face and eye detection pipeline"
          placeholder="Pipeline diagram"
          aspectClass="aspect-video"
          imgClassName="object-contain p-2 bg-white dark:bg-slate-900"
        />
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={cn(
                "px-2 py-1.5 rounded-lg border text-xs",
                frame === i ? "border-violet-500 bg-violet-500/15 font-medium" : "border-slate-200 dark:border-slate-700 text-slate-500",
              )}
            >
              {s}
            </span>
            {i < steps.length - 1 && <ChevronDown className="h-3 w-3 rotate-[-90deg] text-violet-400" />}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CampFaceEyeBoundingLegendBlock() {
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Bounding Boxes</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-lg border-2 border-emerald-500/60 bg-emerald-500/5 p-4 text-center">
          <div className="mx-auto h-16 w-24 border-2 border-emerald-500 rounded-sm mb-2" />
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Green Rectangle → Face</p>
        </div>
        <div className="rounded-lg border-2 border-blue-500/60 bg-blue-500/5 p-4 text-center">
          <div className="mx-auto flex gap-2 justify-center mb-2">
            <div className="h-4 w-6 border-2 border-blue-500 rounded-sm" />
            <div className="h-4 w-6 border-2 border-blue-500 rounded-sm" />
          </div>
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Blue Rectangle → Eyes</p>
        </div>
      </div>
    </div>
  )
}

export function CampFaceEyeSampleGalleryBlock({ content }: { content?: Record<string, unknown> }) {
  const samples = readGallerySamples("face_eye_sample_gallery", content ?? {}).filter((sample) =>
    Boolean(sample.imageUrl?.trim()),
  )

  if (samples.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic">
        Sample detection results will appear here once your instructor adds them.
      </p>
    )
  }

  return (
    <div
      className={cn(
        "grid gap-4",
        samples.length === 1 ? "max-w-xl" : "sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {samples.map((sample) => (
        <figure
          key={sample.title}
          className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card overflow-hidden"
        >
          <CampScaledImage
            src={sample.imageUrl}
            alt={sample.title}
            placeholder={sample.title}
            aspectClass="aspect-video"
            imgClassName="object-contain bg-slate-950"
          />
          <figcaption className="p-3 space-y-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{sample.title}</p>
            {sample.caption ? <p className="text-xs text-slate-500">{sample.caption}</p> : null}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

export function CampFaceEyeRunSuccessBlock() {
  const indicators = [
    "Camera Window Opens",
    "Live Video Feed",
    "Face Detection",
    "Eye Detection",
    "Bounding Boxes",
    "Real-Time Updates",
  ]
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Success Indicators</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">You should see:</p>
      <ul className="grid sm:grid-cols-2 gap-2">
        {indicators.map((item) => (
          <li key={item} className="text-sm flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            {item}
          </li>
        ))}
      </ul>
      <Button size="sm" variant="outline" onClick={() => setConfirmed(true)}>
        My demo is running successfully
      </Button>
      {confirmed && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-center space-y-2">
          <Sparkles className="h-8 w-8 text-emerald-500 mx-auto" />
          <p className="font-bold text-emerald-800 dark:text-emerald-200">
            🎉 Congratulations! Your Raspberry Pi is now performing Computer Vision processing in real time.
          </p>
        </div>
      )}
    </div>
  )
}

export function CampFaceEyeInvestigationBlock() {
  const experiments = [
    {
      title: "Experiment 1 — Distance Test",
      conditions: ["Close Distance", "Medium Distance", "Far Distance"],
    },
    {
      title: "Experiment 2 — Lighting Test",
      conditions: ["Bright Room", "Dim Room", "Side Lighting"],
    },
    {
      title: "Experiment 3 — Multiple People",
      conditions: ["Two People", "Three or More People"],
    },
    {
      title: "Experiment 4 — Glasses Test",
      conditions: ["No Glasses", "Glasses", "Hat"],
    },
  ]
  const [active, setActive] = useState(0)
  const [rows, setRows] = useState<Record<string, { success: string; notes: string }>>({})

  const update = (key: string, field: "success" | "notes", value: string) =>
    setRows((prev) => ({
      ...prev,
      [key]: { success: prev[key]?.success ?? "", notes: prev[key]?.notes ?? "", [field]: value },
    }))

  const exp = experiments[active]

  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Face Detection Investigation</p>
      <p className="text-sm text-slate-500">Now think like an engineer. Complete each experiment and record results.</p>
      <div className="flex flex-wrap gap-2">
        {experiments.map((e, i) => (
          <button
            key={e.title}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "px-3 py-1.5 rounded-full border text-xs",
              active === i ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700",
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <p className="text-sm font-medium">{exp.title}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 pr-2">Condition</th>
              <th className="text-left py-2 px-1">Detection Successful?</th>
              <th className="text-left py-2 pl-1">Notes</th>
            </tr>
          </thead>
          <tbody>
            {exp.conditions.map((condition) => (
              <tr key={condition} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-2 font-medium">{condition}</td>
                <td className="py-2 px-1">
                  <select
                    className="text-xs rounded border border-slate-200 dark:border-slate-700 bg-transparent px-1 py-0.5"
                    value={rows[`${active}-${condition}`]?.success ?? ""}
                    onChange={(e) => update(`${active}-${condition}`, "success", e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="Yes">Yes</option>
                    <option value="Partially">Partially</option>
                    <option value="No">No</option>
                  </select>
                </td>
                <td className="py-2 pl-1">
                  <input
                    type="text"
                    placeholder="Notes"
                    className="w-full text-xs rounded border border-slate-200 dark:border-slate-700 bg-transparent px-1 py-0.5"
                    value={rows[`${active}-${condition}`]?.notes ?? ""}
                    onChange={(e) => update(`${active}-${condition}`, "notes", e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
        Engineering Insight: Computer Vision performance depends on lighting, distance, visibility, camera quality, and
        image resolution.
      </p>
    </div>
  )
}

export function CampFaceEyeTroubleshootingBlock() {
  const issues = [
    {
      title: "Camera Not Found",
      causes: ["Camera disconnected", "Ribbon cable reversed", "Camera failed Module 8 verification"],
    },
    {
      title: "OpenCV Import Error",
      causes: ["Virtual environment not activated", "OpenCV not installed"],
    },
    {
      title: "Program Opens Then Closes",
      causes: ["Missing Haar Cascade files", "Incorrect file location", "Typing errors in code"],
    },
  ]
  const [active, setActive] = useState(0)
  const issue = issues[active]

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <p className="font-semibold text-slate-900 dark:text-white">Troubleshooting</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {issues.map((item, i) => (
          <button
            key={item.title}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "px-3 py-1.5 rounded-full border text-xs",
              active === i ? "border-amber-500 bg-amber-500/15" : "border-slate-200 dark:border-slate-700",
            )}
          >
            {item.title}
          </button>
        ))}
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Possible Causes:</p>
        <ul className="space-y-1">
          {issue.causes.map((cause) => (
            <li key={cause} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">•</span>
              {cause}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function CampFaceEyeMissionAccomplishedBlock() {
  const progress = [
    "Raspberry Pi Setup Complete",
    "OpenCV Installed",
    "Camera Verified",
    "Face Detection Working",
    "Eye Detection Working",
  ]

  return (
    <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 p-5 sm:p-6 text-center space-y-4">
      <Trophy className="h-12 w-12 text-amber-500 mx-auto" />
      <p className="font-bold text-xl text-emerald-900 dark:text-emerald-100">Mission Accomplished</p>
      <p className="text-sm text-slate-700 dark:text-slate-300">
        🎉 Congratulations Engineer! You successfully deployed your first Computer Vision application.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {["+350 XP", "🏆 Edge Vision Explorer Badge", "📜 First Computer Vision Deployment Certificate"].map((r) => (
          <Badge key={r} variant="outline" className="border-emerald-500/40">
            {r}
          </Badge>
        ))}
      </div>
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-left">
        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-2">Current Progress</p>
        <ul className="space-y-1">
          {progress.map((item) => (
            <li key={item} className="text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 text-left text-sm text-violet-800 dark:text-violet-200">
        <p className="font-medium mb-1">Unlocked — Final Projects</p>
        <ul className="space-y-0.5 text-xs">
          <li>✓ Smart Object Detection Camera</li>
          <li>✓ Smart Campus Safety Assistant</li>
          <li>✓ Smart Recycling Assistant</li>
        </ul>
        <p className="text-xs mt-2">You are now ready to build complete Edge AI systems.</p>
      </div>
    </div>
  )
}
