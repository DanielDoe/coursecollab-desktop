"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  InstructorAdminQuickLink,
  InstructorPolicyDividedList,
  InstructorPolicySurfaceCard,
} from "@/components/instructor/InstructorPolicySurfaceCard"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"
import { InstructorGradesSettings } from "@/components/instructor-grades-settings"
import { MultiPartGradingSettings } from "@/components/multi-part-grading-settings"
import { AssessmentPerksGraceSettings } from "@/components/assessment-perks-grace-settings"
import { ResultsAutoFinalizeSettings } from "@/components/results-auto-finalize-settings"
import { getInstructorData } from "@/lib/auth"
import { INSTRUCTOR_DASHBOARD_V2_BASE } from "@/lib/instructor-portal-nav-config"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

function PolicyBlock({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-4 border-t border-[var(--border)] pt-5 first:border-t-0 first:pt-0">
      <div>
        <h4 className={cn("text-sm font-semibold", PORTAL_TEXT)}>{title}</h4>
        {description ? <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>{description}</p> : null}
      </div>
      {children}
    </div>
  )
}

export function InstructorGradingPoliciesHub() {
  const router = useRouter()
  const [instructorId, setInstructorId] = useState<number | null>(null)

  useEffect(() => {
    const data = getInstructorData()
    if (!data) {
      router.push("/faculty/login")
      return
    }
    setInstructorId(Number(data.id))
  }, [router])

  if (instructorId == null) {
    return <InstructorPolicyLoadingState moduleId="grading-policies" label="Loading grading policies…" />
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <InstructorPolicySurfaceCard className="w-full">
        <PolicyBlock
          title="Grade weight configuration"
          description="Set how each assessment category contributes to the course grade. Adjust per section or apply to all sections."
        >
          <InstructorGradesSettings instructorId={instructorId} bare />
        </PolicyBlock>

        <PolicyBlock
          title="Results finalization"
          description="Control when student results are marked reviewed and finalized for grade release."
        >
          <ResultsAutoFinalizeSettings bare />
        </PolicyBlock>

        <PolicyBlock
          title="Rollover & retake grace period"
          description="After each assessment deadline, membership perks stay open for this many days before expiring."
        >
          <AssessmentPerksGraceSettings bare />
        </PolicyBlock>

        <PolicyBlock
          title="Multi-part question grading"
          description="MCQ sub-parts earn 1 point each; uploaded work earns multiplier × part count (instructor rubric)."
        >
          <MultiPartGradingSettings bare />
        </PolicyBlock>

        <PolicyBlock
          title="Optional section question pools"
          description="Let students choose how many Section II problems count toward their grade (e.g. any 8 of 13)."
        >
          <div className={cn("space-y-3 text-sm", PORTAL_TEXT_MUTED)}>
            <p className="leading-relaxed">
              Configure per assessment under <span className={PORTAL_TEXT}>Edit assessment → Sections</span> → set
              scoring mode to <span className={PORTAL_TEXT}>Student picks N for grading</span>. Existing assessments
              stay on all questions count unless you change them.
            </p>
            <InstructorPolicyDividedList>
              <InstructorAdminQuickLink
                href={`${INSTRUCTOR_DASHBOARD_V2_BASE}/assessments/mid-semester`}
                label="Open mid-semester exams"
                description="Set student-picks-N scoring on Section II"
                variant="row"
              />
            </InstructorPolicyDividedList>
          </div>
        </PolicyBlock>
      </InstructorPolicySurfaceCard>
    </div>
  )
}
