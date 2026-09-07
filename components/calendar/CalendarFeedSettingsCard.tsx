"use client"

import { useEffect, useState } from "react"
import { CalendarPlus, Check, Copy, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  InstructorPolicyDividedList,
  InstructorPolicySurfaceCard,
  InstructorPolicyToggleRow,
} from "@/components/instructor/InstructorPolicySurfaceCard"
import { studentApiFetch } from "@/lib/auth"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

type CalendarFeedClient = {
  httpsUrl: string
  webcalUrl: string
  beforeMinutes: number
  atStart: boolean
}

function asFeed(data: Record<string, unknown>): CalendarFeedClient {
  const httpsUrl = String(data.httpsUrl ?? "").trim()
  const webcalUrl = String(data.webcalUrl ?? "").trim()
  if (!httpsUrl) throw new Error("Calendar link was not returned.")
  return {
    httpsUrl,
    webcalUrl: webcalUrl || httpsUrl.replace(/^https:/i, "webcal:"),
    beforeMinutes: Number(data.beforeMinutes) === 0 ? 0 : 15,
    atStart: data.atStart !== false,
  }
}

async function fetchFeed(portal: "faculty" | "student"): Promise<CalendarFeedClient> {
  const path = portal === "faculty" ? "/api/instructor/calendar/feed" : "/api/student/calendar/feed"
  const res =
    portal === "faculty"
      ? await instructorApiFetch(path, { headers: buildInstructorApiHeaders() })
      : await studentApiFetch(path)
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new Error(String(data.error || "Could not load calendar feed."))
  return asFeed(data)
}

async function patchFeed(
  portal: "faculty" | "student",
  prefs: { beforeMinutes: number; atStart: boolean },
): Promise<void> {
  const path = portal === "faculty" ? "/api/instructor/calendar/feed" : "/api/student/calendar/feed"
  const init: RequestInit = {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  }
  const res =
    portal === "faculty"
      ? await instructorApiFetch(path, {
          ...init,
          headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
        })
      : await studentApiFetch(path, init)
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    throw new Error(String(data.error || "Could not save calendar alerts."))
  }
}

export function CalendarFeedSettingsCard({
  portal,
  description,
  switchClass,
  ctaClass,
  quietClass,
}: {
  portal: "faculty" | "student"
  description: string
  switchClass?: string
  ctaClass?: string
  quietClass?: string
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [feed, setFeed] = useState<CalendarFeedClient | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchFeed(portal)
      .then((next) => {
        if (!cancelled) setFeed(next)
      })
      .catch((err) => {
        if (!cancelled) {
          toast({
            title: "Could not load calendar alerts",
            description: err instanceof Error ? err.message : "Try again.",
            variant: "destructive",
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [portal])

  const notifyBefore = (feed?.beforeMinutes ?? 15) > 0
  const atStart = feed?.atStart !== false

  async function save(next: { beforeMinutes: number; atStart: boolean }) {
    if (!feed || saving) return
    const previous = feed
    setFeed({ ...feed, ...next })
    setSaving(true)
    try {
      await patchFeed(portal, next)
    } catch (err) {
      setFeed(previous)
      toast({
        title: "Could not save",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  async function copyLink() {
    if (!feed) return
    try {
      await navigator.clipboard.writeText(feed.httpsUrl)
      setCopied(true)
      toast({
        title: "Calendar link copied",
        description: "In Google Calendar: Settings → Add calendar → From URL.",
      })
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({
        title: "Could not copy",
        description: feed.httpsUrl,
        variant: "destructive",
      })
    }
  }

  function subscribe() {
    if (!feed) return
    window.location.href = feed.webcalUrl
  }

  return (
    <InstructorPolicySurfaceCard
      className="w-full"
      title="Calendar alerts"
      description={description}
    >
      {loading ? (
        <p className={cn("flex items-center gap-2 text-sm", PORTAL_TEXT_MUTED)}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading calendar feed…
        </p>
      ) : feed ? (
        <>
          <InstructorPolicyDividedList>
            <InstructorPolicyToggleRow
              label="15 minutes before"
              hint="Alert before each class starts"
              checked={notifyBefore}
              onCheckedChange={(value) =>
                void save({ beforeMinutes: value ? 15 : 0, atStart })
              }
              switchClass={switchClass}
            />
            <InstructorPolicyToggleRow
              label="At class time"
              hint="Alert when class begins"
              checked={atStart}
              onCheckedChange={(value) =>
                void save({ beforeMinutes: notifyBefore ? 15 : 0, atStart: value })
              }
              switchClass={switchClass}
            />
          </InstructorPolicyDividedList>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className={cn("h-9 gap-2 rounded-lg", ctaClass)} onClick={subscribe}>
              <CalendarPlus className="h-4 w-4" />
              Subscribe in Calendar
            </Button>
            <Button
              type="button"
              variant="outline"
              className={cn("h-9 gap-2 rounded-lg", quietClass)}
              onClick={() => void copyLink()}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Copy calendar link
            </Button>
          </div>
          <p className={cn("text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
            Subscribe once. Times update when a class schedule changes.
          </p>
        </>
      ) : null}
    </InstructorPolicySurfaceCard>
  )
}
