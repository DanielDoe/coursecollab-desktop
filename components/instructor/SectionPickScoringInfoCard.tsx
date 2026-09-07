"use client"

import Link from "next/link"
import { ListChecks } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { INSTRUCTOR_DASHBOARD_V2_BASE } from "@/lib/instructor-portal-nav-config"

export function SectionPickScoringInfoCard() {
  return (
    <Card className="border border-violet-200/70 dark:border-violet-800/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          Optional section question pools
        </CardTitle>
        <CardDescription>
          For exams with extra Section II problems, you can let students choose how many count toward their grade
          (e.g. answer any 8 of 13). Configure per assessment under{" "}
          <strong>Edit assessment → Sections</strong> → set scoring mode to{" "}
          <em>Student picks N for grading</em>.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
        <p>
          Existing assessments stay on <strong>All questions count</strong> unless you change them. Selected questions
          are stored on each attempt; section weighted scores use only those items (8/8, not 8/20).
        </p>
        <Link
          href={`${INSTRUCTOR_DASHBOARD_V2_BASE}/assessments/mid-semester`}
          className="text-violet-700 dark:text-violet-300 hover:underline font-medium"
        >
          Open Mid-Semester Exams →
        </Link>
      </CardContent>
    </Card>
  )
}
