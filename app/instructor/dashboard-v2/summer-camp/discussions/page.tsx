"use client"

import { FacultyCampDiscussions } from "@/components/summer-camp/FacultyCampDiscussions"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { MessageCircle } from "lucide-react"

export default function InstructorSummerCampDiscussionsPage() {
  const { iconBadge } = facultyEmbedChrome("summer-camp")

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-start gap-3">
        <span className={iconBadge("md")}>
          <MessageCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className={cn("text-lg font-semibold sm:text-xl", PORTAL_TEXT)}>Camper discussions</h1>
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            Questions and support requests from enrolled campers across your tracks.
          </p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <FacultyCampDiscussions showTrainingLabel embedInDashboard />
      </div>
    </div>
  )
}
