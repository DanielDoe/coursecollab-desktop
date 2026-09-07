"use client"

import Link from "next/link"
import { Mail, Phone, Building2, Clock, MapPin, User } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { highlightMatch, textMatchesQuery } from "@/lib/syllabus/highlight-text"
import { SyllabusCopyButton } from "@/components/syllabus/SyllabusCopyButton"
import {
  SYLLABUS_LABEL,
  SYLLABUS_TILE_COMPACT,
  SYLLABUS_VALUE,
  PORTAL_TEXT_MUTED,
} from "@/lib/syllabus/syllabus-surface-classes"
import {
  copyValueForField,
  isCopyableInstructorField,
} from "@/lib/syllabus/field-actions"
import {
  findInstructorNameField,
  initialsFromName,
  isInstructorNameLabel,
} from "@/lib/syllabus/instructor-profile-utils"
import { cn } from "@/lib/utils"

const INSTRUCTOR_GRID_ORDER = ["email", "phone", "office hours", "office location"] as const

const FIELD_ICONS: Record<string, LucideIcon> = {
  department: Building2,
  email: Mail,
  phone: Phone,
  "office hours": Clock,
  "office location": MapPin,
}

function sortInstructorGridFields(entries: [string, string][]): [string, string][] {
  return [...entries].sort((a, b) => {
    const rank = (label: string) => {
      const key = label.toLowerCase()
      const index = INSTRUCTOR_GRID_ORDER.findIndex((token) => key.includes(token))
      return index === -1 ? INSTRUCTOR_GRID_ORDER.length : index
    }
    return rank(a[0]) - rank(b[0])
  })
}

function fieldIcon(label: string): LucideIcon {
  const key = label.toLowerCase()
  for (const [pattern, icon] of Object.entries(FIELD_ICONS)) {
    if (key.includes(pattern)) return icon
  }
  return User
}

type SyllabusInstructorProfileProps = {
  fields: Record<string, string>
  imageUrl?: string | null
  highlight?: string
  showActions?: boolean
}

export function SyllabusInstructorProfile({
  fields,
  imageUrl,
  highlight,
  showActions = true,
}: SyllabusInstructorProfileProps) {
  const instructorName = findInstructorNameField(fields) || "Instructor"
  const initials = initialsFromName(instructorName)

  const detailEntries = Object.entries(fields).filter(([label, value]) => {
    if (!value?.trim() || isInstructorNameLabel(label)) return false
    if (!highlight?.trim()) return true
    return textMatchesQuery(`${label} ${value}`, highlight)
  })

  const departmentEntry = detailEntries.find(([label]) => label.toLowerCase().includes("department"))
  const gridEntries = sortInstructorGridFields(
    detailEntries.filter(([label]) => !label.toLowerCase().includes("department")),
  )

  const nameMatches =
    !highlight?.trim() || textMatchesQuery(instructorName, highlight) || detailEntries.length > 0

  if (!nameMatches && detailEntries.length === 0) {
    return highlight?.trim() ? (
      <p className="text-sm text-muted-foreground">No instructor details match your search.</p>
    ) : null
  }

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
      <div className="flex shrink-0 flex-col items-center gap-3 sm:items-start">
        <Avatar className="h-28 w-28 ring-2 ring-[var(--border)] sm:h-32 sm:w-32">
          {imageUrl ? (
            <AvatarImage src={imageUrl} alt={instructorName} className="object-cover" mediaSize="small" />
          ) : null}
          <AvatarFallback className="bg-[var(--sidebar-accent)] text-xl font-semibold text-[var(--cc-text-muted)] sm:text-2xl">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="text-center sm:text-left">
          <p className={cn("text-lg font-semibold", SYLLABUS_VALUE)}>{highlightMatch(instructorName, highlight)}</p>
          {departmentEntry ? (
            <p className={cn("mt-0.5 text-sm", PORTAL_TEXT_MUTED)}>
              {highlightMatch(departmentEntry[1], highlight)}
            </p>
          ) : null}
        </div>
      </div>

      <dl className="min-w-0 flex-1 grid gap-3 sm:grid-cols-2">
        {gridEntries.map(([label, value]) => {
            const Icon = fieldIcon(label)
            return (
              <div key={label} className={SYLLABUS_TILE_COMPACT}>
                <dt className={cn("flex items-center justify-between gap-2", SYLLABUS_LABEL)}>
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--cc-accent-dark)]" />
                    {highlightMatch(label, highlight)}
                  </span>
                  {showActions && isCopyableInstructorField(label) ? (
                    <SyllabusCopyButton
                      value={copyValueForField(label, value)}
                      label={`${label} copied`}
                    />
                  ) : null}
                </dt>
                <dd className={cn("mt-1.5 font-medium leading-relaxed", SYLLABUS_VALUE)}>
                  {highlightMatch(value, highlight)}
                  {showActions && /^office hours$/i.test(label.trim()) ? (
                    <p className={cn("mt-2 text-sm font-normal", PORTAL_TEXT_MUTED)}>
                      <Link
                        href="/student/dashboard-v2/office-hours"
                        className="font-medium text-[var(--cc-accent-dark)] underline-offset-2 hover:underline"
                      >
                        Request office hours in CourseCollab
                      </Link>
                    </p>
                  ) : null}
                </dd>
              </div>
            )
          })}
      </dl>
    </div>
  )
}
