"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpen, Building2, CalendarDays, Loader2, ShieldCheck, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  COURSE_EXCHANGE_DEFAULT_APPROVAL_MODULES,
  COURSE_EXCHANGE_MODULE_LABELS,
} from "@/lib/course-exchange/modules"
import type { CourseExchangeModule } from "@/lib/course-exchange/types"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { CourseExchangeGuidanceCallout } from "@/components/instructor/course-exchange/CourseExchangeGuidanceCallout"
import { PORTAL_TEXT } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

const TEXT_SECONDARY = "text-[var(--cc-text-secondary)]"
const SECTION_EYEBROW =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-secondary)]"

export type DiscoverCourseCard = {
  courseId: number
  courseCode: string
  courseTitle: string
  discoverableTitle: string | null
  description: string | null
  semester: string | null
  university: string | null
  instructorName: string
  instructorInstitution: string | null
  instructorDepartment: string | null
  isOwner?: boolean
  shareableModules?: CourseExchangeModule[]
  autoApprove?: boolean
}

type DestCourse = { course_id: number; course_code: string; course_title: string }

export function CourseExchangeDiscoverSheet({
  course,
  open,
  onOpenChange,
  destinationCourses,
  preferredDestinationCourseId,
  loading,
  onSubmit,
}: {
  course: DiscoverCourseCard | null
  open: boolean
  onOpenChange: (open: boolean) => void
  destinationCourses: DestCourse[]
  preferredDestinationCourseId?: number | null
  loading: boolean
  onSubmit: (payload: {
    modules: CourseExchangeModule[]
    purpose: string
    destinationCourseId: number
  }) => Promise<void>
}) {
  const chrome = facultyEmbedChrome("course-exchange")
  const allowed = useMemo(
    () =>
      course?.shareableModules?.length
        ? course.shareableModules
        : [...COURSE_EXCHANGE_DEFAULT_APPROVAL_MODULES],
    [course],
  )
  const [step, setStep] = useState<"details" | "request">("details")
  const [selected, setSelected] = useState<CourseExchangeModule[]>([])
  const [purpose, setPurpose] = useState("")
  const [destinationCourseId, setDestinationCourseId] = useState("")

  useEffect(() => {
    if (open && course) {
      setStep("details")
      setSelected([...allowed])
      setPurpose("")
      setDestinationCourseId("")
    }
  }, [open, course, allowed])

  useEffect(() => {
    if (!open || step !== "request") return
    const preferred = preferredDestinationCourseId ?? destinationCourses[0]?.course_id
    if (preferred != null) {
      setDestinationCourseId(String(preferred))
    }
  }, [open, step, preferredDestinationCourseId, destinationCourses])

  if (!course) return null

  const title = course.discoverableTitle || course.courseTitle
  const toggle = (mod: CourseExchangeModule) => {
    setSelected((prev) => (prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto border-l border-[var(--border)] bg-[var(--cc-modal-surface)] p-0 sm:max-w-md"
      >
        <SheetHeader className="space-y-2 border-b border-[var(--border)] px-5 pb-4 pt-5 text-left">
          <p className={SECTION_EYEBROW}>Course Exchange</p>
          <SheetTitle className={cn("text-xl font-semibold tracking-tight", PORTAL_TEXT)}>{title}</SheetTitle>
          <SheetDescription className={cn("text-sm leading-relaxed", TEXT_SECONDARY)}>
            <span className="font-medium text-[var(--cc-text)]">{course.courseCode}</span>
            {course.autoApprove ? " · Instant import when you submit" : " · Creator reviews before import"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 px-5 py-4">
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
            <div
              className={cn(
                "flex items-center gap-3 border-b border-[var(--border)] px-4 py-3.5",
                chrome.p.softBg,
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  chrome.p.iconBg,
                  chrome.p.iconText,
                )}
              >
                <UserRound className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className={cn("truncate font-semibold", PORTAL_TEXT)}>{course.instructorName}</p>
                <p className={cn("text-xs", TEXT_SECONDARY)}>Course creator</p>
              </div>
            </div>
            <div className="space-y-2.5 px-4 py-3.5">
              {course.instructorInstitution || course.university ? (
                <p className={cn("flex items-center gap-2.5 text-sm", TEXT_SECONDARY)}>
                  <Building2 className={cn("h-4 w-4 shrink-0", chrome.p.iconText)} />
                  <span>{course.instructorInstitution || course.university}</span>
                </p>
              ) : null}
              {course.semester ? (
                <p className={cn("flex items-center gap-2.5 text-sm", TEXT_SECONDARY)}>
                  <CalendarDays className={cn("h-4 w-4 shrink-0", chrome.p.iconText)} />
                  <span>{course.semester}</span>
                </p>
              ) : null}
              <p className={cn("text-sm leading-relaxed", TEXT_SECONDARY)}>
                {course.description || "No course description provided."}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <p className={SECTION_EYEBROW}>Modules shared by creator</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {allowed.map((mod) => (
                <span
                  key={mod}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium",
                    "bg-[var(--muted)]/50 text-[var(--cc-text-secondary)]",
                  )}
                >
                  <BookOpen className={cn("h-3 w-3 shrink-0", chrome.p.iconText)} />
                  {COURSE_EXCHANGE_MODULE_LABELS[mod]}
                </span>
              ))}
            </div>
            <div
              className={cn(
                "mt-3 flex gap-2.5 rounded-xl border px-3 py-2.5",
                "border-[var(--border)] bg-[var(--muted)]/30",
              )}
            >
              <ShieldCheck className={cn("mt-0.5 h-4 w-4 shrink-0", chrome.p.iconText)} />
              <p className={cn("text-xs leading-relaxed", TEXT_SECONDARY)}>
                Student results are never shared. You only receive the modules you select below.
              </p>
            </div>
          </div>

          {step === "request" ? (
            <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <CourseExchangeGuidanceCallout kind="destination-shell" dismissId="exchange:sheet:shell" />
              <div className="space-y-2">
                <Label className={cn("text-sm font-medium", PORTAL_TEXT)}>Modules you want</Label>
                <div className="grid gap-2">
                  {allowed.map((mod) => {
                    const isSelected = selected.includes(mod)
                    return (
                      <label
                        key={mod}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                          "border-[var(--border)] hover:bg-[var(--muted)]/40",
                          isSelected && cn("border-transparent", chrome.p.softBg),
                          PORTAL_TEXT,
                        )}
                      >
                        <Checkbox checked={isSelected} onCheckedChange={() => toggle(mod)} />
                        {COURSE_EXCHANGE_MODULE_LABELS[mod]}
                      </label>
                    )
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label className={cn("text-sm font-medium", PORTAL_TEXT)}>Import into your course</Label>
                <Select value={destinationCourseId} onValueChange={setDestinationCourseId}>
                  <SelectTrigger className="h-11 rounded-xl border-[var(--border)] bg-[var(--background)]">
                    <SelectValue placeholder="Select destination course" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinationCourses.map((c) => (
                      <SelectItem key={c.course_id} value={String(c.course_id)}>
                        {c.course_code} — {c.course_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className={cn("text-sm font-medium", PORTAL_TEXT)}>Note to creator (optional)</Label>
                <Textarea
                  className="min-h-[80px] rounded-xl border-[var(--border)] bg-[var(--background)] placeholder:text-[var(--cc-text-muted)]"
                  placeholder="e.g. Teaching the same course next term"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                />
              </div>
            </div>
          ) : null}
        </div>

        <SheetFooter className="gap-2 border-t border-[var(--border)] px-5 py-4 sm:flex-col">
          {course.isOwner ? (
            <p className={cn("text-center text-sm", TEXT_SECONDARY)}>This is your shared course.</p>
          ) : step === "details" ? (
            <Button className={cn("h-11 w-full rounded-xl", chrome.solid)} onClick={() => setStep("request")}>
              Request access
            </Button>
          ) : (
            <>
              <Button
                className={cn("h-11 w-full rounded-xl", chrome.solid)}
                disabled={loading || selected.length === 0 || !destinationCourseId}
                onClick={() =>
                  void onSubmit({
                    modules: selected,
                    purpose,
                    destinationCourseId: Number(destinationCourseId),
                  })
                }
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {course.autoApprove ? "Submit & import now" : "Send request"}
              </Button>
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl border-[var(--border)]"
                onClick={() => setStep("details")}
              >
                Back
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
