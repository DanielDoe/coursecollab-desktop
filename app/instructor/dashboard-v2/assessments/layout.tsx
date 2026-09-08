"use client"

import { InstructorMembershipDisclaimerBanner } from "@/components/governance/InstructorMembershipDisclaimerBanner"

export default function AssessmentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden">
      <div className="mb-4 shrink-0">
        <InstructorMembershipDisclaimerBanner />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
