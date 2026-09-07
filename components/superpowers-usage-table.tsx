"use client"

import { useEffect, useState } from "react"
import { SUPERPOWER_CONFIG } from "@/lib/superpowers-constants"

interface UsageRow {
  attemptId: number
  attemptNumber: number
  startedAt: string
  completedAt: string | null
  superpowers: string[]
  studentId: string
  studentName: string
}

interface SuperpowersUsageTableProps {
  quizId: string
  userType: "instructor" | "admin"
  enabled?: boolean
}

export function SuperpowersUsageTable({ quizId, userType, enabled = true }: SuperpowersUsageTableProps) {
  const [usage, setUsage] = useState<UsageRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enabled || !quizId) {
      setLoading(false)
      return
    }
    const fetchUsage = async () => {
      try {
        const res = await fetch(`/api/${userType}/quizzes/${quizId}/superpowers-usage?limit=30`)
        const data = await res.json()
        setUsage(Array.isArray(data.usage) ? data.usage : [])
      } catch {
        setUsage([])
      } finally {
        setLoading(false)
      }
    }
    fetchUsage()
  }, [quizId, userType, enabled])

  if (!enabled) return null

  return (
    <div className="mt-4">
      <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Superpowers Applied by Students</h5>
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : usage.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No students have used superpowers yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left p-2 font-medium">Student</th>
                <th className="text-left p-2 font-medium">Attempt</th>
                <th className="text-left p-2 font-medium">Superpowers</th>
                <th className="text-left p-2 font-medium">Started</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((row) => (
                <tr key={row.attemptId} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="p-2">{row.studentName || row.studentId}</td>
                  <td className="p-2">#{row.attemptNumber}</td>
                  <td className="p-2">
                    <span className="flex flex-wrap gap-1">
                      {row.superpowers.map((id) => {
                        const cfg = SUPERPOWER_CONFIG[id as keyof typeof SUPERPOWER_CONFIG]
                        return cfg ? (
                          <span
                            key={id}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-200 text-xs"
                          >
                            {cfg.icon} {cfg.label}
                          </span>
                        ) : (
                          <span key={id} className="text-xs text-slate-500">{id}</span>
                        )
                      })}
                    </span>
                  </td>
                  <td className="p-2 text-slate-500 dark:text-slate-400">
                    {row.startedAt ? new Date(row.startedAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
