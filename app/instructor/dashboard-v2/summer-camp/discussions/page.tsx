"use client"

import { FacultySummerCampShell } from "@/components/instructor/FacultySummerCampShell"
import { FacultyCampDiscussions } from "@/components/summer-camp/FacultyCampDiscussions"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { MessageCircle } from "lucide-react"

export default function InstructorSummerCampDiscussionsPage() {
  const { iconBadge } = facultyEmbedChrome("summer-camp")

  return (
    <FacultySummerCampShell>
    <div className="space-y-4">
      <div className="flex items-start gap-3">
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
      <FacultyCampDiscussions showTrainingLabel />
    </div>
    </FacultySummerCampShell>
  )
}
