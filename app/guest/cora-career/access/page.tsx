"use client"

import { GuestCoraCareerAccess } from "@/components/guest/GuestCoraCareerAccess"
import { GuestModulePage } from "@/components/guest/dashboard/GuestModulePage"

export default function Page() {
  return (
    <GuestModulePage bare className="pb-6 sm:pb-8">
      <GuestCoraCareerAccess />
    </GuestModulePage>
  )
}
