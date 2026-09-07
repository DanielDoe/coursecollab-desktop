"use client"

import { GuestModulePage } from "@/components/guest/dashboard/GuestModulePage"
import { GuestSettingsHub } from "@/components/guest/GuestSettingsHub"

export default function GuestSettingsPage() {
  return (
    <GuestModulePage bodyClassName="p-4 sm:p-5">
      <GuestSettingsHub />
    </GuestModulePage>
  )
}
