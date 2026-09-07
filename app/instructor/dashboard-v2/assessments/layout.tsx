"use client"

import { InstructorMembershipDisclaimerBanner } from "@/components/governance/InstructorMembershipDisclaimerBanner"

export default function AssessmentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="w-full min-w-0 overflow-x-hidden">
      <div className="mb-4">
        <InstructorMembershipDisclaimerBanner />
      </div>
      {children}
    </div>
  )
}
