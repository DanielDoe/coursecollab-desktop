"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { Clock, Mail, MapPin, Phone, Building2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PublicOfficeHoursPage } from "@/lib/office-hours-public-profile"

function formatDisplayTime(time24: string): string {
  const match = time24.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return time24
  let hour = Number(match[1])
  const minute = match[2]!
  const meridiem = hour >= 12 ? "PM" : "AM"
  if (hour === 0) hour = 12
  else if (hour > 12) hour -= 12
  return `${hour}:${minute} ${meridiem}`
}

export function PublicOfficeHoursPageClient({ slug }: { slug: string }) {
  const [data, setData] = useState<PublicOfficeHoursPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [termId, setTermId] = useState<number | null>(null)

  const loadPage = useCallback(async (t: number | null) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (t != null) params.set("academicTermId", String(t))
      const qs = params.toString()
      const res = await fetch(`/api/public/office-hours/${encodeURIComponent(slug)}${qs ? `?${qs}` : ""}`)
      const json = (await res.json()) as PublicOfficeHoursPage & { error?: string }
      if (!res.ok) {
        setError(json.error || "Office hours not found")
        setData(null)
        return
      }
      setData(json)
      setTermId(json.selectedTermId)
    } catch {
      setError("Could not load office hours")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    loadPage(null)
  }, [loadPage])

  const handleTermChange = (value: string) => {
    const next = Number(value)
    setTermId(next)
    loadPage(next)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <header className="border-b border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-950/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-3">
          <Image
            src="/brand/course-collab-mark-512.png"
            alt="CourseCollab"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">CourseCollab · PVAMU</p>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Faculty office hours</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        {loading ? (
          <p className="text-sm text-slate-500">Loading office hours…</p>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        ) : data ? (
          <>
            <section className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/60 p-5 shadow-sm space-y-3">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Instructor</p>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mt-1">
                  {data.instructorName}
                </h2>
                {data.instructorContact.department ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{data.instructorContact.department}</p>
                ) : null}
              </div>

              <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                {data.instructorContact.email ? (
                  <div className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                    <Mail className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt>
                      <dd>
                        <a href={`mailto:${data.instructorContact.email}`} className="hover:underline">
                          {data.instructorContact.email}
                        </a>
                      </dd>
                    </div>
                  </div>
                ) : null}
                {data.instructorContact.phone ? (
                  <div className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                    <Phone className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Phone</dt>
                      <dd>{data.instructorContact.phone}</dd>
                    </div>
                  </div>
                ) : null}
                {data.instructorContact.officeBuilding || data.instructorContact.officeRoom ? (
                  <div className="flex items-start gap-2 text-slate-700 dark:text-slate-200 sm:col-span-2">
                    <Building2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Office</dt>
                      <dd>
                        {[data.instructorContact.officeBuilding, data.instructorContact.officeRoom && `Room ${data.instructorContact.officeRoom}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </dd>
                    </div>
                  </div>
                ) : null}
                {(data.instructorContact.officeLocation || data.defaultOfficeLocation) ? (
                  <div className="flex items-start gap-2 text-slate-700 dark:text-slate-200 sm:col-span-2">
                    <MapPin className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Location</dt>
                      <dd>{data.instructorContact.officeLocation || data.defaultOfficeLocation}</dd>
                    </div>
                  </div>
                ) : null}
              </dl>

              {data.instructorContact.onDemandSupport ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">{data.instructorContact.onDemandSupport}</p>
              ) : null}
              {data.instructorContact.additionalMeetingHours ? (
                <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2.5 text-sm dark:border-amber-500/25 dark:bg-amber-500/10">
                  <p className="font-medium text-amber-950 dark:text-amber-100">
                    Graduate student &amp; research meeting hours
                  </p>
                  <p className="text-amber-900/90 dark:text-amber-50/90 mt-1">
                    {data.instructorContact.additionalMeetingHours}
                  </p>
                  <p className="text-xs text-amber-800/80 dark:text-amber-100/70 mt-1.5">
                    By appointment for research advisees — not open walk-in office hours for enrolled courses.
                  </p>
                </div>
              ) : null}
              {data.publicNote ? (
                <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap border-t border-slate-200/80 dark:border-white/10 pt-3">
                  {data.publicNote}
                </p>
              ) : null}
            </section>

            {data.terms.length > 1 ? (
              <section className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500">Semester</p>
                <Select value={termId != null ? String(termId) : undefined} onValueChange={handleTermChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.terms.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.label}
                        {t.isActive ? " (current)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </section>
            ) : data.terms.length === 1 ? (
              <p className="text-sm text-slate-500">{data.terms[0]!.label}</p>
            ) : null}

            <section className="space-y-3">
              {data.courses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/15 px-4 py-8 text-center text-sm text-slate-500">
                  No office hours posted for this semester yet.
                </div>
              ) : (
                data.courses.map((course) => (
                  <article
                    key={course.offeringKey}
                    className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/60 p-5 shadow-sm"
                  >
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                      {course.courseCode}
                      {course.sessionCode && course.sessionCode !== course.courseCode
                        ? ` · ${course.sessionCode}`
                        : ""}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{course.courseTitle}</p>
                    {course.officeLocation ? (
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-teal-600 shrink-0" />
                        {course.officeLocation}
                      </p>
                    ) : null}
                    {course.slots.length > 0 ? (
                      <ul className="mt-3 space-y-2">
                        <li className="text-xs font-medium uppercase tracking-wide text-slate-500 px-1">
                          Open office hours
                        </li>
                        {course.slots.map((slot, i) => (
                          <li
                            key={i}
                            className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2"
                          >
                            <Clock className="h-4 w-4 text-teal-600 shrink-0" />
                            <span className="font-medium">{slot.dayName}</span>
                            <span className="text-slate-500">
                              {formatDisplayTime(slot.startTime)} – {formatDisplayTime(slot.endTime)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : course.syllabusHoursSummary ? (
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">{course.syllabusHoursSummary}</p>
                    ) : (
                      <p className="text-sm text-slate-500 mt-3">Hours not posted for this course.</p>
                    )}
                  </article>
                ))
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  )
}
