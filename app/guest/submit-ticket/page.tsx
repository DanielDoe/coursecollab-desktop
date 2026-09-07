"use client"

import { GuestModulePage } from "@/components/guest/dashboard/GuestModulePage"
import { GuestSubmitTicketPage } from "@/components/guest/support/GuestSubmitTicketPage"

export default function GuestSubmitTicketRoute() {
  return (
    <GuestModulePage bare>
      <GuestSubmitTicketPage />
    </GuestModulePage>
  )
}
