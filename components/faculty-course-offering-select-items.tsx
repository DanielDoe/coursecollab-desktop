"use client"

import {
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
} from "@/components/ui/select"
import { groupFacultyOfferings, facultyOfferingKey, type FacultyCourseOffering, facultyOfferingPrimaryLabel, facultyOfferingChipCode, facultyOfferingShowsAsSection } from "@/lib/faculty-course-offerings-shared"
import { staffRoleLabel } from "@/lib/faculty-portal-nav-config"
import { cn } from "@/lib/utils"

type Props = {
  offerings: FacultyCourseOffering[]
  activeTermLabel?: string | null
  showStaffRole?: boolean
}

export function FacultyCourseOfferingSelectItems({
  offerings,
  activeTermLabel,
  showStaffRole = false,
}: Props) {
  const { active, other, activeTermLabel: derivedLabel } = groupFacultyOfferings(offerings)
  const termHeading = activeTermLabel ?? derivedLabel ?? "Current term"

  const renderItem = (o: FacultyCourseOffering) => {
    const showsAsSection = facultyOfferingShowsAsSection(o)
    return (
    <SelectItem
      key={facultyOfferingKey(o.course_id, o.academic_term_id, o.session_id ?? null)}
      value={facultyOfferingKey(o.course_id, o.academic_term_id, o.session_id ?? null)}
      className="whitespace-normal py-2"
    >
      <span className="font-medium text-slate-900 dark:text-white">
        {facultyOfferingPrimaryLabel(o)}
      </span>
      <span className="ml-1.5 text-xs text-slate-600 dark:text-slate-400">
        {showsAsSection ? (
          <>
            {o.catalog_course_code ?? o.course_code}
            {o.course_title ? ` · ${o.course_title}` : ""}
          </>
        ) : (
          facultyOfferingChipCode(o)
        )}
        {o.term_label && !o.is_active_term ? ` · ${o.term_label}` : ""}
        {showStaffRole && o.staff_role ? ` · ${staffRoleLabel(o.staff_role)}` : ""}
      </span>
      {o.exchange_provenance ? (
        <span className="mt-0.5 block text-[11px] text-sky-700 dark:text-sky-300">
          {(o.exchange_provenance.destinationInstructorName || o.owner_name || "Your")} variant
          {" · "}inherited from {o.exchange_provenance.sourceInstructorName}
        </span>
      ) : null}
    </SelectItem>
    )
  }

  if (active.length === 0 && other.length === 0) return null

  return (
    <>
      {active.length > 0 ? (
        <SelectGroup>
          <SelectLabel
            className={cn(
              "text-[11px] font-semibold uppercase tracking-wide",
              "text-[var(--cc-sem-success)]",
            )}
          >
            {termHeading}
          </SelectLabel>
          {active.map(renderItem)}
        </SelectGroup>
      ) : null}

      {active.length > 0 && other.length > 0 ? <SelectSeparator /> : null}

      {other.length > 0 ? (
        <SelectGroup>
          <SelectLabel className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Other terms
          </SelectLabel>
          {other.map(renderItem)}
        </SelectGroup>
      ) : null}
    </>
  )
}
