"use client"

import { GuestModulePage } from "@/components/guest/dashboard/GuestModulePage"
import { GuestFeatureRequestsPage } from "@/components/guest/support/GuestFeatureRequestsPage"

export default function GuestFeatureRequestsRoute() {
  return (
    <GuestModulePage bare>
      <GuestFeatureRequestsPage />
    </GuestModulePage>
  )
}
