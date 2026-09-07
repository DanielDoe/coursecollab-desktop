"use client"

import Link from "next/link"
import { useState } from "react"
import {
  Award,
  Camera,
  ChevronDown,
  Cpu,
  FileText,
  GraduationCap,
  Monitor,
  PartyPopper,
  Trophy,
  Video,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CampZoomableImage } from "@/components/summer-camp/CampZoomableImage"
import { cn } from "@/lib/utils"
import { campRoute } from "@/lib/summer-camp/camper-nav"
import { CampLearningJourneyTimeline } from "@/components/summer-camp/CampLearningJourneyTimeline"

const SHOWCASE_JOURNEY_STEPS = [
  "Artificial Intelligence",
  "Machine Learning",
  "Deep Learning",
  "Computer Vision",
  "Internet of Things",
  "Edge Computing",
  "Edge AI",
  "Raspberry Pi",
  "OpenCV",
  "Face & Eye Detection",
]

export function CampShowcaseJourneyBlock() {
  return (
    <CampLearningJourneyTimeline
      title="Your Learning Journey"
      steps={SHOWCASE_JOURNEY_STEPS}
      activeThrough={SHOWCASE_JOURNEY_STEPS.length - 1}
      subtitle="Every step you completed led to your Edge AI showcase."
    />
  )
}

export function CampShowcaseObjectivesBlock() {
  const objectives = [
    "Configure hardware and verify the camera",
    "Run face & eye detection with OpenCV",
    "Demonstrate successful live detections",
    "Explain your Edge AI pipeline",
    "Optional: extend with a capstone project",
    "Reflect on your learning journey",
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
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Showcase Objectives</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Demonstrate your Edge AI Computer Vision system on Raspberry Pi — including face & eye detection from Module 10.
        Optionally showcase a capstone project (Smart Object Detection Camera, Smart Campus Safety Assistant, or Smart
        Recycling Assistant).
      </p>
      {objectives.map((obj, i) => (
        <button
          key={obj}
          type="button"
          onClick={() => toggle(i)}
          className={cn(
            "w-full text-left rounded-lg border px-3 py-2.5 text-sm flex items-center gap-3",
            checked.has(i) ? "border-emerald-500 bg-emerald-500/10" : "border-slate-200 dark:border-slate-700",
          )}
        >
          <CheckCircle2 className={cn("h-4 w-4 shrink-0", checked.has(i) ? "text-emerald-500" : "text-slate-300")} />
          {obj}
        </button>
      ))}
    </div>
  )
}

export function CampVideoDemoGuideBlock() {
  const sections = [
    {
      title: "Introduction",
      icon: GraduationCap,
      items: ["Introduce yourself", "Your name, school, and grade level"],
    },
    {
      title: "Hardware Overview",
      icon: Cpu,
      items: ["Show Raspberry Pi, camera, monitor, keyboard/mouse", 'Explain: "What hardware is being used?"'],
    },
    {
      title: "Live Demonstration",
      icon: Camera,
      items: [
        "Show face & eye detection working live (Module 10 demo)",
        "Optional: demonstrate your capstone project (object detection, campus safety, or recycling)",
        "Show bounding boxes updating in real time",
      ],
    },
    {
      title: "Explain the Pipeline",
      icon: Monitor,
      items: [
        "Camera → Raspberry Pi → OpenCV → Haar Cascade → Face/Eye Detection → Display",
        "Optional capstone path: Camera → Raspberry Pi → TensorFlow Lite → Object Detection → Results",
      ],
    },
    {
      title: "Reflection",
      icon: FileText,
      items: ["What was the most interesting thing you learned?"],
    },
  ]
  const [open, setOpen] = useState(0)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Video className="h-5 w-5 text-violet-500" />
        <p className="font-semibold text-slate-900 dark:text-white">Video Demonstration Guide (Required)</p>
      </div>
      <p className="text-sm text-slate-500">Record a 3–5 minute MP4 video covering all sections below.</p>
      {sections.map((s, i) => {
        const Icon = s.icon
        return (
          <button
            key={s.title}
            type="button"
            onClick={() => setOpen(open === i ? -1 : i)}
            className={cn(
              "w-full text-left rounded-lg border p-3",
              open === i ? "border-violet-500 bg-violet-500/10" : "border-slate-200 dark:border-slate-700",
            )}
          >
            <p className="text-sm font-medium flex items-center gap-2">
              <Icon className="h-4 w-4 text-violet-500" />
              {s.title}
            </p>
            {open === i && (
              <ul className="mt-2 space-y-1">
                {s.items.map((item) => (
                  <li key={item} className="text-xs text-slate-600 dark:text-slate-400">• {item}</li>
                ))}
              </ul>
            )}
          </button>
        )
      })}
      <Badge variant="outline" className="text-xs">Format: MP4 · Max 5 minutes</Badge>
    </div>
  )
}

export function CampScreenshotGuideBlock() {
  const shots = [
    { n: 1, title: "Raspberry Pi Desktop", required: true },
    { n: 2, title: "Camera Verification", required: true },
    { n: 3, title: "Face & Eye Detection Running", required: true },
    { n: 4, title: "Multiple Faces or Capstone Demo", required: false, bonus: true },
  ]
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Screenshot Evidence</p>
      <p className="text-sm text-slate-500">Submit PNG or JPG screenshots for each item below.</p>
      {shots.map((s) => (
        <div key={s.n} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 flex items-center justify-between">
          <span className="text-sm">
            <strong>Screenshot {s.n}:</strong> {s.title}
          </span>
          {s.bonus ? (
            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">Bonus</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Required</Badge>
          )}
        </div>
      ))}
    </div>
  )
}

export function CampReflectionReportGuideBlock({
  camperProfile,
  onSaveProfile,
  readOnly,
}: {
  camperProfile?: Record<string, unknown>
  onSaveProfile?: (patch: Record<string, unknown>) => Promise<void>
  readOnly?: boolean
}) {
  const key = "engineeringReflectionReport"
  const saved = (camperProfile?.[key] ?? {}) as Record<string, string>
  const sections = [
    { key: "learned", label: "Section 1 — What did you learn?", placeholder: "AI, Computer Vision, Edge Computing, OpenCV, face detection — how has your understanding changed?" },
    { key: "difficult", label: "Section 2 — What was the most difficult part?", placeholder: "Hardware setup, camera verification, OpenCV environment, face/eye detection — how did you solve it?" },
    { key: "favorite", label: "Section 3 — What was your favorite activity?", placeholder: "Building the Pi, running OpenCV, live face detection, capstone experiments..." },
    { key: "improve", label: "Section 4 — How could this project be improved?", placeholder: "Lighting, camera angle, detection accuracy, capstone extensions..." },
    { key: "future", label: "Section 5 — Future Ideas", placeholder: "Smart security, campus safety, recycling assistant, driver monitoring, robotics..." },
  ]
  const [draft, setDraft] = useState<Record<string, string>>(
    Object.fromEntries(sections.map((s) => [s.key, saved[s.key] ?? ""])),
  )
  const [saving, setSaving] = useState(false)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-semibold text-slate-900 dark:text-white">Engineering Reflection Report</p>
      <p className="text-sm text-slate-500">Draft your 1–2 page report below, then upload the final PDF at the checkpoint.</p>
      {sections.map((s) => (
        <div key={s.key}>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{s.label}</p>
          <Textarea
            value={draft[s.key] ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))}
            placeholder={s.placeholder}
            rows={3}
            disabled={readOnly}
            className="resize-none text-sm"
          />
        </div>
      ))}
      {!readOnly && onSaveProfile && (
        <Button
          size="sm"
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            try {
              await onSaveProfile({ [key]: draft })
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? "Saving…" : "Save report draft"}
        </Button>
      )}
    </div>
  )
}

export function CampShowcaseRubricBlock() {
  const categories = [
    { title: "System Functionality", points: 20, excellent: "Face & eye detection (or capstone demo) runs successfully on the Pi." },
    { title: "Video Demonstration", points: 20, excellent: "Clear explanation and successful live demo." },
    { title: "Technical Understanding", points: 20, excellent: "Student can explain AI, Computer Vision, Edge Computing, and their detection pipeline." },
    { title: "Reflection Report", points: 20, excellent: "Thoughtful and detailed reflection." },
    { title: "Creativity and Engagement", points: 20, excellent: "Student explores capstone extensions, experiments, or additional detections." },
  ]
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <Award className="h-5 w-5 text-amber-500" />
        Showcase Evaluation Rubric — 100 Points Total
      </p>
      {categories.map((c, i) => (
        <button
          key={c.title}
          type="button"
          onClick={() => setOpen(open === i ? null : i)}
          className={cn(
            "w-full text-left rounded-lg border px-3 py-2.5",
            open === i ? "border-amber-500 bg-amber-500/10" : "border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{c.title}</span>
            <Badge variant="outline" className="text-xs">{c.points} pts</Badge>
          </div>
          {open === i && (
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              <strong>Excellent:</strong> {c.excellent}
            </p>
          )}
        </button>
      ))}
    </div>
  )
}

export function CampAchievementSummaryBlock({ content }: { content?: Record<string, unknown> }) {
  const defaultItems = [
    "Completed 12 Learning Modules",
    "Passed Module Knowledge Checks",
    "Completed Engineering Checkpoints",
    "Built Raspberry Pi Edge AI System",
    "Deployed Face & Eye Detection",
    "Submitted Final Showcase",
  ]
  const items = Array.isArray(content?.items) ? (content.items as string[]) : defaultItems
  const title = String(content?.title ?? "Camp Achievement Summary")
  const subtitle = content?.subtitle ? String(content.subtitle) : null

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.08] to-transparent p-4 sm:p-5">
      <p className="font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-emerald-600 shrink-0" />
        {title}
      </p>
      {subtitle ? <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{subtitle}</p> : <div className="mb-3" />}
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item}
            className="text-sm text-emerald-800 dark:text-emerald-200 flex items-start gap-2 rounded-lg border border-emerald-500/15 bg-white/60 dark:bg-white/[0.03] px-3 py-2.5"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CampCertificateRequirementsBlock({ content }: { content?: Record<string, unknown> }) {
  const defaultReqs = [
    "Complete Modules 0–10 (through face & eye detection)",
    "Pass all Knowledge Checks",
    "Complete Required Checkpoints",
    "Submit Video Demonstration",
    "Submit Screenshots",
    "Submit Reflection Report",
    "Complete Final Reflection Survey",
  ]
  const reqs = Array.isArray(content?.requirements) ? (content.requirements as string[]) : defaultReqs
  const title = String(content?.title ?? "Certificate Requirements")
  const description = content?.description ? String(content.description) : null
  const [checked, setChecked] = useState<Set<number>>(new Set())
  return (
    <div className="rounded-xl border border-sky-500/30 bg-gradient-to-br from-sky-500/[0.06] to-transparent p-4 sm:p-5 space-y-3">
      <div>
        <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Award className="h-5 w-5 text-sky-600 shrink-0" />
          {title}
        </p>
        {description ? (
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{description}</p>
        ) : null}
      </div>
      {reqs.map((r, i) => (
        <button
          key={r}
          type="button"
          onClick={() =>
            setChecked((prev) => {
              const next = new Set(prev)
              if (next.has(i)) next.delete(i)
              else next.add(i)
              return next
            })
          }
          className={cn(
            "w-full text-left rounded-lg border px-3 py-2 text-sm flex items-center gap-2",
            checked.has(i) ? "border-emerald-500 bg-emerald-500/10" : "border-slate-200 dark:border-slate-700",
          )}
        >
          <span className={checked.has(i) ? "text-emerald-600" : "text-slate-400"}>{checked.has(i) ? "✓" : "○"}</span>
          {r}
        </button>
      ))}
    </div>
  )
}

export function CampCertificateAwardBlock({ content }: { content?: Record<string, unknown> }) {
  const certificateTitle = String(
    content?.certificateTitle ?? "AI & Edge Computing Summer Camp Certificate",
  )
  const subtitle = content?.subtitle ? String(content.subtitle) : null
  const issuer = String(content?.issuer ?? "Issued by Prairie View A&M University")
  const partnerLine = String(
    content?.partnerLine ?? "Department of Electrical and Computer Engineering · CREDIT Center",
  )
  const partnerLogoUrl = content?.partnerLogoUrl ? String(content.partnerLogoUrl) : null
  const pvamuLogoUrl = content?.pvamuLogoUrl ? String(content.pvamuLogoUrl) : null
  const partnerLogoAlt = String(content?.partnerLogoAlt ?? "Central State University")
  const pvamuLogoAlt = String(content?.pvamuLogoAlt ?? "Prairie View A&M University")

  return (
    <div className="rounded-xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-violet-500/10 p-5 sm:p-6 text-center space-y-3">
      <Trophy className="h-12 w-12 text-amber-500 mx-auto" />
      <p className="font-bold text-lg text-slate-900 dark:text-white">🏆 {certificateTitle}</p>
      {subtitle ? (
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{subtitle}</p>
      ) : null}
      <p className="text-sm text-slate-600 dark:text-slate-400">{issuer}</p>
      {(pvamuLogoUrl || partnerLogoUrl) ? (
        <div className="flex flex-wrap items-center justify-center gap-6 pt-1">
          {pvamuLogoUrl ? (
            <CampZoomableImage
              src={pvamuLogoUrl}
              alt={pvamuLogoAlt}
              className="inline-block"
              imgClassName="h-14 max-w-[200px] object-contain"
            />
          ) : null}
          {partnerLogoUrl ? (
            <CampZoomableImage
              src={partnerLogoUrl}
              alt={partnerLogoAlt}
              className="inline-block"
              imgClassName="h-14 max-w-[200px] object-contain"
            />
          ) : null}
        </div>
      ) : null}
      <p className="text-xs text-slate-500">{partnerLine}</p>
    </div>
  )
}

export function CampFinalSurveyBlock({
  camperProfile,
  onSaveProfile,
  readOnly,
}: {
  camperProfile?: Record<string, unknown>
  onSaveProfile?: (patch: Record<string, unknown>) => Promise<void>
  readOnly?: boolean
}) {
  const key = "finalCampSurvey"
  const saved = (camperProfile?.[key] ?? {}) as Record<string, unknown>
  const [draft, setDraft] = useState({
    aiKnowledgeBefore: String(saved.aiKnowledgeBefore ?? ""),
    confidenceAfter: saved.confidenceAfter != null ? Number(saved.confidenceAfter) : null as number | null,
    learned: String(saved.learned ?? ""),
    difficult: String(saved.difficult ?? ""),
    favorite: String(saved.favorite ?? ""),
    recommend: String(saved.recommend ?? ""),
    recommendWhy: String(saved.recommendWhy ?? ""),
    futureTopics: Array.isArray(saved.futureTopics) ? (saved.futureTopics as string[]) : [] as string[],
    nextTopic: String(saved.nextTopic ?? ""),
  })
  const [saving, setSaving] = useState(false)
  const futureOptions = ["Robotics", "Cybersecurity", "AI", "Drones", "XR/VR", "Programming", "IoT"]
  const toggleTopic = (t: string) =>
    setDraft((d) => ({
      ...d,
      futureTopics: d.futureTopics.includes(t) ? d.futureTopics.filter((x) => x !== t) : [...d.futureTopics, t],
    }))
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-5">
      <p className="font-semibold text-slate-900 dark:text-white">Final Reflection Survey</p>
      <p className="text-sm text-slate-500">Please answer honestly.</p>

      <div>
        <p className="text-sm font-medium mb-2">Before this camp, how much did you know about AI?</p>
        <div className="flex flex-wrap gap-2">
          {["Nothing", "A Little", "Some Knowledge", "A Lot"].map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={readOnly}
              onClick={() => setDraft((d) => ({ ...d, aiKnowledgeBefore: opt }))}
              className={cn(
                "px-3 py-1.5 rounded-full border text-xs",
                draft.aiKnowledgeBefore === opt ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700",
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">After this camp, how confident are you explaining AI concepts?</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={readOnly}
              onClick={() => setDraft((d) => ({ ...d, confidenceAfter: n }))}
              className={cn(
                "size-10 rounded-lg border text-sm font-semibold",
                draft.confidenceAfter === n ? "border-violet-500 bg-violet-500 text-white" : "border-slate-200 dark:border-slate-700",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {[
        { key: "learned" as const, label: "What did you learn?" },
        { key: "difficult" as const, label: "What was difficult?" },
        { key: "favorite" as const, label: "What was your favorite activity?" },
        { key: "nextTopic" as const, label: "What topic would you like to learn next?" },
      ].map((f) => (
        <div key={f.key}>
          <p className="text-sm font-medium mb-1">{f.label}</p>
          <Textarea
            value={draft[f.key]}
            onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
            rows={2}
            disabled={readOnly}
            className="resize-none text-sm"
          />
        </div>
      ))}

      <div>
        <p className="text-sm font-medium mb-2">Would you recommend this camp to other students?</p>
        <div className="flex gap-2 mb-2">
          {["Yes", "No"].map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={readOnly}
              onClick={() => setDraft((d) => ({ ...d, recommend: opt }))}
              className={cn(
                "px-4 py-2 rounded-lg border text-sm",
                draft.recommend === opt ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700",
              )}
            >
              {opt}
            </button>
          ))}
        </div>
        <Textarea
          value={draft.recommendWhy}
          onChange={(e) => setDraft((d) => ({ ...d, recommendWhy: e.target.value }))}
          placeholder="Why?"
          rows={2}
          disabled={readOnly}
          className="resize-none text-sm"
        />
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Would you be interested in future camps?</p>
        <div className="flex flex-wrap gap-2">
          {futureOptions.map((t) => (
            <button
              key={t}
              type="button"
              disabled={readOnly}
              onClick={() => toggleTopic(t)}
              className={cn(
                "px-3 py-1.5 rounded-full border text-xs",
                draft.futureTopics.includes(t) ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {!readOnly && onSaveProfile && (
        <Button
          size="sm"
          disabled={saving || !draft.learned.trim() || draft.confidenceAfter == null}
          onClick={async () => {
            setSaving(true)
            try {
              await onSaveProfile({ [key]: draft })
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? "Saving…" : "Submit survey"}
        </Button>
      )}
    </div>
  )
}

export function CampGraduationBlock({ content }: { content?: Record<string, unknown> }) {
  const defaultSkills = [
    "Artificial Intelligence",
    "Computer Vision",
    "Edge Computing",
    "Raspberry Pi",
    "OpenCV",
    "Face & Eye Detection",
  ]
  const skills = Array.isArray(content?.skills)
    ? (content.skills as string[])
    : defaultSkills
  const headline = String(content?.headline ?? "You are now an Edge AI Engineer")
  const programName = String(
    content?.programName ?? "AI & Edge Computing Summer Camp 2026",
  )
  const skillsLeadIn = String(content?.skillsLeadIn ?? "You built a real Edge AI system using:")

  return (
    <div className="rounded-xl border-2 border-violet-500/40 bg-gradient-to-br from-violet-500/15 to-emerald-500/10 p-6 sm:p-8 text-center space-y-4">
      <PartyPopper className="h-14 w-14 text-violet-500 mx-auto" />
      <p className="text-2xl font-bold text-slate-900 dark:text-white">🎉 Congratulations!</p>
      <p className="text-lg font-semibold text-violet-700 dark:text-violet-300">{headline}</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        You have successfully completed the {programName}.
      </p>
      <p className="text-sm font-medium">{skillsLeadIn}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {skills.map((s) => (
          <Badge key={s} className="bg-emerald-600/90 text-white text-xs">{s}</Badge>
        ))}
      </div>
      <p className="text-sm font-medium text-violet-700 dark:text-violet-300 pt-2">
        Keep building. Keep exploring. Keep innovating.
      </p>
      <p className="text-xs text-slate-500 italic">The future of AI is in your hands.</p>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <Button asChild size="sm">
          <Link href={campRoute("/graduation")}>
            <GraduationCap className="h-4 w-4 mr-1" />
            Camp Graduation Dashboard
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={campRoute("/gallery")}>View Project Gallery</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={campRoute("/achievements")}>Download Certificate</Link>
        </Button>
      </div>
    </div>
  )
}
