"use client"

import { useEffect, useState } from "react"
import {
  Rocket,
  Camera,
  Cpu,
  Brain,
  ChevronDown,
  ChevronRight,
  ArrowDown,
  MessageSquare,
  Wand2,
  PartyPopper,
  Trophy,
  User,
  Sparkles,
  GraduationCap,
  Target,
  Zap,
  Eye,
  Microchip,
  Check,
  ArrowRight,
} from "lucide-react"
import { CampScaledImage } from "@/components/summer-camp/CampScaledImage"
import { CampZoomableImage } from "@/components/summer-camp/CampZoomableImage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useCampPresentation } from "@/components/summer-camp/camp-presentation-context"
import { CAMP_PRESENTATION_NESTED_PANEL } from "@/lib/summer-camp/camp-presentation-styles"
import type { BlockProgressMap } from "@/components/summer-camp/CampBlockRenderer"
import { CampLearningJourneyTimeline } from "@/components/summer-camp/CampLearningJourneyTimeline"
import { CampModernSurface } from "@/components/summer-camp/camp-modern-blocks"
import { motion, AnimatePresence } from "framer-motion"

const ROADMAP_STEPS = [
  "Start",
  "AI",
  "Machine Learning",
  "Computer Vision",
  "IoT",
  "Edge Computing",
  "Raspberry Pi",
  "Object Detection",
  "Final Showcase",
]

export function CampHeroBlock({ content }: { content: Record<string, unknown> }) {
  const inPresentation = useCampPresentation()
  const imageUrl = content.imageUrl ? String(content.imageUrl) : null
  const isCover = String(content.variant ?? "") === "cover"
  return (
    <div
      data-camp-hero=""
      className={
        isCover
          ? cn(
              "relative w-full overflow-hidden rounded-none border-0",
              inPresentation
                ? "min-h-[min(52vh,480px)] sm:min-h-[min(56vh,520px)]"
                : "min-h-[min(72vh,640px)] sm:min-h-[min(75vh,680px)]",
            )
          : "relative rounded-2xl overflow-hidden border border-violet-500/30 min-h-[220px] sm:min-h-[280px]"
      }
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
          loading={isCover ? "eager" : "lazy"}
        />
      ) : null}
      {isCover && imageUrl ? (
        <>
          <div
            className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-slate-900/20"
            aria-hidden
          />
          <div
            className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#1a0a2e]/95 to-transparent"
            aria-hidden
          />
        </>
      ) : (
        <>
          <div
            className={`absolute inset-0 bg-gradient-to-br from-violet-900 via-indigo-900 to-slate-900 ${imageUrl ? "opacity-80" : ""}`}
            aria-hidden
          />
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_30%,#a78bfa_0%,transparent_50%),radial-gradient(circle_at_80%_70%,#38bdf8_0%,transparent_45%)]" />
        </>
      )}
      <div
        className={
          isCover
            ? cn(
                "relative z-10 p-6 sm:p-10 md:p-12 flex flex-col justify-end",
                inPresentation
                  ? "min-h-[min(52vh,480px)] sm:min-h-[min(56vh,520px)]"
                  : "min-h-[min(72vh,640px)] sm:min-h-[min(75vh,680px)]",
              )
            : "relative z-10 p-6 sm:p-10 flex flex-col justify-end min-h-[220px] sm:min-h-[280px]"
        }
      >
        <div className="flex flex-wrap gap-2 mb-4">
          {((content.tags as string[] | undefined) ?? ["AI", "Raspberry Pi", "Camera", "Edge AI", "Object Detection"]).map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className={
                inPresentation
                  ? "bg-black/50 text-white border-white/30 backdrop-blur-sm"
                  : "bg-white/10 text-white border-white/20 backdrop-blur-sm"
              }
            >
              {tag}
            </Badge>
          ))}
        </div>
        <h1
          className={
            isCover
              ? "text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight max-w-3xl drop-shadow-md"
              : "text-2xl sm:text-3xl font-bold text-white leading-tight"
          }
        >
          {String(content.title ?? "AI & Edge Computing Summer Camp 2026")}
        </h1>
        <p
          className={cn(
            isCover
              ? "text-sky-100/95 mt-3 text-base sm:text-lg max-w-2xl drop-shadow"
              : "mt-2 text-sm sm:text-base max-w-xl",
            inPresentation ? "!text-sky-100/95 drop-shadow" : "text-violet-200",
          )}
        >
          {String(content.subtitle ?? "Build Real AI Systems on Real Hardware")}
        </p>
        {!imageUrl && !inPresentation ? (
          <p className="text-xs mt-3 text-violet-300/70">Hero banner image placeholder</p>
        ) : null}
      </div>
    </div>
  )
}

const WELCOME_SKILLS = [
  "Detect objects in live video",
  "Understand how images become data",
  "Run AI models on edge devices",
  "Make systems that decide in real time",
]

const WELCOME_APPLICATIONS = [
  { label: "Self-driving vehicles", emoji: "🚗" },
  { label: "Smart security cameras", emoji: "📹" },
  { label: "Warehouse robots", emoji: "🤖" },
  { label: "Delivery drones", emoji: "🛸" },
  { label: "Smart cities", emoji: "🏙️" },
]

export function CampWelcomeIntroBlock() {
  const pillars = [
    {
      icon: GraduationCap,
      title: "Your mission",
      accent: "from-violet-500/20 to-indigo-500/10 border-violet-500/30",
      iconClass: "text-violet-600 dark:text-violet-400",
      body: "Over the next few days, you will step into the role of an AI engineer — not just learning concepts, but shipping a working system.",
    },
    {
      icon: Eye,
      title: "Skills you'll build",
      accent: "from-sky-500/15 to-blue-500/5 border-sky-500/25",
      iconClass: "text-sky-600 dark:text-sky-400",
      list: WELCOME_SKILLS,
    },
    {
      icon: Microchip,
      title: "Your capstone project",
      accent: "from-emerald-500/15 to-teal-500/5 border-emerald-500/30",
      iconClass: "text-emerald-600 dark:text-emerald-400",
      body: "A real-time object detection system on a Raspberry Pi — the same class of technology powering modern robots, cameras, and autonomous systems.",
    },
  ]

  return (
    <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/[0.06] via-white/50 to-indigo-500/[0.04] dark:from-violet-500/10 dark:via-white/[0.02] dark:to-indigo-500/5 overflow-hidden">
      <div className="p-5 sm:p-7 border-b border-violet-500/15">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl" aria-hidden>
              🎓
            </span>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
              Module 0 · Onboarding
            </p>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
            Welcome to the AI & Edge Computing Summer Camp
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-2 max-w-2xl leading-relaxed">
            You are joining a hands-on engineering program at Prairie View A&amp;M — built for campers who want to
            create intelligent systems, not just read about them.
          </p>
        </motion.div>
      </div>

      <div className="p-5 sm:p-7 grid gap-4 sm:grid-cols-3">
        {pillars.map((pillar, i) => {
          const Icon = pillar.icon
          return (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.1, duration: 0.4 }}
              className={cn(
                "rounded-xl border bg-gradient-to-br p-4 flex flex-col gap-3",
                pillar.accent,
              )}
            >
              <div className="flex items-center gap-2">
                <div className="size-9 rounded-lg bg-white/70 dark:bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className={cn("h-4 w-4", pillar.iconClass)} />
                </div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">{pillar.title}</p>
              </div>
              {pillar.list ? (
                <ul className="space-y-1.5">
                  {pillar.list.map((item) => (
                    <li
                      key={item}
                      className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2"
                    >
                      <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {pillar.body}
                </p>
              )}
            </motion.div>
          )
        })}
      </div>

      <div className="px-5 sm:px-7 pb-5 sm:pb-7">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" />
            Same tech used in the real world
          </p>
          <div className="flex flex-wrap gap-2">
            {WELCOME_APPLICATIONS.map((app, i) => (
              <motion.span
                key={app.label}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.05 }}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                <span aria-hidden>{app.emoji}</span>
                {app.label}
              </motion.span>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="mt-5 rounded-xl bg-[#582c83] px-4 py-4 sm:px-5 sm:py-5 text-center"
        >
          <p className="text-base sm:text-lg font-bold text-white">
            You are not just learning about AI — you are about to build one yourself.
          </p>
          <p className="text-sm text-violet-200 mt-1">
            Work through every section below — complete activities, reflections, and the knowledge check at the end.
          </p>
        </motion.div>
      </div>
    </div>
  )
}

export function CampStartJourneyBlock({
  onReveal,
  revealed,
  onContinue,
}: {
  onReveal: () => void
  revealed: boolean
  onContinue?: () => void
}) {
  const inPresentation = useCampPresentation()
  const handleContinue = () => {
    onReveal()
    onContinue?.()
  }

  return (
    <CampModernSurface className="space-y-4">
      <p
        className={cn(
          "text-sm leading-relaxed",
          inPresentation ? "text-slate-700" : "text-slate-700 dark:text-slate-300",
        )}
      >
        This module has several sections with activities, reflections, and a knowledge check. Complete each
        one before marking the module done.
      </p>
      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
        <Button
          onClick={handleContinue}
          className="gap-2 w-full sm:w-auto"
          style={{ background: "#582c83" }}
        >
          <Rocket className="h-4 w-4" />
          {revealed ? "Continue with the sections below" : "Continue — complete all sections below"}
        </Button>
      </motion.div>
      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={cn(
              "rounded-lg border px-4 py-3 text-sm",
              inPresentation
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200",
            )}
          >
            <p className="font-medium">You&apos;re on your way.</p>
            <p
              className={cn(
                "mt-1",
                inPresentation ? "text-emerald-800" : "text-emerald-700/90 dark:text-emerald-300/90",
              )}
            >
              Keep going through each section below. Finish the knowledge check, then use{" "}
              <strong>Mark module complete</strong> at the bottom.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </CampModernSurface>
  )
}

export function CampDemoFlowBlock() {
  const steps = [
    { icon: Camera, label: "Normal Camera", detail: "Records everything" },
    { icon: Brain, label: "AI Detection", detail: "Model analyzes each frame" },
    { icon: User, label: "Person Detected", detail: "Classifier finds a person" },
    { icon: Cpu, label: "Bounding Box", detail: "Box drawn around object" },
    { icon: Sparkles, label: "Alert Generated", detail: "Edge device acts instantly" },
  ]
  const [active, setActive] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % steps.length), 1800)
    return () => clearInterval(t)
  }, [steps.length])

  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5">
      <p className="font-semibold text-slate-900 dark:text-white mb-4">Interactive Demonstration</p>
      <div className="flex flex-col sm:flex-row items-stretch gap-2">
        {steps.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="flex sm:flex-col items-center gap-2 flex-1">
              <div
                className={cn(
                  "rounded-xl border p-3 w-full text-center transition-all duration-500",
                  active === i
                    ? "border-violet-500 bg-violet-500/15 scale-[1.02]"
                    : "border-slate-200 dark:border-slate-700 opacity-70",
                )}
              >
                <Icon className="h-5 w-5 mx-auto text-violet-600 dark:text-violet-400 mb-1" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{s.label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{s.detail}</p>
              </div>
              {i < steps.length - 1 && (
                <ChevronDown className="h-4 w-4 text-slate-400 rotate-[-90deg] sm:rotate-0 shrink-0" />
              )}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-slate-500 mt-3 text-center">[Placeholder for demo GIF / video]</p>
    </div>
  )
}

export function CampFacultyCardsBlock({ content }: { content: Record<string, unknown> }) {
  const inPresentation = useCampPresentation()
  const faculty = (content.faculty as Array<Record<string, string>>) ?? []
  const assistants = (content.assistants as Array<Record<string, string>>) ?? []

  const PersonCard = ({ person, role }: { person: Record<string, string>; role: string }) => (
    <div
      className={cn(
        "rounded-xl p-4 flex gap-3 ring-1 shadow-sm hover:shadow-md transition-shadow",
        inPresentation
          ? "bg-white ring-slate-200/80"
          : "bg-white/80 dark:bg-white/[0.04] ring-slate-200/70 dark:ring-white/10",
      )}
    >
      <div className="size-14 rounded-full bg-gradient-to-br from-violet-500/30 to-indigo-500/30 flex items-center justify-center shrink-0 overflow-hidden">
        {person.photoUrl ? (
          <CampZoomableImage
            src={person.photoUrl}
            alt={person.name ?? "Faculty photo"}
            className="h-full w-full"
            imgClassName="h-full w-full object-cover"
          />
        ) : (
          <User className="h-6 w-6 text-violet-600" />
        )}
      </div>
      <div className="min-w-0">
        <p className={cn("font-semibold", inPresentation ? "text-slate-900" : "text-slate-900 dark:text-white")}>
          {person.name}
        </p>
        <p className={cn("text-xs", inPresentation ? "text-violet-700" : "text-violet-600 dark:text-violet-400")}>
          {person.role ?? role}
        </p>
        {person.interests && (
          <p className={cn("text-xs mt-1", inPresentation ? "text-slate-600" : "text-slate-500")}>
            Research: {person.interests}
          </p>
        )}
        {person.funFact && (
          <p className={cn("text-xs mt-1", inPresentation ? "text-slate-700" : "text-slate-600 dark:text-slate-400")}>
            Fun fact: {person.funFact}
          </p>
        )}
      </div>
    </div>
  )

  return (
    <CampModernSurface className="space-y-4">
      <h3 className={cn("text-lg font-bold", inPresentation ? "text-slate-900" : "text-slate-900 dark:text-white")}>
        Meet Your Instructors
      </h3>
      {faculty.map((f) => (
        <PersonCard key={f.name} person={f} role="Faculty" />
      ))}
      {assistants.length > 0 && (
        <>
          <h4
            className={cn(
              "text-sm font-medium",
              inPresentation ? "text-slate-800" : "text-slate-700 dark:text-slate-300",
            )}
          >
            Teaching Assistants
          </h4>
          <div className="grid sm:grid-cols-2 gap-3">
            {assistants.map((a) => (
              <PersonCard key={a.name} person={a} role="Teaching Assistant" />
            ))}
          </div>
        </>
      )}
    </CampModernSurface>
  )
}

export function CampMissionObjectivesBlock({ content }: { content: Record<string, unknown> }) {
  const missions = (content.missions as Array<{ title: string; xp: number }>) ?? []
  const title = content.title ? String(content.title) : "Mission Objectives"
  const totalXp = missions.reduce((sum, m) => sum + m.xp, 0)
  const missionIcons = [Brain, Sparkles, MessageSquare, Wand2, Target, Trophy, Zap]
  const inPresentation = useCampPresentation()

  return (
    <CampModernSurface className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3
          className={cn(
            "text-lg font-bold",
            inPresentation ? "text-slate-900" : "text-slate-900 dark:text-white",
          )}
        >
          {title}
        </h3>
        <div className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 ring-1 ring-amber-500/25", inPresentation ? "bg-amber-100" : "bg-amber-500/15")}>
          <Trophy className="h-4 w-4 text-amber-600" />
          <span className={cn("text-sm font-bold", inPresentation ? "text-amber-900" : "text-amber-800 dark:text-amber-200")}>{totalXp} XP total</span>
        </div>
      </div>

      <div className="relative">
        <div
          className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-violet-500 via-indigo-400 to-amber-400 rounded-full"
          aria-hidden
        />
        <div className="space-y-3">
          {missions.map((m, i) => {
            const Icon = missionIcons[i % missionIcons.length]
            return (
              <motion.div
                key={m.title}
                initial={inPresentation ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
                whileInView={inPresentation ? undefined : { opacity: 1, x: 0 }}
                viewport={{ once: true }}
                animate={inPresentation ? { opacity: 1, x: 0 } : undefined}
                transition={{ delay: inPresentation ? i * 0.04 : i * 0.05 }}
                className="relative flex items-stretch gap-4 pl-0"
              >
                <div className="relative z-10 flex flex-col items-center shrink-0">
                  <div className="size-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/25 ring-2 ring-white dark:ring-slate-900">
                    <Icon className="h-4 w-4" />
                  </div>
                  {i < missions.length - 1 ? (
                    <ArrowDown className="h-4 w-4 text-violet-400/60 mt-1 lg:hidden" />
                  ) : null}
                </div>
                <div
                  className={cn(
                    "flex-1 flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 ring-1 hover:ring-violet-400/30 hover:shadow-md transition-all min-h-[3.5rem]",
                    inPresentation
                      ? "bg-white ring-slate-200/80"
                      : "bg-white dark:bg-slate-800/80 ring-slate-200/80 dark:ring-white/15",
                  )}
                >
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wide",
                        inPresentation ? "text-violet-700" : "text-violet-700 dark:text-violet-300",
                      )}
                    >
                      Mission {i + 1}
                    </p>
                    <p
                      className={cn(
                        "text-sm font-semibold leading-snug",
                        inPresentation ? "text-slate-900" : "text-slate-900 dark:text-slate-100",
                      )}
                    >
                      {m.title}
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      "shrink-0 border-amber-500/30",
                      inPresentation
                        ? "bg-amber-100 text-amber-900"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                    )}
                  >
                    +{m.xp} XP
                  </Badge>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </CampModernSurface>
  )
}

export function CampProfileFormBlock({
  content,
  camperProfile,
  onSaveProfile,
  readOnly,
}: {
  content: Record<string, unknown>
  camperProfile?: Record<string, unknown>
  onSaveProfile?: (
    patch: Record<string, unknown>,
  ) => Promise<void | { ok: boolean; error?: string }>
  readOnly?: boolean
}) {
  const inPresentation = useCampPresentation()
  const fields = (content.fields as Array<{ key: string; label: string; type?: string }>) ?? []
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  )

  useEffect(() => {
    const initial: Record<string, string> = {}
    for (const f of fields) {
      const v = camperProfile?.[f.key]
      if (v != null) initial[f.key] = String(v)
    }
    setDraft(initial)
  }, [camperProfile, fields])

  const save = async () => {
    if (!onSaveProfile) return
    setSaving(true)
    setSaveFeedback(null)
    try {
      const result = await onSaveProfile(draft)
      if (result && "ok" in result && !result.ok) {
        setSaveFeedback({
          type: "error",
          message: result.error ?? "Could not save. Please try again.",
        })
      } else {
        setSaveFeedback({ type: "success", message: "Saved to your profile." })
      }
    } catch {
      setSaveFeedback({ type: "error", message: "Could not save. Please try again." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-4 sm:p-5 space-y-3",
        inPresentation
          ? CAMP_PRESENTATION_NESTED_PANEL
          : "border-dashboard-v2-border bg-dashboard-v2-card",
      )}
    >
      <h3 className="font-semibold text-slate-900 dark:text-white">
        {String(content.title ?? "Tell Us About Yourself")}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) =>
          f.type === "textarea" ? (
            <Textarea
              key={f.key}
              value={draft[f.key] ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              placeholder={f.label}
              disabled={readOnly}
              rows={3}
              className="sm:col-span-2 resize-none"
            />
          ) : (
            <Input
              key={f.key}
              value={draft[f.key] ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              placeholder={f.label}
              disabled={readOnly}
            />
          ),
        )}
      </div>
      {!readOnly && onSaveProfile && (
        <div className="space-y-2">
          <Button size="sm" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save to my profile"}
          </Button>
          {saveFeedback && (
            <p
              className={cn(
                "text-sm",
                saveFeedback.type === "success"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400",
              )}
              role="status"
            >
              {saveFeedback.message}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function CampModuleCompletionBlock({
  content,
  isModuleComplete,
  rewards,
  knowledgeCheckGaps = [],
}: {
  content: Record<string, unknown>
  isModuleComplete?: boolean
  rewards?: { xp?: number; badges?: string[]; nextModule?: string; comingNext?: string }
  knowledgeCheckGaps?: Array<{ label: string; blockId?: number }>
}) {
  const contentRewards = content.rewards as {
    xp?: number
    badges?: string[]
    nextModule?: string
    comingNext?: string
  } | undefined
  const displayRewards = rewards ?? (isModuleComplete ? contentRewards : undefined)
  if (!isModuleComplete) {
    const pendingRewards = content.rewards as { xp?: number; badges?: string[] } | undefined
    return (
      <CampModernSurface className="text-center space-y-3">
        <p className="font-semibold text-slate-900">
          {String(content.title ?? "Ready to finish this module?")}
        </p>
        <p className="text-sm text-slate-700 leading-relaxed">
          {knowledgeCheckGaps.length > 0
            ? "Answer all knowledge check questions, then use Mark module complete below to unlock rewards"
            : "Use Mark module complete below to unlock rewards"}
          {pendingRewards?.xp != null ? ` (+${pendingRewards.xp} XP)` : ""}.
        </p>
        {knowledgeCheckGaps.length > 0 && (
          <p className="text-sm font-semibold text-amber-800 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-2 inline-block">
            {knowledgeCheckGaps.length} knowledge check{knowledgeCheckGaps.length === 1 ? "" : "s"} remaining.
          </p>
        )}
      </CampModernSurface>
    )
  }

  const badgeLabels: Record<string, string> = {
    "welcome-badge": "Welcome Badge",
    "camp-explorer": "Camp Explorer Achievement",
    "ai-explorer": "AI Explorer Badge",
    "ml-explorer": "Machine Learning Explorer Badge",
    "cv-explorer": "Computer Vision Explorer Badge",
    "iot-explorer": "IoT Explorer Badge",
    "edge-explorer": "Edge Computing Explorer Badge",
    "edge-ai-explorer": "Edge AI Explorer Badge",
    "pi-explorer": "Raspberry Pi Explorer Badge",
    "edge-device-builder": "Edge Device Builder Badge",
    "hardware-setup-cert": "Hardware Setup Certificate",
    "ai-environment-builder": "AI Environment Builder Badge",
    "opencv-explorer": "Computer Vision Explorer Badge",
    "object-detection-explorer": "Object Detection Explorer Badge",
    "edge-ai-security-engineer": "Edge AI Security Engineer Badge",
    "edge-ai-sustainability-engineer": "Edge AI Sustainability Engineer Badge",
    "edge-ai-deployment-explorer": "Edge AI Explorer Badge",
    "edge-vision-explorer": "Edge Vision Explorer Badge",
    "first-edge-ai-deployment-cert": "First Edge AI Deployment Certificate",
    "first-cv-deployment-cert": "First Computer Vision Deployment Certificate",
    "edge-ai-engineer": "Edge AI Engineer Badge",
    "camp-certificate-2026": "AI & Edge Computing Summer Camp Certificate",
    "xr-attention-certificate-2026": "XR, Eye Tracking, and AI Research Training Certificate",
    "first-module": "First Module Complete",
    "first-discussion": "First Discussion Badge",
  }

  return (
    <CampModernSurface className="text-center space-y-4 ring-2 ring-emerald-500/35">
      <PartyPopper className="h-10 w-10 text-emerald-600 mx-auto" />
      <h3 className="text-xl font-bold text-slate-900">
        {String(content.title ?? "Congratulations!")}
      </h3>
      <p className="text-sm text-slate-700 leading-relaxed">
        {String(content.message ?? "You have completed this module.")}
      </p>
      {displayRewards?.xp != null && (
        <p className="text-lg font-semibold text-amber-700 flex items-center justify-center gap-2">
          <Trophy className="h-5 w-5" />
          +{displayRewards.xp} XP
        </p>
      )}
      {displayRewards?.badges && displayRewards.badges.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {displayRewards.badges.map((b) => (
            <Badge key={b} variant="outline" className="border-emerald-500/40 text-slate-800">
              {badgeLabels[b] ?? b}
            </Badge>
          ))}
        </div>
      )}
      {displayRewards?.nextModule && (
        <p className="text-sm font-semibold text-violet-800">
          Unlocked: {displayRewards.nextModule}
        </p>
      )}
      {displayRewards?.comingNext && (
        <p className="text-sm text-slate-600 mt-2">{displayRewards.comingNext}</p>
      )}
    </CampModernSurface>
  )
}

export function CampExcitementFeedbackBlock({
  content,
  blockProgress,
  onSave,
  onOpenSupport,
  readOnly,
  saving,
}: {
  content: Record<string, unknown>
  blockProgress?: BlockProgressMap
  onSave: (metadata: Record<string, unknown>) => Promise<void>
  onOpenSupport?: () => void
  readOnly?: boolean
  saving?: boolean
}) {
  const options = (content.emotions as Array<{ emoji: string; label: string }>) ?? [
    { emoji: "😀", label: "Very Excited" },
    { emoji: "🙂", label: "Excited" },
    { emoji: "😐", label: "Neutral" },
    { emoji: "🙁", label: "Nervous" },
    { emoji: "😟", label: "Concerned" },
  ]
  const saved = blockProgress?.feedback as Record<string, unknown> | undefined
  const [emotion, setEmotion] = useState<string | undefined>(saved?.emotion as string | undefined)
  const savedReady = saved?.readyToContinue as string | undefined

  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <p className="font-medium text-slate-800 dark:text-slate-200">
        {String(content.question ?? "How excited are you about this camp?")}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            disabled={readOnly || saving}
            onClick={() => {
              setEmotion(o.label)
              void onSave({ kind: "excitement", emotion: o.label, emoji: o.emoji, readyToContinue: savedReady })
            }}
            className={cn(
              "px-3 py-2 rounded-lg border text-sm transition-colors",
              emotion === o.label
                ? "border-violet-500 bg-violet-500/15"
                : "border-slate-200 dark:border-slate-700 hover:border-violet-400",
            )}
          >
            <span className="mr-1.5">{o.emoji}</span>
            {o.label}
          </button>
        ))}
      </div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Do you feel ready to continue?</p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={savedReady === "Yes" ? "default" : "outline"}
          disabled={readOnly || saving}
          onClick={() => void onSave({ kind: "excitement", emotion, readyToContinue: "Yes" })}
        >
          Yes
        </Button>
        <Button
          size="sm"
          variant={savedReady === "Need Help" ? "default" : "outline"}
          disabled={readOnly || saving}
          onClick={() => {
            void onSave({ kind: "excitement", emotion, readyToContinue: "Need Help" })
            onOpenSupport?.()
          }}
        >
          Need Help
        </Button>
      </div>
    </div>
  )
}

export function CampExampleCardsBlock({ content }: { content: Record<string, unknown> }) {
  const cards =
    (content.cards as Array<{ title: string; description?: string; imageUrl?: string; bullets?: string[] }>) ?? []
  const caption = content.caption ? String(content.caption) : undefined
  const inPresentation = useCampPresentation()

  if (cards.length === 1 && cards[0].imageUrl?.trim()) {
    const card = cards[0]
    return (
      <CampModernSurface className="space-y-4">
        {caption ? (
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{caption}</p>
        ) : null}
        <div className="grid md:grid-cols-2 gap-5 md:gap-6 items-center">
          <div className="rounded-xl bg-white dark:bg-slate-900 p-3 ring-1 ring-slate-200/70 dark:ring-white/10">
            <CampScaledImage
              src={card.imageUrl}
              alt={card.title}
              aspectClass="aspect-[4/3]"
              className="border-0 bg-white dark:bg-slate-900"
              imgClassName="object-contain p-2 bg-white dark:bg-slate-900"
            />
          </div>
          <div className="min-w-0 space-y-3">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">{card.title}</h3>
            {card.description ? (
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{card.description}</p>
            ) : null}
            {card.bullets && card.bullets.length > 0 ? (
              <ul className="space-y-2">
                {card.bullets.map((line, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <ChevronRight className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </CampModernSurface>
    )
  }

  return (
    <div className="space-y-3">
      {caption ? (
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{caption}</p>
      ) : null}
      <div
        className={cn(
          "grid gap-3 sm:gap-4",
          cards.length === 2 ? "sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3",
        )}
      >
      {cards.map((card, i) => (
        <motion.div
          key={card.title}
          initial={inPresentation ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          whileInView={inPresentation ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          animate={inPresentation ? { opacity: 1, y: 0 } : undefined}
          transition={{ delay: i * 0.05 }}
          className="rounded-2xl overflow-hidden flex flex-col bg-gradient-to-br from-white to-slate-50/60 dark:from-slate-900 dark:to-violet-950/20 shadow-md ring-1 ring-slate-200/70 dark:ring-white/10 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
        >
          {card.imageUrl?.trim() ? (
            <CampScaledImage
              src={card.imageUrl}
              alt={card.title}
              aspectClass="aspect-[4/3]"
              className="rounded-none border-0 bg-white dark:bg-slate-900"
              imgClassName="object-contain p-2 bg-white dark:bg-slate-900"
            />
          ) : null}
          <div className="p-3.5 sm:p-4">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{card.title}</p>
            {card.description && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{card.description}</p>
            )}
          </div>
        </motion.div>
      ))}
      </div>
    </div>
  )
}

export function CampLearningObjectivesBlock({ content }: { content: Record<string, unknown> }) {
  const items = (content.items as string[]) ?? []
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5">
      <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Learning Objectives</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
            <span className="text-emerald-600 shrink-0">✓</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CampComparisonTableBlock({ content }: { content: Record<string, unknown> }) {
  const rows = (content.rows as Array<{ human: string; ai: string; task?: string; left?: string; right?: string }>) ?? []
  const leftHeader = String(content.leftHeader ?? content.leftLabel ?? "Human")
  const rightHeader = String(content.rightHeader ?? content.rightLabel ?? "AI System")
  const title = content.title ? String(content.title) : undefined

  return (
    <CampModernSurface padding="none" className="overflow-hidden">
      {title ? (
        <div className="px-4 py-3 border-b border-slate-200/60">
          <p className="font-semibold text-slate-900">{title}</p>
        </div>
      ) : null}
      <div className="grid grid-cols-2 bg-slate-100 text-slate-800 border-b border-slate-200/80 text-[10px] sm:text-xs font-semibold uppercase tracking-wide">
        <div className="px-3 py-2.5 border-r border-slate-200/60">{leftHeader}</div>
        <div className="px-3 py-2.5">{rightHeader}</div>
      </div>
      {rows.map((row, index) => {
        const left = row.human ?? row.left ?? row.task ?? ""
        const right = row.ai ?? row.right ?? ""
        return (
          <div key={`${index}-${left}-${right}`} className="grid grid-cols-2 border-t border-slate-200/60 text-sm">
            <div className="px-3 py-2.5 text-slate-800 border-r border-slate-200/60 font-medium">
              {left}
            </div>
            <div className="px-3 py-2.5 text-slate-700">{right}</div>
          </div>
        )
      })}
    </CampModernSurface>
  )
}

export function CampMatchingPairsBlock({ content }: { content: Record<string, unknown> }) {
  const pairs = (content.pairs as Array<{ task: string; capability: string }>) ?? []
  const [shuffled] = useState(() => {
    const idx = pairs.map((_, i) => i)
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
    return idx
  })
  const [selectedTerm, setSelectedTerm] = useState<number | null>(null)
  const [matched, setMatched] = useState<Record<number, number>>({})
  const [wrongFlash, setWrongFlash] = useState<number | null>(null)
  const title = String(content.title ?? "Matching Activity")
  const prompt = String(content.prompt ?? "Tap a term, then tap its matching description.")

  const matchedTerms = new Set(Object.keys(matched).map(Number))

  const tryMatch = (displayIndex: number) => {
    if (selectedTerm === null) return
    if (matched[selectedTerm] !== undefined) return
    const pairIndex = shuffled[displayIndex]
    if (pairIndex === selectedTerm) {
      setMatched((m) => ({ ...m, [selectedTerm]: displayIndex }))
      setSelectedTerm(null)
    } else {
      setWrongFlash(displayIndex)
      setTimeout(() => setWrongFlash(null), 600)
    }
  }

  const allMatched = pairs.length > 0 && Object.keys(matched).length === pairs.length

  const matchCount = Object.keys(matched).length

  return (
    <CampModernSurface className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{title}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{prompt}</p>
        </div>
        <div className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-bold text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/20">
          {matchCount}/{pairs.length} paired
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 rounded-full"
          animate={{ width: `${pairs.length ? (matchCount / pairs.length) * 100 : 0}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        />
      </div>

      <div className="relative grid md:grid-cols-2 gap-4 md:gap-8">
        <div
          className="hidden md:block absolute left-1/2 top-4 bottom-4 w-px -translate-x-1/2 bg-gradient-to-b from-violet-300 via-indigo-300 to-emerald-300 dark:from-violet-600 dark:via-indigo-600 dark:to-emerald-600"
          aria-hidden
        />
        <div className="space-y-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">Terms</p>
          {pairs.map((pair, i) => {
            const isMatched = matchedTerms.has(i)
            const isSelected = selectedTerm === i
            return (
              <button
                key={pair.task}
                type="button"
                disabled={isMatched}
                onClick={() => setSelectedTerm(isSelected ? null : i)}
                className={cn(
                  "w-full text-left rounded-xl px-4 py-4 text-sm font-semibold transition-all duration-200 min-h-[4.25rem] flex items-center",
                  isMatched && "bg-emerald-500/15 ring-2 ring-emerald-500/40 text-emerald-800 dark:text-emerald-200",
                  !isMatched &&
                    isSelected &&
                    "bg-violet-500/15 ring-2 ring-violet-500/50 text-violet-900 dark:text-violet-100 shadow-lg shadow-violet-500/10 scale-[1.01]",
                  !isMatched &&
                    !isSelected &&
                    "bg-white/80 dark:bg-white/[0.04] ring-1 ring-slate-200/70 dark:ring-white/10 hover:ring-violet-400/40",
                )}
              >
                {pair.task}
              </button>
            )
          })}
        </div>
        <div className="space-y-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            Descriptions
          </p>
          {shuffled.map((pairIndex, displayIndex) => {
            const pair = pairs[pairIndex]
            const isMatched = Object.values(matched).includes(displayIndex)
            const isWrong = wrongFlash === displayIndex
            return (
              <button
                key={`${pair.capability}-${displayIndex}`}
                type="button"
                disabled={isMatched || selectedTerm === null}
                onClick={() => tryMatch(displayIndex)}
                className={cn(
                  "w-full text-left rounded-xl px-4 py-4 text-sm transition-all duration-200 min-h-[4.25rem] flex items-center",
                  isMatched && "bg-emerald-500/10 ring-2 ring-emerald-500/35 text-emerald-900 dark:text-emerald-100",
                  isWrong && "ring-2 ring-amber-500/60 bg-amber-500/10 animate-pulse",
                  !isMatched &&
                    !isWrong &&
                    selectedTerm !== null &&
                    "hover:bg-violet-500/10 hover:ring-2 hover:ring-violet-400/35 cursor-pointer bg-white/80 dark:bg-white/[0.04] ring-1 ring-slate-200/70",
                  !isMatched &&
                    selectedTerm === null &&
                    "bg-white/60 dark:bg-white/[0.03] ring-1 ring-slate-200/60 text-slate-600 dark:text-slate-400",
                )}
              >
                {pair.capability}
              </button>
            )
          })}
        </div>
      </div>

      {selectedTerm !== null && !allMatched ? (
        <motion.p
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-xs text-center font-medium text-violet-600 dark:text-violet-400"
        >
          → Now tap the matching description
        </motion.p>
      ) : allMatched ? (
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 text-center">
          All matched — nice work!
        </p>
      ) : (
        <p className="text-xs text-center text-slate-500">Select a term to begin</p>
      )}
    </CampModernSurface>
  )
}

export function CampTrainingPipelineBlock() {
  const [step, setStep] = useState(0)
  const steps = [
    { label: "Training Images", detail: "10,000 cats + 10,000 dogs" },
    { label: "AI Model", detail: "Neural network learns patterns" },
    { label: "Prediction", detail: "Cat — 95% confidence" },
  ]
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % steps.length), 2000)
    return () => clearInterval(t)
  }, [steps.length])
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5">
      <p className="font-semibold text-slate-900 dark:text-white mb-4">How AI Learns from Data</p>
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2 flex-1">
            <div
              className={cn(
                "rounded-xl border p-3 flex-1 text-center transition-all",
                step === i ? "border-violet-500 bg-violet-500/15 scale-[1.02]" : "border-slate-200 dark:border-slate-700 opacity-75",
              )}
            >
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{s.label}</p>
              <p className="text-[10px] text-slate-500 mt-1">{s.detail}</p>
            </div>
            {i < steps.length - 1 && <ChevronDown className="h-4 w-4 rotate-[-90deg] text-slate-400 shrink-0 hidden sm:block" />}
          </div>
        ))}
      </div>
      <CampScaledImage
        src="/summer-camp/shared/ai-training-pipeline.png"
        alt="Isometric diagram showing training images flowing into an AI model and prediction"
        aspectClass="aspect-[16/9]"
        className="mt-4"
      />
    </div>
  )
}

export function CampProgrammingFlowBlock({ content }: { content: Record<string, unknown> }) {
  const mode = String(content.mode ?? "traditional")
  const isTraditional = mode === "traditional"
  const steps = isTraditional
    ? ["Input + Rules", "Computer", "Output"]
    : ["Data + Answers", "Training", "AI Model", "Predictions"]
  return (
    <CampModernSurface className="space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">
        {isTraditional ? "Traditional Programming" : "AI Programming"}
      </p>
      {content.example ? (
        <p className="text-xs text-slate-600 dark:text-slate-400">Example: {String(content.example)}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className="px-3 py-2 rounded-lg bg-violet-500/12 border border-violet-500/35 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {s}
            </span>
            {i < steps.length - 1 ? (
              <ChevronDown className="h-4 w-4 rotate-[-90deg] text-violet-500 shrink-0" />
            ) : null}
          </div>
        ))}
      </div>
    </CampModernSurface>
  )
}

export function CampAiHierarchyBlock({ content }: { content?: Record<string, unknown> }) {
  const title = content?.title ? String(content.title) : "The Three Levels of AI"
  const intro =
    content?.intro ?
      String(content.intro)
    : "AI is an umbrella term. Machine learning is one major approach inside it, and deep learning is a powerful subset of ML used in today's generative tools."
  const bullets =
    (content?.bullets as string[]) ?? [
      "Artificial Intelligence — any system that performs tasks we associate with human intelligence (language, vision, planning, game play).",
      "Machine Learning — learns patterns from data instead of relying on hand-written rules for every situation.",
      "Deep Learning — neural networks with many layers; powers face unlock, voice assistants, image generators, and ChatGPT-style tools.",
    ]

  return (
    <CampModernSurface className="space-y-5">
      <div className="grid md:grid-cols-2 gap-5 md:gap-6 items-start">
        <div className="min-w-0 space-y-3 order-2 md:order-1">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{intro}</p>
          <ul className="space-y-2">
            {bullets.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-violet-500" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="order-1 md:order-2 rounded-xl overflow-hidden ring-1 ring-slate-200/70 dark:ring-white/10 bg-white dark:bg-slate-900">
          <CampScaledImage
            src="/summer-camp/shared/ai-hierarchy.png"
            alt="Isometric hierarchy showing AI, machine learning, and deep learning"
            aspectClass="aspect-[4/3]"
            imgClassName="object-contain p-3 bg-white dark:bg-slate-900"
          />
        </div>
      </div>
      <div className="rounded-lg bg-slate-50 dark:bg-white/[0.04] px-4 py-3 font-mono text-sm text-slate-800 dark:text-slate-200 ring-1 ring-slate-200/60 dark:ring-white/10">
        <p className="font-semibold text-violet-700 dark:text-violet-300">Artificial Intelligence</p>
        <p className="pl-4">└── Machine Learning</p>
        <p className="pl-8">└── Deep Learning</p>
      </div>
    </CampModernSurface>
  )
}

export function CampIndustrySectorsBlock({ content }: { content: Record<string, unknown> }) {
  const sectors =
    (content.sectors as Array<{ title: string; examples: string[]; imageUrl?: string }>) ?? []
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {sectors.map((sector) => (
        <div
          key={sector.title}
          className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4"
        >
          <CampScaledImage
            src={sector.imageUrl}
            alt={sector.title}
            aspectClass="aspect-[16/9]"
            className="mb-3"
          />
          <p className="font-semibold text-slate-900 dark:text-white">{sector.title}</p>
          <ul className="mt-2 space-y-1">
            {sector.examples.map((ex) => (
              <li key={ex} className="text-xs text-slate-600 dark:text-slate-400 flex gap-1.5">
                <span className="text-violet-500">•</span>
                {ex}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function CampIndustrySpotlightBlock({ content }: { content: Record<string, unknown> }) {
  const companies = (content.companies as Array<{ name: string; uses: string[] }>) ?? []
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {companies.map((co) => (
        <div key={co.name} className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4">
          <p className="font-bold text-slate-900 dark:text-white">{co.name}</p>
          <p className="text-xs text-slate-500 mt-1 mb-2">Uses AI for:</p>
          <ul className="space-y-1">
            {co.uses.map((u) => (
              <li key={u} className="text-sm text-slate-600 dark:text-slate-400">• {u}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function CampPatternGalleryBlock({ content }: { content: Record<string, unknown> }) {
  const count = Number(content.count ?? 10)
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">{String(content.title ?? "Pattern Learning")}</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">{String(content.question ?? "")}</p>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border border-dashboard-v2-border flex items-center justify-center text-2xl"
          >
            🐕
          </div>
        ))}
      </div>
      <CampScaledImage
        src="/summer-camp/shared/pattern-dog-images.png"
        alt="Isometric dog image dataset showing pattern learning"
        aspectClass="aspect-[16/9]"
      />
      {!revealed && (
        <Button size="sm" variant="outline" onClick={() => setRevealed(true)}>
          Reveal Answer
        </Button>
      )}
      {revealed && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">
          <p className="font-semibold">{String(content.revealTitle ?? "You learned patterns.")}</p>
          <p className="mt-1">{String(content.revealMessage ?? "Machine Learning does the same thing.")}</p>
        </div>
      )}
    </div>
  )
}

export function CampMlCompareBlock() {
  const [side, setSide] = useState<"trad" | "ml">("trad")
  useEffect(() => {
    const t = setInterval(() => setSide((s) => (s === "trad" ? "ml" : "trad")), 3000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5">
      <p className="font-semibold text-slate-900 dark:text-white mb-4">Traditional Programming vs Machine Learning</p>
      <div
        className={cn(
          "rounded-xl border p-4 transition-all",
          side === "trad" ? "border-blue-500/40 bg-blue-500/10" : "border-violet-500/40 bg-violet-500/10",
        )}
      >
        {side === "trad" ? (
          <>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Traditional Programming</p>
            <p className="text-xs text-slate-500 mt-2">Calculator Example</p>
            <p className="text-sm mt-2 text-slate-600 dark:text-slate-400">Rules + Data → Computer → Answer</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Machine Learning</p>
            <p className="text-xs text-slate-500 mt-2">Photo Recognition Example</p>
            <p className="text-sm mt-2 text-slate-600 dark:text-slate-400">Data + Answers → Learning → Model → Predictions</p>
          </>
        )}
      </div>
    </div>
  )
}

export function CampVerticalPipelineBlock({ content }: { content: Record<string, unknown> }) {
  const rawSteps = (content.steps as Array<string | { label: string; detail?: string }>) ?? []
  const steps = rawSteps.map((s) => (typeof s === "string" ? { label: s, detail: undefined } : s))
  const imageUrl = String(content.imageUrl ?? "").trim() || undefined
  const subtitle = content.subtitle ? String(content.subtitle) : undefined
  const [active, setActive] = useState(0)

  return (
    <CampModernSurface className="space-y-4">
      <div>
        <p className="text-lg font-bold text-slate-900 dark:text-white">{String(content.title ?? "Pipeline")}</p>
        {subtitle ? (
          <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">{subtitle}</p>
        ) : null}
      </div>
      {imageUrl ? (
        <CampScaledImage
          src={imageUrl}
          alt={String(content.title ?? "Pipeline illustration")}
          placeholder="Pipeline"
          aspectClass="aspect-video"
          className="rounded-xl overflow-hidden ring-1 ring-slate-200/60"
          imgClassName="object-contain p-2 bg-white dark:bg-slate-900"
        />
      ) : null}
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-2 lg:gap-0">
        {steps.map((step, i) => (
          <div key={step.label} className="flex flex-col lg:flex-row lg:flex-1 lg:items-center min-w-0">
            <button
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "flex-1 rounded-xl p-3.5 sm:p-4 text-left transition-all duration-200 min-w-0",
                active === i
                  ? "bg-violet-50 ring-2 ring-violet-500/40 shadow-sm shadow-violet-500/10 z-10"
                  : "bg-white ring-1 ring-slate-200/80 hover:ring-violet-300/50 hover:bg-slate-50/80",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-7 rounded-lg items-center justify-center text-xs font-bold mb-2",
                  active === i ? "bg-violet-600 text-white" : "bg-violet-100 text-violet-800",
                )}
              >
                {i + 1}
              </span>
              <p className="text-sm font-semibold text-slate-900">{step.label}</p>
              {step.detail && active === i ? (
                <p className="text-xs mt-1.5 text-slate-600 leading-relaxed">{step.detail}</p>
              ) : null}
            </button>
            {i < steps.length - 1 ? (
              <ChevronDown className="h-5 w-5 text-violet-400/70 shrink-0 mx-auto my-1 lg:rotate-[-90deg] lg:mx-2 lg:my-0" />
            ) : null}
          </div>
        ))}
      </div>
    </CampModernSurface>
  )
}

export function CampStepOrderBlock({
  content,
  onComplete,
}: {
  content: Record<string, unknown>
  onComplete?: () => void
}) {
  const correct = (content.correctOrder as string[]) ?? []
  const initial = [...correct].sort(() => Math.random() - 0.5)
  const [order, setOrder] = useState(initial)
  const [checked, setChecked] = useState(false)
  const title = String(content.title ?? "Arrange the Steps")
  const prompt = String(content.prompt ?? "Use the arrows to put the items in order.")
  const successMessage = String(
    content.successMessage ?? "Correct order!",
  )
  const retryMessage = String(content.retryMessage ?? "Not quite — keep arranging!")
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...order]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setOrder(next)
    setChecked(false)
  }
  const isCorrect = order.every((s, i) => s === correct[i])
  return (
    <CampModernSurface className="space-y-4">
      <div>
        <p className="text-lg font-bold text-slate-900">{title}</p>
        <p className="text-sm text-slate-700 mt-1 leading-relaxed">{prompt}</p>
      </div>
      <div className="space-y-2">
        {order.map((step, i) => (
          <div
            key={step}
            className="flex items-center gap-2 rounded-xl bg-slate-50 ring-1 ring-slate-200/80 px-3 py-2.5"
          >
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-800 text-xs font-bold">
              {i + 1}
            </span>
            <span className="flex-1 text-sm font-medium text-slate-900">{step}</span>
            <button
              type="button"
              className="p-1.5 rounded-md text-slate-600 hover:bg-white hover:text-violet-700"
              onClick={() => move(i, -1)}
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              className="p-1.5 rounded-md text-slate-600 hover:bg-white hover:text-violet-700"
              onClick={() => move(i, 1)}
              aria-label="Move down"
            >
              ↓
            </button>
          </div>
        ))}
      </div>
      <Button
        size="sm"
        className="bg-[#582c83] hover:bg-[#6d3a9e] text-white"
        onClick={() => {
          setChecked(true)
          if (isCorrect) onComplete?.()
        }}
      >
        Check Order
      </Button>
      {checked ? (
        <p className={cn("text-sm font-medium", isCorrect ? "text-emerald-700" : "text-amber-800")}>
          {isCorrect ? successMessage : retryMessage}
        </p>
      ) : null}
    </CampModernSurface>
  )
}

export function CampTrainingLoopBlock() {
  const steps = ["Makes a guess", "Compares answer", "Learns from mistakes", "Improves", "Repeats thousands of times"]
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % steps.length), 1500)
    return () => clearInterval(t)
  }, [steps.length])
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5">
      <p className="font-semibold text-slate-900 dark:text-white mb-3">During Training</p>
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div
            key={s}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm transition-all",
              active === i ? "border-violet-500 bg-violet-500/15 font-medium" : "border-slate-200 dark:border-slate-700 text-slate-500",
            )}
          >
            {i < steps.length - 1 ? "↓ " : ""}{s}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CampTrainingSimulationBlock() {
  const rounds = [
    { round: 1, accuracy: 50 },
    { round: 2, accuracy: 65 },
    { round: 3, accuracy: 80 },
    { round: 4, accuracy: 95 },
  ]
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % rounds.length), 2000)
    return () => clearInterval(t)
  }, [rounds.length])
  const cur = rounds[idx]
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 text-center">
      <p className="font-semibold text-slate-900 dark:text-white mb-4">Training Simulation</p>
      <p className="text-sm text-slate-500">Round {cur.round}</p>
      <p className="text-4xl font-bold text-violet-600 dark:text-violet-400 mt-2">{cur.accuracy}%</p>
      <p className="text-xs text-slate-500 mt-2">Accuracy improves with practice</p>
      <div className="mt-4 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className="h-full bg-violet-500 transition-all duration-500" style={{ width: `${cur.accuracy}%` }} />
      </div>
    </div>
  )
}

export function CampPredictionFlowBlock() {
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5">
      <p className="font-semibold text-slate-900 dark:text-white mb-4">Making a Prediction</p>
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        {["New Image", "Model", "Prediction", "Dog (97%)"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className="px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/30 font-medium">{s}</span>
            {i < 3 && <ChevronDown className="h-3 w-3 rotate-[-90deg] text-slate-400" />}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CampPredictionChallengeBlock() {
  const samples = ["🐕", "🐈", "🚗", "🌳", "🐕"]
  const labels = ["Dog", "Cat", "Car", "Tree", "Dog"]
  const [revealed, setRevealed] = useState(false)
  const [guess, setGuess] = useState<number | null>(null)
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">Interactive Challenge — Guess, then see AI</p>
      <div className="flex flex-wrap gap-3 justify-center">
        {samples.map((emoji, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setGuess(i)}
            className={cn(
              "size-16 rounded-xl border text-3xl flex items-center justify-center",
              guess === i ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700",
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
      <Button size="sm" variant="outline" disabled={guess == null} onClick={() => setRevealed(true)}>
        Show AI Prediction
      </Button>
      {revealed && guess != null && (
        <p className="text-sm text-center text-emerald-700 dark:text-emerald-300">
          AI prediction: <strong>{labels[guess]}</strong> — high confidence
        </p>
      )}
    </div>
  )
}

export function CampBrainNetworkBlock() {
  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <div className="text-center">
          <div className="size-20 rounded-full bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-3xl mx-auto">🧠</div>
          <p className="text-sm font-medium mt-2">Human Brain</p>
        </div>
        <ChevronDown className="h-6 w-6 rotate-[-90deg] text-violet-500" />
        <div className="text-center">
          <div className="size-20 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-3xl mx-auto">🔗</div>
          <p className="text-sm font-medium mt-2">Artificial Neural Network</p>
        </div>
      </div>
      <CampScaledImage
        src="/summer-camp/shared/brain-network.png"
        alt="Isometric diagram comparing a human brain and artificial neural network"
        aspectClass="aspect-[16/9]"
        className="mt-4"
      />
    </div>
  )
}

export function CampDlApplicationsBlock({ content }: { content: Record<string, unknown> }) {
  const apps = (content.applications as Array<{ title: string; emoji: string }>) ?? []
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {apps.map((app) => (
        <div key={app.title} className="rounded-xl border border-dashboard-v2-border p-3 text-center">
          <div className="h-16 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl mb-2">{app.emoji}</div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{app.title}</p>
        </div>
      ))}
    </div>
  )
}

export function CampProjectArchitectureBlock({ content }: { content: Record<string, unknown> }) {
  const steps = (content.steps as string[]) ?? [
    "Artificial Intelligence",
    "Deep Learning",
    "Computer Vision",
    "Object Detection",
    "Camera",
    "Raspberry Pi",
    "Detected Object",
  ]
  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 sm:p-5">
      <p className="font-semibold text-slate-900 dark:text-white mb-4">{String(content.title ?? "Camp Project Architecture")}</p>
      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step} className="flex flex-col items-center">
            <span className="w-full text-center px-3 py-2 rounded-lg border border-violet-500/30 bg-white/50 dark:bg-slate-900/50 text-sm font-medium">
              {step}
            </span>
            <ChevronDown className="h-4 w-4 text-violet-400 my-0.5 last:hidden" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CampMiniProjectBlock({
  content,
  camperProfile,
  onSaveProfile,
  readOnly,
}: {
  content: Record<string, unknown>
  camperProfile?: Record<string, unknown>
  onSaveProfile?: (
    patch: Record<string, unknown>,
  ) => Promise<void | { ok: boolean; error?: string }>
  readOnly?: boolean
}) {
  const key = String(content.profileKey ?? "miniProjectMl")
  const saved = (camperProfile?.[key] ?? {}) as Record<string, string>
  const [draft, setDraft] = useState({
    problem: saved.problem ?? "",
    dataNeeded: saved.dataNeeded ?? "",
    prediction: saved.prediction ?? "",
    impact: saved.impact ?? "",
  })
  const [saving, setSaving] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  )
  const fields = [
    { key: "problem" as const, label: "Problem" },
    { key: "dataNeeded" as const, label: "Data Needed" },
    { key: "prediction" as const, label: "Prediction" },
    { key: "impact" as const, label: "Impact" },
  ]

  useEffect(() => {
    const profileSaved = (camperProfile?.[key] ?? {}) as Record<string, string>
    setDraft({
      problem: profileSaved.problem ?? "",
      dataNeeded: profileSaved.dataNeeded ?? "",
      prediction: profileSaved.prediction ?? "",
      impact: profileSaved.impact ?? "",
    })
  }, [camperProfile, key])

  const hasContent = fields.some((f) => draft[f.key].trim().length > 0)

  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
      <p className="font-semibold text-slate-900 dark:text-white">{String(content.title ?? "Design Your Own AI System")}</p>
      {fields.map((f) => (
        <Textarea
          key={f.key}
          value={draft[f.key]}
          onChange={(e) => {
            setSaveFeedback(null)
            setDraft((d) => ({ ...d, [f.key]: e.target.value }))
          }}
          placeholder={f.label}
          rows={2}
          disabled={readOnly}
          className="resize-none"
        />
      ))}
      {!readOnly && onSaveProfile && (
        <div className="space-y-2">
          <Button
            size="sm"
            disabled={saving || !hasContent}
            onClick={async () => {
              if (!hasContent) {
                setSaveFeedback({
                  type: "error",
                  message: "Fill in at least one field before saving.",
                })
                return
              }
              setSaving(true)
              setSaveFeedback(null)
              try {
                const result = await onSaveProfile({ [key]: draft })
                if (result && "ok" in result && !result.ok) {
                  setSaveFeedback({
                    type: "error",
                    message: result.error ?? "Could not save. Please try again.",
                  })
                } else {
                  setSaveFeedback({
                    type: "success",
                    message: "Mini project saved to your profile.",
                  })
                }
              } catch {
                setSaveFeedback({
                  type: "error",
                  message: "Could not save. Please try again.",
                })
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? "Saving…" : "Save mini project"}
          </Button>
          {saveFeedback && (
            <p
              className={cn(
                "text-sm",
                saveFeedback.type === "success"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400",
              )}
              role="status"
            >
              {saveFeedback.message}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function CampDataTypesGalleryBlock({ content }: { content: Record<string, unknown> }) {
  const items = (content.items as Array<{ label: string; emoji: string }>) ?? []
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-dashboard-v2-border p-3 text-center">
          <div className="h-14 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">{item.emoji}</div>
          <p className="text-xs font-medium mt-2 text-slate-700 dark:text-slate-300">{item.label}</p>
        </div>
      ))}
    </div>
  )
}

export function CampModuleReflectionBlock({
  content,
  blockProgress,
  onSave,
  onOpenSupport,
  onScrollDiscussion,
  readOnly,
  saving,
}: {
  content: Record<string, unknown>
  blockProgress?: BlockProgressMap
  onSave: (metadata: Record<string, unknown>) => Promise<void>
  onOpenSupport?: () => void
  onScrollDiscussion?: () => void
  readOnly?: boolean
  saving?: boolean
}) {
  const saved = (blockProgress?.feedback ?? {}) as Record<string, unknown>
  const [interesting, setInteresting] = useState(String(saved.interesting ?? saved.primary ?? ""))
  const [secondary, setSecondary] = useState(String(saved.secondary ?? ""))
  const [confidence, setConfidence] = useState<number | null>(
    saved.confidence != null ? Number(saved.confidence) : null,
  )
  const secondaryPrompt = content.secondaryPrompt as string | undefined
  const confusingOptions = (content.confusingOptions as string[]) ?? []
  const benefitOptions = (content.benefitOptions as string[]) ?? []
  const benefitPrompt = content.benefitPrompt as string | undefined
  const confusingPrompt = content.confusingPrompt as string | undefined
  const bootSuccessPrompt = content.bootSuccessPrompt as string | undefined
  const bootSuccessOptions = (content.bootSuccessOptions as string[]) ?? []
  const [confusing, setConfusing] = useState<string[]>(
    Array.isArray(saved.confusing) ? (saved.confusing as string[]) : [],
  )
  const [benefit, setBenefit] = useState<string | null>(
    typeof saved.benefit === "string" ? saved.benefit : null,
  )
  const [bootSuccess, setBootSuccess] = useState<string | null>(
    typeof saved.bootSuccess === "string" ? saved.bootSuccess : null,
  )

  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-4">
      <h3 className="font-semibold text-slate-900 dark:text-white">Reflection & Feedback</h3>
      <div>
        <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
          {String(content.interestingPrompt ?? content.sentencePrompt ?? "What was the most interesting thing you learned?")}
        </p>
        <Textarea
          value={interesting}
          onChange={(e) => setInteresting(e.target.value)}
          rows={3}
          disabled={readOnly}
          className="resize-none"
        />
      </div>
      {secondaryPrompt && (
        <div>
          <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">{secondaryPrompt}</p>
          <Textarea
            value={secondary}
            onChange={(e) => setSecondary(e.target.value)}
            rows={2}
            disabled={readOnly}
            className="resize-none"
          />
        </div>
      )}
      {benefitOptions.length > 0 && (
        <div>
          <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
            {benefitPrompt ?? "Which benefit is most valuable?"}
          </p>
          <div className="flex flex-wrap gap-2">
            {benefitOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                disabled={readOnly}
                onClick={() => setBenefit(opt)}
                className={cn(
                  "px-3 py-1.5 rounded-full border text-sm",
                  benefit === opt ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700",
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
      {bootSuccessOptions.length > 0 && (
        <div>
          <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
            {bootSuccessPrompt ?? "Did your Raspberry Pi boot successfully?"}
          </p>
          <div className="flex gap-2">
            {bootSuccessOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                disabled={readOnly}
                onClick={() => setBootSuccess(opt)}
                className={cn(
                  "px-4 py-2 rounded-lg border text-sm",
                  bootSuccess === opt ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700",
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
      {confusingOptions.length > 0 && (
        <div>
          <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
            {confusingPrompt ?? "What concept is still confusing?"}
          </p>
          <div className="flex flex-wrap gap-2">
            {confusingOptions.map((opt) => {
              const selected = confusing.includes(opt)
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={readOnly}
                  onClick={() =>
                    setConfusing((prev) =>
                      selected ? prev.filter((x) => x !== opt) : [...prev, opt],
                    )
                  }
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-sm",
                    selected ? "border-violet-500 bg-violet-500/15" : "border-slate-200 dark:border-slate-700",
                  )}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div>
        <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
          {String(content.confidenceLabel ?? "How confident do you feel?")}
        </p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={readOnly}
              onClick={() => setConfidence(n)}
              className={cn(
                "size-10 rounded-lg border text-sm font-semibold",
                confidence === n ? "border-violet-500 bg-violet-500 text-white" : "border-slate-200 dark:border-slate-700",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">Did you encounter any difficulties?</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={saved.difficulties === "No" ? "default" : "outline"}
            disabled={readOnly || saving}
            onClick={() =>
              void onSave({ kind: "module_reflection", interesting, confidence, difficulties: "No" })
            }
          >
            No
          </Button>
          <Button
            size="sm"
            variant={saved.difficulties === "Yes" ? "default" : "outline"}
            disabled={readOnly || saving}
            onClick={() => {
              void onSave({ kind: "module_reflection", interesting, confidence, difficulties: "Yes" })
              onOpenSupport?.()
            }}
          >
            Yes
          </Button>
        </div>
      </div>
      {!readOnly && (
        <Button
          size="sm"
          disabled={saving || !interesting.trim() || confidence == null || (bootSuccessOptions.length > 0 && !bootSuccess)}
          onClick={() =>
            void onSave({
              kind: "module_reflection",
              interesting: interesting.trim(),
              primary: interesting.trim(),
              secondary: secondary.trim(),
              confidence,
              confusing,
              benefit,
              bootSuccess,
              difficulties: saved.difficulties,
            })
          }
        >
          {saving ? "Saving…" : "Save reflection"}
        </Button>
      )}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-dashboard-v2-border">
        <Button size="sm" variant="outline" onClick={onScrollDiscussion}>
          Open Discussion Thread
        </Button>
        <Button size="sm" variant="outline" onClick={onOpenSupport}>
          Ask Instructor
        </Button>
        <Button size="sm" variant="outline" disabled title="Coming soon">
          Ask AI Assistant
        </Button>
      </div>
    </div>
  )
}

export function CampRoadmapMapBlock() {
  return (
    <CampLearningJourneyTimeline
      title="Your Mission Journey"
      subtitle="Follow the path from AI fundamentals to your final showcase."
      steps={ROADMAP_STEPS}
      animateHighlight
      activeThrough={0}
    />
  )
}
