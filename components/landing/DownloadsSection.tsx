"use client"

import * as React from "react"
import Link from "next/link"
import {
  Apple,
  Download,
  Laptop,
  Monitor,
  Smartphone,
  Sparkles,
  Clock,
  ChevronDown,
  CheckCircle2,
} from "lucide-react"
import { motion } from "@/components/landing/framer"
import { useLandingMotionEnabled } from "@/components/landing/LandingMotionProvider"
import {
  landingSectionClass,
  landingSectionInnerClass,
  landingSectionHeaderClass,
  landingEyebrowClass,
  landingSectionTitleClass,
  landingSectionDescClass,
  landingCardClass,
  landingPrimaryButtonClass,
  landingSecondaryButtonClass,
} from "@/components/landing/landing-section-layout"
import {
  fadeUp,
  LANDING_VIEWPORT,
  sectionHeader,
  staggerContainer,
} from "@/components/landing/landing-motion"
import {
  DESKTOP_APP_VERSION,
  DESKTOP_DOWNLOADS,
  MOBILE_APPS,
  detectClientPlatformAsync,
  getDesktopDownload,
  type DesktopDownload,
  type DetectedPlatform,
} from "@/lib/desktop-downloads"

function PlatformIcon({ os }: { os: DesktopDownload["os"] }) {
  if (os === "mac") return <Apple className="h-5 w-5" aria-hidden />
  if (os === "windows") return <Monitor className="h-5 w-5" aria-hidden />
  return <Laptop className="h-5 w-5" aria-hidden />
}

function DownloadCard({
  download,
  highlighted,
}: {
  download: DesktopDownload
  highlighted?: boolean
}) {
  return (
    <a
      href={download.url}
      download={download.filename}
      className={`group flex flex-col rounded-[1.35rem] border p-4 transition-all duration-200 sm:p-5 ${
        highlighted
          ? "border-[var(--cc-accent)] bg-[color-mix(in_srgb,var(--cc-accent)_8%,var(--cc-surface))] shadow-[0_12px_40px_-16px_rgba(79,45,127,0.45)] ring-2 ring-[var(--cc-accent)]/20"
          : `${landingCardClass} hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-18px_rgba(79,45,127,0.25)]`
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]">
          <PlatformIcon os={download.os} />
        </div>
        {highlighted ? (
          <span className="rounded-full bg-[var(--cc-brand-gold)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--cc-accent-dark)]">
            Recommended
          </span>
        ) : (
          <span className="rounded-full border border-[var(--border)] bg-[var(--cc-background)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-text-secondary)]">
            {download.format}
          </span>
        )}
      </div>
      <p className="text-base font-bold text-[var(--cc-text)]">{download.label}</p>
      <p className="mt-0.5 text-sm text-[var(--cc-text-secondary)]">{download.subtitle}</p>
      {download.sizeLabel ? (
        <p className="mt-2 text-xs text-[var(--cc-text-secondary)]/80">{download.sizeLabel}</p>
      ) : null}
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--cc-accent)] group-hover:gap-2.5 transition-all">
        Download
        <Download className="h-4 w-4" />
      </span>
    </a>
  )
}

function MobileComingSoonCard({
  label,
  subtitle,
}: {
  label: string
  subtitle: string
}) {
  return (
    <div
      className={`${landingCardClass} relative flex flex-col overflow-hidden p-4 sm:p-5 opacity-90`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--cc-accent)_4%,transparent),transparent_55%)]" />
      <div className="relative">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]">
            <Smartphone className="h-5 w-5" aria-hidden />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--cc-background)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-text-secondary)]">
            <Clock className="h-3 w-3" />
            Coming soon
          </span>
        </div>
        <p className="text-base font-bold text-[var(--cc-text)]">{label}</p>
        <p className="mt-0.5 text-sm text-[var(--cc-text-secondary)]">{subtitle}</p>
        <p className="mt-4 text-xs leading-relaxed text-[var(--cc-text-secondary)]">
          Native Android is still in testing. Use the web app on your phone today — or grab iOS / desktop below.
        </p>
      </div>
    </div>
  )
}

function MobileStoreCard({
  label,
  subtitle,
  url,
  storeLabel,
  highlighted,
}: {
  label: string
  subtitle: string
  url: string
  storeLabel: string
  highlighted?: boolean
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex flex-col rounded-[1.35rem] border p-4 transition-all duration-200 sm:p-5 ${
        highlighted
          ? "border-[var(--cc-accent)] bg-[color-mix(in_srgb,var(--cc-accent)_8%,var(--cc-surface))] shadow-[0_12px_40px_-16px_rgba(79,45,127,0.45)] ring-2 ring-[var(--cc-accent)]/20"
          : `${landingCardClass} hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-18px_rgba(79,45,127,0.25)]`
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]">
          <Smartphone className="h-5 w-5" aria-hidden />
        </div>
        <span className="rounded-full border border-[var(--border)] bg-[var(--cc-background)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-text-secondary)]">
          {storeLabel}
        </span>
      </div>
      <p className="text-base font-bold text-[var(--cc-text)]">{label}</p>
      <p className="mt-0.5 text-sm text-[var(--cc-text-secondary)]">{subtitle}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--cc-accent)] group-hover:gap-2.5 transition-all">
        Get on the App Store
        <Download className="h-4 w-4" />
      </span>
    </a>
  )
}

function RecommendedHero({
  platform,
  recommended,
}: {
  platform: DetectedPlatform
  recommended: DesktopDownload | null
}) {
  if (platform.mobile) {
    const mobile = MOBILE_APPS.find((m) => m.id === platform.mobile)
    if (mobile?.status === "available" && mobile.url) {
      return (
        <div className="relative overflow-hidden rounded-[1.75rem] border border-[var(--cc-accent)]/30 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--cc-accent)_12%,var(--cc-surface)),var(--cc-surface)_60%)] p-6 shadow-[0_20px_60px_-24px_rgba(79,45,127,0.4)] sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[var(--cc-brand-gold)]/15 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--cc-accent)] px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Best match for {platform.label}
              </p>
              <h3 className="text-xl font-extrabold tracking-tight text-[var(--cc-text)] sm:text-2xl">
                CourseCollab Mobile is on the App Store
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--cc-text-secondary)] sm:text-base">
                {mobile.subtitle}. Free for iPhone and iPad — courses, quizzes, and Cora AI tutor on the go.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
              <a
                href={mobile.url}
                target="_blank"
                rel="noopener noreferrer"
                className={landingPrimaryButtonClass}
              >
                <Apple className="h-4 w-4" />
                Get on the App Store
              </a>
              <a href="#desktop-downloads" className={landingSecondaryButtonClass}>
                <ChevronDown className="h-4 w-4" />
                Desktop downloads
              </a>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="relative overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[var(--cc-surface)] p-6 shadow-[0_20px_60px_-24px_rgba(79,45,127,0.35)] sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--cc-accent-soft)] blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--cc-accent-soft)] px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--cc-accent)]">
              <Sparkles className="h-3.5 w-3.5" />
              Detected: {platform.label}
            </p>
            <h3 className="text-xl font-extrabold tracking-tight text-[var(--cc-text)] sm:text-2xl">
              {mobile?.label} app coming soon
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--cc-text-secondary)] sm:text-base">
              CourseCollab works great in your mobile browser today. For CodeBench, offline-friendly workflows, and desktop notifications, grab our desktop app below — or get iOS from the App Store.
            </p>
          </div>
          <a href="#desktop-downloads" className={landingSecondaryButtonClass}>
            <ChevronDown className="h-4 w-4" />
            See desktop downloads
          </a>
        </div>
      </div>
    )
  }

  if (!recommended) return null

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-[var(--cc-accent)]/30 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--cc-accent)_12%,var(--cc-surface)),var(--cc-surface)_60%)] p-6 shadow-[0_20px_60px_-24px_rgba(79,45,127,0.4)] sm:p-8">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[var(--cc-brand-gold)]/15 blur-3xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--cc-accent)] px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Best match for {platform.label}
          </p>
          <h3 className="text-xl font-extrabold tracking-tight text-[var(--cc-text)] sm:text-2xl">
            CourseCollab Desktop v{DESKTOP_APP_VERSION}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--cc-text-secondary)] sm:text-base">
            {recommended.subtitle} · {recommended.format}
            {recommended.sizeLabel ? ` · ${recommended.sizeLabel}` : ""}. Same account, Cora, Practice Hub, and CodeBench — packaged for your machine with auto-updates.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
          <a href={recommended.url} download={recommended.filename} className={landingPrimaryButtonClass}>
            <Download className="h-4 w-4" />
            Download for {platform.label}
          </a>
          <a href="#all-downloads" className={landingSecondaryButtonClass}>
            Other platforms
          </a>
        </div>
      </div>
    </div>
  )
}

export function DownloadsSection() {
  const effectsEnabled = useLandingMotionEnabled()
  const inView = effectsEnabled
    ? ({ initial: "hidden" as const, whileInView: "show" as const, viewport: LANDING_VIEWPORT })
    : ({ initial: false as const })

  const [platform, setPlatform] = React.useState<DetectedPlatform | null>(null)

  React.useEffect(() => {
    let cancelled = false
    detectClientPlatformAsync().then((result) => {
      if (!cancelled) setPlatform(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const recommended =
    platform?.recommendedDownloadId != null
      ? getDesktopDownload(platform.recommendedDownloadId) ?? null
      : null

  return (
    <section id="downloads" className={landingSectionClass}>
      <div className={`${landingSectionInnerClass} max-w-[1100px]`}>
        <motion.div className={landingSectionHeaderClass} variants={sectionHeader} {...inView}>
          <span className={landingEyebrowClass}>
            <Download className="h-3.5 w-3.5" aria-hidden />
            Download
          </span>
          <h2 className={landingSectionTitleClass}>
            Take CourseCollab{" "}
            <span className="text-[var(--cc-accent)]">everywhere</span>
          </h2>
          <p className={landingSectionDescClass}>
            Install the desktop app for CodeBench, faster workflows, and native notifications.
            We detect your platform and recommend the right build — iOS is on the App Store; Android is on the way.
          </p>
        </motion.div>

        <motion.div className="mb-8 sm:mb-10" variants={fadeUp} {...inView}>
          {platform ? (
            <RecommendedHero platform={platform} recommended={recommended} />
          ) : (
            <div className="h-36 animate-pulse rounded-[1.75rem] bg-[var(--cc-accent-soft)]/40" aria-hidden />
          )}
        </motion.div>

        <motion.div variants={staggerContainer} {...inView}>
          <div id="desktop-downloads" className="mb-3 flex items-end justify-between gap-3 scroll-mt-24">
            <div>
              <h3 className="text-lg font-bold text-[var(--cc-text)] sm:text-xl">Desktop</h3>
              <p className="text-sm text-[var(--cc-text-secondary)]">
                Version {DESKTOP_APP_VERSION} · macOS, Windows & Linux
              </p>
            </div>
          </div>

          <div
            id="all-downloads"
            className="mb-10 grid grid-cols-1 gap-3 scroll-mt-24 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4"
          >
            {DESKTOP_DOWNLOADS.map((download) => (
              <motion.div key={download.id} variants={fadeUp}>
                <DownloadCard
                  download={download}
                  highlighted={platform?.recommendedDownloadId === download.id}
                />
              </motion.div>
            ))}
          </div>

          <div className="mb-3">
            <h3 className="text-lg font-bold text-[var(--cc-text)] sm:text-xl">Mobile</h3>
            <p className="text-sm text-[var(--cc-text-secondary)]">
              iOS is live on the App Store — Android launching soon
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {MOBILE_APPS.map((app) => (
              <motion.div key={app.id} variants={fadeUp}>
                {app.status === "available" && app.url ? (
                  <MobileStoreCard
                    label={app.label}
                    subtitle={app.subtitle}
                    url={app.url}
                    storeLabel={app.storeLabel ?? "App Store"}
                    highlighted={platform?.mobile === app.id}
                  />
                ) : (
                  <MobileComingSoonCard label={app.label} subtitle={app.subtitle} />
                )}
              </motion.div>
            ))}
          </div>

          <motion.p
            variants={fadeUp}
            className="mt-8 text-center text-xs leading-relaxed text-[var(--cc-text-secondary)] sm:text-sm"
          >
            Need help installing?{" "}
            <Link href="/student/login" className="font-semibold text-[var(--cc-accent)] hover:underline">
              Sign in on the web
            </Link>{" "}
            or email{" "}
            <a href="mailto:support@coursecollab.com" className="font-semibold text-[var(--cc-accent)] hover:underline">
              support@coursecollab.com
            </a>
            .
          </motion.p>
        </motion.div>
      </div>
    </section>
  )
}
