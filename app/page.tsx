"use client"

import type { ReactNode } from "react"

import { SummerCampLandingSection } from "@/components/summer-camp/SummerCampLandingSection"
import { LandingHero, LandingMarketingHeader } from "@/components/landing/LandingHero"
import { CoraShowcaseSection } from "@/components/landing/CoraShowcaseSection"
import { PlatformShowcaseSection } from "@/components/landing/PlatformShowcaseSection"
import { FeaturesCarousel } from "@/components/landing/FeaturesCarousel"
import { HowItWorksSection } from "@/components/landing/HowItWorksSection"
import { BuiltForSection } from "@/components/landing/BuiltForSection"
import { CareerMembersSection } from "@/components/landing/CareerMembersSection"
import { AboutSection } from "@/components/landing/AboutSection"
import { SolutionsSection } from "@/components/landing/SolutionsSection"
import { PricingSection } from "@/components/landing/PricingSection"
import { LandingFooter } from "@/components/landing/LandingFooter"
import { MobileCtaBar } from "@/components/landing/MobileCtaBar"
import { LandingMotionProvider } from "@/components/landing/LandingMotionProvider"
import { BrandSurfaceChromeSync } from "@/components/brand-surface-chrome-sync"
import { landingPageClass } from "@/components/landing/landing-section-layout"

/**
 * Kept in the DOM for SEO, hidden below `md`.
 *
 * The mobile page keeps only the selling path: hero → Cora → features →
 * solutions → audiences → career → pricing. Everything gated here either
 * repeats imagery already shown above (Platform showcase), is explanatory
 * rather than persuasive (How it works, About), or is seasonal (Summer camp).
 * Their media is lazy-loaded, so a `display:none` wrapper also keeps it off
 * the wire on phones.
 */
function DesktopOnly({ children }: { children: ReactNode }) {
  return <div className="hidden md:block">{children}</div>
}

export default function HomePage() {
  return (
    <LandingMotionProvider>
      <BrandSurfaceChromeSync />
      <div className={landingPageClass}>
        <LandingMarketingHeader />

        <main className="relative">
          <LandingHero />

          <CoraShowcaseSection />

          <FeaturesCarousel />

          <DesktopOnly>
            <PlatformShowcaseSection />
          </DesktopOnly>

          <SolutionsSection />

          <DesktopOnly>
            <HowItWorksSection />
          </DesktopOnly>

          <BuiltForSection />
          <CareerMembersSection />

          <DesktopOnly>
            <SummerCampLandingSection />
            <AboutSection />
          </DesktopOnly>

          <PricingSection />
        </main>

        <LandingFooter />
        <MobileCtaBar />
      </div>
    </LandingMotionProvider>
  )
}
