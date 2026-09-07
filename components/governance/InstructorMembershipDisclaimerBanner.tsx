"use client"

import { useEffect, useState } from "react"
import { MembershipDisclaimer } from "@/components/governance/MembershipDisclaimer"
import {
  dismissInstructorMembershipPolicyBannerPermanently,
  getInstructorIdFromClient,
  readInstructorMembershipPolicyBannerDismissed,
} from "@/lib/instructor-assessment-banner-prefs"

/** Auto-hide + permanently dismiss so it does not reappear on other modules. */
const AUTO_DISMISS_MS = 12_000

export function InstructorMembershipDisclaimerBanner({
  className,
}: {
  className?: string
}) {
  const [visible, setVisible] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const instructorId = getInstructorIdFromClient()
    setVisible(!readInstructorMembershipPolicyBannerDismissed(instructorId))
    setReady(true)
  }, [])

  const handleDismiss = () => {
    dismissInstructorMembershipPolicyBannerPermanently()
    setVisible(false)
  }

  useEffect(() => {
    if (!ready || !visible) return
    const timer = window.setTimeout(() => {
      dismissInstructorMembershipPolicyBannerPermanently()
      setVisible(false)
    }, AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [ready, visible])

  if (!ready || !visible) return null

  return (
    <MembershipDisclaimer variant="instructor" className={className} onDismiss={handleDismiss} />
  )
}
