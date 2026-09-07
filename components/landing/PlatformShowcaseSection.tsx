"use client"

import * as React from "react"
import { useScroll, useTransform } from "framer-motion"
import { Laptop, MonitorSmartphone, Smartphone, Tablet } from "lucide-react"

import { LaptopFrame, TabletFrame } from "@/components/landing/device-frames"
import { motion } from "@/components/landing/framer"
import { useLandingMotionEnabled } from "@/components/landing/LandingMotionProvider"
import {
  landingSectionClass,
  landingSectionInnerClass,
  landingSectionHeaderClass,
  landingEyebrowClass,
  landingSectionTitleClass,
  landingSectionDescClass,
} from "@/components/landing/landing-section-layout"
import {
  fadeUp,
  LANDING_VIEWPORT,
  sectionHeader,
  staggerContainer,
} from "@/components/landing/landing-motion"

/** Container-scroll effect: laptop tilts back in 3D and flattens as it scrolls into view. */
function ScrollTiltLaptop({ children }: { children: React.ReactNode }) {
  const effectsEnabled = useLandingMotionEnabled()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 95%", "center 55%"],
  })
  const rotateX = useTransform(scrollYProgress, [0, 1], [24, 0])
  const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1])
  const translateY = useTransform(scrollYProgress, [0, 1], [56, 0])

  return (
    <div ref={containerRef} style={effectsEnabled ? { perspective: "1400px" } : undefined}>
      {effectsEnabled ? (
        <motion.div style={{ rotateX, scale, y: translateY, transformStyle: "preserve-3d" }}>
          {children}
        </motion.div>
      ) : (
        children
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const SHOWCASE_CHIPS = [
  { icon: Laptop, label: "Full web platform" },
  { icon: Tablet, label: "Tablet-ready workspaces" },
  { icon: Smartphone, label: "iOS mobile app" },
] as const

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export function PlatformShowcaseSection() {
  const effectsEnabled = useLandingMotionEnabled()
  const inView = effectsEnabled
    ? ({ initial: "hidden" as const, whileInView: "show" as const, viewport: LANDING_VIEWPORT })
    : ({ initial: false as const })

  return (
    <section id="platform" className={landingSectionClass}>
      <div className={landingSectionInnerClass}>
        <motion.div className={landingSectionHeaderClass} variants={sectionHeader} {...inView}>
          <div className={`${landingEyebrowClass} hidden sm:mb-4 sm:inline-flex`}>
            <MonitorSmartphone className="h-3.5 w-3.5" aria-hidden />
            SEE IT IN ACTION
          </div>
          <h2 className={landingSectionTitleClass}>
            Real tasks, running on{" "}
            <span className="text-[var(--cc-accent)]">every device</span>
          </h2>
          <p className={`${landingSectionDescClass} max-w-2xl`}>
            <span className="sm:hidden">Live captures from the actual product — web and mobile.</span>
            <span className="hidden sm:inline">
              These aren&apos;t mockups — they&apos;re live captures of Cora executing real work
              in CourseCollab: building flashcard decks, drafting announcements, and walking
              through code.
            </span>
          </p>
        </motion.div>

        {/* Hero laptop — Cora Assistant executing a task on the web */}
        <div className="mx-auto max-w-3xl">
          <ScrollTiltLaptop>
            <LaptopFrame
              shot={{
                src: "/images/landing/web/web-cora-assistant.png",
                alt: "Cora Assistant on the web creating and saving a flashcard deck with a preview-first confirmation card",
                width: 1600,
                height: 1000,
              }}
            />
          </ScrollTiltLaptop>
          <motion.p
            variants={fadeUp}
            {...inView}
            className="mt-5 text-center text-sm font-medium text-[var(--cc-text-secondary)]"
          >
            <span className="font-bold text-[var(--cc-accent)]">Cora Assistant</span> — one ask,
            a five-card deck proposed with a confirmation card before anything saves.
          </motion.p>
        </div>

        {/* Tablet pair — Copilot draft + CodeBench walkthrough */}
        <motion.div
          variants={staggerContainer}
          {...inView}
          className="mt-12 grid gap-8 sm:mt-16 md:grid-cols-2 md:gap-6 lg:gap-10"
        >
          <motion.div variants={fadeUp}>
            <TabletFrame
              shot={{
                src: "/images/landing/web/web-cora-copilot.png",
                alt: "Cora Copilot drafting a weekly course announcement with a publish confirmation card",
                width: 1200,
                height: 750,
              }}
            />
            <p className="mt-4 text-center text-sm font-medium text-[var(--cc-text-secondary)]">
              <span className="font-bold text-[var(--cc-accent-dark)]">Cora Copilot</span> — a weekly
              announcement drafted and held for one-tap publish approval.
            </p>
          </motion.div>
          <motion.div variants={fadeUp}>
            <TabletFrame
              shot={{
                src: "/images/landing/web/web-codebench-python.png",
                alt: "CodeBench IDE running Python with Cora explaining the code step by step",
                width: 1200,
                height: 750,
              }}
            />
            <p className="mt-4 text-center text-sm font-medium text-[var(--cc-text-secondary)]">
              <span className="font-bold text-[var(--cc-accent)]">CodeBench IDE</span> — Python in
              the browser with Cora&apos;s line-by-line walkthrough.
            </p>
          </motion.div>
        </motion.div>

        {/* Platform chips */}
        <motion.div
          variants={fadeUp}
          {...inView}
          className="mt-10 flex flex-wrap items-center justify-center gap-2.5 sm:mt-14 sm:gap-3"
        >
          {SHOWCASE_CHIPS.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--cc-surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--cc-text-secondary)] sm:text-sm"
            >
              <Icon className="h-3.5 w-3.5 text-[var(--cc-accent)]" aria-hidden />
              {label}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
