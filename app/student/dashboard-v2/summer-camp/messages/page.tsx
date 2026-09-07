"use client"

import { Suspense } from "react"
import { Mail } from "lucide-react"
import { CamperPageShell } from "@/components/summer-camp/CamperPageShell"
import { MessagesInbox } from "@/components/messages/MessagesInbox"

export default function CampMessagesPage() {
  return (
    <CamperPageShell
      icon={Mail}
      title="Messages"
      subtitle="Private messages with instructors and other campers."
    >
      <Suspense fallback={null}>
        <MessagesInbox portal="camp" title="Camp Messages" />
      </Suspense>
    </CamperPageShell>
  )
}
