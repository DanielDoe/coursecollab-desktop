"use client"

import { useEffect, useMemo, useState } from "react"
import { Clock, Globe, Loader2, Save } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import {
  TIMEZONE_GROUP_ORDER,
  TIMEZONE_GROUPS,
  buildTimezoneOptions,
  detectBrowserTimezone,
} from "@/lib/user-timezone-catalog"
import { formatInTimeZone } from "date-fns-tz"
import { DEFAULT_USER_TIMEZONE, normalizeTimezone } from "@/lib/user-timezone"
import { useUserTimezoneOptional } from "@/components/providers/user-timezone-provider"

export function TimezoneSettingsCard({ className }: { className?: string }) {
  const { toast } = useToast()
  const ctx = useUserTimezoneOptional()
  const options = useMemo(() => buildTimezoneOptions(), [])
  const [selected, setSelected] = useState(ctx?.timezone ?? DEFAULT_USER_TIMEZONE)
  const [filter, setFilter] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (ctx?.timezone) setSelected(ctx.timezone)
  }, [ctx?.timezone])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        o.offsetLabel.toLowerCase().includes(q),
    )
  }, [filter, options])

  const preview = formatInTimeZone(new Date(), normalizeTimezone(selected), "EEEE, MMM d, yyyy • h:mm:ss a zzz")

  const handleSave = async () => {
    const tz = normalizeTimezone(selected)
    setSaving(true)
    try {
      if (ctx) {
        await ctx.setTimezone(tz, { persist: true })
      } else {
        const { setDisplayTimezone, resolveUserIdentity } = await import("@/lib/user-timezone")
        setDisplayTimezone(tz)
        const identity = resolveUserIdentity()
        if (identity) {
          const res = await fetch("/api/user/timezone", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: identity.role, userId: identity.userId, timezone: tz }),
          })
          if (!res.ok) throw new Error("Failed to save")
        }
      }
      toast({
        title: "Timezone updated",
        description: "Dates and times across the app now use your selected zone.",
      })
    } catch {
      toast({ title: "Error", description: "Could not save timezone.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const useDeviceTimezone = () => {
    setSelected(detectBrowserTimezone())
  }

  return (
    <Card
      className={`rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-slate-900/50 shadow-sm ${className ?? ""}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-100 dark:bg-violet-900/30">
            <Globe className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Time zone</CardTitle>
            <CardDescription>
              All dates and deadlines are shown in your chosen zone. Course scheduling stays in Central Time.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tz-filter">Search time zones</Label>
          <Input
            id="tz-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="City, region, or offset…"
            className="rounded-lg"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone-select">Your time zone</Label>
          <select
            id="timezone-select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm"
            size={Math.min(8, Math.max(4, filtered.length))}
          >
            {filter.trim() ? (
              filtered.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.offsetLabel} — {o.label}
                </option>
              ))
            ) : (
              TIMEZONE_GROUP_ORDER.map((group) => (
                <optgroup key={group} label={group}>
                  {TIMEZONE_GROUPS[group].map((value) => {
                    const o = options.find((x) => x.value === value)
                    return (
                      <option key={value} value={value}>
                        {o ? `${o.offsetLabel} — ${o.label}` : value}
                      </option>
                    )
                  })}
                </optgroup>
              ))
            )}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={useDeviceTimezone}>
            Use device time zone
          </Button>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300">
          <Clock className="h-4 w-4 mt-0.5 shrink-0 text-violet-500" />
          <span>
            Preview: <span className="font-medium text-slate-900 dark:text-white">{preview}</span>
          </span>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-violet-600 hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save time zone
        </Button>
      </CardContent>
    </Card>
  )
}
