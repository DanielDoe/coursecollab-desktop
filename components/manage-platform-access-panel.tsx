"use client"

import { Monitor, Smartphone, Globe } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  DEFAULT_ASSESSMENT_PLATFORM_FLAGS,
  resolveAssessmentPlatformKind,
  type AssessmentPlatformFlags,
  type AssessmentPlatformAccess,
  type AssessmentPlatformId,
} from "@/lib/assessment-platform-access"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/assessments/assessment-management-surface-classes"
import { cn } from "@/lib/utils"

const PLATFORM_ROWS: Array<{
  id: AssessmentPlatformId
  label: string
  icon: typeof Globe
}> = [
  { id: "web", label: "Website", icon: Globe },
  { id: "mobile", label: "Mobile app", icon: Smartphone },
  { id: "desktop", label: "Desktop app", icon: Monitor },
]

function flagsLabel(flags: AssessmentPlatformFlags): string {
  const on = PLATFORM_ROWS.filter((row) => flags[row.id]).map((row) => row.label.toLowerCase())
  if (on.length === 0) return "no platforms"
  if (on.length === PLATFORM_ROWS.length) return "website, mobile, and desktop"
  return on.join(", ")
}

type Props = {
  assessmentType: string
  inherit: boolean
  flags: AssessmentPlatformFlags
  courseAccess?: AssessmentPlatformAccess | null
  onInheritChange: (inherit: boolean) => void
  onFlagsChange: (flags: AssessmentPlatformFlags) => void
}

export function ManagePlatformAccessPanel({
  assessmentType,
  inherit,
  flags,
  courseAccess,
  onInheritChange,
  onFlagsChange,
}: Props) {
  const kind = resolveAssessmentPlatformKind(assessmentType)
  const courseFlags = courseAccess?.[kind] ?? DEFAULT_ASSESSMENT_PLATFORM_FLAGS
  const effective = inherit ? courseFlags : flags

  return (
    <div className="pt-6 mt-6 space-y-4 border-t border-slate-200 dark:border-slate-700">
      <div>
        <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Where students may take this assessment</h3>
        <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
          Course default for this type: {flagsLabel(courseFlags)}. Override only this assessment if it
          should differ.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/40 px-4 py-3">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium text-slate-800 dark:text-slate-200">
            Use course default
          </Label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {inherit
              ? `Inherits ${flagsLabel(courseFlags)} from Assessment Governance.`
              : "This assessment uses its own platform list."}
          </p>
        </div>
        <Switch
          checked={inherit}
          onCheckedChange={(next) => {
            if (!next) onFlagsChange({ ...courseFlags })
            onInheritChange(next)
          }}
        />
      </div>

      {PLATFORM_ROWS.map(({ id, label, icon: Icon }) => (
        <div
          key={id}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/40 px-4 py-3"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <div className="space-y-0.5">
              <Label className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</Label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {effective[id]
                  ? `Students can start this assessment on ${label.toLowerCase()}.`
                  : `Students cannot start this assessment on ${label.toLowerCase()}.`}
              </p>
            </div>
          </div>
          <Switch
            checked={effective[id]}
            disabled={inherit}
            onCheckedChange={(next) => onFlagsChange({ ...flags, [id]: next })}
          />
        </div>
      ))}
    </div>
  )
}
