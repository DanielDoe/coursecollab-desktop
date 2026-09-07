"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import QRCode from "qrcode"
import {
  Clock,
  Copy,
  Download,
  Loader2,
  MapPin,
  Plus,
  Printer,
  QrCode,
  Save,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { notifyInstructorCalendarChanged } from "@/lib/calendar/instructor-calendar-events"
import type {
  DoorQrCourseHours,
  InstructorDoorQrBundle,
  OfficeHoursInstructorContact,
} from "@/lib/office-hours-public-profile"

const DAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
]

type EditableCourse = DoorQrCourseHours & {
  slots: { dayOfWeek: number; startTime: string; endTime: string }[]
}

const chrome = facultyEmbedChrome("office-hours")

function paintQr(canvas: HTMLCanvasElement, payload: string, size: number) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  canvas.width = size
  canvas.height = size
  ctx.fillStyle = "#FFFFFF"
  ctx.fillRect(0, 0, size, size)
  QRCode.toCanvas(canvas, payload, {
    width: size,
    margin: 3,
    color: { dark: "#000000", light: "#FFFFFF" },
    errorCorrectionLevel: "H",
  })
}

export function InstructorOfficeHoursDoorQrPanel() {
  const { toast } = useToast()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bundle, setBundle] = useState<InstructorDoorQrBundle | null>(null)
  const [defaultOfficeLocation, setDefaultOfficeLocation] = useState("")
  const [publicNote, setPublicNote] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [department, setDepartment] = useState("")
  const [officeBuilding, setOfficeBuilding] = useState("")
  const [officeRoom, setOfficeRoom] = useState("")
  const [onDemandSupport, setOnDemandSupport] = useState("")
  const [additionalMeetingHours, setAdditionalMeetingHours] = useState("")
  const [courses, setCourses] = useState<EditableCourse[]>([])

  const applyContact = (contact: OfficeHoursInstructorContact | undefined) => {
    setContactEmail(contact?.email ?? "")
    setContactPhone(contact?.phone ?? "")
    setDepartment(contact?.department ?? "")
    setOfficeBuilding(contact?.officeBuilding ?? "")
    setOfficeRoom(contact?.officeRoom ?? "")
    setOnDemandSupport(contact?.onDemandSupport ?? "")
    setAdditionalMeetingHours(contact?.additionalMeetingHours ?? "")
  }

  const loadBundle = useCallback(async () => {
    setLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/office-hours/door-qr", {
        headers: buildInstructorApiHeaders(),
      })
      const data = (await res.json()) as InstructorDoorQrBundle & { error?: string }
      if (!res.ok) {
        toast({
          title: "Could not load door QR",
          description: data.error || "Try again shortly.",
          variant: "destructive",
        })
        return
      }
      setBundle(data)
      setDefaultOfficeLocation(data.defaultOfficeLocation ?? data.instructorContact?.officeLocation ?? "")
      setPublicNote(data.publicNote ?? "")
      applyContact(data.instructorContact)
      setCourses(
        (data.courses ?? []).map((c) => ({
          ...c,
          slots: (c.slots ?? []).map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
        })),
      )
    } catch {
      toast({ title: "Error", description: "Failed to load door QR settings", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetch("/api/setup/office-hours", { method: "POST" }).catch(() => {})
    loadBundle()
  }, [loadBundle, courseScopeVersion])

  useEffect(() => {
    if (!bundle?.publicUrl || !qrCanvasRef.current) return
    paintQr(qrCanvasRef.current, bundle.publicUrl, 512)
  }, [bundle?.publicUrl])

  const updateCourse = (offeringKey: string, patch: Partial<EditableCourse>) => {
    setCourses((prev) => prev.map((c) => (c.offeringKey === offeringKey ? { ...c, ...patch } : c)))
  }

  const addSlot = (offeringKey: string) => {
    setCourses((prev) =>
      prev.map((c) =>
        c.offeringKey === offeringKey
          ? { ...c, slots: [...c.slots, { dayOfWeek: 1, startTime: "12:00", endTime: "13:00" }] }
          : c,
      ),
    )
  }

  const removeSlot = (offeringKey: string, index: number) => {
    setCourses((prev) =>
      prev.map((c) =>
        c.offeringKey === offeringKey ? { ...c, slots: c.slots.filter((_, i) => i !== index) } : c,
      ),
    )
  }

  const updateSlot = (offeringKey: string, index: number, field: string, value: number | string) => {
    setCourses((prev) =>
      prev.map((c) =>
        c.offeringKey === offeringKey
          ? {
              ...c,
              slots: c.slots.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
            }
          : c,
      ),
    )
  }

  const handleOpenDoorSign = () => {
    if (!bundle?.slug) return
    const url = `/office-hours/${encodeURIComponent(bundle.slug)}/sign`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const handlePrintDoorSign = () => {
    if (!bundle?.slug) return
    handleOpenDoorSign()
    toast({
      title: "Door sign opened",
      description: "Use Print / Save PDF on that page when you are ready.",
    })
  }

  const handleCopyLink = async () => {
    if (!bundle?.publicUrl) return
    try {
      await navigator.clipboard.writeText(bundle.publicUrl)
      toast({ title: "Link copied", description: "Permanent door QR link copied to clipboard." })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  const handleDownloadQr = () => {
    const canvas = qrCanvasRef.current
    if (!canvas || !bundle?.slug) return
    const link = document.createElement("a")
    link.download = `office-hours-${bundle.slug}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  const handleSave = async () => {
    if (!bundle?.academicTermId) {
      toast({
        title: "Select a semester",
        description: "Pick a course offering for the current semester in the dashboard header first.",
        variant: "destructive",
      })
      return
    }
    setSaving(true)
    try {
      const res = await instructorApiFetch("/api/instructor/office-hours/door-qr", {
        method: "POST",
        headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          academicTermId: bundle.academicTermId,
          universityId: bundle.universityId,
          defaultOfficeLocation,
          publicNote,
          instructorContact: {
            email: contactEmail,
            phone: contactPhone,
            department,
            officeBuilding,
            officeRoom,
            officeLocation: defaultOfficeLocation,
            onDemandSupport,
            additionalMeetingHours,
          },
          courses: courses.map((c) => ({
            courseId: c.courseId,
            sessionId: c.sessionId,
            offeringKey: c.offeringKey,
            officeLocation: c.officeLocation,
            slots: c.slots,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Save failed", description: data.error || "Try again.", variant: "destructive" })
        return
      }
      setBundle(data)
      notifyInstructorCalendarChanged()
      toast({
        title: "Saved",
        description: "Office hours updated on your calendar and subscribe feeds. The door QR link stays the same.",
      })
    } catch {
      toast({ title: "Save failed", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[var(--cc-text-muted)]">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading door QR…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className={cn(PORTAL_CARD, "p-4 sm:p-5")}>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex flex-col items-center gap-3 shrink-0">
            <div className="rounded-2xl border border-[var(--border)] bg-white p-3 shadow-sm">
              <canvas ref={qrCanvasRef} className="h-44 w-44 sm:h-52 sm:w-52" aria-label="Office hours QR code" />
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button type="button" variant="outline" size="sm" onClick={handlePrintDoorSign}>
                <Printer className="h-4 w-4 mr-1.5" />
                Print door sign
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleOpenDoorSign}>
                Preview sign
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleDownloadQr}>
                <Download className="h-4 w-4 mr-1.5" />
                Download PNG
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleCopyLink}>
                <Copy className="h-4 w-4 mr-1.5" />
                Copy link
              </Button>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-start gap-2">
              <QrCode className={cn("h-5 w-5 mt-0.5 shrink-0", chrome.p.iconText)} />
              <div>
                <h2 className={cn("text-lg font-semibold", PORTAL_TEXT)}>Permanent door QR</h2>
                <p className={cn("text-sm mt-1", PORTAL_TEXT_MUTED)}>
                  Print this once. Students scan to see your office hours for the semester they choose —
                  no reprinting when schedules change.
                </p>
              </div>
            </div>

            {bundle?.academicTermLabel ? (
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                Editing hours for <span className="font-medium">{bundle.academicTermLabel}</span>
              </p>
            ) : null}

            <div className="rounded-xl border border-[var(--border)] bg-[var(--sidebar-accent)]/20 px-3 py-2 space-y-1">
              <p className={cn("text-xs uppercase tracking-wide", PORTAL_TEXT_MUTED)}>Public link (scan target)</p>
              <p className={cn("text-sm break-all font-mono mt-0.5", PORTAL_TEXT)}>{bundle?.publicUrl}</p>
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                Permanent production link — works after you deploy. Preview/sign pages open locally for editing only.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="you@university.edu"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-phone">Phone</Label>
                <Input
                  id="contact-phone"
                  placeholder="936-261-9980"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  placeholder="Electrical and Computer Engineering"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="office-building">Building</Label>
                <Input
                  id="office-building"
                  placeholder="Electrical Engineering Building"
                  value={officeBuilding}
                  onChange={(e) => setOfficeBuilding(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="office-room">Room / office number</Label>
                <Input
                  id="office-room"
                  placeholder="326"
                  value={officeRoom}
                  onChange={(e) => setOfficeRoom(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="default-office">Full location line (optional)</Label>
                <Input
                  id="default-office"
                  placeholder="Electrical Engineering Building 326; Online by appointment"
                  value={defaultOfficeLocation}
                  onChange={(e) => setDefaultOfficeLocation(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="on-demand">On-demand support note</Label>
                <Input
                  id="on-demand"
                  placeholder="On-demand requests available through CourseCollab"
                  value={onDemandSupport}
                  onChange={(e) => setOnDemandSupport(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="additional-hours">Graduate student &amp; research meeting hours</Label>
                <Input
                  id="additional-hours"
                  placeholder="Friday, 9:00 AM – 11:00 AM (research advisees by appointment)"
                  value={additionalMeetingHours}
                  onChange={(e) => setAdditionalMeetingHours(e.target.value)}
                />
                <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                  Shown separately on the public page — not listed as course walk-in office hours.
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="public-note">Note for students (optional)</Label>
                <Textarea
                  id="public-note"
                  placeholder="Email me to schedule outside these hours."
                  value={publicNote}
                  onChange={(e) => setPublicNote(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              Contact details pre-fill from your published syllabus when empty. Course hours below also pull from each
              section&apos;s syllabus until you save door QR hours here.
            </p>
          </div>
        </div>
      </div>

      <div className={cn(PORTAL_CARD, "divide-y divide-[var(--border)]")}>
        <div className="p-4 sm:p-5">
          <h3 className={cn("font-semibold flex items-center gap-2", PORTAL_TEXT)}>
            <Clock className={cn("h-4 w-4", chrome.p.iconText)} />
            Courses this semester
          </h3>
          <p className={cn("text-sm mt-1", PORTAL_TEXT_MUTED)}>
            Set recurring hours for each course you teach this term. All courses appear on your public page.
          </p>
        </div>

        {courses.length === 0 ? (
          <div className={cn("p-4 sm:p-5 text-sm", PORTAL_TEXT_MUTED)}>
            No courses linked to the selected university and semester. Switch offering in the dashboard header.
          </div>
        ) : (
          courses.map((course) => (
            <div key={course.offeringKey} className="p-4 sm:p-5 space-y-3">
              <div>
                <p className={cn("font-medium", PORTAL_TEXT)}>
                  {course.courseCode}
                  {course.sessionCode && course.sessionCode !== course.courseCode
                    ? ` · ${course.sessionCode}`
                    : ""}
                </p>
                <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>{course.courseTitle}</p>
                {course.hoursSource === "syllabus" ? (
                  <p className={cn("text-xs mt-1", PORTAL_TEXT_MUTED)}>
                    Showing hours from this section&apos;s published syllabus. Save here to override on the door QR page.
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  Location override (optional)
                </Label>
                <Input
                  placeholder={defaultOfficeLocation || "Uses default room above"}
                  value={course.officeLocation ?? ""}
                  onChange={(e) => updateCourse(course.offeringKey, { officeLocation: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                {course.slots.map((slot, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--sidebar-accent)]/30 p-3"
                  >
                    <Select
                      value={String(slot.dayOfWeek)}
                      onValueChange={(v) => updateSlot(course.offeringKey, i, "dayOfWeek", parseInt(v, 10))}
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAY_OPTIONS.map((d) => (
                          <SelectItem key={d.value} value={String(d.value)}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="time"
                      value={slot.startTime}
                      onChange={(e) => updateSlot(course.offeringKey, i, "startTime", e.target.value)}
                      className="w-[120px]"
                    />
                    <span className="text-[var(--cc-text-muted)]">–</span>
                    <Input
                      type="time"
                      value={slot.endTime}
                      onChange={(e) => updateSlot(course.offeringKey, i, "endTime", e.target.value)}
                      className="w-[120px]"
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeSlot(course.offeringKey, i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => addSlot(course.offeringKey)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add time slot
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className={chrome.p.cta}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save & publish
        </Button>
      </div>
    </div>
  )
}
