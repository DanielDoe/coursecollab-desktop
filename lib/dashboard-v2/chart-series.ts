export function buildLast7DaySeries(rows: { date: Date | string; count: number }[]) {
  const now = new Date()
  const days: { date: string; label: string; count: number }[] = []

  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
    const dateStr = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
    const row = rows.find((r) => {
      const rDate = r.date instanceof Date ? r.date : new Date(r.date)
      return rDate.toISOString().slice(0, 10) === dateStr
    })
    days.push({ date: dateStr, label, count: row ? Number(row.count) : 0 })
  }

  return days
}

function utcDateKey(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value)
  return d.toISOString().slice(0, 10)
}

/** Daily series when the span is short; weekly otherwise. From first submission through today. */
export function buildSubmissionsOverTimeSeries(rows: { date: Date | string; count: number }[]) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = utcDateKey(row.date)
    counts.set(key, (counts.get(key) ?? 0) + Number(row.count))
  }
  if (counts.size === 0) return []

  const firstKey = [...counts.keys()].sort()[0]
  const first = new Date(`${firstKey}T00:00:00.000Z`)
  const now = new Date()
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const spanDays = Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1

  if (spanDays <= 21) {
    const days: { date: string; label: string; count: number }[] = []
    for (let t = first.getTime(); t <= last.getTime(); t += 86_400_000) {
      const d = new Date(t)
      const dateStr = d.toISOString().slice(0, 10)
      days.push({
        date: dateStr,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
        count: counts.get(dateStr) ?? 0,
      })
    }
    return days
  }

  const weeks: { date: string; label: string; count: number }[] = []
  const start = new Date(first)
  start.setUTCDate(start.getUTCDate() - start.getUTCDay())
  for (let t = start.getTime(); t <= last.getTime(); t += 7 * 86_400_000) {
    let count = 0
    for (let i = 0; i < 7; i++) {
      count += counts.get(new Date(t + i * 86_400_000).toISOString().slice(0, 10)) ?? 0
    }
    const weekStart = new Date(t)
    weeks.push({
      date: weekStart.toISOString().slice(0, 10),
      label: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      count,
    })
  }
  return weeks.length > 16 ? weeks.slice(-16) : weeks
}
