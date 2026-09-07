"use client"

import { GuestModulePage } from "@/components/guest/dashboard/GuestModulePage"
import { GuestHelpPage } from "@/components/guest/support/GuestHelpPage"

export default function GuestHelpRoute() {
  return (
    <GuestModulePage bare>
      <GuestHelpPage />
    </GuestModulePage>
  )
}
