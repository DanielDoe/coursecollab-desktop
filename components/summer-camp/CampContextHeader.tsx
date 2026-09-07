"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { camperEyebrow, camperLink, camperSubtitle, camperTitle } from "@/lib/summer-camp/camper-ui-theme"
import { cn } from "@/lib/utils"

type CampContextHeaderProps = {
  eyebrow: string
  title?: string
  description?: string
  backHref: string
  backLabel?: string
  className?: string
}

/** Camp page header: eyebrow + back link on one row; title below. */
export function CampContextHeader({
  eyebrow,
  title,
  description,
  backHref,
  backLabel = "Browse Trainings",
  className,
}: CampContextHeaderProps) {
  return (
    <header className={cn("space-y-2 w-full min-w-0", className)} data-camper-portal>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className={camperEyebrow}>{eyebrow}</p>
        <Link href={backHref} className={cn(camperLink, "shrink-0 ml-auto")}>
          {backLabel}
          <ArrowLeft className="h-3.5 w-3.5 rotate-180" aria-hidden />
        </Link>
      </div>
      {title ? <h1 className={cn("text-2xl sm:text-3xl font-bold", camperTitle)}>{title}</h1> : null}
      {description ? <p className={cn(camperSubtitle, "text-sm sm:text-base")}>{description}</p> : null}
    </header>
  )
}
