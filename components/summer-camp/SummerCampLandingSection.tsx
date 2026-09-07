"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { LandingVideo } from "@/components/landing/LandingVideo"
import { motion } from "@/components/landing/framer"
import {
  Sun,
  Calendar,
  Users,
  ChevronRight,
  ChevronLeft,
  Cpu,
  Sparkles,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  landingSectionClass,
  landingSectionInnerClass,
} from "@/components/landing/landing-section-layout"
import { LANDING_VIEWPORT, scalePop } from "@/components/landing/landing-motion"

interface CampTraining {
  id: number
  slug: string
  title: string
  description: string | null
  status: string
}

interface CampPublic {
  id: number
  slug: string
  title: string
  description: string | null
  start_date: string | null
  end_date: string | null
  status: string
  trainings: CampTraining[]
  enrollment_count: number
}

type DisplayTrack = {
  key: string
  title: string
  description: string
  upcoming: boolean
}

/** Teaser tracks shown alongside published API tracks */
const UPCOMING_TRACK_TEASERS: DisplayTrack[] = [
  {
    key: "embedded-systems",
    title: "Embedded Systems",
    description: "Microcontrollers, sensors, and real-time firmware — from breadboard to production-ready builds.",
    upcoming: true,
  },
  {
    key: "robotics-iot",
    title: "Robotics & IoT",
    description: "Connect motors, cameras, and cloud dashboards. Build autonomous robots and smart devices.",
    upcoming: true,
  },
  {
    key: "cpp-firmware",
    title: "C++ for Firmware",
    description: "Low-level programming, memory management, and performance tuning for embedded platforms.",
    upcoming: true,
  },
]

function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return "Dates TBA"
  const fmt = (d: string) => {
    const normalized = d.includes("T") ? d : `${d}T12:00:00`
    const parsed = new Date(normalized)
    if (Number.isNaN(parsed.getTime())) return d
    return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  return start ? `Starts ${fmt(start)}` : `Ends ${fmt(end!)}`
}

function statusLabel(status: string) {
  if (status === "active") return { text: "Registration Open", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" }
  if (status === "published") return { text: "Coming Soon", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300" }
  return { text: status, color: "bg-slate-500/15 text-slate-600" }
}

function buildDisplayTracks(trainings: CampTraining[]): DisplayTrack[] {
  const fromApi: DisplayTrack[] = trainings.map((t) => ({
    key: `api-${t.id}`,
    title: t.title,
    description: t.description ?? "",
    upcoming: false,
  }))

  const apiSlugs = new Set(trainings.map((t) => t.slug))
  const teasers = UPCOMING_TRACK_TEASERS.filter(
    (t) => !apiSlugs.has(t.key) && !fromApi.some((a) => a.title.toLowerCase() === t.title.toLowerCase())
  )

  return [...fromApi, ...teasers]
}

function TrainingTracksCarousel({ tracks }: { tracks: DisplayTrack[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = () => {
    const el = scrollerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    updateScrollState()
    const el = scrollerRef.current
    if (!el) return
    el.addEventListener("scroll", updateScrollState, { passive: true })
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", updateScrollState)
      ro.disconnect()
    }
  }, [tracks])

  const scrollBy = (dir: "left" | "right") => {
    scrollerRef.current?.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" })
  }

  if (tracks.length === 0) return null

  return (
    <div className="min-w-0 w-full">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
          <Cpu className="h-4 w-4 shrink-0" />
          Training Tracks
        </h3>
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => scrollBy("left")}
            disabled={!canScrollLeft}
            className="p-1.5 rounded-lg border border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            aria-label="Scroll tracks left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy("right")}
            disabled={!canScrollRight}
            className="p-1.5 rounded-lg border border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            aria-label="Scroll tracks right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative min-w-0">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-6 z-10 bg-gradient-to-r from-white/95 dark:from-slate-900/95 to-transparent opacity-0 transition-opacity"
          style={{ opacity: canScrollLeft ? 1 : 0 }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-8 z-10 bg-gradient-to-l from-white/95 dark:from-slate-900/95 to-transparent opacity-0 transition-opacity"
          style={{ opacity: canScrollRight ? 1 : 0 }}
        />

        <div
          ref={scrollerRef}
          className="flex gap-3 overflow-x-auto overflow-y-hidden pb-1 snap-x snap-mandatory scroll-smooth [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.4)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/80 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600/80"
        >
          {tracks.map((track, index) => (
            <motion.div
              key={track.key}
              initial={{ opacity: 0, x: 24, scale: 0.95 }}
              whileInView={{ opacity: 1, x: 0, scale: 1 }}
              whileHover={{ y: -4, scale: 1.02 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: 0.4, delay: index * 0.07 }}
              className={cn(
                "snap-start shrink-0 w-[min(100%,260px)] sm:w-[272px] rounded-xl border p-4 flex flex-col",
                track.upcoming
                  ? "border-dashed border-slate-300/80 dark:border-white/15 bg-slate-50/60 dark:bg-white/[0.02]"
                  : "border-slate-200/70 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03]"
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-semibold leading-snug text-[var(--cc-text)]">{track.title}</p>
                {track.upcoming ? (
                  <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 h-5 border-amber-300/60 text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/20">
                    <Clock className="h-2.5 w-2.5 mr-0.5" />
                    Upcoming
                  </Badge>
                ) : (
                  <Badge className="shrink-0 text-[10px] px-1.5 py-0 h-5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0">
                    Open
                  </Badge>
                )}
              </div>
              {track.description && (
                <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-[var(--cc-text-secondary)] sm:text-sm">
                  {track.description}
                </p>
              )}
            </motion.div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-500 sm:hidden">Swipe to browse tracks →</p>
      </div>
    </div>
  )
}

export function SummerCampLandingSection() {
  const [camp, setCamp] = useState<CampPublic | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/summer-camp/public")
      .then((r) => r.json())
      .then((data) => {
        const featured = (data.camps as CampPublic[])?.find((c) => c.slug === "summer-camp-2026") ?? data.camps?.[0]
        setCamp(featured ?? null)
      })
      .catch(() => setCamp(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <section className="relative overflow-hidden py-16 sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-white/70" />
        <div className="container relative z-10 mx-auto animate-pulse px-4 sm:px-6">
          <div className="h-64 rounded-3xl bg-white/60" />
        </div>
      </section>
    )
  }

  if (!camp) return null

  const status = statusLabel(camp.status)
  const displayTracks = buildDisplayTracks(camp.trainings)

  return (
    <section id="summer-camp" className={landingSectionClass}>

      <div className={landingSectionInnerClass}>
        <motion.div
          variants={scalePop}
          initial="hidden"
          whileInView="show"
          viewport={LANDING_VIEWPORT}
          className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--cc-surface)] shadow-[0_24px_60px_-32px_color-mix(in_srgb,var(--cc-accent)_45%,transparent)] sm:rounded-3xl"
        >
          <div className="relative aspect-[2/1] overflow-hidden sm:aspect-[3/1]">
            <LandingVideo src="summer-camp" className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#3d1f5c]/25 via-transparent to-transparent" />
          </div>
          <div className="p-4 sm:p-8 md:p-10 lg:p-12">
            <div className="flex flex-col lg:flex-row lg:items-stretch lg:gap-10 xl:gap-12">
              {/* Main column — tracks scroll stays inside here only */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--cc-warning)_16%,transparent)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--cc-warning)]">
                    <Sun className="h-3.5 w-3.5" />
                    Summer Program
                  </span>
                  <Badge className={status.color}>{status.text}</Badge>
                </div>

                <h2 className="mb-3 text-xl font-bold text-[var(--cc-text)] sm:text-3xl md:text-4xl">
                  {camp.title}
                </h2>
                <p className="mb-4 line-clamp-3 text-sm text-[var(--cc-text-secondary)] sm:mb-6 sm:line-clamp-none sm:text-lg">
                  {camp.description}
                </p>

                <div className="mb-4 flex flex-wrap gap-3 sm:mb-8 sm:gap-4">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--cc-surface)] px-3 py-1.5 text-sm text-[var(--cc-text-secondary)]">
                    <Calendar className="h-4 w-4 shrink-0 text-[var(--cc-accent)]" />
                    {formatDateRange(camp.start_date, camp.end_date)}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--cc-surface)] px-3 py-1.5 text-sm text-[var(--cc-text-secondary)]">
                    <Users className="h-4 w-4 shrink-0 text-[var(--cc-accent)]" />
                    {camp.enrollment_count} enrolled
                  </span>
                </div>

                <div className="mt-auto min-w-0 pt-2">
                  <p className="mb-3 text-sm font-semibold text-[var(--cc-text-secondary)] md:hidden">
                    {displayTracks.length} training track{displayTracks.length === 1 ? "" : "s"}
                  </p>
                  <div className="hidden md:block">
                    <TrainingTracksCarousel tracks={displayTracks} />
                  </div>
                </div>
              </div>

              {/* CTA — pinned to bottom on desktop */}
              <div className="w-full lg:w-[252px] xl:w-[268px] shrink-0 flex flex-col justify-end mt-8 lg:mt-0">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--cc-accent-soft)] p-5">
                  <p className="mb-1 text-sm font-semibold text-[var(--cc-text)]">Ready to join?</p>
                  <p className="mb-4 text-xs leading-relaxed text-[var(--cc-text-secondary)]">
                    Enroll for Summer Camp or sign in if you&apos;re already a camper.
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button
                      asChild
                      className="h-10 w-full rounded-xl bg-[var(--cc-accent)] px-3 text-sm font-semibold text-white shadow-md hover:bg-[var(--cc-accent-hover)] sm:h-11"
                    >
                      <Link
                        href="/student/login/summer-camp"
                        className="inline-flex items-center justify-center gap-2 w-full"
                      >
                        <Sparkles className="h-4 w-4 shrink-0" />
                        <span className="truncate">Enroll as Camper</span>
                        <ChevronRight className="h-4 w-4 shrink-0 opacity-80" />
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="w-full h-10 sm:h-11 rounded-xl text-sm font-medium px-3"
                    >
                      <Link href="/student/login/summer-camp" className="inline-flex items-center justify-center w-full">
                        Camper Login
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
