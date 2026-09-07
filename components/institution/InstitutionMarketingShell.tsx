"use client"

import type { ReactNode } from "react"
import { BrandSurfaceChromeSync } from "@/components/brand-surface-chrome-sync"
import { LandingFooter } from "@/components/landing/LandingFooter"
import { LandingMarketingHeader } from "@/components/landing/LandingHero"
import { LandingMotionProvider } from "@/components/landing/LandingMotionProvider"
import { landingPageClass } from "@/components/landing/landing-section-layout"

export function InstitutionMarketingShell({ children }: { children: ReactNode }) {
  return (
    <LandingMotionProvider>
      <BrandSurfaceChromeSync />
      <div className={landingPageClass}>
        <LandingMarketingHeader />
        <main className="relative pt-16 sm:pt-[4.25rem]">{children}</main>
        <LandingFooter />
      </div>
    </LandingMotionProvider>
  )
}
