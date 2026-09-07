"use client"

import { studentSemesterOffer, type MembershipTier } from "@/lib/membership-constants"
import { formatSemesterPrice } from "@/lib/student-membership-catalog"
import { cn } from "@/lib/utils"

export function StudentSemesterDiscountPrice({
  tier,
  className,
  inverted = false,
}: {
  tier: MembershipTier
  className?: string
  inverted?: boolean
}) {
  const offer = studentSemesterOffer(tier)
  if (!offer) return null
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span
          className={cn(
            "text-sm font-medium line-through decoration-2",
            inverted ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {formatSemesterPrice(offer.listCents)}
        </span>
        <span className={cn("text-2xl font-bold tracking-tight", inverted ? "text-white" : "text-foreground")}>
          {formatSemesterPrice(offer.saleCents)}
        </span>
      </div>
      <p className={cn("text-[11px] font-semibold", inverted ? "text-emerald-100" : "text-emerald-700 dark:text-emerald-400")}>
        Student discount · save {formatSemesterPrice(offer.saveCents)} this semester
      </p>
    </div>
  )
}
