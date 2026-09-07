"use client"

import Link from "next/link"
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  GraduationCap,
  ScrollText,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

const MODULE_BY_TYPE: Record<string, string> = {
  homework: "homeworks",
  quiz: "quizzes",
  mid_semester: "mid-semester",
  final: "final-exams",
}

const ICON_BY_TYPE: Record<string, LucideIcon> = {
  homework: FileText,
  quiz: ClipboardList,
  mid_semester: ScrollText,
  final: GraduationCap,
}

export type EditAssessmentPageHeaderProps = {
  title: string
  assessmentType: string
  assessmentLabel: string
  assessmentPluralLabel: string
  listPath: string
  embedInDashboard?: boolean
  questionCount: number
  sectionCount: number
  isActive: boolean
}

export function EditAssessmentPageHeader({
  title,
  assessmentType,
  assessmentLabel,
  listPath,
  embedInDashboard = false,
  questionCount,
  sectionCount,
  isActive,
}: EditAssessmentPageHeaderProps) {
  const moduleId = MODULE_BY_TYPE[assessmentType] ?? "quizzes"
  const chrome = facultyEmbedChrome(moduleId)
  const Icon = ICON_BY_TYPE[assessmentType] ?? ClipboardList
  const displayTitle = title.trim() || `Edit ${assessmentLabel}`

  const metaParts = [
    `${questionCount} question${questionCount === 1 ? "" : "s"}`,
    sectionCount > 0 ? `${sectionCount} section${sectionCount === 1 ? "" : "s"}` : null,
  ].filter(Boolean)

  return (
    <header
      className={cn(
        embedInDashboard
          ? "mb-1 border-b border-[var(--border)] pb-5"
          : "rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-none sm:p-5",
      )}
    >
      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
        <div className={chrome.iconBadge("md")}>
          <Icon className="h-5 w-5 !text-white" strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("text-[11px] font-semibold uppercase tracking-wide", chrome.accentIcon)}>
              {assessmentLabel}
            </span>
            <span className={PORTAL_TEXT_MUTED} aria-hidden>
              ·
            </span>
            <Badge
              variant="outline"
              className={cn(
                "h-5 rounded-md border-0 px-1.5 py-0 text-[10px] font-medium",
                isActive
                  ? "bg-[var(--cc-sem-success)]/10 text-[var(--cc-sem-success)]"
                  : "bg-muted text-[var(--cc-text-muted)]",
              )}
            >
              {isActive ? "Published" : "Draft"}
            </Badge>
          </div>

          <h1 className={cn("truncate text-lg font-semibold leading-snug sm:text-xl", PORTAL_TEXT)}>
            {displayTitle}
          </h1>

          {metaParts.length > 0 ? (
            <p className={cn("mt-0.5 text-sm", PORTAL_TEXT_MUTED)}>{metaParts.join(" · ")}</p>
          ) : null}
        </div>

        {!embedInDashboard ? (
          <Link href={listPath} className="shrink-0">
            <Button size="sm" className={cn("gap-1.5 rounded-lg", chrome.quiet)}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        ) : null}
      </div>
    </header>
  )
}
