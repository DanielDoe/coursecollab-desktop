"use client"

import { GuestCoraCreditsPage } from "@/components/guest/GuestCoraCreditsPage"
import { GuestModulePage } from "@/components/guest/dashboard/GuestModulePage"

export default function Page() {
  return (
    <GuestModulePage>
      <GuestCoraCreditsPage />
    </GuestModulePage>
  )
}
