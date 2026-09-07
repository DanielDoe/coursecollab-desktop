"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { Mail, CalendarCheck, ArrowUpRight } from "lucide-react"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import { LANDING_CONTACT_EMAIL, landingMailto } from "@/components/landing/landing-contact"
import { landingFooterClass, landingHashHref, landingShellClass } from "@/components/landing/landing-section-layout"
import { usePathname } from "next/navigation"

/** `desktopOnly` links target sections hidden below `md` (see app/page.tsx). */
const PRODUCT_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Solutions", href: "#solutions" },
  { label: "Institutions", href: "/institutions" },
  { label: "Pricing", href: "#pricing" },
  { label: "About", href: "#about", desktopOnly: true },
] as const

const RESOURCE_LINKS = [
  { label: "How it works", href: "#how-it-works", desktopOnly: true },
  { label: "Built for you", href: "/institutions/briefing" },
  { label: "Cora", href: "#cora" },
  { label: "Career", href: "#career" },
  { label: "Summer camp", href: "#summer-camp", desktopOnly: true },
] as const

const ACCESS_LINKS = [
  { label: "Sign in", href: "/student/login" },
  { label: "Faculty login", href: "/faculty/login" },
  { label: "Institution admin", href: "/institution/login" },
  { label: "Administrator", href: "/admin/login" },
] as const

function FooterLink({
  href,
  label,
  external,
}: {
  href: string
  label: string
  external?: boolean
}) {
  const pathname = usePathname()
  const resolved = landingHashHref(pathname, href)
  const isAnchor = resolved.startsWith("#")
  const className =
    "inline-flex min-h-[36px] items-center gap-1 text-sm text-violet-100/85 transition-colors hover:text-white"

  if (isAnchor) {
    return (
      <a href={resolved} className={className}>
        {label}
      </a>
    )
  }

  return (
    <Link href={resolved} className={className}>
      {label}
      {external ? <ArrowUpRight className="h-3.5 w-3.5 opacity-70" /> : null}
    </Link>
  )
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#F6D56A]">{title}</p>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  )
}

export function LandingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className={landingFooterClass}>
      {/* Extra bottom padding on phones keeps the fixed CTA bar off the last row of links. */}
      <div className={`${landingShellClass} pb-28 pt-12 md:py-16`}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="col-span-2 lg:col-span-4">
            <CourseCollabLogo
              size="md"
              withWordmark
              frameClassName="border-white/25"
              className="[&>span:last-child]:text-white"
            />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-violet-100/80">
              <span className="md:hidden">Engineering education — AI tutoring, assessments &amp; more.</span>
              <span className="hidden md:inline">
                The all-in-one platform for modern engineering education — AI tutoring,
                assessments, CodeBench, and analytics in one place.
              </span>
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap">
              <Link
                href="/institutions/request-demo"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--cc-accent)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <CalendarCheck className="h-4 w-4" />
                Book a demo
              </Link>
              <Link
                href="/institutions/request-quote"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/15"
              >
                Institution packages
              </Link>
            </div>
          </div>

          <div className="lg:col-span-2">
            <FooterColumn title="Product">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href} className={"desktopOnly" in link ? "hidden md:block" : undefined}>
                  <FooterLink href={link.href} label={link.label} />
                </li>
              ))}
            </FooterColumn>
          </div>

          <div className="lg:col-span-2">
            <FooterColumn title="Resources">
              {RESOURCE_LINKS.map((link) => (
                <li key={link.href} className={"desktopOnly" in link ? "hidden md:block" : undefined}>
                  <FooterLink href={link.href} label={link.label} />
                </li>
              ))}
            </FooterColumn>
          </div>

          <div className="lg:col-span-2">
            <FooterColumn title="Sign in">
              {ACCESS_LINKS.map((link) => (
                <li key={link.href}>
                  <FooterLink href={link.href} label={link.label} external={link.href.startsWith("/")} />
                </li>
              ))}
            </FooterColumn>
          </div>

          <div className="col-span-2 lg:col-span-2">
            <FooterColumn title="Contact">
              <li>
                <a
                  href={`mailto:${LANDING_CONTACT_EMAIL}`}
                  className="inline-flex items-start gap-2.5 text-sm text-violet-100/85 transition-colors hover:text-white"
                >
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#F6D56A]" />
                  <span>
                    {LANDING_CONTACT_EMAIL}
                    <span className="mt-0.5 block text-xs text-violet-200/60">
                      Support, pricing & demo requests
                    </span>
                  </span>
                </a>
              </li>
              <li>
                <a
                  href={landingMailto("CourseCollab General Inquiry")}
                  className="inline-flex min-h-[36px] items-center text-sm text-violet-100/85 transition-colors hover:text-white"
                >
                  Send us a message
                </a>
              </li>
            </FooterColumn>
          </div>
        </div>

        <div className="mt-10 border-t border-white/15 pt-6 sm:mt-12 sm:pt-8">
          <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <p className="text-xs text-violet-200/70 sm:text-sm">
              © {year} CourseCollab. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs sm:text-sm">
              <Link
                href="/privacy"
                className="inline-flex min-h-[36px] items-center px-2 text-violet-100/75 transition-colors hover:text-white"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="inline-flex min-h-[36px] items-center px-2 text-violet-100/75 transition-colors hover:text-white"
              >
                Terms
              </Link>
              <Link
                href="/admin/login"
                className="inline-flex min-h-[36px] items-center px-2 text-violet-100/75 transition-colors hover:text-white"
              >
                Administrator access
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
