"use client"

import { GuestOnboardingExperience } from "@/components/guest/onboarding/GuestOnboardingExperience"
import { DesktopAuthPanel, DesktopAuthPanelBody, DesktopAuthPanelCard } from "@/components/auth/desktop-auth-primitives"
import { DesktopAuthShell } from "@/components/auth/DesktopAuthShell"

export default function StudentGuestAccessPage() {
  return (
    <DesktopAuthShell sidebarTagline="Sign in to your career workspace. Create a new account on the web app.">
      <DesktopAuthPanel>
        <DesktopAuthPanelBody>
          <DesktopAuthPanelCard>
            <GuestOnboardingExperience variant="desktop" backHref="/auth/welcome" />
          </DesktopAuthPanelCard>
        </DesktopAuthPanelBody>
      </DesktopAuthPanel>
    </DesktopAuthShell>
  )
}
