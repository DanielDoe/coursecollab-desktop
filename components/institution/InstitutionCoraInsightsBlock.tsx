"use client"

import { useEffect, useState } from "react"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

export function InstitutionCoraInsightsBlock() {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    void fetch("/api/institution/cora-insights", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => j.ok && setData(j.data))
      .catch(() => undefined)
  }, [])
  if (!data) return null
  return (
    <div className={`${PORTAL_CARD} p-4`}>
      <h3 className={`mb-2 text-sm font-semibold ${PORTAL_TEXT}`}>Cora Insights (aggregated)</h3>
      <p className={`mb-3 text-xs ${PORTAL_TEXT_MUTED}`}>
        Institution-wide structured summaries. Individual student conversations are not shown.
      </p>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Active users" value={data.adoptionStudents} />
        <Stat label="Cora events" value={data.events} />
        <Stat label="Answer protections" value={data.answerProtections} />
        <Stat label="Assisted success" value={data.assistedSuccessRate == null ? "—" : `${data.assistedSuccessRate}%`} />
      </div>
      {(data.units ?? []).length ? (
        <div className="mt-3 space-y-1">
          {data.units.slice(0, 6).map((u: any) => (
            <p key={u.unit} className={`text-xs ${PORTAL_TEXT_MUTED}`}>
              {u.unit}: {u.users} users · {u.events} events
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className={`text-xs ${PORTAL_TEXT_MUTED}`}>{label}</p>
      <p className={`text-lg font-semibold ${PORTAL_TEXT}`}>{value}</p>
    </div>
  )
}
